import { createHash } from "crypto"
import {
  expect,
  test,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type PlaywrightWorkerArgs,
  type Route,
} from "@playwright/test"

// What visitors write at the end of a place's page, from end to end, against the store the test
// server keeps in memory (lib/store). The server knows one admin, whose cookie is ADMIN_COOKIE
// (see TN_ADMIN_IDS in playwright.config.ts). Every visitor has an address of its own, so the
// per-network limits never mix tests up, and every comment has words of its own, because all
// tests share one server and one store.

const BASE = "http://127.0.0.1:3100"
const PLACE = "mission-house"
const PENDING = "tamaki-road-board-offices"
const ADMIN_COOKIE = "tn-test-admin-000000000000000001"
const QUESTION = "Do you remember this place?"

const address = () =>
  `test-${Date.now()}-${Math.random().toString(36).slice(2)}`
const words = (about = "I remember") =>
  `${about} ${Date.now()}-${Math.random().toString(36).slice(2)}`
const idOf = (cookie: string) =>
  createHash("sha256").update(cookie).digest("hex").slice(0, 32)
const day = new Intl.DateTimeFormat("en-NZ", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Pacific/Auckland",
})

type Playwright = PlaywrightWorkerArgs["playwright"]

const visitor = (
  playwright: Playwright,
  headers: Record<string, string> = {}
) =>
  playwright.request.newContext({
    baseURL: BASE,
    extraHTTPHeaders: { "x-real-ip": address(), ...headers },
  })

// Someone with a browser. The base map is blocked, as it is for every test that opens a map.
async function person(
  browser: Browser,
  options: { phone?: boolean; cookie?: string } = {}
) {
  const context = await browser.newContext({
    baseURL: BASE,
    extraHTTPHeaders: { "x-real-ip": address() },
    ...(options.phone ? { viewport: { width: 390, height: 844 } } : {}),
  })
  await context.route("**/tiles.openfreemap.org/**", (route) => route.abort())
  if (options.cookie)
    await context.addCookies([
      { name: "tn_me", value: options.cookie, url: BASE },
    ])
  const page = await context.newPage()
  return { context, page }
}

async function open(
  page: Awaited<ReturnType<typeof person>>["page"],
  slug = PLACE
) {
  await page.goto(`/${slug}`)
  await page.getByTestId("comments").scrollIntoViewIfNeeded()
}

const rowWith = (
  page: Awaited<ReturnType<typeof person>>["page"],
  hasText: string
) => page.getByTestId("comment").filter({ hasText })

async function write(
  page: Awaited<ReturnType<typeof person>>["page"],
  text: string,
  name?: string
) {
  if (name !== undefined)
    await page.getByTestId("comment-name-input").fill(name)
  await page.getByTestId("comment-text-input").fill(text)
  await page.getByTestId("comment-post").click()
}

const send = (
  who: APIRequestContext,
  body: Record<string, unknown>,
  headers: Record<string, string> = {}
) => who.post("/api/comments", { data: { place: PLACE, ...body }, headers })

const listed = async (who: APIRequestContext, place = PLACE) =>
  (await (await who.get(`/api/comments?place=${place}`)).json()) as {
    comments: { id: string; name: string; text: string; canRemove: boolean }[]
    name: string | null
  }

async function cookieOf(context: APIRequestContext | BrowserContext) {
  const state = await context.storageState()
  return state.cookies.find((c) => c.name === "tn_me")?.value ?? ""
}

test.beforeAll(async ({ playwright }) => {
  const api = await playwright.request.newContext({ baseURL: BASE })
  const kind = (await api.get("/api/me")).headers()["x-tn-store"]
  await api.dispose()
  expect(
    kind,
    "The server on port 3100 is not keeping its store in memory. Stop it (lsof -ti :3100 | xargs -r kill) and let Playwright start its own."
  ).toBe("memory")
})

test("a new visitor posts with a name and sees it listed", async ({
  browser,
}) => {
  const { context, page } = await person(browser)
  const text = words()
  await open(page)

  const nameField = page.getByTestId("comment-name-input")
  const post = page.getByTestId("comment-post")
  await expect(nameField).toBeVisible()
  await expect(post).toBeDisabled()
  await page.getByTestId("comment-text-input").fill(text)
  await expect(post).toBeDisabled()
  await nameField.fill("Margaret")
  await expect(post).toBeEnabled()
  await post.click()

  const row = rowWith(page, text)
  await expect(row).toBeVisible()
  await expect(row.getByTestId("comment-name")).toHaveText("Margaret")
  await expect(row.getByTestId("comment-date")).toHaveText(
    day.format(new Date())
  )
  await expect(row.getByTestId("comment-text")).toHaveText(text)
  await expect(row.getByTestId("comment-remove")).toBeVisible()
  await expect(page.getByTestId("comment-text-input")).toHaveValue("")
  await expect(nameField).toHaveCount(0)

  await page.reload()
  await page.getByTestId("comments").scrollIntoViewIfNeeded()
  await expect(rowWith(page, text)).toBeVisible()
  await expect(nameField).toHaveCount(0)
  // The name was saved to the profile, as on Your photos.
  expect((await (await context.request.get("/api/me")).json()).name).toBe(
    "Margaret"
  )
  await context.close()
})

test("the list never says who wrote what, and sets no cookie", async ({
  playwright,
}) => {
  const a = await visitor(playwright)
  const b = await visitor(playwright)
  const textA = words("A remembers")
  const textB = words("B remembers")
  const sentA = await send(a, { text: textA, name: "Alice" })
  expect(sentA.status()).toBe(200)
  expect((await sentA.json()).comment.canRemove).toBe(true)
  const idA = idOf(await cookieOf(a))
  expect((await send(b, { text: textB, name: "Bob" })).status()).toBe(200)
  const idB = idOf(await cookieOf(b))

  const asB = await b.get(`/api/comments?place=${PLACE}`)
  const rawB = await asB.text()
  const ofB = JSON.parse(rawB) as Awaited<ReturnType<typeof listed>>
  expect(ofB.name).toBe("Bob")
  expect(ofB.comments.find((c) => c.text === textA)).toMatchObject({
    name: "Alice",
    canRemove: false,
  })
  expect(ofB.comments.find((c) => c.text === textB)?.canRemove).toBe(true)

  const rawA = await (await a.get(`/api/comments?place=${PLACE}`)).text()
  const ofA = JSON.parse(rawA) as Awaited<ReturnType<typeof listed>>
  expect(ofA.comments.find((c) => c.text === textA)?.canRemove).toBe(true)
  expect(ofA.comments.find((c) => c.text === textB)?.canRemove).toBe(false)
  for (const raw of [rawA, rawB]) {
    expect(raw).not.toContain('"by"')
    expect(raw).not.toContain(idA)
    expect(raw).not.toContain(idB)
  }

  const stranger = await visitor(playwright)
  const read = await stranger.get(`/api/comments?place=${PLACE}`)
  expect(read.status()).toBe(200)
  expect(read.headers()["set-cookie"]).toBeUndefined()
  const ofStranger = await read.json()
  expect(ofStranger.name).toBeNull()
  expect(
    ofStranger.comments.find((c: { text: string }) => c.text === textA)
      .canRemove
  ).toBe(false)
  expect((await stranger.get("/api/comments?place=nope")).status()).toBe(404)
  await Promise.all([a, b, stranger].map((who) => who.dispose()))
})

test("what is typed is shown as typed, never as markup", async ({
  browser,
}) => {
  const { context, page } = await person(browser)
  const tail = words("second line")
  await open(page)
  await write(page, `<b>bold</b> & <script>x</script>\n${tail}`, "Alice")

  const row = rowWith(page, tail)
  await expect(row).toBeVisible()
  expect(await row.getByTestId("comment-text").textContent()).toBe(
    `<b>bold</b> & <script>x</script>\n${tail}`
  )
  await expect(page.locator('[data-testid="comment-text"] b')).toHaveCount(0)
  await context.close()
})

test("what is refused is refused, and what is only unusual is allowed", async ({
  playwright,
}) => {
  const who = await visitor(playwright)
  const refused = words("refused")
  const good = { text: `${refused} fine`, name: "Bob" }
  const answer = async (
    body: Record<string, unknown>,
    headers: Record<string, string> = {}
  ) => {
    const response = await send(who, body, headers)
    return [response.status(), (await response.json()).error] as const
  }

  expect(await answer(good, { "sec-fetch-site": "cross-site" })).toEqual([
    403,
    "forbidden",
  ])
  expect(await answer({ ...good, place: "nope" })).toEqual([
    404,
    "no such place",
  ])
  expect(await answer({ ...good, website: "http://x.example" })).toEqual([
    400,
    "refused",
  ])
  expect(await answer({ ...good, text: "   \n  " })).toEqual([400, "text"])
  expect(
    await answer({ ...good, text: refused + "a".repeat(1001 - refused.length) })
  ).toEqual([400, "text"])
  for (const text of [
    `${refused} see http://example.test/page`,
    `${refused} www.example.org`,
    `${refused} find me at example.com`,
    `${refused} write to bob@example.co.nz`,
  ])
    expect(await answer({ ...good, text }), text).toEqual([400, "links"])
  expect(await answer({ text: good.text })).toEqual([400, "name"])
  expect(await answer({ ...good, name: "Bob www.spam.com" })).toEqual([
    400,
    "links",
  ])
  expect(await answer({ ...good, name: "n".repeat(61) })).toEqual([400, "name"])
  // Nothing refused was kept, and the refusals gave no cookie.
  expect(await cookieOf(who)).toBe("")
  expect(JSON.stringify(await listed(who))).not.toContain(refused)

  const start = words("exact")
  const exact = start + "a".repeat(1000 - start.length)
  expect(exact).toHaveLength(1000)
  const unusual = `${words("unusual")}: I lived there.My mother ran the shop.It was 1962. St. Heliers, Mr. Smith, about 3.5 km, N.Z.`
  expect((await send(who, { text: exact, name: "Bob" })).status()).toBe(200)
  expect((await send(who, { text: unusual })).status()).toBe(200)
  const now = (await listed(who)).comments.map((c) => c.text)
  expect(now).toContain(exact)
  expect(now).toContain(unusual)
  await who.dispose()
})

test("five posts an hour from one network, shared between people", async ({
  playwright,
}) => {
  const shared = address()
  const a = await visitor(playwright, { "x-real-ip": shared })
  const b = await visitor(playwright, { "x-real-ip": shared })
  const elsewhere = await visitor(playwright)
  const kept = [] as string[]
  for (const [who, name] of [
    [a, "A"],
    [a, "A"],
    [a, "A"],
    [b, "B"],
    [b, "B"],
  ] as const) {
    const text = words()
    expect((await send(who, { text, name })).status()).toBe(200)
    kept.push(text)
  }
  const sixth = words("sixth")
  expect((await send(a, { text: sixth })).status()).toBe(429)
  expect((await send(b, { text: sixth })).status()).toBe(429)
  const other = words("other network")
  expect((await send(elsewhere, { text: other, name: "C" })).status()).toBe(200)

  const now = (await listed(a)).comments.map((c) => c.text)
  for (const text of kept) expect(now).toContain(text)
  expect(now).toContain(other)
  expect(now).not.toContain(sixth)
  await Promise.all([a, b, elsewhere].map((who) => who.dispose()))
})

test("you can remove your own comment, and only yours", async ({
  browser,
  playwright,
}) => {
  const { context, page } = await person(browser)
  const mine = words("mine")
  await open(page)
  await write(page, mine, "Alice")
  const row = rowWith(page, mine)
  await expect(row).toBeVisible()
  let asked = ""
  page.once("dialog", (dialog) => {
    asked = dialog.message()
    void dialog.accept()
  })
  await row.getByTestId("comment-remove").click()
  await expect(row).toHaveCount(0)
  expect(asked).toBe("Remove this?")
  await page.reload()
  await page.getByTestId("comments").scrollIntoViewIfNeeded()
  await expect(page.getByTestId("comment-form")).toBeVisible()
  await expect
    .poll(async () =>
      (await listed(context.request)).comments.map((c) => c.text)
    )
    .not.toContain(mine)
  await expect(rowWith(page, mine)).toHaveCount(0)
  await context.close()

  const a = await visitor(playwright)
  const b = await visitor(playwright)
  const stranger = await visitor(playwright)
  const text = words()
  const sent = await send(a, { text, name: "Alice" })
  const id = (await sent.json()).comment.id as string
  expect((await send(b, { text: words(), name: "Bob" })).status()).toBe(200)
  const url = (key: string) => `/api/comments?place=${PLACE}&id=${key}`
  const still = async () => (await listed(a)).comments.some((c) => c.id === id)

  expect((await b.delete(url(id))).status()).toBe(403)
  expect((await stranger.delete(url(id))).status()).toBe(403)
  expect(
    (
      await a.delete(url(id), { headers: { "sec-fetch-site": "cross-site" } })
    ).status()
  ).toBe(403)
  expect((await a.delete(url("0000000000000-00000000"))).status()).toBe(404)
  expect((await a.delete(url("nonsense"))).status()).toBe(404)
  expect(await still()).toBe(true)

  expect((await a.delete(url(id))).status()).toBe(200)
  expect(await still()).toBe(false)
  expect((await a.delete(url(id))).status()).toBe(404)
  await Promise.all([a, b, stranger].map((who) => who.dispose()))
})

test("someone else's comment has no Remove", async ({
  browser,
  playwright,
}) => {
  const a = await visitor(playwright)
  const text = words()
  expect((await send(a, { text, name: "Alice" })).status()).toBe(200)
  await a.dispose()

  const { context, page } = await person(browser)
  await open(page)
  const row = rowWith(page, text)
  await expect(row).toBeVisible()
  await expect(row.getByTestId("comment-remove")).toHaveCount(0)
  await context.close()
})

test("the admin can remove anyone's comment", async ({
  browser,
  playwright,
}) => {
  const a = await visitor(playwright)
  const text = words()
  expect((await send(a, { text, name: "Alice" })).status()).toBe(200)

  const { context, page } = await person(browser, { cookie: ADMIN_COOKIE })
  await open(page)
  const row = rowWith(page, text)
  await expect(row).toBeVisible()
  page.once("dialog", (dialog) => void dialog.accept())
  await row.getByTestId("comment-remove").click()
  await expect(row).toHaveCount(0)

  await expect
    .poll(async () => (await listed(a)).comments.map((c) => c.text))
    .not.toContain(text)
  await context.close()
  await a.dispose()
})

test("someone signed up on Your photos is not asked their name", async ({
  browser,
  playwright,
}) => {
  const other = await visitor(playwright)
  const earlier = words("earlier")
  expect((await send(other, { text: earlier, name: "Bob" })).status()).toBe(200)
  await other.dispose()

  const { context, page } = await person(browser)
  const saved = await context.request.post("/api/me", {
    data: { name: "Margaret T" },
  })
  expect(saved.status()).toBe(200)
  const text = words()
  await page.goto(`/${PLACE}`)
  await page.getByTestId("comments").scrollIntoViewIfNeeded()
  // The list has arrived once an earlier comment is on the page.
  await expect(rowWith(page, earlier)).toBeVisible()
  await expect(page.getByTestId("comment-name-input")).toHaveCount(0)

  await page.getByTestId("comment-text-input").fill(text)
  await page.getByTestId("comment-post").click()
  await expect(rowWith(page, text).getByTestId("comment-name")).toHaveText(
    "Margaret T"
  )
  await context.close()
})

test("when posting fails the words are kept", async ({ browser }) => {
  const { context, page } = await person(browser)
  const text = words()
  let failed = false
  await page.route(/\/api\/comments$/, (route) => {
    if (route.request().method() === "POST" && !failed) {
      failed = true
      return route.abort("internetdisconnected")
    }
    return route.fallback()
  })
  await open(page)
  await write(page, text, "Alice")
  const note = page.getByTestId("comment-note")
  await expect(note).toHaveText("Not posted. Check your signal and try again.")
  await expect(page.getByTestId("comment-text-input")).toHaveValue(text)
  await expect(page.getByTestId("comment-name-input")).toHaveValue("Alice")
  await expect(rowWith(page, text)).toHaveCount(0)

  await page.getByTestId("comment-post").click()
  await expect(rowWith(page, text)).toBeVisible()
  await expect(note).toHaveCount(0)

  const link = `${words("see")} www.example.com`
  await page.getByTestId("comment-text-input").fill(link)
  await page.getByTestId("comment-post").click()
  await expect(note).toHaveText("Please leave out links and web addresses.")
  await expect(page.getByTestId("comment-text-input")).toHaveValue(link)
  await expect(rowWith(page, link)).toHaveCount(0)
  await context.close()
})

test("an upcoming place has the same box", async ({ browser, playwright }) => {
  const { context, page } = await person(browser)
  const text = words()
  await open(page, PENDING)
  await write(page, text, "Alice")
  await expect(rowWith(page, text)).toBeVisible()

  const api = await visitor(playwright)
  expect((await listed(api, PENDING)).comments.map((c) => c.text)).toContain(
    text
  )
  expect((await listed(api, PLACE)).comments.map((c) => c.text)).not.toContain(
    text
  )
  await api.dispose()
  await context.close()
})

test("the place page is still static", async ({ playwright }) => {
  const who = await visitor(playwright)
  const text = words()
  expect((await send(who, { text, name: "Alice" })).status()).toBe(200)

  const page = await who.get(`/${PLACE}`)
  expect(page.status()).toBe(200)
  expect(page.headers()["set-cookie"]).toBeUndefined()
  expect(page.headers()["x-nextjs-prerender"]).toMatch(/^1/)
  const html = await page.text()
  expect(html).not.toContain(text)
  expect(html).toContain(QUESTION)
  await who.dispose()
})

test("on a phone the box keeps safe side margins and its type sizes", async ({
  browser,
}) => {
  const { context, page } = await person(browser, { phone: true })
  const text = words()
  await open(page)
  await write(page, text, "Alice")
  const row = rowWith(page, text)
  await expect(row).toBeVisible()

  const box = await page.getByTestId("comment-text-input").boundingBox()
  expect(box!.x).toBeGreaterThanOrEqual(24)
  expect(box!.x + box!.width).toBeLessThanOrEqual(390 - 24)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true)

  const size = (locator: ReturnType<typeof page.getByTestId>) =>
    locator.evaluate((element) => getComputedStyle(element).fontSize)
  expect(await size(row.getByTestId("comment-text"))).toBe("18px")
  expect(await size(page.getByTestId("comment-text-input"))).toBe("18px")
  expect(await size(page.getByTestId("comment-post"))).toBe("18px")
  expect(await size(row.getByTestId("comment-name"))).toBe("14px")
  expect(await size(row.getByTestId("comment-remove"))).toBe("14px")
  const post = await page.getByTestId("comment-post").boundingBox()
  expect(post!.height).toBeGreaterThanOrEqual(44)
  await context.close()
})

test("no heading, label or count is added", async ({ browser }) => {
  const { context, page } = await person(browser)
  const text = words()
  await open(page)
  await write(page, text, "Alice")
  await expect(rowWith(page, text)).toBeVisible()

  const block = page.getByTestId("comments")
  await expect(block.locator("h1,h2,h3,h4,h5,h6,label")).toHaveCount(0)
  expect((await page.getByTestId("comment-form").innerText()).trim()).toBe(
    "Post"
  )
  await expect(block).not.toContainText(/comment|leave/i)
  await context.close()
})

test("a removal that fails says so and keeps the comment", async ({
  browser,
}) => {
  const { context, page } = await person(browser)
  const text = words()
  await open(page)
  await write(page, text, "Alice")
  const row = rowWith(page, text)
  await expect(row).toBeVisible()

  const offline = (route: Route) =>
    route.request().method() === "DELETE"
      ? route.abort("internetdisconnected")
      : route.fallback()
  await page.route(/\/api\/comments\?/, offline)
  page.once("dialog", (dialog) => void dialog.accept())
  await row.getByTestId("comment-remove").click()
  await expect(row.getByTestId("comment-remove-note")).toHaveText(
    "Not removed. Check your signal and try again."
  )
  await expect(row).toBeVisible()

  await page.unroute(/\/api\/comments\?/, offline)
  page.once("dialog", (dialog) => void dialog.accept())
  await row.getByTestId("comment-remove").click()
  await expect(row).toHaveCount(0)
  await expect
    .poll(async () =>
      (await listed(context.request)).comments.map((c) => c.text)
    )
    .not.toContain(text)
  await context.close()
})
