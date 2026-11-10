import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: 0,
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `corepack pnpm build && corepack pnpm start --hostname 127.0.0.1 --port ${PORT}`,
    url: baseURL,
    // The server the tests start keeps its photo store in memory (lib/store.ts).
    env: { TN_FAKE_STORE: "1" },
    reuseExistingServer: true,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 180000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
