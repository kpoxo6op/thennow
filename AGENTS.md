# AGENTS

This repo is protected by behavior-first checks. Agents must preserve intended site behavior, not just make code compile.

## Package Manager

- Use `pnpm`, not `npm`.
- The repo is pinned to `pnpm@10.33.0` via `packageManager` in `package.json`.
- Prefer:
  - `corepack pnpm install`
  - `corepack pnpm lint`
  - `corepack pnpm typecheck`
  - `corepack pnpm build`
  - `corepack pnpm test:e2e`

## Required Checks Before Stopping

Unless the user explicitly says otherwise, agents should run:

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm build
corepack pnpm test:e2e
```

If any check fails, do not call the work done.

## UI Regression Policy

This site has had repeated regressions around the compare page. Agents must treat the following as protected behavior:

- The compare slider must drag correctly.
- The visible slider knob must align with the visual compare border.
- The before image must stay fixed in place while the reveal amount changes.
- The default compare position is `50`.
- URL param `?p=` controls compare position.
- `?p=50` should normalize away; non-default values should remain in the URL.
- Mobile compare controls must keep safe side margins to avoid OS edge-swipe conflicts.
- The top header/nav must reach the correct right-edge spacing on desktop.

If a change touches compare behavior, header layout, or page geometry, agents should expect e2e tests to catch regressions and should verify carefully.

## Tests

Playwright e2e tests are part of the expected workflow.

- Config: `playwright.config.ts`
- Specs: `tests/e2e`
- CI runs e2e tests on pull requests and pushes to protected branches.

The retained contracts and device workflow are in [docs/testing.md](docs/testing.md).

### Keep the suite small and independent

- Do not add unit tests by default. Prefer an existing end-to-end journey at the
  real user/API boundary. Small math or security checks need an independent
  failure that those journeys cannot safely or reliably exercise.
- For every new or retained test, name its observable contract, credible failure,
  and why another test does not already own it. Record this in the test or the
  contract table in docs/testing.md. Extend/replace before adding; justify any
  increase in discovered test count. There is no coverage/count target.
- No source-text assertions, implementation-derived expected results, prose
  counts, incidental CSS values, or viewport/content matrices without a distinct
  failure. Explicit protected geometry contracts above remain valuable.
- Use a known regression, independent specification or observed device behaviour
  as the oracle. When practical, show the original bug or a credible fault fails
  the test. Do not write a test merely because a function exists.
- Never claim synthetic camera/ORT, virtual-authenticator or in-memory-store
  results prove real camera/GPU, native passkey UX or deployed persistence.
- Camera/runtime and mobile interaction changes require the documented Android
  emulator run and an available Pixel run before claiming phone-ready. Keep
  physical field alignment separate from emulator/desktop evidence. Report
  missing device, scene or observations as blocked/not run, not as passed.
- Keep device screenshots/video private and ignored. No personal photo fixtures,
  no raw ADB around the Errands guards, no secret/cookie output in test logs.

Playwright reuses a server that is already listening on port 3100. After changing
code, stop it first (`lsof -ti :3100 | xargs -r kill`), or the tests run against the old build.

## When Tests Fail

Use this rule:

- If behavior changed by accident, fix the code.
- If behavior changed on purpose, update the tests in the same change.

Do not delete or weaken tests just to make CI green.

If the product requirement changed intentionally, update:

- the code
- the Playwright assertions
- test names/descriptions so they reflect the new intended behavior

## Visual Testing

If a future task adds screenshot snapshots, treat them the same way:

- accidental diff -> fix the UI
- intentional diff -> update the snapshot baseline in the same change

## Photo Store In Tests

The test server keeps its photo store in memory (`TN_FAKE_STORE=1`, set only in
`playwright.config.ts`; see `lib/store.ts`). App code must import store calls from
`@/lib/store`, never from `@vercel/blob`. Never set `TN_FAKE_STORE` on Vercel: the build
refuses it. The in-memory store imitates only what the site reads; real-store behaviour is
checked with `scripts/claim-check.mjs` and `scripts/passkey-check.mjs` against a preview.

## Vercel

This repo is linked to the Vercel project `thennow`.

Important project state:

- Vercel uses `pnpm`
- Vercel is configured with `ENABLE_EXPERIMENTAL_COREPACK=1`
- Preview deploys should stay consistent with local `pnpm@10.33.0`
- Local env files must not be deployed; `.vercelignore` excludes them

When verifying deploy behavior, prefer:

```bash
vercel deploy
vercel inspect <deployment-url>
```

## Local Env Notes

- `.env` exists locally for operator tooling, including Vercel token usage.
- `.env` is ignored by git and excluded from Vercel uploads.
- Do not commit secrets.

## Implementation Guidance

- Prefer stable selectors like `data-testid` when adding UI tests.
- Avoid brittle tests that depend on incidental class names or formatting.
- For geometry-sensitive UI, test real browser layout, not just component internals.
- For this repo, browser e2e tests are more valuable than unit tests for compare behavior.
