export type PostLocation = {
  lat: number
  lng: number
}

// Editorial starting point, separate from the place itself. Approximate, never a surveyed camera pose.
export type PostViewpoint = PostLocation & {
  label: string
  bearing?: number
  source: string
}

type PostFields = {
  name: string
  description: string
  b_imageUrl: string
  w: number
  h: number
  slug: string
  location: PostLocation
  viewpoint?: PostViewpoint
  sample?: boolean
  area?: string
  // Sample places only: the original story whose photographs they repeat.
  imageSourceSlug?: string
}

// A story with both photographs.
type PostType = PostFields & {
  status: "complete"
  a_imageUrl: string
  ba_imageUrl: string
}

// Where an archive photograph came from.
export type ArchiveRecord = {
  date: string
  photographer: string
  credit: string
  rights: string
  sourceUrl: string
  sourceId: string
}

// An archive photograph with no modern one yet. Adding a_imageUrl and ba_imageUrl to its file and
// removing "status" makes it a finished story; nothing here can hold a comparison until then.
export type PendingPost = PostFields & {
  status: "pending"
  archive: ArchiveRecord
}

export type StorySummary = Pick<
  PostType,
  | "status"
  | "name"
  | "description"
  | "b_imageUrl"
  | "a_imageUrl"
  | "ba_imageUrl"
  | "w"
  | "h"
  | "slug"
  | "location"
  | "sample"
  | "area"
>

export type PendingSummary = Pick<
  PendingPost,
  | "status"
  | "name"
  | "description"
  | "b_imageUrl"
  | "w"
  | "h"
  | "slug"
  | "location"
  | "area"
>

export type Place = StorySummary | PendingSummary

export default PostType
