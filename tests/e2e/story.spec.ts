import { expect, test, type CDPSession, type Page } from "./fixtures"

// The map library's own file can't be fetched: a weak signal, or a page kept open across a release.
async function withoutMapCode(page: Page) {
  await page.route("**/_next/static/**/*.js", async (route) => {
    const response = await route.fetch()
    const body = await response.text()
    if (body.includes("maplibregl-ctrl-geolocate")) await route.abort()
    else await route.fulfill({ response, body })
  })
}

// A script still being fetched for withoutMapCode when a test ends must not fail that test.
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "ignoreErrors" })
})

test.describe("a story page", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } })

  test("the legend shows each whole photograph and returns to the comparison", async ({
    page,
  }) => {
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

  test("asking for a whole photograph again returns the line to where it was", async ({
    page,
  }) => {
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

  test("a story lists nearby places, upcoming ones too, and no samples; a remote one still gets three", async ({
    page,
  }) => {
    await page.goto("/sheep")
    await expect(page.getByTestId("nearby-list").getByRole("link")).toHaveCount(
      3
    )
    await page.goto("/mill-house")
    const rows = page.getByTestId("nearby-list").getByRole("link")
    await expect(rows).toHaveCount(6)
    const slugs = await rows.evaluateAll((links) =>
      links.map((link) => link.getAttribute("href"))
    )
    expect(slugs).not.toContain("/mill-house")
    await expect(page.getByText("Sample", { exact: true })).toHaveCount(0)
    await expect(page.getByText(/coming soon/i)).toHaveCount(0)
  })
})

test.describe("turning a touch screen", () => {
  test.use({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
    contextOptions: { reducedMotion: "reduce" },
  })

  const swipe = async (
    page: Page,
    cdp: CDPSession,
    from: number,
    to: number
  ) => {
    const box = (await page.getByTestId("compare-slider-knob").boundingBox())!
    const y = box.y + box.height / 2
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: from, y }],
    })
    for (let i = 1; i <= 8; i += 1) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: from + ((to - from) * i) / 8, y }],
      })
    }
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    })
  }

  test("a line stranded in the edge zone returns to the safe limit, visible", async ({
    page,
    context,
  }) => {
    await page.goto("/")
    const knob = page.getByTestId("compare-slider-knob")
    const cdp = await context.newCDPSession(page)
    await swipe(page, cdp, 422, 843)
    await expect
      .poll(async () => (await knob.boundingBox())!.x + 24)
      .toBeCloseTo(844 - 56, 0)

    await page.setViewportSize({ width: 390, height: 844 })
    await expect
      .poll(async () => {
        const now = (await knob.boundingBox())!
        return now.x + now.width / 2
      })
      .toBeCloseTo(390 - 56, 0)
    await expect
      .poll(() => knob.evaluate((el) => getComputedStyle(el).opacity))
      .toBe("1")
  })
})

test.describe("a story's own map", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } })

  test("the map waits until the reader nears it, and its space is held from the start", async ({
    page,
  }) => {
    // Mill House has the longest text, so its map starts furthest below a small phone's first screen.
    await page.setViewportSize({ width: 390, height: 700 })
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

  test("when the base map fails, the story says so and stays whole", async ({
    page,
  }) => {
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

  test("when the map's own code can't be fetched, the story says so and stays whole", async ({
    page,
  }) => {
    await withoutMapCode(page)
    await page.goto("/mill-house")
    await page.getByTestId("story-map").scrollIntoViewIfNeeded()
    await expect(page.getByTestId("story-map-failure")).toBeVisible()
    await expect(page.getByRole("heading", { level: 1 })).toBeAttached()
    await expect(page.getByTestId("compare-slider-input")).toHaveValue("50")
  })

  for (const [device, use] of [
    [
      "a phone",
      { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
    ],
  ] as const) {
    test.describe(`on ${device}`, () => {
      test.use(use)

      test("a suggested viewpoint can be replaced by a personal spot and reset without losing directions", async ({
        page,
      }) => {
        await page.goto("/ferry-building")
        const map = page.getByTestId("story-map")
        const spot = page.getByTestId("story-map-viewpoint")
        const directions = page.getByTestId("story-map-directions")
        await map.scrollIntoViewIfNeeded()
        await expect(spot).toHaveAccessibleName("Suggested viewpoint")
        await expect(page.getByTestId("story-map-context")).toContainText(
          "Lower Albert Street"
        )
        const original = await directions.getAttribute("href")
        expect(new URL(original!).searchParams.get("destination")).toBe(
          "-36.84286,174.76594"
        )
        await page.getByTestId("story-map-pick").tap()
        const box = (await map.boundingBox())!
        await page.touchscreen.tap(box.x + 75, box.y + box.height - 45)
        await expect(spot).toHaveAccessibleName("Your chosen spot")
        await expect(directions).not.toHaveAttribute("href", original!)
        await expect(page.getByTestId("story-map-context")).toContainText(
          "Your spot"
        )
        // The direction wedge must point toward the subject in actual north-up map geometry.
        const alignment = await page.evaluate(() => {
          const camera = document
            .querySelector(".tn-viewpoint")!
            .getBoundingClientRect()
          const subject = document
            .querySelector('[data-testid="story-map-pin"]')!
            .getBoundingClientRect()
          const rotation = new DOMMatrix(
            getComputedStyle(document.querySelector(".tn-viewpoint-cone")!)
              .transform
          )
          const x = subject.x + subject.width / 2 - camera.x - camera.width / 2
          const y =
            subject.y + subject.height / 2 - camera.y - camera.height / 2
          return (x * rotation.c * -1 + y * rotation.d * -1) / Math.hypot(x, y)
        })
        expect(alignment).toBeGreaterThan(0.98)
        await page.getByRole("button", { name: "Reset map" }).tap()
        await expect(spot).toHaveAccessibleName("Suggested viewpoint")
        await expect(directions).toHaveAttribute("href", original!)
        // A denied location request must not remove the chosen starting point or its route.
        await page.context().clearPermissions()
        await page.getByRole("button", { name: "Find my location" }).tap()
        await expect(
          page.getByText("Couldn’t find your location.", { exact: false })
        ).toBeVisible()
        await expect(directions).toHaveAttribute("href", original!)
        await page.route("**/tiles.openfreemap.org/**", (route) =>
          route.abort()
        )
        await page.reload()
        await map.scrollIntoViewIfNeeded()
        await expect(page.getByTestId("story-map-failure")).toBeVisible()
        await expect(directions).toHaveAttribute("href", original!)
        await page.goto("/mill-house")
        await map.scrollIntoViewIfNeeded()
        await expect(spot).toHaveCount(0)
        await expect(directions).toHaveAccessibleName(
          /Walking directions to Mill/
        )
      })

      test("a swipe over the map still scrolls the page and leaves the pin where it is", async ({
        page,
        context,
      }) => {
        await page.goto("/mill-house")
        await page.getByTestId("story-map").scrollIntoViewIfNeeded()
        await expect(page.locator(".maplibregl-canvas")).toBeVisible()
        await page.waitForTimeout(500)
        const box = (await page.getByTestId("story-map").boundingBox())!
        const x = box.x + box.width / 2
        const cdp = await context.newCDPSession(page)
        const y0 = Math.min(box.y + box.height - 20, 780)
        const start = await page.evaluate(() => window.scrollY)

        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x, y: y0 }],
        })
        for (let i = 1; i <= 10; i += 1) {
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x, y: y0 - i * 20 }],
          })
        }
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        })
        await expect
          .poll(() => page.evaluate(() => window.scrollY))
          .toBeGreaterThan(start + 40)

        // Both read in one frame: the page may still be gliding from the swipe.
        const drift = await page.evaluate(() => {
          const map = document
            .querySelector('[data-testid="story-map"]')!
            .getBoundingClientRect()
          const pin = document
            .querySelector('[data-testid="story-map-pin"]')!
            .getBoundingClientRect()
          return Math.abs(pin.top + pin.height / 2 - (map.top + map.height / 2))
        })
        expect(drift).toBeLessThanOrEqual(2)
      })
    })
  }
})
