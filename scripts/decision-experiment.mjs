// Private operator benchmark against the real app endpoint. No key in arguments.
// node scripts/decision-experiment.mjs URL SLUG IMAGE [IMAGE ...]
import { readFile } from "node:fs/promises"
import sharp from "sharp"

const [base, slug, ...files] = process.argv.slice(2)
const url = new URL(base)
if (
  (!["localhost", "127.0.0.1"].includes(url.hostname) &&
    url.protocol !== "https:") ||
  !slug ||
  !files.length
)
  throw new Error("Use URL SLUG IMAGE [IMAGE ...]")
let previous
const results = []
for (let i = 0; i < files.length; i++) {
  const image = await sharp(await readFile(files[i]))
    .rotate()
    .resize({
      width: 640,
      height: 640,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 65 })
    .toBuffer()
  const current = {
    jpeg: `data:image/jpeg;base64,${image.toString("base64")}`,
    at: i * 1200 + 1,
  }
  const started = performance.now()
  const response = await fetch(new URL("/api/camera-decision", url), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: url.origin,
      "sec-fetch-site": "same-origin",
    },
    body: JSON.stringify({ slug, current, previous }),
    signal: AbortSignal.timeout(6000),
  })
  const answer = await response.json()
  results.push({
    frame: i,
    status: response.status,
    elapsedMs: Math.round(performance.now() - started),
    ...answer,
  })
  previous = current
}
console.log(
  JSON.stringify(
    {
      results,
      limits:
        "Model suggestions only. No ground-truth physical movement or photographic acceptance inferred.",
    },
    null,
    2
  )
)
