import { expect, test } from "@playwright/test"

// What must hold in an iPhone's browser engine. Run with the "webkit" project only (see
// playwright.config.ts). Everything else is tested in Chromium.

const STORY = "/historic-post-office"

test("a story opens at the position its address names, and at the middle without one", async ({
  page,
}) => {
  await page.goto(`${STORY}?p=30`)
  await expect(page.getByTestId("compare-slider-input")).toHaveValue("30")
  await expect(page).toHaveURL(/\?p=30$/)

  await page.goto(STORY)
  await expect(page.getByTestId("compare-slider-input")).toHaveValue("50")
  await expect(page).toHaveURL(new RegExp(`${STORY}$`))
})

test("a long drag never breaks the page, and the address ends on where the line rests", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(String(error)))
  await page.goto(STORY)
  const input = page.getByTestId("compare-slider-input")
  await expect(input).toHaveValue("50")
  const box = (await page.getByTestId("compare-stage").boundingBox())!
  const y = box.y + box.height / 2

  // Back and forth three times without stopping: several hundred steps of the line. Safari
  // refuses more than 100 changes to the address in 30 seconds.
  await page.mouse.move(box.x + box.width * 0.5, y)
  await page.mouse.down()
  for (let lap = 0; lap < 6; lap += 1) {
    for (let i = 0; i <= 60; i += 1) {
      const along = lap % 2 ? 1 - i / 60 : i / 60
      await page.mouse.move(box.x + box.width * (0.2 + 0.6 * along), y)
    }
  }
  await page.mouse.up()

  const value = await input.inputValue()
  await expect(page).toHaveURL(new RegExp(`\\?p=${value}$`))
  expect(errors).toEqual([])
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
})

test("Places lists the stories, and one opens", async ({ page }) => {
  await page.goto("/places")
  await expect(page.getByTestId("story-card").first()).toBeVisible()
  await page.getByTestId("story-card").first().click()
  await expect(page.getByTestId("compare-slider-input")).toBeVisible()
})

test("Your photos offers sign-up", async ({ page }) => {
  await page.goto("/me")
  await expect(page.getByTestId("me-name-save")).toHaveText("Sign up")
})
