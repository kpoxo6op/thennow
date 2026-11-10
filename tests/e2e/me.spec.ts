import { expect, test } from "@playwright/test"

// Your photos: what a new visitor sees and what the site refuses. The whole flow, with the
// store, is in identity.spec.ts; scripts/claim-check.mjs checks it against a real deployment.

const COOKIE = "abcdefghijklmnopqrstuvwxyz012345"

test("every page's footer leads to Your photos", async ({ page }) => {
  await page.goto("/about")
  await page.getByTestId("footer-your-photos").click()
  await expect(page).toHaveURL(/\/me$/)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Your photos"
  )
})

test("anyone can sign up before sending a photo: one field, Sign up, and Sign in below", async ({
  page,
}) => {
  await page.goto("/me")
  await expect(page.getByTestId("me-empty")).toContainText(
    "Photos you send from the camera will appear here."
  )
  await expect(page.getByTestId("me-name")).toContainText(
    "Sign up to be credited for your photos."
  )
  const save = page.getByTestId("me-name-save")
  await expect(save).toHaveText("Sign up")
  await expect(save).toBeDisabled()
  await expect(page.getByTestId("me-sign-in")).toHaveText("Sign in")
  await expect(page.getByRole("link", { name: "Privacy" })).toHaveAttribute(
    "href",
    "/about#your-photos"
  )
})

test("signing up saves the name, then offers the phone a passkey, and shows the name", async ({
  page,
}) => {
  const asked: string[] = []
  await page.route("**/api/me", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({ json: { name: "Margaret T", passkey: false } })
      : route.fulfill({ json: { name: null, passkey: false } })
  )
  await page.route("**/api/me/passkey", (route) => {
    asked.push(route.request().method())
    return route.fulfill({ status: 503, json: { error: "no store" } })
  })
  await page.goto("/me")
  await page.getByTestId("me-name-input").fill("Margaret T")
  await page.getByTestId("me-name-input").press("Enter")
  await expect(page.getByTestId("me-name-value")).toHaveText("Margaret T")
  await expect(page.getByTestId("me-sign-in")).toHaveCount(0)
  expect(asked).toEqual(["GET"])
})

test("a sign-up that can't be saved says so and can be tried again", async ({
  page,
}) => {
  let tries = 0
  await page.route("**/api/me", (route) => {
    if (route.request().method() !== "POST")
      return route.fulfill({ json: { name: null, passkey: false } })
    tries += 1
    return tries === 1
      ? route.abort("internetdisconnected")
      : route.fulfill({ json: { name: "Margaret", passkey: true } })
  })
  await page.goto("/me")
  await page.getByTestId("me-name-input").fill("Margaret")
  await page.getByTestId("me-name-save").click()
  await expect(page.getByTestId("me-name-note")).toHaveText(
    "Not saved. Check your signal and try again."
  )
  await page.getByTestId("me-name-save").click()
  await expect(page.getByTestId("me-name-value")).toHaveText("Margaret")
})

test("About says what the phone's cookie is for", async ({ page }) => {
  await page.goto("/about")
  await expect(page.getByTestId("about-photos")).toContainText(
    "Signing up saves a passkey"
  )
})

test("asking for the name gives a cookie once and keeps it, and replaces a broken one", async ({
  request,
}) => {
  const first = await request.get("/api/me")
  expect(first.status()).toBe(200)
  expect(await first.json()).toEqual({ name: null, passkey: false })
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

test("a name is taken only from the site, and only a real name", async ({
  request,
}) => {
  // Its own address, so the sign-up limit is never shared with another test or an earlier run.
  const address = `test-${Date.now()}-${Math.random()}`
  const post = (data: unknown, headers: Record<string, string> = {}) =>
    request.post("/api/me", {
      data: JSON.stringify(data),
      headers: {
        "content-type": "application/json",
        "x-real-ip": address,
        ...headers,
      },
    })
  const withCookie = { cookie: `tn_me=${COOKIE}` }
  expect(
    (
      await post(
        { name: "Margaret" },
        { ...withCookie, "sec-fetch-site": "cross-site" }
      )
    ).status()
  ).toBe(403)
  // No photo and no cookie are needed to sign up.
  expect((await post({ name: "Margaret" })).status()).toBe(200)
  expect((await post({ name: "   " }, withCookie)).status()).toBe(400)
  expect((await post({ name: "‮​" }, withCookie)).status()).toBe(400)
  expect((await post({ name: "x".repeat(61) }, withCookie)).status()).toBe(400)
  expect((await post({ name: 42 }, withCookie)).status()).toBe(400)
  // A good name passes every check and is saved.
  const saved = await post({ name: "Margaret" }, withCookie)
  expect(saved.status()).toBe(200)
  expect(await saved.json()).toEqual({ name: "Margaret", passkey: false })
})

test("a photo is never shown without a cookie, or for a made-up place", async ({
  request,
}) => {
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

test("a passkey is only for someone signed up, and signing in needs a real passkey", async ({
  request,
}) => {
  expect((await request.get("/api/me/passkey")).status()).toBe(401)
  expect(
    (
      await request.post("/api/me/passkey", {
        data: "{}",
        headers: { "sec-fetch-site": "cross-site" },
      })
    ).status()
  ).toBe(403)
  const options = await request.get("/api/me/signin")
  expect(options.status()).toBe(200)
  expect((await options.json()).challenge).toMatch(/^[A-Za-z0-9_-]{20,}$/)
  const set = options.headers()["set-cookie"]
  expect(set).toContain("tn_ch=")
  expect(set).toContain("HttpOnly")
  expect(set).toContain("SameSite=Strict")
  expect(
    (
      await request.post("/api/me/signin", {
        data: "{}",
        headers: { "sec-fetch-site": "cross-site" },
      })
    ).status()
  ).toBe(403)
  // Anything that isn't a passkey's answer is refused.
  expect((await request.post("/api/me/signin", { data: "{}" })).status()).toBe(
    401
  )
})
