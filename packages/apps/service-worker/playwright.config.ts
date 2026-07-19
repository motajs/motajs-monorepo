import { defineConfig, devices } from "@playwright/test";

const withEditor = process.env.MOTA_WITH_EDITOR !== "0";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:4178",
    testIdAttribute: "data-test-id",
    trace: "retain-on-failure",
  },
  projects: [{
    name: "chrome",
    use: { ...devices["Desktop Chrome"], channel: "chrome" },
  }],
  webServer: {
    command: `${withEditor ? "pnpm build:with-editor" : "pnpm build"} && pnpm preview --host 127.0.0.1 --port 4178`,
    url: "http://127.0.0.1:4178",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
