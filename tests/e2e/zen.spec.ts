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

// Zen asks the browser for full screen, which arrives a moment later; measure after it has.
async function settled(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          !document.fullscreenEnabled ||
          document.fullscreenElement?.matches(".tn-zen[data-zen]") === true
      )
    )
    .toBe(true)
  await page.evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done))
      )
  )
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
      const ratio = await page
        .locator(".tn-story")
        .evaluate((main) =>
          Number(getComputedStyle(main).getPropertyValue("--ratio"))
        )
      const pageBefore = await photo(page)

      await page.getByTestId("story-zen").click()
      const zen = page.locator(".tn-zen[data-zen]")
      await expect(zen).toBeVisible()
      await settled(page)
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

      // The whole photograph, at least as large as on the page, inside the screen with room for the
      // years and half a knob at either side.
      const shown = await photo(page)
      expect(shown.width / shown.height).toBeCloseTo(ratio, 1)
      expect(shown.x).toBeGreaterThanOrEqual(-0.5)
      expect(shown.y).toBeGreaterThanOrEqual(-0.5)
      expect(shown.x + shown.width).toBeLessThanOrEqual(size.width + 0.5)
      expect(shown.y + shown.height).toBeLessThanOrEqual(size.height - 44 + 0.5)
      expect(shown.width).toBeGreaterThanOrEqual(pageBefore.width - 0.5)
      expect(
        Math.abs(shown.width - (size.width - 48)) < 1 ||
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
      // ...and line up with the photograph's own edges where it leaves room.
      expect(thenBox.x).toBeCloseTo(Math.max(shown.x, 16), 0)
      expect(nowBox.x + nowBox.width).toBeCloseTo(
        Math.min(shown.x + shown.width, size.width - 16),
        0
      )

      // The page behind is out of reach, for screen readers too.
      expect(
        await page
          .getByTestId("site-header")
          .evaluate((el) => el.closest("[inert]") !== null)
      ).toBe(true)
      await expect(page.getByRole("dialog")).toHaveAccessibleName(/.+/)

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
      await expect
        .poll(() =>
          page.evaluate(
            () => getComputedStyle(document.documentElement).overflow
          )
        )
        .not.toBe("hidden")
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
      await settled(page)
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

  test("Back closes zen and stays on the place; closing leaves no step behind", async ({
    page,
  }) => {
    await page.goto("/places")
    await page.goto("/sheep?p=30")
    const zen = page.locator(".tn-zen[data-zen]")
    const button = page.getByTestId("story-zen")

    await button.click()
    await expect(zen).toBeVisible()
    await settled(page)
    await page.goBack()
    await expect(zen).toHaveCount(0)
    await expect(page).toHaveURL(/\/sheep\?p=30$/)
    await expect
      .poll(() => page.evaluate(() => document.fullscreenElement === null))
      .toBe(true)

    // A double tap on the close button closes zen once and stays on the place.
    await button.click()
    await expect(zen).toBeVisible()
    await settled(page)
    await button.dblclick()
    await expect(zen).toHaveCount(0)
    await page.waitForTimeout(400)
    await expect(page).toHaveURL(/\/sheep\?p=30$/)

    await page.goBack()
    await expect(page).toHaveURL(/\/places$/)
  })

  test("leaving the browser's full screen (Android's Back, a desktop's Esc) closes zen", async ({
    page,
  }) => {
    await page.goto("/sheep")
    await page.getByTestId("story-zen").click()
    await expect(page.locator(".tn-zen[data-zen]")).toBeVisible()
    await settled(page)
    await page.evaluate(() => document.exitFullscreen())
    await expect(page.locator(".tn-zen[data-zen]")).toHaveCount(0)
    await expect(page).toHaveURL(/\/sheep$/)
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

test.describe("zen when the browser has no full screen, as on an iPhone", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    contextOptions: { reducedMotion: "reduce" },
  })

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      // @ts-expect-error: an iPhone's Safari has no full screen for a page's own elements
      delete Element.prototype.requestFullscreen
    })
  })

  test("Back closes zen and stays on the page with the line where it was", async ({
    page,
  }) => {
    await page.goto("/sheep")
    await page.getByTestId("story-zen").click()
    const zen = page.locator(".tn-zen[data-zen]")
    await expect(zen).toBeVisible()
    const input = page.getByTestId("compare-slider-input")
    await input.focus()
    await input.fill("70")
    await expect(page).toHaveURL(/\/sheep\?p=70$/)

    await page.goBack()
    await expect(zen).toHaveCount(0)
    await expect(page).toHaveURL(/\/sheep\?p=70$/)
    // ...and stays there once the router has caught up.
    await page.waitForTimeout(400)
    await expect(page).toHaveURL(/\/sheep\?p=70$/)
    await expect(input).toHaveValue("70")
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  })

  test("turning the phone keeps the photograph whole and the line where it was", async ({
    page,
  }) => {
    await page.goto("/sheep?p=30")
    await page.getByTestId("story-zen").click()
    await expect(page.locator(".tn-zen[data-zen]")).toBeVisible()
    const input = page.getByTestId("compare-slider-input")

    for (const [width, height] of [
      [844, 390],
      [390, 844],
    ]) {
      await page.setViewportSize({ width, height })
      await expect
        .poll(async () => {
          const box = await photo(page)
          return (
            box.x >= -0.5 &&
            box.y >= -0.5 &&
            box.x + box.width <= width + 0.5 &&
            box.y + box.height <= height - 44 + 0.5 &&
            (Math.abs(box.width - (width - 48)) < 1 ||
              Math.abs(box.height - (height - 44)) < 1)
          )
        })
        .toBe(true)
      await expect(input).toHaveValue("30")
    }
  })

  test("its own button closes it without leaving a step to go back through", async ({
    page,
  }) => {
    await page.goto("/places")
    await page.goto("/sheep")
    await page.getByTestId("story-zen").click()
    await expect(page.locator(".tn-zen[data-zen]")).toBeVisible()
    await page.getByTestId("story-zen").click()
    await expect(page.locator(".tn-zen[data-zen]")).toHaveCount(0)
    await expect(page).toHaveURL(/\/sheep$/)

    await page.goBack()
    await expect(page).toHaveURL(/\/places$/)
  })
})

test.describe("zen by hand", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } })

  test("a mouse drags the line in zen", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto("/sheep")
    await page.getByTestId("story-zen").click()
    await expect(page.locator(".tn-zen[data-zen]")).toBeVisible()
    await settled(page)
    const input = page.getByTestId("compare-slider-input")
    const shown = await photo(page)
    const y = shown.y + shown.height / 2

    await page.mouse.move(shown.x + shown.width / 2, y)
    await page.mouse.down()
    await page.mouse.move(shown.x + shown.width * 0.3, y, { steps: 8 })
    await page.mouse.up()
    await expect(input).toHaveValue("30")
    await expect(page).toHaveURL(/\/sheep\?p=30$/)
  })

  test("a finger drags the line in zen and stops clear of the screen's edge", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
      reducedMotion: "reduce",
    })
    const page = await context.newPage()
    await page.goto("/sheep")
    await page.getByTestId("story-zen").click()
    await expect(page.locator(".tn-zen[data-zen]")).toBeVisible()
    await settled(page)
    const shown = await photo(page)
    const y = shown.y + shown.height / 2
    const cdp = await context.newCDPSession(page)
    const touch = (type: "touchStart" | "touchMove" | "touchEnd", x?: number) =>
      cdp.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: x === undefined ? [] : [{ x, y }],
      })

    await touch("touchStart", 195)
    for (let x = 195; x >= 2; x -= 8) await touch("touchMove", x)
    await touch("touchMove", 2)
    await touch("touchEnd")

    const knob = (await page.getByTestId("compare-slider-knob").boundingBox())!
    expect(knob.x + knob.width / 2).toBeCloseTo(56, 0)
    await context.close()
  })
})
