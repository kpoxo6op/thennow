import { readdirSync, readFileSync } from "fs"
import path from "path"
import { expect, test } from "@playwright/test"
import sharp from "sharp"

import { checkLines } from "@/lib/rephoto/line-check"
import { corroborated } from "@/lib/rephoto/line-feedback"
import { referenceLines } from "@/lib/rephoto/reference-lines"

// Every place file says how big its photographs are; the pages are laid out from that, so it has
// to be true.
const folder = path.join(process.cwd(), "public", "posts")

// The Helensville archive scan is a little larger than its pair and is cropped to fit on the
// page. Re-cutting it changes how the two line up, so it waits for a decision by eye.
const KNOWN_ODD = new Set([
  "/posts/0002-historic-helensville-post-office/post1-then-2003x1241.jpg",
])

test("place records describe their photographs and all camera routes have responsive landmark guides", async () => {
  for (const name of readdirSync(folder).sort()) {
    const place = JSON.parse(
      readFileSync(path.join(folder, name, `${name}.json`), "utf8")
    )
    expect(typeof place.name).toBe("string")
    expect(place.slug).toMatch(/^[a-z0-9-]+$/)
    expect(Number.isInteger(place.w) && place.w > 0).toBe(true)
    expect(Number.isInteger(place.h) && place.h > 0).toBe(true)
    if (!place.sample) {
      // Every camera needs landmarks drawn for the exact archive, including completed places.
      // The capture journey exercises the renderer on representative places only.
      const guide = referenceLines(place.slug, place.b_imageUrl)
      expect(guide, place.slug).toBeTruthy()
      if (!guide) throw new Error("Missing guide for " + place.slug)
      // A valid SVG can still hang motionless. Use the public source as a
      // camera feed, then displace it along each axis by a known amount.
      const { data, info } = await sharp(
        path.join(process.cwd(), "public", place.b_imageUrl)
      )
        .resize({ width: 480 })
        .removeAlpha()
        .greyscale()
        .raw()
        .toBuffer({ resolveWithObject: true })
      const { width, height } = info
      const archive = {
        width,
        height,
        data: Float32Array.from(data, (v) => v / 255),
      }
      const crop = { cx: width / 2, cy: height / 2, width, rotation: 0 }
      const atTarget = checkLines(guide, archive, archive, crop, false)
      expect(corroborated(atTarget, guide, height / width), place.slug).toBe(
        true
      )
      for (const axis of [0, 1] as const) {
        const distance = Math.round(width * 0.04)
        const dx = axis === 0 ? distance : 0
        const dy = axis === 1 ? distance : 0
        const pixels = new Float32Array(width * height).fill(0.5)
        for (let y = dy; y < height; y++) {
          const start = (y - dy) * width
          pixels.set(
            archive.data.subarray(start, start + width - dx),
            y * width + dx
          )
        }
        const shifted = checkLines(
          guide,
          archive,
          { ...archive, data: pixels },
          crop,
          false
        )
        expect(corroborated(shifted, guide, height / width), place.slug).toBe(
          true
        )
        expect(
          shifted.lines.some(
            (line) => line.state === "off" && line.shift && line.shift[axis] > 0
          ),
          place.slug
        ).toBe(true)
      }
      for (const { name, points } of guide!.features) {
        expect(
          new Set(points.map(([x, y]) => [x, y].join(","))).size,
          name
        ).toBeGreaterThan(1)
        for (const value of points.flat()) {
          expect(value, name).toBeGreaterThanOrEqual(0)
          expect(value, name).toBeLessThanOrEqual(1)
        }
      }
    }
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
