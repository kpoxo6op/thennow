import { readFileSync } from "fs"
import path from "path"
import { expect, test, type Page } from "@playwright/test"

// The camera's own zoom, on a phone whose browser lets a page zoom (Chrome on Android). Chromium's
// fake camera plays the Mission House from further back, so the old view fills only the middle.
test.use({
  launchOptions: {
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-video-capture=${path.join(
        process.cwd(),
        "tests",
        "fixtures",
        "fake-camera-far.y4m"
      )}`,
    ],
  },
  permissions: ["camera"],
})

const FAKE_ORT = readFileSync(
  path.join(process.cwd(), "tests", "fixtures", "fake-ort.mjs"),
  "utf8"
)

// WebGPU with half precision, and a runtime that answers like the real model does.
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

async function openCamera(page: Page, slug: string) {
  await page.goto(`/${slug}/camera`)
  await expect(page.getByTestId("rephoto-shutter")).toBeEnabled()
}

// A camera that can zoom; `refuse` makes it turn every zoom down.
async function zoomingCamera(page: Page, refuse = false) {
  await page.addInitScript((refuse) => {
    const w = window as unknown as { __zooms: number[] }
    w.__zooms = []
    let now = 1
    const capabilities = MediaStreamTrack.prototype.getCapabilities
    MediaStreamTrack.prototype.getCapabilities = function () {
      return { ...capabilities.call(this), zoom: { min: 1, max: 10 } }
    }
    const settings = MediaStreamTrack.prototype.getSettings
    MediaStreamTrack.prototype.getSettings = function () {
      return { ...settings.call(this), zoom: now } as MediaTrackSettings
    }
    const apply = MediaStreamTrack.prototype.applyConstraints
    MediaStreamTrack.prototype.applyConstraints = function (constraints) {
      const zoom = (constraints?.advanced?.[0] as { zoom?: number })?.zoom
      if (zoom != null) {
        w.__zooms.push(zoom)
        if (refuse) return Promise.reject(new Error("OverconstrainedError"))
        now = zoom
        return Promise.resolve()
      }
      return apply.call(this, constraints)
    }
  }, refuse)
  return () =>
    page.evaluate(() => (window as unknown as { __zooms: number[] }).__zooms)
}

test("a camera that can zoom is zoomed so the old view fills it, never past 2x", async ({
  page,
}) => {
  const zooms = await zoomingCamera(page)
  await onPhoneMatcher(page)
  await openCamera(page, "mission-house")
  // A whole glide of five steps, ending at a zoom in, at most 2x.
  await expect
    .poll(async () => (await zooms()).length, { timeout: 30_000 })
    .toBeGreaterThanOrEqual(5)
  const asked = await zooms()
  expect(Math.max(...asked)).toBeLessThanOrEqual(2)
  expect(asked[4]).toBeGreaterThan(1)
  await expect(page.getByTestId("rephoto-stage")).toHaveAttribute(
    "data-lock",
    /held|steady/,
    { timeout: 30_000 }
  )
})

test("a camera that turns the zoom down is left alone", async ({ page }) => {
  const zooms = await zoomingCamera(page, true)
  await onPhoneMatcher(page)
  await openCamera(page, "mission-house")
  await expect.poll(zooms, { timeout: 30_000 }).not.toEqual([])
  await expect(page.getByTestId("rephoto-stage")).toHaveAttribute(
    "data-lock",
    /held|steady/,
    { timeout: 30_000 }
  )
  expect(await zooms()).toHaveLength(1)
})
