import { expect, test } from "@playwright/test";

// The map moved from the homepage to /places in the V2 redesign. The homepage now
// links to it, so this follows that real journey and still requires canvas and markers.
test("the homepage leads to the OpenFreeMap map with story markers", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Open the map" }).click();

  await expect(page).toHaveURL(/\/places\?.*view=map/);
  await expect(page.getByTestId("home-map")).toBeVisible();
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await expect(page.getByTestId("home-map-marker").first()).toBeVisible();

  const markerCount = await page.getByTestId("home-map-marker").count();
  expect(markerCount).toBeGreaterThan(0);
});
