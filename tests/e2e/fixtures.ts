import { expect, test as base } from "@playwright/test"

// The maps draw on OpenFreeMap's base map. Tests that open a map get a plain ground from here
// instead, so they neither wait on nor fail with someone else's server. A test that wants the
// base map to fail still says so itself: a route set inside a test is asked first.
const GROUND = {
  version: 8,
  sources: {},
  layers: [{ id: "ground", type: "background", paint: { "background-color": "#d9d4c8" } }],
}

export const test = base.extend<{ plainGround: void }>({
  plainGround: [
    async ({ page }, use) => {
      await page.route("**/tiles.openfreemap.org/**", (route) =>
        new URL(route.request().url()).pathname === "/styles/liberty"
          ? route.fulfill({ json: GROUND, headers: { "access-control-allow-origin": "*" } })
          : route.abort()
      )
      await use()
    },
    { auto: true },
  ],
})

export { expect }
export type { CDPSession, Page } from "@playwright/test"
