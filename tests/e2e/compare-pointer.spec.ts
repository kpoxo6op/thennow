import { expect, test, type CDPSession, type Page } from "@playwright/test"

const STORY = "/mill-house"

async function read(page: Page) {
  return page.evaluate(() => {
    const q = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!
    const knob = q("compare-slider-knob").getBoundingClientRect()
    const stage = q("compare-stage").getBoundingClientRect()
    const insets = ((q("compare-overlay").getAttribute("style") ?? "").match(/inset\(([^)]*)\)/)?.[1] ?? "").split(/\s+/)

    return {
      value: Number(q("compare-slider-input").getAttribute("value") ?? (q("compare-slider-input") as HTMLInputElement).value),
      divider: stage.right - parseFloat(insets[1] ?? insets[0]),
      grip: knob.left + knob.width / 2,
      gripY: knob.top + knob.height / 2,
      stageY: stage.top + stage.height * 0.2,
    }
  })
}

async function open(page: Page, position: number) {
  await page.goto(`${STORY}?p=${position}`)
  await expect(page.getByTestId("compare-slider-input")).toHaveValue(String(position))
  await expect.poll(async () => Math.abs((await read(page)).divider - (await read(page)).grip)).toBeLessThanOrEqual(1)
  return read(page)
}

async function expectUnderPointer(page: Page, x: number) {
  await expect.poll(async () => Math.abs((await read(page)).divider - x)).toBeLessThanOrEqual(1)
  const state = await read(page)
  expect(Math.abs(state.grip - x)).toBeLessThanOrEqual(1)
}

for (const width of [390, 320]) {
  test.describe(`mouse at ${width}px`, () => {
    test.use({ viewport: { width, height: 844 } })

    for (const position of [30, 3, 97]) {
      test(`pressing the grip at ${position} does not jump, and dragging it follows the pointer`, async ({ page }) => {
        const start = await open(page, position)

        await page.mouse.move(start.grip, start.gripY)
        await page.mouse.down()
        const pressed = await read(page)
        expect(pressed.value).toBe(position)
        expect(Math.abs(pressed.divider - start.divider)).toBeLessThanOrEqual(0.5)

        const direction = position > 50 ? -1 : 1
        for (const distance of [3, 8, 20, 45]) {
          const x = start.grip + direction * distance
          await page.mouse.move(x, start.gripY)
          await expectUnderPointer(page, x)
        }
        await page.mouse.up()
        await expect(page).toHaveURL(new RegExp(`p=${(await read(page)).value}$`))
      })
    }

    test("dragging the grip reaches each edge under the pointer", async ({ page }) => {
      const start = await open(page, 30)

      await page.mouse.move(start.grip, start.gripY)
      await page.mouse.down()
      await page.mouse.move(0, start.gripY, { steps: 8 })
      await expect(page.getByTestId("compare-slider-input")).toHaveValue("0")
      expect((await read(page)).divider).toBeLessThanOrEqual(1)

      await page.mouse.move(width, start.gripY, { steps: 12 })
      await expect(page.getByTestId("compare-slider-input")).toHaveValue("100")
      expect((await read(page)).divider).toBeGreaterThanOrEqual(width - 1)
      await page.mouse.up()
      await expect(page).toHaveURL(/p=100$/)
    })

    test("an off-centre grab keeps its distance and can still reach the edge", async ({ page }) => {
      const start = await open(page, 50)
      const grabX = start.grip - 12

      await page.mouse.move(grabX, start.gripY)
      await page.mouse.down()
      expect((await read(page)).value).toBe(50)

      await page.mouse.move(grabX - 40, start.gripY)
      await expectUnderPointer(page, start.grip - 40)

      await page.mouse.move(0, start.gripY, { steps: 10 })
      await expect(page.getByTestId("compare-slider-input")).toHaveValue("0")
      await page.mouse.up()
    })

    test("pressing the photograph away from the grip still sets the line there", async ({ page }) => {
      const start = await open(page, 30)
      const x = width * 0.7

      await page.mouse.click(x, start.stageY)
      await expectUnderPointer(page, x)
    })
  })

  test.describe(`touch at ${width}px`, () => {
    test.use({ hasTouch: true, viewport: { width, height: 844 } })

    const begin = (cdp: CDPSession, x: number, y: number) =>
      cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] })
    const moveFinger = async (cdp: CDPSession, x: number, y: number) =>
      cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] })
    const end = (cdp: CDPSession) =>
      cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })

    test("a tap on the grip does not jump", async ({ page, context }) => {
      const start = await open(page, 30)
      const cdp = await context.newCDPSession(page)

      await begin(cdp, start.grip + 10, start.gripY)
      await end(cdp)
      await page.waitForTimeout(150)
      expect((await read(page)).value).toBe(30)
    })

    test("the finger carries the grip, and a drag starting inside reaches both edges", async ({ page, context }) => {
      const start = await open(page, 30)
      const cdp = await context.newCDPSession(page)

      await begin(cdp, start.grip, start.gripY)
      for (const distance of [6, 20, 50, 90]) {
        await moveFinger(cdp, start.grip + distance, start.gripY)
        await expectUnderPointer(page, start.grip + distance)
      }

      for (const x of [width - 30, width - 10, width - 1]) {
        await moveFinger(cdp, x, start.gripY)
      }
      await expect(page.getByTestId("compare-slider-input")).toHaveValue("100")

      for (const x of [width / 2, 30, 10, 1]) {
        await moveFinger(cdp, x, start.gripY)
      }
      await expect(page.getByTestId("compare-slider-input")).toHaveValue("0")
      await end(cdp)
      await expect(page).toHaveURL(/p=0$/)
    })

    test("near the end, a grab inside the safe area follows the finger", async ({ page, context }) => {
      const position = 90
      const start = await open(page, position)
      const cdp = await context.newCDPSession(page)
      const grabX = Math.min(start.grip, width - 41)

      await begin(cdp, grabX, start.gripY)
      await moveFinger(cdp, grabX - 10, start.gripY)
      await expectUnderPointer(page, start.grip - 10)
      await moveFinger(cdp, grabX - 30, start.gripY)
      await expectUnderPointer(page, start.grip - 30)
      await end(cdp)
    })

    test("touches starting in the edge margins do nothing, even on the grip", async ({ page, context }) => {
      const start = await open(page, 3)
      const cdp = await context.newCDPSession(page)

      await begin(cdp, start.grip, start.gripY)
      await moveFinger(cdp, start.grip + 60, start.gripY)
      await moveFinger(cdp, start.grip + 120, start.gripY)
      await end(cdp)
      await page.waitForTimeout(150)
      expect((await read(page)).value).toBe(3)
    })

    test("a vertical swipe on the photograph scrolls the page", async ({ page, context }) => {
      const start = await open(page, 30)
      const cdp = await context.newCDPSession(page)

      await begin(cdp, width / 2, start.stageY + 60)
      for (let i = 1; i <= 10; i += 1) {
        await moveFinger(cdp, width / 2, start.stageY + 60 - i * 15)
      }
      await end(cdp)
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(20)
      expect((await read(page)).value).toBe(30)
    })
  })
}

test.describe("with space beside the photograph", () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test("the grip follows the pointer and stops at the photograph's edges", async ({ page }) => {
    const start = await open(page, 30)

    await page.mouse.move(start.grip, start.gripY)
    await page.mouse.down()
    expect((await read(page)).value).toBe(30)
    await page.mouse.move(start.grip + 100, start.gripY, { steps: 4 })
    await expectUnderPointer(page, start.grip + 100)

    await page.mouse.move(0, start.gripY, { steps: 4 })
    await expect(page.getByTestId("compare-slider-input")).toHaveValue("0")
    const box = (await page.getByTestId("compare-overlay-image").boundingBox())!
    expect(Math.abs((await read(page)).divider - box.x)).toBeLessThanOrEqual(1)
    await page.mouse.up()
  })
})
