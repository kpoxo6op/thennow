// Scores a place's reference lines against a recent photo of it, the way the camera does.
//   node --experimental-strip-types scripts/check-guide.mjs <slug> <photo.jpg> [cx cy width rotation]
// The optional crop places the old view in the photo's pixels; without it the photo is taken as
// already framed like the old one (a saved rephoto). Every region should be measured, and a good
// shot should score high: check this before shipping a new or changed guide.
import fs from "node:fs"
import sharp from "sharp"

const { checkLines, alignmentScore, linedUp } =
  await import("../lib/rephoto/line-check.ts")
const { referenceLines } = await import("../lib/rephoto/reference-lines.ts")

const [slug, photo, ...crop] = process.argv.slice(2)
if (!slug || !photo) {
  console.error(
    "usage: check-guide.mjs <slug> <photo.jpg> [cx cy width rotation]"
  )
  process.exit(2)
}
const post = fs
  .readdirSync("public/posts")
  .map((dir) =>
    JSON.parse(fs.readFileSync(`public/posts/${dir}/${dir}.json`, "utf8"))
  )
  .find((record) => record.slug === slug)
if (!post) throw new Error(`Unknown place: ${slug}`)
const guide = referenceLines(slug, post.b_imageUrl)
if (!guide) throw new Error(`No reference lines for ${slug}`)

async function gray(file, width) {
  const { data, info } = await sharp(file)
    .resize({ width: Math.round(width) })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const values = new Float32Array(data.length)
  for (let i = 0; i < data.length; i++) values[i] = data[i] / 255
  return { width: info.width, height: info.height, data: values }
}

const meta = await sharp(photo).metadata()
const [cx, cy, width, rotation] = crop.length
  ? crop.map(Number)
  : [meta.width / 2, meta.height / 2, meta.width, 0]
// The camera checks at a 480 px wide view.
const k = 480 / width
const live = await gray(photo, meta.width * k)
const archive = await gray(`public${post.b_imageUrl}`, width * k)
const result = checkLines(guide, archive, live, {
  cx: cx * k,
  cy: cy * k,
  width: width * k,
  rotation,
})
const { corroborated, lineInstruction } =
  await import("../lib/rephoto/line-feedback.ts")
const aspect = archive.height / archive.width
const supported = corroborated(result, guide, aspect)
const score = supported ? alignmentScore(result, guide) : null
for (const line of result.lines) {
  const feature = guide.features[line.index]
  console.log(
    `${feature.name.padEnd(44)} ${(feature.region ?? "-").padEnd(10)} ${line.state.padEnd(8)} ${
      line.offset == null
        ? ""
        : `${(line.offset * 100).toFixed(1)}%${line.state === "off" && line.shift ? " · " + lineInstruction(guide, aspect, line) : ""}`
    }`
  )
}
console.log(
  score
    ? `score ${score.score}, ${score.measured} of ${score.regions} regions, lined up: ${result.ok && linedUp(score, false)}`
    : "score: nothing measured"
)
