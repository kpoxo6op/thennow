import { readFileSync } from "fs"
import path from "path"
import { expect, test, type Browser, type PlaywrightWorkerArgs } from "@playwright/test"
import sharp from "sharp"

// Names, photos and passkeys from end to end, against the store the test server keeps in memory
// (lib/store). A passkey needs a site with a name, so these tests use localhost, not the
// 127.0.0.1 of the other tests; the server answers on both.

const LOCAL = "http://localhost:3100"
const PLACE = "mission-house"
const PHOTO = readFileSync(
  path.join(process.cwd(), "public", "posts", "0005-mission-house", "mission-house-then-768x512.jpg")
)
const json = { "content-type": "application/json" }
const jpeg = { "content-type": "image/jpeg" }

// Every visitor has an address of its own, so the per-network limits never mix tests up, even on
// a server reused between runs.
const address = () => `test-${Date.now()}-${Math.random().toString(36).slice(2)}`
const newKey = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(12)), (x) => x.toString(36).padStart(2, "0")).join("")

type Playwright = PlaywrightWorkerArgs["playwright"]

// Someone without a browser: just requests, keeping their own cookies.
const visitor = (playwright: Playwright, headers: Record<string, string> = {}) =>
  playwright.request.newContext({
    baseURL: LOCAL,
    extraHTTPHeaders: { "x-real-ip": address(), ...headers },
  })

// A phone with its own cookies and its own place to keep passkeys.
async function device(browser: Browser) {
  const context = await browser.newContext({
    baseURL: LOCAL,
    extraHTTPHeaders: { "x-real-ip": address() },
  })
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  await cdp.send("WebAuthn.enable")
  const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  })
  return {
    context,
    page,
    cdp,
    authenticatorId,
    passkeys: async () => (await cdp.send("WebAuthn.getCredentials", { authenticatorId })).credentials,
    cookie: async () => (await context.cookies(LOCAL)).find((c) => c.name === "tn_me")?.value,
  }
}

async function signUp(phone: Awaited<ReturnType<typeof device>>, name: string) {
  await phone.page.goto("/me")
  await phone.page.getByTestId("me-name-input").fill(name)
  await phone.page.getByTestId("me-name-save").click()
  await expect(phone.page.getByTestId("me-name-value")).toHaveText(name)
  // The passkey is saved just after the name.
  await expect
    .poll(async () => (await (await phone.context.request.get("/api/me")).json()).passkey)
    .toBe(true)
}

test.beforeAll(async ({ playwright }) => {
  const api = await playwright.request.newContext({ baseURL: LOCAL })
  const kind = (await api.get("/api/me")).headers()["x-tn-store"]
  await api.dispose()
  expect(
    kind,
    "The server on port 3100 is not keeping its store in memory. Stop it (lsof -ti :3100 | xargs -r kill) and let Playwright start its own."
  ).toBe("memory")
})

test("a name is kept with the browser that gave it, and can be changed and removed", async ({
  playwright,
}) => {
  const a = await visitor(playwright)
  const b = await visitor(playwright)
  const saved = await a.post("/api/me", {
    data: JSON.stringify({ name: "  Test​  Contributor " }),
    headers: json,
  })
  expect(saved.status()).toBe(200)
  expect(await saved.json()).toEqual({ name: "Test Contributor", passkey: false })
  expect((await (await a.get("/api/me")).json()).name).toBe("Test Contributor")

  // Another browser has no name, and giving it one leaves the first alone.
  expect((await (await b.get("/api/me")).json()).name).toBeNull()
  expect((await b.post("/api/me", { data: JSON.stringify({ name: "Someone Else" }), headers: json })).status()).toBe(200)
  expect((await (await a.get("/api/me")).json()).name).toBe("Test Contributor")

  const changed = await a.post("/api/me", { data: JSON.stringify({ name: "T Contributor" }), headers: json })
  expect((await changed.json()).name).toBe("T Contributor")
  expect((await a.delete("/api/me")).status()).toBe(200)
  expect((await (await a.get("/api/me")).json()).name).toBeNull()
})

test("a sent photo is filed under its sender, shown to no one else, and a retry keeps one copy", async ({
  playwright,
}) => {
  const a = await visitor(playwright)
  const b = await visitor(playwright)
  const key = newKey()
  const send = `/api/submit?place=${PLACE}&key=${key}&checked=0`
  // The camera's review gives a browser its cookie before anything is sent.
  await a.get("/api/me")
  await b.get("/api/me")

  const sent = await a.post(send, { data: PHOTO, headers: jpeg })
  expect(sent.status()).toBe(200)
  expect(sent.headers()["set-cookie"]).toBeUndefined()

  const own = await a.get(`/api/me/photo?place=${PLACE}&key=${key}`)
  expect(own.status()).toBe(200)
  expect(own.headers()["content-type"]).toBe("image/jpeg")
  expect((await own.body()).length).toBeLessThan(150_000)
  expect((await b.get(`/api/me/photo?place=${PLACE}&key=${key}`)).status()).toBe(404)

  expect(await (await a.get("/me")).text()).toContain(`key=${key}`)
  expect(await (await b.get("/me")).text()).toContain("will appear here")

  // Sending the same photo again is answered at once.
  expect((await a.post(send, { data: PHOTO, headers: jpeg })).status()).toBe(200)
  // A phone that lost its cookie and tries again is given a new one, and its own copy.
  const c = await visitor(playwright)
  const again = await c.post(send, { data: PHOTO, headers: jpeg })
  expect(again.status()).toBe(200)
  expect(again.headers()["set-cookie"]).toContain("tn_me=")
  expect((await c.get(`/api/me/photo?place=${PLACE}&key=${key}`)).status()).toBe(200)
})

test("signing up saves a passkey, and signing in with it on a second phone brings that phone's photos along", async ({
  browser,
  playwright,
}) => {
  const a = await device(browser)
  await signUp(a, "Passkey Tester")
  const [passkey] = await a.passkeys()
  expect(passkey.isResidentCredential).toBe(true)
  expect(Buffer.from(passkey.userHandle!, "base64").toString()).toBe(await a.cookie())

  // A second phone sends a photo on its own, without signing up.
  const b = await device(browser)
  await b.page.goto("/me")
  await b.context.request.get("/api/me")
  const before = await b.cookie()
  expect(before).toBeTruthy()
  expect(before).not.toBe(await a.cookie())
  const key = newKey()
  const sent = await b.context.request.post(`/api/submit?place=${PLACE}&key=${key}&checked=0`, {
    data: PHOTO,
    headers: jpeg,
  })
  expect(sent.status()).toBe(200)
  await b.page.goto("/me")
  await expect(b.page.getByTestId("me-photo")).toHaveCount(1)
  await expect(b.page.getByTestId("me-name-save")).toHaveText("Sign up")

  // The same person signs in there: their passkey has synced to the second phone.
  await b.cdp.send("WebAuthn.addCredential", { authenticatorId: b.authenticatorId, credential: passkey })
  await b.page.getByTestId("me-sign-in").click()
  await expect(b.page.getByTestId("me-name-value")).toHaveText("Passkey Tester")
  expect(await b.cookie()).toBe(await a.cookie())
  await expect(b.page.getByTestId("me-photo")).toHaveCount(1)
  await expect(b.page.getByTestId("me-sign-in")).toHaveCount(0)

  // The first phone sees that photo too, and the second phone's old cookie no longer does.
  await a.page.goto("/me")
  await expect(a.page.getByTestId("me-photo")).toHaveCount(1)
  const photo = `/api/me/photo?place=${PLACE}&key=${key}`
  expect((await a.context.request.get(photo)).status()).toBe(200)
  const old = await visitor(playwright, { cookie: `tn_me=${before}` })
  expect((await old.get(photo)).status()).toBe(404)

  // Someone with no passkey can't sign in.
  const stranger = await visitor(playwright)
  expect((await stranger.post("/api/me/signin", { data: "{}", headers: json })).status()).toBe(401)
})

test("signing in brings along every photo a phone has sent, however many", async ({
  browser,
  playwright,
}) => {
  test.setTimeout(120_000)
  const MANY = 205
  const a = await device(browser)
  await signUp(a, "Many Photos")
  const [passkey] = await a.passkeys()

  const b = await device(browser)
  await b.page.goto("/me")
  await b.context.request.get("/api/me")
  const before = await b.cookie()
  const tiny = await sharp({
    create: { width: 64, height: 48, channels: 3, background: "#7a8f6a" },
  })
    .jpeg()
    .toBuffer()
  // Twenty at a time, each from an address of its own: the photo limit is per network.
  for (let sent = 0; sent < MANY; sent += 20) {
    const answers = await Promise.all(
      Array.from({ length: Math.min(20, MANY - sent) }, () =>
        b.context.request.post(`/api/submit?place=${PLACE}&key=${newKey()}&checked=0`, {
          data: tiny,
          headers: { ...jpeg, "x-real-ip": `many-${Date.now()}-${Math.random()}` },
        })
      )
    )
    for (const answer of answers) expect(answer.status()).toBe(200)
  }
  await b.page.goto("/me")
  await expect(b.page.getByTestId("me-photo")).toHaveCount(MANY)

  await b.cdp.send("WebAuthn.addCredential", { authenticatorId: b.authenticatorId, credential: passkey })
  await b.page.getByTestId("me-sign-in").click()
  await expect(b.page.getByTestId("me-name-value")).toHaveText("Many Photos", { timeout: 30_000 })
  await expect(b.page.getByTestId("me-photo")).toHaveCount(MANY)

  // Nothing is left behind under the cookie the phone had before.
  const old = await visitor(playwright, { cookie: `tn_me=${before}` })
  expect(await (await old.get("/me")).text()).toContain("will appear here")
})
