import { readdirSync, readFileSync } from "fs"
import path from "path"

import { expect, test, type Page } from "@playwright/test"

// Chromium's fake camera plays this still: a modern photograph of the Mission House, a little
// turned, so the camera has a real scene to show.
const FAKE_CAMERA = path.join(process.cwd(), "tests", "fixtures", "fake-camera.y4m")

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
    const json = JSON.parse(readFileSync(path.join(folder, name, `${name}.json`), "utf8"))
    if (json.slug === slug) return json as { w: number; h: number; b_imageUrl: string }
  }
  throw new Error(`No place ${slug}`)
}

type Crop = { cx: number; cy: number; width: number; rotation: number }

async function readCrop(page: Page): Promise<Crop> {
  return JSON.parse((await page.getByTestId("rephoto-review").getAttribute("data-crop")) ?? "{}")
}

async function openCamera(page: Page, slug: string) {
  await page.goto(`/${slug}/camera`)
  await expect(page.getByTestId("rephoto-shutter")).toBeEnabled()
  await expect
    .poll(() => page.getByTestId("rephoto-video").evaluate((video: HTMLVideoElement) => video.videoWidth))
    .toBeGreaterThan(0)
}

async function shoot(page: Page) {
  await page.getByTestId("rephoto-shutter").click()
  await expect(page.getByTestId("rephoto-review")).toBeVisible()
  await expect(page.getByTestId("rephoto-review-frame")).toBeVisible()
}

function insidePhoto(crop: Crop, aspect: number, photo: { width: number; height: number }) {
  const cos = Math.cos(crop.rotation)
  const sin = Math.sin(crop.rotation)
  const hw = crop.width / 2
  const hh = (crop.width * aspect) / 2
  return [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ].every(([x, y]) => {
    const px = crop.cx + cos * x - sin * y
    const py = crop.cy + sin * x + cos * y
    return px >= -1 && py >= -1 && px <= photo.width + 1 && py <= photo.height + 1
  })
}

test.describe("the rephotography camera", () => {
  test("an upcoming place offers the camera", async ({ page }) => {
    await page.goto("/tamaki-road-board-offices")
    const link = page.getByTestId("pending-camera")
    await expect(link).toHaveAttribute("href", "/tamaki-road-board-offices/camera")
  })

  test("the live view lays the archive frame over the camera at the archive's shape", async ({ page }) => {
    const place = archive("mission-house")
    await openCamera(page, "mission-house")

    const ghost = page.getByTestId("rephoto-ghost")
    await expect(ghost).toHaveAttribute("src", place.b_imageUrl)
    const frame = await page.getByTestId("rephoto-frame").boundingBox()
    expect(frame).not.toBeNull()
    expect(frame!.height / frame!.width).toBeCloseTo(place.h / place.w, 2)

    // The frame sits inside the picture the camera actually takes.
    const video = await page.getByTestId("rephoto-video").evaluate((element: HTMLVideoElement) => {
      const box = element.getBoundingClientRect()
      const scale = Math.min(box.width / element.videoWidth, box.height / element.videoHeight)
      const width = element.videoWidth * scale
      const height = element.videoHeight * scale
      return { left: box.left + (box.width - width) / 2, top: box.top + (box.height - height) / 2, width, height }
    })
    expect(frame!.x).toBeGreaterThanOrEqual(video.left - 0.5)
    expect(frame!.y).toBeGreaterThanOrEqual(video.top - 0.5)
    expect(frame!.x + frame!.width).toBeLessThanOrEqual(video.left + video.width + 0.5)
    expect(frame!.y + frame!.height).toBeLessThanOrEqual(video.top + video.height + 0.5)
  })

  test("tapping the view changes the guide from photograph to edges to nothing and back", async ({ page }) => {
    await openCamera(page, "mission-house")
    const stage = page.getByTestId("rephoto-stage")
    await expect(stage).toHaveAttribute("data-ghost", "photo")
    await stage.click({ position: { x: 200, y: 200 } })
    await expect(stage).toHaveAttribute("data-ghost", "edges")
    await expect(page.getByTestId("rephoto-ghost")).toHaveAttribute("src", /^data:image\/png/)
    await stage.click({ position: { x: 200, y: 200 } })
    await expect(stage).toHaveAttribute("data-ghost", "off")
    await expect(page.getByTestId("rephoto-ghost")).toHaveCount(0)
    await stage.click({ position: { x: 200, y: 200 } })
    await expect(stage).toHaveAttribute("data-ghost", "photo")
  })

  test("a shot opens on the framing that was lined up, at the archive's shape", async ({ page }) => {
    const place = archive("mission-house")
    await openCamera(page, "mission-house")
    const videoSize = await page
      .getByTestId("rephoto-video")
      .evaluate((video: HTMLVideoElement) => ({ width: video.videoWidth, height: video.videoHeight }))
    await shoot(page)

    const crop = await readCrop(page)
    expect(crop.rotation).toBe(0)
    expect(crop.cx).toBeCloseTo(videoSize.width / 2, 0)
    expect(crop.cy).toBeCloseTo(videoSize.height / 2, 0)
    expect(insidePhoto(crop, place.h / place.w, videoSize)).toBe(true)

    const frame = await page.getByTestId("rephoto-review-frame").boundingBox()
    expect(frame!.height / frame!.width).toBeCloseTo(place.h / place.w, 2)
  })

  test("dragging and zooming move the real shot under the archive frame, never past its edge", async ({ page }) => {
    const place = archive("mission-house")
    await openCamera(page, "mission-house")
    const photo = await page
      .getByTestId("rephoto-video")
      .evaluate((video: HTMLVideoElement) => ({ width: video.videoWidth, height: video.videoHeight }))
    await shoot(page)
    const frame = (await page.getByTestId("rephoto-review-frame").boundingBox())!
    const start = await readCrop(page)

    // Dragging the photograph right shows more of its left side.
    await page.mouse.move(frame.x + frame.width / 2, frame.y + frame.height / 2)
    await page.mouse.down()
    await page.mouse.move(frame.x + frame.width / 2 + 10, frame.y + frame.height / 2, { steps: 4 })
    await page.mouse.up()
    const dragged = await readCrop(page)
    expect(dragged.cx).toBeLessThan(start.cx)
    expect(dragged.width).toBeCloseTo(start.width, 3)

    // Zooming in narrows the crop.
    await page.mouse.move(frame.x + frame.width / 2, frame.y + frame.height / 2)
    await page.mouse.wheel(0, -300)
    await expect.poll(async () => (await readCrop(page)).width).toBeLessThan(dragged.width)

    // A long drag stops at the photograph's edge.
    await page.mouse.down()
    await page.mouse.move(frame.x + frame.width - 2, frame.y + frame.height / 2, { steps: 10 })
    await page.mouse.up()
    expect(insidePhoto(await readCrop(page), place.h / place.w, photo)).toBe(true)

    // Zooming far out is held to the photograph too.
    await page.mouse.move(frame.x + frame.width / 2, frame.y + frame.height / 2)
    for (let i = 0; i < 6; i++) await page.mouse.wheel(0, 600)
    await page.waitForTimeout(100)
    expect(insidePhoto(await readCrop(page), place.h / place.w, photo)).toBe(true)
  })

  test("a quick tap hides and shows the archive photograph over the shot", async ({ page }) => {
    await openCamera(page, "mission-house")
    await shoot(page)
    const ghost = page.getByTestId("rephoto-review-ghost")
    await expect(ghost).toHaveCSS("opacity", "0.5")
    await page.getByTestId("rephoto-review-frame").click()
    await expect(ghost).toHaveCSS("opacity", "0")
    await page.getByTestId("rephoto-review-frame").click()
    await expect(ghost).toHaveCSS("opacity", "0.5")
  })

  test("saving gives the aligned photograph at the archive's shape and the camera's original", async ({ page }) => {
    const place = archive("mission-house")
    await openCamera(page, "mission-house")
    await shoot(page)
    // Let the files be prepared before the tap, as a person would.
    await page.waitForTimeout(800)

    const downloads: string[] = []
    const sizes: { width: number; height: number }[] = []
    page.on("download", async (download) => {
      downloads.push(download.suggestedFilename())
    })
    await page.getByTestId("rephoto-save").click()
    await expect.poll(() => downloads.length).toBe(2)
    expect(downloads[0]).toMatch(/^mission-house-now-\d{4}-\d{2}-\d{2}\.jpg$/)
    expect(downloads[1]).toMatch(/^mission-house-now-\d{4}-\d{2}-\d{2}-original\.jpg$/)

    const text = (await page.getByTestId("rephoto-size").textContent()) ?? ""
    const [width, height] = text.split("×").map(Number)
    sizes.push({ width, height })
    expect(sizes[0].height / sizes[0].width).toBeCloseTo(place.h / place.w, 2)
  })

  test("retake returns to the live camera", async ({ page }) => {
    await openCamera(page, "mission-house")
    await shoot(page)
    await page.getByTestId("rephoto-retake").click()
    await expect(page.getByTestId("rephoto-camera")).toBeVisible()
    await expect(page.getByTestId("rephoto-shutter")).toBeEnabled()
  })

  test("a phone leaning to one side is levelled when the shot is taken", async ({ page }) => {
    await openCamera(page, "mission-house")
    // Gravity as a phone held upright with its top leaning about three degrees clockwise.
    const lean = Math.atan2(0.5, 9.8)
    const tilt = async () =>
      page.evaluate(() => {
        const event = new DeviceMotionEvent("devicemotion", {
          accelerationIncludingGravity: { x: -0.5, y: 9.8, z: 0.2 },
        })
        window.dispatchEvent(event)
      })
    await tilt()
    await expect(page.getByTestId("rephoto-level")).toBeVisible()
    await expect(page.getByTestId("rephoto-level")).toHaveAttribute("data-level", "false")
    await tilt()
    await shoot(page)
    const crop = await readCrop(page)
    expect(crop.rotation).toBeCloseTo(-lean, 3)
  })

  test("a refused camera says how to fix it and offers to try again", async ({ page }) => {
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("denied", "NotAllowedError"))
    })
    await page.goto("/mission-house/camera")
    await expect(page.getByTestId("rephoto-error")).toContainText("Allow the camera")
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible()
    await expect(page.getByTestId("rephoto-shutter")).toBeDisabled()
  })
})
