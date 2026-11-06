import { expect, test } from "@playwright/test"

test.describe("a story page", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } })

  test("the legend shows each whole photograph and returns to the comparison", async ({ page }) => {
    await page.goto("/sheep")
    const input = page.getByTestId("compare-slider-input")
    const then = page.getByTestId("story-show-then")
    const now = page.getByTestId("story-show-now")

    await then.click()
    await expect(input).toHaveValue("100")
    await expect(page).toHaveURL(/\/sheep\?p=100$/)
    await expect(then).toHaveAttribute("aria-pressed", "true")

    await now.focus()
    await page.keyboard.press("Enter")
    await expect(input).toHaveValue("0")
    await expect(page).toHaveURL(/\/sheep\?p=0$/)

    await page.keyboard.press("Enter")
    await expect(input).toHaveValue("50")
    await expect(page).toHaveURL(/\/sheep$/)
  })

  test("a real story moves on to the next real story, never a sample", async ({ page }) => {
    await page.goto("/mill-house")
    await expect(page.getByText("Sample", { exact: true })).toHaveCount(0)
    await page.getByRole("link", { name: "Corner of Rata Street and Commercial Road, Helensville" }).last().click()
    await expect(page).toHaveURL(/\/sheep$/)
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Rata Street")
  })

  test("a sample says so on the photograph and leads to the real story behind it", async ({ page }) => {
    await page.goto("/demo-017")
    await expect(page.getByText("Sample place, placeholder photographs")).toBeVisible()
    await page.getByRole("link", { name: "Mission Bay Yacht Club, Auckland" }).last().click()
    await expect(page).toHaveURL(/\/mission-bay-yacht-club$/)
    await expect(page.getByText("Sample place.")).toHaveCount(0)
  })
})
