import * as blob from "@vercel/blob"

// The site's photo store. On the site this is Vercel Blob. The test suite has no store of its own,
// so when it starts the site it asks for one kept in memory (TN_FAKE_STORE=1, set only in
// playwright.config.ts): the same calls, and nothing kept once the server stops. A deployment
// never uses it, whatever is set: next.config.mjs refuses to build or start one that asks.

const DEPLOYED = [
  "VERCEL",
  "VERCEL_ENV",
  "VERCEL_URL",
  "VERCEL_DEPLOYMENT_ID",
  "AWS_LAMBDA_FUNCTION_NAME",
  "AWS_EXECUTION_ENV",
  "LAMBDA_TASK_ROOT",
]

// True only for the test suite's own server. When true, a real store's token is ignored, so a
// test run on a machine that has one can't write to the real store.
export const memoryStore =
  process.env.TN_FAKE_STORE === "1" && !DEPLOYED.some((name) => process.env[name])

export const hasStore = () => memoryStore || !!process.env.BLOB_READ_WRITE_TOKEN

type Kept = { body: Uint8Array<ArrayBuffer>; contentType: string; uploadedAt: Date }

// One shelf for the whole server, however its code is split into bundles.
const holder = globalThis as { __tnMemoryStore?: Map<string, Kept> }
const shelf = (holder.__tnMemoryStore ??= new Map<string, Kept>())

type Options = { contentType?: string; allowOverwrite?: boolean }

// Only what the site reads from each answer is given back. Add to it when the site reads more.
const memory = {
  async put(pathname: string, body: string | Uint8Array, options: Options = {}) {
    if (!options.allowOverwrite && shelf.has(pathname)) throw new Error(`Already stored: ${pathname}`)
    shelf.set(pathname, {
      body: typeof body === "string" ? new TextEncoder().encode(body) : new Uint8Array(body),
      contentType: options.contentType ?? "application/octet-stream",
      uploadedAt: new Date(),
    })
    return { pathname }
  },
  async get(pathname: string) {
    const kept = shelf.get(pathname)
    if (!kept) return null
    return {
      statusCode: 200 as const,
      stream: new Response(kept.body).body!,
      blob: { pathname, contentType: kept.contentType, size: kept.body.length, uploadedAt: kept.uploadedAt },
    }
  },
  async head(pathname: string) {
    const kept = shelf.get(pathname)
    if (!kept) throw new Error(`Not stored: ${pathname}`)
    return { pathname, contentType: kept.contentType, size: kept.body.length, uploadedAt: kept.uploadedAt }
  },
  // Pages run in name order and a cursor is the last name given, so a list keeps its place
  // while the things it lists are being moved away.
  async list({ prefix = "", limit = 1000, cursor }: { prefix?: string; limit?: number; cursor?: string } = {}) {
    const names = [...shelf.keys()]
      .filter((name) => name.startsWith(prefix) && (!cursor || name > cursor))
      .sort()
    const page = names.slice(0, limit)
    const hasMore = names.length > page.length
    return {
      blobs: page.map((pathname) => ({
        pathname,
        size: shelf.get(pathname)!.body.length,
        uploadedAt: shelf.get(pathname)!.uploadedAt,
      })),
      hasMore,
      cursor: hasMore ? page[page.length - 1] : undefined,
    }
  },
  async del(pathname: string | string[]) {
    for (const name of [pathname].flat()) shelf.delete(name)
  },
  async rename(from: string, to: string, options: Options = {}) {
    const kept = shelf.get(from)
    if (!kept) throw new Error(`Not stored: ${from}`)
    if (!options.allowOverwrite && shelf.has(to)) throw new Error(`Already stored: ${to}`)
    shelf.set(to, { ...kept, uploadedAt: new Date() })
    shelf.delete(from)
    return { pathname: to }
  },
}

export const put = (memoryStore ? memory.put : blob.put) as typeof blob.put
export const get = (memoryStore ? memory.get : blob.get) as typeof blob.get
export const head = (memoryStore ? memory.head : blob.head) as typeof blob.head
export const list = (memoryStore ? memory.list : blob.list) as typeof blob.list
export const del = (memoryStore ? memory.del : blob.del) as typeof blob.del
export const rename = (memoryStore ? memory.rename : blob.rename) as typeof blob.rename
