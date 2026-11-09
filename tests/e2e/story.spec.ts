import { readdirSync, readFileSync } from "fs"
import path from "path"

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

  test("a story lists the six nearest other places, upcoming ones too, and no samples", async ({ page }) => {
    await page.goto("/mill-house")
    const rows = page.getByTestId("nearby-list").getByRole("link")
    await expect(rows).toHaveCount(6)
    const slugs = await rows.evaluateAll((links) => links.map((link) => link.getAttribute("href")))
    expect(slugs).not.toContain("/mill-house")
    await expect(page.getByText("Sample", { exact: true })).toHaveCount(0)
    await expect(page.getByText(/coming soon/i)).toHaveCount(0)
  })

  test("the drag hint goes once the line has been moved", async ({ page }) => {
    await page.goto("/mill-house")
    await expect(page.getByText("Drag the line", { exact: true })).toBeVisible()
    await page.getByTestId("story-show-then").click()
    await page.getByTestId("story-show-then").click()
    await expect(page.getByTestId("compare-slider-input")).toHaveValue("50")
    await expect(page.getByText("Drag the line", { exact: true })).toHaveCount(0)
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

test.describe("a story's own map", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } })

  for (const folder of readdirSync(path.join(process.cwd(), "public", "posts"))) {
    const post = JSON.parse(readFileSync(path.join(process.cwd(), "public", "posts", folder, `${folder}.json`), "utf8"))

    test(`${post.slug} shows itself on the map, in the page, with no detour`, async ({ page }) => {
      await page.goto(`/${post.slug}`)
      await expect(page.getByRole("link", { name: /on the map/i })).toHaveCount(0)
      const map = page.getByTestId("story-map")
      await map.scrollIntoViewIfNeeded()
      await expect(page.locator('[data-testid="story-map"] .maplibregl-canvas')).toBeVisible()

      const pin = page.getByTestId("story-map-pin")
      await expect(pin).toHaveCount(1)
      const box = (await map.boundingBox())!
      const at = (await pin.boundingBox())!
      expect(Math.abs(at.x + at.width / 2 - (box.x + box.width / 2))).toBeLessThanOrEqual(2)
      expect(Math.abs(at.y + at.height / 2 - (box.y + box.height / 2))).toBeLessThanOrEqual(2)
    })
  }

  test("the map waits until the reader nears it, and its space is held from the start", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/mill-house")
    await page.waitForLoadState("load")
    await page.waitForTimeout(400)
    await expect(page.locator(".maplibregl-canvas")).toHaveCount(0)

    const before = (await page.getByTestId("story-map").boundingBox())!
    await page.getByTestId("story-map").scrollIntoViewIfNeeded()
    await expect(page.locator(".maplibregl-canvas")).toBeVisible()
    const after = (await page.getByTestId("story-map").boundingBox())!
    expect(after.height).toBe(before.height)
  })

  test("the keyboard passes over the map's surface and focus is never pulled to it", async ({ page }) => {
    await page.goto("/mill-house")
    await page.getByTestId("story-map").scrollIntoViewIfNeeded()
    await expect(page.locator(".maplibregl-canvas")).toBeVisible()
    await expect(page.locator(".maplibregl-canvas")).not.toHaveAttribute("tabindex", /.*/)
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe("BODY")
  })

  test("when the base map fails, the story says so and stays whole", async ({ page }) => {
    await page.route("**/tiles.openfreemap.org/**", (route) => route.abort())
    await page.goto("/mill-house")
    await page.getByTestId("story-map").scrollIntoViewIfNeeded()
    await expect(page.getByTestId("story-map-failure")).toBeVisible()
    // Nothing from the failed map sits over the words.
    const failure = (await page.getByTestId("story-map-failure").boundingBox())!
    const top = await page.evaluate(
      ([x, y]) => document.elementFromPoint(x, y)?.getAttribute("data-testid"),
      [failure.x + failure.width / 2, failure.y + failure.height / 2]
    )
    expect(top).toBe("story-map-failure")
    await expect(page.getByRole("heading", { level: 1 })).toBeAttached()
    await expect(page.getByTestId("compare-slider-input")).toHaveValue("50")
  })

  for (const [device, use] of [
    ["a phone", { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }],
    ["a touchscreen with a fine pointer", { viewport: { width: 1280, height: 800 }, hasTouch: true, isMobile: false }],
  ] as const) {
  test.describe(`on ${device}`, () => {
    test.use(use)

    test("a swipe over the map still scrolls the page and leaves the pin where it is", async ({ page, context }) => {
      await page.goto("/mill-house")
      await page.getByTestId("story-map").scrollIntoViewIfNeeded()
      await expect(page.locator(".maplibregl-canvas")).toBeVisible()
      await page.waitForTimeout(500)
      const box = (await page.getByTestId("story-map").boundingBox())!
      const x = box.x + box.width / 2
      const cdp = await context.newCDPSession(page)
      const y0 = Math.min(box.y + box.height - 20, 780)
      const start = await page.evaluate(() => window.scrollY)

      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: y0 }] })
      for (let i = 1; i <= 10; i += 1) {
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y0 - i * 20 }] })
      }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(start + 40)

      // Both read in one frame: the page may still be gliding from the swipe.
      const drift = await page.evaluate(() => {
        const map = document.querySelector('[data-testid="story-map"]')!.getBoundingClientRect()
        const pin = document.querySelector('[data-testid="story-map-pin"]')!.getBoundingClientRect()
        return Math.abs(pin.top + pin.height / 2 - (map.top + map.height / 2))
      })
      expect(drift).toBeLessThanOrEqual(2)
    })

    test("a pinch low on the map zooms around the pin and never loses it", async ({ page, context }) => {
      await page.goto("/mill-house")
      await page.getByTestId("story-map").scrollIntoViewIfNeeded()
      await expect(page.locator(".maplibregl-canvas")).toBeVisible()
      await page.waitForTimeout(500)
      const box = (await page.getByTestId("story-map").boundingBox())!
      const cdp = await context.newCDPSession(page)
      const y = box.y + box.height - 24
      const x = box.x + box.width / 2

      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x - 20, y, id: 0 }, { x: x + 20, y, id: 1 }] })
      for (let i = 1; i <= 8; i += 1) {
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x - 20 - i * 10, y, id: 0 }, { x: x + 20 + i * 10, y, id: 1 }] })
      }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
      await page.waitForTimeout(600)

      const map = (await page.getByTestId("story-map").boundingBox())!
      const pin = (await page.getByTestId("story-map-pin").boundingBox())!
      expect(Math.abs(pin.y + pin.height / 2 - (map.y + map.height / 2))).toBeLessThanOrEqual(3)
    })
  })
  }

  test("the pin is not offered to assistive technology as a control", async ({ page }) => {
    await page.goto("/mill-house")
    await page.getByTestId("story-map").scrollIntoViewIfNeeded()
    await expect(page.getByTestId("story-map-pin")).toBeVisible()
    await expect(page.getByTestId("story-map").getByRole("button", { name: "Map marker" })).toHaveCount(0)
    await expect(page.getByRole("region", { name: "Map showing where Mill House, Auckland is" })).toBeVisible()
  })
})

