import { mkdirSync, readFileSync } from "fs"
import path from "path"
import { expect, test, type Page } from "@playwright/test"

const ort = readFileSync("tests/fixtures/fake-ort.mjs", "utf8")
test.use({
  viewport: { width: 390, height: 844 },
  launchOptions: {
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-video-capture=${path.resolve("tests/fixtures/fake-camera.y4m")}`,
    ],
  },
  permissions: ["camera"],
  hasTouch: true,
})

async function gpu(page: Page, capability: "yes" | "none" | "no-f16" = "yes") {
  await page.addInitScript((capability) => {
    Object.defineProperty(Navigator.prototype, "gpu", {
      configurable: true,
      get: () =>
        capability === "none"
          ? undefined
          : {
              requestAdapter: async () => ({
                features: new Set(capability === "yes" ? ["shader-f16"] : []),
              }),
            },
    })
  }, capability)
}
async function screenshot(page: Page, name: string) {
  if (!process.env.MATCHER_SCREENSHOTS) return
  mkdirSync(process.env.MATCHER_SCREENSHOTS, { recursive: true })
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  )
  await page.screenshot({
    animations: "disabled",
    path: path.join(process.env.MATCHER_SCREENSHOTS, `${name}.png`),
  })
}
async function runtime(page: Page, body = ort) {
  await page.route("https://cdn.jsdelivr.net/**/ort.webgpu.min.mjs", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body,
      headers: { "access-control-allow-origin": "*" },
    })
  )
}

for (const [orientation, viewport] of Object.entries({
  portrait: { width: 390, height: 844 },
})) {
  test(`${orientation}: loading, rejected jumps, loss and manual review form one camera journey`, async ({
    page,
  }) => {
    test.setTimeout(120_000)
    // The same field-failure journey owns diagnostic causality and delivery: preserve
    // retry identity, exclude private fields, and correlate each manual shot with review.
    type Event = {
      event: string
      outcome?: string
      reason?: string
      state?: string
      blockers?: number
      capture: number
      run: number
    }
    const batches: { session: string; seq: number; events: Event[] }[] = []
    const attempts: string[] = []
    await page.route("**/api/camera-log", async (route) => {
      const body = route.request().postData()!
      attempts.push(body)
      if (attempts.length === 1) {
        await route.fulfill({ status: 503 })
        return
      }
      const batch = JSON.parse(body)
      expect(Buffer.byteLength(body)).toBeLessThanOrEqual(12 * 1024)
      expect(batch.events.length).toBeLessThanOrEqual(16)
      expect(body).not.toMatch(
        /mission-house|pathname|user-agent|country|data:image|message|latitude|longitude/
      )
      if (
        !batches.some(
          (item) => item.session === batch.session && item.seq === batch.seq
        )
      )
        batches.push(batch)
      await route.fulfill({ status: 204 })
    })
    const events = () => batches.flatMap((batch) => batch.events)

    await page.setViewportSize(viewport)
    await gpu(page)
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    await page.route("**/models/*.onnx", async (route) => {
      await gate
      await route.continue()
    })
    await runtime(
      page,
      ort.replace(
        "async function run({ image0, image1 }) {",
        `async function run({ image0, image1 }) {
      while (!window.__runGuide) await new Promise(r => setTimeout(r, 50));
      if (document.querySelector('[data-testid="rephoto-review"]')) {
        if (window.__reviewFailure === "runtime") throw new Error("Matcher unavailable");
        if (window.__reviewFailure === "unmatched") return {
          match: { data: new BigInt64Array(2640) },
          confidence: { data: new Float32Array(2640) },
          mutual: { data: new Float32Array(2640) },
        };
      }`
      )
    )
    await page.addInitScript(() => {
      Object.assign(window, { __matcherDown: true })
    })
    await page.goto("/mission-house/camera")
    const guide = page.getByTestId("matcher-guide")
    await expect(guide).toHaveAttribute("data-state", "loading")
    await expect(page.getByTestId("rephoto-shutter")).toBeEnabled()
    await expect(
      page.getByTestId("rephoto-camera").getByRole("button")
    ).toHaveCount(1)
    const pill = await guide.locator("div").boundingBox()
    const close = await page
      .getByRole("link", { name: "Close camera" })
      .boundingBox()
    expect(pill!.height).toBeLessThanOrEqual(close!.height)
    expect(pill!.x).toBeGreaterThanOrEqual(close!.x + close!.width)
    await screenshot(page, `${orientation}-loading`)
    release()
    await expect(guide).toHaveAttribute("data-state", "starting")
    await screenshot(page, `${orientation}-starting`)
    await page.evaluate(() => Object.assign(window, { __runGuide: true }))
    await expect(guide).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: "Guide", exact: true })
    ).toHaveCount(0)
    await expect(page.getByTestId("capture-guide")).toContainText(
      "Point at the view in the old photo"
    )
    await screenshot(page, `${orientation}-searching`)
    // The live split remains usable without holding a finger on the view.
    const stage = page.getByTestId("rephoto-stage")
    await page.evaluate(() => Object.assign(window, { __matcherDown: false }))
    await expect(page.getByTestId("rephoto-stage")).toHaveAttribute(
      "data-lock",
      "steady",
      { timeout: 30_000 }
    )
    await expect(guide).toHaveCount(0)
    await screenshot(page, `${orientation}-lined-up`)
    // A single wildly shifted model answer must not move an accepted guide.
    // This reproduces the field jump at the model/browser boundary, not source text.
    const frame = page.getByTestId("rephoto-frame")
    const before = await frame.boundingBox()
    const divider = page.getByRole("slider", {
      name: "Compare old photo with live camera",
    })
    const handle = await divider.boundingBox()
    await page.mouse.move(
      handle!.x + handle!.width / 2,
      handle!.y + handle!.height / 2
    )
    await page.mouse.down()
    await page.mouse.move(
      handle!.x + handle!.width / 2 + 70,
      handle!.y + handle!.height / 2,
      { steps: 8 }
    )
    await page.mouse.up()
    expect(Number(await divider.getAttribute("aria-valuenow"))).toBeGreaterThan(
      60
    )
    await expect(page.getByTestId("rephoto-ghost")).toHaveCSS("opacity", "1")
    expect(await frame.boundingBox()).toEqual(before)
    await divider.press("Home")
    await expect(divider).toHaveAttribute("aria-valuenow", "0")
    await divider.tap()
    await expect(divider).toHaveAttribute("aria-valuenow", "0")
    await divider.press("End")
    await expect(divider).toHaveAttribute("aria-valuenow", "100")
    await divider.tap()
    await expect(divider).toHaveAttribute("aria-valuenow", "100")
    for (let i = 0; i < 10; i++) await divider.press("ArrowLeft")
    await expect(divider).toHaveAttribute("aria-valuenow", "50")
    await page.evaluate(() => Object.assign(window, { __matchShift: 0.15 }))
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as unknown as { __shiftedRuns: number }).__shiftedRuns ?? 0
        )
      )
      .toBeGreaterThan(0)
    await page.evaluate(() => Object.assign(window, { __matchShift: 0 }))
    const after = await frame.boundingBox()
    expect(Math.abs(after!.x - before!.x)).toBeLessThan(8)
    expect(Math.abs(after!.width - before!.width)).toBeLessThan(8)
    // Loss of alignment must not leave a misleading shoot cue.
    await page.evaluate(() => Object.assign(window, { __matcherDown: true }))
    await expect(page.getByTestId("rephoto-stage")).toHaveAttribute(
      "data-lock",
      "none",
      { timeout: 15_000 }
    )
    await expect(guide).toHaveCount(0)
    await expect(page.getByTestId("capture-guide")).toContainText(
      "Point at the view in the old photo"
    )
    await expect(page.getByTestId("rephoto-shutter")).toBeEnabled()
    let uploads = 0
    let captures = 0
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/submit") uploads++
      if (
        request.url().endsWith("/api/camera-log") &&
        request
          .postDataJSON()
          ?.events?.some((event: { event: string }) => event.event === "shot")
      )
        captures++
    })
    // A resting reference returns after the lost placement fades out.
    await expect(page.getByTestId("rephoto-ghost")).not.toHaveCSS(
      "opacity",
      "0"
    )
    await page.evaluate(() => Object.assign(window, { __matcherDown: false }))
    const captureGuide = page.getByTestId("capture-guide")
    await expect(stage).toHaveAttribute("data-lock", "steady", {
      timeout: 30_000,
    })
    await expect(captureGuide).toContainText("Scene found · Slide to compare")
    // A stable coarse fit must never fire the shutter. The former 1.2-second
    // countdown is a credible regression only this live-lock journey exercises.
    await page.waitForTimeout(1800)
    await expect(page.getByTestId("rephoto-review")).toHaveCount(0)
    expect(captures).toBe(0)
    await page
      .getByTestId("rephoto-video")
      .evaluate((video: HTMLVideoElement) => video.pause())
    await page.waitForTimeout(1600)
    await expect(page.getByTestId("rephoto-review")).toHaveCount(0)
    expect(captures).toBe(0)
    await page
      .getByTestId("rephoto-video")
      .evaluate((video: HTMLVideoElement) => video.play())
    await expect(stage).toHaveAttribute("data-lock", "steady", {
      timeout: 30_000,
    })
    await screenshot(page, "portrait-manual-capture")
    // Final rejection overrides held placement; server-only journeys cannot
    // expose the former locked-shot fallback.
    await page.evaluate(() =>
      Object.assign(window, { __reviewFailure: "unmatched" })
    )
    await page.getByTestId("rephoto-shutter").click()
    await expect(page.getByTestId("rephoto-review")).toHaveAttribute(
      "data-phase",
      "unmatched",
      { timeout: 30_000 }
    )
    await expect(page.getByTestId("rephoto-send")).toHaveCount(0)
    await page.getByRole("button", { name: "Retake", exact: true }).click()
    await expect(stage).toHaveAttribute("data-lock", "steady", {
      timeout: 30_000,
    })
    // Runtime failure after a live lock is unknown, not a successful fit.
    await page.evaluate(() =>
      Object.assign(window, { __reviewFailure: "runtime" })
    )
    await page.setViewportSize({ width: 844, height: 390 })
    await expect(stage).toHaveAttribute("data-lock", "steady", {
      timeout: 30_000,
    })
    await screenshot(page, "landscape-manual-capture")
    await page.route("**/api/align", (route) => route.abort())
    await page.getByTestId("rephoto-shutter").click()
    await expect(page.getByTestId("rephoto-review")).toHaveAttribute(
      "data-phase",
      "unchecked",
      { timeout: 30_000 }
    )
    await expect(page.getByTestId("rephoto-send")).toBeEnabled()
    expect(uploads).toBe(0)
    expect(captures).toBe(2)
    await expect
      .poll(() => events().filter((event) => event.event === "review").length)
      .toBe(2)
    expect(attempts[1]).toBe(attempts[0])
    expect(new Set(batches.map((batch) => batch.session)).size).toBe(1)
    expect(events()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: "match result",
          outcome: "rejected",
          reason: "disagreement",
        }),
        expect.objectContaining({
          event: "match result",
          outcome: "miss",
          reason: "insufficient_matches",
        }),
        expect.objectContaining({ event: "guide", state: "lost" }),
        expect.objectContaining({
          event: "review",
          result: "unmatched",
          capture: 1,
        }),
        expect.objectContaining({
          event: "review",
          result: "unchecked",
          capture: 2,
        }),
      ])
    )
    const shots = events().filter((event) => event.event === "shot")
    expect(shots.map((event) => event.capture)).toEqual([1, 2])
    for (const shot of shots)
      expect(events()).toContainEqual(
        expect.objectContaining({
          event: "review",
          capture: shot.capture,
          run: shot.run,
        })
      )
    expect(events().some((event) => event.event === "auto")).toBe(false)
    await page.getByRole("button", { name: "Retake", exact: true }).click()
    await expect(page.getByTestId("rephoto-shutter")).toBeEnabled()
    await expect(page.getByTestId("rephoto-review")).toHaveCount(0)
    await page.getByRole("link", { name: "Close camera" }).click()
    await expect
      .poll(() => events().some((event) => event.event === "session end"))
      .toBe(true)
    expect(
      events().some(
        (event) =>
          event.event === "live" &&
          event.run > shots[1].run &&
          event.capture === 0
      )
    ).toBe(true)
    expect(batches.length).toBeLessThan(events().length)
    // Curated traces are fixed aiming targets. Matcher output must not silently
    // replace the exact crop that the photographer composed against them.
    for (const slug of [
      "bradley-lane-line-road",
      "tamaki-road-board-offices",
    ]) {
      await page.setViewportSize({ width: 844, height: 390 })
      await page.goto(`/${slug}/camera`)
      await expect(page.getByTestId("reference-trace")).toBeVisible()
      await expect(page.getByTestId("rephoto-shutter")).toBeEnabled()
      await expect(page.getByTestId("rephoto-ghost")).toHaveCSS(
        "opacity",
        "0.16"
      )
      const target = await page.getByTestId("rephoto-frame").boundingBox()
      await page.waitForTimeout(500)
      expect(await page.getByTestId("rephoto-frame").boundingBox()).toEqual(
        target
      )
      await screenshot(page, `${slug}-trace-live`)
      if (process.env.MATCHER_SCREENSHOTS) {
        // Diagnostic screenshot only: inspect editorial traces against their source.
        await page
          .getByTestId("rephoto-ghost")
          .evaluate((img) => (img.style.opacity = "1"))
        await screenshot(page, `${slug}-trace-source`)
        await page.setViewportSize({ width: 2200, height: 1500 })
        await screenshot(page, `${slug}-trace-source-detail`)
        await page.setViewportSize({ width: 844, height: 390 })
        await page
          .getByTestId("rephoto-ghost")
          .evaluate((img) => (img.style.opacity = "0.16"))
      }
      await page.getByRole("button", { name: "Old photo", exact: true }).click()
      await expect(page.getByTestId("reference-trace")).toBeVisible()
      await expect(page.getByTestId("rephoto-shutter")).toBeDisabled()
      await expect(page.getByTestId("rephoto-ghost")).toHaveCSS("opacity", "1")
      await page
        .getByRole("button", { name: "Live camera", exact: true })
        .click()
      await expect(page.getByTestId("reference-trace")).toBeVisible()
      const stageBox = await page.getByTestId("rephoto-stage").boundingBox()
      const size = await page
        .getByTestId("rephoto-video")
        .evaluate((v: HTMLVideoElement) => ({
          width: v.videoWidth,
          height: v.videoHeight,
        }))
      const scale = Math.min(
        stageBox!.width / size.width,
        stageBox!.height / size.height
      )
      const expectedWidth = target!.width / scale
      await page.getByTestId("rephoto-shutter").click()
      await expect(page.getByTestId("rephoto-review")).toHaveAttribute(
        "data-phase",
        "unchecked"
      )
      await expect(page.getByTestId("reference-trace")).toBeVisible()
      const crop = JSON.parse(
        (await page.getByTestId("rephoto-review").getAttribute("data-crop"))!
      )
      expect(crop.width).toBeCloseTo(expectedWidth, 0)
      expect(crop.cx).toBeCloseTo(size.width / 2, 0)
      expect(crop.cy).toBeCloseTo(size.height / 2, 0)
      expect(crop.rotation).toBe(0)
      await screenshot(page, `${slug}-trace-review`)
      await page.getByRole("button", { name: "Retake", exact: true }).click()
      await page.setViewportSize({ width: 390, height: 844 })
      await expect(page.getByTestId("reference-trace")).toBeVisible()
      await screenshot(page, `${slug}-trace-portrait`)
    }
  })
}

for (const capability of ["none", "no-f16"] as const) {
  test(`${capability}: unavailable notice is brief and capture remains usable`, async ({
    page,
  }) => {
    await gpu(page, capability)
    await page.goto("/mission-house/camera")
    const guide = page.getByTestId("matcher-guide")
    await expect(guide).toHaveAttribute("data-state", "unsupported")
    await expect(guide).toContainText("Live guide unavailable")
    await expect(page.getByTestId("rephoto-shutter")).toBeEnabled()
    await screenshot(page, `portrait-unsupported-${capability}`)
    await page.setViewportSize({ width: 844, height: 390 })
    await screenshot(page, `landscape-unsupported-${capability}`)
    await expect(guide).toHaveCount(0, { timeout: 7000 })
    await expect(page.getByTestId("rephoto-shutter")).toBeEnabled()
    // An interrupted camera must not revive an already-dismissed notice.
    await page
      .getByTestId("rephoto-video")
      .evaluate((video: HTMLVideoElement) => {
        ;(video.srcObject as MediaStream)
          .getVideoTracks()[0]
          .dispatchEvent(new Event("mute"))
      })
    await expect(page.getByTestId("rephoto-shutter")).toBeDisabled()
    await page
      .getByTestId("rephoto-video")
      .evaluate((video: HTMLVideoElement) => {
        ;(video.srcObject as MediaStream)
          .getVideoTracks()[0]
          .dispatchEvent(new Event("unmute"))
      })
    await expect(page.getByTestId("rephoto-shutter")).toBeEnabled()
    await expect(guide).toHaveCount(0)
  })
}

test("a photo can be taken while the guide downloads", async ({ page }) => {
  await gpu(page)
  await runtime(page)
  await page.route("**/models/*.onnx", () => {})
  await page.route("**/api/align", (route) => route.abort())
  await page.goto("/mission-house/camera")
  await expect(page.getByTestId("matcher-guide")).toHaveAttribute(
    "data-state",
    "loading"
  )
  await page.getByTestId("rephoto-shutter").click()
  await expect(page.getByTestId("rephoto-review")).toBeVisible()
})

// The existing camera tests own matching/capture geometry, not loading feedback. A streamed
// response owns the observable byte count and a stalled download must leave loading eventually.
test("downloaded bytes are measured and a stalled startup falls back", async ({
  page,
}) => {
  await gpu(page)
  await runtime(page)
  await page.addInitScript(() => {
    const fetchReal = window.fetch
    window.fetch = async (...args) => {
      if (String(args[0]).includes("/models/")) {
        return new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array(500_000))
              args[1]?.signal?.addEventListener("abort", () => {
                Object.assign(window, { __downloadAborted: true })
                controller.error(new DOMException("Aborted", "AbortError"))
              })
            },
          })
        )
      }
      return fetchReal(...args)
    }
  })
  await page.clock.install()
  await page.goto("/mission-house/camera")
  await expect(page.getByTestId("matcher-progress")).toHaveText("0.5 MB")
  await expect(page.getByTestId("rephoto-shutter")).toBeEnabled()
  await expect(page.getByTestId("matcher-progress")).toBeHidden()
  await page.setViewportSize({ width: 844, height: 390 })
  await expect(page.getByTestId("matcher-progress")).toBeVisible()
  await screenshot(page, "landscape-progress")
  await page.clock.fastForward(90_001)
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { __downloadAborted: boolean })
            .__downloadAborted
      )
    )
    .toBe(true)
  await expect(page.getByTestId("matcher-guide")).toHaveAttribute(
    "data-state",
    "failed"
  )
  await expect(page.getByTestId("matcher-guide")).toContainText(
    "Live guide unavailable"
  )
})

// A session created after its startup deadline must be released, never advertise readiness.
// The normal recovery test cannot catch this: its rejected creation has no late result.
test("a late session cannot overwrite failure or a newer guide session", async ({
  page,
}) => {
  await gpu(page)
  await runtime(
    page,
    ort.replace(
      "create: async () => ({ run })",
      `create: async () => {
    if (!window.__createdGuide) {
      window.__createdGuide = true;
      await new Promise(resolve => window.__releaseOldGuide = resolve);
    }
    return { run, release: async () => { window.__releasedGuide = true } };
  }`
    )
  )
  await page.addInitScript(() => Object.assign(window, { __matcherDown: true }))
  await page.clock.install()
  await page.goto("/mission-house/camera")
  const guide = page.getByTestId("matcher-guide")
  await expect(guide).toHaveAttribute("data-state", "starting")
  await expect(page.getByTestId("rephoto-shutter")).toBeEnabled()
  await page.clock.fastForward(90_001)
  await expect(guide).toHaveAttribute("data-state", "failed")
  await page.evaluate(() =>
    (window as unknown as { __releaseOldGuide: () => void }).__releaseOldGuide()
  )
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { __releasedGuide: boolean }).__releasedGuide
      )
    )
    .toBe(true)
  await expect(guide).toHaveAttribute("data-state", "failed")
  await expect(page.getByTestId("rephoto-shutter")).toBeEnabled()
  await page.clock.fastForward(15_001)
  await expect
    .poll(
      () =>
        page.evaluate(
          () => (window as unknown as { __localRuns: number }).__localRuns ?? 0
        ),
      { timeout: 10_000 }
    )
    .toBeGreaterThan(0)
  await expect(guide).toHaveCount(0)
})

// Only a delayed run exposes the shader-warmup wait and its deadline; creation tests do not.
test("a hung first inference leaves starting and recovers without disabling capture", async ({
  page,
}) => {
  await gpu(page)
  await runtime(
    page,
    ort.replace(
      "async function run({ image0, image1 }) {",
      `async function run({ image0, image1 }) {
    if (!window.__ranGuide) {
      window.__ranGuide = true;
      await new Promise(resolve => window.__finishOldRun = resolve);
    }`
    )
  )
  await page.addInitScript(() => Object.assign(window, { __matcherDown: true }))
  await page.clock.install()
  await page.goto("/mission-house/camera")
  const guide = page.getByTestId("matcher-guide")
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { __ranGuide: boolean }).__ranGuide
      )
    )
    .toBe(true)
  await expect(guide).toHaveAttribute("data-state", "starting")
  await expect(page.getByTestId("rephoto-shutter")).toBeEnabled()
  await page.clock.fastForward(60_001)
  await expect(guide).toHaveAttribute("data-state", "failed")
  await page.evaluate(() =>
    (window as unknown as { __finishOldRun: () => void }).__finishOldRun()
  )
  await expect(guide).toHaveAttribute("data-state", "failed")
  await expect(page.getByTestId("rephoto-shutter")).toBeEnabled()
  await page.clock.fastForward(15_001)
  await expect
    .poll(
      () =>
        page.evaluate(
          () => (window as unknown as { __localRuns: number }).__localRuns ?? 0
        ),
      { timeout: 10_000 }
    )
    .toBeGreaterThan(0)
  await expect(guide).toHaveCount(0)
})
