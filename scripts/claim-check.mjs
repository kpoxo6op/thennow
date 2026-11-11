// claim-check.mjs <base-url> <jpeg> : runs the claim flow against a real deployment and its real
// store (it leaves one test photo in submissions/mission-house, named in the last line).
import { readFileSync } from "fs"
const [base, jpeg] = process.argv.slice(2)
const ok = (cond, what) => { console.log(`${cond ? "PASS" : "FAIL"} ${what}`); if (!cond) process.exitCode = 1 }
const cookieOf = (r) => /tn_me=([^;]+)/.exec(r.headers.get("set-cookie") ?? "")?.[1]
const H = (c, extra = {}) => ({ cookie: `tn_me=${c}`, "sec-fetch-site": "same-origin", ...extra })

let r = await fetch(`${base}/api/me`)
const A = cookieOf(r)
const setA = r.headers.get("set-cookie")
ok(r.status === 200 && /^[A-Za-z0-9_-]{32}$/.test(A ?? ""), "GET /api/me gives a cookie")
ok(/Secure/.test(setA) && /HttpOnly/.test(setA) && /Max-Age=34560000/.test(setA), "cookie is Secure HttpOnly 400d")
r = await fetch(`${base}/api/me`, { headers: H(A) })
ok(cookieOf(r) === A, "GET with cookie renews the same one")

const key = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(36).padStart(2, "0")).join("")
const place = "mission-house"
const body = readFileSync(jpeg)
let t = Date.now()
r = await fetch(`${base}/api/submit?place=${place}&key=${key}&checked=0`, { method: "POST", body, headers: H(A, { "content-type": "image/jpeg" }) })
ok(r.status === 200, `send with cookie A: ${r.status} in ${Date.now() - t} ms`)
ok(!r.headers.get("set-cookie"), "send with a cookie doesn't replace it")

t = Date.now()
r = await fetch(`${base}/api/me`, { method: "POST", body: JSON.stringify({ name: "  Test​  Contributor ", place, key }), headers: H(A, { "content-type": "application/json" }) })
const named = await r.json()
ok(r.status === 200 && named.name === "Test Contributor", `name saved right after send: ${r.status} ${JSON.stringify(named)} in ${Date.now() - t} ms`)
r = await fetch(`${base}/api/me`, { headers: H(A) })
ok((await r.json()).name === "Test Contributor", "GET reads the name back")

r = await fetch(`${base}/api/me/photo?place=${place}&key=${key}`, { headers: H(A) })
const thumb = Buffer.from(await r.arrayBuffer())
ok(r.status === 200 && r.headers.get("content-type") === "image/jpeg" && thumb.length < 150_000, `own thumbnail: ${r.status} ${thumb.length} bytes, ${r.headers.get("cache-control")}`)

r = await fetch(`${base}/api/me`)
const B = cookieOf(r)
r = await fetch(`${base}/api/me/photo?place=${place}&key=${key}`, { headers: H(B) })
ok(r.status === 404, `another phone can't see it: ${r.status}`)
r = await fetch(`${base}/api/me`, { method: "POST", body: JSON.stringify({ name: "Someone Else" }), headers: H(B, { "content-type": "application/json" }) })
ok(r.status === 200, `another phone signs up before sending anything: ${r.status}`)
r = await fetch(`${base}/api/me`, { headers: H(A) })
ok((await r.json()).name === "Test Contributor", "and the first phone's name is untouched")
r = await fetch(`${base}/api/me`, { method: "DELETE", headers: H(B) })
r = await fetch(`${base}/api/me`, { method: "POST", body: JSON.stringify({ name: "X" }), headers: H(A, { "content-type": "application/json", "sec-fetch-site": "cross-site" }) })
ok(r.status === 403, `cross-site name refused: ${r.status}`)

for (let i = 0; i < 10; i++) {
  r = await fetch(`${base}/me`, { headers: H(A) })
  const html = await r.text()
  if (html.includes("Test Contributor") && html.includes(`key=${key}`)) { ok(true, `/me shows name and photo (try ${i + 1}), cache ${r.headers.get("cache-control")}`); break }
  if (i === 9) ok(false, "/me shows name and photo")
  await new Promise((s) => setTimeout(s, 1000))
}
r = await fetch(`${base}/me`, { headers: H(B) })
ok((await r.text()).includes("will appear here"), "/me for another phone is empty")
r = await fetch(`${base}/api/me/passkey`, { headers: H(A) })
const options = await r.json()
ok(r.status === 200 && options.rp?.id === new URL(base).hostname && options.authenticatorSelection?.residentKey === "required", `passkey offered to a signed-up phone for ${options.rp?.id}`)
r = await fetch(`${base}/api/me/passkey`, { headers: H(B) })
ok(r.status === 401, `no passkey without signing up: ${r.status}`)
r = await fetch(`${base}/api/me/signin`, { method: "POST", body: "{}", headers: H(B, { "content-type": "application/json" }) })
ok(r.status === 401, `signing in without a passkey is refused: ${r.status}`)

r = await fetch(`${base}/api/submit?place=${place}&key=${key}&checked=0`, { method: "POST", body, headers: H(A, { "content-type": "image/jpeg" }) })
ok(r.status === 200, `retry same key: ${r.status}`)
r = await fetch(`${base}/api/submit?place=${place}&key=${key}&checked=0`, { method: "POST", body, headers: { "sec-fetch-site": "same-origin", "content-type": "image/jpeg" } })
const C = cookieOf(r)
ok(r.status === 200 && C && C !== A, `retry without a cookie gives one: ${r.status}`)
r = await fetch(`${base}/api/me/photo?place=${place}&key=${key}`, { headers: H(C) })
ok(r.status === 200, `and that phone gets its copy: ${r.status}`)

r = await fetch(`${base}/api/me`, { method: "DELETE", headers: H(A) })
ok(r.status === 200, `remove name: ${r.status}`)
r = await fetch(`${base}/api/me`, { headers: H(A) })
ok((await r.json()).name === null, "name gone")
console.log(`test submission: submissions/${place}/${key}.jpg`)
