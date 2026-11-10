import { expect, test, type Page } from "./fixtures"

// Zen: the same comparison and its years alone on black, as large as the screen allows.

async function rect(page: Page, testId: string) {
  return (await page.getByTestId(testId).boundingBox())!
}

// Where the photograph itself sits inside the stage (it is never cropped).
async function photo(page: Page) {
  return page.getByTestId("compare-base-image").evaluate((img) => {
    const box = img.parentElement!.getBoundingClientRect()
    return { x: box.x, y: box.y, width: box.width, height: box.height }
  })
}

const sizes = [
  { name: "phone", width: 390, height: 844, touch: true },
  { name: "turned phone", width: 844, height: 390, touch: true },
  { name: "desktop", width: 1440, height: 900, touch: false },
]

for (const size of sizes) {
  test.describe(`zen on a ${size.name}`, () => {
    test.use({
      viewport: { width: size.width, height: size.height },
      hasTouch: size.touch,
      isMobile: size.touch,
      contextOptions: { reducedMotion: "reduce" },
    })

    test("fills the screen with the whole photograph and its years, and gives the page back as it was", async ({
      page,
    }) => {
      await page.goto("/sheep?p=30")
      const input = page.getByTestId("compare-slider-input")
      await expect(input).toHaveValue("30")
      const historyLength = await page.evaluate(() => history.length)
      const ratio = await page
        .locator(".tn-story")
        .evaluate((main) =>
          Number(getComputedStyle(main).getPropertyValue("--ratio"))
        )
      const pageBefore = await photo(page)

      await page.getByTestId("story-zen").click()
      const zen = page.locator(".tn-zen[data-zen]")
      await expect(zen).toBeVisible()
      await expect(page.getByTestId("story-zen")).toHaveAccessibleName(
        "Close full screen"
      )

      const block = (await zen.boundingBox())!
      expect(block.x).toBe(0)
      expect(block.y).toBe(0)
      expect(block.width).toBe(size.width)
      expect(block.height).toBe(size.height)
      expect(
        await zen.evaluate((el) => getComputedStyle(el).backgroundColor)
      ).toBe("rgb(0, 0, 0)")
      expect(
        await page.evaluate(
          () => getComputedStyle(document.documentElement).overflow
        )
      ).toBe("hidden")

      // Nothing else of the page shows through.
      const header = await rect(page, "site-header")
      const covering = await page.evaluate(
        ([x, y]) =>
          document.elementFromPoint(x, y)?.closest(".tn-zen") !== null,
        [header.x + header.width / 2, Math.max(1, header.y + header.height / 2)]
      )
      expect(covering).toBe(true)

      // The whole photograph, larger than on the page, inside the screen with room for the years.
      const shown = await photo(page)
      expect(shown.width / shown.height).toBeCloseTo(ratio, 1)
      expect(shown.x).toBeGreaterThanOrEqual(-0.5)
      expect(shown.y).toBeGreaterThanOrEqual(-0.5)
      expect(shown.x + shown.width).toBeLessThanOrEqual(size.width + 0.5)
      expect(shown.y + shown.height).toBeLessThanOrEqual(size.height - 44 + 0.5)
      expect(shown.width).toBeGreaterThanOrEqual(pageBefore.width - 0.5)
      expect(
        Math.abs(shown.width - size.width) < 1 ||
          Math.abs(shown.height - (size.height - 44)) < 1
      ).toBe(true)

      // The years sit under the photograph, clear of the screen's edges.
      const then = page.getByTestId("story-show-then")
      const now = page.getByTestId("story-show-now")
      const thenBox = (await then.boundingBox())!
      const nowBox = (await now.boundingBox())!
      expect(thenBox.y).toBeGreaterThanOrEqual(shown.y + shown.height - 1)
      expect(thenBox.y + thenBox.height).toBeLessThanOrEqual(size.height)
      expect(thenBox.x).toBeGreaterThanOrEqual(16 - 0.5)
      expect(nowBox.x + nowBox.width).toBeLessThanOrEqual(size.width - 16 + 0.5)

      // No words in zen.
      await expect(
        page.getByText("Drag the line", { exact: true })
      ).toHaveCount(0)
      await expect(
        page.getByText("Tap to compare", { exact: true })
      ).toHaveCount(0)

      // The line and the years work as on the page.
      await expect(input).toHaveValue("30")
      await then.click()
      await expect(input).toHaveValue("100")
      await expect(page).toHaveURL(/\/sheep\?p=100$/)
      await then.click()
      await expect(input).toHaveValue("30")
      await now.click()
      await expect(input).toHaveValue("0")
      await now.click()
      await expect(input).toHaveValue("30")
      await expect(page).toHaveURL(/\/sheep\?p=30$/)

      await page.getByTestId("story-zen").click()
      await expect(zen).toHaveCount(0)
      await expect(page.getByTestId("story-zen")).toHaveAccessibleName(
        "Full screen"
      )
      await expect(input).toHaveValue("30")
      expect(
        await page.evaluate(
          () => getComputedStyle(document.documentElement).overflow
        )
      ).not.toBe("hidden")
      expect(await page.evaluate(() => history.length)).toBe(historyLength)
      await expect
        .poll(async () => Math.round((await photo(page)).width))
        .toBe(Math.round(pageBefore.width))
      await expect
        .poll(async () => Math.round((await photo(page)).height))
        .toBe(Math.round(pageBefore.height))
    })

    test("the knob stays on the border and the before photograph stays put while the line moves", async ({
      page,
    }) => {
      await page.goto("/sheep")
      await page.getByTestId("story-zen").click()
      await expect(page.locator(".tn-zen[data-zen]")).toBeVisible()
      const input = page.getByTestId("compare-slider-input")
      const before = await rect(page, "compare-overlay-image")

      for (const value of ["20", "80"]) {
        await input.focus()
        await input.fill(value)
        await expect(input).toHaveValue(value)
        // Where the knob's centre sits against where the overlay's clip ends, read together.
        await expect
          .poll(() =>
            page.evaluate(() => {
              const at = (id: string) =>
                document.querySelector(`[data-testid="${id}"]`)!
              const stage = at("compare-stage").getBoundingClientRect()
              const knob = at("compare-slider-knob").getBoundingClientRect()
              const clip = getComputedStyle(at("compare-overlay")).clipPath
              const right = Number(/inset\(0px ([\d.]+)px/.exec(clip)?.[1])
              return Math.abs(
                knob.x + knob.width / 2 - (stage.x + stage.width - right)
              )
            })
          )
          .toBeLessThan(1)
        const overlay = await rect(page, "compare-overlay-image")
        expect(overlay.x).toBeCloseTo(before.x, 1)
        expect(overlay.width).toBeCloseTo(before.width, 1)
      }
      await expect(page).toHaveURL(/\/sheep\?p=80$/)
    })
  })
}

test.describe("zen with a keyboard", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } })

  test("Escape closes it, focus returns to its button, and Tab stays inside", async ({
    page,
  }) => {
    await page.goto("/sheep")
    const button = page.getByTestId("story-zen")
    await button.focus()
    await page.keyboard.press("Enter")
    const zen = page.locator(".tn-zen[data-zen]")
    await expect(zen).toBeVisible()

    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab")
      expect(
        await page.evaluate(
          () => document.activeElement?.closest(".tn-zen[data-zen]") !== null
        )
      ).toBe(true)
    }

    await page.keyboard.press("Escape")
    await expect(zen).toHaveCount(0)
    await expect(button).toBeFocused()
  })

  test("a reload comes back to the page, not to zen, and ?p=50 still normalises away", async ({
    page,
  }) => {
    await page.goto("/sheep?p=50")
    await expect(page).toHaveURL(/\/sheep$/)
    await page.getByTestId("story-zen").click()
    await expect(page.locator(".tn-zen[data-zen]")).toBeVisible()
    await page.reload()
    await expect(page.locator(".tn-zen[data-zen]")).toHaveCount(0)
    await expect(page.getByTestId("story-zen")).toBeVisible()
  })
})
