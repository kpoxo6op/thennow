// Replay the shipped coarse model and crop fit on two display-framed photographs.
// The second pass embeds the same modern pixels at a known offset in a wider frame.
import { availableParallelism } from "node:os"
import path from "node:path"
import * as ort from "onnxruntime-node"
import sharp from "sharp"

import {
  cellSize,
  cellsToMatches,
  fitCrop,
  MATCH_HEIGHT,
  MATCH_WIDTH,
  MODEL_PATH,
  unplace,
} from "../../lib/rephoto/match.ts"

const [archivePath, modernPath] = process.argv.slice(2)
if (!archivePath || !modernPath)
  throw new Error("Expected archive and modern display frames")
const session = await ort.InferenceSession.create(
  path.join("public", MODEL_PATH),
  {
    logSeverityLevel: 3,
    intraOpNumThreads: Math.min(4, availableParallelism()),
  }
)

async function prepare(source) {
  const size = await sharp(source).metadata()
  const scale = Math.min(MATCH_WIDTH / size.width, MATCH_HEIGHT / size.height)
  const width = Math.round(size.width * scale),
    height = Math.round(size.height * scale)
  const left = Math.floor((MATCH_WIDTH - width) / 2),
    top = Math.floor((MATCH_HEIGHT - height) / 2)
  const sampled = await sharp(source)
    .resize(width, height, { fit: "fill" })
    .greyscale()
    .raw()
    .toBuffer()
  const gray = new Float32Array(MATCH_WIDTH * MATCH_HEIGHT).fill(128 / 255)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++)
      gray[(top + y) * MATCH_WIDTH + left + x] = sampled[y * width + x] / 255
  }
  return {
    size,
    placement: {
      x: left / MATCH_WIDTH,
      y: top / MATCH_HEIGHT,
      width: width / MATCH_WIDTH,
      height: height / MATCH_HEIGHT,
    },
    tensor: new ort.Tensor("float32", gray, [1, 1, MATCH_HEIGHT, MATCH_WIDTH]),
  }
}

const archive = await prepare(archivePath)
const modern = await prepare(modernPath)
const aspect = archive.size.height / archive.size.width

async function fit(frame) {
  const output = await session.run({
    image0: archive.tensor,
    image1: frame.tensor,
  })
  const raw = cellsToMatches(
    output.match.data,
    output.confidence.data,
    output.mutual.data
  )
  const matches = unplace(raw, archive.placement, frame.placement)
  let outcome
  const found = fitCrop(
    matches,
    aspect,
    frame.size,
    cellSize(frame.size, frame.placement),
    (details) => (outcome = details)
  )
  return { reason: outcome.reason, inliers: outcome.inliers, crop: found?.crop }
}
function corner(crop, x, y) {
  const dx = x * crop.width,
    dy = y * crop.width * aspect
  return [
    crop.cx + Math.cos(crop.rotation) * dx - Math.sin(crop.rotation) * dy,
    crop.cy + Math.sin(crop.rotation) * dx + Math.cos(crop.rotation) * dy,
  ]
}
const left = Math.round(modern.size.width * 0.23),
  top = Math.round(modern.size.height * 0.07)
const padded = await sharp(modernPath)
  .extend({
    left,
    top,
    right: Math.round(modern.size.width * 0.05),
    bottom: Math.round(modern.size.height * 0.18),
    background: "#808080",
  })
  .png()
  .toBuffer()
const base = await fit(modern),
  embedded = await fit(await prepare(padded))
let worstCornerPx = null
if (base.crop && embedded.crop) {
  const errors = []
  for (const x of [-0.5, 0.5])
    for (const y of [-0.5, 0.5]) {
      const before = corner(base.crop, x, y),
        after = corner(embedded.crop, x, y)
      errors.push(
        Math.hypot(after[0] - left - before[0], after[1] - top - before[1])
      )
    }
  worstCornerPx =
    Math.round(((1000 * Math.max(...errors)) / base.crop.width) * 10) / 10
}
console.log(
  JSON.stringify({
    base: base.reason,
    inliers: base.inliers,
    embedded: embedded.reason,
    worstCornerPx,
  })
)
