import fs from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

const postFolders = fs.readdirSync(path.join(process.cwd(), "public", "posts"));
const slugs = postFolders.map(
  (folder) =>
    JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "public", "posts", folder, `${folder}.json`), "utf8")
    ).slug as string
);

const visibleCards = "[data-testid=story-card]:not([hidden]) a";

test.describe("collection at scale", () => {
  test("every story is linked and the map stays legible", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("[data-testid=story-card] a")).toHaveCount(slugs.length);
    const hrefs = await page
      .locator("[data-testid=story-card] a")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    expect(new Set(hrefs)).toEqual(new Set(slugs.map((slug) => `/${slug}`)));

    await expect(page.getByTestId("home-map-marker").first()).toBeVisible();
    expect(await page.getByTestId("home-map-marker").count()).toBeLessThan(40);
    await expect(page).toHaveURL(/\/$/);
  });

  test("story routes all resolve", async ({ request }) => {
    test.setTimeout(120000);

    for (const slug of slugs) {
      const response = await request.get(`/${slug}`);
      expect(response.status(), slug).toBe(200);
    }
  });

  test("first load does not fetch every card image or full-size originals", async ({ page }) => {
    const imageRequests: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "image") {
        imageRequests.push(request.url());
      }
    });

    await page.goto("/");
    await expect(page.locator(visibleCards).first()).toBeVisible();
    await page.waitForLoadState("load");

    expect(imageRequests.length).toBeLessThan(40);
    expect(imageRequests.filter((url) => url.includes("/posts/") && !url.includes("_next/image"))).toEqual([]);
  });

  test("a group zooms in, narrows the list, and the list can be restored", async ({ page }) => {
    await page.goto("/");
    const cluster = page.locator(".tn-map-cluster").first();
    await expect(cluster).toBeVisible();
    await cluster.click();

    await expect(page.getByTestId("map-show-all")).toBeVisible();
    await expect(page).toHaveURL(/lat=.*lng=.*z=/);
    expect(await page.locator(visibleCards).count()).toBeLessThan(slugs.length);

    await page.getByTestId("map-show-all").click();
    await expect(page.locator(visibleCards)).toHaveCount(slugs.length);
    await expect(page.getByTestId("map-show-all")).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/);
  });

  test("the wordmark on a zoomed home page resets the view in place", async ({ page }) => {
    await page.goto("/?lat=-36.851754&lng=174.744417&z=13.5");
    await expect(page.getByTestId("map-show-all")).toBeVisible();

    await page.getByTestId("site-header").locator('a[href="/"]').click();
    await expect(page.locator(visibleCards)).toHaveCount(slugs.length);
    await expect(page).toHaveURL(/\/$/);
  });

  test("the wheel over the map keeps scrolling the page", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".tn-map-cluster").first()).toBeVisible();
    const map = await page.getByTestId("home-map").boundingBox();

    await page.mouse.move(map!.x + map!.width / 2, map!.y + map!.height / 2);
    await page.mouse.wheel(0, 800);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await expect(page).toHaveURL(/\/$/);
  });

  test("hovering a spot previews it and clicking opens the story", async ({ page }) => {
    await page.goto("/?lat=-36.851754&lng=174.744417&z=15.24");
    await expect(page.getByTestId("map-show-all")).toBeVisible();
    await expect(page.locator(".tn-map-marker").first()).toBeAttached();
    const map = await page.getByTestId("home-map").boundingBox();
    const box = await page.evaluate((rect) => {
      const marker = [...document.querySelectorAll(".tn-map-marker")]
        .map((element) => element.getBoundingClientRect())
        .find(
          (bounds) =>
            bounds.left > rect!.x + 60 &&
            bounds.right < rect!.x + rect!.width - 60 &&
            bounds.top > rect!.y + 60 &&
            bounds.bottom < rect!.y + rect!.height - 60
        );
      return marker ? { x: marker.x + marker.width / 2, y: marker.y + marker.height / 2 } : null;
    }, map);
    expect(box).not.toBeNull();

    await page.mouse.move(box!.x, box!.y);
    await expect(page.getByTestId("home-map-card")).toBeVisible();
    // Hovering must not displace the marker from under the pointer.
    await page.waitForTimeout(250);
    expect(
      await page.evaluate(
        ({ x, y }) => document.elementFromPoint(x, y)?.closest("a")?.dataset.testid,
        box!
      )
    ).toBe("home-map-marker");
    await page.mouse.click(box!.x, box!.y);
    await expect(page.getByTestId("compare-stage")).toBeVisible();
  });

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    test(`leaving a story returns to the same place at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto("/");
      await expect(page.locator(visibleCards)).toHaveCount(slugs.length);

      await page.evaluate(() => window.scrollTo(0, 6000));
      const link = page.locator(visibleCards).nth(
        await page.locator(visibleCards).evaluateAll((links) =>
          links.findIndex((element) => element.getBoundingClientRect().top > 200)
        )
      );
      await link.click();
      await expect(page.getByTestId("compare-stage")).toBeVisible();

      await page.getByTestId("site-header").locator('a[href="/"]').click();
      await expect(page.locator(visibleCards)).toHaveCount(slugs.length);
      await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBe(6000);
    });
  }

  test("a filtered list keeps its map view and position after leaving a story", async ({ page }) => {
    await page.goto("/?lat=-36.851754&lng=174.744417&z=13.5");
    await expect(page.getByTestId("map-show-all")).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 500));

    const link = page.locator(visibleCards).nth(
      await page.locator(visibleCards).evaluateAll((links) =>
        links.findIndex((element) => element.getBoundingClientRect().top > 200)
      )
    );
    await link.click();
    await expect(page.getByTestId("compare-stage")).toBeVisible();
    await page.goBack();

    await expect(page).toHaveURL(/z=13\.5/);
    await expect(page.getByTestId("map-show-all")).toBeVisible();
    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBe(500);
  });
});

test.describe("collection on touch", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test("show all returns a phone to the clean URL", async ({ page }) => {
    await page.goto("/");
    const cluster = page.locator(".tn-map-cluster").first();
    await expect(cluster).toBeVisible();
    await cluster.tap();
    await expect(page.getByTestId("map-show-all")).toBeVisible();

    await page.getByTestId("map-show-all").tap();
    await expect(page.locator(visibleCards)).toHaveCount(slugs.length);
    await expect(page).toHaveURL(/\/$/);
  });

  test("tapping a spot previews it and tapping the preview opens the story", async ({ page }) => {
    await page.goto("/?lat=-36.851754&lng=174.744417&z=15.24");
    await expect(page.getByTestId("map-show-all")).toBeVisible();
    await expect(page.locator(".tn-map-marker").first()).toBeAttached();

    const point = await page.evaluate(() => {
      const map = document.querySelector("[data-testid=home-map]")!.getBoundingClientRect();
      const marker = [...document.querySelectorAll(".tn-map-marker")]
        .map((element) => element.getBoundingClientRect())
        .find(
          (bounds) =>
            bounds.left > map.left + 60 &&
            bounds.right < map.right - 60 &&
            bounds.top > map.top + 60 &&
            bounds.bottom < map.bottom - 60
        );
      return marker ? { x: marker.x + marker.width / 2, y: marker.y + marker.height / 2 } : null;
    });
    expect(point).not.toBeNull();

    await page.touchscreen.tap(point!.x, point!.y);
    const card = page.getByTestId("home-map-card");
    await expect(card).toBeVisible();
    await expect(page.getByTestId("compare-stage")).toHaveCount(0);

    await card.tap();
    await expect(page.getByTestId("compare-stage")).toBeVisible();
  });
});

test.describe("navigation", () => {
  test("mobile menu opens from a real button and closes on navigation", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const menuButton = page.getByRole("button", { name: "Menu" });
    await menuButton.click();
    await expect(menuButton).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(page.locator("#mobile-menu")).toHaveCount(0);

    await menuButton.click();
    await page.locator("#mobile-menu").getByRole("link", { name: "About" }).click();
    await expect(page).toHaveURL(/\/about$/);
    await expect(page.locator("#mobile-menu")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "About" })).toBeVisible();
  });

  for (const route of ["/about", "/contact", "/links"]) {
    test(`${route} content sits below the header`, async ({ page }) => {
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);

      const header = await page.getByTestId("site-header").boundingBox();
      const heading = await page.locator("main h1").boundingBox();
      expect(heading!.y).toBeGreaterThanOrEqual(header!.y + header!.height);
    });
  }

  test("unknown routes offer the way home", async ({ page }) => {
    const response = await page.goto("/no-such-story");
    expect(response?.status()).toBe(404);
    await page.getByRole("link", { name: "All stories" }).click();
    await expect(page.getByTestId("home-map")).toBeVisible();
  });
});

test.describe("compare photograph", () => {
  test("shows the whole photograph with nothing over it", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/sheep");

    const image = await page.getByTestId("compare-overlay-image").boundingBox();
    expect(image!.width / image!.height).toBeCloseTo(4018 / 2298, 1);
    expect(image!.width).toBeCloseTo(390, 0);

    const slider = await page.getByTestId("compare-slider-input").boundingBox();
    expect(slider!.y).toBeGreaterThanOrEqual(image!.y + image!.height);
  });

  test("a tap clears the page without moving the reveal; dragging moves it", async ({ page }) => {
    await page.goto("/historic-post-office");
    const stage = page.getByTestId("compare-stage");
    const box = await stage.boundingBox();
    const x = box!.x + box!.width * 0.7;
    const y = box!.y + box!.height / 2;

    await page.mouse.click(x, y);
    await expect(page.getByTestId("compare-slider-input")).toHaveValue("50");
    await expect(page.locator(".tn-compare")).toHaveAttribute("data-focus", "true");

    await page.keyboard.press("Escape");
    await expect(page.locator(".tn-compare")).toHaveAttribute("data-focus", "false");

    await page.setViewportSize({ width: 390, height: 844 });
    const phoneStage = await stage.boundingBox();
    await page.mouse.click(195, phoneStage!.y + phoneStage!.height / 2);
    await expect(page.locator(".tn-compare")).toHaveAttribute("data-focus", "true");
    await page.mouse.click(195, 20);
    await expect(page.locator(".tn-compare")).toHaveAttribute("data-focus", "false");
    await page.setViewportSize({ width: 1280, height: 720 });
    const wideStage = await stage.boundingBox();
    expect(wideStage!.width).toBeGreaterThan(0);

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width * 0.3, y, { steps: 4 });
    await page.mouse.up();
    await expect(page.locator(".tn-compare")).toHaveAttribute("data-focus", "false");
    expect(Number(await page.getByTestId("compare-slider-input").inputValue())).toBeLessThan(50);
    await expect(page).toHaveURL(/\?p=\d+$/);
  });
});
