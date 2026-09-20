import { existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page, test } from "@playwright/test";
import { ProjectSandbox } from "./utils/projectSandbox";

/**
 * 基线截图（D-07/D-08）：把编辑器 shell 与四个界面冻结成人工比对的 PNG。
 *
 * - 不写参考图断言：D-08 只做人工对照，平台相关的参考文件名是无用负担。
 * - 输出目录由 spec 自身位置（`import.meta.url`）回溯到仓库根，绝不依赖进程 cwd：
 *   `pnpm --filter @motajs/editor exec playwright test` 的 cwd 是包目录，
 *   任何相对路径都会写进 `packages/apps/editor/` 而不是仓库根的 `.planning/baseline/`。
 * - 运行时预览 iframe 执行工程自带代码、渲染依赖宿主，必须排除在截图之外（T-02-01）。
 * - 运行：`pnpm --filter @motajs/editor exec playwright test --project baseline-capture`
 */

/** 一个固定分辨率的视口，保证每次采集的布局一致。 */
const VIEWPORT = { width: 1440, height: 900 };

/** 从 `packages/apps/editor/e2e` 上溯四级即仓库根。 */
const SCREENSHOTS_DIR = fileURLToPath(new URL("../../../../.planning/baseline/screenshots/", import.meta.url));

/** 关闭动画以避免帧间抖动；把运行时宿主与运行时预览表面显式隐藏（它们本就在屏幕外）。 */
const CAPTURE_CSS = `
*, *::before, *::after {
  transition: none !important;
  animation: none !important;
}
[data-test-id="runtime-host"],
[data-test-id="runtime-ui-preview"],
[data-test-id="runtime-status-bar-preview"] {
  visibility: hidden !important;
}
`;

/**
 * 五个冻结目标，锚点全部取自既有的 `data-test-id`（与 editor-smoke.spec.ts 同源）。
 *
 * `floorId` 只在地图目标上使用：地图是加载后的默认界面，若不换楼层就会和 shell 拍到
 * 完全相同的位图（实测两份 PNG 逐字节相同）。固定到 `sample1` 让这两张基线各自有信息量。
 */
const surfaces = [
  { file: "shell.png", mode: null, anchors: ["workbench"], floorId: null },
  { file: "editor-map.png", mode: "map", anchors: ["map-pixi-renderer", "floor-management-list"], floorId: "sample1" },
  { file: "editor-table.png", mode: "tower", anchors: ["panel-tower", "schema-table"], floorId: null },
  { file: "editor-code.png", mode: "functions", anchors: ["scripts-workspace"], floorId: null },
  { file: "editor-asset.png", mode: "appendpic", anchors: ["resources-workspace"], floorId: null },
] as const;

/** 写出一张截图并立即断言它存在且非空，避免「没截到」被当成通过。 */
async function capture(page: Page, file: string): Promise<void> {
  const target = path.join(SCREENSHOTS_DIR, file);
  await page.screenshot({ path: target });
  if (!existsSync(target)) throw new Error(`baseline screenshot was not written: ${target}`);
  const bytes = statSync(target).size;
  expect(bytes, `${file} must be a non-empty PNG`).toBeGreaterThan(0);
}

test.describe("baseline capture", () => {
  test.beforeAll(() => {
    mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  });

  test("freezes the shell and the four editor surfaces", async ({ page }) => {
    // 这个 spec 会独自冷启动整个编辑器（Vite dev 首次 transform 全量模块），
    // 比默认 30s 预算慢，故显式放宽（与 workspace-shell.spec.ts 的写法一致）。
    test.setTimeout(120_000);
    await page.setViewportSize(VIEWPORT);
    // 与单测共享同一个确定性输入：ProjectSandbox 提供 MOTA_JS_ROOT/project。
    await ProjectSandbox.create(page);
    await page.goto("/");
    await page.addStyleTag({ content: CAPTURE_CSS });
    await expect(page.getByTestId("workbench")).toBeVisible();

    for (const surface of surfaces) {
      if (surface.mode) {
        await page.getByTestId("edit-mode-select").selectOption(surface.mode);
      }
      if (surface.floorId) {
        await page.getByTestId("floor-select").selectOption(surface.floorId);
        await expect(page.getByTestId("floor-select")).toHaveValue(surface.floorId);
      }
      for (const anchor of surface.anchors) {
        await expect(page.getByTestId(anchor)).toBeVisible();
      }
      if (surface.file === "editor-map.png") {
        await expect(page.getByTestId("map-pixi-renderer").locator("canvas")).toBeVisible();
      }
      // Pixi/Monaco 是画面帧相关的表面：等一次绘制稳定后再冻结画面。
      await page.waitForTimeout(500);
      await capture(page, surface.file);
    }
  });
});
