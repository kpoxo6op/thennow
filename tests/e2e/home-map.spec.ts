import { expect, test } from "./fixtures";

// The map lives in Places. This follows the real journey from the homepage and still
// requires canvas and markers.
test("the homepage leads to the OpenFreeMap map with story markers", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("site-header").getByRole("link", { name: "Places", exact: true }).click();
  await page.getByRole("button", { name: "Map" }).click();

  await expect(page).toHaveURL(/\/places\?.*view=map/);
  await expect(page.getByTestId("home-map")).toBeVisible();
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await expect(page.getByTestId("home-map-marker").first()).toBeVisible();

  const markerCount = await page.getByTestId("home-map-marker").count();
  expect(markerCount).toBeGreaterThan(0);
});

test("the maps work in tests without any outside server", async ({ page }) => {
  const outside: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol.startsWith("http") && url.hostname !== "127.0.0.1") {
      outside.push(`${url.hostname}${url.pathname}`);
    }
  });

  await page.goto("/places?view=map");
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await expect(page.getByTestId("home-map-marker").first()).toBeVisible();
  await expect(page.getByTestId("map-failure")).toHaveCount(0);

  await page.goto("/mill-house");
  await page.getByTestId("story-map").scrollIntoViewIfNeeded();
  await expect(page.locator('[data-testid="story-map"] .maplibregl-canvas')).toBeVisible();
  await expect(page.getByTestId("story-map-pin")).toHaveCount(1);
  await expect(page.getByTestId("story-map-failure")).toHaveCount(0);

  // Only the base map's own address is asked for, and the test answers it.
  expect([...new Set(outside)]).toEqual(["tiles.openfreemap.org/styles/liberty"]);
});
