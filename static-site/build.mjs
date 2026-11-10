// Static build for then|now: plain HTML, inline CSS, a few KB of inline JS.
// Reads the same content as the Next app (public/posts/*/*.json) and writes dist/.
// Usage: node static-site/build.mjs
import { createHash } from "node:crypto"
import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const SRC = path.join(ROOT, "static-site", "src")
const OUT = path.join(ROOT, "dist")
const CACHE = path.join(ROOT, ".cache", "static-images")
const SITE_URL = "https://thennow.nz"
const SITE_NAME = "then|now"
const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty"
const NAV = [
  { title: "About", href: "/about" },
  { title: "Contact", href: "/contact" },
  { title: "Links", href: "/links" },
]

// Widths are capped at each source image's own width.
const COMPARE_WIDTHS = [640, 960, 1440, 1920, 2560]
const PORTRAIT_MAX = 1440
const CARD_WIDTHS = [400, 640, 960]
const FORMATS = {
  avif: { quality: 50, effort: 4 },
  webp: { quality: 72 },
  jpeg: { quality: 78, mozjpeg: true },
}

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"))

function version() {
  let sha = process.env.CF_PAGES_COMMIT_SHA || ""
  if (!sha) {
    try {
      sha = execSync("git rev-parse HEAD", { cwd: ROOT }).toString().trim()
    } catch {
      sha = ""
    }
  }
  return sha ? `${pkg.version}+${sha.slice(0, 8)}` : pkg.version
}

const esc = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")

const snippet = (description, lines) =>
  description.split("\n").filter(Boolean).slice(0, lines).join(" ")

// Tiny minifiers: strip comments and indentation. Good enough for hand-written files.
const minCss = (css) =>
  css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([{}:;,>])\s*/g, "$1")
    .replace(/;}/g, "}")
    .trim()
const minJs = (js) =>
  js
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("//"))
    .join("\n")

function readPosts() {
  const dir = path.join(ROOT, "public", "posts")
  return fs
    .readdirSync(dir)
    .sort()
    .map((folder) => JSON.parse(fs.readFileSync(path.join(dir, folder, `${folder}.json`), "utf8")))
}

// Encodes one source image into a width/format ladder. Output names carry a
// content hash so they can be cached forever.
async function ladder(publicUrl, widths) {
  const file = path.join(ROOT, "public", publicUrl)
  const input = fs.readFileSync(file)
  const hash = createHash("sha1").update(input).update(JSON.stringify(FORMATS)).digest("hex").slice(0, 10)
  const meta = await sharp(input).metadata()
  const sizes = [...new Set(widths.filter((w) => w < meta.width).concat(Math.min(meta.width, widths.at(-1))))].sort(
    (a, b) => a - b
  )
  const base = path.basename(publicUrl, path.extname(publicUrl))
  const relDir = path.dirname(publicUrl).replace(/^\//, "")
  fs.mkdirSync(path.join(OUT, relDir), { recursive: true })
  fs.mkdirSync(CACHE, { recursive: true })

  const result = { width: meta.width, height: meta.height, sources: {} }
  for (const [format, options] of Object.entries(FORMATS)) {
    // JPEG is only the fallback for very old browsers: one mid-size file.
    const formatSizes = format === "jpeg" ? [sizes.find((w) => w >= 1280) ?? sizes.at(-1)] : sizes
    result.sources[format] = []
    for (const width of formatSizes) {
      const name = `${base}-${hash}-${width}.${format === "jpeg" ? "jpg" : format}`
      const cached = path.join(CACHE, name)
      if (!fs.existsSync(cached)) {
        await sharp(input).resize({ width }).toFormat(format, options).toFile(cached)
      }
      fs.copyFileSync(cached, path.join(OUT, relDir, name))
      result.sources[format].push({ url: `/${relDir}/${name}`, width })
    }
  }
  return result
}

// portraitMax caps the width ladder on portrait screens. Phones are tall and
// dense, so object-fit: cover would otherwise pull the largest file.
function picture(img, { alt, sizes, imgAttrs = "", portraitMax = 0 }) {
  const srcset = (list) => list.map((s) => `${s.url} ${s.width}w`).join(", ")
  const fallback = img.sources.jpeg[0]
  const capped = (format) => {
    const list = img.sources[format].filter((s) => s.width <= portraitMax)
    return list.length ? list : img.sources[format].slice(0, 1)
  }
  const portrait = portraitMax
    ? ["avif", "webp"]
        .map((f) => `<source media="(orientation: portrait)" type="image/${f}" srcset="${srcset(capped(f))}" sizes="${sizes}">`)
        .join("")
    : ""
  return (
    `<picture>` +
    portrait +
    `<source type="image/avif" srcset="${srcset(img.sources.avif)}" sizes="${sizes}">` +
    `<source type="image/webp" srcset="${srcset(img.sources.webp)}" sizes="${sizes}">` +
    `<img src="${fallback.url}" alt="${esc(alt)}" width="${img.width}" height="${img.height}" ${imgAttrs}>` +
    `</picture>`
  )
}

const MENU_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16"/><path d="M4 12h16"/><path d="M4 19h16"/></svg>'

function header({ overlay = false } = {}) {
  const links = NAV.map((item) => `<a href="${item.href}">${item.title}</a>`).join("")
  return (
    `<header data-testid="site-header" class="site-header${overlay ? " site-header--overlay" : ""}">` +
    `<a class="site-title" href="/">${SITE_NAME}</a>` +
    `<nav class="nav-desktop" aria-label="Main">${links}</nav>` +
    `<details class="burger"><summary aria-label="Menu">${MENU_ICON}</summary>` +
    `<nav class="nav-mobile" aria-label="Main">${links}</nav></details>` +
    `</header>`
  )
}

const footer = (ver) =>
  `<footer class="site-footer"><div>${SITE_NAME}</div><small>Version ${ver}</small></footer>`

function page({ title, description, body, css, bodyClass = "", head = "" }) {
  const fullTitle = title ? `${title} - ${SITE_NAME}` : SITE_NAME
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#030711">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="alternate" type="application/rss+xml" title="${SITE_NAME}" href="/feed.xml">
${head}<style>${css}</style>
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ""}>
${body}
</body>
</html>
`
}

function write(rel, contents) {
  const file = path.join(OUT, rel)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, contents)
}

async function main() {
  const started = Date.now()
  fs.rmSync(OUT, { recursive: true, force: true })
  fs.mkdirSync(OUT, { recursive: true })

  const css = minCss(fs.readFileSync(path.join(SRC, "site.css"), "utf8"))
  const compareJs = minJs(fs.readFileSync(path.join(SRC, "compare.js"), "utf8"))
  const homeJs = minJs(fs.readFileSync(path.join(SRC, "home.js"), "utf8"))
  const ver = version()
  const posts = readPosts()

  for (const icon of ["favicon.ico", "favicon-16x16.png", "favicon-32x32.png", "apple-touch-icon.png", "android-chrome-192x192.png", "android-chrome-512x512.png"]) {
    fs.copyFileSync(path.join(ROOT, "public", icon), path.join(OUT, icon))
  }

  // MapLibre is self-hosted and version-named so it can be cached immutably.
  const mlPkg = JSON.parse(fs.readFileSync(path.join(ROOT, "node_modules", "maplibre-gl", "package.json"), "utf8"))
  const mlDir = `vendor/maplibre-gl-${mlPkg.version}`
  fs.mkdirSync(path.join(OUT, mlDir), { recursive: true })
  for (const f of ["maplibre-gl.js", "maplibre-gl.css"]) {
    fs.copyFileSync(path.join(ROOT, "node_modules", "maplibre-gl", "dist", f), path.join(OUT, mlDir, f))
  }

  const images = {}
  for (const post of posts) {
    images[post.slug] = {
      before: await ladder(post.b_imageUrl, COMPARE_WIDTHS),
      after: await ladder(post.a_imageUrl, COMPARE_WIDTHS),
      card: await ladder(post.ba_imageUrl, CARD_WIDTHS),
    }
  }

  // Story pages: /<slug> is served from <slug>.html by Cloudflare Pages and the local server.
  for (const post of posts) {
    const img = images[post.slug]
    const ratio = `${img.after.width}/${img.after.height}`
    // object-fit: cover on a viewport taller than the photo needs height-based width.
    const sizes = `(max-aspect-ratio: ${ratio}) calc(100vh * ${img.after.width} / ${img.after.height}), 100vw`
    const body =
      header({ overlay: true }) +
      `<main class="compare">` +
      `<div data-testid="compare-stage" class="compare-stage" style="--p:50">` +
      picture(img.after, {
        alt: post.name,
        sizes,
        portraitMax: PORTRAIT_MAX,
        imgAttrs: 'data-testid="compare-base-image" fetchpriority="high" decoding="async" draggable="false"',
      }) +
      `<div data-testid="compare-overlay" class="compare-overlay">` +
      picture(img.before, {
        alt: post.name,
        sizes,
        portraitMax: PORTRAIT_MAX,
        imgAttrs: 'data-testid="compare-overlay-image" fetchpriority="high" decoding="async" draggable="false"',
      }) +
      `</div></div>` +
      `<div id="compare-desc" class="compare-desc"><p>${esc(post.description)}</p></div>` +
      `<div class="compare-controls"><div data-testid="compare-slider-root" class="slider" style="--p:50">` +
      `<div class="slider-track"></div><div data-testid="compare-slider-progress" class="slider-progress"></div>` +
      `<div data-testid="compare-slider-knob" class="slider-knob"></div>` +
      `<input type="range" data-testid="compare-slider-input" aria-label="Compare slider" min="0" max="100" step="1" value="50">` +
      `</div></div>` +
      `<div id="compare-blank" class="compare-blank" hidden></div>` +
      `</main>` +
      `<script>${compareJs}</script>`
    write(`${post.slug}.html`, page({ title: post.name, description: post.description, body, css, bodyClass: "compare-body" }))
  }

  // Home
  const mapData = posts.map((post) => ({
    slug: post.slug,
    name: post.name,
    lat: post.location.lat,
    lng: post.location.lng,
    thumb: images[post.slug].card.sources.webp[0].url,
  }))
  const cards = posts
    .map((post, index) =>
      `<a class="card" data-card="${post.slug}" href="/${post.slug}">` +
      picture(images[post.slug].card, {
        alt: post.name,
        sizes: "(min-width: 1400px) 440px, (min-width: 1280px) 32vw, (min-width: 640px) 48vw, 100vw",
        imgAttrs: index < 3 ? 'decoding="async"' : 'loading="lazy" decoding="async"',
      }) +
      `<div class="card-body"><h2>${esc(post.name)}</h2><p>${esc(snippet(post.description, 3))}</p></div></a>`
    )
    .join("")
  const homeBody =
    header() +
    `<main class="home-main">` +
    `<section class="container hero"><h1><span>New Zealand</span> <span>Then and Now</span></h1>` +
    `<p>then|now is a visual archive of places photographed across time. Each story pairs an older image with a modern retake so visitors can see what stayed, what disappeared, and what the street looks like now.</p></section>` +
    `<section class="container map-section"><div class="map-frame">` +
    `<div data-testid="home-map" class="home-map" aria-label="Map of story locations" data-style="${MAP_STYLE}" data-js="/${mlDir}/maplibre-gl.js" data-css="/${mlDir}/maplibre-gl.css"></div>` +
    `</div></section>` +
    `<section class="container stories"><h2>Stories in view</h2><div class="cards">${cards}</div></section>` +
    `</main>` +
    footer(ver) +
    `<script type="application/json" id="map-data">${JSON.stringify(mapData).replaceAll("<", "\\u003c")}</script>` +
    `<script>${homeJs}</script>`
  write("index.html", page({ title: "", description: "New Zealand photos then and now", body: homeBody, css }))

  // Simple pages, matching the current placeholders.
  for (const [slug, title] of [["about", "About"], ["contact", "Contact"]]) {
    write(
      `${slug}.html`,
      page({
        title,
        description: "New Zealand photos then and now",
        body: header() + `<main class="container page-main"><h2>${title}</h2><p>${slug}...</p></main>` + footer(ver),
        css,
      })
    )
  }
  write(
    "404.html",
    page({
      title: "Not found",
      description: "Page not found",
      body: header() + `<main class="container page-main"><h2>404</h2><p>This page could not be found.</p></main>` + footer(ver),
      css,
    })
  )

  const items = posts
    .map((post) => {
      const url = `${SITE_URL}/${post.slug}`
      return `<item><title>${esc(post.name)}</title><link>${url}</link><guid>${url}</guid><description>${esc(snippet(post.description, 2))}</description></item>`
    })
    .join("\n    ")
  write(
    "feed.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>then|now feed</title>
    <link>${SITE_URL}</link>
    <description>New Zealand photographs paired across time.</description>
    ${items}
  </channel>
</rss>
`
  )

  // Cloudflare Pages (and Netlify) read this file for response headers.
  write(
    "_headers",
    `/posts/*
  Cache-Control: public, max-age=31536000, immutable
/vendor/*
  Cache-Control: public, max-age=31536000, immutable
/feed.xml
  Content-Type: application/rss+xml; charset=utf-8
`
  )

  console.log(`static build: ${posts.length} stories -> dist/ in ${((Date.now() - started) / 1000).toFixed(1)}s`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
