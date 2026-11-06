import { defineConfig, devices } from "@playwright/test"

// Runs the same e2e specs as playwright.config.ts against the static build in dist/.
const PORT = 3200
const baseURL = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: 0,
  outputDir: "test-results/static",
  use: {
    baseURL,
    trace: "on-first-retry",
    launchOptions: process.env.PW_CHROMIUM_PATH
      ? { executablePath: process.env.PW_CHROMIUM_PATH }
      : {},
  },
  webServer: {
    command: `corepack pnpm static:build && node static-site/serve.mjs --host 127.0.0.1 --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: true,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 600000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
})
