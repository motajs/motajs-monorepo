import { expect, type Page, test } from "@playwright/test";

test("development assets do not fall back to the editor HTML", async ({ request }) => {
  const theme = await request.get("/assets/theme/editor_color_light.css");
  expect(theme.status()).toBe(200);
  expect(theme.headers()["content-type"]).toContain("text/css");
  expect(await theme.text()).toContain("background-color");

  const missing = await request.get("/assets/theme/missing-theme.css");
  expect(missing.status()).toBe(404);
  expect(missing.headers()["content-type"] ?? "").not.toContain("text/html");
});

const panels = [
  { mode: "map", testId: "panel-map", title: "", contentTestId: "map-panel-textarea" },
  { mode: "tower", testId: "panel-tower", title: "全塔属性", contentTestId: "data-table-grid" },
  { mode: "functions", testId: "panel-functions", title: "脚本编辑", contentTestId: "data-table-grid" },
  { mode: "commonevent", testId: "panel-common-event", title: "公共事件", contentTestId: "data-table-grid" },
  { mode: "plugins", testId: "panel-plugins", title: "插件编写", contentTestId: "data-table-grid" },
  { mode: "floor", testId: "panel-floor", title: "楼层属性", contentTestId: "floor-resize" },
  { mode: "loc", testId: "panel-loc", title: "地图选点", contentTestId: "loc-empty-state" },
  { mode: "enemyitem", testId: "panel-prefab", title: "图块属性", contentTestId: "prefab-empty-state" },
  { mode: "appendpic", testId: "panel-appendpic", title: "追加素材", contentTestId: "appendpic-canvas" },
] as const;

async function expectNoFatalFallback(page: Page): Promise<void> {
  await expect(page.getByText("编辑器启动失败")).toHaveCount(0);
  await expect(page.getByText("面板暂不可用")).toHaveCount(0);
}

async function readPixiCanvasStats(page: Page): Promise<{
  width: number;
  height: number;
  opaque: number;
  colored: number;
  checksum: number;
}> {
  return page.getByTestId("map-pixi-renderer").evaluate((root) => {
    const canvas = root.querySelector("canvas");
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error("Pixi canvas is missing");
    }

    const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true })
      ?? canvas.getContext("webgl", { preserveDrawingBuffer: true });
    if (!gl) {
      throw new Error("Pixi canvas WebGL context is missing");
    }

    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    let opaque = 0;
    let colored = 0;
    let checksum = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] > 0) opaque += 1;
      if (pixels[i + 3] > 0 && (pixels[i] !== pixels[i + 1] || pixels[i + 1] !== pixels[i + 2])) {
        colored += 1;
      }
      checksum = (checksum + pixels[i] * 3 + pixels[i + 1] * 5 + pixels[i + 2] * 7 + pixels[i + 3] * 11)
        % 1_000_000_007;
    }

    return { width, height, opaque, colored, checksum };
  });
}

test("workbench starts before tower and table metadata while preloading independent tracks", async ({ page }) => {
  let releaseTower: () => void = () => undefined;
  let releaseDataComment: () => void = () => undefined;
  let resolveTowerRequested: () => void = () => undefined;
  let resolveDataCommentRequested: () => void = () => undefined;
  const towerRelease = new Promise<void>((resolve) => {
    releaseTower = resolve;
  });
  const dataCommentRelease = new Promise<void>((resolve) => {
    releaseDataComment = resolve;
  });
  const towerRequested = new Promise<void>((resolve) => {
    resolveTowerRequested = resolve;
  });
  const dataCommentRequested = new Promise<void>((resolve) => {
    resolveDataCommentRequested = resolve;
  });
  const requestedPaths = new Set<string>();

  await page.route("**/readFile", async (route) => {
    const params = new URLSearchParams(route.request().postData() ?? "");
    const name = (params.get("name") ?? "").replace(/\\/g, "/").replace(/^\/+/, "");
    requestedPaths.add(name);
    if (name === "project/data.js") {
      resolveTowerRequested();
      await towerRelease;
    }
    if (name === "_server/table/data.comment.js") {
      resolveDataCommentRequested();
      await dataCommentRelease;
    }
    await route.fallback();
  });

  const navigation = page.goto("/");
  await Promise.all([towerRequested, dataCommentRequested]);

  await expect(page.getByTestId("workbench")).toBeVisible();
  await expect(page.getByTestId("event-editor")).toBeAttached();
  await expect(page.getByTestId("code-editor")).toBeAttached();
  await expect.poll(() => requestedPaths.has("project/functions.js")).toBe(true);
  await expect.poll(() => requestedPaths.has("project/plugins.js")).toBe(true);
  await expect.poll(() => requestedPaths.has("_server/table/functions.comment.js")).toBe(true);
  expect([...requestedPaths].some((name) => name.startsWith("project/floors/"))).toBe(false);
  await expect(page.locator("body")).not.toContainText("加载中...");
  await expect(page.locator("body")).not.toContainText("Loading...");
  await expect(page.locator("body")).not.toContainText("素材加载中...");

  releaseTower();
  await expect.poll(() => [...requestedPaths].some((name) => name === "project/floors/sample0.js")).toBe(true);
  releaseDataComment();
  await navigation;
  await expect(page.getByTestId("edit-mode-select")).toBeVisible();
  await expect(page.getByTestId("floor-select")).toBeVisible();
});

test("a delayed panel resource does not suspend the workbench", async ({ page }) => {
  let releaseFunctions: () => void = () => undefined;
  let resolveFunctionsRequested: () => void = () => undefined;
  const functionsRelease = new Promise<void>((resolve) => {
    releaseFunctions = resolve;
  });
  const functionsRequested = new Promise<void>((resolve) => {
    resolveFunctionsRequested = resolve;
  });

  await page.route("**/readFile", async (route) => {
    const params = new URLSearchParams(route.request().postData() ?? "");
    const name = (params.get("name") ?? "").replace(/\\/g, "/").replace(/^\/+/, "");
    if (name === "project/functions.js") {
      resolveFunctionsRequested();
      await functionsRelease;
    }
    await route.fallback();
  });

  const navigation = page.goto("/");
  await functionsRequested;
  await expect(page.getByTestId("edit-mode-select")).toBeVisible();
  await page.getByTestId("edit-mode-select").selectOption("functions");
  await expect(page.getByTestId("edit-mode-select")).toHaveValue("functions");
  await expect(page.getByText("加载中...", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("event-editor")).toBeAttached();

  releaseFunctions();
  await navigation;
  await expect(page.getByTestId("panel-functions")).toBeVisible();
  await expect(page.getByTestId("panel-functions").getByTestId("data-table-grid")).toBeVisible();
});

test("missing table metadata and current floor stay inside local boundaries", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  await page.route("**/readFile", async (route) => {
    const params = new URLSearchParams(route.request().postData() ?? "");
    const name = (params.get("name") ?? "").replace(/\\/g, "/").replace(/^\/+/, "");
    if (name === "_server/table/data.comment.js" || name === "project/floors/sample0.js") {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "file-not-found", message: `Missing fixture ${name}`, path: name },
        }),
      });
      return;
    }
    await route.fallback();
  });

  await page.goto("/");
  await expect(page.getByTestId("workbench")).toBeVisible();
  await expect(page.getByTestId("edit-mode-select")).toBeVisible();
  await expect(page.getByTestId("map-editor-mid")).toBeVisible();

  await page.getByTestId("edit-mode-select").selectOption("tower");
  await expect(page.getByTestId("map-editor-mid")).toBeVisible();
  const panelError = page.getByTestId("panel-error-tower");
  await expect(panelError).toBeVisible();
  const [errorBox, mapBox] = await Promise.all([
    panelError.boundingBox(),
    page.getByTestId("map-editor-mid").boundingBox(),
  ]);
  expect(errorBox).not.toBeNull();
  expect(mapBox).not.toBeNull();
  expect(errorBox!.x + errorBox!.width).toBeLessThanOrEqual(mapBox!.x);
  await expect(page.getByText("编辑器启动失败")).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test("core data panels open without runtime fatal errors", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  await page.goto("/");
  await expect(page.getByTestId("edit-mode-select")).toBeVisible();
  await expectNoFatalFallback(page);

  for (const panel of panels) {
    await page.getByTestId("edit-mode-select").selectOption(panel.mode);
    const panelRoot = page.getByTestId(panel.testId);
    await expect(panelRoot).toBeVisible();
    if (panel.title) await expect(panelRoot).toContainText(panel.title);
    await expect(panelRoot.getByTestId(panel.contentTestId)).toBeVisible();
    if (panel.mode === "tower") {
      await expect(
        panelRoot.getByTestId("table-input-main-floorIds").locator("textarea"),
      ).toHaveValue(/sample0/);
    }
    await expectNoFatalFallback(page);
  }

  expect(pageErrors).toEqual([]);
});

test("map renderer draws real material pixels without diagnostics", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  await page.goto("/");
  for (const floorId of ["sample0", "sample1"]) {
    await page.getByTestId("floor-select").selectOption(floorId);
    await page.getByTestId("layer-mode-map").check();
    await expect(page.getByTestId("map-pixi-renderer").locator("canvas")).toBeVisible();
    await expect(page.getByTestId("map-render-diagnostics")).toHaveCount(0);

    const stats = await readPixiCanvasStats(page);
    expect(stats.width).toBeGreaterThan(0);
    expect(stats.height).toBeGreaterThan(0);
    expect(stats.opaque).toBeGreaterThan(0);
    expect(stats.colored).toBeGreaterThan(0);
  }

  await page.getByTestId("floor-select").selectOption("sample1");
  await page.getByTestId("layer-mode-map").check();
  const eventLayerStats = await readPixiCanvasStats(page);
  await page.getByTestId("layer-mode-bgmap").check();
  await expect.poll(async () => (await readPixiCanvasStats(page)).checksum).not.toBe(eventLayerStats.checksum);

  await expectNoFatalFallback(page);
  expect(pageErrors).toEqual([]);
});

test("map keeps the previous frame while a new floor is loading", async ({ page }) => {
  let releaseSample1: () => void = () => undefined;
  let resolveSample1Requested: () => void = () => undefined;
  const sample1Release = new Promise<void>((resolve) => {
    releaseSample1 = resolve;
  });
  const sample1Requested = new Promise<void>((resolve) => {
    resolveSample1Requested = resolve;
  });

  await page.route("**/readFile", async (route) => {
    const params = new URLSearchParams(route.request().postData() ?? "");
    const name = (params.get("name") ?? "").replace(/\\/g, "/").replace(/^\/+/, "");
    if (name === "project/floors/sample1.js") {
      resolveSample1Requested();
      await sample1Release;
    }
    await route.fallback();
  });

  await page.goto("/");
  await sample1Requested;
  await page.getByTestId("floor-select").selectOption("sample0");
  await expect(page.getByTestId("map-pixi-renderer").locator("canvas")).toBeVisible();
  const sample0Stats = await readPixiCanvasStats(page);

  await page.getByTestId("floor-select").selectOption("sample1");

  await expect(page.getByTestId("map-pixi-renderer").locator("canvas")).toBeVisible();
  await expect(page.getByTestId("map-canvas-input")).toBeVisible();
  await expect(page.locator("#mapEdit")).not.toContainText("Loading...");

  releaseSample1();
  await expect.poll(async () => (await readPixiCanvasStats(page)).checksum).not.toBe(sample0Stats.checksum);
});

test("map click selects a loc for the Loc panel without runtime", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  await page.goto("/");
  await page.getByTestId("floor-select").selectOption("sample0");
  const canvas = page.getByTestId("map-canvas-input");
  await expect(canvas).toBeVisible();
  await canvas.click({ position: { x: 2 * 32 + 16, y: 10 * 32 + 16 } });

  await expect(page.getByTestId("edit-mode-select")).toHaveValue("loc");
  const panel = page.getByTestId("panel-loc");
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId("loc-selected-position")).toHaveText("2,10");
  await expect(panel.getByTestId("loc-summary")).toBeVisible();
  await expect(panel.getByTestId("data-table-grid")).toBeVisible();
  await expectNoFatalFallback(page);
  expect(pageErrors).toEqual([]);
});

test("map double click selects a prefab for the Prefab panel without runtime", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  await page.goto("/");
  await page.getByTestId("floor-select").selectOption("sample0");
  const canvas = page.getByTestId("map-canvas-input");
  await expect(canvas).toBeVisible();
  await canvas.dblclick({ position: { x: 8 * 32 + 16, y: 7 * 32 + 16 } });

  await expect(page.getByTestId("edit-mode-select")).toHaveValue("enemyitem");
  const panel = page.getByTestId("panel-prefab");
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId("data-table-grid")).toBeVisible();
  await expect(panel.getByTestId("prefab-empty-state")).toHaveCount(0);
  await expectNoFatalFallback(page);
  expect(pageErrors).toEqual([]);
});

test("floor navigation modal, wheel and static passability work without runtime", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  await expect(page.getByTestId("floor-select")).toBeVisible();

  await page.getByTestId("open-floor-select").click();
  await expect(page.getByTestId("floor-search")).toBeVisible();
  await expect(page.getByTestId("floor-option-sample0")).toBeVisible();
  await page.getByTestId("floor-preview-sample0").click();
  await expect(page.getByTestId("floor-option-sample0").getByTestId("map-pixi-renderer").locator("canvas"))
    .toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByTestId("floor-select").selectOption("sample0");
  await page.getByTestId("map-editor-mid").hover({ position: { x: 8, y: 8 } });
  await page.mouse.wheel(0, 100);
  await page.mouse.wheel(0, 100);
  await expect(page.getByTestId("floor-select")).toHaveValue("sample2");
  await page.mouse.wheel(0, -100);
  await expect(page.getByTestId("floor-select")).toHaveValue("sample1");
  await page.keyboard.press("PageDown");
  await expect(page.getByTestId("floor-select")).toHaveValue("sample0");

  const surface = page.getByTestId("map-editor-surface");
  await page.getByTestId("floor-select").selectOption("sample2");
  await expect(surface).toHaveAttribute("data-viewport-x", "0");
  await expect(surface).toHaveAttribute("data-viewport-y", "0");
  await page.keyboard.press("a");
  await page.keyboard.press("w");
  await expect(surface).toHaveAttribute("data-viewport-x", "0");
  await expect(surface).toHaveAttribute("data-viewport-y", "0");
  for (let index = 0; index < 20; index += 1) {
    await page.keyboard.press("d");
    await page.keyboard.press("s");
  }
  await expect(surface).toHaveAttribute("data-viewport-x", "416");
  await expect(surface).toHaveAttribute("data-viewport-y", "416");
  await page.getByTestId("floor-select").selectOption("sample0");
  await expect(surface).toHaveAttribute("data-viewport-x", "0");
  await expect(surface).toHaveAttribute("data-viewport-y", "0");

  const overlay = page.getByTestId("event-overlay");
  const before = await overlay.evaluate((element) => {
    const data = (element as HTMLCanvasElement).getContext("2d")!.getImageData(0, 0, 416, 416).data;
    return data.reduce((sum, value, index) => (sum + value * ((index % 13) + 1)) % 1_000_000_007, 0);
  });
  await page.getByTestId("show-passability").check();
  await expect.poll(() =>
    overlay.evaluate((element) => {
      const data = (element as HTMLCanvasElement).getContext("2d")!.getImageData(0, 0, 416, 416).data;
      return data.reduce((sum, value, index) => (sum + value * ((index % 13) + 1)) % 1_000_000_007, 0);
    })
  ).not.toBe(before);
  expect(pageErrors).toEqual([]);
});
