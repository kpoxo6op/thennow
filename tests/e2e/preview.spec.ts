import fs from "fs"
import path from "path"
import { expect, test } from "@playwright/test"

const postsDir = path.join(process.cwd(), "public", "posts")
const entries = fs
  .readdirSync(postsDir)
  .sort()
  .map((folder) =>
    JSON.parse(
      fs.readFileSync(path.join(postsDir, folder, `${folder}.json`), "utf8")
    )
  )
  .filter((entry) => entry._preview_fixture !== true)

const SITE = "https://thennow.nz"

test.describe("a link sent to someone", () => {
  // Story previews have their own photo. Only the homepage must choose the latest
  // published pair for both the shared link and the comparison a visitor opens.
  test("the homepage opens on its shared photograph and shows older pairs in order", async ({
    page,
  }) => {
    const [latest, ...older] = entries
      .filter((entry) => entry.status !== "pending" && entry.a_imageUrl)
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    await page.goto("/")
    await expect(
      page.getByRole("slider", { name: `Compare ${latest.name} then and now` })
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: latest.name, exact: true })
    ).toHaveAttribute("href", `/${latest.slug}`)
    const preview = await page
      .locator('meta[property="og:image"]')
      .getAttribute("content")
    expect(new URL(preview!).searchParams.get("url")).toBe(latest.ba_imageUrl)
    expect(
      await page
        .getByTestId("story-card")
        .evaluateAll((cards) => cards.map((card) => card.getAttribute("href")))
    ).toEqual(older.map((entry) => `/${entry.slug}`))
  })

  for (const entry of [
    entries.find((p) => p.a_imageUrl),
    entries.find((p) => !p.a_imageUrl),
  ]) {
    test(`${entry.slug} arrives with its own photograph, name and address`, async ({
      page,
      request,
    }) => {
      await page.goto(`/${entry.slug}`)
      const meta = (property: string) =>
        page.locator(`meta[property="${property}"]`)

      await expect(meta("og:title")).toHaveAttribute("content", entry.name)
      await expect(meta("og:url")).toHaveAttribute(
        "content",
        `${SITE}/${entry.slug}`
      )
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        `${SITE}/${entry.slug}`
      )
      await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
        "content",
        "summary_large_image"
      )

      // A finished story is sent as its pair; a place with one photograph as that photograph.
      const source = entry.ba_imageUrl ?? entry.b_imageUrl
      const image = (await meta("og:image").getAttribute("content"))!
      expect(
        image.startsWith(
          `${SITE}/_next/image?url=${encodeURIComponent(source)}&`
        )
      ).toBe(true)

      // The picture really is one, and small enough for a chat app to show.
      const response = await request.get(image.slice(SITE.length))
      expect(response.status()).toBe(200)
      expect(response.headers()["content-type"]).toMatch(/^image\//)
      expect((await response.body()).byteLength).toBeLessThan(600_000)
    })
  }
})

test("the sitemap lists every real place and public page, and nothing private", async ({
  request,
}) => {
  const sitemap = await (await request.get("/sitemap.xml")).text()
  const listed = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((match) => match[1])
    .sort()
  expect(listed).toEqual(
    [
      SITE,
      `${SITE}/places`,
      `${SITE}/about`,
      ...entries.map((entry) => `${SITE}/${entry.slug}`),
    ].sort()
  )

  const robots = await (await request.get("/robots.txt")).text()
  expect(robots).toContain(`Sitemap: ${SITE}/sitemap.xml`)
  expect(robots).toContain("Disallow: /me")
  expect(robots).toContain("Disallow: /api/")
})
