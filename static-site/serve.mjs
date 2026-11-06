// Minimal static server for dist/, mimicking Cloudflare Pages: clean URLs
// (/slug -> slug.html), 404.html, compression for text, cache headers from _headers.
// Usage: node static-site/serve.mjs [--port 3200] [--host 127.0.0.1]
import fs from "node:fs"
import http from "node:http"
import path from "node:path"
import { fileURLToPath } from "node:url"
import zlib from "node:zlib"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "dist")
const args = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const PORT = Number(arg("port", process.env.PORT || 3200))
const HOST = arg("host", "127.0.0.1")

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".xml": "application/rss+xml; charset=utf-8",
  ".avif": "image/avif",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
}
const COMPRESSIBLE = new Set([".html", ".css", ".js", ".json", ".xml", ".svg"])

function resolve(urlPath) {
  const clean = path.normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, "")
  const candidates = clean.endsWith("/")
    ? [path.join(clean, "index.html"), clean.replace(/\/$/, "") + ".html"]
    : [clean, clean + ".html", path.join(clean, "index.html")]
  for (const candidate of candidates) {
    const file = path.join(ROOT, candidate)
    if (file.startsWith(ROOT) && fs.existsSync(file) && fs.statSync(file).isFile()) return file
  }
  return null
}

http
  .createServer((req, res) => {
    const url = new URL(req.url || "/", "http://localhost")
    let file = resolve(url.pathname)
    let status = 200
    if (!file) {
      file = path.join(ROOT, "404.html")
      status = 404
    }
    const ext = path.extname(file)
    const headers = { "Content-Type": TYPES[ext] || "application/octet-stream", Vary: "Accept-Encoding" }
    if (url.pathname.startsWith("/posts/") || url.pathname.startsWith("/vendor/")) {
      headers["Cache-Control"] = "public, max-age=31536000, immutable"
    }
    let body = fs.readFileSync(file)
    const accept = String(req.headers["accept-encoding"] || "")
    if (COMPRESSIBLE.has(ext)) {
      if (accept.includes("br")) {
        body = zlib.brotliCompressSync(body)
        headers["Content-Encoding"] = "br"
      } else if (accept.includes("gzip")) {
        body = zlib.gzipSync(body)
        headers["Content-Encoding"] = "gzip"
      }
    }
    headers["Content-Length"] = body.length
    res.writeHead(status, headers)
    res.end(req.method === "HEAD" ? undefined : body)
  })
  .listen(PORT, HOST, () => console.log(`serving dist/ on http://${HOST}:${PORT}`))
