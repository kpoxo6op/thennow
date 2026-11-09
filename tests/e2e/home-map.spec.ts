import { expect, test } from "@playwright/test";

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
