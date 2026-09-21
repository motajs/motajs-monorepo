import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.MOTA_EDITOR_E2E_PORT ?? 1055);
const baseURL = `http://127.0.0.1:${PORT}`;
const useSystemChrome =
  process.env.PLAYWRIGHT_USE_SYSTEM_CHROME === '1' || (!process.env.CI && process.platform === 'darwin');

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    testIdAttribute: 'data-test-id',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: `pnpm exec vite --host 127.0.0.1 --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      // 稳定的默认项目名，供 `pnpm test:e2e`（= `playwright test --project=editor`）点名。
      // Playwright 的 bare 运行会执行「所有已注册 project」，所以只靠 testIgnore
      // 还不能保证 `test:e2e` 不碰基线截图；把默认项目固定下来才是可靠的隔离。
      name: 'editor',
      testIgnore: /baseline-capture\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        channel: useSystemChrome ? 'chrome' : undefined,
      },
    },
    {
      // 基线截图是人工比对产物（D-07/D-08）：只在
      // `pnpm --filter @motajs/editor exec playwright test --project baseline-capture` 时运行。
      name: 'baseline-capture',
      testMatch: /baseline-capture\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        channel: useSystemChrome ? 'chrome' : undefined,
      },
    },
  ],
});
