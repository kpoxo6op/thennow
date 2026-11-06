import { readdirSync, readFileSync } from "fs"
import path from "path"

import { expect, test, type Page } from "@playwright/test"

const postsDir = path.join(process.cwd(), "public", "posts")
const posts = readdirSync(postsDir).map((folder) => ({
  folder,
  ...JSON.parse(readFileSync(path.join(postsDir, folder, `${folder}.json`), "utf8")),
}))

const cards = (page: Page) => page.getByTestId("story-card")

for (const viewport of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test.describe(`collection on ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

    test("lists every story without loading every image or overflowing", async ({ page }) => {
      await page.goto("/")
      await expect(cards(page)).toHaveCount(posts.length)
      await expect(page.getByTestId("home-map-marker").first()).toBeVisible()

      const stats = await page.evaluate(() => ({
        lazy: document.querySelectorAll('[data-testid="story-card"] img[loading="lazy"]').length,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        markers: document.querySelectorAll('[data-testid="home-map-marker"]').length,
      }))

      expect(stats.lazy).toBeGreaterThan(posts.length - 10)
      expect(stats.overflow).toBeLessThanOrEqual(0)
      expect(stats.markers).toBeLessThan(40)
      await expect(page.getByText("This preview includes sample locations.")).toHaveCount(1)
    })

    test("a card deep in the list opens its story at the top and returns to the same place", async ({ page }) => {
      await page.goto("/")
      await expect(page.getByTestId("home-map-marker").first()).toBeVisible()

      const card = cards(page).nth(200)
      await card.scrollIntoViewIfNeeded()
      const name = (await card.textContent())?.trim() ?? ""
      const scrollBefore = await page.evaluate(() => window.scrollY)
      expect(scrollBefore).toBeGreaterThan(1000)

      await card.click()
      await expect(page.getByRole("heading", { level: 1, name })).toBeVisible()
      await expect(page.getByTestId("compare-slider-input")).toHaveValue("50")
      expect(await page.evaluate(() => window.scrollY)).toBe(0)
      expect(new URL(page.url()).pathname).not.toBe("/")

      await page.getByTestId("site-header").locator('a[href="/"]').click()
      await expect(cards(page)).toHaveCount(posts.length)
      await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .toBeGreaterThan(scrollBefore - 60)
    })

    test("map clusters narrow the list down to a story that can be opened", async ({ page }) => {
      await page.goto("/")
      await expect(page.getByTestId("home-map-marker").first()).toBeVisible()

      const clickMarker = () =>
        page.evaluate(() => {
          const stage = document.querySelector('[data-testid="home-map"]')!.getBoundingClientRect()
          const markers = Array.from(
            document.querySelectorAll<HTMLElement>('[data-testid="home-map-marker"]')
          ).filter((marker) => {
            const box = marker.getBoundingClientRect()
            return box.left > stage.left && box.right < stage.right && box.top > stage.top && box.bottom < stage.bottom
          })
          const marker = markers.find((candidate) => candidate.dataset.count === "1") ?? markers[0]
          marker?.click()
          return marker?.dataset.count ?? null
        })

      let count = await clickMarker()
      for (let step = 0; step < 10 && count !== "1"; step += 1) {
        await page.waitForTimeout(900)
        count = await clickMarker()
      }
      expect(count).toBe("1")
      expect(await cards(page).count()).toBeLessThan(posts.length)

      const story = page.locator(".tn-popup-story")
      await expect(story).toBeVisible()
      const name = (await story.textContent())?.trim() ?? ""
      await story.click()
      await expect(page.getByRole("heading", { level: 1, name })).toBeVisible()
    })
  })
}

test("the collection is in the first server response", async ({ request }) => {
  const html = await (await request.get("/")).text()

  for (const post of posts) {
    expect(html, post.slug).toContain(`href="/${post.slug}"`)
  }
})

test("every story route resolves with its own title", async ({ request }) => {
  test.setTimeout(180000)
  expect(posts.length).toBe(306)

  for (const post of posts) {
    const response = await request.get(`/${post.slug}`)
    expect(response.status(), post.slug).toBe(200)
    const body = await response.text()
    expect(body, post.slug).toContain("compare-slider-input")
    expect(body, post.slug).toContain(post.name.replaceAll("&", "&amp;").replaceAll("'", "&#x27;"))
  }
})

test("the original stories keep their photographs in the comparison", async ({ page }) => {
  for (const post of posts.filter((candidate) => !candidate.folder.startsWith("demo-"))) {
    await page.goto(`/${post.slug}`)
    await expect(page.getByTestId("compare-overlay-image")).toHaveAttribute(
      "src",
      new RegExp(encodeURIComponent(post.b_imageUrl))
    )
    await expect(page.getByTestId("compare-base-image")).toHaveAttribute(
      "src",
      new RegExp(encodeURIComponent(post.a_imageUrl))
    )
    await expect(page.getByTestId("compare-base-image")).toHaveJSProperty("complete", true)
  }
})

test("the photograph itself reveals on drag and hides the interface on tap", async ({ page }) => {
  await page.goto("/historic-post-office?p=30")
  await expect(page.getByTestId("compare-slider-input")).toHaveValue("30")

  const stage = page.getByTestId("compare-stage")
  const box = (await stage.boundingBox())!
  const y = box.y + box.height / 2

  await page.mouse.move(box.x + box.width * 0.3, y)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.5, y, { steps: 4 })
  await page.mouse.move(box.x + box.width * 0.7, y, { steps: 4 })
  await page.mouse.up()
  await expect(stage).toHaveAttribute("data-immersive", "false")
  const dragged = Number(await page.getByTestId("compare-slider-input").inputValue())
  expect(dragged).toBeGreaterThan(60)
  expect(page.url()).toContain(`p=${dragged}`)

  await page.mouse.click(box.x + box.width * 0.2, y)
  await expect(stage).toHaveAttribute("data-immersive", "true")
  expect(await page.getByTestId("compare-slider-input").inputValue()).toBe(String(dragged))

  await page.keyboard.press("Escape")
  await expect(stage).toHaveAttribute("data-immersive", "false")
})

test("the slider follows the keyboard", async ({ page }) => {
  await page.goto("/historic-post-office")
  await page.getByTestId("compare-slider-input").focus()
  await page.keyboard.press("ArrowRight")
  await expect(page.getByTestId("compare-slider-input")).toHaveValue("51")
  await expect(page).toHaveURL(/\?p=51$/)
})

test("navigation links all lead to real pages", async ({ page }) => {
  for (const title of ["About", "Contact", "Links"]) {
    await page.goto("/")
    await page.getByTestId("site-header").getByRole("link", { name: title, exact: true }).click()
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible()
  }
  await page.goto("/no-such-story")
  await expect(page.getByRole("heading", { level: 1, name: "Not found" })).toBeVisible()
})
