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

Current e2e coverage includes:

- default compare state
- URL-driven compare state
- slider drag updates URL
- before image stays fixed
- knob/border alignment
- mobile safe margins
- desktop header edge spacing

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
