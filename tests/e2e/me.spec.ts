import { expect, test } from "@playwright/test"

// Your photos: no account, only the phone's own cookie. Tests run without the photo store, so
// they cover what a phone with no photos sees and what the site refuses.

const COOKIE = "abcdefghijklmnopqrstuvwxyz012345"

test("every page's footer leads to Your photos", async ({ page }) => {
  await page.goto("/about")
  await page.getByTestId("footer-your-photos").click()
  await expect(page).toHaveURL(/\/me$/)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your photos")
})

test("a phone that hasn't sent anything is told where its photos will appear", async ({
  page,
}) => {
  await page.goto("/me")
  await expect(page.getByTestId("me-empty")).toContainText(
    "Photos you send from the camera on this phone will appear here."
  )
  await expect(page.getByTestId("me-name")).toHaveCount(0)
  await expect(page.getByRole("link", { name: "Privacy" })).toHaveAttribute(
    "href",
    "/about#your-photos"
  )
})

test("About says what the phone's cookie is for", async ({ page }) => {
  await page.goto("/about")
  await expect(page.getByTestId("about-photos")).toContainText(
    "Your phone’s browser keeps a random number"
  )
})

test("asking for the name gives a cookie once and keeps it, and replaces a broken one", async ({
  request,
}) => {
  const first = await request.get("/api/me")
  expect(first.status()).toBe(200)
  expect(await first.json()).toEqual({ name: null })
  expect(first.headers()["cache-control"]).toContain("no-store")
  const set = first.headers()["set-cookie"]
  const value = /tn_me=([^;]+)/.exec(set)![1]
  expect(value).toMatch(/^[A-Za-z0-9_-]{32}$/)
  expect(set).toContain("HttpOnly")
  expect(set).toContain("SameSite=Lax")
  expect(set).toContain("Path=/")

  const kept = await request.get("/api/me", {
    headers: { cookie: `tn_me=${COOKIE}` },
  })
  expect(kept.headers()["set-cookie"]).toContain(`tn_me=${COOKIE};`)

  const broken = await request.get("/api/me", {
    headers: { cookie: "tn_me=../../people" },
  })
  const replaced = /tn_me=([^;]+)/.exec(broken.headers()["set-cookie"])![1]
  expect(replaced).toMatch(/^[A-Za-z0-9_-]{32}$/)
})

test("a name is taken only from the site, from a phone with a cookie, and only a real name (the photo check needs the store, so it's checked on a preview)", async ({
  request,
}) => {
  const post = (data: unknown, headers: Record<string, string> = {}) =>
    request.post("/api/me", {
      data: JSON.stringify(data),
      headers: { "content-type": "application/json", ...headers },
    })
  const withCookie = { cookie: `tn_me=${COOKIE}` }
  expect(
    (await post({ name: "Margaret" }, { ...withCookie, "sec-fetch-site": "cross-site" })).status()
  ).toBe(403)
  expect((await post({ name: "Margaret" })).status()).toBe(401)
  expect((await post({ name: "   " }, withCookie)).status()).toBe(400)
  expect((await post({ name: "‮​" }, withCookie)).status()).toBe(400)
  expect((await post({ name: "x".repeat(61) }, withCookie)).status()).toBe(400)
  expect((await post({ name: 42 }, withCookie)).status()).toBe(400)
  // A good name passes every check and reaches the store, which tests run without.
  expect((await post({ name: "Margaret" }, withCookie)).status()).toBe(503)
})

test("a photo is never shown without a cookie, or for a made-up place", async ({ request }) => {
  const query = "place=mission-house&key=abcdefghijkl0123"
  expect((await request.get(`/api/me/photo?${query}`)).status()).toBe(404)
  expect(
    (
      await request.get(`/api/me/photo?place=../x&key=abcdefghijkl0123`, {
        headers: { cookie: `tn_me=${COOKIE}` },
      })
    ).status()
  ).toBe(404)
})
