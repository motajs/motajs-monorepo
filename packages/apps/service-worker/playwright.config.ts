import { defineConfig, devices } from "@playwright/test";

const withEditor = process.env.MOTA_WITH_EDITOR !== "0";
// 与 `packages/apps/editor/playwright.config.ts` 保持一致：默认使用 Playwright 自带的
// chromium，只有在明确要求（PLAYWRIGHT_USE_SYSTEM_CHROME=1）或非 CI 的 macOS 上才走系统
// Chrome。本机系统 Chrome 153 与 Playwright 1.61 不兼容：导航到 `/service/:id/project/`
// 时浏览器直接断开（probe 复现 PAGE_CLOSE / BROWSER_DISCONNECTED），用自带 chromium 正常。
const useSystemChrome = process.env.PLAYWRIGHT_USE_SYSTEM_CHROME === "1"
  || (!process.env.CI && process.platform === "darwin");

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
    use: { ...devices["Desktop Chrome"], channel: useSystemChrome ? "chrome" : undefined },
  }],
  webServer: {
    command: `${withEditor ? "pnpm build:with-editor" : "pnpm build"} && pnpm preview --host 127.0.0.1 --port 4178`,
    url: "http://127.0.0.1:4178",
    // CI=1 时强制启动全新服务器：验证脚本必须在「未 stage」极性下真正看到空的
    // release，而不是复用上一次「已 stage」运行留下的服务器（镜像 editor 配置）。
    reuseExistingServer: !process.env.CI,
    // `MOTA_WITH_EDITOR` 默认分支要跑 `pnpm build:with-editor`（editor 构建 + SW
    // 构建 + stage），在本机实测约 6 分钟，远超原先的 120s，导致配置自带的
    // webServer 永远无法启动（见 deferred-items.md #3）。这里放宽到 15 分钟，
    // 让默认命令真的能起服务；这不改变任何断言，只是允许构建完成。
    timeout: 15 * 60_000,
  },
});
