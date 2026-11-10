import { readdirSync, readFileSync } from "fs"
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

// A phone that matches on its own graphics chip: WebGPU with half precision, and a runtime that
// answers like the real model does.
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

test.describe("the rephotography camera", () => {
  // Test browsers have no graphics chip, so matching goes to the site's server unless a test
  // gives the page one.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      // @ts-expect-error removing WebGPU for the test
      delete Navigator.prototype.gpu
    })
  })

  test("an upcoming place offers the camera", async ({ page }) => {
    await page.goto("/tamaki-road-board-offices")
    await expect(page.getByTestId("pending-camera")).toHaveAttribute(
      "href",
      "/tamaki-road-board-offices/camera"
    )
  })

  test("on a phone that allows it, the camera opens full screen and sideways, and gives the screen back on close", async ({
    page,
  }) => {
    const calls = await phoneScreen(page)
    await page.goto("/tamaki-road-board-offices")
    await page.getByTestId("pending-camera").click()
    await expect(page.getByTestId("rephoto-camera")).toBeVisible()
    await expect.poll(calls).toEqual(["fullscreen", "lock landscape"])
    await page.getByRole("link", { name: "Close camera" }).click()
    await expect
      .poll(calls)
      .toEqual(["fullscreen", "lock landscape", "unlock", "exit"])
  })

  test("an upright phone shows no hint to turn it", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openCamera(page, "mission-house")
    await expect(page.getByTestId("rephoto-ghost")).toBeVisible()
    await expect(page.getByText(/Turn sideways|Hold upright/)).toHaveCount(0)
  })

  test("the live view shows only the old photograph over the camera, a close button and the shutter", async ({
    page,
  }) => {
    const place = archive("mission-house")
    await openCamera(page, "mission-house")

    await expect(page.getByTestId("rephoto-ghost")).toHaveAttribute(
      "src",
      place.b_imageUrl
    )
    const frame = (await page.getByTestId("rephoto-frame").boundingBox())!
    expect(frame.height / frame.width).toBeCloseTo(place.h / place.w, 2)
    const video = await page
      .getByTestId("rephoto-video")
      .evaluate((element: HTMLVideoElement) => {
        const box = element.getBoundingClientRect()
        const scale = Math.min(
          box.width / element.videoWidth,
          box.height / element.videoHeight
        )
        const width = element.videoWidth * scale
        const height = element.videoHeight * scale
        return {
          left: box.left + (box.width - width) / 2,
          top: box.top + (box.height - height) / 2,
          width,
          height,
        }
      })
    expect(frame.x).toBeGreaterThanOrEqual(video.left - 0.5)
    expect(frame.y).toBeGreaterThanOrEqual(video.top - 0.5)
    expect(frame.x + frame.width).toBeLessThanOrEqual(
      video.left + video.width + 0.5
    )
    expect(frame.y + frame.height).toBeLessThanOrEqual(
      video.top + video.height + 0.5
    )

    // No words on a landscape screen for a landscape photograph.
    await page.setViewportSize({ width: 844, height: 390 })
    const words = await page.getByTestId("rephoto-camera").innerText()
    expect(words.trim()).toBe("")
  })

  test("holding the view hides the old photograph until let go", async ({
    page,
  }) => {
    await openCamera(page, "mission-house")
    const ghost = page.getByTestId("rephoto-ghost")
    await expect(ghost).toHaveCSS("opacity", "0.4")
    const stage = (await page.getByTestId("rephoto-stage").boundingBox())!
    await page.mouse.move(stage.x + stage.width / 2, stage.y + stage.height / 2)
    await page.mouse.down()
    await expect(ghost).toHaveCSS("opacity", "0")
    await page.mouse.up()
    await expect(ghost).toHaveCSS("opacity", "0.4")
  })

  test("a shot is lined up with the old photograph by itself, then shown on its own", async ({
    page,
  }) => {
    const place = archive("mission-house")
    await openCamera(page, "mission-house")
    const photo = await page
      .getByTestId("rephoto-video")
      .evaluate((video: HTMLVideoElement) => ({
        width: video.videoWidth,
        height: video.videoHeight,
      }))
    await shoot(page)

    const review = page.getByTestId("rephoto-review")
    await expect(review).toHaveAttribute("data-phase", "aligned", {
      timeout: 30_000,
    })
    // The fake camera's picture is the modern view turned 1.5 degrees; the crop turns with it.
    const crop = await readCrop(page)
    const degrees = (crop.rotation * 180) / Math.PI
    expect(Math.abs(degrees)).toBeGreaterThan(0.5)
    expect(Math.abs(degrees)).toBeLessThan(4)
    expect(crop.width / photo.width).toBeGreaterThan(0.7)
    expect(crop.width / photo.width).toBeLessThan(1.3)
    expect(Math.abs(crop.cx - photo.width / 2)).toBeLessThan(photo.width * 0.15)
    const frame = (await page
      .getByTestId("rephoto-review-frame")
      .boundingBox())!
    expect(frame.height / frame.width).toBeCloseTo(place.h / place.w, 2)

    // Once settled, the old photograph fades and the real one is left.
    await expect(page.getByTestId("rephoto-review-ghost")).toHaveCSS(
      "opacity",
      "0"
    )
  })

  test("a phone with its own matcher lines the old photograph up on the live view", async ({
    page,
  }) => {
    await onPhoneMatcher(page)
    await openCamera(page, "mission-house")
    await expect(page.getByTestId("rephoto-stage")).not.toHaveAttribute(
      "data-lock",
      "none",
      { timeout: 30_000 }
    )
    await shoot(page)
    await expect(page.getByTestId("rephoto-review")).toHaveAttribute(
      "data-phase",
      "aligned",
      { timeout: 30_000 }
    )
    expect(
      await page.evaluate(
        () => (window as unknown as { __localRuns: number }).__localRuns
      )
    ).toBeGreaterThan(1)
  })

  test("a shot keeps the live placement when the full picture can't be matched again", async ({
    page,
  }) => {
    await onPhoneMatcher(page)
    await openCamera(page, "mission-house")
    const stage = page.getByTestId("rephoto-stage")
    await expect(stage).toHaveAttribute("data-lock", /held|steady/, {
      timeout: 30_000,
    })
    await page.route("**/api/align", (route) => route.abort())
    await page.evaluate(
      () =>
        ((window as unknown as { __matcherDown: boolean }).__matcherDown = true)
    )
    await shoot(page)
    await expect(page.getByTestId("rephoto-review")).toHaveAttribute(
      "data-phase",
      "aligned",
      { timeout: 30_000 }
    )
    await expect(page.getByTestId("rephoto-note")).toHaveCount(0)
    const crop = await readCrop(page)
    expect(crop.rotation).not.toBe(0)
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
      "aligned",
      { timeout: 30_000 }
    )
    expect(serverCalls).toBe(1)
  })

  test("a shot that can't be matched keeps the levelled framing", async ({
    page,
  }) => {
    await page.route("**/api/align", (route) =>
      route.fulfill({ json: { matches: [] } })
    )
    await openCamera(page, "mission-house")
    const photo = await page
      .getByTestId("rephoto-video")
      .evaluate((video: HTMLVideoElement) => ({
        width: video.videoWidth,
        height: video.videoHeight,
      }))
    await shoot(page)

    await expect(page.getByTestId("rephoto-review")).toHaveAttribute(
      "data-phase",
      "unmatched"
    )
    await expect(page.getByTestId("rephoto-note")).toHaveText(
      "This doesn’t match the old photo. Stand where it was taken and try again."
    )
    const crop = await readCrop(page)
    expect(crop.rotation).toBe(0)
    expect(crop.cx).toBeCloseTo(photo.width / 2, 0)
    expect(crop.cy).toBeCloseTo(photo.height / 2, 0)
    // A photo of somewhere else can't be sent: the one way on is to take it again.
    await expect(page.getByTestId("rephoto-send")).toHaveCount(0)
    await expect(page.getByTestId("rephoto-retake")).toHaveCount(0)
    await expect(page.getByTestId("rephoto-again")).toHaveText("Retake")
    await page.getByTestId("rephoto-again").click()
    await expect(page.getByTestId("rephoto-shutter")).toBeEnabled()
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

  test("each step of a visit is reported, without the pictures", async ({
    page,
  }) => {
    const reports: Record<string, unknown>[] = []
    await page.route("**/api/camera-log", async (route) => {
      reports.push(JSON.parse(route.request().postData() ?? "{}"))
      await route.fulfill({ status: 204 })
    })
    await page.route("**/api/align", (route) =>
      route.fulfill({ json: { matches: [] } })
    )
    await openCamera(page, "mission-house")
    await shoot(page)
    await expect(page.getByTestId("rephoto-review")).toHaveAttribute(
      "data-phase",
      /aligned|unmatched/
    )
    await expect
      .poll(() => reports.map((report) => report.event))
      .toEqual(
        expect.arrayContaining(["open", "stream", "live", "shot", "review"])
      )
    const visits = new Set(reports.map((report) => report.visit))
    expect(visits.size).toBe(1)
    expect(JSON.stringify(reports).length).toBeLessThan(4000)
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
    expect((await send({}, "x".repeat(5000))).status()).toBe(413)
    expect((await send({}, '{"event":"open"}')).status()).toBe(204)
  })

  test("one network's camera can only report so often", async ({ request }) => {
    // Its own address, so no other test (or an earlier run on a reused server) shares the count.
    const headers = { "x-real-ip": `log-${Date.now()}-${Math.random()}` }
    const report = (from: Record<string, string>) =>
      request.post("/api/camera-log", { data: '{"event":"open"}', headers: from })
    for (let i = 0; i < 300; i++) expect((await report(headers)).status()).toBe(204)
    expect((await report(headers)).status()).toBe(429)
    // Somebody else's address is not held up by it.
    expect(
      (await report({ "x-real-ip": `other-${Date.now()}-${Math.random()}` })).status()
    ).toBe(204)
  })

  test("holding the result shows the old photograph over it", async ({
    page,
  }) => {
    await page.route("**/api/align", (route) =>
      route.fulfill({ json: { matches: [] } })
    )
    await openCamera(page, "mission-house")
    await shoot(page)
    const ghost = page.getByTestId("rephoto-review-ghost")
    await expect(ghost).toHaveCSS("opacity", "0")
    const frame = (await page
      .getByTestId("rephoto-review-frame")
      .boundingBox())!
    await page.mouse.move(frame.x + frame.width / 2, frame.y + frame.height / 2)
    await page.mouse.down()
    await expect(ghost).toHaveCSS("opacity", "0.5")
    await page.mouse.up()
    await expect(ghost).toHaveCSS("opacity", "0")
  })

  test("sending gives one photograph at the old one's shape, then thanks and leads back to the story", async ({
    page,
  }) => {
    const place = archive("mission-house")
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
      "aligned",
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
    expect(url.searchParams.get("checked")).toBe("1")
    expect(url.searchParams.get("key")).toMatch(/^[a-z0-9]{24}$/)
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

  test("after sending, one quiet link leads to signing up, and nothing stands in the way of Done", async ({
    page,
  }) => {
    await withoutServerMatcher(page)
    await page.route("**/api/submit?**", (route) =>
      route.fulfill({ json: { ok: true } })
    )
    await page.route("**/api/me", (route) =>
      route.fulfill({ json: { name: null } })
    )
    await openCamera(page, "mission-house")
    await shoot(page)
    await expect(page.getByTestId("rephoto-consent")).toHaveText(
      "By sending, you let then|now publish this photo. We don’t collect your location."
    )
    const send = page.getByTestId("rephoto-send")
    await expect(send).toHaveText("Send photo", { timeout: 30_000 })
    await send.click()

    const sent = page.getByTestId("rephoto-sent")
    await expect(sent).toContainText("Thank you.")
    await expect(sent.locator("input")).toHaveCount(0)
    await expect(page.getByTestId("rephoto-done")).toHaveAttribute(
      "href",
      "/mission-house"
    )
    const link = page.getByTestId("rephoto-your-photos")
    await expect(link).toHaveText("Sign up to be credited")
    await link.click()
    await expect(page).toHaveURL(/\/me$/)
    await expect(page.getByTestId("me-name-save")).toHaveText("Sign up")
  })

  test("someone already signed up is told whose name the photo went with", async ({
    page,
  }) => {
    await withoutServerMatcher(page)
    await page.route("**/api/submit?**", (route) =>
      route.fulfill({ json: { ok: true } })
    )
    await page.route("**/api/me", (route) =>
      route.fulfill({ json: { name: "Margaret T" } })
    )
    await openCamera(page, "mission-house")
    await shoot(page)
    const send = page.getByTestId("rephoto-send")
    await expect(send).toHaveText("Send photo", { timeout: 30_000 })
    await send.click()
    await expect(page.getByTestId("rephoto-your-photos")).toHaveText(
      "Sent as Margaret T"
    )
    await expect(page.getByTestId("rephoto-your-photos")).toHaveAttribute(
      "href",
      "/me"
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

  test("the review gives the phone its own lasting cookie before anything is sent", async ({
    page,
    context,
  }) => {
    await withoutServerMatcher(page)
    await openCamera(page, "mission-house")
    await shoot(page)
    await expect
      .poll(async () =>
        (await context.cookies()).find((cookie) => cookie.name === "tn_me")
      )
      .toBeTruthy()
    const cookie = (await context.cookies()).find((c) => c.name === "tn_me")!
    expect(cookie.value).toMatch(/^[A-Za-z0-9_-]{32}$/)
    expect(cookie.httpOnly).toBe(true)
    expect(cookie.sameSite).toBe("Lax")
    expect(cookie.expires * 1000 - Date.now()).toBeGreaterThan(
      399 * 24 * 60 * 60_000
    )
    // Asking again keeps the same cookie.
    const asked = page.waitForResponse("**/api/me")
    await page.getByTestId("rephoto-retake").click()
    await shoot(page)
    await asked
    const again = (await context.cookies()).find((c) => c.name === "tn_me")!
    expect(again.value).toBe(cookie.value)
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

  test("a photo the site won't take says so, and isn't offered again", async ({
    page,
  }) => {
    await page.route("**/api/submit?**", (route) =>
      route.fulfill({ status: 415, json: { error: "not a jpeg" } })
    )
    await openCamera(page, "mission-house")
    await shoot(page)
    const send = page.getByTestId("rephoto-send")
    await expect(send).toHaveText("Send photo", { timeout: 30_000 })
    await send.click()
    await expect(page.getByTestId("rephoto-note")).toHaveText(
      "This photo can’t be sent. You can keep a copy."
    )
    await expect(send).toHaveCount(0)
    await expect(page.getByTestId("rephoto-save")).toBeVisible()
    await expect(page.getByTestId("rephoto-retake")).toBeEnabled()
  })

  test("a site that can't take the photo just now asks to try again later, not to check the signal", async ({
    page,
  }) => {
    await page.route("**/api/submit?**", (route) =>
      route.fulfill({ status: 503, json: { error: "no store" } })
    )
    await openCamera(page, "mission-house")
    await shoot(page)
    const send = page.getByTestId("rephoto-send")
    await expect(send).toHaveText("Send photo", { timeout: 30_000 })
    await send.click()
    await expect(page.getByTestId("rephoto-note")).toHaveText(
      "Not sent. Please try again in a minute."
    )
    await expect(send).toHaveText("Send again")
  })

  test("too many photos from one network says to try later, not in a minute", async ({
    page,
  }) => {
    await page.route("**/api/submit?**", (route) =>
      route.fulfill({ status: 429, json: { error: "slow down" } })
    )
    await openCamera(page, "mission-house")
    await shoot(page)
    const send = page.getByTestId("rephoto-send")
    await expect(send).toHaveText("Send photo", { timeout: 30_000 })
    await send.click()
    await expect(page.getByTestId("rephoto-note")).toHaveText(
      "Not sent. Many photos came from this network just now. Please try again later."
    )
  })

  test("a copy can be kept without sending anything", async ({ page }) => {
    let sent = 0
    await page.route("**/api/submit?**", async (route) => {
      sent += 1
      await route.fulfill({ json: { ok: true } })
    })
    await openCamera(page, "mission-house")
    await shoot(page)
    await expect(page.getByTestId("rephoto-send")).toHaveText("Send photo", {
      timeout: 30_000,
    })
    const save = page.getByTestId("rephoto-save")
    const downloadPromise = page.waitForEvent("download")
    await save.click()
    await downloadPromise
    await expect(save).toHaveText("In your Downloads")
    await expect(page.getByTestId("rephoto-consent")).toBeVisible()
    expect(sent).toBe(0)
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
        await request.post("/api/submit?place=mission-house&key=abcdefghijkl0123", {
          data: junk,
          headers: { "x-real-ip": `other-${Date.now()}-${Math.random()}` },
        })
      ).status()
    ).toBe(415)
  })

  test("retake returns to the live camera", async ({ page }) => {
    await openCamera(page, "mission-house")
    await shoot(page)
    await page.getByTestId("rephoto-retake").click()
    await expect(page.getByTestId("rephoto-camera")).toBeVisible()
    await expect(page.getByTestId("rephoto-shutter")).toBeEnabled()
  })

  test("a phone leaning to one side is levelled when the shot can't be matched", async ({
    page,
  }) => {
    await page.route("**/api/align", (route) =>
      route.fulfill({ json: { matches: [] } })
    )
    await openCamera(page, "mission-house")
    // Gravity as a phone held upright with its top leaning about three degrees clockwise.
    const lean = Math.atan2(0.5, 9.8)
    await page.evaluate(() => {
      for (let i = 0; i < 40; i++) {
        window.dispatchEvent(
          new DeviceMotionEvent("devicemotion", {
            accelerationIncludingGravity: { x: -0.5, y: 9.8, z: 0.2 },
          })
        )
      }
    })
    await shoot(page)
    await expect(page.getByTestId("rephoto-review")).toHaveAttribute(
      "data-phase",
      "unmatched"
    )
    expect((await readCrop(page)).rotation).toBeCloseTo(-lean, 3)
  })

  test("a camera stuck without a picture says to restart the browser", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      HTMLMediaElement.prototype.play = () => new Promise(() => {})
    })
    await page.goto("/mission-house/camera")
    await page
      .getByRole("button", { name: "Start camera" })
      .click({ timeout: 15_000 })
    await expect(page.getByTestId("rephoto-error")).toHaveText(
      "Camera stuck. Close the browser fully and reopen.",
      { timeout: 15_000 }
    )
  })

  test("a camera that never answers is asked again more plainly", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const real = navigator.mediaDevices.getUserMedia.bind(
        navigator.mediaDevices
      )
      let calls = 0
      navigator.permissions.query = async () =>
        ({ state: "granted" }) as PermissionStatus
      navigator.mediaDevices.getUserMedia = (constraints) =>
        ++calls === 1 ? new Promise(() => {}) : real(constraints)
    })
    await page.goto("/mission-house/camera")
    await expect(page.getByTestId("rephoto-shutter")).toBeEnabled({
      timeout: 15_000,
    })
  })

  test("a picture that stops without a word gets the camera opened again", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const real = navigator.mediaDevices.getUserMedia.bind(
        navigator.mediaDevices
      )
      const w = window as unknown as { __opens: number; __frozen: boolean }
      w.__opens = 0
      navigator.mediaDevices.getUserMedia = (constraints) => {
        w.__opens++
        return real(constraints)
      }
      // Frames stop arriving while the track still says it is live.
      const frame = HTMLVideoElement.prototype.requestVideoFrameCallback
      HTMLVideoElement.prototype.requestVideoFrameCallback = function (
        callback
      ) {
        return frame.call(this, (...args) => {
          if (!w.__frozen) callback(...args)
        })
      }
    })
    await page.goto("/mission-house/camera")
    await expect(page.getByTestId("rephoto-shutter")).toBeEnabled()
    await page.evaluate(() => {
      ;(window as unknown as { __frozen: boolean }).__frozen = true
    })
    await expect
      .poll(
        () =>
          page.evaluate(
            () => (window as unknown as { __opens: number }).__opens
          ),
        {
          timeout: 10_000,
        }
      )
      .toBe(2)
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

// A phone whose browser lets a tap go full screen and turn the screen; records what was asked.
async function phoneScreen(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __calls: string[] }
    w.__calls = []
    const real = window.matchMedia.bind(window)
    window.matchMedia = (query: string) =>
      query === "(pointer: coarse)"
        ? ({ matches: true } as MediaQueryList)
        : real(query)
    Object.defineProperty(document, "fullscreenEnabled", { get: () => true })
    let full: Element | null = null
    Object.defineProperty(document, "fullscreenElement", {
      get: () => full,
    })
    Element.prototype.requestFullscreen = async function () {
      full = this
      w.__calls.push("fullscreen")
    }
    document.exitFullscreen = async () => {
      full = null
      w.__calls.push("exit")
    }
    const orientation = screen.orientation as ScreenOrientation & {
      lock: (o: string) => Promise<void>
    }
    orientation.lock = async (o: string) => {
      w.__calls.push(`lock ${o}`)
    }
    orientation.unlock = () => {
      w.__calls.push("unlock")
    }
  })
  return () =>
    page.evaluate(() => (window as unknown as { __calls: string[] }).__calls)
}
