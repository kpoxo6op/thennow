import { readdirSync, readFileSync } from "fs"
import path from "path"
import { expect, test, type CDPSession, type Page } from "@playwright/test"

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

for (const viewport of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test.describe(`on ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

    test("/places lists every story without overflow", async ({ page }) => {
      await page.goto("/places")
      await expect(cards(page)).toHaveCount(posts.length)

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      )
      expect(overflow).toBeLessThanOrEqual(0)
    })

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

// The homepage search box is gone: its stories are already on screen. An address with a search still works.
test("an address with a search arrives filtered", async ({ page }) => {
  await page.goto("/places?q=mission")
  await expect(
    page.getByRole("searchbox", { name: "Search places" })
  ).toHaveValue("mission")
  await expect(cards(page)).toHaveCount(3)
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
    expect(body, post.slug).toContain(
      post.name.replaceAll("&", "&amp;").replaceAll("'", "&#x27;")
    )
  }
})

test("the original stories keep their photographs and full text", async ({
  page,
}) => {
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
    // The placeholder for a story without words is never shown.
    for (const line of post.description
      .split("\n")
      .filter(
        (line: string) => line.trim() && line.trim() !== "Coming soon..."
      )) {
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

test("the photograph itself drags, and a click sets the line", async ({
  page,
}) => {
  await page.goto("/historic-post-office?p=30")
  await expect(page.getByTestId("compare-slider-input")).toHaveValue("30")

  const box = (await page.getByTestId("compare-stage").boundingBox())!
  const y = box.y + box.height / 2

  await page.mouse.move(box.x + box.width * 0.3, y)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.7, y, { steps: 6 })
  await page.mouse.up()
  const dragged = Number(
    await page.getByTestId("compare-slider-input").inputValue()
  )
  expect(dragged).toBeGreaterThan(60)
  await expect(page).toHaveURL(new RegExp(`p=${dragged}$`))

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

  async function swipe(
    cdp: CDPSession,
    x0: number,
    y0: number,
    x1: number,
    y1: number
  ) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: x0, y: y0 }],
    })
    for (let i = 1; i <= 8; i += 1) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          { x: x0 + ((x1 - x0) * i) / 8, y: y0 + ((y1 - y0) * i) / 8 },
        ],
      })
    }
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    })
  }

  test("a sideways swipe moves the line and a vertical one scrolls the page", async ({
    page,
    context,
  }) => {
    await page.goto("/mill-house")
    const cdp = await context.newCDPSession(page)
    const input = page.getByTestId("compare-slider-input")
    await expect(input).toHaveValue("50")
    const box = (await page.getByTestId("compare-stage").boundingBox())!
    const y = box.y + box.height / 2

    await swipe(cdp, 200, y, 320, y)
    await expect
      .poll(async () => Number(await input.inputValue()))
      .toBeGreaterThan(70)

    const before = await input.inputValue()
    await swipe(cdp, 300, y + 40, 300, y - 120)
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(20)
    expect(await input.inputValue()).toBe(before)
  })
})

test.describe("the homepage comparison", () => {
  test("shows how it works once, and stops as soon as it is touched", async ({
    page,
  }) => {
    await page.goto("/")
    const input = page.getByTestId("compare-slider-input")
    await expect
      .poll(async () => Number(await input.inputValue()), { timeout: 5000 })
      .not.toBe(50)

    const box = (await page.getByTestId("compare-stage").boundingBox())!
    await page.mouse.click(box.x + box.width * 0.2, box.y + box.height / 2)
    const placed = await input.inputValue()
    await page.waitForTimeout(1200)
    expect(await input.inputValue()).toBe(placed)
  })

  test.describe("with reduced motion", () => {
    test.use({ contextOptions: { reducedMotion: "reduce" } })

    // The words moved off the photograph, so nothing has to step aside for it any more.
    test("the headline stays clear of the photograph through a drag, and the hint goes", async ({
      page,
    }) => {
      await page.goto("/")
      const stage = page.getByTestId("compare-stage")
      const box = (await stage.boundingBox())!
      const headline = (await page
        .getByRole("heading", { level: 1 })
        .boundingBox())!
      const y = box.y + box.height / 2
      expect(headline.y).toBeGreaterThanOrEqual(box.y + box.height)
      await expect(page.getByTestId("hero-drag-hint")).toBeVisible()

      await page.mouse.move(box.x + box.width / 2, y)
      await page.mouse.down()
      await page.mouse.move(box.x + box.width * 0.8, y, { steps: 6 })
      await page.mouse.up()
      await expect(page.getByTestId("hero-drag-hint")).toHaveCount(0)
      await expect(page.getByRole("heading", { level: 1 })).toBeInViewport()
    })

    test("stays still until asked", async ({ page }) => {
      await page.goto("/")
      await page.waitForTimeout(2500)
      await expect(page.getByTestId("compare-slider-input")).toHaveValue("50")
    })
  })
})

test("the navigation only offers pages with something on them", async ({
  page,
}) => {
  const header = page.getByTestId("site-header")
  await page.goto("/")
  await expect(header.locator("nav a")).toHaveText(["Places", "About"])

  await header.getByRole("link", { name: "About", exact: true }).click()
  await expect(
    page.getByRole("heading", { level: 1, name: "About" })
  ).toBeVisible()
  await expect(page.getByText("Coming soon...")).toHaveCount(0)

  await header.getByRole("link", { name: "Places", exact: true }).click()
  await expect(cards(page)).toHaveCount(posts.length)

  await page.goto("/no-such-story")
  await expect(
    page.getByRole("heading", { level: 1, name: "Not found" })
  ).toBeVisible()
  await page.getByRole("link", { name: "Explore the places" }).click()
  await expect(cards(page)).toHaveCount(posts.length)
})

test("the old Contact and Links addresses still lead somewhere useful", async ({
  page,
}) => {
  await page.goto("/contact")
  await expect(page).toHaveURL(/\/about$/)
  await expect(
    page.getByRole("heading", { level: 1, name: "About" })
  ).toBeVisible()

  await page.goto("/links")
  await expect(page).toHaveURL(/\/about#sources$/)
  await expect(
    page.getByRole("heading", { level: 2, name: "Sources" })
  ).toBeInViewport()
})

test("About lists the story sources that exist in the content", async ({
  page,
}) => {
  await page.goto("/about")
  const sources = page.locator("#sources")
  await expect(
    sources.getByRole("link", { name: "helensvillemuseum.org.nz" })
  ).toHaveAttribute("href", "https://helensvillemuseum.org.nz")
  // Pending photographs' records are listed here too, so there is more than one Kura link now.
  await expect(
    sources.getByRole("link", { name: /kura\.aucklandlibraries/ }).first()
  ).toBeVisible()
  await sources.getByRole("link", { name: "Mill House, Auckland" }).click()
  await expect(
    page.getByRole("heading", { level: 1, name: "Mill House, Auckland" })
  ).toBeVisible()
})

test("every public page hangs in one room, under one wordmark", async ({
  page,
}) => {
  const identity = () =>
    page.evaluate(() => {
      const logo = document.querySelector(
        '[data-testid="site-header"] a[href="/"]'
      )!
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

  for (const path of [
    "/places",
    "/places?view=map",
    "/about",
    "/mill-house",
    "/no-such-story",
  ]) {
    await page.goto(path)
    expect(await identity(), path).toEqual(home)
  }
})

// The places are on the homepage itself, so nothing there points at a second copy of them.
test("the homepage has no button to its own list, and the map is in Places", async ({
  page,
}) => {
  await page.goto("/")
  const main = page.locator("main")
  await expect(main.getByRole("link", { name: /explore|map/i })).toHaveCount(0)
  await expect(main.getByRole("heading", { level: 2 })).toHaveText([
    "Yours to photograph.",
  ])
  await expect(main.getByText(/upcoming/i)).toHaveCount(0)

  await page
    .getByTestId("site-header")
    .getByRole("link", { name: "Places", exact: true })
    .click()
  await expect(cards(page)).toHaveCount(posts.length)
  await page.getByRole("button", { name: "Map" }).click()
  await expect(page).toHaveURL(/view=map/)
  await expect(markers(page).first()).toBeVisible()
})

const MILL_HOUSE_ON_MAP =
  "/places?view=map&lat=-36.7903&lng=174.6536&z=13&story=mill-house"

// The story's own map replaced its link here, so this starts from the address that link used to carry.
test("an address naming a place arrives with it chosen, once, and every story still listed", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(MILL_HOUSE_ON_MAP)
  const selection = page.getByTestId("map-selection")
  await expect(selection).toContainText("Mill House")
  await expect(page.locator(".tn-map-marker.is-active")).toHaveCount(1)
  await expect(page.getByTestId("map-list-item")).toHaveCount(entries.length)
  await expect(page.getByText("Mill House, Auckland")).toHaveCount(1)

  await page.keyboard.press("Escape")
  await expect(selection).toHaveCount(0)
  await expect(page).not.toHaveURL(/story=/)
})

test("search and the view switch stay put between photos and map", async ({
  page,
}) => {
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
    await expect(page.getByTestId("places-count")).toBeAttached()
  }
})

test("About's large pair is a real comparison, with its own years", async ({
  page,
}) => {
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
    await expect(
      page.locator(`main a[href="/${post.slug}"]`).first()
    ).toBeAttached()
  }
})

test("a place chosen on the map is still chosen after visiting its story", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(MILL_HOUSE_ON_MAP)
  const selection = page.getByTestId("map-selection")
  await selection.click()
  await expect(
    page.getByRole("heading", { level: 1, name: "Mill House, Auckland" })
  ).toBeVisible()
  await page.goBack()
  await expect(selection).toContainText("Mill House")
})

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`at ${viewport.width}px a list row chooses its place on the map, and the card leads to the story`, async ({
    page,
  }) => {
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

  await expect
    .poll(() =>
      page.evaluate(() => {
        const map = document
          .querySelector('[data-testid="home-map"]')!
          .getBoundingClientRect()
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

test("a map that has moved in offers the way back to every place", async ({
  page,
}) => {
  await page.goto("/places?view=map")
  await expect(markers(page).first()).toBeVisible()
  const back = page.getByTestId("map-show-all")
  await expect(back).toHaveCount(0)

  await page
    .getByTestId("map-list-item")
    .filter({ hasText: "Mill House" })
    .click()
  await expect(back).toBeVisible()
  await back.click()
  await expect(back).toHaveCount(0)
  await expect(page.getByTestId("map-selection")).toHaveCount(0)
})

test("the phone map has real height and draws", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/places?view=map")
  await expect(markers(page).first()).toBeInViewport()
  const canvas = (await page.locator(".maplibregl-canvas").boundingBox())!
  expect(canvas.height).toBeGreaterThan(350)
  expect(canvas.width).toBeGreaterThan(380)
})

test("choosing any story shows its own pin, from the list and from an address", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const active = page.locator(".tn-map-marker.is-active")

  for (const post of posts) {
    await page.goto("/places?view=map")
    await expect(markers(page).first()).toBeVisible()
    await page
      .getByTestId("map-list-item")
      .filter({ hasText: post.name })
      .click()
    await expect(active, post.slug).toHaveAttribute("data-count", "1")
    await expect(active, post.slug).toHaveAttribute("aria-label", post.name)

    await page.goto(
      `/places?view=map&lat=${post.location.lat}&lng=${post.location.lng}&z=13&story=${post.slug}`
    )
    await expect(active, post.slug).toHaveAttribute("data-count", "1")
    await expect(active, post.slug).toHaveAttribute("aria-label", post.name)
  }
})

test.describe("the chosen place on a phone's map list", () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test("the keyboard meets the map before the list, as the eye does", async ({
    page,
  }) => {
    await page.goto("/places?view=map")
    await expect(markers(page).first()).toBeVisible()
    const mapFirst = await page.evaluate(() => {
      const map = document.querySelector('[data-testid="home-map"]')!
      const row = document.querySelector('[data-testid="map-list-item"]')!
      return Boolean(
        map.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING
      )
    })
    expect(mapFirst).toBe(true)
  })

  test("stays under the finger when it is already in view", async ({
    page,
  }) => {
    await page.goto("/places?view=map")
    await expect(markers(page).first()).toBeVisible()
    const row = page.getByTestId("map-list-item").nth(1)
    const name = (await row.innerText()).trim()
    const before = (await row.boundingBox())!
    await row.click()
    await expect(page.getByTestId("map-selection")).toContainText(name)
    const after = (await page
      .getByTestId("map-list-item")
      .nth(1)
      .boundingBox())!
    expect(after.y).toBeCloseTo(before.y, 0)
    await expect(page.getByTestId("map-list-item").nth(1)).toContainText(name)
  })

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

  test("there are between three and five, and each is backed by an archive record", () => {
    expect(pendingEntries.length).toBeGreaterThanOrEqual(3)
    expect(pendingEntries.length).toBeLessThanOrEqual(5)
    for (const entry of pendingEntries) {
      expect(entry.status, entry.slug).toBe("pending")
      expect(entry.ba_imageUrl, entry.slug).toBeUndefined()
      expect(entry.archive.sourceUrl, entry.slug).toMatch(
        /^https:\/\/kura\.aucklandlibraries\.govt\.nz\//
      )
      expect(entry.archive.credit, entry.slug).toContain(entry.archive.sourceId)
    }
  })

  for (const entry of pendingEntries) {
    test(`${entry.slug} offers no comparison, only its date and the camera`, async ({
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

  test("is listed apart under one heading, with no status label, and never served as a finished story", async ({
    page,
    request,
  }) => {
    await page.goto("/places")
    await expect(cards(page)).toHaveCount(posts.length)
    await expect(page.getByTestId("places-count")).toHaveText(
      `${posts.length + pendingEntries.length} places`
    )
    await expect(
      page.getByTestId("places-pending").getByRole("heading")
    ).toHaveText("Yours to photograph.")
    await expect(page.getByText(/upcoming/i)).toHaveCount(0)
    const pendingCards = page
      .getByTestId("places-pending")
      .getByTestId("pending-card")
    await expect(pendingCards).toHaveCount(pendingEntries.length)
    await pendingCards.first().click()
    await expect(page.getByTestId("pending-camera")).toBeVisible()

    const feed = await (await request.get("/feed.xml")).text()
    for (const entry of pendingEntries) {
      expect(feed, entry.slug).not.toContain(entry.slug)
    }
  })

  test("search finds them by name, and an area shows both kinds", async ({
    page,
  }) => {
    await page.goto(`/places?q=${encodeURIComponent(pendingEntries[0].name)}`)
    await expect(cards(page)).toHaveCount(0)
    await expect(page.getByTestId("pending-card")).toHaveCount(1)
    await expect(page.getByTestId("places-count")).toHaveText("1 place")

    await page.goto("/places?area=Auckland")
    await expect(page.getByTestId("pending-card")).toHaveCount(
      pendingEntries.length
    )
    await expect(page.getByRole("combobox", { name: "Area" })).toHaveValue(
      "Auckland"
    )
  })

  test("on a laptop-sized window, the chosen row comes into the list's view", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 760 })
    for (const entry of pendingEntries) {
      await page.goto(
        `/places?view=map&lat=${entry.location.lat}&lng=${entry.location.lng}&z=14&story=${entry.slug}`
      )
      await expect(page.getByTestId("map-selection")).toBeInViewport({
        ratio: 1,
      })
    }
  })

  test("About says some places have only the older image, and lists their sources without a status label", async ({
    page,
  }) => {
    await page.goto("/about")
    await expect(
      page.getByText(/Some places have only the older image/)
    ).toBeVisible()
    await expect(page.getByText(/upcoming/i)).toHaveCount(0)
    for (const entry of pendingEntries) {
      await expect(
        page.locator("#sources").getByRole("link", { name: entry.name })
      ).toBeVisible()
    }
  })

  test("its page lists every other place nearby, nearest first, under no heading", async ({
    page,
  }) => {
    const entry = pendingEntries[0]
    await page.goto(`/${entry.slug}`)
    const rows = page.getByTestId("nearby-list").getByRole("link")
    await expect(rows).toHaveCount(6)
    const distances = (
      await rows.locator("span:last-child").allInnerTexts()
    ).map((text) => (text.startsWith("Under") ? 0 : Number.parseFloat(text)))
    expect(distances).toEqual([...distances].sort((a, b) => a - b))
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(0)
    await expect(page.getByRole("heading", { level: 3 })).toHaveCount(0)
  })

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
