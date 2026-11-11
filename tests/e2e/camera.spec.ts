import { readdirSync, readFileSync } from "fs"
import { createHash } from "node:crypto"
import path from "path"
import { expect, test, type Page } from "@playwright/test"

// Chromium's fake camera plays this still: a modern photograph of the Mission House, a little
// turned, so the camera has a real scene to show.
const FAKE_CAMERA = path.join(
  process.cwd(),
  "tests",
  "fixtures",
  "fake-camera.y4m"
)

test.use({
  launchOptions: {
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-video-capture=${FAKE_CAMERA}`,
    ],
  },
  permissions: ["camera"],
})

function archive(slug: string) {
  const folder = path.join(process.cwd(), "public", "posts")
  for (const name of readdirSync(folder)) {
    const json = JSON.parse(
      readFileSync(path.join(folder, name, `${name}.json`), "utf8")
    )
    if (json.slug === slug)
      return json as { w: number; h: number; b_imageUrl: string }
  }
  throw new Error(`No place ${slug}`)
}

type Crop = { cx: number; cy: number; width: number; rotation: number }

async function readCrop(page: Page): Promise<Crop> {
  return JSON.parse(
    (await page.getByTestId("rephoto-review").getAttribute("data-crop")) ?? "{}"
  )
}

async function openCamera(page: Page, slug: string) {
  await page.goto(`/${slug}/camera`)
  await expect(page.getByTestId("rephoto-shutter")).toBeEnabled()
  await expect
    .poll(() =>
      page
        .getByTestId("rephoto-video")
        .evaluate((video: HTMLVideoElement) => video.videoWidth)
    )
    .toBeGreaterThan(0)
}

const FAKE_ORT = readFileSync(
  path.join(process.cwd(), "tests", "fixtures", "fake-ort.mjs"),
  "utf8"
)

// Simulated application integration: fabricated GPU capability and server-backed ORT answers.
// This does not exercise a graphics chip, actual local inference or an Android camera.
async function onPhoneMatcher(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "gpu", {
      configurable: true,
      get: () => ({
        requestAdapter: async () => ({ features: new Set(["shader-f16"]) }),
      }),
    })
  })
  await page.route("https://cdn.jsdelivr.net/**/ort.webgpu.min.mjs", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: FAKE_ORT,
      headers: { "access-control-allow-origin": "*" },
    })
  )
}

// These tests are about what happens after a photo, not matching it: the server's matcher is
// left out (as with no signal, so the photo can still be sent) to keep its CPU for other tests.
async function withoutServerMatcher(page: Page) {
  await page.route("**/api/align", (route) =>
    route.abort("internetdisconnected")
  )
}

async function shoot(page: Page) {
  await page.getByTestId("rephoto-shutter").click()
  await expect(page.getByTestId("rephoto-review")).toBeVisible()
  await expect(page.getByTestId("rephoto-review-frame")).toBeVisible()
}

test.describe("simulated camera application and API boundaries", () => {
  // Test browsers have no graphics chip, so matching goes to the site's server unless a test
  // gives the page one.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      // @ts-expect-error removing WebGPU for the test
      delete Navigator.prototype.gpu
    })
  })

  test("while the photo is being lined up, the main button says so and can't send yet", async ({
    page,
  }) => {
    await page.route("**/api/align", () => {})
    await openCamera(page, "mission-house")
    await shoot(page)
    await expect(page.getByTestId("rephoto-review")).toHaveAttribute(
      "data-phase",
      "aligning"
    )
    const send = page.getByTestId("rephoto-send")
    await expect(send).toHaveText("Lining up…")
    await expect(send).toBeDisabled()
    await expect(page.getByTestId("rephoto-retake")).toBeEnabled()
  })

  test("a photo that couldn't be compared, for want of a signal, can still be sent", async ({
    page,
  }) => {
    await page.route("**/api/align", (route) => route.abort())
    await openCamera(page, "mission-house")
    await shoot(page)
    await expect(page.getByTestId("rephoto-review")).toHaveAttribute(
      "data-phase",
      "unchecked",
      { timeout: 30_000 }
    )
    const send = page.getByTestId("rephoto-send")
    await expect(send).toHaveText("Send photo")
    await expect(send).toBeEnabled()
  })

  test("a phone whose own matcher can't load lines the shot up on the server", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, "gpu", {
        configurable: true,
        get: () => ({
          requestAdapter: async () => ({ features: new Set(["shader-f16"]) }),
        }),
      })
    })
    await page.route("https://cdn.jsdelivr.net/**", (route) => route.abort())
    let serverCalls = 0
    page.on("request", (request) => {
      if (request.url().endsWith("/api/align")) serverCalls++
    })
    await openCamera(page, "mission-house")
    await shoot(page)
    await expect(page.getByTestId("rephoto-review")).toHaveAttribute(
      "data-phase",
      "framed",
      { timeout: 30_000 }
    )
    expect(serverCalls).toBe(1)
  })

  test("a phone that asks to save data still gets the live guide", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, "connection", {
        configurable: true,
        get: () => ({ saveData: true }),
      })
    })
    await onPhoneMatcher(page)
    await openCamera(page, "mission-house")
    await expect(page.getByTestId("rephoto-stage")).toHaveAttribute(
      "data-lock",
      /found|held|steady/,
      { timeout: 30_000 }
    )
  })

  test("a server that takes over ten seconds to match still lines the shot up", async ({
    page,
  }) => {
    // The site's server took 9-11 s a match, and the camera gave up at 10 (Glen Innes, Nov 2026).
    await page.route("**/api/align", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 12_000))
      await route.continue()
    })
    await openCamera(page, "mission-house")
    await shoot(page)
    await expect(page.getByTestId("rephoto-review")).toHaveAttribute(
      "data-phase",
      "framed",
      { timeout: 45_000 }
    )
  })

  test("the matcher refuses anything but two pictures of the agreed size", async ({
    request,
  }) => {
    const response = await request.post("/api/align", {
      data: Buffer.alloc(10),
    })
    expect(response.status()).toBe(400)
  })

  test("the matcher serves only this site's own pages", async ({ request }) => {
    const response = await request.post("/api/align", {
      data: Buffer.alloc(10),
      headers: { "sec-fetch-site": "cross-site" },
    })
    expect(response.status()).toBe(403)
  })

  test("the camera's reports are taken only from this site", async ({
    request,
  }) => {
    const send = (headers: Record<string, string>, data: string) =>
      request.post("/api/camera-log", { headers, data })
    expect(
      (
        await send({ "sec-fetch-site": "cross-site" }, '{"event":"open"}')
      ).status()
    ).toBe(403)
    expect((await send({}, "not json")).status()).toBe(400)
    expect((await send({}, "x".repeat(13000))).status()).toBe(413)
    expect((await send({}, '{"event":"open"}')).status()).toBe(204)
    // Real intake contract: cached clients remain accepted, but malformed structured
    // diagnostics and unbounded requests never reach the log. No other journey owns intake.
    const batch = {
      version: 2,
      session: "12345678-1234-1234-1234-123456789abc",
      build: "abcdef123456",
      browser: "chrome",
      seq: 1,
      dropped: 0,
      deliveryFailures: 0,
      events: [
        {
          event: "match result",
          at: 20,
          run: 1,
          outcome: "miss",
          reason: "insufficient_matches",
          rawMatches: 2,
        },
      ],
    }
    expect((await send({}, JSON.stringify(batch))).status()).toBe(204)
    expect(
      (
        await send(
          {},
          JSON.stringify({
            ...batch,
            events: [{ event: "secret-token", at: 20 }],
          })
        )
      ).status()
    ).toBe(400)
    expect(
      (
        await send(
          {},
          JSON.stringify({ ...batch, events: Array(17).fill(batch.events[0]) })
        )
      ).status()
    ).toBe(400)
    expect(
      (await send({}, JSON.stringify({ ...batch, seq: -1 }))).status()
    ).toBe(400)
    expect(
      (
        await send(
          {},
          JSON.stringify({
            ...batch,
            events: [{ ...batch.events[0], at: "token" }],
          })
        )
      ).status()
    ).toBe(400)
  })

  test("one network's camera can only report so often", async ({ request }) => {
    // Its own address, so no other test (or an earlier run on a reused server) shares the count.
    const headers = { "x-real-ip": `log-${Date.now()}-${Math.random()}` }
    const report = (from: Record<string, string>) =>
      request.post("/api/camera-log", {
        data: '{"event":"open"}',
        headers: from,
      })
    for (let i = 0; i < 300; i++)
      expect((await report(headers)).status()).toBe(204)
    expect((await report(headers)).status()).toBe(429)
    // Somebody else's address is not held up by it.
    expect(
      (
        await report({ "x-real-ip": `other-${Date.now()}-${Math.random()}` })
      ).status()
    ).toBe(204)
  })

  test("sending gives one photograph at the old one's shape, then thanks and leads back to the story", async ({
    page,
  }) => {
    const place = archive("mission-house")
    const diagnosticSends: { submissionTag?: string; capture: number }[] = []
    page.on("request", (request) => {
      if (request.url().endsWith("/api/camera-log"))
        diagnosticSends.push(
          ...(request.postDataJSON()?.events ?? []).filter(
            (e: { event: string }) => e.event === "send"
          )
        )
    })
    const sent: { url: URL; body: Buffer }[] = []
    await page.route("**/api/submit?**", async (route) => {
      sent.push({
        url: new URL(route.request().url()),
        body: route.request().postDataBuffer()!,
      })
      await route.fulfill({ json: { ok: true } })
    })
    await openCamera(page, "mission-house")
    await shoot(page)
    await expect(page.getByTestId("rephoto-review")).toHaveAttribute(
      "data-phase",
      "framed",
      { timeout: 30_000 }
    )
    await expect(page.getByTestId("rephoto-consent")).toBeVisible()
    const send = page.getByTestId("rephoto-send")
    await expect(send).toHaveText("Send photo", { timeout: 30_000 })
    await send.dblclick()

    await expect(page.getByTestId("rephoto-sent")).toContainText("Thank you.")
    expect(sent).toHaveLength(1)
    const [{ url, body }] = sent
    expect(url.searchParams.get("place")).toBe("mission-house")
    expect(url.searchParams.get("checked")).toBe("0")
    expect(url.searchParams.get("key")).toMatch(/^[a-z0-9]{24}$/)
    // Join the actual upload to its diagnostic capture without logging its raw key.
    const tag = createHash("sha256")
      .update(url.searchParams.get("key")!)
      .digest("hex")
      .slice(0, 16)
    await expect
      .poll(() =>
        diagnosticSends.some((e) => e.capture === 1 && e.submissionTag === tag)
      )
      .toBe(true)
    expect(body.length).toBeLessThan(3_500_000)
    expect([...body.subarray(0, 2)]).toEqual([0xff, 0xd8])
    const size = await page.evaluate(async (base64) => {
      const image = new Image()
      image.src = `data:image/jpeg;base64,${base64}`
      await image.decode()
      return { width: image.naturalWidth, height: image.naturalHeight }
    }, body.toString("base64"))
    expect(size.height / size.width).toBeCloseTo(place.h / place.w, 2)

    await expect(page.getByTestId("rephoto-done")).toHaveAttribute(
      "href",
      "/mission-house"
    )
  })

  test("a slow first answer about the phone holds the photo back until the phone has its cookie", async ({
    page,
  }) => {
    await withoutServerMatcher(page)
    const order: string[] = []
    await page.route("**/api/me", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 5_000))
      order.push("cookie")
      await route.fulfill({ json: { name: null } })
    })
    await page.route("**/api/submit?**", async (route) => {
      order.push("photo")
      await route.fulfill({ json: { ok: true } })
    })
    await openCamera(page, "mission-house")
    await shoot(page)
    const send = page.getByTestId("rephoto-send")
    await expect(send).toHaveText("Send photo", { timeout: 30_000 })
    await send.click()
    await expect(page.getByTestId("rephoto-sent")).toBeVisible({
      timeout: 15_000,
    })
    expect(order).toEqual(["cookie", "photo"])
  })

  test("a photo that fails to send can be kept and sent again, as one photo", async ({
    page,
  }) => {
    const keys: string[] = []
    let online = false
    await page.route("**/api/submit?**", async (route) => {
      keys.push(new URL(route.request().url()).searchParams.get("key")!)
      if (online) await route.fulfill({ json: { ok: true } })
      else await route.abort("internetdisconnected")
    })
    await openCamera(page, "mission-house")
    await shoot(page)
    const send = page.getByTestId("rephoto-send")
    await expect(send).toHaveText("Send photo", { timeout: 30_000 })
    await send.click()

    await expect(page.getByTestId("rephoto-note")).toHaveText(
      "Not sent. Check your signal."
    )
    await expect(send).toHaveText("Send again")
    await expect(page.getByTestId("rephoto-retake")).toBeEnabled()
    const downloadPromise = page.waitForEvent("download")
    await page.getByTestId("rephoto-save").click()
    expect((await downloadPromise).suggestedFilename()).toMatch(
      /^mission-house-now-\d{4}-\d{2}-\d{2}\.jpg$/
    )

    online = true
    await send.click()
    await expect(page.getByTestId("rephoto-sent")).toBeVisible()
    expect(keys).toHaveLength(2)
    expect(keys[1]).toBe(keys[0])
    // A copy can still be kept after sending.
    const keptPromise = page.waitForEvent("download")
    await page.getByTestId("rephoto-save").click()
    await keptPromise
  })

  test("while a photo is sending, it can't be closed or retaken", async ({
    page,
  }) => {
    await page.route("**/api/submit?**", () => {})
    await openCamera(page, "mission-house")
    await shoot(page)
    const send = page.getByTestId("rephoto-send")
    await expect(send).toHaveText("Send photo", { timeout: 30_000 })
    await send.click()
    await expect(send).toHaveText("Sending…")
    await expect(send).toBeDisabled()
    await expect(page.getByTestId("rephoto-retake")).toBeDisabled()
    await expect(page.getByRole("link", { name: "Close" })).toHaveCount(0)
  })

  test("the photo store takes only real photos of the site's places, from the site", async ({
    request,
  }) => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0xff, 0xd9])
    const post = (query: string, data: Buffer, headers = {}) =>
      request.post(`/api/submit?${query}`, { data, headers })
    const key = "abcdefghijkl0123"
    expect(
      (
        await post(`place=mission-house&key=${key}`, jpeg, {
          "sec-fetch-site": "cross-site",
        })
      ).status()
    ).toBe(403)
    expect((await post(`place=mission-house&key=x`, jpeg)).status()).toBe(400)
    expect((await post(`place=nowhere&key=${key}`, jpeg)).status()).toBe(404)
    expect(
      (
        await post(`place=mission-house&key=${key}`, Buffer.from("hello"))
      ).status()
    ).toBe(415)
    // Two marker bytes around rubbish are not a photograph.
    expect((await post(`place=mission-house&key=${key}`, jpeg)).status()).toBe(
      415
    )
    // A real photograph passes every check and is stored.
    const real = readFileSync(
      path.join(process.cwd(), "public", archive("mission-house").b_imageUrl)
    )
    expect(
      (
        await post(`place=mission-house&key=${key}`, real, {
          "x-real-ip": `test-${Date.now()}-${Math.random()}`,
        })
      ).status()
    ).toBe(200)
  })

  test("one network can only knock on the photo store so often, whatever it sends", async ({
    request,
  }) => {
    // Its own address, so no other test (or an earlier run on a reused server) shares the count.
    const headers = { "x-real-ip": `test-${Date.now()}-${Math.random()}` }
    const junk = Buffer.from("hello")
    const post = () =>
      request.post("/api/submit?place=mission-house&key=abcdefghijkl0123", {
        data: junk,
        headers,
      })
    for (let i = 0; i < 240; i++) expect((await post()).status()).toBe(415)
    expect((await post()).status()).toBe(429)
    // Somebody else's address is not held up by it.
    expect(
      (
        await request.post(
          "/api/submit?place=mission-house&key=abcdefghijkl0123",
          {
            data: junk,
            headers: { "x-real-ip": `other-${Date.now()}-${Math.random()}` },
          }
        )
      ).status()
    ).toBe(415)
  })

  test("the camera stays closed while a taken photo is looked at, and opens again for a retake", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const real = navigator.mediaDevices.getUserMedia.bind(
        navigator.mediaDevices
      )
      const w = window as unknown as { __opens: number }
      w.__opens = 0
      navigator.mediaDevices.getUserMedia = (constraints) => {
        w.__opens++
        return real(constraints)
      }
    })
    const opens = () =>
      page.evaluate(() => (window as unknown as { __opens: number }).__opens)
    await withoutServerMatcher(page)
    await openCamera(page, "mission-house")
    expect(await opens()).toBe(1)
    await shoot(page)
    // Longer than the frozen-picture check waits before it would open the camera again.
    await page.waitForTimeout(4500)
    expect(await opens()).toBe(1)
    await page.getByTestId("rephoto-retake").click()
    await expect(page.getByTestId("rephoto-shutter")).toBeEnabled()
    await expect.poll(opens).toBe(2)
  })

  test("the camera is let go while the page is out of sight", async ({
    page,
  }) => {
    await page.goto("/mission-house/camera")
    await expect(page.getByTestId("rephoto-shutter")).toBeEnabled()
    const live = () =>
      page.evaluate(
        () =>
          (document.querySelector("video")?.srcObject as MediaStream | null)
            ?.getVideoTracks()
            .some((track) => track.readyState === "live") ?? false
      )
    const setVisibility = (state: "hidden" | "visible") =>
      page.evaluate((state) => {
        Object.defineProperty(document, "visibilityState", {
          configurable: true,
          get: () => state,
        })
        document.dispatchEvent(new Event("visibilitychange"))
      }, state)
    await setVisibility("hidden")
    await expect.poll(live).toBe(false)
    await setVisibility("visible")
    await expect.poll(live).toBe(true)
    await expect(page.getByTestId("rephoto-shutter")).toBeEnabled()
  })

  test("a camera that answers after the page went out of sight is let go", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const real = navigator.mediaDevices.getUserMedia.bind(
        navigator.mediaDevices
      )
      const w = window as unknown as { __streams: MediaStream[] }
      w.__streams = []
      let calls = 0
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        const slow = ++calls > 1
        const stream = await real(constraints)
        w.__streams.push(stream)
        if (slow) await new Promise((resolve) => setTimeout(resolve, 1500))
        return stream
      }
    })
    await page.goto("/mission-house/camera")
    await expect(page.getByTestId("rephoto-shutter")).toBeEnabled()
    await page.evaluate(async () => {
      const set = (state: string) => {
        Object.defineProperty(document, "visibilityState", {
          configurable: true,
          get: () => state,
        })
        document.dispatchEvent(new Event("visibilitychange"))
      }
      set("hidden")
      set("visible")
      await new Promise((resolve) => setTimeout(resolve, 100))
      set("hidden")
    })
    await page.waitForTimeout(2500)
    expect(
      await page.evaluate(() =>
        (window as unknown as { __streams: MediaStream[] }).__streams.some(
          (stream) =>
            stream.getTracks().some((track) => track.readyState === "live")
        )
      )
    ).toBe(false)
  })

  test("a refused camera says how to fix it and offers to try again", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () =>
        Promise.reject(new DOMException("denied", "NotAllowedError"))
    })
    await page.goto("/mission-house/camera")
    await expect(page.getByTestId("rephoto-error")).toHaveText(
      "Allow camera access in your browser settings."
    )
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible()
    await expect(page.getByTestId("rephoto-shutter")).toBeDisabled()
  })
})
