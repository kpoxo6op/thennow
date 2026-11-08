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

async function shoot(page: Page) {
  await page.getByTestId("rephoto-shutter").click()
  await expect(page.getByTestId("rephoto-review")).toBeVisible()
  await expect(page.getByTestId("rephoto-review-frame")).toBeVisible()
}

test.describe("the rephotography camera", () => {
  // Test browsers have no graphics chip to match on, so matching goes to the site's server.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      // @ts-expect-error removing WebGPU for the test
      delete Navigator.prototype.gpu
    })
  })

  test("an upcoming place offers the camera", async ({ page }) => {
    await page.goto("/tamaki-road-board-offices")
    const link = page.getByTestId("pending-camera")
    await expect(link).toHaveAttribute(
      "href",
      "/tamaki-road-board-offices/camera"
    )
  })

  test("the live view lays the archive frame over the camera at the archive's shape", async ({
    page,
  }) => {
    const place = archive("mission-house")
    await openCamera(page, "mission-house")

    const ghost = page.getByTestId("rephoto-ghost")
    await expect(ghost).toHaveAttribute("src", place.b_imageUrl)
    const frame = await page.getByTestId("rephoto-frame").boundingBox()
    expect(frame).not.toBeNull()
    expect(frame!.height / frame!.width).toBeCloseTo(place.h / place.w, 2)

    // The frame sits inside the picture the camera actually takes.
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
    expect(frame!.x).toBeGreaterThanOrEqual(video.left - 0.5)
    expect(frame!.y).toBeGreaterThanOrEqual(video.top - 0.5)
    expect(frame!.x + frame!.width).toBeLessThanOrEqual(
      video.left + video.width + 0.5
    )
    expect(frame!.y + frame!.height).toBeLessThanOrEqual(
      video.top + video.height + 0.5
    )
  })

  test("tapping the view changes the guide from photograph to edges to nothing and back", async ({
    page,
  }) => {
    await openCamera(page, "mission-house")
    const stage = page.getByTestId("rephoto-stage")
    await expect(stage).toHaveAttribute("data-ghost", "photo")
    await stage.click({ position: { x: 200, y: 200 } })
    await expect(stage).toHaveAttribute("data-ghost", "edges")
    await expect(page.getByTestId("rephoto-ghost")).toHaveAttribute(
      "src",
      /^data:image\/png/
    )
    await stage.click({ position: { x: 200, y: 200 } })
    await expect(stage).toHaveAttribute("data-ghost", "off")
    await expect(page.getByTestId("rephoto-ghost")).toHaveCount(0)
    await stage.click({ position: { x: 200, y: 200 } })
    await expect(stage).toHaveAttribute("data-ghost", "photo")
  })

  test("a shot is lined up with the archive photograph by itself", async ({
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
    await expect(page.getByTestId("rephoto-note")).toContainText("Lining up")
    await expect(review).toHaveAttribute("data-phase", "aligned", {
      timeout: 30_000,
    })
    expect(
      Number(await review.getAttribute("data-inliers"))
    ).toBeGreaterThanOrEqual(15)

    // The fake camera's picture is the modern view turned 1.5 degrees; the fit turns the crop
    // with it and frames about the whole picture, at the archive's shape.
    const crop = await readCrop(page)
    const degrees = (crop.rotation * 180) / Math.PI
    expect(Math.abs(degrees)).toBeGreaterThan(0.5)
    expect(Math.abs(degrees)).toBeLessThan(4)
    expect(crop.width / photo.width).toBeGreaterThan(0.7)
    expect(crop.width / photo.width).toBeLessThan(1.3)
    expect(Math.abs(crop.cx - photo.width / 2)).toBeLessThan(photo.width * 0.15)
    const frame = await page.getByTestId("rephoto-review-frame").boundingBox()
    expect(frame!.height / frame!.width).toBeCloseTo(place.h / place.w, 2)
  })

  test("a shot that can't be matched keeps the levelled framing and says why", async ({
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
    await expect(page.getByTestId("rephoto-note")).toContainText(
      "Stand where it was taken"
    )
    const crop = await readCrop(page)
    expect(crop.rotation).toBe(0)
    expect(crop.cx).toBeCloseTo(photo.width / 2, 0)
    expect(crop.cy).toBeCloseTo(photo.height / 2, 0)
    await expect(page.getByTestId("rephoto-save")).toBeEnabled()
  })

  test("the matcher refuses anything but two pictures of the agreed size", async ({
    request,
  }) => {
    const response = await request.post("/api/align", {
      data: Buffer.alloc(10),
    })
    expect(response.status()).toBe(400)
  })

  test("a quick tap hides and shows the archive photograph over the shot", async ({
    page,
  }) => {
    await openCamera(page, "mission-house")
    await shoot(page)
    const ghost = page.getByTestId("rephoto-review-ghost")
    await expect(ghost).toHaveCSS("opacity", "0.5")
    await page.getByTestId("rephoto-review-frame").click()
    await expect(ghost).toHaveCSS("opacity", "0")
    await page.getByTestId("rephoto-review-frame").click()
    await expect(ghost).toHaveCSS("opacity", "0.5")
  })

  test("saving gives the aligned photograph at the archive's shape and the uncropped frame", async ({
    page,
  }) => {
    const place = archive("mission-house")
    await openCamera(page, "mission-house")
    await shoot(page)
    await expect(page.getByTestId("rephoto-review")).not.toHaveAttribute(
      "data-phase",
      "aligning",
      {
        timeout: 30_000,
      }
    )
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
    expect(downloads[1]).toMatch(
      /^mission-house-now-\d{4}-\d{2}-\d{2}-uncropped\.jpg$/
    )

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

  test("a phone leaning to one side is levelled when the shot is taken", async ({
    page,
  }) => {
    // Without a match, the levelled framing is what the shot keeps.
    await page.route("**/api/align", (route) =>
      route.fulfill({ json: { matches: [] } })
    )
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
    await expect(page.getByTestId("rephoto-level")).toHaveAttribute(
      "data-level",
      "false"
    )
    await tilt()
    await shoot(page)
    await expect(page.getByTestId("rephoto-review")).toHaveAttribute(
      "data-phase",
      "unmatched"
    )
    const crop = await readCrop(page)
    expect(crop.rotation).toBeCloseTo(-lean, 3)
  })

  test("a refused camera says how to fix it and offers to try again", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () =>
        Promise.reject(new DOMException("denied", "NotAllowedError"))
    })
    await page.goto("/mission-house/camera")
    await expect(page.getByTestId("rephoto-error")).toContainText(
      "Allow the camera"
    )
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible()
    await expect(page.getByTestId("rephoto-shutter")).toBeDisabled()
  })
})
