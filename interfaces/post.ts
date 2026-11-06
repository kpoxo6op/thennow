export type PostLocation = {
  lat: number
  lng: number
}

type PostType = {
  name: string
  description: string
  b_imageUrl: string
  a_imageUrl: string
  ba_imageUrl: string
  w: number
  h: number
  slug: string
  location: PostLocation
  sample?: boolean
}

export type StorySummary = Pick<
  PostType,
  "name" | "ba_imageUrl" | "w" | "h" | "slug" | "location"
>

export default PostType
