// Lists the photos people have sent, newest first, with the name each phone gave, if any.
// Run with the store's token: BLOB_READ_WRITE_TOKEN=... node scripts/submissions.mjs [place]
import { get, list } from "@vercel/blob"

const place = process.argv[2]
const read = async (pathname) => {
  const found = await get(pathname, { access: "private", useCache: false }).catch(() => null)
  return found?.statusCode === 200 ? JSON.parse(await new Response(found.stream).text()) : null
}

const notes = []
let cursor
do {
  const page = await list({ prefix: `submissions/${place ? `${place}/` : ""}`, cursor })
  notes.push(...page.blobs.filter((blob) => blob.pathname.endsWith(".json")))
  cursor = page.hasMore ? page.cursor : undefined
} while (cursor)

const names = new Map()
for (const blob of notes.sort((a, b) => b.uploadedAt - a.uploadedAt)) {
  const note = await read(blob.pathname)
  if (!note) continue
  if (note.by && !names.has(note.by)) names.set(note.by, (await read(`people/${note.by}.json`))?.name ?? "")
  const name = note.by ? names.get(note.by) : ""
  console.log(
    [note.sentAt, note.place, blob.pathname.replace(/\.json$/, ".jpg"), note.lined ? "lined" : "unchecked", name || "-"].join("  ")
  )
}
