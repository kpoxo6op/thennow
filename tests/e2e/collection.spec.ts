import fs from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

const postFolders = fs.readdirSync(path.join(process.cwd(), "public", "posts"));
const slugs = postFolders.map(
  (folder) =>
    JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "public", "posts", folder, `${folder}.json`), "utf8")
    ).slug as string
);

const places = "[data-testid=story-card]";
const shownPlaces = `${places}:not([hidden])`;

async function openGroup(page: Page, name: string) {
  const group = page.getByTestId("places-group").filter({ hasText: name });
  await group.locator("summary").click();
  await expect(group.locator(`${places} a`).first()).toBeVisible();
  return group;
}

async function visibleMarkerCenter(page: Page) {
  const center = await page.evaluate(() => {
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
  expect(center).not.toBeNull();
  return center!;
}

test.describe("homepage", () => {
  test("opens on a comparison a visitor can use straight away", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const stage = page.getByTestId("compare-stage");
    await expect(stage).toBeInViewport();

    const input = page.getByTestId("compare-slider-input");
    await expect(input).toHaveValue("50");

    const box = await stage.boundingBox();
    await page.mouse.move(box!.x + box!.width * 0.5, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width * 0.25, box!.y + box!.height / 2, { steps: 4 });
    await page.mouse.up();
    await expect(input).toHaveValue("25");

    await input.focus();
    await page.keyboard.press("ArrowRight");
    await expect(input).toHaveValue("26");
    await expect(page).toHaveURL(/\/$/);
  });

  test("shows the line moving once, unless motion is reduced", async ({ page }) => {
    await page.goto("/");
    await expect
      .poll(() => page.getByTestId("compare-slider-input").inputValue(), { timeout: 4000 })
      .not.toBe("50");

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.waitForTimeout(1500);
    await expect(page.getByTestId("compare-slider-input")).toHaveValue("50");
  });
});

test.describe("finding a place", () => {
  test("all stories are real links and every route resolves", async ({ page, request }) => {
    test.setTimeout(120000);
    await page.goto("/");

    const hrefs = await page
      .locator(`${places} a`)
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    expect(hrefs).toHaveLength(slugs.length);
    expect(new Set(hrefs)).toEqual(new Set(slugs.map((slug) => `/${slug}`)));

    for (const slug of slugs) {
      const response = await request.get(`/${slug}`);
      expect(response.status(), slug).toBe(200);
    }
  });

  test("first load fetches neither every thumbnail nor full-size originals", async ({ page }) => {
    const imageRequests: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "image") {
        imageRequests.push(request.url());
      }
    });

    await page.goto("/");
    await page.waitForLoadState("load");
    expect(imageRequests.length).toBeLessThan(40);
    expect(imageRequests.filter((url) => url.includes("/posts/") && !url.includes("_next/image"))).toEqual([]);
  });

  test("search narrows the list and map, stays in the URL, and can be cleared", async ({ page }) => {
    await page.goto("/");
    const search = page.getByTestId("places-search");

    await search.fill("yacht");
    await expect(page.locator(shownPlaces)).toHaveCount(1);
    await expect(page.locator(`${shownPlaces} a`)).toHaveAttribute("href", "/mission-bay-yacht-club");
    await expect(page.getByTestId("places-status")).toContainText("1 of 306");
    await expect(page).toHaveURL(/q=yacht/);
    await expect.poll(() => page.getByTestId("home-map-marker").count()).toBe(1);

    await page.reload();
    await expect(page.getByTestId("places-search")).toHaveValue("yacht");
    await expect(page.locator(shownPlaces)).toHaveCount(1);

    await page.getByTestId("places-search").fill("zzzz");
    await expect(page.getByTestId("places-empty")).toBeVisible();
    await page.getByRole("button", { name: "Show all places" }).click();
    await expect(page.locator(shownPlaces)).toHaveCount(slugs.length);
    await expect(page).not.toHaveURL(/q=/);
  });

  test("a sample group opens and its stories can be reached", async ({ page }) => {
    await page.goto("/");
    const group = await openGroup(page, "Upper harbour");
    await group.locator(`${places} a`).first().click();

    await expect(page.getByTestId("story-next")).toBeVisible();
    await expect(page.getByTestId("sample-note")).toBeVisible();
  });

  test("a map group zooms in, narrows the list, and the view can be restored", async ({ page }) => {
    await page.goto("/");
    const cluster = page.locator(".tn-map-cluster").first();
    await expect(cluster).toBeAttached();
    await cluster.scrollIntoViewIfNeeded();
    await cluster.click();

    await expect(page.getByTestId("map-show-all")).toBeVisible();
    await expect(page).toHaveURL(/lat=.*lng=.*z=/);
    expect(await page.locator(shownPlaces).count()).toBeLessThan(slugs.length);

    await page.getByTestId("map-show-all").click();
    await expect(page.locator(shownPlaces)).toHaveCount(slugs.length);
    await expect(page).not.toHaveURL(/lat=/);
  });

  test("hovering a row or spot previews it; clicking a spot opens it", async ({ page }) => {
    await page.goto("/?lat=-36.851754&lng=174.744417&z=15.24#places");
    await expect(page.getByTestId("map-show-all")).toBeVisible();

    await page.locator(`${shownPlaces} a`).first().hover();
    await expect(page.getByTestId("home-map-card")).toBeVisible();
    await page.mouse.move(0, 0);
    await expect(page.getByTestId("home-map-card")).toHaveCount(0);

    const center = await visibleMarkerCenter(page);
    await page.mouse.move(center.x, center.y);
    await expect(page.getByTestId("home-map-card")).toBeVisible();
    await page.waitForTimeout(250);
    expect(
      await page.evaluate(
        ({ x, y }) => document.elementFromPoint(x, y)?.closest("a")?.dataset.testid,
        center
      )
    ).toBe("home-map-marker");
    await page.mouse.click(center.x, center.y);
    await expect(page.getByTestId("story-next")).toBeVisible();
    await expect(page).not.toHaveURL(/lat=/);
  });

  test("the wheel over the map keeps scrolling the page", async ({ page }) => {
    await page.goto("/#places");
    await expect(page.locator(".tn-map-cluster").first()).toBeVisible();
    const before = await page.evaluate(() => window.scrollY);
    const map = await page.getByTestId("home-map").boundingBox();

    await page.mouse.move(map!.x + map!.width / 2, map!.y + map!.height / 2);
    await page.mouse.wheel(0, 300);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before);
    await expect(page).not.toHaveURL(/lat=/);
  });

  test("the wordmark on a narrowed home page resets it in place", async ({ page }) => {
    await page.goto("/?lat=-36.851754&lng=174.744417&z=13.5&q=bay");
    await expect(page.getByTestId("places-search")).toHaveValue("bay");

    await page.getByTestId("site-header").locator('a[href="/"]').click();
    await expect(page.getByTestId("places-search")).toHaveValue("");
    await expect(page.locator(shownPlaces)).toHaveCount(slugs.length);
    await expect(page).toHaveURL(/\/$/);
  });

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    test(`leaving a story returns to the same list place at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto("/");
      const group = await openGroup(page, "City fringe");
      const row = group.locator(`${places} a`).nth(30);
      await row.scrollIntoViewIfNeeded();
      const before = await page.evaluate(() => Math.round(window.scrollY));
      expect(before).toBeGreaterThan(0);

      await row.click();
      await expect(page.getByTestId("story-next")).toBeVisible();
      await page.getByTestId("site-header").locator('a[href="/"]').click();

      await expect(group.locator(`${places} a`).nth(30)).toBeVisible();
      await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBe(before);
    });
  }

  test("a map view keeps its position through a story and browser back", async ({ page }) => {
    await page.goto("/?lat=-36.851754&lng=174.744417&z=13.5");
    await expect(page.getByTestId("map-show-all")).toBeVisible();
    const link = page.locator(`${shownPlaces} a`).nth(12);
    await link.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => Math.round(window.scrollY));
    await link.click();
    await expect(page.getByTestId("story-next")).toBeVisible();
    await page.goBack();

    await expect(page).toHaveURL(/z=13\.5/);
    await expect(page.getByTestId("map-show-all")).toBeVisible();
    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBe(before);
  });

  test("back from a story after the hero link needs one step and no reload", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      (window as unknown as { sameDocument: boolean }).sameDocument = true;
    });
    await page.getByRole("link", { name: "Find a place" }).click();
    const group = await openGroup(page, "Stories");
    await group.locator(`${places} a`).first().click();
    await expect(page.getByTestId("story-next")).toBeVisible();

    await page.goBack();
    await expect(page.getByTestId("places-search")).toBeVisible();
    await expect(page.getByTestId("story-next")).toHaveCount(0);
    expect(
      await page.evaluate(() => (window as unknown as { sameDocument?: boolean }).sameDocument)
    ).toBe(true);
  });

  test("back, forward and back keep the opened group and position", async ({ page }) => {
    await page.goto("/");
    const group = await openGroup(page, "Western bays");
    const row = group.locator(`${places} a`).nth(20);
    await row.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => Math.round(window.scrollY));
    await row.click();
    await expect(page.getByTestId("story-next")).toBeVisible();

    await page.goBack();
    await expect(row).toBeVisible();
    await page.goForward();
    await expect(page.getByTestId("story-next")).toBeVisible();
    await page.goBack();

    await expect(row).toBeVisible();
    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBe(before);
  });

  test("a story reached by next does not send the wordmark to another story", async ({ page }) => {
    await page.goto("/");
    const group = await openGroup(page, "Stories");
    await group.locator(`${places} a`).first().click();
    await expect(page.getByTestId("story-next")).toBeVisible();
    const first = page.url();

    await page.getByTestId("story-next").click();
    await expect(page).not.toHaveURL(first);
    await page.getByTestId("story-previous").click();
    await expect(page).toHaveURL(first);

    await page.getByTestId("site-header").locator('a[href="/"]').click();
    await expect(page).toHaveURL(/\/#places$/);
    await expect(page.getByTestId("places-search")).toBeInViewport();
  });

  test("the map still offers the list when its tiles fail", async ({ page }) => {
    await page.route("https://tiles.openfreemap.org/**", (route) => route.abort());
    await page.goto("/#places");

    await expect(page.getByText("Map tiles could not load")).toBeVisible();
    await expect(page.getByTestId("home-map-marker").first()).toBeAttached();
    await expect(page.locator(`${places} a`)).toHaveCount(slugs.length);
  });
});

test.describe("on a phone", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test("the list comes first and the map is one tap away, in the URL", async ({ page }) => {
    await page.goto("/#places");
    await expect(page.getByTestId("places-map-pane")).toBeHidden();

    await page.getByTestId("places-view-toggle").tap();
    await expect(page.getByTestId("places-map-pane")).toBeVisible();
    await expect(page.getByTestId("story-list")).toBeHidden();
    await expect(page).toHaveURL(/view=map/);
    await expect(page.locator(".tn-map-cluster").first()).toBeVisible();

    await page.getByTestId("places-view-toggle").tap();
    await expect(page.getByTestId("story-list")).toBeVisible();
    await expect(page).not.toHaveURL(/view=map/);
  });

  test("tapping a spot previews it and tapping the preview opens the story", async ({ page }) => {
    await page.goto("/?lat=-36.851754&lng=174.744417&z=15.24&view=map");
    await expect(page.locator(".tn-map-marker").first()).toBeAttached();

    const center = await visibleMarkerCenter(page);
    await page.touchscreen.tap(center.x, center.y);
    const card = page.getByTestId("home-map-card");
    await expect(card).toBeVisible();
    await expect(page.getByTestId("story-next")).toHaveCount(0);

    await card.tap();
    await expect(page.getByTestId("story-next")).toBeVisible();
  });

  test("returning to a search restores the list position", async ({ page }) => {
    await page.goto("/?q=e");
    await expect(page.locator(shownPlaces).first()).toBeAttached();
    const row = page.locator(`${shownPlaces} a`).nth(60);
    await row.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => Math.round(window.scrollY));
    expect(before).toBeGreaterThan(1500);
    await page.evaluate(() => {
      window.history.scrollRestoration = "manual";
    });
    await row.tap();
    await expect(page.getByTestId("story-next")).toBeVisible();
    await page.goBack();

    await expect(page.getByTestId("places-search")).toHaveValue("e");
    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBe(before);
  });

  test("hiding a moved map does not narrow the list to a guess", async ({ page }) => {
    await page.goto("/?lat=-36.85&lng=174.75&z=11&view=map");
    await expect(page.getByTestId("map-show-all")).toBeVisible();
    const shownOnMap = await page.locator(shownPlaces).count();

    await page.getByTestId("places-view-toggle").tap();
    await expect(page.getByTestId("story-list")).toBeVisible();
    await page.waitForTimeout(500);
    expect(await page.locator(shownPlaces).count()).toBe(shownOnMap);

    await page.getByTestId("list-show-all").tap();
    await expect(page.locator(shownPlaces)).toHaveCount(slugs.length);
  });

  test("a search with no results says so on the map too", async ({ page }) => {
    await page.goto("/?q=zzzqqq&view=map");
    await expect(page.getByTestId("places-map-pane").getByText("Nothing matches")).toBeVisible();
    await page.getByTestId("places-map-pane").getByRole("button", { name: "Show all places" }).tap();
    await expect(page.getByTestId("places-search")).toHaveValue("");
  });

  test("a tap on the photo moves the reveal", async ({ page }) => {
    await page.goto("/historic-post-office");
    const box = await page.getByTestId("compare-stage").boundingBox();

    await page.touchscreen.tap(195 + 80, box!.y + box!.height / 2);
    await expect(page.getByTestId("compare-slider-input")).not.toHaveValue("50");
    await expect(page).toHaveURL(/\?p=\d+$/);
  });

  test("the photo stays in view while the story is read", async ({ page }) => {
    await page.goto("/mill-house");
    await page.evaluate(() => window.scrollTo(0, 400));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await expect(page.getByTestId("compare-stage")).toBeInViewport({ ratio: 1 });
  });
});

test.describe("comparison ends on a phone", () => {
  test.use({ hasTouch: true, isMobile: true });

  for (const width of [390, 320]) {
    test(`0 and 100 show one photograph whole at ${width}px, from a safe drag`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/mill-house");
      const input = page.getByTestId("compare-slider-input");
      await expect(input).toHaveValue("50");

      const state = () =>
        page.evaluate(() => {
          const overlay = document.querySelector<HTMLElement>("[data-testid=compare-overlay]")!;
          const stage = document.querySelector<HTMLElement>("[data-testid=compare-stage]")!.getBoundingClientRect();
          const knob = document.querySelector<HTMLElement>("[data-testid=compare-slider-knob]")!.getBoundingClientRect();
          const box = document.querySelector<HTMLElement>("[data-testid=compare-slider-input]")!.getBoundingClientRect();
          const inset = overlay.style.clipPath.match(/inset\(0(?:px)?(?: ([0-9.]+)(?:px)? 0(?:px)? 0(?:px)?)?\)/);
          return {
            shownThen: inset ? stage.width - Number(inset[1] ?? 0) : NaN,
            stageWidth: stage.width,
            knobCenter: knob.left + knob.width / 2,
            inputLeft: box.left,
            inputRight: window.innerWidth - box.right,
            scrollX: window.scrollX,
          };
        });

      // A real touch drag, starting and ending inside the safe margins.
      const client = await page.context().newCDPSession(page);
      const stageBox = await page.getByTestId("compare-stage").boundingBox();
      const y = stageBox!.y + stageBox!.height / 2;
      const drag = async (from: number, to: number) => {
        await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: from, y }] });
        for (let step = 1; step <= 6; step += 1) {
          const x = from + ((to - from) * step) / 6;
          await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] });
        }
        await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      };

      await drag(width / 2, width - 40);
      await expect(input).toHaveValue("100");
      await expect(page).toHaveURL(/\?p=100$/);
      let end = await state();
      expect(end.shownThen).toBeCloseTo(end.stageWidth, 0);
      expect(end.knobCenter).toBeCloseTo(width - 40, 0);

      await drag(width - 60, 40);
      await expect(input).toHaveValue("0");
      await expect(page).toHaveURL(/\?p=0$/);
      end = await state();
      expect(end.shownThen).toBeCloseTo(0, 0);
      expect(end.knobCenter).toBeCloseTo(40, 0);

      // The control keeps its margins, and the page never moved sideways.
      expect(end.inputLeft).toBeGreaterThanOrEqual(39);
      expect(end.inputRight).toBeGreaterThanOrEqual(39);
      expect(end.scrollX).toBe(0);

      // A shared link and the keyboard reach the same ends.
      await page.goto("/mill-house?p=100");
      await expect(input).toHaveValue("100");
      await expect.poll(async () => (await state()).shownThen).toBeCloseTo(width, 0);
      await input.focus();
      await page.keyboard.press("Home");
      await expect(input).toHaveValue("0");
      await expect.poll(async () => (await state()).shownThen).toBeCloseTo(0, 0);
    });
  }

  test("partial positions stay where they were, with grip and line together", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    for (const position of [5, 30, 95]) {
      await page.goto(`/mill-house?p=${position}`);
      await expect(page.getByTestId("compare-slider-input")).toHaveValue(String(position));

      const expected = 40 + (position / 100) * 310;
      await expect
        .poll(() =>
          page.evaluate(() => {
            const center = (id: string) => {
              const box = document.querySelector(`[data-testid=${id}]`)!.getBoundingClientRect();
              return box.left + box.width / 2;
            };
            return [center("compare-slider-knob"), center("compare-divider")];
          })
        )
        .toEqual([expect.closeTo(expected, 0), expect.closeTo(expected, 0)]);
    }
  });
});

test.describe("story page", () => {
  test("shows the whole photograph with nothing over its centre text", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/sheep");

    const image = await page.getByTestId("compare-overlay-image").boundingBox();
    expect(image!.width / image!.height).toBeCloseTo(4018 / 2298, 1);
    expect(image!.width).toBeCloseTo(390, 0);
  });

  test("desktop fits photo, text and next steps on one screen", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/sheep");

    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(900);
    await expect(page.getByTestId("compare-stage")).toBeInViewport();
    await expect(page.getByTestId("story-next")).toBeInViewport();
  });

  test("a click moves the reveal, and full screen can be entered and left", async ({ page }) => {
    await page.goto("/historic-post-office");
    const box = await page.getByTestId("compare-stage").boundingBox();

    await page.mouse.click(box!.x + 200, box!.y + box!.height / 2);
    await expect(page.getByTestId("compare-slider-input")).not.toHaveValue("50");
    const value = await page.getByTestId("compare-slider-input").inputValue();

    const expand = page.getByTestId("compare-expand");
    await expand.click();
    const close = page.getByTestId("compare-close");
    await expect(close).toBeFocused();
    await expect(page.getByTestId("compare-slider-input")).toHaveValue(value);

    await page.keyboard.press("Escape");
    await expect(close).toHaveCount(0);
    await expect(expand).toBeFocused();

    await expand.click();
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("compare-slider-input")).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(page.getByTestId("compare-close")).toBeFocused();
    await page.getByTestId("compare-close").click();
    await expect(page.getByTestId("compare-close")).toHaveCount(0);
  });

  test("next, previous and nearby lead on, and sample places say what they are", async ({ page }) => {
    await page.goto("/demo-150");
    await expect(page.getByTestId("sample-note")).toBeVisible();

    await page.getByTestId("story-next").click();
    await expect(page).toHaveURL(/\/demo-151$/);
    await expect(page.getByTestId("compare-slider-input")).toHaveValue("50");
    await page.getByTestId("story-previous").click();
    await expect(page).toHaveURL(/\/demo-150$/);

    await page.goto("/sheep");
    await expect(page.getByTestId("sample-note")).toHaveCount(0);
  });

  test("on the map opens the map at this place", async ({ page }) => {
    await page.goto("/sheep");
    await page.getByRole("link", { name: "On the map" }).click();

    await expect(page).toHaveURL(/lat=-36\.6779.*z=15/);
    await expect(page.getByTestId("home-map")).toBeVisible();
    await expect(page.getByTestId("map-show-all")).toBeVisible();
    await expect(page.getByTestId("home-map-card")).toContainText("Rata Street");
    await expect(page.locator(".maplibregl-ctrl-zoom-in")).toBeInViewport();
  });

  test("story text fits narrow screens without losing any of it", async ({ page }) => {
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });

      for (const slug of [
        "mill-house",
        "sheep",
        "historic-post-office",
        "mission-bay-fountain",
        "mission-bay-yacht-club",
        "mission-house",
        "demo-017",
      ]) {
        await page.goto(`/${slug}`);
        const label = `${slug} at ${width}px`;

        const layout = await page.evaluate(() => {
          const range = document.createRange();
          range.selectNodeContents(document.querySelector("main")!);
          const text = range.getBoundingClientRect();

          return {
            overflow: document.documentElement.scrollWidth - window.innerWidth,
            textLeft: text.left,
            textRight: text.right,
            innerWidth: window.innerWidth,
          };
        });

        expect(layout.overflow, label).toBeLessThanOrEqual(0);
        expect(layout.textLeft, label).toBeGreaterThanOrEqual(0);
        expect(layout.textRight, label).toBeLessThanOrEqual(layout.innerWidth);
      }
    }

    await page.goto("/mill-house");
    await expect(page.locator("main")).toContainText(
      "kura.aucklandlibraries.govt.nz/digital/collection/photos/id/47325/rec/38"
    );
  });
});

test.describe("keyboard on the map", () => {
  test("a spot previews on focus, closes on Escape and opens on Enter", async ({ page }) => {
    await page.goto("/?lat=-36.851754&lng=174.744417&z=15.24");
    await expect(page.getByTestId("map-show-all")).toBeVisible();

    const marker = page.locator('.tn-map-marker[tabindex="0"]').first();
    await marker.focus();
    await expect(page.getByTestId("home-map-card")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("home-map-card")).toHaveCount(0);

    await page.keyboard.press("Enter");
    await expect(page.getByTestId("story-next")).toBeVisible();
  });

  test("markers outside the view take no keyboard focus", async ({ page }) => {
    await page.goto("/?lat=-36.851754&lng=174.744417&z=13.5");
    await expect(page.getByTestId("map-show-all")).toBeVisible();

    const strays = await page.evaluate(() => {
      const map = document.querySelector("[data-testid=home-map]")!.getBoundingClientRect();
      return [...document.querySelectorAll<HTMLElement>("[data-testid=home-map-marker]")].filter((marker) => {
        const box = marker.getBoundingClientRect();
        const inside = box.right > map.left && box.left < map.right && box.bottom > map.top && box.top < map.bottom;
        return !inside && marker.tabIndex === 0;
      }).length;
    });
    expect(strays).toBe(0);
  });
});

test.describe("secondary pages", () => {
  for (const route of ["/about", "/links"]) {
    test(`${route} is reachable from the site and clears the header`, async ({ page }) => {
      await page.goto("/");
      const footerLink = page.locator(`footer a[href="${route}"], header a[href="${route}"]`).first();
      await footerLink.click();
      await expect(page).toHaveURL(new RegExp(`${route}$`));

      const header = await page.getByTestId("site-header").boundingBox();
      const heading = await page.locator("main h1").boundingBox();
      expect(heading!.y).toBeGreaterThanOrEqual(header!.y + header!.height);
    });
  }

  test("sources lists what the captions cite, each with its story", async ({ page }) => {
    await page.goto("/links");
    const sources = page.getByTestId("source");
    await expect(sources).toHaveCount(2);

    const millHouse = sources.filter({ hasText: "kura.aucklandlibraries.govt.nz" });
    await expect(millHouse.locator("a").first()).toHaveAttribute(
      "href",
      "https://kura.aucklandlibraries.govt.nz/digital/collection/photos/id/47325/rec/38"
    );
    await millHouse.getByRole("link", { name: "Mill House, Auckland" }).click();
    await expect(page).toHaveURL(/\/mill-house$/);
  });

  test("no empty destination is advertised, and the old contact address still lands", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "Contact" })).toHaveCount(0);
    await expect(page.getByText("Coming soon")).toHaveCount(0);

    await page.goto("/contact");
    await expect(page).toHaveURL(/\/about$/);
    await expect(page.getByRole("heading", { name: "About" })).toBeVisible();
  });

  test("unknown routes offer the way back", async ({ page }) => {
    const response = await page.goto("/no-such-story");
    expect(response?.status()).toBe(404);
    await page.getByRole("link", { name: "All places" }).click();
    await expect(page.getByTestId("places-search")).toBeVisible();
  });
});
