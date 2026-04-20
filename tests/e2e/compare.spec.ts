import { expect, test, type Page } from "@playwright/test";

const comparePath = "/historic-post-office";

async function dragSliderToPercent(page: Page, percent: number) {
  const input = page.getByTestId("compare-slider-input");
  const box = await input.boundingBox();

  if (!box) {
    throw new Error("compare slider input has no bounding box");
  }

  const targetX = box.x + box.width * (percent / 100);
  const targetY = box.y + box.height / 2;

  await page.mouse.move(targetX, targetY);
  await page.mouse.down();
  await page.mouse.move(targetX, targetY);
  await page.mouse.up();
}

test.describe("compare view", () => {
  test("loads default compare state without a query param", async ({ page }) => {
    await page.goto(comparePath);

    await expect(page).toHaveURL(new RegExp(`${comparePath}$`));
    await expect(page.getByTestId("compare-slider-input")).toHaveValue("50");
  });

  test("reads compare state from the URL", async ({ page }) => {
    await page.goto(`${comparePath}?p=30`);

    await expect(page).toHaveURL(new RegExp(`${comparePath}\\?p=30$`));
    await expect(page.getByTestId("compare-slider-input")).toHaveValue("30");
  });

  test("dragging the slider updates the URL and keeps the before image fixed", async ({ page }) => {
    await page.goto(comparePath);

    const beforeImage = page.getByTestId("compare-overlay-image");
    const beforeBox = await beforeImage.boundingBox();

    if (!beforeBox) {
      throw new Error("before image has no bounding box");
    }

    await dragSliderToPercent(page, 30);

    await expect(page).toHaveURL(new RegExp(`${comparePath}\\?p=30$`));
    await expect(page.getByTestId("compare-slider-input")).toHaveValue("30");

    const afterBox = await beforeImage.boundingBox();

    if (!afterBox) {
      throw new Error("before image has no bounding box after drag");
    }

    expect(afterBox.x).toBeCloseTo(beforeBox.x, 1);
    expect(afterBox.width).toBeCloseTo(beforeBox.width, 1);
  });

  test("slider knob stays aligned with the visual compare border on desktop", async ({ page }) => {
    await page.goto(`${comparePath}?p=30`);
    await expect(page.getByTestId("compare-slider-input")).toHaveValue("30");

    const geometry = await page.evaluate(() => {
      const knob = document.querySelector<HTMLElement>('[data-testid="compare-slider-knob"]');
      const overlay = document.querySelector<HTMLElement>('[data-testid="compare-overlay"]');

      if (!knob || !overlay) {
        return null;
      }

      const knobRect = knob.getBoundingClientRect();
      const overlayStyle = overlay.getAttribute("style") ?? "";
      const match =
        overlayStyle.match(/inset\(0px\s+([0-9.]+)px\s+0px\s+0px\)/) ??
        overlayStyle.match(/inset\(0\s+([0-9.]+)px\s+0\s+0\)/);

      if (!match) {
        return null;
      }

      const rightInset = Number(match[1]);
      const borderX = window.innerWidth - rightInset;
      const knobCenterX = knobRect.left + knobRect.width / 2;

      return {
        knobCenterX,
        borderX,
        delta: Math.abs(knobCenterX - borderX),
      };
    });

    expect(geometry).not.toBeNull();
    expect(geometry?.delta ?? 999).toBeLessThanOrEqual(1);
  });

  test("slider keeps safe side margins on mobile and still aligns with the compare border", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${comparePath}?p=30`);
    await expect(page.getByTestId("compare-slider-input")).toHaveValue("30");

    const geometry = await page.evaluate(() => {
      const input = document.querySelector<HTMLElement>('[data-testid="compare-slider-input"]');
      const knob = document.querySelector<HTMLElement>('[data-testid="compare-slider-knob"]');
      const overlay = document.querySelector<HTMLElement>('[data-testid="compare-overlay"]');

      if (!input || !knob || !overlay) {
        return null;
      }

      const inputRect = input.getBoundingClientRect();
      const knobRect = knob.getBoundingClientRect();
      const overlayStyle = overlay.getAttribute("style") ?? "";
      const match =
        overlayStyle.match(/inset\(0px\s+([0-9.]+)px\s+0px\s+0px\)/) ??
        overlayStyle.match(/inset\(0\s+([0-9.]+)px\s+0\s+0\)/);

      if (!match) {
        return null;
      }

      const rightInset = Number(match[1]);
      const borderX = window.innerWidth - rightInset;
      const knobCenterX = knobRect.left + knobRect.width / 2;

      return {
        inputLeft: inputRect.left,
        inputRight: window.innerWidth - inputRect.right,
        delta: Math.abs(knobCenterX - borderX),
      };
    });

    expect(geometry).not.toBeNull();
    expect(geometry?.inputLeft ?? 0).toBeGreaterThanOrEqual(39);
    expect(geometry?.inputRight ?? 0).toBeGreaterThanOrEqual(39);
    expect(geometry?.delta ?? 999).toBeLessThanOrEqual(1);
  });
});
