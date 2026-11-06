import { readdirSync, readFileSync } from "fs"
import path from "path"

import { expect, test, type CDPSession, type Page } from "@playwright/test"

const postsDir = path.join(process.cwd(), "public", "posts")
const posts = readdirSync(postsDir).map((folder) => ({
  folder,
  ...JSON.parse(readFileSync(path.join(postsDir, folder, `${folder}.json`), "utf8")),
}))

const cards = (page: Page) => page.getByTestId("story-card")
const markers = (page: Page) => page.getByTestId("home-map-marker")

async function clickMarkerInsideMap(page: Page, preferCluster = false) {
  return page.evaluate((preferCluster) => {
    const stage = document.querySelector('[data-testid="home-map"]')!.getBoundingClientRect()
    const inside = Array.from(
      document.querySelectorAll<HTMLElement>('[data-testid="home-map-marker"]')
    ).filter((marker) => {
      const box = marker.getBoundingClientRect()
      return box.left > stage.left && box.right < stage.right - 50 && box.top > stage.top && box.bottom < stage.bottom
    })
    const marker =
      inside.find((candidate) => (candidate.dataset.count === "1") !== preferCluster) ?? inside[0]
    marker?.click()
    return marker?.dataset.count ?? null
  }, preferCluster)
}

for (const viewport of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test.describe(`on ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

    test("/places lists every story without overflow", async ({ page }) => {
      await page.goto("/places")
      await expect(cards(page)).toHaveCount(posts.length)

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow).toBeLessThanOrEqual(0)
    })

    test("the last card opens at the top and Places returns to the same place", async ({ page }) => {
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

      await page.getByTestId("site-header").getByRole("link", { name: "Places" }).click()
      await expect(cards(page)).toHaveCount(posts.length)
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scrollBefore - 60)
    })

    test("map clusters lead to a selected place, its story, and back to the same map", async ({ page }) => {
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

      const name = (await selection.getByRole("link").textContent())?.trim() ?? ""
      await selection.getByRole("link").click()
      await expect(page.getByRole("heading", { level: 1, name })).toBeVisible()

      await page.goBack()
      await expect(page).toHaveURL(mapUrl)
      await expect(markers(page).first()).toBeVisible()
    })
  })
}

test("search filters by name, survives reload, and has a way out when empty", async ({ page }) => {
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

// The homepage search box is gone: its stories are already on screen. An address with a search still works.
test("an address with a search arrives filtered", async ({ page }) => {
  await page.goto("/places?q=mission")
  await expect(page.getByRole("searchbox", { name: "Search places" })).toHaveValue("mission")
  await expect(cards(page)).toHaveCount(3)
})

test("photos and map are real history entries and keep the filter", async ({ page }) => {
  await page.goto("/places?q=mission")
  await expect(cards(page)).toHaveCount(3)

  await page.getByRole("button", { name: "Map" }).click()
  await expect(page).toHaveURL(/view=map/)
  await expect(page).toHaveURL(/q=mission/)
  await expect(markers(page).first()).toBeVisible()

  await page.goBack()
  await expect(cards(page)).toHaveCount(3)
})

test("the map says so when its base map fails, and places stay reachable", async ({ page }) => {
  await page.route("**/tiles.openfreemap.org/**", (route) => route.abort())
  await page.goto("/places?view=map")

  await expect(page.getByTestId("map-failure")).toBeVisible()
  await expect(markers(page).first()).toBeVisible()
  await page.getByTestId("map-failure").getByRole("button", { name: "browse the photos" }).click()
  await expect(cards(page)).toHaveCount(posts.length)
})

test("the collection is in the first server response", async ({ request }) => {
  const html = await (await request.get("/places")).text()

  for (const post of posts) {
    expect(html, post.slug).toContain(`href="/${post.slug}"`)
  }
})

test("every story route resolves with its own title", async ({ request }) => {
  expect(posts.length).toBe(6)

  for (const post of posts) {
    const response = await request.get(`/${post.slug}`)
    expect(response.status(), post.slug).toBe(200)
    const body = await response.text()
    expect(body, post.slug).toContain("compare-slider-input")
    expect(body, post.slug).toContain(post.name.replaceAll("&", "&amp;").replaceAll("'", "&#x27;"))
  }
})

test("the original stories keep their photographs and full text", async ({ page }) => {
  for (const post of posts) {
    await page.goto(`/${post.slug}`)
    await expect(page.getByTestId("compare-overlay-image")).toHaveAttribute(
      "src",
      new RegExp(encodeURIComponent(post.b_imageUrl))
    )
    await expect(page.getByTestId("compare-base-image")).toHaveAttribute(
      "src",
      new RegExp(encodeURIComponent(post.a_imageUrl))
    )

    const article = await page.locator("article").innerText()
    for (const line of post.description.split("\n").filter(Boolean)) {
      expect(article, post.slug).toContain(line.trim())
    }
  }
})

test("no story is labelled as a sample place", async ({ page }) => {
  for (const post of posts) {
    await page.goto(`/${post.slug}`)
    await expect(page.getByText("Sample place.")).toHaveCount(0)
  }
})

test("the photograph itself drags, and a click sets the line", async ({ page }) => {
  await page.goto("/historic-post-office?p=30")
  await expect(page.getByTestId("compare-slider-input")).toHaveValue("30")

  const box = (await page.getByTestId("compare-stage").boundingBox())!
  const y = box.y + box.height / 2

  await page.mouse.move(box.x + box.width * 0.3, y)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.7, y, { steps: 6 })
  await page.mouse.up()
  const dragged = Number(await page.getByTestId("compare-slider-input").inputValue())
  expect(dragged).toBeGreaterThan(60)
  expect(page.url()).toContain(`p=${dragged}`)

  await page.mouse.click(box.x + box.width * 0.5, y)
  await expect(page.getByTestId("compare-slider-input")).toHaveValue("50")
  await expect(page).toHaveURL(/historic-post-office$/)
})

test("the comparison follows the keyboard", async ({ page }) => {
  await page.goto("/historic-post-office")
  const input = page.getByTestId("compare-slider-input")
  await input.focus()
  await page.keyboard.press("ArrowRight")
  await expect(input).toHaveValue("51")
  await expect(page).toHaveURL(/\?p=51$/)
  await page.keyboard.press("End")
  await expect(input).toHaveValue("100")
  await page.keyboard.press("Home")
  await expect(input).toHaveValue("0")
})

test.describe("touch", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } })

  async function swipe(cdp: CDPSession, x0: number, y0: number, x1: number, y1: number) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y: y0 }] })
    for (let i = 1; i <= 8; i += 1) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: x0 + ((x1 - x0) * i) / 8, y: y0 + ((y1 - y0) * i) / 8 }],
      })
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
  }

  test("a sideways swipe moves the line and a vertical one scrolls the page", async ({ page, context }) => {
    await page.goto("/mill-house")
    const cdp = await context.newCDPSession(page)
    const input = page.getByTestId("compare-slider-input")
    await expect(input).toHaveValue("50")
    const box = (await page.getByTestId("compare-stage").boundingBox())!
    const y = box.y + box.height / 2

    await swipe(cdp, 200, y, 320, y)
    await expect.poll(async () => Number(await input.inputValue())).toBeGreaterThan(70)

    const before = await input.inputValue()
    await swipe(cdp, 300, y + 40, 300, y - 120)
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(20)
    expect(await input.inputValue()).toBe(before)
  })
})

test.describe("the homepage comparison", () => {
  test("shows how it works once, and stops as soon as it is touched", async ({ page }) => {
    await page.goto("/")
    const input = page.getByTestId("compare-slider-input")
    await expect.poll(async () => Number(await input.inputValue()), { timeout: 5000 }).not.toBe(50)

    const box = (await page.getByTestId("compare-stage").boundingBox())!
    await page.mouse.click(box.x + box.width * 0.2, box.y + box.height / 2)
    const placed = await input.inputValue()
    await page.waitForTimeout(1200)
    expect(await input.inputValue()).toBe(placed)
  })

  test.describe("with reduced motion", () => {
    test.use({ contextOptions: { reducedMotion: "reduce" } })

    // The words moved off the photograph, so nothing has to step aside for it any more.
    test("the headline and the way onward stay clear of the photograph through a drag", async ({ page }) => {
      await page.goto("/")
      const stage = page.getByTestId("compare-stage")
      const box = (await stage.boundingBox())!
      const headline = (await page.getByRole("heading", { level: 1 }).boundingBox())!
      const explore = page.getByRole("link", { name: "Explore the places" })
      const y = box.y + box.height / 2
      expect(headline.y).toBeGreaterThanOrEqual(box.y + box.height)
      await expect(page.getByTestId("hero-drag-hint")).toBeVisible()

      await page.mouse.move(box.x + box.width / 2, y)
      await page.mouse.down()
      await page.mouse.move(box.x + box.width * 0.8, y, { steps: 6 })
      await page.mouse.up()
      await expect(page.getByTestId("hero-drag-hint")).toHaveCount(0)
      await expect(explore).toBeInViewport()
      await explore.click()
      await expect(page).toHaveURL(/\/places$/)
    })

    test("stays still until asked", async ({ page }) => {
      await page.goto("/")
      await page.waitForTimeout(2500)
      await expect(page.getByTestId("compare-slider-input")).toHaveValue("50")
    })
  })
})

test("the navigation only offers pages with something on them", async ({ page }) => {
  const header = page.getByTestId("site-header")
  await page.goto("/")
  await expect(header.locator("nav a")).toHaveText(["Places", "About"])

  await header.getByRole("link", { name: "About", exact: true }).click()
  await expect(page.getByRole("heading", { level: 1, name: "About" })).toBeVisible()
  await expect(page.getByText("Coming soon...")).toHaveCount(0)

  await header.getByRole("link", { name: "Places", exact: true }).click()
  await expect(cards(page)).toHaveCount(posts.length)

  await page.goto("/no-such-story")
  await expect(page.getByRole("heading", { level: 1, name: "Not found" })).toBeVisible()
  await page.getByRole("link", { name: "Explore the places" }).click()
  await expect(cards(page)).toHaveCount(posts.length)
})

test("the old Contact and Links addresses still lead somewhere useful", async ({ page }) => {
  await page.goto("/contact")
  await expect(page).toHaveURL(/\/about$/)
  await expect(page.getByRole("heading", { level: 1, name: "About" })).toBeVisible()

  await page.goto("/links")
  await expect(page).toHaveURL(/\/about#sources$/)
  await expect(page.getByRole("heading", { level: 2, name: "Sources" })).toBeInViewport()
})

test("About lists the story sources that exist in the content", async ({ page }) => {
  await page.goto("/about")
  const sources = page.locator("#sources")
  await expect(sources.getByRole("link", { name: "helensvillemuseum.org.nz" })).toHaveAttribute(
    "href",
    "https://helensvillemuseum.org.nz"
  )
  await expect(sources.getByRole("link", { name: /kura\.aucklandlibraries/ })).toBeVisible()
  await sources.getByRole("link", { name: "Mill House, Auckland" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Mill House, Auckland" })).toBeVisible()
})

test("every public page hangs in one room, under one wordmark", async ({ page }) => {
  const identity = () =>
    page.evaluate(() => {
      const logo = document.querySelector('[data-testid="site-header"] a[href="/"]')!
      const stroke = logo.querySelector("span")!
      return {
        ground: getComputedStyle(document.body).backgroundColor,
        logoFont: getComputedStyle(logo).fontFamily,
        logoSize: getComputedStyle(logo).fontSize,
        stroke: getComputedStyle(stroke).backgroundColor,
      }
    })

  await page.goto("/")
  const home = await identity()

  for (const path of ["/places", "/places?view=map", "/about", "/mill-house", "/no-such-story"]) {
    await page.goto(path)
    expect(await identity(), path).toEqual(home)
  }
})

test("the homepage has one way onward, and the map is one choice further in", async ({ page }) => {
  await page.goto("/")
  const hero = page.locator("main section").first()
  await expect(hero.getByRole("link", { name: "Explore the places" })).toBeVisible()
  await expect(hero.getByRole("link", { name: /map/i })).toHaveCount(0)

  await hero.getByRole("link", { name: "Explore the places" }).click()
  await expect(cards(page)).toHaveCount(posts.length)
  await page.getByRole("button", { name: "Map" }).click()
  await expect(page).toHaveURL(/view=map/)
  await expect(markers(page).first()).toBeVisible()
})

test("a story's map link arrives with that story chosen, and every story still listed", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/mill-house")
  await page.getByRole("link", { name: "See it on the map" }).click()
  const selection = page.getByTestId("map-selection")
  await expect(selection).toContainText("Mill House")
  await expect(page.locator(".tn-map-marker.is-active")).toHaveCount(1)
  await expect(page.getByTestId("map-list-item")).toHaveCount(posts.length)

  await selection.getByRole("button", { name: "Close" }).click()
  await expect(selection).toHaveCount(0)
  await expect(page).not.toHaveURL(/story=/)
})

test("search and the view switch stay put between photos and map", async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 844 })
    await page.goto("/places")
    const search = page.getByRole("searchbox", { name: "Search places" })
    const map = page.getByRole("button", { name: "Map" })
    const before = [(await search.boundingBox())!, (await map.boundingBox())!]
    await map.click()
    await expect(page).toHaveURL(/view=map/)
    const after = [(await search.boundingBox())!, (await map.boundingBox())!]
    expect(after[0].y).toBeCloseTo(before[0].y, 0)
    expect(after[1].y).toBeCloseTo(before[1].y, 0)
    await expect(page.getByTestId("places-count")).toBeVisible()
  }
})

test("About's large pair is a real comparison, with its own years", async ({ page }) => {
  await page.goto("/about")
  const input = page.getByTestId("inline-slider-input")
  await input.focus()
  await page.keyboard.press("ArrowLeft")
  await expect(input).toHaveValue("49")
  await expect(page.getByText("1920", { exact: true })).toBeVisible()
  await expect(page.getByText("2023", { exact: true })).toBeVisible()
})

test("the homepage reaches every story", async ({ page }) => {
  await page.goto("/")
  await page.waitForLoadState("load")
  for (const post of posts) {
    await expect(page.locator(`main a[href="/${post.slug}"]`).first()).toBeAttached()
  }
})

test("a place chosen on the map is still chosen after visiting its story", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/mill-house")
  await page.getByRole("link", { name: "See it on the map" }).click()
  const selection = page.getByTestId("map-selection")
  await expect(page.getByTestId("map-list-item").filter({ hasText: "Mill House" })).toHaveAttribute("aria-pressed", "true")
  await selection.getByRole("link").click()
  await expect(page.getByRole("heading", { level: 1, name: "Mill House, Auckland" })).toBeVisible()
  await page.goBack()
  await expect(selection).toContainText("Mill House")
})

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`at ${viewport.width}px a list row chooses its place on the map, and the card leads to the story`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto("/places?view=map")
    await expect(markers(page).first()).toBeVisible()
    await page.getByTestId("map-list-item").filter({ hasText: "Mission House" }).click()
    await expect(page).toHaveURL(/\/places\?.*story=mission-house/)
    await expect(page.locator(".tn-map-marker.is-active")).toHaveCount(1)
    const selection = page.getByTestId("map-selection")
    await expect(selection).toBeInViewport()
    await selection.getByRole("link").click()
    await expect(page.getByRole("heading", { level: 1, name: "Mission House, Auckland" })).toBeVisible()
  })
}

test("the phone map has real height and draws", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/places?view=map")
  await expect(markers(page).first()).toBeInViewport()
  const canvas = (await page.locator(".maplibregl-canvas").boundingBox())!
  expect(canvas.height).toBeGreaterThan(400)
  expect(canvas.width).toBeGreaterThan(380)
})
