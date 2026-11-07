import fs from "fs"
import path from "path"
import PostType, { type PendingPost, type PendingSummary, type StorySummary } from "@/interfaces/post"

let postsCache: (PostType | PendingPost)[] | null = null

function readAll() {
  if (postsCache) {
    return postsCache
  }

  const postsDirectory = path.join(process.cwd(), "public", "posts")
  const postFolders = fs.readdirSync(postsDirectory).sort()

  postsCache = postFolders.map((postFolder): PostType | PendingPost => {
    const fullPath = path.join(postsDirectory, postFolder, `${postFolder}.json`)
    const jsonContent = JSON.parse(fs.readFileSync(fullPath, "utf8"))
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
  return readAll().filter((post): post is PostType => post.status === "complete")
}

export async function fetchPending(): Promise<PendingPost[]> {
  return readAll().filter((post): post is PendingPost => post.status === "pending")
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
  return { status, name, description, b_imageUrl, a_imageUrl, ba_imageUrl, w, h, slug, location, sample, area }
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
