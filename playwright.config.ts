import { defineConfig, devices } from "@playwright/test"

const PORT = 3100
const baseURL = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: 0,
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `corepack pnpm build && corepack pnpm start --hostname 127.0.0.1 --port ${PORT}`,
    url: baseURL,
    // The server the tests start keeps its photo store in memory (lib/store.ts), and knows one
    // admin: the id of the cookie comments.spec.ts signs in with.
    env: {
      TN_FAKE_STORE: "1",
      TN_ADMIN_IDS: "aad678f1b278cf5e00e24f7de5747e05",
    },
    reuseExistingServer: true,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 180000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /safari\.spec\.ts/,
    },
    // An iPhone's browser engine, for what must hold there. It isn't installed on every machine,
    // so it runs only when asked for: in CI, or with TN_WEBKIT=1.
    ...(process.env.CI || process.env.TN_WEBKIT
      ? [
          {
            name: "webkit",
            use: { ...devices["iPhone 14"] },
            testMatch: /safari\.spec\.ts/,
          },
        ]
      : []),
  ],
})
