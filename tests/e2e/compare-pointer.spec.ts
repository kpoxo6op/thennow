import { expect, test, type Page } from "@playwright/test"

const STORY = "/mill-house"

async function read(page: Page) {
  return page.evaluate(() => {
    const q = (id: string) =>
      document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!
    const knob = q("compare-slider-knob").getBoundingClientRect()
    const stage = q("compare-stage").getBoundingClientRect()
    const insets = (
      (q("compare-overlay").getAttribute("style") ?? "").match(
        /inset\(([^)]*)\)/
      )?.[1] ?? ""
    ).split(/\s+/)

    return {
      value: Number(
        q("compare-slider-input").getAttribute("value") ??
          (q("compare-slider-input") as HTMLInputElement).value
      ),
      divider: stage.right - parseFloat(insets[1] ?? insets[0]),
      grip: knob.left + knob.width / 2,
      gripY: knob.top + knob.height / 2,
      stageY: stage.top + stage.height * 0.2,
    }
  })
}

async function open(page: Page, position: number) {
  await page.goto(`${STORY}?p=${position}`)
  await expect(page.getByTestId("compare-slider-input")).toHaveValue(
    String(position)
  )
  await expect
    .poll(async () =>
      Math.abs((await read(page)).divider - (await read(page)).grip)
    )
    .toBeLessThanOrEqual(1)
  return read(page)
}

async function expectUnderPointer(page: Page, x: number) {
  await expect
    .poll(async () => Math.abs((await read(page)).divider - x))
    .toBeLessThanOrEqual(1)
  const state = await read(page)
  expect(Math.abs(state.grip - x)).toBeLessThanOrEqual(1)
}

for (const width of [390]) {
  test.describe(`mouse at ${width}px`, () => {
    test.use({ viewport: { width, height: 844 } })

    test("an off-centre grab keeps its distance and can still reach the edge", async ({
      page,
    }) => {
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

    test("pressing the photograph away from the grip still sets the line there", async ({
      page,
    }) => {
      const start = await open(page, 30)
      const x = width * 0.7

      await page.mouse.click(x, start.stageY)
      await expectUnderPointer(page, x)
    })
  })
}

test.describe("with space beside the photograph", () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test("the grip follows the pointer and stops at the photograph's edges", async ({
    page,
  }) => {
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
