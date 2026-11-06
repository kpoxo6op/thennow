import { expect, test, type CDPSession, type Page } from "@playwright/test"

const STORY = "/mill-house"
const PHONE_WIDTHS = [390, 320]

async function readGeometry(page: Page) {
  return page.evaluate(() => {
    const overlay = document.querySelector<HTMLElement>('[data-testid="compare-overlay"]')!
    const knob = document.querySelector<HTMLElement>('[data-testid="compare-slider-knob"]')!
    const input = document.querySelector<HTMLInputElement>('[data-testid="compare-slider-input"]')!
    const image = document.querySelector<HTMLElement>('[data-testid="compare-overlay-image"]')!
    const stage = document.querySelector<HTMLElement>('[data-testid="compare-stage"]')!
    // Browsers shorten an all-zero clip to inset(0px).
    const insets = ((overlay.getAttribute("style") ?? "").match(/inset\(([^)]*)\)/)?.[1] ?? "").split(/\s+/)
    const rightInset = parseFloat(insets[1] ?? insets[0])
    const stageBox = stage.getBoundingClientRect()
    const imageBox = image.getBoundingClientRect()
    const knobBox = knob.getBoundingClientRect()
    const inputBox = input.getBoundingClientRect()

    return {
      value: Number(input.value),
      divider: stageBox.right - rightInset,
      knobCenter: knobBox.left + knobBox.width / 2,
      imageLeft: imageBox.left,
      imageRight: imageBox.right,
      inputLeft: inputBox.left,
      inputRight: window.innerWidth - inputBox.right,
    }
  })
}

async function expectAlignedAt(page: Page, position: number) {
  await expect(page.getByTestId("compare-slider-input")).toHaveValue(String(position))
  await expect
    .poll(async () => {
      const geometry = await readGeometry(page)
      return Math.abs(geometry.divider - geometry.knobCenter)
    })
    .toBeLessThanOrEqual(1)

  const geometry = await readGeometry(page)
  const expected = geometry.imageLeft + (position / 100) * (geometry.imageRight - geometry.imageLeft)
  expect(Math.abs(geometry.divider - expected)).toBeLessThanOrEqual(1)
  expect(geometry.inputLeft).toBeGreaterThanOrEqual(39)
  expect(geometry.inputRight).toBeGreaterThanOrEqual(39)

  return geometry
}

async function imagesLoaded(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() =>
        ['compare-base-image', 'compare-overlay-image'].every((id) => {
          const image = document.querySelector<HTMLImageElement>(`[data-testid="${id}"]`)
          return Boolean(image?.complete && image.naturalWidth > 0)
        })
      )
    )
    .toBe(true)
}

for (const width of PHONE_WIDTHS) {
  test.describe(`at ${width}px`, () => {
    test.use({ viewport: { width, height: 844 } })

    for (const position of [0, 2, 30, 98, 100]) {
      test(`the divider and grip agree at ${position}`, async ({ page }) => {
        await page.goto(`${STORY}?p=${position}`)
        const geometry = await expectAlignedAt(page, position)

        if (position === 0) {
          expect(geometry.divider).toBeLessThanOrEqual(geometry.imageLeft + 1)
        }

        if (position === 100) {
          expect(geometry.divider).toBeGreaterThanOrEqual(geometry.imageRight - 1)
        }
      })
    }

    test("0 and 100 change the pixels all the way to both edges", async ({ page }) => {
      const strip = async (position: number, side: "left" | "right") => {
        await page.goto(`${STORY}?p=${position}`)
        await imagesLoaded(page)
        const box = (await page.getByTestId("compare-stage").boundingBox())!
        return page.screenshot({
          clip: { x: side === "left" ? 2 : width - 26, y: box.y + 10, width: 24, height: 40 },
        })
      }

      expect((await strip(0, "left")).equals(await strip(100, "left"))).toBe(false)
      expect((await strip(0, "right")).equals(await strip(100, "right"))).toBe(false)
    })

    test("the keyboard reaches both ends and a reload keeps them", async ({ page }) => {
      await page.goto(STORY)
      const input = page.getByTestId("compare-slider-input")
      const historyLength = await page.evaluate(() => window.history.length)
      await input.focus()

      await page.keyboard.press("End")
      await expectAlignedAt(page, 100)
      await expect(page).toHaveURL(/\?p=100$/)
      await page.reload()
      await expectAlignedAt(page, 100)

      await input.focus()
      await page.keyboard.press("Home")
      await expectAlignedAt(page, 0)
      await expect(page).toHaveURL(/\?p=0$/)
      await page.keyboard.press("ArrowLeft")
      await expectAlignedAt(page, 0)
      await page.keyboard.press("ArrowRight")
      await expectAlignedAt(page, 1)
      await page.reload()
      await expectAlignedAt(page, 1)

      await page.goto(`${STORY}?p=49`)
      await input.focus()
      await page.keyboard.press("ArrowRight")
      await expect(input).toHaveValue("50")
      await expect(page).toHaveURL(new RegExp(`${STORY}$`))
      expect(await page.evaluate(() => window.history.length)).toBeGreaterThanOrEqual(historyLength)
    })
  })

  test.describe(`touch at ${width}px`, () => {
    test.use({ hasTouch: true, viewport: { width, height: 844 } })

    async function swipe(cdp: CDPSession, x0: number, y0: number, x1: number, y1: number) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y: y0 }] })
      for (let i = 1; i <= 10; i += 1) {
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: x0 + ((x1 - x0) * i) / 10, y: y0 + ((y1 - y0) * i) / 10 }],
        })
      }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
    }

    test("a drag from the safe area reaches both ends, and vertical swipes still scroll", async ({ page, context }) => {
      await page.goto(STORY)
      await imagesLoaded(page)
      const cdp = await context.newCDPSession(page)
      const box = (await page.getByTestId("compare-stage").boundingBox())!
      const y = box.y + box.height * 0.4

      await swipe(cdp, width / 2, y, width - 2, y)
      await expectAlignedAt(page, 100)
      await expect(page).toHaveURL(/\?p=100$/)

      await swipe(cdp, width / 2, y, 2, y)
      await expectAlignedAt(page, 0)
      await expect(page).toHaveURL(/\?p=0$/)

      await swipe(cdp, 60, y, width - 60, y)
      const interior = Number(await page.getByTestId("compare-slider-input").inputValue())
      expect(interior).toBeGreaterThan(80)
      expect(interior).toBeLessThan(100)

      await swipe(cdp, width / 2, y + 40, width / 2, y - 120)
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(20)
      await expect(page.getByTestId("compare-slider-input")).toHaveValue(String(interior))
    })

    test("a touch starting in the side margins leaves the line alone", async ({ page, context }) => {
      await page.goto(`${STORY}?p=30`)
      await expect(page.getByTestId("compare-slider-input")).toHaveValue("30")
      await imagesLoaded(page)
      const cdp = await context.newCDPSession(page)
      const box = (await page.getByTestId("compare-stage").boundingBox())!
      const y = box.y + box.height * 0.4

      await swipe(cdp, 10, y, width / 2, y)
      await swipe(cdp, width - 10, y, width / 2, y)
      await expect(page.getByTestId("compare-slider-input")).toHaveValue("30")
    })
  })
}

test.describe("on a wide screen with space beside the photograph", () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  for (const position of [0, 100]) {
    test(`the line stops at the photograph's edge at ${position}`, async ({ page }) => {
      await page.goto(`${STORY}?p=${position}`)
      const geometry = await expectAlignedAt(page, position)
      expect(geometry.imageLeft).toBeGreaterThan(40)
      expect(Math.abs(geometry.inputLeft - geometry.imageLeft)).toBeLessThanOrEqual(1)
    })
  }
})

test.describe("the homepage comparison at 390px", () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test("reaches both edges of the photograph", async ({ page }) => {
    await page.goto("/")
    await page.getByTestId("compare-slider-input").focus()
    await page.keyboard.press("End")
    await expectAlignedAt(page, 100)
    await page.keyboard.press("Home")
    await expectAlignedAt(page, 0)
  })
})
