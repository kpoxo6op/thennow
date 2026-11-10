import { defineConfig, devices } from "@playwright/test"

const PORT = 3100
const baseURL = `http://127.0.0.1:${PORT}`
// In CI the workflow has already built the site, and nothing else may be on the port.
const CI = !!process.env.CI

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: 0,
  use: {
    baseURL,
    trace: CI ? "retain-on-failure" : "off",
  },
  webServer: {
    command: CI
      ? `corepack pnpm start --hostname 127.0.0.1 --port ${PORT}`
      : `corepack pnpm build && corepack pnpm start --hostname 127.0.0.1 --port ${PORT}`,
    url: baseURL,
    // The server the tests start keeps its photo store in memory (lib/store.ts).
    env: { TN_FAKE_STORE: "1" },
    reuseExistingServer: !CI,
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
