import fs from "fs"
import path from "path"
import PostType from "@/interfaces/post"

let postsCache: PostType[] | null = null

export async function fetchPosts(): Promise<PostType[]> {
  if (postsCache) {
    return postsCache
  }

  const postsDirectory = path.join(process.cwd(), "public", "posts")
  const postFolders = fs.readdirSync(postsDirectory).sort()

  const posts = postFolders.map((postFolder) => {
    const fullPath = path.join(postsDirectory, postFolder, `${postFolder}.json`)
    const fileContents = fs.readFileSync(fullPath, "utf8")

    const jsonContent = JSON.parse(fileContents)
    return {
      name: jsonContent.name,
      description: jsonContent.description,
      b_imageUrl: jsonContent.b_imageUrl,
      a_imageUrl: jsonContent.a_imageUrl,
      ba_imageUrl: jsonContent.ba_imageUrl,
      w: jsonContent.w,
      h: jsonContent.h,
      slug: jsonContent.slug,
      location: jsonContent.location,
      sample: jsonContent._preview_fixture === true,
    }
  })

  postsCache = posts

  return posts
}
