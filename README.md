# then | now

[thennow.nz](https://thennow.nz) shows old photographs of New Zealand places paired with modern retakes, compared with a draggable line. Visitors can retake an upcoming place's photograph with the site's own camera and send it in; the owner adds approved photographs by hand.

## Stack

- Next.js 16 (App Router) on Vercel, React 19, TypeScript
- Tailwind CSS 4
- MapLibre GL with OpenFreeMap tiles
- Vercel Blob as the photo store
- Passkeys through SimpleWebAuthn
- An ONNX image matcher (`onnxruntime-node`)
- Playwright for tests

## Running locally

Requirements: Node 22 and corepack (which ships with Node).

```bash
corepack enable
corepack pnpm install
corepack pnpm dev        # http://localhost:3000
```

The repo is pnpm-only: pnpm 10.33.0 is pinned by `packageManager` in `package.json`. Do not use npm.

## Environment

The site reads one variable of its own, `BLOB_READ_WRITE_TOKEN`, the Vercel Blob read-write token. Without it the site runs normally, except that sending a photo or saving a name answers `503 no store`. Production and previews get it from the Vercel project. To set it locally, copy `.env.example` to `.env`; git ignores that file and Vercel never receives it. The operator's `.env` also holds `VERCEL_TOKEN` for the Vercel CLI.

`TN_ADMIN_IDS` lists, comma separated, the people ids who may remove anyone's comment. To find yours, sign up on `/me`, copy the `tn_me` cookie's value from the browser, and run `node scripts/person-id.mjs`. The test server's value is set in `playwright.config.ts`.

`TN_FAKE_STORE=1` is set only by `playwright.config.ts`. It gives the test server a photo store kept in memory, and the build refuses it on any deployment. Never set it yourself.

## Checks

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm build
corepack pnpm test:e2e
```

The e2e tests (`tests/e2e`) run against a production build on port 3100. Playwright reuses a server that is already listening there, so stop a stale one first: `lsof -ti :3100 | xargs -r kill`.

The compact suite protects named browser/API contracts. It does not certify the
phone camera: the synthetic matcher calls the server and cannot test WebGPU.
See [Testing and real-device acceptance](docs/testing.md) for the retained-test
rationale, Android emulator/Pixel workflow and required evidence. For camera or
mobile interaction changes, record actual device results and explicitly mark
any unrun physical/field checks; a green desktop run is not phone-ready proof.

## Content

Each place has a folder under `public/posts/NNNN-slug/` holding its photographs and `NNNN-slug.json`. The file has `name`, `slug`, `description`, `location` (`lat`, `lng`), `w` and `h` (the photographs' pixel size) and `b_imageUrl` (the old photograph). A finished story also has `a_imageUrl` (the modern photograph) and `ba_imageUrl` (the pair, for previews). An upcoming place has `"status": "pending"` and an `archive` record (`date`, `photographer`, `credit`, `rights`, `sourceUrl`, `sourceId`). `lib/api.ts` reads these files at build time.

To finish a story, add the modern photograph and the pair to the upcoming place's file and remove `"status"`.

## Sent photos

Photos from the camera go to the private Blob store and are published only by hand. The store holds `submissions/<place>/<key>.jpg` and `.json` (a sent photo and its note), `people/<id>.json` (a name), `people/<id>/<place>/<key>.jpg` (the sender's small copy), `keys/<hash>.json` (a passkey), `challenges/<hash>.json` (a passkey question waiting for its answer), `comments/<place>/<key>.json` (a visitor's comment: text, name, who wrote it, when) and `commented/<id>/<place>/<key>` (which comments a person wrote, so they follow that person when they sign in).

Operator scripts:

- `scripts/submissions.mjs [place]` lists sent photos (needs the token).
- `scripts/claim-check.mjs <base-url> <jpeg>` and `scripts/passkey-check.mjs <base-url>` run the whole name, photo and passkey flow against a real deployment. They write to the real store and leave one test photo in it.
- `scripts/person-id.mjs` turns a `tn_me` cookie value into the id that `TN_ADMIN_IDS` lists.
- `scripts/rephoto/export_coarse.py` exports the matcher's model.

## Deploying

The site deploys from the Vercel project `thennow`; see `AGENTS.md`.

## License

The site's code started from [shadcn's Next.js template](https://github.com/shadcn-ui/next-template), which is MIT-licensed.
The photographs are not covered by that: each archive photograph carries its own rights, recorded in its place's file.
