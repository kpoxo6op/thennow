import { expect, test } from "@playwright/test"

test("desktop header reaches the right edge with matching left/right padding", async ({
  page,
}) => {
  await page.goto("/historic-post-office")

  const headerGeometry = await page.evaluate(() => {
    const title = document.querySelector(
      '[data-testid="site-header"] a[href="/"]'
    )
    // Contact and Links left the navigation, so About is now the right-most item.
    const linksLink = Array.from(
      document.querySelectorAll('[data-testid="site-header"] a')
    ).find((link) => link.textContent?.trim() === "About")

    if (!title || !linksLink) {
      return null
    }

    const titleRect = title.getBoundingClientRect()
    const linksRect = linksLink.getBoundingClientRect()

    return {
      leftInset: titleRect.left,
      rightInset: window.innerWidth - linksRect.right,
      insetDelta: Math.abs(
        titleRect.left - (window.innerWidth - linksRect.right)
      ),
    }
  })

  expect(headerGeometry).not.toBeNull();
  expect(headerGeometry?.rightInset ?? 999).toBeLessThanOrEqual(20);
  expect(headerGeometry?.insetDelta ?? 999).toBeLessThanOrEqual(8);
});

test("the site is one dark room, whatever the device prefers", async ({ browser, baseURL }) => {
  for (const colorScheme of ["light", "dark"] as const) {
    const context = await browser.newContext({ colorScheme, baseURL });
    const page = await context.newPage();
    await page.goto("/about");
    await expect(page.locator("html")).toHaveClass(/(^|\s)dark(\s|$)/);
    await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(20, 18, 16)");
    await context.close();
  }
});
