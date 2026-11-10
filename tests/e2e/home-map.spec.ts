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

test("the map's styles come with map pages only, and the site's own touches still win", async ({ page }) => {
  const hasMapStyles = () =>
    page.evaluate(() =>
      Array.from(document.styleSheets).some((sheet) => {
        try {
          return Array.from(sheet.cssRules).some((rule) => rule.cssText.includes(".maplibregl-map"));
        } catch {
          return false;
        }
      })
    );

  await page.goto("/about");
  expect(await hasMapStyles()).toBe(false);
  await page.goto("/");
  expect(await hasMapStyles()).toBe(false);

  // Arriving at the map from the homepage, without a full page load.
  await page.getByTestId("site-header").getByRole("link", { name: "Places", exact: true }).click();
  await page.getByRole("button", { name: "Map" }).click();
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  expect(await hasMapStyles()).toBe(true);

  // The library's own look, as the site adjusts it.
  const zoomIn = page.locator(".tn-map .maplibregl-ctrl-group button").first();
  await expect(zoomIn).toHaveCSS("width", "44px");
  await expect(zoomIn).toHaveCSS("height", "44px");
  await expect(page.locator(".tn-map .maplibregl-canvas")).not.toHaveCSS("filter", "none");
  await expect(page.locator(".tn-map .maplibregl-map")).toHaveCSS("position", "relative");

  // And on a place's own page, loaded directly.
  await page.goto("/mill-house");
  expect(await hasMapStyles()).toBe(true);
  await page.getByTestId("story-map").scrollIntoViewIfNeeded();
  const canvas = page.locator('[data-testid="story-map"] .maplibregl-canvas');
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveCSS("touch-action", "pan-y");
});
