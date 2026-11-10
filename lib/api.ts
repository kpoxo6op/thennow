import fs from "fs"
import path from "path"
import PostType, {
  type PendingPost,
  type PendingSummary,
  type StorySummary,
} from "@/interfaces/post"

let postsCache: (PostType | PendingPost)[] | null = null

// A place file with something missing stops the build here, by name, rather than as a blank
// error from whichever page first reads the missing field.
function check(file: string, json: Record<string, unknown>) {
  const fail = (what: string): never => {
    throw new Error(`Place file ${file}: ${what}`)
  }
  for (const field of ["name", "description", "slug", "b_imageUrl"]) {
    if (typeof json[field] !== "string" || !json[field])
      fail(`"${field}" is missing`)
  }
  for (const field of ["w", "h"]) {
    const value = json[field]
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
      fail(`"${field}" must be a positive number`)
  }
  const location = json.location as { lat?: unknown; lng?: unknown } | undefined
  if (typeof location?.lat !== "number" || typeof location?.lng !== "number")
    fail(`"location" needs a numeric lat and lng`)
  if (json.status === "pending" || !json.a_imageUrl) {
    const archive = (json.archive ?? {}) as Record<string, unknown>
    for (const field of [
      "date",
      "photographer",
      "credit",
      "rights",
      "sourceUrl",
      "sourceId",
    ]) {
      if (typeof archive[field] !== "string" || !archive[field])
        fail(`an upcoming place needs "archive.${field}"`)
    }
  } else if (typeof json.ba_imageUrl !== "string" || !json.ba_imageUrl) {
    fail(`a finished story needs "ba_imageUrl"`)
  }
}

function readAll() {
  if (postsCache) {
    return postsCache
  }

  const postsDirectory = path.join(process.cwd(), "public", "posts")
  const postFolders = fs.readdirSync(postsDirectory).sort()

  postsCache = postFolders.map((postFolder): PostType | PendingPost => {
    const fullPath = path.join(postsDirectory, postFolder, `${postFolder}.json`)
    const jsonContent = JSON.parse(fs.readFileSync(fullPath, "utf8"))
    check(`${postFolder}.json`, jsonContent)
    const shared = {
      name: jsonContent.name,
      description: jsonContent.description,
      b_imageUrl: jsonContent.b_imageUrl,
      w: jsonContent.w,
      h: jsonContent.h,
      slug: jsonContent.slug,
      location: jsonContent.location,
      sample: jsonContent._preview_fixture === true,
      area: jsonContent.area ?? jsonContent._preview_area,
      imageSourceSlug: jsonContent._image_source_slug,
    }

    // No modern photograph means pending, whatever else the file says.
    if (jsonContent.status === "pending" || !jsonContent.a_imageUrl) {
      return { ...shared, status: "pending", archive: jsonContent.archive }
    }

    return {
      ...shared,
      status: "complete",
      a_imageUrl: jsonContent.a_imageUrl,
      ba_imageUrl: jsonContent.ba_imageUrl,
    }
  })

  return postsCache
}

// Finished stories: both photographs, a working comparison.
export async function fetchPosts(): Promise<PostType[]> {
  return readAll().filter(
    (post): post is PostType => post.status === "complete"
  )
}

export async function fetchPending(): Promise<PendingPost[]> {
  return readAll().filter(
    (post): post is PendingPost => post.status === "pending"
  )
}

export function toSummary({
  status,
  name,
  description,
  b_imageUrl,
  a_imageUrl,
  ba_imageUrl,
  w,
  h,
  slug,
  location,
  sample,
  area,
}: PostType): StorySummary {
  return {
    status,
    name,
    description,
    b_imageUrl,
    a_imageUrl,
    ba_imageUrl,
    w,
    h,
    slug,
    location,
    sample,
    area,
  }
}

export function toPendingSummary({
  status,
  name,
  description,
  b_imageUrl,
  w,
  h,
  slug,
  location,
  area,
}: PendingPost): PendingSummary {
  return { status, name, description, b_imageUrl, w, h, slug, location, area }
}
