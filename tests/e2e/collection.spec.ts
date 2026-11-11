import { readdirSync, readFileSync } from "fs"
import path from "path"

import { expect, test, type Page } from "./fixtures"

const postsDir = path.join(process.cwd(), "public", "posts")
const entries = readdirSync(postsDir).map((folder) => ({
  folder,
  ...JSON.parse(
    readFileSync(path.join(postsDir, folder, `${folder}.json`), "utf8")
  ),
}))
const posts = entries.filter((entry) => entry.a_imageUrl)
const pendingEntries = entries.filter((entry) => !entry.a_imageUrl)

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

const cards = (page: Page) => page.getByTestId("story-card")
const markers = (page: Page) => page.getByTestId("home-map-marker")

async function clickMarkerInsideMap(page: Page, preferCluster = false) {
  return page.evaluate((preferCluster) => {
    const stage = document
      .querySelector('[data-testid="home-map"]')!
      .getBoundingClientRect()
    const inside = Array.from(
      document.querySelectorAll<HTMLElement>('[data-testid="home-map-marker"]')
    ).filter((marker) => {
      const box = marker.getBoundingClientRect()
      return (
        box.left > stage.left &&
        box.right < stage.right - 50 &&
        box.top > stage.top &&
        box.bottom < stage.bottom
      )
    })
    const marker =
      inside.find(
        (candidate) => (candidate.dataset.count === "1") !== preferCluster
      ) ?? inside[0]
    marker?.click()
    return marker?.dataset.count ?? null
  }, preferCluster)
}

for (const viewport of [{ name: "mobile", width: 390, height: 844 }]) {
  test.describe(`on ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

    test("the last card opens at the top and Places returns to the same place", async ({
      page,
    }) => {
      await page.goto("/places")
      await expect(page.getByTestId("places-toolbar")).toBeVisible()
      const card = cards(page).last()
      await card.scrollIntoViewIfNeeded()
      const name = (await card.textContent())?.trim() ?? ""
      const scrollBefore = await page.evaluate(() => window.scrollY)

      await card.click()
      await expect(page.getByRole("heading", { level: 1, name })).toBeVisible()
      await expect(page.getByTestId("compare-slider-input")).toHaveValue("50")
      expect(await page.evaluate(() => window.scrollY)).toBe(0)

      await page
        .getByTestId("site-header")
        .getByRole("link", { name: "Places" })
        .click()
      await expect(cards(page)).toHaveCount(posts.length)
      await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .toBeGreaterThan(scrollBefore - 60)
    })

    test("map clusters lead to a selected place, its story, and back to the same map", async ({
      page,
    }) => {
      await page.goto("/places?view=map")
      await expect(markers(page).first()).toBeVisible()

      let count = await clickMarkerInsideMap(page, true)
      for (let step = 0; step < 10 && count !== "1"; step += 1) {
        await page.waitForTimeout(800)
        count = await clickMarkerInsideMap(page)
      }
      expect(count).toBe("1")
      const selection = page.getByTestId("map-selection")
      await expect(selection).toBeVisible()
      await page.waitForTimeout(800)
      const mapUrl = page.url()
      expect(mapUrl).toMatch(/lat=.*lng=.*z=/)

      const name =
        (await page.getByTestId("map-selection-name").textContent())?.trim() ??
        ""
      await selection.click()
      await expect(page.getByRole("heading", { level: 1, name })).toBeVisible()

      await page.goBack()
      await expect(page).toHaveURL(mapUrl)
      await expect(markers(page).first()).toBeVisible()
    })
  })
}

test("search filters by name, survives reload, and has a way out when empty", async ({
  page,
}) => {
  await page.goto("/places")
  const search = page.getByRole("searchbox", { name: "Search places" })

  await search.fill("post office")
  await expect(cards(page)).toHaveCount(1)
  await expect(page).toHaveURL(/q=post/)
  await page.reload()
  await expect(cards(page)).toHaveCount(1)
  await expect(search).toHaveValue("post office")

  await search.fill("zzzz")
  await expect(page.getByTestId("places-empty")).toContainText("zzzz")
  await page.getByRole("button", { name: "Show all places" }).click()
  await expect(cards(page)).toHaveCount(posts.length)
  await expect(search).toBeFocused()
})

test("photos and map are real history entries and keep the filter", async ({
  page,
}) => {
  await page.goto("/places?q=mission")
  await expect(cards(page)).toHaveCount(3)

  await page.getByRole("button", { name: "Map" }).click()
  await expect(page).toHaveURL(/view=map/)
  await expect(page).toHaveURL(/q=mission/)
  await expect(markers(page).first()).toBeVisible()

  await page.goBack()
  await expect(cards(page)).toHaveCount(3)
})

test("the map says so when its base map fails, and places stay reachable", async ({
  page,
}) => {
  await page.route("**/tiles.openfreemap.org/**", (route) => route.abort())
  await page.goto("/places?view=map")

  await expect(page.getByTestId("map-failure")).toBeVisible()
  await expect(markers(page).first()).toBeVisible()
  await page
    .getByTestId("map-failure")
    .getByRole("button", { name: "browse the photos" })
    .click()
  await expect(cards(page)).toHaveCount(posts.length)
})

test("the map says so when its own code can't be fetched, and places stay reachable", async ({
  page,
}) => {
  await withoutMapCode(page)
  await page.goto("/places?view=map")

  await expect(page.getByTestId("map-failure")).toBeVisible()
  await page
    .getByTestId("map-failure")
    .getByRole("button", { name: "browse the photos" })
    .click()
  await expect(cards(page)).toHaveCount(posts.length)
})

const MILL_HOUSE_ON_MAP =
  "/places?view=map&lat=-36.7903&lng=174.6536&z=13&story=mill-house"

for (const viewport of [{ width: 390, height: 844 }]) {
  test(`at ${viewport.width}px a list row chooses its place on the map, and the card leads to the story`, async ({
    page,
  }) => {
    // On a slower phone the map's last moveend can arrive after the story link was tapped.
    // Keep navigation pending long enough to catch a map URL update cancelling it.
    if (viewport.width === 390) {
      const cdp = await page.context().newCDPSession(page)
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 })
      await page.route("**/mission-house?*", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1500))
        await route.continue()
      })
    }
    await page.setViewportSize(viewport)
    await page.goto("/places?view=map")
    await expect(markers(page).first()).toBeVisible()
    await page
      .getByTestId("map-list-item")
      .filter({ hasText: "Mission House" })
      .click()
    await expect(page).toHaveURL(/\/places\?.*story=mission-house/)
    await expect(page.locator(".tn-map-marker.is-active")).toHaveCount(1)
    const selection = page.getByTestId("map-selection")
    await expect(selection).toBeInViewport()
    await expect(page.locator(".tn-map-marker.is-active")).toBeInViewport()
    // The page glides back up to the map first; a tap lands once it has settled.
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
    await selection.click()
    await expect(
      page.getByRole("heading", { level: 1, name: "Mission House, Auckland" })
    ).toBeVisible()
  })
}

test("changing the filter frames what was found, not the old camera", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(MILL_HOUSE_ON_MAP)
  await expect(page).toHaveURL(/z=13/)
  await page.getByRole("button", { name: "Photos" }).click()
  await page.getByRole("combobox", { name: "Area" }).selectOption("Helensville")
  await expect(page).not.toHaveURL(/lat=/)
  await page.getByRole("button", { name: "Map" }).click()

  // expect.poll fails at once on a thrown error, so a map not drawn yet must read as "not yet".
  await expect
    .poll(() =>
      page.evaluate(() => {
        const stage = document.querySelector('[data-testid="home-map"]')
        if (!stage) return false
        const map = stage.getBoundingClientRect()
        return Array.from(
          document.querySelectorAll('[data-testid="home-map-marker"]')
        ).some((marker) => {
          const box = marker.getBoundingClientRect()
          return (
            box.left >= map.left &&
            box.right <= map.right &&
            box.top >= map.top &&
            box.bottom <= map.bottom
          )
        })
      })
    )
    .toBe(true)
})

test.describe("the chosen place on a phone's map list", () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test("otherwise leads the list, first to the keyboard as well as the eye", async ({
    page,
  }) => {
    await page.goto("/places?view=map")
    await expect(markers(page).first()).toBeVisible()
    await page.getByTestId("map-list-item").last().click()
    const selection = page.getByTestId("map-selection")
    await expect(
      page.getByTestId("map-list-item").first().getByTestId("map-selection")
    ).toBeVisible()
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
    await expect(selection).toBeInViewport()

    await selection.focus()
    await page.keyboard.press("Tab")
    const next = page.getByTestId("map-list-item").nth(1).getByRole("button")
    await expect(next).toBeFocused()
  })
})

test.describe("a place whose modern photograph is pending", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } })

  for (const entry of pendingEntries.slice(0, 1)) {
    test(`${entry.slug} offers its archive, camera and optional contribution demo`, async ({
      page,
    }) => {
      const response = await page.goto(`/${entry.slug}`)
      expect(response?.status()).toBe(200)
      await expect(
        page.getByRole("heading", { level: 1, name: entry.name })
      ).toBeVisible()
      await expect(page.getByTestId("pending-date")).toHaveText(
        entry.archive.date
      )
      await expect(page.getByTestId("pending-camera")).toHaveText("Take it now")
      // This journey owns discovery and real media playback: a broken asset or
      // modal focus trap would leave contributors without the demonstration.
      const help = page.getByRole("button", { name: "Watch how to contribute" })
      await help.click()
      const demo = page.getByRole("dialog", { name: "How to contribute" })
      await expect(demo).toBeVisible()
      const video = demo.locator("video")
      await expect
        .poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState))
        .toBeGreaterThanOrEqual(2)
      expect(await video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true)
      await video.evaluate((v: HTMLVideoElement) => v.play())
      await expect
        .poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime))
        .toBeGreaterThan(0)
      await page.keyboard.press("Escape")
      await expect(demo).not.toBeVisible()
      await expect(help).toBeFocused()
      await expect(video).toHaveCount(0)
      await help.click()
      await page.getByRole("button", { name: "Close video" }).click()
      await expect(help).toBeFocused()
      // The camera button says what is missing; no status label repeats it.
      await expect(page.getByText("Upcoming", { exact: true })).toHaveCount(0)
      await expect(page.getByTestId("pending-photograph")).toHaveAttribute(
        "src",
        new RegExp(encodeURIComponent(entry.b_imageUrl))
      )

      await expect(page.getByTestId("compare-stage")).toHaveCount(0)
      await expect(page.getByTestId("compare-slider-input")).toHaveCount(0)
      await expect(page.getByRole("slider")).toHaveCount(0)
      await expect(page.locator('img[alt$=", now"]')).toHaveCount(0)

      await expect(
        page.getByRole("link", { name: "View the record" })
      ).toHaveAttribute("href", entry.archive.sourceUrl)
      await expect(
        page.getByText(entry.archive.credit, { exact: false })
      ).toBeVisible()
    })
  }

  test("on the map it is its own kind of pin, chosen once, leading to its page", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto("/places?view=map")
    await expect(markers(page).first()).toBeVisible()
    const entry = pendingEntries[0]
    await page
      .getByTestId("map-list-item")
      .filter({ hasText: entry.name })
      .click()
    const active = page.locator(".tn-map-marker.is-active")
    await expect(active).toHaveAttribute(
      "aria-label",
      `${entry.name}, then only`
    )
    await expect(page.getByTestId("map-selection")).toContainText("Open")
    await expect(page.getByText(entry.name)).toHaveCount(1)
    await page.getByTestId("map-selection").click()
    await expect(page.getByTestId("pending-camera")).toBeVisible()
  })
})
