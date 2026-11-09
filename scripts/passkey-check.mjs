// passkey-check.mjs <base-url> : signs up, signs in on a "second device" and claims its photo, in
// a real browser with a virtual passkey, against a real deployment and its real store (it leaves
// one test photo in submissions/mission-house, named in the last line).
import { chromium } from "playwright"
import sharp from "sharp"

const [base] = process.argv.slice(2)
const ok = (cond, what) => { console.log(`${cond ? "PASS" : "FAIL"} ${what}`); if (!cond) process.exitCode = 1 }
const strip = `new MutationObserver(() => document.querySelectorAll("vercel-live-feedback").forEach((e) => e.remove())).observe(document.documentElement, { childList: true, subtree: true })`

const browser = await chromium.launch()
async function device() {
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true })
  await context.addInitScript(strip)
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  await cdp.send("WebAuthn.enable")
  const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  })
  return { context, page, cdp, authenticatorId }
}
const cookieOf = async (context) => (await context.cookies(base)).find((c) => c.name === "tn_me")?.value

// The first phone signs up before sending anything.
const a = await device()
await a.page.goto(`${base}/me`)
ok(await a.page.getByTestId("me-empty").isVisible(), "a new visitor sees an empty Your photos")
await a.page.getByTestId("me-name-input").fill("Passkey Tester")
let t = Date.now()
await a.page.getByTestId("me-name-save").click()
await a.page.getByTestId("me-name-value").waitFor()
ok((await a.page.getByTestId("me-name-value").textContent()) === "Passkey Tester", `signed up with no photo in ${Date.now() - t} ms`)
let me = {}
for (let i = 0; i < 20 && !me.passkey; i++) {
  me = await (await a.context.request.get(`${base}/api/me`)).json()
  if (!me.passkey) await a.page.waitForTimeout(500)
}
ok(me.name === "Passkey Tester" && me.passkey === true, `the store has the name and the passkey: ${JSON.stringify(me)}`)
const { credentials } = await a.cdp.send("WebAuthn.getCredentials", { authenticatorId: a.authenticatorId })
ok(credentials.length === 1 && credentials[0].isResidentCredential, `the phone holds one passkey for ${credentials[0]?.rpId}`)
const cookieA = await cookieOf(a.context)
ok(Buffer.from(credentials[0].userHandle, "base64").toString() === cookieA, "the passkey carries this browser's cookie")

// A second phone sends a photo on its own, without signing up.
const b = await device()
await b.page.goto(`${base}/me`)
await b.context.request.get(`${base}/api/me`)
const cookieB = await cookieOf(b.context)
ok(cookieB && cookieB !== cookieA, "a second phone has its own cookie")
const key = Array.from(crypto.getRandomValues(new Uint8Array(12)), (x) => x.toString(36).padStart(2, "0")).join("")
const jpeg = await sharp({ create: { width: 1600, height: 1200, channels: 3, background: "#7a8f6a" } }).jpeg().toBuffer()
let r = await b.context.request.post(`${base}/api/submit?place=mission-house&key=${key}&checked=0`, { data: jpeg, headers: { "content-type": "image/jpeg", "sec-fetch-site": "same-origin" } })
ok(r.status() === 200, `the second phone sends a photo: ${r.status()}`)
for (let i = 0; i < 10; i++) {
  await b.page.goto(`${base}/me`)
  if (await b.page.getByTestId("me-photo").count()) break
  await b.page.waitForTimeout(1000)
}
ok((await b.page.getByTestId("me-photo").count()) === 1, "its photo is on its Your photos")
ok((await b.page.getByTestId("me-name-save").textContent()) === "Sign up", "with Sign up beside it")

// The same person signs in on the second phone: the passkey has synced to it.
await b.cdp.send("WebAuthn.addCredential", { authenticatorId: b.authenticatorId, credential: credentials[0] })
t = Date.now()
await b.page.getByTestId("me-sign-in").click()
await b.page.getByTestId("me-name-value").waitFor({ timeout: 30_000 })
ok((await b.page.getByTestId("me-name-value").textContent()) === "Passkey Tester", `signed in on the second phone in ${Date.now() - t} ms`)
ok((await cookieOf(b.context)) === cookieA, "the second phone now holds the first phone's cookie")
ok((await b.page.getByTestId("me-photo").count()) === 1, "and the photo it sent earlier came with it")
ok((await b.page.getByTestId("me-sign-in").count()) === 0, "Sign in is gone once signed in")

for (let i = 0; i < 10; i++) {
  await a.page.goto(`${base}/me`)
  if (await a.page.getByTestId("me-photo").count()) break
  await a.page.waitForTimeout(1000)
}
ok((await a.page.getByTestId("me-photo").count()) === 1, "the first phone sees that photo too")
const img = await a.context.request.get(`${base}/api/me/photo?place=mission-house&key=${key}`)
ok(img.status() === 200, `and can load it: ${img.status()}`)
r = await fetch(`${base}/api/me/photo?place=mission-house&key=${key}`, { headers: { cookie: `tn_me=${cookieB}` } })
ok(r.status === 404, `the old cookie no longer shows it: ${r.status}`)

// A stranger with no passkey can't sign in.
const c = await device()
await c.page.goto(`${base}/me`)
r = await c.context.request.post(`${base}/api/me/signin`, { data: "{}", headers: { "content-type": "application/json", "sec-fetch-site": "same-origin" } })
ok(r.status() === 401, `signing in with nothing is refused: ${r.status()}`)

// Change, then remove: the name goes, the sign-up form returns.
await a.page.getByTestId("me-name-change").click()
await a.page.getByTestId("me-name-input").fill("P Tester")
await a.page.getByTestId("me-name-save").click()
await a.page.getByText("Credited as P Tester").waitFor()
ok((await a.cdp.send("WebAuthn.getCredentials", { authenticatorId: a.authenticatorId })).credentials.length === 1, "changing the name doesn't make a second passkey")
await a.page.getByTestId("me-name-remove").click()
await a.page.getByTestId("me-name-save").waitFor()
me = await (await a.context.request.get(`${base}/api/me`)).json()
ok(me.name === null, "the name is removed")
console.log(`test submission: submissions/mission-house/${key}.jpg`)
await browser.close()
