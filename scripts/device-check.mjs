// Real Android camera smoke through Errands. No mocks, upload, saved photo or raw ADB.
import { spawn } from "node:child_process"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { createInterface } from "node:readline"
import { parseArgs } from "node:util"

const { values } = parseArgs({
  options: {
    device: { type: "string" },
    goal: { type: "string" },
    commit: { type: "string" },
    url: { type: "string", default: "https://thennow.nz/mission-house/camera" },
    title: { type: "string", default: "Mission House, Auckland" },
  },
})
if (
  !["emulator", "pixel"].includes(values.device) ||
  !/^\d{4}$/.test(values.goal ?? "") ||
  !/^[a-f0-9]{7,40}$/.test(values.commit ?? "")
) {
  throw new Error(
    "Use --device emulator|pixel --goal EXISTING_LEASE --commit DEPLOYED_SHA; Pixel must already be available to you."
  )
}
const url = new URL(values.url)
if (
  url.protocol !== "https:" ||
  url.username ||
  url.password ||
  url.search ||
  url.hash ||
  !url.pathname.endsWith("/camera")
) {
  throw new Error(
    "Use a public HTTPS camera URL without credentials, query or fragment."
  )
}
const run = `thennow-${values.device}-${new Date().toISOString().replace(/[:.]/g, "-")}`
const directory = path.resolve("device-evidence", run)
await mkdir(directory, { recursive: true, mode: 0o700 })
const record = {
  url: url.href,
  deployedCommit: values.commit,
  device: values.device,
  started: new Date().toISOString(),
  status: "BLOCKED",
  visualReview: "required",
  checks: [],
  screenshots: [],
  limits:
    "Control-flow smoke only. Visual correctness requires screenshot review. Loading time, WebGPU inference, zoom, field alignment, rotation and native passkeys are not established.",
}
const env = { ...process.env, ERRANDS_DEVICE: values.device }
const child = spawn(
  "errands",
  ["session", "--goal", values.goal, "--backend", "adb"],
  { env, stdio: ["pipe", "pipe", "ignore"] }
)
child.stdin.on("error", () => {})
let startError
child.on("error", () => {
  startError = true
})
const lines = createInterface({ input: child.stdout })[Symbol.asyncIterator]()
let timer
async function response() {
  let next
  try {
    next = await Promise.race([
      lines.next(),
      new Promise((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                "Guarded device operation timed out; no action retried."
              )
            ),
          180_000
        )
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
  if (next.done || startError)
    throw new Error("Errands session ended before a verified result.")
  let result
  try {
    result = JSON.parse(next.value)
  } catch {
    throw new Error("Errands returned an unreadable result.")
  }
  if (result.error || result.recovery || result.device !== values.device) {
    throw new Error(
      `Errands refused or lost the device (${result.recovery?.class ?? "unexpected-result"}); no retry or cleanup input sent.`
    )
  }
  return result
}
async function call(operation, args = {}) {
  child.stdin.write(JSON.stringify({ operation, arguments: args }) + "\n")
  return response()
}
const has = (state, label) =>
  (state.nodes ?? []).some(
    (n) =>
      (n.text === label || n["content-desc"] === label) &&
      n.enabled === "true" &&
      n.bounds &&
      n.bounds !== "[0,0][0,0]"
  )
async function observe(name) {
  const state = await call("observe", {
    actions: true,
    screenshot: `${run}-${name}.png`,
  })
  if (state.auth_boundary || state.locked)
    throw new Error("Device is locked or at an authentication boundary.")
  if (state.foreground !== "com.android.chrome")
    throw new Error("Chrome is no longer in front; no further input sent.")
  if (state.screenshot) record.screenshots.push(state.screenshot)
  return state
}
async function waitFor(label, name) {
  // Read-only observations may wait for rendering/inference; mutations are never replayed.
  for (let i = 0; i < 6; i++) {
    const state = await observe(`${name}-${i}`)
    if (has(state, label)) return state
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
  throw new Error(`Expected visible enabled ${label} was not observed.`)
}
try {
  const ready = await response()
  if (!ready.session_ready)
    throw new Error("Errands did not establish a guarded session.")
  await call("open_url", { url: url.href })
  let state = await observe("opened")
  if (has(state, "Allow this time"))
    await call("tap", { text: "Allow this time" })
  await waitFor("Take photo", "camera")
  record.checks.push("camera has enabled shutter")
  await call("tap", { desc: "Take photo" })
  state = await waitFor("Retake", "review")
  if (!has(state, "Hold to see the old photo"))
    throw new Error(
      "Retake appeared without the captured-photo review control."
    )
  record.checks.push("capture reaches photo review")
  await call("tap", { text: "Retake" })
  state = await waitFor("Take photo", "retaken")
  if (!has(state, "Close camera") || has(state, "Retake"))
    throw new Error("Retake did not restore the camera.")
  record.checks.push("retake restores enabled camera")
  await call("tap", { desc: "Close camera" })
  state = await waitFor(values.title, "closed")
  if (has(state, "Take photo") || has(state, "Retake"))
    throw new Error("Camera controls remain after close.")
  record.checks.push("close returns to the story")
  record.status = "PASS"
} catch (error) {
  record.reason = error.message
  process.exitCode = 1
} finally {
  // Ending the controller is not a phone action; never attempt UI cleanup after a refusal.
  child.stdin.end()
  child.kill("SIGTERM")
  record.finished = new Date().toISOString()
  await writeFile(
    path.join(directory, "result.json"),
    JSON.stringify(record, null, 2) + "\n",
    { mode: 0o600 }
  )
  console.log(
    `${record.status}: Android camera control-flow smoke (visual review required). Evidence: ${directory}`
  )
  if (record.reason) console.log(record.reason)
}
