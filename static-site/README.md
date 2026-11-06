# Static build experiment

A performance experiment: the same then|now site as plain HTML with inline CSS
and a few KB of inline JavaScript. No React, no framework runtime, no hydration.
The Next.js app in this repo is untouched and still the production build.

- `build.mjs` reads the same `public/posts/*/*.json` content and writes `dist/`.
  Photos become AVIF/WebP width ladders (with one JPEG fallback) through `sharp`,
  named by content hash so they can be cached forever. Encoded files are cached
  in `.cache/static-images`, so only the first build is slow (about 3 minutes).
- `src/compare.js` (about 1.5 KB minified, inlined) drives the compare slider.
- `src/home.js` loads self-hosted MapLibre only after the page has loaded and
  the map is near the viewport. Story cards work without it.
- `serve.mjs` serves `dist/` locally with clean URLs, compression and the
  same cache headers as `dist/_headers`.

## Commands

```bash
corepack pnpm static:build      # writes dist/
corepack pnpm static:serve      # http://127.0.0.1:3200
corepack pnpm test:e2e:static   # the same tests/e2e specs, against dist/
```

## What is kept

Every spec in `tests/e2e` passes against both builds with no changes to its
assertions: default position 50, `?p=` drives the slider, `?p=50` normalises
away, dragging updates the URL, the before image stays fixed, the knob aligns
with the reveal border, 40px mobile side margins, desktop header spacing, and
the home map with story markers. The click-for-clean-view toggle, expanding
description, viewport-in-URL map state and "Stories in view" filtering are kept.

## What is different

- System font stack instead of self-hosted Inter (saves about 87 KB).
- Dark theme only. The current app defaults to dark and has no visible toggle.
- The mobile menu is a `<details>` element, so it needs no JavaScript.
- `/osm-experiments` (Leaflet test page) is not ported.
- Story pages pick sharper photos on tall phone screens (up to 1440px wide),
  because `object-fit: cover` crops a landscape photo to the screen height.

## Measurements

Lighthouse 12.8.2, median of 3 runs per row, local servers (`next start` vs
`serve.mjs`, both compressing text). Mobile uses Lighthouse's default simulated
slow 4G and CPU throttling. Map tiles could not load in the measuring sandbox,
so tile bytes are excluded from both builds.

| Page | Build | Score | FCP | LCP | TBT | CLS | Bytes | JS | Requests |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Home, mobile | Next | 86 | 0.91 s | 3.00 s | 356 ms | 0.117 | 5,909 KB | 453 KB | 38 |
| Home, mobile | Static | 99 | 0.62 s | 1.88 s | 76 ms | 0 | 592 KB | 219 KB | 16 |
| Home, desktop | Next | 97 | 0.25 s | 0.61 s | 10 ms | 0.102 | 5,936 KB | 453 KB | 67 |
| Home, desktop | Static | 100 | 0.18 s | 0.35 s | 0 ms | 0 | 484 KB | 219 KB | 16 |
| Post office, mobile | Next | 93 | 0.91 s | 3.24 s | 49 ms | 0 | 410 KB | 186 KB | 23 |
| Post office, mobile | Static | 99 | 0.63 s | 2.10 s | 0 ms | 0 | 241 KB | 0 KB* | 3 |
| Post office, desktop | Next | 100 | 0.25 s | 0.69 s | 0 ms | 0 | 808 KB | 186 KB | 36 |
| Post office, desktop | Static | 100 | 0.17 s | 0.52 s | 0 ms | 0 | 338 KB | 0 KB* | 3 |
| Sheep, mobile | Next | 92 | 0.91 s | 3.32 s | 56 ms | 0 | 407 KB | 186 KB | 23 |
| Sheep, mobile | Static | 99 | 0.63 s | 2.10 s | 0 ms | 0 | 245 KB | 0 KB* | 3 |
| Sheep, desktop | Next | 100 | 0.25 s | 0.72 s | 6 ms | 0 | 854 KB | 186 KB | 36 |
| Sheep, desktop | Static | 100 | 0.17 s | 0.56 s | 0 ms | 0 | 369 KB | 0 KB* | 3 |

\* Story pages have no separate script files. The slider script is inlined in
the HTML, which is about 3.7 KB compressed including all CSS and markup.
The home page JS is MapLibre (219 KB compressed), loaded after the page.

## Hosting

`dist/` is a plain static folder. For Cloudflare Pages: build command
`corepack pnpm install && corepack pnpm static:build`, output directory `dist`.
Pages serves `sheep.html` at `/sheep` and reads `dist/_headers`.
