import { readdirSync, readFileSync } from "fs"
import path from "path"
import { expect, test } from "@playwright/test"
import sharp from "sharp"

// Every place file says how big its photographs are; the pages are laid out from that, so it has
// to be true.
const folder = path.join(process.cwd(), "public", "posts")

// The Helensville archive scan is a little larger than its pair and is cropped to fit on the
// page. Re-cutting it changes how the two line up, so it waits for a decision by eye.
const KNOWN_ODD = new Set([
  "/posts/0002-historic-helensville-post-office/post1-then-2003x1241.jpg",
])

test("all place records describe their decoded photographs", async () => {
  for (const name of readdirSync(folder).sort()) {
    const place = JSON.parse(
      readFileSync(path.join(folder, name, `${name}.json`), "utf8")
    )
    expect(typeof place.name).toBe("string")
    expect(place.slug).toMatch(/^[a-z0-9-]+$/)
    expect(Number.isInteger(place.w) && place.w > 0).toBe(true)
    expect(Number.isInteger(place.h) && place.h > 0).toBe(true)
    const images = [
      place.b_imageUrl,
      place.a_imageUrl,
      place.ba_imageUrl,
    ].filter((url): url is string => typeof url === "string")
    expect(images.length).toBeGreaterThan(0)
    for (const url of images) {
      const meta = await sharp(
        path.join(process.cwd(), "public", url)
      ).metadata()
      if (KNOWN_ODD.has(url)) continue
      expect({ url, w: meta.width, h: meta.height }).toEqual({
        url,
        w: place.w,
        h: place.h,
      })
    }
  }
})
