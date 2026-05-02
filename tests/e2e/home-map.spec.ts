import { expect, test } from "@playwright/test";

test("homepage renders the OpenFreeMap map with story markers", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("home-map")).toBeVisible();
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await expect(page.getByTestId("home-map-marker").first()).toBeVisible();

  const markerCount = await page.getByTestId("home-map-marker").count();
  expect(markerCount).toBeGreaterThan(0);
});
