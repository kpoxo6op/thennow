import { expect, test, type CDPSession, type Page } from "@playwright/test"

test.describe("a story page", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } })

  test("the legend shows each whole photograph and returns to the comparison", async ({ page }) => {
    await page.goto("/sheep")
    const input = page.getByTestId("compare-slider-input")
    const then = page.getByTestId("story-show-then")
    const now = page.getByTestId("story-show-now")

    await then.click()
    await expect(input).toHaveValue("100")
    await expect(page).toHaveURL(/\/sheep\?p=100$/)
    await expect(then).toHaveAttribute("aria-pressed", "true")
    await expect(then).toHaveAccessibleName(/return to the comparison/)

    await now.focus()
    await page.keyboard.press("Enter")
    await expect(input).toHaveValue("0")
    await expect(page).toHaveURL(/\/sheep\?p=0$/)

    await page.keyboard.press("Enter")
    await expect(input).toHaveValue("50")
    await expect(page).toHaveURL(/\/sheep$/)
  })

  test("asking for a whole photograph again returns the line to where it was", async ({ page }) => {
    await page.goto("/sheep?p=30")
    const input = page.getByTestId("compare-slider-input")
    await expect(input).toHaveValue("30")

    await page.getByTestId("story-show-now").click()
    await expect(input).toHaveValue("0")
    await page.getByTestId("story-show-then").click()
    await expect(input).toHaveValue("100")
    await page.getByTestId("story-show-then").click()
    await expect(input).toHaveValue("30")
  })

  test("the whole knob stays on a phone screen at both ends of the line", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    for (const end of [0, 100]) {
      await page.goto(`/mill-house?p=${end}`)
      await expect(page.getByTestId("compare-slider-input")).toHaveValue(String(end))
      const knob = (await page.getByTestId("compare-slider-knob").boundingBox())!
      expect(knob.x).toBeGreaterThanOrEqual(0)
      expect(knob.x + knob.width).toBeLessThanOrEqual(390)
    }
  })

  test("next story visits all six originals, never samples, and no two unwritten in a row", async ({ page }) => {
    const seen: string[] = []
    let slug = "mill-house"

    for (let step = 0; step < 6; step += 1) {
      await page.goto(`/${slug}`)
      await expect(page.getByText("Sample", { exact: true })).toHaveCount(0)
      seen.push(slug)
      const unwritten = (await page.locator("article").innerText()).includes("Coming soon...")
      const nextHref = await page.locator('a[aria-label$="compare then and now"]').getAttribute("href")
      slug = nextHref!.slice(1)
      await page.goto(`/${slug}`)
      const nextUnwritten = (await page.locator("article").innerText()).includes("Coming soon...")
      expect(unwritten && nextUnwritten, `${seen.at(-1)} to ${slug}`).toBe(false)
    }

    expect(new Set(seen).size).toBe(6)
    expect(slug).toBe("mill-house")
  })

  test("a sample says so on the photograph and leads to the real story behind it", async ({ page }) => {
    await page.goto("/demo-017")
    await expect(page.getByText("Placeholder photographs")).toBeVisible()
    await expect(page.getByText("Sample place.")).toBeInViewport()
    await page.getByRole("link", { name: "Mission Bay Yacht Club, Auckland" }).last().click()
    await expect(page).toHaveURL(/\/mission-bay-yacht-club$/)
    await expect(page.getByText("Sample place.")).toHaveCount(0)
  })
})

for (const width of [320, 390, 768]) {
  test.describe(`on a ${width}px touch screen`, () => {
    test.use({ viewport: { width, height: 1000 }, hasTouch: true, isMobile: true, contextOptions: { reducedMotion: "reduce" } })

    const knobOpacity = (page: Page) =>
      page.getByTestId("compare-slider-knob").evaluate((knob) => getComputedStyle(knob).opacity)

    test("a whole photograph shows no line to grab at the edge, and a tap brings it back safely", async ({ page, context }) => {
      await page.goto("/mill-house")
      const input = page.getByTestId("compare-slider-input")
      await page.getByTestId("story-show-then").tap()
      await expect(input).toHaveValue("100")
      await expect(page).toHaveURL(/p=100$/)
      await expect.poll(() => knobOpacity(page)).toBe("0")

      const before = (await page.getByTestId("compare-overlay-image").boundingBox())!
      const box = (await page.getByTestId("compare-stage").boundingBox())!
      const cdp = await context.newCDPSession(page)
      const tapAt = async (x: number) => {
        const y = box.y + box.height / 2
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] })
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
      }

      // A touch inside the margin stays the system's.
      await tapAt(10)
      await tapAt(width - 10)
      await page.waitForTimeout(150)
      await expect(input).toHaveValue("100")

      // Just past the margin, the line comes back and stops short of the edge zone.
      await tapAt(44)
      await expect.poll(() => knobOpacity(page)).toBe("1")
      const knob = (await page.getByTestId("compare-slider-knob").boundingBox())!
      expect(knob.x + knob.width / 2).toBeCloseTo(56, 0)

      const after = (await page.getByTestId("compare-overlay-image").boundingBox())!
      expect(after.x).toBeCloseTo(before.x, 1)
      expect(after.width).toBeCloseTo(before.width, 1)
    })

    test("wherever a drag parks the line on a story, it stays visible and can be picked up", async ({ page, context }) => {
      await page.goto("/mill-house")
      const cdp = await context.newCDPSession(page)
      const knob = page.getByTestId("compare-slider-knob")
      const input = page.getByTestId("compare-slider-input")
      const box = (await knob.boundingBox())!
      const y = box.y + box.height / 2
      const swipeTo = async (from: number, to: number) => {
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: from, y }] })
        for (let i = 1; i <= 8; i += 1) {
          await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: from + ((to - from) * i) / 8, y }] })
        }
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
      }

      for (const [from, to] of [[width / 2, 1], [56, width - 1], [width - 56, width / 2]]) {
        await swipeTo(from, to)
        await expect.poll(() => knobOpacity(page)).toBe("1")
        await page.waitForTimeout(50)
        expect(Number(await input.inputValue())).toBeGreaterThan(0)
        expect(Number(await input.inputValue())).toBeLessThan(100)
      }
      await expect(input).toHaveValue("50")
    })

    test("a line parked at the limit is still there after a reload, and the hint fits what shows", async ({ page, context }) => {
      await page.goto("/mill-house")
      const cdp = await context.newCDPSession(page)
      const knob = page.getByTestId("compare-slider-knob")
      const box = (await knob.boundingBox())!
      const y = box.y + box.height / 2

      for (const [from, to] of [[width / 2, width - 1], [width - 56, 1]]) {
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: from, y }] })
        for (let i = 1; i <= 8; i += 1) {
          await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: from + ((to - from) * i) / 8, y }] })
        }
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
        await page.waitForTimeout(100)
        await page.reload()
        await expect(page).toHaveURL(/p=\d+$/)
        await page.waitForTimeout(300)
        await expect.poll(() => knobOpacity(page)).toBe("1")
        await expect(page.getByText("Drag the line", { exact: true })).toBeVisible()
      }

      await page.goto("/mill-house?p=2")
      await expect(page.getByTestId("compare-slider-input")).toHaveValue("2")
      await expect.poll(() => knobOpacity(page)).toBe("0")
      await expect(page.getByText("Tap to compare", { exact: true })).toBeVisible()
    })

    test("addresses at the ends keep their meaning without a line at the edge", async ({ page }) => {
      for (const position of [0, 100]) {
        await page.goto(`/mill-house?p=${position}`)
        await expect(page.getByTestId("compare-slider-input")).toHaveValue(String(position))
        await expect.poll(() => knobOpacity(page)).toBe("0")
      }

      await page.goto("/mill-house?p=30")
      await expect(page.getByTestId("compare-slider-input")).toHaveValue("30")
      await expect.poll(() => knobOpacity(page)).toBe("1")

      await page.goto("/mill-house?p=50")
      await expect(page).toHaveURL(/mill-house$/)
      await expect.poll(() => knobOpacity(page)).toBe("1")
    })

    test("the homepage line also waits short of both screen edges", async ({ page, context }) => {
      await page.goto("/")
      const cdp = await context.newCDPSession(page)
      const knob = page.getByTestId("compare-slider-knob")
      const box = (await knob.boundingBox())!
      const y = box.y + box.height / 2
      const swipeTo = async (from: number, to: number) => {
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: from, y }] })
        for (let i = 1; i <= 8; i += 1) {
          await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: from + ((to - from) * i) / 8, y }] })
        }
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
      }
      const center = async () => {
        const now = (await knob.boundingBox())!
        return now.x + now.width / 2
      }

      await swipeTo(width / 2, width - 1)
      await expect.poll(center).toBeCloseTo(width - 56, 0)
      await expect.poll(() => knobOpacity(page)).toBe("1")
      await swipeTo(width - 56, 1)
      await expect.poll(center).toBeCloseTo(56, 0)
      await expect.poll(() => knobOpacity(page)).toBe("1")
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
    })
  })
}

test.describe("turning a touch screen", () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, contextOptions: { reducedMotion: "reduce" } })

  const swipe = async (page: Page, cdp: CDPSession, from: number, to: number) => {
    const box = (await page.getByTestId("compare-slider-knob").boundingBox())!
    const y = box.y + box.height / 2
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: from, y }] })
    for (let i = 1; i <= 8; i += 1) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: from + ((to - from) * i) / 8, y }] })
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
  }

  test("a line stranded in the edge zone returns to the safe limit, visible", async ({ page, context }) => {
    await page.goto("/")
    const knob = page.getByTestId("compare-slider-knob")
    const cdp = await context.newCDPSession(page)
    await swipe(page, cdp, 422, 843)
    await expect.poll(async () => (await knob.boundingBox())!.x + 24).toBeCloseTo(844 - 56, 0)

    await page.setViewportSize({ width: 390, height: 844 })
    await expect.poll(async () => {
      const now = (await knob.boundingBox())!
      return now.x + now.width / 2
    }).toBeCloseTo(390 - 56, 0)
    await expect.poll(() => knob.evaluate((el) => getComputedStyle(el).opacity)).toBe("1")
  })

  test("a whole photograph stays whole when turned", async ({ page }) => {
    await page.goto("/mill-house?p=100")
    await expect(page.getByTestId("compare-slider-input")).toHaveValue("100")
    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForTimeout(250)
    await expect(page.getByTestId("compare-slider-input")).toHaveValue("100")
  })

  test("with space beside a story photograph, the whole grip can be picked up at its edge", async ({ page, context }) => {
    await page.goto("/mill-house")
    const input = page.getByTestId("compare-slider-input")
    const knob = page.getByTestId("compare-slider-knob")
    const cdp = await context.newCDPSession(page)
    await swipe(page, cdp, 422, 843)
    await expect(input).toHaveValue("100")

    const box = (await knob.boundingBox())!
    const y = box.y + box.height / 2
    const outerHalf = box.x + box.width * 0.75
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: outerHalf, y }] })
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: outerHalf - 40, y }] })
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
    await expect.poll(async () => Number(await input.inputValue())).toBeLessThan(100)
  })
})
