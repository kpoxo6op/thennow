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
  landscape: { width: 844, height: 390 },
})) {
  test(`${orientation}: guide reports real startup, searching and alignment without blocking framing`, async ({
    page,
  }) => {
    test.setTimeout(60_000)
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
      while (!window.__runGuide) await new Promise(r => setTimeout(r, 50));`
      )
    )
    await page.addInitScript(() => {
      Object.assign(window, { __matcherDown: true })
    })
    await page.goto("/mission-house/camera")
    const guide = page.getByTestId("matcher-guide")
    await expect(guide).toHaveAttribute("data-state", "loading")
    await expect(page.getByTestId("rephoto-shutter")).toBeEnabled()
    await screenshot(page, `${orientation}-loading`)
    await guide.getByRole("button", { name: "Guide", exact: true }).click()
    await expect(guide.getByText(/Move slowly/)).toBeVisible()
    await screenshot(page, `${orientation}-help`)
    release()
    await expect(guide).toHaveAttribute("data-state", "starting")
    await screenshot(page, `${orientation}-starting`)
    await page.evaluate(() => Object.assign(window, { __runGuide: true }))
    await expect(guide).toHaveAttribute("data-state", "ready")
    await expect(
      guide.getByRole("button", { name: "Guide", exact: true })
    ).toHaveAttribute("aria-expanded", "false")
    await expect(guide).toContainText("Looking for the scene")
    await expect(guide).not.toContainText("Loading live guide")
    await screenshot(page, `${orientation}-searching`)
    await page.evaluate(() => Object.assign(window, { __matcherDown: false }))
    await expect(page.getByTestId("rephoto-stage")).toHaveAttribute(
      "data-lock",
      "steady",
      { timeout: 30_000 }
    )
    await expect(guide).toContainText("Lined up")
    await screenshot(page, `${orientation}-lined-up`)
    // Loss of alignment must not leave a misleading shoot cue.
    await page.evaluate(() => Object.assign(window, { __matcherDown: true }))
    await expect(page.getByTestId("rephoto-stage")).toHaveAttribute(
      "data-lock",
      "none",
      { timeout: 15_000 }
    )
    await expect(guide).toContainText("Looking for the scene")
  })
}

for (const capability of ["none", "no-f16"] as const) {
  test(`${capability}: unsupported guide explains post-shot alignment and Chrome`, async ({
    page,
  }) => {
    await gpu(page, capability)
    await page.goto("/mission-house/camera")
    const guide = page.getByTestId("matcher-guide")
    await expect(guide).toHaveAttribute("data-state", "unsupported")
    await expect(guide).toContainText("line it up afterwards")
    await expect(page.getByTestId("rephoto-shutter")).toBeEnabled()
    await guide.getByRole("button", { name: "Guide", exact: true }).click()
    await expect(guide).toContainText("Chrome on a supported phone")
    await screenshot(page, `portrait-unsupported-${capability}`)
    await page.setViewportSize({ width: 844, height: 390 })
    await screenshot(page, `landscape-unsupported-${capability}`)
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

test("failed startup explains fallback, and a later retry restores live guidance", async ({
  page,
}) => {
  test.setTimeout(60_000)
  await gpu(page)
  await runtime(
    page,
    ort.replace(
      "create: async () => ({ run })",
      `create: async () => {
    if (!window.__allowGuide) throw new Error("Test device failure");
    return { run };
  }`
    )
  )
  await page.addInitScript(() => Object.assign(window, { __matcherDown: true }))
  await page.goto("/mission-house/camera")
  const guide = page.getByTestId("matcher-guide")
  await expect(guide).toHaveAttribute("data-state", "failed")
  await expect(page.getByTestId("rephoto-shutter")).toBeEnabled()
  await guide.getByRole("button", { name: "Guide", exact: true }).click()
  await expect(guide).toContainText("try again while you frame")
  await screenshot(page, "portrait-failed")
  await page.setViewportSize({ width: 844, height: 390 })
  await screenshot(page, "landscape-failed")
  await page.evaluate(() => Object.assign(window, { __allowGuide: true }))
  await expect(guide).toHaveAttribute("data-state", "ready", {
    timeout: 25_000,
  })
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
  await expect(page.getByTestId("matcher-progress")).toHaveText(
    "Model downloaded: 0.5 MB"
  )
  await expect(page.getByTestId("rephoto-shutter")).toBeEnabled()
  await screenshot(page, "portrait-progress")
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
    "line it up afterwards"
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
  await page.clock.fastForward(15_001)
  await expect(guide).toHaveAttribute("data-state", "ready", {
    timeout: 10_000,
  })
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
  await expect(guide).toHaveAttribute("data-state", "ready", {
    timeout: 10_000,
  })
})
