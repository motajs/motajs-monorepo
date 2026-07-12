import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.MOTA_EDITOR_E2E_PORT ?? 1055);
const baseURL = `http://127.0.0.1:${PORT}`;
const useSystemChrome = process.env.PLAYWRIGHT_USE_SYSTEM_CHROME === "1" ||
  (!process.env.CI && process.platform === "darwin");

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    testIdAttribute: "data-test-id",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: `pnpm exec vite --host 127.0.0.1 --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: useSystemChrome ? "chrome" : "chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: useSystemChrome ? "chrome" : undefined,
      },
    },
  ],
});
