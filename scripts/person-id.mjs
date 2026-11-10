import { createHash } from "node:crypto"
import { createInterface } from "node:readline"

// Finds your own id for TN_ADMIN_IDS (see .env.example). Run `node scripts/person-id.mjs`, paste
// the value of your tn_me cookie, press Enter. It reads standard input, not an argument, so the
// cookie stays out of your shell history.

const lines = createInterface({ input: process.stdin })
lines.once("line", (line) => {
  const cookie = line.trim()
  if (!/^[A-Za-z0-9_-]{32}$/.test(cookie)) {
    console.error("Not a tn_me cookie value.")
    process.exit(1)
  }
  console.log(createHash("sha256").update(cookie).digest("hex").slice(0, 32))
  lines.close()
})
