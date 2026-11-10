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
  for (const entry of entries) {
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

  test("the homepage and the pages without a photograph of their own are sent with the homepage's pair", async ({
    page,
  }) => {
    const images: string[] = []
    for (const address of ["/", "/places", "/about"]) {
      await page.goto(address)
      images.push(
        (await page
          .locator('meta[property="og:image"]')
          .getAttribute("content"))!
      )
    }
    expect(images[0]).toContain("/_next/image?url=")
    expect(new Set(images).size).toBe(1)
    await page.goto("/")
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      SITE
    )
  })
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
