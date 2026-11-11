import { expect, test } from "@playwright/test"

// Your photos: what a new visitor sees and what the site refuses. The whole flow, with the
// store, is in identity.spec.ts; scripts/claim-check.mjs checks it against a real deployment.

const COOKIE = "abcdefghijklmnopqrstuvwxyz012345"

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
