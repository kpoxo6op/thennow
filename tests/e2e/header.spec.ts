import { expect, test } from "@playwright/test";

test("desktop header reaches the right edge with matching left/right padding", async ({ page }) => {
  await page.goto("/historic-post-office");

  const headerGeometry = await page.evaluate(() => {
    const title = document.querySelector('[data-testid="site-header"] a[href="/"]');
    const linksLink = Array.from(document.querySelectorAll('[data-testid="site-header"] a')).find(
      (link) => link.textContent?.trim() === "Links"
    );

    if (!title || !linksLink) {
      return null;
    }

    const titleRect = title.getBoundingClientRect();
    const linksRect = linksLink.getBoundingClientRect();

    return {
      leftInset: titleRect.left,
      rightInset: window.innerWidth - linksRect.right,
      insetDelta: Math.abs(titleRect.left - (window.innerWidth - linksRect.right)),
    };
  });

  expect(headerGeometry).not.toBeNull();
  expect(headerGeometry?.rightInset ?? 999).toBeLessThanOrEqual(20);
  expect(headerGeometry?.insetDelta ?? 999).toBeLessThanOrEqual(8);
});
