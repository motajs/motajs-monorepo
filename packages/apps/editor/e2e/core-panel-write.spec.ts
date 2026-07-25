import { expect, type Page, test } from "@playwright/test";
import JSON5 from "json5";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { MOTA_JS_ROOT } from "../mota-root";
import { ProjectSandbox } from "./utils/projectSandbox";
import {
  clickMapCell,
  clickMaterialCell,
  doubleClickMapCell,
  editTextareaByField,
  expectTextareaByFieldValue,
  expectScriptSource,
  openEventEditor,
  rightClickMapCell,
  selectFloor,
  selectPanel,
  selectScript,
  setScriptSource,
  waitForEventEditorReady,
} from "./utils/tableEditing";

const PROJECT_ROOT = path.join(MOTA_JS_ROOT, "project");

async function collectProjectSnapshot(dir: string = PROJECT_ROOT): Promise<Map<string, string>> {
  const entries = await readdir(dir, { withFileTypes: true });
  const snapshot = new Map<string, string>();

  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      for (const [filePath, content] of await collectProjectSnapshot(absolute)) {
        snapshot.set(filePath, content);
      }
    } else if (entry.isFile()) {
      const projectPath = path.relative(PROJECT_ROOT, absolute).split(path.sep).join("/");
      snapshot.set(projectPath, await readFile(absolute, "utf-8"));
    }
  }

  return snapshot;
}

async function expectPublicProjectUnchanged(snapshot: Map<string, string>): Promise<void> {
  const current = await collectProjectSnapshot();
  expect(current.size).toBe(snapshot.size);
  for (const [filePath, content] of snapshot) {
    expect(current.get(filePath), `mota-js/project/${filePath} changed`).toBe(content);
  }
}

function readFloorData(sandbox: ProjectSandbox, floorId: string): Record<string, any> {
  const text = sandbox.readText(`project/floors/${floorId}.js`);
  return JSON.parse(text.replace(new RegExp(`^main\\.floors\\.${floorId}\\s*=\\s*`), ""));
}

function writeFloorData(sandbox: ProjectSandbox, floorId: string, data: Record<string, any>): void {
  sandbox.writeText(`project/floors/${floorId}.js`, `main.floors.${floorId} = \n${JSON.stringify(data, null, "\t")}`);
}

function readTowerData(sandbox: ProjectSandbox): Record<string, any> {
  const text = sandbox.readText("project/data.js");
  return JSON.parse(text.replace(/^var\s+\w+\s*=\s*/, ""));
}

function readMapBlocks(sandbox: ProjectSandbox): Record<string, any> {
  return JSON.parse(sandbox.readText("project/maps.js").replace(/^var\s+\w+\s*=\s*/, ""));
}

function readItems(sandbox: ProjectSandbox): Record<string, any> {
  return JSON.parse(sandbox.readText("project/items.js").replace(/^var\s+\w+\s*=\s*/, ""));
}

function readPngDimensions(bytes: Buffer): { width: number; height: number } {
  expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

async function readMapRendererChecksum(page: Page): Promise<number> {
  return page.getByTestId("map-pixi-renderer").evaluate((root) => {
    const canvas = root.querySelector("canvas");
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Pixi canvas is missing");
    const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true })
      ?? canvas.getContext("webgl", { preserveDrawingBuffer: true });
    if (!gl) throw new Error("Pixi WebGL context is missing");
    const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
    gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let checksum = 0;
    for (const value of pixels) checksum = (checksum * 33 + value) % 1_000_000_007;
    return checksum;
  });
}

async function readInteractionCanvasOpaquePixels(page: Page): Promise<number> {
  return page.getByTestId("map-canvas-input").evaluate((canvas) => {
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Interaction canvas is missing");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Interaction canvas context is missing");
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let opaque = 0;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] > 0) opaque += 1;
    }
    return opaque;
  });
}

async function bootWithSandbox(page: Page): Promise<{ sandbox: ProjectSandbox; pageErrors: string[] }> {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  const sandbox = await ProjectSandbox.create(page);
  await page.goto("/");
  await expect(page.getByTestId("edit-mode-select")).toBeVisible();
  await expect(page.getByText("编辑器启动失败")).toHaveCount(0);
  await expect(page.getByText("面板暂不可用")).toHaveCount(0);
  return { sandbox, pageErrors };
}

test.describe("core panels write to sandbox project", () => {
  let publicProjectSnapshot: Map<string, string>;

  test.beforeAll(async () => {
    publicProjectSnapshot = await collectProjectSnapshot();
  });

  test.afterEach(async () => {
    await expectPublicProjectUnchanged(publicProjectSnapshot);
  });

  test("Tower panel edits firstData.title and reads it back after reload", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    const panel = await selectPanel(page, "tower", "panel-tower");

    const waitForWrite = sandbox.waitForWrite("project/data.js");
    await editTextareaByField(panel, "firstData-title", "UI Tower Title");
    await waitForWrite;

    expect(sandbox.readText("project/data.js")).toContain("UI Tower Title");

    await page.reload();
    const reloadedPanel = await selectPanel(page, "tower", "panel-tower");
    await expectTextareaByFieldValue(reloadedPanel, "firstData-title", "UI Tower Title");
    expect(pageErrors).toEqual([]);
  });

  test("Tower panel registers project images and animates without runtime", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    const panel = await selectPanel(page, "tower", "panel-tower");

    await panel.getByTestId("table-input-main-images").locator("textarea").dblclick();
    await expect(page.getByTestId("select-material-modal")).toBeVisible();
    await expect(page.getByTestId("select-material-bear.png")).toBeChecked();
    await expect(page.getByTestId("select-material-brave.png")).not.toBeChecked();
    await page.getByTestId("select-material-brave.png").check();
    const imageWrite = sandbox.waitForWrite("project/data.js");
    await page.getByTestId("select-material-modal-confirm").click();
    await imageWrite;

    expect(readTowerData(sandbox).main.images).toContain("brave.png");

    await panel.getByTestId("table-input-main-animates").locator("textarea").dblclick();
    await expect(page.getByTestId("select-material-modal")).toBeVisible();
    await expect(page.getByTestId("select-material-hand")).toBeChecked();
    await expect(page.getByTestId("select-material-jianji")).not.toBeChecked();
    await page.getByTestId("select-material-jianji").check();
    const animateWrite = sandbox.waitForWrite("project/data.js");
    await page.getByTestId("select-material-modal-confirm").click();
    await animateWrite;

    const tower = readTowerData(sandbox);
    expect(tower.main.images).toContain("brave.png");
    expect(tower.main.animates).toContain("jianji");
    expect(tower.main.animates).not.toContain("jianji.animate");
    expect(pageErrors).toEqual([]);
  });

  test("Tower music material preview starts its audio element", async ({ page }) => {
    await page.addInitScript(() => {
      const testWindow = window as Window & { __audioPlayCalls: number };
      Object.defineProperty(testWindow, "__audioPlayCalls", { value: 0, writable: true });
      HTMLMediaElement.prototype.play = function () {
        testWindow.__audioPlayCalls += 1;
        this.dispatchEvent(new Event("play"));
        return Promise.resolve();
      };
    });
    const { pageErrors } = await bootWithSandbox(page);
    const panel = await selectPanel(page, "tower", "panel-tower");

    await panel.getByTestId("table-input-main-bgms").locator("textarea").dblclick();
    await expect(page.getByTestId("select-material-modal")).toBeVisible();
    const toggle = page.getByTestId("select-material-audio-preview-bgm.mp3-toggle");
    await expect(toggle).toHaveText("播放");
    const playCallsBefore = await page.evaluate(() =>
      (
        window as Window & { __audioPlayCalls: number }
      ).__audioPlayCalls,
    );
    await toggle.click();
    await expect(toggle).toHaveText("暂停");
    await expect.poll(() =>
      page.evaluate(() =>
        (
          window as Window & { __audioPlayCalls: number }
        ).__audioPlayCalls,
      ),
    ).toBeGreaterThan(playCallsBefore);
    await page.getByTestId("select-material-modal-cancel").click();

    expect(pageErrors).toEqual([]);
  });

  test("Blockly edits startCanvas through the modern EventEditor capability", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    const panel = await selectPanel(page, "tower", "panel-tower");

    const source = await openEventEditor(
      page,
      panel.getByTestId("table-input-firstData-startCanvas").locator("textarea"),
      /在这里可以用事件来自定义绘制标题界面/,
    );
    const editor = page.getByTestId("event-editor");
    await expect(editor).not.toContainText("未知事件");

    const events = JSON5.parse(await source.inputValue()) as Array<Record<string, unknown>>;
    expect(events.some((event) => event.type === "previewUI")).toBe(true);
    expect(JSON.stringify(events)).toContain("\"case\":\"keyboard\"");
    events.push({ type: "comment", text: "BLOCKLY_E2E_MARKER" });
    await source.fill(JSON.stringify(events, null, 2));
    await page.getByTestId("event-editor-parse").click();

    const waitForWrite = sandbox.waitForWrite("project/data.js");
    await page.getByTestId("event-editor-confirm").click();
    await waitForWrite;

    expect(sandbox.readText("project/data.js")).toContain("BLOCKLY_E2E_MARKER");
    expect(pageErrors).toEqual([]);
  });

  test("Blockly keeps unparsed source and blocks an accidental save", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    const panel = await selectPanel(page, "tower", "panel-tower");
    const editor = page.getByTestId("event-editor");
    await expect(editor).toHaveAttribute("data-import-ready", "false");
    const source = await openEventEditor(
      page,
      panel.getByTestId("table-input-firstData-startCanvas").locator("textarea"),
      /在这里可以用事件来自定义绘制标题界面/,
    );
    await expect(editor).toHaveAttribute("data-import-ready", "true");

    const before = readTowerData(sandbox);
    await source.fill("[{\"type\":\"comment\",\"text\":\"UNPARSED_SOURCE\"}]");
    await expect(source).toHaveAttribute("data-source-dirty", "true");
    await page.getByTestId("event-editor-confirm").click();

    await expect(page.getByTestId("event-editor")).toBeVisible();
    await expect(source).toHaveValue(/UNPARSED_SOURCE/);
    expect(readTowerData(sandbox)).toEqual(before);
    expect(sandbox.readText("project/data.js")).not.toContain("UNPARSED_SOURCE");
    await page.getByTestId("event-editor-cancel").click();
    await expect(editor).toHaveAttribute("data-import-ready", "false");
    expect(pageErrors).toEqual([]);
  });

  test("Loc afterGetItem and CommonEvent open with their existing content", async ({ page }) => {
    const { pageErrors } = await bootWithSandbox(page);
    await selectFloor(page, "sample0");
    await clickMapCell(page, 8, 7);

    const locPanel = await selectPanel(page, "loc", "panel-loc");
    const afterGetItem = locPanel.getByTestId("table-input-afterGetItem").locator("textarea");
    await expect(afterGetItem).toHaveValue(/如需修改消耗品的效果/);
    await openEventEditor(page, afterGetItem, /如需修改消耗品的效果/);
    await expect(page.getByTestId("event-editor")).not.toContainText("未知事件");
    await page.getByTestId("event-editor-cancel").click();

    await page.getByTestId("workspace-common-events").click();
    await waitForEventEditorReady(page, /flag:arg1/);
    await expect(page.getByTestId("event-editor")).toContainText("攻击+");
    await expect(page.getByTestId("event-editor-cancel")).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  });

  test("Blockly selects project material without runtime", async ({ page }) => {
    const { pageErrors } = await bootWithSandbox(page);
    await selectFloor(page, "sample0");
    await clickMapCell(page, 8, 7);
    const panel = await selectPanel(page, "loc", "panel-loc");
    const source = await openEventEditor(
      page,
      panel.getByTestId("table-input-afterGetItem").locator("textarea"),
      /如需修改消耗品的效果/,
    );
    await source.fill(JSON.stringify([{ type: "animate", name: "zone" }], null, 2));
    await page.getByTestId("event-editor-parse").click();
    await page.getByTestId("blockly-block-mota_animate_s").dblclick();

    await expect(page.getByTestId("select-material-modal")).toBeVisible();
    await expect(page.getByTestId("select-material-zone")).toBeChecked();
    await page.getByTestId("select-material-hand").check();
    await page.getByTestId("select-material-modal-confirm").click();
    await expect(source).toHaveValue(/"name":\s*"hand"/);
    await page.getByTestId("event-editor-cancel").click();
    expect(pageErrors).toEqual([]);
  });

  test("Blockly static flag search opens without runtime", async ({ page }) => {
    const { pageErrors } = await bootWithSandbox(page);
    const panel = await selectPanel(page, "tower", "panel-tower");
    await openEventEditor(
      page,
      panel.getByTestId("table-input-firstData-startCanvas").locator("textarea"),
      /在这里可以用事件来自定义绘制标题界面/,
    );
    await page.getByTestId("event-editor-search-flags").click();
    await expect(page.getByTestId("search-flags-modal")).toBeVisible();
    await expect(page.getByTestId("flag-usage-results")).toBeVisible();
    await page.getByTestId("search-flags-modal-cancel").click();
    await page.getByTestId("event-editor-cancel").click();
    expect(pageErrors).toEqual([]);
  });

  test("Blockly field-only action blocks render on one row", async ({ page }) => {
    const { pageErrors } = await bootWithSandbox(page);
    const panel = await selectPanel(page, "tower", "panel-tower");
    const source = await openEventEditor(
      page,
      panel.getByTestId("table-input-firstData-startCanvas").locator("textarea"),
      /在这里可以用事件来自定义绘制标题界面/,
    );
    await source.fill(JSON.stringify(
      [
        { type: "setValue", name: "flag:door", operator: "+=", value: "1", norefresh: true },
        { type: "showImage", code: 1, name: "bg.jpg", loc: [0, 0], opacity: 1 },
      ],
      null,
      2,
    ));
    await page.getByTestId("event-editor-parse").click();

    for (const type of ["mota_setValue_s", "mota_showImage_s"]) {
      const height = await page.getByTestId(`blockly-block-${type}`).evaluate((node) => (
        (node.querySelector(".blocklyPath") as SVGGraphicsElement).getBBox().height
      ));
      expect(height, `${type} should stay on one row`).toBeLessThan(55);
    }
    await page.getByTestId("event-editor-cancel").click();
    expect(pageErrors).toEqual([]);
  });

  test("completed legacy Blockly schemas render and persist without unknown fallback", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    let panel = await selectPanel(page, "tower", "panel-tower");
    const source = await openEventEditor(
      page,
      panel.getByTestId("table-input-firstData-startCanvas").locator("textarea"),
      /在这里可以用事件来自定义绘制标题界面/,
    );
    const events = [
      { type: "changeFloor", floorId: "sample1", loc: ["flag:targetX", "core.getFlag('targetY')"] },
      { type: "setBlockOpacity", loc: [[1, 2], [3, 4]], floorId: "sample0", opacity: 0.5 },
      { type: "setEquip", id: "sword1", valueType: "percentage", name: "atk", value: "12" },
      { type: "drawImage", image: "bg.jpg", x: 0, y: 0, w: 32, h: 32, x1: 100, y1: 100, w1: 64, h1: 64 },
    ];
    await source.fill(JSON.stringify(events, null, 2));
    await page.getByTestId("event-editor-parse").click();

    for (const type of ["mota_changeFloor_s", "mota_setBlockOpacity_s", "mota_setEquip_s", "mota_drawImage_s"]) {
      await expect(page.getByTestId(`blockly-block-${type}`)).toBeVisible();
    }
    await expect(page.getByTestId("event-editor")).not.toContainText("未知事件");
    await expect(page.getByTestId("blockly-block-mota_setEquip_s").getByTestId("blockly-block-mota_expression"))
      .toHaveCount(1);

    const waitForWrite = sandbox.waitForWrite("project/data.js");
    await page.getByTestId("event-editor-confirm").click();
    await waitForWrite;
    expect(readTowerData(sandbox).firstData.startCanvas).toEqual(events);

    await page.reload();
    panel = await selectPanel(page, "tower", "panel-tower");
    await openEventEditor(
      page,
      panel.getByTestId("table-input-firstData-startCanvas").locator("textarea"),
      /"type"\s*:\s*"drawImage"/,
    );
    await expect(page.getByTestId("event-editor")).not.toContainText("未知事件");
    await page.getByTestId("event-editor-cancel").click();
    expect(pageErrors).toEqual([]);
  });

  test("Functions panel edits a function body and reads it back after reload", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    let workspace = await selectScript(page, "functions", "resetGame");
    await setScriptSource(workspace, "function resetGame () { return '__uiFunctionWrite'; }");

    const waitForWrite = sandbox.waitForWrite("project/functions.js");
    await workspace.getByRole("button", { name: "保存", exact: true }).click();
    await waitForWrite;

    expect(sandbox.readText("project/functions.js")).toContain("__uiFunctionWrite");

    await page.reload();
    workspace = await selectScript(page, "functions", "resetGame");
    await expectScriptSource(workspace, "__uiFunctionWrite");
    expect(pageErrors).toEqual([]);
  });

  test("CommonEvent panel edits an event leaf without dropping sibling data", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    await page.getByTestId("workspace-common-events").click();
    const workspace = page.getByTestId("common-events-workspace");
    await expect(workspace).toBeVisible();
    await workspace.locator(".commonEventSelect").filter({ hasText: "加点事件" }).click();
    const source = page.getByTestId("event-editor-source");
    await source.fill(JSON.stringify([{ type: "comment", text: "UI common event write" }]));
    await page.getByTestId("event-editor-parse").click();

    const waitForWrite = sandbox.waitForWrite("project/events.js");
    await page.getByTestId("event-editor-save").click();
    await waitForWrite;

    const eventsText = sandbox.readText("project/events.js");
    expect(eventsText).toContain("UI common event write");
    expect(eventsText).toContain("回收钥匙商店");
    expect(eventsText).toContain("commonEvent");

    await page.reload();
    await page.getByTestId("workspace-common-events").click();
    await page.locator(".commonEventSelect").filter({ hasText: "加点事件" }).click();
    await expect(page.getByTestId("event-editor-source")).toHaveValue(/UI common event write/);
    expect(pageErrors).toEqual([]);
  });

  test("Plugin panel edits plugin source and reads it back after reload", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    let workspace = await selectScript(page, "plugins", "drawLight");
    await setScriptSource(workspace, "function drawLight () { this.__uiPluginWrite = true; }");

    const waitForWrite = sandbox.waitForWrite("project/plugins.js");
    await workspace.getByRole("button", { name: "保存", exact: true }).click();
    await waitForWrite;

    expect(sandbox.readText("project/plugins.js")).toContain("__uiPluginWrite");

    await page.reload();
    workspace = await selectScript(page, "plugins", "drawLight");
    await expectScriptSource(workspace, "__uiPluginWrite");
    expect(pageErrors).toEqual([]);
  });

  test("Plugin opens the modern CodeEditor and saves raw function source", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    let workspace = await selectScript(page, "plugins", "init");
    await expect(workspace.getByTestId("script-code-editor")).toHaveAttribute("data-language-status", /ready|degraded/);
    await expectScriptSource(workspace, "function init");

    const waitForWrite = sandbox.waitForWrite("project/plugins.js");
    await setScriptSource(workspace, "function init () { this.__uiCodeEditorPluginWrite = true; }");
    await workspace.getByRole("button", { name: "保存", exact: true }).click();
    await waitForWrite;
    expect(sandbox.readText("project/plugins.js")).toContain("__uiCodeEditorPluginWrite");

    await page.reload();
    workspace = await selectScript(page, "plugins", "init");
    await expectScriptSource(workspace, "__uiCodeEditorPluginWrite");
    expect(pageErrors).toEqual([]);
  });

  test("Functions and plugins share the tabbed script editor", async ({ page }) => {
    const { pageErrors } = await bootWithSandbox(page);
    const workspace = await selectScript(page, "functions", "resetGame");
    await expectScriptSource(workspace, "function resetGame");
    await selectScript(page, "plugins", "init");
    await expect(workspace.locator(".scriptTab")).toHaveCount(2);
    await expectScriptSource(workspace, "function init");
    expect(pageErrors).toEqual([]);
  });

  test("Floor panel edits sample0.title and reads it back after reload", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    await selectFloor(page, "sample0");
    const panel = await selectPanel(page, "floor", "panel-floor");

    const waitForWrite = sandbox.waitForWrite("project/floors/sample0.js");
    await editTextareaByField(panel, "title", "UI Floor Title");
    await waitForWrite;

    expect(sandbox.readText("project/floors/sample0.js")).toContain("UI Floor Title");

    await page.reload();
    await selectFloor(page, "sample0");
    const reloadedPanel = await selectPanel(page, "floor", "panel-floor");
    await expectTextareaByFieldValue(reloadedPanel, "title", "UI Floor Title");
    expect(pageErrors).toEqual([]);
  });

  test("Floor default ground previews and selects registered blocks and tilesets", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    await selectFloor(page, "sample0");
    const panel = await selectPanel(page, "floor", "panel-floor");
    const field = panel.getByTestId("schema-input-defaultGround").getByTestId("block-picker-field");

    await expect(field).toContainText("ground");
    await expect(field.locator("img")).toBeVisible();
    await field.getByRole("button", { name: "选择" }).click();

    const picker = page.getByTestId("block-picker-modal");
    await expect(picker).toBeVisible();
    await expect(page.getByTestId("block-picker-category-cls:terrains")).toBeVisible();
    await expect(page.getByTestId("block-picker-category-tileset:magictower.png")).toBeVisible();
    await expect(page.getByTestId("block-picker-viewport")).toHaveCSS("overflow-x", "auto");
    await expect(page.getByTestId("block-picker-viewport")).toHaveCSS("overflow-y", "auto");

    await page.getByTestId("block-picker-choice-grass").click();
    const waitForWrite = sandbox.waitForWrite("project/floors/sample0.js");
    await page.getByTestId("block-picker-confirm").click();
    await waitForWrite;
    await expect(picker).toHaveCount(0);
    await expect(field).toContainText("grass");
    expect(readFloorData(sandbox, "sample0").defaultGround).toBe("grass");

    await field.getByRole("button", { name: "选择" }).click();
    await page.getByTestId("block-picker-category-tileset:magictower.png").click();
    await expect(page.getByTestId("block-picker-choice-X10000")).toBeVisible();
    await page.getByRole("button", { name: "取 消" }).click();
    expect(pageErrors).toEqual([]);
  });

  test("Floor point fields use the modern picker without runtime", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    const floor = readFloorData(sandbox, "sample0");
    floor.width = 20;
    floor.height = 15;
    floor.upFloor = [0, 0];
    writeFloorData(sandbox, "sample0", floor);
    await page.reload();
    await selectFloor(page, "sample0");
    const panel = await selectPanel(page, "floor", "panel-floor");

    await panel.getByTestId("schema-input-upFloor").getByRole("button", { name: "编辑" }).click();
    const modal = page.getByTestId("select-point-modal");
    await expect(modal).toBeVisible();
    await expect(page.getByTestId("select-point-floor")).toHaveCount(0);
    await expect(page.getByTestId("map-pixi-renderer").last()).toBeVisible();
    await expect(modal.getByText("右键多选")).toHaveCount(0);
    await expect(page.getByTestId("select-point-canvas")).toHaveAttribute("width", "640");
    await expect(page.getByTestId("select-point-canvas")).toHaveAttribute("height", "480");
    await expect(page.getByTestId("select-point-controls")).toHaveCount(0);
    await expect(page.getByTestId("select-point-bigmap")).toHaveCount(0);

    await page.getByTestId("select-point-cancel").click();
    await selectFloor(page, "sample1");
    await expect(page.getByTestId("map-editor-mid")).toBeVisible();
    await expect(page.getByTestId("map-editor-error")).toHaveCount(0);

    await selectFloor(page, "sample0");
    await panel.getByTestId("schema-input-upFloor").getByRole("button", { name: "编辑" }).click();
    await expect(modal).toBeVisible();

    const waitForWrite = sandbox.waitForWrite("project/floors/sample0.js");
    await page.getByTestId("select-point-canvas").dblclick({
      position: { x: 4 * 32 + 16, y: 5 * 32 + 16 },
    });
    await waitForWrite;
    await expect(modal).toHaveCount(0);

    expect(readFloorData(sandbox, "sample0").upFloor).toEqual([4, 5]);
    expect(pageErrors).toEqual([]);
  });

  test("Floor panel defaults to SchemaTable and keeps the legacy table available", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    await selectFloor(page, "sample0");
    const panel = await selectPanel(page, "floor", "panel-floor");
    await expect(panel.getByTestId("schema-table")).toBeVisible();
    await expect(panel.getByTestId("table-edit-mode")).toHaveCount(0);

    await panel.getByTestId("floor-table-version").getByText("旧版").click();
    await expect(panel.getByTestId("data-table")).toBeVisible();
    await expect(panel.getByTestId("table-edit-mode")).toBeVisible();
    await expect(panel.getByRole("button", { name: "自定义表格" })).toHaveCount(0);

    const resize = panel.getByTestId("floor-resize");
    await resize.locator("input").nth(0).fill("14");
    const waitForWrite = sandbox.waitForWrite("project/floors/sample0.js");
    await resize.getByRole("button", { name: "确定" }).click();
    await waitForWrite;
    expect(readFloorData(sandbox, "sample0").width).toBe(14);
    expect(pageErrors).toEqual([]);
  });

  test("Floor resize uses the tile grid as the primary size editor", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    await selectFloor(page, "sample0");
    const panel = await selectPanel(page, "floor", "panel-floor");

    await panel.getByTestId("floor-resize-open").click();
    await expect(page.getByTestId("floor-resize-preview")).toBeVisible();
    await expect(page.getByTestId("floor-resize-old-map").getByTestId("map-pixi-renderer")).toBeVisible();
    await page.getByRole("dialog").evaluate(async (element) => {
      await Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished));
    });
    const oldMapBox = await page.getByTestId("floor-resize-old-map").boundingBox();
    const resizeHandleBox = await page.getByTestId("floor-resize-handle-se").boundingBox();
    const initialStageBox = await page.getByTestId("floor-resize-grid-stage").boundingBox();
    if (!oldMapBox || !resizeHandleBox || !initialStageBox) throw new Error("Resize grid is not measurable");
    const tileSize = oldMapBox.width / 13;
    const pointerX = resizeHandleBox.x + resizeHandleBox.width / 2;
    const pointerY = resizeHandleBox.y + resizeHandleBox.height / 2;
    const resizeHandle = page.getByTestId("floor-resize-handle-se");
    await resizeHandle.dispatchEvent("pointerdown", {
      pointerId: 1, pointerType: "mouse", button: 0, buttons: 1, clientX: pointerX, clientY: pointerY,
    });
    await resizeHandle.dispatchEvent("pointermove", {
      pointerId: 1, pointerType: "mouse", button: 0, buttons: 1, clientX: pointerX + tileSize, clientY: pointerY,
    });
    await expect(page.getByTestId("floor-resize-width").locator("input")).toHaveValue("14");
    const oneTileStageBox = await page.getByTestId("floor-resize-grid-stage").boundingBox();
    if (!oneTileStageBox) throw new Error("Resize grid moved out of view");
    expect(Math.abs(oneTileStageBox.x - initialStageBox.x)).toBeLessThan(1);
    await resizeHandle.dispatchEvent("pointermove", {
      pointerId: 1, pointerType: "mouse", button: 0, buttons: 1,
      clientX: pointerX + tileSize * 2, clientY: pointerY + tileSize,
    });
    await resizeHandle.dispatchEvent("pointerup", {
      pointerId: 1, pointerType: "mouse", button: 0, buttons: 0,
      clientX: pointerX + tileSize * 2, clientY: pointerY + tileSize,
    });
    await expect(page.getByTestId("floor-resize-width").locator("input")).toHaveValue("15");
    await expect(page.getByTestId("floor-resize-height").locator("input")).toHaveValue("14");

    const waitForWrite = sandbox.waitForWrite("project/floors/sample0.js");
    await page.getByTestId("floor-resize-submit").click();
    await waitForWrite;

    const floor = readFloorData(sandbox, "sample0");
    expect([floor.width, floor.height]).toEqual([15, 14]);
    expect(floor.map).toHaveLength(14);
    expect(floor.map[0]).toHaveLength(15);
    expect(pageErrors).toEqual([]);
  });

  test("Floor BGM normalizes null, scalar and list values and falls back for invalid raw data", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    const floor = readFloorData(sandbox, "sample0");
    floor.bgm = null;
    writeFloorData(sandbox, "sample0", floor);
    sandbox.writeText("project/bgms/second.ogg", "e2e audio fixture");
    await page.reload();
    await selectFloor(page, "sample0");
    let panel = await selectPanel(page, "floor", "panel-floor");

    const bgmField = panel.getByTestId("schema-input-bgm");
    const addMusic = bgmField.getByRole("button", { name: "添加音乐" });
    await expect(addMusic).toBeEnabled();
    await addMusic.click();
    await expect(page.getByTestId("select-material-modal")).toBeVisible();
    await page.getByTestId("select-material-bgm.mp3").check();
    let waitForWrite = sandbox.waitForWrite("project/floors/sample0.js");
    await page.getByTestId("select-material-modal-confirm").click();
    await waitForWrite;
    expect(readFloorData(sandbox, "sample0").bgm).toBe("bgm.mp3");
    await expect(panel.getByTestId("schema-input-bgm")).toContainText("bgm.mp3");

    await bgmField.getByRole("button", { name: "添加音乐" }).click();
    await page.getByTestId("select-material-second.ogg").check();
    waitForWrite = sandbox.waitForWrite("project/floors/sample0.js");
    await page.getByTestId("select-material-modal-confirm").click();
    await waitForWrite;
    expect(readFloorData(sandbox, "sample0").bgm).toEqual(["bgm.mp3", "second.ogg"]);

    await page.reload();
    await selectFloor(page, "sample0");
    panel = await selectPanel(page, "floor", "panel-floor");
    await expect(panel.getByTestId("schema-input-bgm")).toContainText("bgm.mp3");
    await expect(panel.getByTestId("schema-input-bgm")).toContainText("second.ogg");

    waitForWrite = sandbox.waitForWrite("project/floors/sample0.js");
    await panel.getByTestId("schema-input-bgm").getByRole("button", { name: "删除第 2 项" }).click();
    await waitForWrite;
    waitForWrite = sandbox.waitForWrite("project/floors/sample0.js");
    await panel.getByTestId("schema-input-bgm").getByRole("button", { name: "删除第 1 项" }).click();
    await waitForWrite;
    expect(readFloorData(sandbox, "sample0").bgm).toBeNull();

    const invalid = readFloorData(sandbox, "sample0");
    invalid.bgm = 7;
    writeFloorData(sandbox, "sample0", invalid);
    await page.reload();
    await selectFloor(page, "sample0");
    panel = await selectPanel(page, "floor", "panel-floor");
    const fallback = panel.getByTestId("schema-raw-fallback-背景音乐");
    await expect(fallback).toBeVisible();
    const raw = fallback.locator("textarea");
    await raw.fill("\"bgm.mp3\"");
    waitForWrite = sandbox.waitForWrite("project/floors/sample0.js");
    await raw.evaluate((element) => element.blur());
    await waitForWrite;
    expect(readFloorData(sandbox, "sample0").bgm).toBe("bgm.mp3");
    expect(pageErrors).toEqual([]);
  });

  test("Floor Rest creates, updates and deletes unknown fields", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    const floor = readFloorData(sandbox, "sample0");
    floor.experimental = { nested: 1 };
    writeFloorData(sandbox, "sample0", floor);
    await page.reload();
    await selectFloor(page, "sample0");
    const panel = await selectPanel(page, "floor", "panel-floor");
    const rest = panel.getByTestId("schema-rest-rest");
    await rest.locator("summary").click();

    const nested = panel.getByTestId("schema-rest-experimental-nested").locator("textarea");
    await nested.fill("2");
    let waitForWrite = sandbox.waitForWrite("project/floors/sample0.js");
    await nested.evaluate((element) => element.blur());
    await waitForWrite;
    expect(readFloorData(sandbox, "sample0").experimental).toEqual({ nested: 2 });

    const add = rest.locator(".schemaTableRestAdd").last();
    await add.getByLabel("字段名").fill("customUnknown");
    await add.getByLabel("JSON 值").fill("{\"enabled\":true}");
    waitForWrite = sandbox.waitForWrite("project/floors/sample0.js");
    await add.getByRole("button", { name: "新增" }).click();
    await waitForWrite;
    expect(readFloorData(sandbox, "sample0").customUnknown).toEqual({ enabled: true });

    const customRow = panel.getByTestId("schema-rest-customUnknown-enabled");
    waitForWrite = sandbox.waitForWrite("project/floors/sample0.js");
    await customRow.getByRole("button", { name: "删除" }).click();
    await waitForWrite;
    expect(readFloorData(sandbox, "sample0").customUnknown).toEqual({});
    expect(pageErrors).toEqual([]);
  });

  test("Floor SchemaTable writes participate in undo and redo", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    const original = readFloorData(sandbox, "sample0").title;
    await selectFloor(page, "sample0");
    const panel = await selectPanel(page, "floor", "panel-floor");
    let waitForWrite = sandbox.waitForWrite("project/floors/sample0.js");
    await editTextareaByField(panel, "title", "Schema history title");
    await waitForWrite;
    expect(readFloorData(sandbox, "sample0").title).toBe("Schema history title");

    waitForWrite = sandbox.waitForWrite("project/floors/sample0.js");
    await page.getByTestId("operation-history-undo").click();
    await waitForWrite;
    expect(readFloorData(sandbox, "sample0").title).toBe(original);

    waitForWrite = sandbox.waitForWrite("project/floors/sample0.js");
    await page.getByTestId("operation-history-redo").click();
    await waitForWrite;
    expect(readFloorData(sandbox, "sample0").title).toBe("Schema history title");
    expect(pageErrors).toEqual([]);
  });

  test("Floor panel renames sample0 without touching the real project", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    await selectFloor(page, "sample0");
    const panel = await selectPanel(page, "floor", "panel-floor");

    const waitForNewFloor = sandbox.waitForWrite("project/floors/sample0_UI_RENAMED.js");
    const waitForOldFloorDelete = sandbox.waitForDelete("project/floors/sample0.js");
    const waitForTowerWrite = sandbox.waitForWrite("project/data.js");

    await panel.getByTestId("floor-rename-open").click();
    await page.getByTestId("floor-rename-input").fill("sample0_UI_RENAMED");
    await page.getByTestId("floor-rename-submit").click();

    await waitForNewFloor;
    await waitForOldFloorDelete;
    await waitForTowerWrite;

    expect(sandbox.hasFile("project/floors/sample0.js")).toBe(false);
    expect(sandbox.hasFile("project/floors/sample0_UI_RENAMED.js")).toBe(true);
    expect(sandbox.readText("project/floors/sample0_UI_RENAMED.js")).toContain(
      "\"floorId\": \"sample0_UI_RENAMED\"",
    );
    expect(sandbox.readText("project/data.js")).toContain("\"sample0_UI_RENAMED\"");
    expect(sandbox.readText("project/data.js")).not.toContain("\"sample0\",");

    const towerReads = sandbox.readCount("project/data.js");
    await page.reload();
    await expect.poll(() => sandbox.readCount("project/data.js")).toBeGreaterThan(towerReads);
    expect(readTowerData(sandbox).main.floorIds).toContain("sample0_UI_RENAMED");
    await selectFloor(page, "sample0_UI_RENAMED");
    const reloadedPanel = await selectPanel(page, "floor", "panel-floor");
    await expect(reloadedPanel.getByTestId("schema-input-floorId")).toContainText("sample0_UI_RENAMED");
    expect(pageErrors).toEqual([]);
  });

  test("Loc panel edits selected cell events and reads them back after reload", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    await selectFloor(page, "sample0");
    await clickMapCell(page, 2, 10);
    const panel = await selectPanel(page, "loc", "panel-loc");

    const nextEvents = [{ type: "comment", text: "UI loc event write" }];
    const waitForWrite = sandbox.waitForWrite("project/floors/sample0.js");
    await editTextareaByField(panel, "events", nextEvents);
    await waitForWrite;

    expect(sandbox.readText("project/floors/sample0.js")).toContain("UI loc event write");
    expect(sandbox.readText("project/floors/sample0.js")).toContain("\"2,10\"");

    await page.reload();
    await selectFloor(page, "sample0");
    await clickMapCell(page, 2, 10);
    const reloadedPanel = await selectPanel(page, "loc", "panel-loc");
    await expectTextareaByFieldValue(reloadedPanel, "events", nextEvents);
    expect(pageErrors).toEqual([]);
  });

  test("Loc panel defaults to SchemaTable and writes auto-event pages plus passability", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    await selectFloor(page, "sample0");
    await clickMapCell(page, 4, 4);

    const panel = page.getByTestId("panel-loc");
    await expect(panel).toBeVisible();
    await expect(panel.getByTestId("loc-table-version")).toContainText("新版");
    await expect(panel.getByTestId("schema-table")).toBeVisible();
    await expect(panel.getByTestId("schema-auto-event-list")).toBeVisible();

    const editEvents = panel.getByTestId("schema-input-events").getByRole("button", { name: "编辑" });
    await editEvents.click();
    await expect(page.getByTestId("event-editor")).toBeVisible();
    await page.getByTestId("event-editor-cancel").click();
    await expect(page.getByTestId("event-editor")).toHaveCSS("opacity", "0");
    await expect(page.getByTestId("event-editor")).toHaveCSS("z-index", "-1");
    await editEvents.click();
    await expect(page.getByTestId("event-editor")).toBeVisible();
    await page.getByTestId("event-editor-cancel").click();

    let waitForWrite = sandbox.waitForWrite("project/floors/sample0.js");
    await panel.getByRole("button", { name: "添加自动事件页" }).click();
    await waitForWrite;
    expect(readFloorData(sandbox, "sample0").autoEvent["4,4"]).toEqual([null]);
    await expect(panel.getByRole("button", { name: "编辑自动事件第 0 页" })).toBeVisible();

    const before = readFloorData(sandbox, "sample0").cannotMove?.["4,4"] ?? [];
    const blocked = Array.isArray(before) && before.includes("up");
    waitForWrite = sandbox.waitForWrite("project/floors/sample0.js");
    await panel.getByRole("button", {
      name: `上边内侧（出）：${blocked ? "禁止" : "允许"}`,
    }).click();
    await waitForWrite;
    const after = readFloorData(sandbox, "sample0").cannotMove?.["4,4"] ?? [];
    expect(Array.isArray(after) && after.includes("up")).toBe(!blocked);

    // Create the second page explicitly instead of depending on a particular
    // sample-project fixture. Newly created pages must stay on the canonical
    // array path and reach the dedicated editor rather than Raw JSON.
    waitForWrite = sandbox.waitForWrite("project/floors/sample0.js");
    await panel.getByRole("button", { name: "添加自动事件页" }).click();
    await waitForWrite;
    expect(readFloorData(sandbox, "sample0").autoEvent["4,4"]).toEqual([null, null]);
    await expect(panel.getByTestId("schema-raw-fallback-自动事件")).toHaveCount(0);
    await expect(panel.getByRole("button", { name: "编辑自动事件第 0 页" })).toBeVisible();
    await expect(panel.getByRole("button", { name: "编辑自动事件第 1 页" })).toBeVisible();
    if (await page.locator("html").getAttribute("data-editor-theme") !== "dark") {
      await page.getByTestId("theme-toggle").click();
    }
    await expect(panel.getByTestId("schema-collection-item-0")).toHaveCSS("background-color", "rgb(48, 48, 53)");
    await panel.getByRole("button", { name: "编辑自动事件第 0 页" }).click();
    await expect(page.getByTestId("event-editor")).toBeVisible();
    await page.getByTestId("event-editor-cancel").click();
    expect(pageErrors).toEqual([]);
  });

  test("Loc cursor follows floor changes before writing", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    await selectFloor(page, "sample0");
    await clickMapCell(page, 2, 10);
    await selectFloor(page, "sample1");
    const panel = await selectPanel(page, "loc", "panel-loc");
    await expect(panel.getByTestId("loc-selected-position")).toHaveText("2,10");

    const nextEvents = [{ type: "comment", text: "UI loc cursor sample1 write" }];
    const waitForWrite = sandbox.waitForWrite("project/floors/sample1.js");
    await editTextareaByField(panel, "events", nextEvents);
    await waitForWrite;

    expect(sandbox.readText("project/floors/sample1.js")).toContain("UI loc cursor sample1 write");
    expect(sandbox.readText("project/floors/sample0.js")).not.toContain("UI loc cursor sample1 write");

    await page.reload();
    await selectFloor(page, "sample1");
    await clickMapCell(page, 2, 10);
    const reloadedPanel = await selectPanel(page, "loc", "panel-loc");
    await expectTextareaByFieldValue(reloadedPanel, "events", nextEvents);
    expect(pageErrors).toEqual([]);
  });

  test("Prefab panel edits a selected item and reads it back after reload", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    await selectFloor(page, "sample0");
    await doubleClickMapCell(page, 8, 8);
    const panel = await selectPanel(page, "enemyitem", "panel-prefab");

    const waitForWrite = sandbox.waitForWrite("project/items.js");
    await editTextareaByField(panel, "name", "UI 黄钥匙");
    await waitForWrite;

    expect(sandbox.readText("project/items.js")).toContain("UI 黄钥匙");
    expect(sandbox.readText("project/items.js")).toContain("\"yellowKey\"");

    await page.reload();
    await selectFloor(page, "sample0");
    await doubleClickMapCell(page, 8, 8);
    const reloadedPanel = await selectPanel(page, "enemyitem", "panel-prefab");
    await expectTextareaByFieldValue(reloadedPanel, "name", "UI 黄钥匙");
    expect(pageErrors).toEqual([]);
  });

  test("Prefab property actions preview, paste and reset item attributes", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const { sandbox, pageErrors } = await bootWithSandbox(page);

    await clickMaterialCell(page, "items", 0, 16);
    const panel = await selectPanel(page, "enemyitem", "panel-prefab");
    await panel.getByTestId("prefab-copy-properties").click();

    await clickMaterialCell(page, "items", 0, 0);
    await panel.getByTestId("prefab-paste-properties").click();
    const pasteModal = page.locator(".ant-modal").filter({ hasText: "粘贴道具属性" });
    await expect(pasteModal).toContainText("来源：红宝石");
    await expect(pasteModal).toContainText("itemEffect");
    await expect(pasteModal).toContainText("固定保留目标字段：id、name");

    const pasteWrite = sandbox.waitForWrite("project/items.js");
    await pasteModal.getByTestId("prefab-paste-confirm").click();
    await pasteWrite;
    expect(readItems(sandbox).yellowKey).toMatchObject({
      name: "黄钥匙",
      cls: "items",
      itemEffect: expect.stringContaining("hero.atk"),
    });
    expect(readItems(sandbox).yellowKey.hideInToolbox).toBeUndefined();

    await panel.getByTestId("prefab-reset-properties").click();
    const resetModal = page.locator(".ant-modal").filter({ hasText: "重置道具属性" });
    await expect(resetModal).toContainText("itemEffect");
    const resetWrite = sandbox.waitForWrite("project/items.js");
    await resetModal.getByTestId("prefab-reset-confirm").click();
    await resetWrite;
    expect(readItems(sandbox).yellowKey).toEqual({ cls: "items", name: "黄钥匙" });
    expect(pageErrors).toEqual([]);
  });

  test("Item schema conditions follow cls while preserving populated historical fields", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    await selectFloor(page, "sample0");
    await doubleClickMapCell(page, 8, 8);
    const panel = await selectPanel(page, "enemyitem", "panel-prefab");

    await expect(panel.getByTestId("prefab-table-version")).toHaveCount(0);
    await expect(panel.getByTestId("prefab-copy-properties")).toBeVisible();
    await expect(panel.getByTestId("prefab-paste-properties")).toBeVisible();
    await expect(panel.getByTestId("prefab-reset-properties")).toBeVisible();
    await expect(panel.getByTestId("schema-input-itemEffect")).toBeVisible();
    await expect(panel.getByTestId("schema-input-itemEffectTip")).toBeVisible();
    await expect(panel.getByTestId("schema-group-pickup")).toBeVisible();
    await expect(panel.getByTestId("schema-field-itemEffect")).toHaveClass(/schemaTableInactive/);
    await expect(panel.getByTestId("schema-input-useItemEffect")).toBeVisible();
    await expect(panel.getByTestId("schema-input-canUseItemEffect")).toBeVisible();
    await expect(panel.getByTestId("schema-input-equip")).toBeVisible();
    await expect(panel.getByTestId("schema-field-equip")).toHaveClass(/schemaTableInactive/);

    const itemWrite = sandbox.waitForWrite("project/items.js");
    await panel.getByTestId("schema-input-cls").locator("select").selectOption({ label: "装备" });
    await itemWrite;
    await expect(panel.getByTestId("schema-input-useItemEffect")).toBeVisible();
    await expect(panel.getByTestId("schema-field-useItemEffect")).toHaveClass(/schemaTableInactive/);
    await expect(panel.getByTestId("schema-input-canUseItemEffect")).toBeVisible();
    await expect(panel.getByTestId("schema-input-equip")).toBeVisible();
    await expect(panel.getByTestId("schema-field-equip")).not.toHaveClass(/schemaTableInactive/);

    await clickMaterialCell(page, "items", 0, 16);
    await expect(panel.getByTestId("schema-group-pickup")).toBeVisible();
    await expect(panel.getByTestId("schema-input-itemEffect")).toBeVisible();
    await expect(panel.getByTestId("schema-input-itemEffectTip")).toBeVisible();
    await expect(panel.getByTestId("schema-input-useItemEffect")).toBeVisible();
    await expect(panel.getByTestId("schema-input-canUseItemEffect")).toBeVisible();
    await expect(panel.getByTestId("schema-field-useItemEffect")).toHaveClass(/schemaTableInactive/);
    await expect(panel.getByTestId("schema-field-canUseItemEffect")).toHaveClass(/schemaTableInactive/);
    await expect(panel.getByTestId("schema-input-equip")).toBeVisible();
    await expect(panel.getByTestId("schema-field-equip")).toHaveClass(/schemaTableInactive/);

    expect(pageErrors).toEqual([]);
  });

  test("Prefab panel edits a selected enemy and reads it back after reload", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    await selectFloor(page, "sample0");
    await doubleClickMapCell(page, 0, 7);
    const panel = await selectPanel(page, "enemyitem", "panel-prefab");

    const waitForWrite = sandbox.waitForWrite("project/enemys.js");
    await editTextareaByField(panel, "name", "UI 绿头怪");
    await waitForWrite;

    expect(sandbox.readText("project/enemys.js")).toContain("UI 绿头怪");
    expect(sandbox.readText("project/enemys.js")).toContain("\"greenSlime\"");

    await page.reload();
    await selectFloor(page, "sample0");
    await doubleClickMapCell(page, 0, 7);
    const reloadedPanel = await selectPanel(page, "enemyitem", "panel-prefab");
    await expectTextareaByFieldValue(reloadedPanel, "name", "UI 绿头怪");
    expect(pageErrors).toEqual([]);
  });

  test("Panel headers keep their own layout space while table content scrolls", async ({ page }) => {
    const { pageErrors } = await bootWithSandbox(page);
    await selectFloor(page, "sample0");
    await doubleClickMapCell(page, 0, 7);
    const panel = await selectPanel(page, "enemyitem", "panel-prefab");
    const header = panel.getByTestId("panel-prefab-header");
    const content = panel.getByTestId("panel-prefab-content");

    const before = await panel.evaluate((root) => {
      const headerElement = root.querySelector<HTMLElement>("[data-test-id=\"panel-prefab-header\"]");
      const contentElement = root.querySelector<HTMLElement>("[data-test-id=\"panel-prefab-content\"]");
      if (!headerElement || !contentElement) throw new Error("Panel layout elements are missing");
      const headerRect = headerElement.getBoundingClientRect();
      const contentRect = contentElement.getBoundingClientRect();
      return {
        headerTop: headerRect.top,
        headerBottom: headerRect.bottom,
        contentTop: contentRect.top,
        contentClientHeight: contentElement.clientHeight,
        contentScrollHeight: contentElement.scrollHeight,
        contentOverflowY: getComputedStyle(contentElement).overflowY,
      };
    });

    expect(before.contentTop).toBeGreaterThanOrEqual(before.headerBottom);
    expect(before.contentOverflowY).toBe("auto");
    expect(before.contentScrollHeight).toBeGreaterThan(before.contentClientHeight);

    await content.evaluate((element) => element.scrollTo(0, 500));
    await expect.poll(() => content.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    const headerTopAfterScroll = await header.evaluate((element) => element.getBoundingClientRect().top);
    expect(headerTopAfterScroll).toBeCloseTo(before.headerTop, 1);
    expect(pageErrors).toEqual([]);
  });

  test("Map block structural actions live in the header and rename ID through a modal", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    await selectFloor(page, "sample0");
    const floor = readFloorData(sandbox, "sample0");
    const idnum = String(floor.map[12][8]);
    await doubleClickMapCell(page, 8, 12);
    const panel = await selectPanel(page, "enemyitem", "panel-prefab");
    const header = panel.getByTestId("panel-prefab-header");

    await expect(header.getByTestId("prefab-append")).toBeVisible();
    await expect(header.getByTestId("prefab-remove-registered")).toBeVisible();
    await expect(header.getByTestId("prefab-copy-properties")).toBeVisible();
    await expect(header.getByTestId("prefab-paste-properties")).toBeVisible();
    await expect(header.getByTestId("prefab-reset-properties")).toBeVisible();
    await expect(header.getByTestId("prefab-table-version")).toHaveCount(0);
    await expect(panel.locator("#changeId")).toHaveCount(0);

    await panel.getByTestId("prefab-rename-open").click();
    const input = page.getByTestId("prefab-rename-input");
    await expect(input).toBeVisible();
    const nextId = `uiRenamedBlock${idnum}`;
    await input.fill(nextId);
    const mapWrite = sandbox.waitForWrite("project/maps.js");
    const iconWrite = sandbox.waitForWrite("project/icons.js");
    await page.getByTestId("prefab-rename-submit").click();
    await Promise.all([mapWrite, iconWrite]);

    expect(readMapBlocks(sandbox)[idnum].id).toBe(nextId);
    await expect(page.getByTestId("prefab-rename-input")).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  });

  test("doorInfo opens its dedicated Blockly entry blocks", async ({ page }) => {
    const { pageErrors } = await bootWithSandbox(page);
    await selectFloor(page, "sample0");
    await doubleClickMapCell(page, 8, 12);
    const panel = await selectPanel(page, "enemyitem", "panel-prefab");

    await panel.getByTestId("schema-input-doorInfo").getByRole("button", { name: "编辑" }).click();
    const editor = page.getByTestId("event-editor");
    await expect(editor).toBeVisible();
    await expect(editor).toContainText("事件编辑器 (V12)");
    await expect(editor).not.toContainText("Preview");
    await expect(editor).toContainText("门信息");
    await expect(editor).toContainText("黄钥匙");
    await expect(page.getByTestId("event-editor-source")).toHaveValue(/"yellowKey"/);

    await page.getByTestId("event-editor-cancel").click();
    expect(pageErrors).toEqual([]);
  });

  test("Tower project configuration entries load dedicated blocks and save levelChoose", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    const panel = await selectPanel(page, "tower", "panel-tower");
    const editor = page.getByTestId("event-editor");
    const source = page.getByTestId("event-editor-source");

    await panel.getByTestId("table-input-main-levelChoose").locator("textarea").dblclick();
    await expect(editor).toContainText("难度分歧");
    const levels = JSON5.parse(await source.inputValue()) as Array<Record<string, unknown>>;
    levels.push({ title: "UI 简单", name: "Easy", hard: 1, action: [] });
    await source.fill(JSON.stringify(levels, null, 2));
    await page.getByTestId("event-editor-parse").click();
    const waitForTower = sandbox.waitForWrite("project/data.js");
    await page.getByTestId("event-editor-confirm").click();
    await waitForTower;
    expect(sandbox.readText("project/data.js")).toContain("UI 简单");

    const entries: Array<[string, string]> = [
      ["main-floorPartitions", "高层塔分区管理"],
      ["main-splitImages", "图片切分"],
      ["main-styles", "主要样式设置"],
      ["main-nameMap", "文件别名设置"],
    ];
    for (const [field, text] of entries) {
      await panel.getByTestId(`table-input-${field}`).locator("textarea").dblclick();
      await expect(editor).toContainText(text);
      await expect(editor).not.toContainText("未识别入口");
      await page.getByTestId("event-editor-cancel").click();
    }
    expect(pageErrors).toEqual([]);
  });

  test("equip entry writes through the item table", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    await selectFloor(page, "sample0");
    await doubleClickMapCell(page, 8, 4);
    const panel = await selectPanel(page, "enemyitem", "panel-prefab");

    await panel.getByTestId("schema-input-equip").getByRole("button", { name: "编辑" }).click();
    const editor = page.getByTestId("event-editor");
    await expect(editor).toContainText("数值提升项");
    const source = page.getByTestId("event-editor-source");
    const equip = JSON5.parse(await source.inputValue()) as Record<string, any>;
    equip.value.atk = 11;
    await source.fill(JSON.stringify(equip, null, 2));
    await page.getByTestId("event-editor-parse").click();
    const waitForWrite = sandbox.waitForWrite("project/items.js");
    await page.getByTestId("event-editor-confirm").click();
    await waitForWrite;

    expect(readItems(sandbox).sword1.equip.value.atk).toBe(11);
    expect(pageErrors).toEqual([]);
  });

  test("faceIds entry writes through the map block table", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    await selectFloor(page, "sample0");
    await doubleClickMapCell(page, 2, 10);
    const panel = await selectPanel(page, "enemyitem", "panel-prefab");

    await panel.getByTestId("schema-input-faceIds").getByRole("button", { name: "编辑" }).click();
    await expect(page.getByTestId("event-editor")).toContainText("行走图朝向");
    const source = page.getByTestId("event-editor-source");
    const faceIds = JSON5.parse(await source.inputValue()) as Record<string, string>;
    const nextDown = faceIds.down === "npc0" ? "npc1" : "npc0";
    faceIds.down = nextDown;
    await source.fill(JSON.stringify(faceIds, null, 2));
    await page.getByTestId("event-editor-parse").click();
    const waitForWrite = sandbox.waitForWrite("project/maps.js");
    await page.getByTestId("event-editor-confirm").click();
    await waitForWrite;

    expect(readMapBlocks(sandbox)["133"].faceIds.down).toBe(nextDown);
    expect(pageErrors).toEqual([]);
  });

  test("floorImage entry writes through the floor table", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    await selectFloor(page, "sample0");
    const panel = await selectPanel(page, "floor", "panel-floor");

    await panel.getByTestId("schema-input-images").getByRole("button", { name: "预览编辑" }).click();
    const editor = page.getByTestId("floor-image-editor");
    await expect(editor).toBeVisible();
    await editor.getByRole("button", { name: "添加贴图" }).click();
    await page.getByTestId("image-asset-option-bg.jpg").dblclick();
    await expect(editor.getByTitle("bg.jpg", { exact: true })).toBeVisible();
    const waitForWrite = sandbox.waitForWrite("project/floors/sample0.js");
    await page.getByRole("button", { name: "应用贴图设置" }).click();
    await waitForWrite;

    expect(readFloorData(sandbox, "sample0").images).toMatchObject([
      { name: "bg.jpg", canvas: "bg", x: 0, y: 0 },
    ]);
    expect(pageErrors).toEqual([]);
  });

  test("Map editor paints a selected prefab into the floor map and reads it back after reload", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    await selectFloor(page, "sample0");
    await doubleClickMapCell(page, 8, 8);

    const waitForWrite = sandbox.waitForWrite("project/floors/sample0.js");
    await clickMapCell(page, 6, 5);
    await waitForWrite;

    expect(readFloorData(sandbox, "sample0").map[5][6]).toBe(21);

    await page.reload();
    await selectFloor(page, "sample0");
    await doubleClickMapCell(page, 6, 5);
    const reloadedPanel = await selectPanel(page, "enemyitem", "panel-prefab");
    await expectTextareaByFieldValue(reloadedPanel, "name", "黄钥匙");
    expect(pageErrors).toEqual([]);
  });

  test("Map editor paints a material palette selection into the floor map", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    await selectFloor(page, "sample0");
    await clickMaterialCell(page, "items", 0, 0);
    await expect(page.getByTestId("edit-mode-select")).toHaveValue("enemyitem");
    await expect(page.getByTestId("panel-prefab")).toBeVisible();

    const waitForWrite = sandbox.waitForWrite("project/floors/sample0.js");
    await clickMapCell(page, 6, 5);
    await waitForWrite;

    expect(readFloorData(sandbox, "sample0").map[5][6]).toBe(21);

    await page.reload();
    await selectFloor(page, "sample0");
    await doubleClickMapCell(page, 6, 5);
    const reloadedPanel = await selectPanel(page, "enemyitem", "panel-prefab");
    await expectTextareaByFieldValue(reloadedPanel, "name", "黄钥匙");
    expect(pageErrors).toEqual([]);
  });

  test("Map editor keeps rapid edits memory-first while floor persistence is delayed", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    await selectFloor(page, "sample0");
    await clickMaterialCell(page, "items", 0, 0);
    sandbox.setWriteDelay(250);

    await clickMapCell(page, 4, 4);
    await clickMapCell(page, 5, 4);
    await clickMapCell(page, 6, 4);

    await expect.poll(() => {
      const map = readFloorData(sandbox, "sample0").map;
      return [map[4][4], map[4][5], map[4][6]];
    }).toEqual([21, 21, 21]);

    await page.getByTestId("material-clear-block").click();
    await clickMapCell(page, 5, 4);
    await expect.poll(() => {
      const map = readFloorData(sandbox, "sample0").map;
      return [map[4][4], map[4][5], map[4][6]];
    }).toEqual([21, 0, 21]);
    expect(pageErrors).toEqual([]);
  });

  test("Map editor keeps editing after persistence fails and retries the latest floor", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    const floorPath = "project/floors/sample0.js";
    await selectFloor(page, "sample0");
    await clickMaterialCell(page, "items", 0, 0);
    sandbox.setWriteFailure(floorPath, "test disk unavailable");

    await clickMapCell(page, 4, 4);
    await expect(page.getByTestId("persistence-failure-notification")).toContainText(floorPath);
    await clickMapCell(page, 5, 4);

    sandbox.clearWriteFailure(floorPath);
    await page.getByTestId("persistence-retry-all").click();
    await expect(page.getByTestId("persistence-failure-notification")).toHaveCount(0);
    await expect.poll(() => {
      const map = readFloorData(sandbox, "sample0").map;
      return [map[4][4], map[4][5]];
    }).toEqual([21, 21]);
    expect(pageErrors).toEqual([]);
  });

  test("Map editor rectangle brush repeats a tileset pattern and records recent use", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    await selectFloor(page, "sample0");
    const image = page.getByTestId("material-image-tileset:magictower.png");
    await image.scrollIntoViewIfNeeded();
    await expect(image).toBeVisible();
    const columns = await image.evaluate((element) => (element as HTMLImageElement).naturalWidth / 32);
    const box = await image.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + 32 + 16, box!.y + 32 + 16);
    await page.mouse.down();
    await page.mouse.move(box!.x + 64 + 16, box!.y + 64 + 16);
    await page.mouse.up();
    await page.getByTestId("brush-rectangle").click();

    const canvas = page.getByTestId("map-canvas-input");
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();
    const floorWrite = sandbox.waitForWrite("project/floors/sample0.js");
    const configWrite = sandbox.waitForWrite("_server/config.json");
    await page.mouse.move(canvasBox!.x + 4 * 32 + 16, canvasBox!.y + 4 * 32 + 16);
    await page.mouse.down();
    await page.mouse.move(canvasBox!.x + 7 * 32 + 16, canvasBox!.y + 5 * 32 + 16, { steps: 12 });
    await page.mouse.up();
    await Promise.all([floorWrite, configWrite]);

    const floor = readFloorData(sandbox, "sample0");
    const first = 10000 + columns + 1;
    expect(floor.map[4].slice(4, 8)).toEqual([first, first + 1, first, first + 1]);
    expect(floor.map[5].slice(4, 8)).toEqual([
      first + columns,
      first + columns + 1,
      first + columns,
      first + columns + 1,
    ]);
    const recent = page.getByTestId(`recent-material-${first}`);
    await expect(recent).toBeVisible();
    await expect(page.getByTestId(`recent-material-selection-${first}`)).toBeVisible();
    await expect.poll(async () => {
      const button = await recent.boundingBox();
      const canvas = await recent.locator("canvas").boundingBox();
      return button && canvas
        ? { x: canvas.x - button.x, y: canvas.y - button.y, width: button.width, canvasWidth: canvas.width }
        : null;
    }).toEqual({ x: 0, y: 0, width: 32, canvasWidth: 32 });
    expect(pageErrors).toEqual([]);
  });

  test("Map editor previews real tiles and fully clears a gesture cancelled by right click", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    await selectFloor(page, "sample0");
    await clickMaterialCell(page, "items", 0, 0);
    const brushMode = page.getByTestId("brush-mode");
    await expect(brushMode.locator(".ant-segmented-item")).toHaveCount(3);
    await expect(brushMode.locator("svg")).toHaveCount(3);
    await expect(page.getByTestId("brush-tileset")).toHaveCount(0);
    await page.getByTestId("brush-rectangle").click();

    const floorBefore = readFloorData(sandbox, "sample0").map.map((row: unknown[]) => [...row]);
    const checksumBefore = await readMapRendererChecksum(page);
    const canvas = page.getByTestId("map-canvas-input");
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    await page.mouse.move(box!.x + 4 * 32 + 16, box!.y + 4 * 32 + 16);
    await page.mouse.down({ button: "left" });
    await page.mouse.move(box!.x + 5 * 32 + 16, box!.y + 5 * 32 + 16, { steps: 4 });

    await expect(page.getByTestId("map-editor-surface")).toHaveAttribute("data-paint-preview-count", "4");
    await expect.poll(() => readMapRendererChecksum(page)).not.toBe(checksumBefore);
    expect(await readInteractionCanvasOpaquePixels(page)).toBe(0);

    await page.mouse.down({ button: "right" });
    await page.mouse.up({ button: "right" });
    await page.mouse.up({ button: "left" });

    await expect(page.getByTestId("map-editor-surface")).toHaveAttribute("data-paint-preview-count", "0");
    await expect.poll(() => readMapRendererChecksum(page)).toBe(checksumBefore);
    expect(await readInteractionCanvasOpaquePixels(page)).toBe(0);
    expect(readFloorData(sandbox, "sample0").map).toEqual(floorBefore);
    expect(pageErrors).toEqual([]);
  });

  test("clear material and Delete shortcut write through map commands", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    await selectFloor(page, "sample0");
    await page.getByTestId("material-clear-block").click();
    let waitForWrite = sandbox.waitForWrite("project/floors/sample0.js");
    await clickMapCell(page, 8, 8);
    await waitForWrite;
    expect(readFloorData(sandbox, "sample0").map[8][8]).toBe(0);

    await page.keyboard.press("Escape");
    await clickMapCell(page, 6, 0);
    waitForWrite = sandbox.waitForWrite("project/floors/sample0.js");
    await page.keyboard.press("Delete");
    await waitForWrite;
    expect(readFloorData(sandbox, "sample0").map[0][6]).toBe(0);
    expect(readFloorData(sandbox, "sample0").changeFloor["6,0"]).toBeUndefined();
    expect(pageErrors).toEqual([]);
  });

  test("map keyboard copy, paste and cut preserve location events", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    await selectFloor(page, "sample0");
    await clickMapCell(page, 6, 0);
    await page.keyboard.press("Control+c");

    await clickMapCell(page, 5, 0);
    let waitForWrite = sandbox.waitForWrite("project/floors/sample0.js");
    await page.keyboard.press("Control+v");
    await waitForWrite;
    let floor = readFloorData(sandbox, "sample0");
    expect(floor.map[0][5]).toBe(floor.map[0][6]);
    expect(floor.changeFloor["5,0"]).toEqual(floor.changeFloor["6,0"]);

    await clickMapCell(page, 6, 0);
    waitForWrite = sandbox.waitForWrite("project/floors/sample0.js");
    await page.keyboard.press("Control+x");
    await waitForWrite;
    floor = readFloorData(sandbox, "sample0");
    expect(floor.map[0][6]).toBe(0);
    expect(floor.changeFloor["6,0"]).toBeUndefined();
    expect(pageErrors).toEqual([]);
  });

  test("map keyboard navigation, panel keys and material slots work without runtime", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    await selectFloor(page, "sample0");
    await selectPanel(page, "map", "panel-map");
    const surface = page.getByTestId("map-editor-surface");
    await expect(surface).toHaveAttribute("data-viewport-y", "0");
    await page.keyboard.press("w");
    await expect(surface).toHaveAttribute("data-viewport-y", "0");
    await page.keyboard.press("f");
    await expect(surface).toHaveAttribute("data-bigmap", "true");

    await page.keyboard.press("b");
    await expect(page.getByTestId("edit-mode-select")).toHaveValue("tower");
    await page.keyboard.press("z");
    await expect(page.getByTestId("edit-mode-select")).toHaveValue("tower");
    await page.getByTestId("workspace-map").click();
    await page.keyboard.press("c");
    await expect(page.getByTestId("edit-mode-select")).toHaveValue("enemyitem");

    await clickMaterialCell(page, "items", 0, 0);
    await expect(surface).toHaveAttribute("data-selected-idnum", "21");
    const configWrite = sandbox.waitForWrite("_server/config.json");
    await page.keyboard.press("Alt+1");
    await configWrite;
    expect(sandbox.readText("_server/config.json")).toContain("mapMaterialShortcuts");

    await page.getByTestId("material-clear-block").click();
    await expect(surface).toHaveAttribute("data-selected-idnum", "0");
    await page.keyboard.press("1");
    await expect(surface).toHaveAttribute("data-selected-idnum", "21");
    await expect(page.getByTestId("edit-mode-select")).toHaveValue("enemyitem");

    const towerPanel = await selectPanel(page, "tower", "panel-tower");
    await towerPanel.getByTestId("table-edit-main-animates").click();
    await expect(page.getByTestId("select-material-modal")).toBeVisible();
    await page.keyboard.press("z");
    await expect(page.getByTestId("edit-mode-select")).toHaveValue("tower");
    await expect(page.getByTestId("select-material-modal")).toBeVisible();
    await page.getByTestId("select-material-modal-cancel").click();
    expect(pageErrors).toEqual([]);
  });

  test("global operation history undoes and redoes a map edit", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    await selectFloor(page, "sample0");
    await clickMaterialCell(page, "items", 0, 0);
    const original = readFloorData(sandbox, "sample0").map[5][6];

    let waitForWrite = sandbox.waitForWrite("project/floors/sample0.js");
    await clickMapCell(page, 6, 5);
    await waitForWrite;
    expect(readFloorData(sandbox, "sample0").map[5][6]).toBe(21);

    const historyButton = page.getByTestId("operation-history-open");
    await expect(historyButton).toBeEnabled();
    await historyButton.click();
    const historyList = page.getByTestId("operation-history-list");
    await expect(historyList).toBeVisible();
    await expect(historyList).toContainText("绘制地图 sample0");
    await expect(historyList).toHaveCSS("width", "560px");
    await expect(page.getByTestId("operation-history-entry")).toHaveCSS("white-space", "nowrap");

    waitForWrite = sandbox.waitForWrite("project/floors/sample0.js");
    await page.getByTestId("operation-history-undo").click();
    await waitForWrite;
    expect(readFloorData(sandbox, "sample0").map[5][6]).toBe(original);

    waitForWrite = sandbox.waitForWrite("project/floors/sample0.js");
    await page.getByTestId("operation-history-redo").click();
    await waitForWrite;
    expect(readFloorData(sandbox, "sample0").map[5][6]).toBe(21);
    expect(pageErrors).toEqual([]);
  });

  test("Map context menu binds the start point through commands", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    await selectFloor(page, "sample0");

    await rightClickMapCell(page, 6, 5);
    await expect(page.getByTestId("context-menu")).toBeVisible();
    await expect(page.getByTestId("context-menu-extraEvent")).toBeVisible();
    const waitForWrite = sandbox.waitForWrite("project/data.js");
    await page.getByTestId("context-menu-extraEvent").click();
    await waitForWrite;

    const tower = readTowerData(sandbox);
    expect(tower.firstData.floorId).toBe("sample0");
    expect(tower.firstData.hero.loc).toMatchObject({ x: 6, y: 5 });
    await expect(page.getByTestId("event-overlay")).toBeVisible();

    await page.reload();
    await selectFloor(page, "sample0");
    expect(readTowerData(sandbox).firstData.hero.loc).toMatchObject({ x: 6, y: 5 });
    expect(pageErrors).toEqual([]);
  });

  test("Map context menu binds a stair changeFloor through commands", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    const floor = readFloorData(sandbox, "sample0");
    delete floor.changeFloor["6,0"];
    writeFloorData(sandbox, "sample0", floor);
    await page.reload();
    await selectFloor(page, "sample0");

    await rightClickMapCell(page, 6, 0);
    await expect(page.getByTestId("context-menu")).toBeVisible();
    await expect(page.getByTestId("context-menu-extraEvent")).toBeVisible();
    const waitForWrite = sandbox.waitForWrite("project/floors/sample0.js");
    await page.getByTestId("context-menu-extraEvent").click();
    await waitForWrite;

    expect(readFloorData(sandbox, "sample0").changeFloor["6,0"]).toEqual({
      floorId: ":next",
      stair: "downFloor",
    });
    expect(pageErrors).toEqual([]);
  });

  test("Map panel imports map text into the sandbox floor file", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    await selectFloor(page, "sample0");
    const panel = await selectPanel(page, "map", "panel-map");

    const matrix = Array.from({ length: 13 }, () => Array.from({ length: 13 }, () => 0));
    matrix[5][6] = 21;

    await panel.getByTestId("floor-actions-sample0").click();
    await page.getByTestId("map-import-open").click();
    const waitForWrite = sandbox.waitForWrite("project/floors/sample0.js");
    await page.getByTestId("map-panel-textarea").fill(JSON.stringify(matrix));
    await page.getByTestId("map-import-submit").click();
    await waitForWrite;

    expect(readFloorData(sandbox, "sample0").map[5][6]).toBe(21);

    await page.reload();
    await selectFloor(page, "sample0");
    expect(readFloorData(sandbox, "sample0").map[5][6]).toBe(21);
    expect(pageErrors).toEqual([]);
  });

  test("Map panel clears the current floor map and event data", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    await selectFloor(page, "sample0");
    const panel = await selectPanel(page, "map", "panel-map");

    await panel.getByTestId("floor-actions-sample0").click();
    await page.getByTestId("map-clear-submit").click();
    const waitForWrite = sandbox.waitForWrite("project/floors/sample0.js");
    await page.getByRole("button", { name: "清空地图", exact: true }).click();
    await waitForWrite;

    const floor = readFloorData(sandbox, "sample0");
    expect(floor.map.every((row: number[]) => row.every((cell) => cell === 0))).toBe(true);
    expect(floor.bgmap.every((row: number[]) => row.every((cell) => cell === 0))).toBe(true);
    expect(floor.fgmap.every((row: number[]) => row.every((cell) => cell === 0))).toBe(true);
    expect(floor.events).toEqual({});
    expect(floor.changeFloor).toEqual({});
    expect(floor.cannotMove).toEqual({});
    expect(floor.cannotMoveIn).toEqual({});
    expect(pageErrors).toEqual([]);
  });

  test("Map panel creates and deletes a floor through commands", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    const panel = await selectPanel(page, "map", "panel-map");
    const previousFloorId = await page.getByTestId("floor-select").inputValue();

    await panel.getByTestId("map-create-open").click();
    const waitForNewFloor = sandbox.waitForWrite("project/floors/UI_MAP_NEW.js");
    const waitForTowerWrite = sandbox.waitForWrite("project/data.js");
    await page.getByTestId("map-create-id").fill("UI_MAP_NEW");
    await page.getByTestId("map-create-width").fill("4");
    await page.getByTestId("map-create-height").fill("3");
    await page.getByTestId("map-create-submit").click();
    await waitForNewFloor;
    await waitForTowerWrite;

    expect(sandbox.hasFile("project/floors/UI_MAP_NEW.js")).toBe(true);
    expect(sandbox.readText("project/data.js")).toContain("\"UI_MAP_NEW\"");
    await expect(page.getByTestId("floor-select")).toHaveValue("UI_MAP_NEW");

    const undoCreateDelete = sandbox.waitForDelete("project/floors/UI_MAP_NEW.js");
    const undoCreateTower = sandbox.waitForWrite("project/data.js");
    await page.getByTestId("operation-history-undo").click();
    await Promise.all([undoCreateDelete, undoCreateTower]);
    expect(sandbox.hasFile("project/floors/UI_MAP_NEW.js")).toBe(false);
    expect(sandbox.readText("project/data.js")).not.toContain("\"UI_MAP_NEW\"");
    await expect(page.getByTestId("floor-select")).toHaveValue(previousFloorId);

    const redoCreateFile = sandbox.waitForWrite("project/floors/UI_MAP_NEW.js");
    const redoCreateTower = sandbox.waitForWrite("project/data.js");
    await page.getByTestId("operation-history-redo").click();
    await Promise.all([redoCreateFile, redoCreateTower]);
    expect(sandbox.hasFile("project/floors/UI_MAP_NEW.js")).toBe(true);
    expect(sandbox.readText("project/data.js")).toContain("\"UI_MAP_NEW\"");
    await expect(page.getByTestId("floor-select")).toHaveValue("UI_MAP_NEW");

    const waitForDelete = sandbox.waitForDelete("project/floors/UI_MAP_NEW.js");
    const waitForTowerDeleteWrite = sandbox.waitForWrite("project/data.js");
    await panel.getByTestId("floor-actions-UI_MAP_NEW").click();
    await page.getByTestId("map-delete-submit").click();
    await page.getByRole("button", { name: "删除楼层", exact: true }).click();
    await waitForDelete;
    await waitForTowerDeleteWrite;

    expect(sandbox.hasFile("project/floors/UI_MAP_NEW.js")).toBe(false);
    expect(sandbox.readText("project/data.js")).not.toContain("\"UI_MAP_NEW\"");

    const undoDeleteFile = sandbox.waitForWrite("project/floors/UI_MAP_NEW.js");
    const undoDeleteTower = sandbox.waitForWrite("project/data.js");
    await page.getByTestId("operation-history-undo").click();
    await Promise.all([undoDeleteFile, undoDeleteTower]);
    expect(sandbox.hasFile("project/floors/UI_MAP_NEW.js")).toBe(true);
    expect(sandbox.readText("project/data.js")).toContain("\"UI_MAP_NEW\"");

    const redoDeleteFile = sandbox.waitForDelete("project/floors/UI_MAP_NEW.js");
    const redoDeleteTower = sandbox.waitForWrite("project/data.js");
    await page.getByTestId("operation-history-redo").click();
    await Promise.all([redoDeleteFile, redoDeleteTower]);
    expect(sandbox.hasFile("project/floors/UI_MAP_NEW.js")).toBe(false);
    expect(sandbox.readText("project/data.js")).not.toContain("\"UI_MAP_NEW\"");
    expect(pageErrors).toEqual([]);
  });

  test("Map panel creates full and blank copies after the source floor", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    const source = readFloorData(sandbox, "sample0");
    source.eachArrive = [{ type: "tip", text: "keep each arrive" }];
    source.parallelDo = "flag:copyTest = true;";
    source.cannotMoveIn = { "1,1": ["up"] };
    writeFloorData(sandbox, "sample0", source);
    await page.reload();
    await selectFloor(page, "sample0");
    const panel = await selectPanel(page, "map", "panel-map");

    await panel.getByTestId("floor-actions-sample0").click();
    await page.getByRole("menuitem", { name: "复制地图…", exact: true }).click();
    await page.getByTestId("map-copy-id").fill("UI_COPY_FULL");
    const fullWrites = [
      sandbox.waitForWrite("project/floors/UI_COPY_FULL.js"),
      sandbox.waitForWrite("project/data.js"),
    ];
    await page.getByTestId("map-copy-submit").click();
    await Promise.all(fullWrites);

    const full = readFloorData(sandbox, "UI_COPY_FULL");
    expect(full.floorId).toBe("UI_COPY_FULL");
    expect(full.map).toEqual(source.map);
    expect(full.events).toEqual(source.events);

    await panel.getByTestId("floor-actions-sample0").click();
    await page.getByRole("menuitem", { name: "复制空白地图…", exact: true }).click();
    await page.getByTestId("map-copy-id").fill("UI_COPY_BLANK");
    const blankWrites = [
      sandbox.waitForWrite("project/floors/UI_COPY_BLANK.js"),
      sandbox.waitForWrite("project/data.js"),
    ];
    await page.getByTestId("map-copy-submit").click();
    await Promise.all(blankWrites);

    const blank = readFloorData(sandbox, "UI_COPY_BLANK");
    expect(blank.map.every((row: number[]) => row.every((cell) => cell === 0))).toBe(true);
    expect(blank.bgmap).toHaveLength(blank.height);
    expect(blank.fgmap).toHaveLength(blank.height);
    expect(blank.events).toEqual({});
    expect(blank.changeFloor).toEqual({});
    expect(blank.cannotMoveIn).toEqual({});
    expect(blank.firstArrive).toEqual(source.firstArrive);
    expect(blank.eachArrive).toEqual(source.eachArrive);
    expect(blank.parallelDo).toBe(source.parallelDo);
    expect(readTowerData(sandbox).main.floorIds.slice(0, 4)).toEqual([
      "sample0",
      "UI_COPY_BLANK",
      "UI_COPY_FULL",
      "sample1",
    ]);
    expect(pageErrors).toEqual([]);
  });

  test("Map panel searches, reorders and manages a floor partition", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    const panel = await selectPanel(page, "map", "panel-map");
    const search = panel.getByTestId("floor-management-search");

    await search.fill("样板 1");
    await expect(panel.getByTestId("floor-management-row-sample1")).toBeVisible();
    await expect(panel.getByTestId("floor-management-row-sample0")).toHaveCount(0);
    await expect(panel.getByTestId("floor-management-row-sample1")).toHaveAttribute("draggable", "false");
    await search.fill("");

    const reorderWrite = sandbox.waitForWrite("project/data.js");
    await panel.getByTestId("floor-management-row-sample1").dragTo(panel.getByTestId("floor-management-row-sample0"));
    await reorderWrite;
    expect(readTowerData(sandbox).main.floorIds.slice(0, 2)).toEqual(["sample1", "sample0"]);

    await page.reload();
    const reloadedPanel = await selectPanel(page, "map", "panel-map");
    const rows = reloadedPanel.locator("[data-test-id^='floor-management-row-']");
    await expect(rows.nth(0)).toHaveAttribute("data-test-id", "floor-management-row-sample1");

    await reloadedPanel.getByTestId("floor-management-row-sample0").click({ button: "right" });
    const partitionWrite = sandbox.waitForWrite("project/data.js");
    await page.getByRole("menuitem", { name: "创建分区", exact: true }).click();
    await partitionWrite;
    expect(readTowerData(sandbox).main.floorPartitions).toEqual([["sample0", "sample0"]]);
    await expect(reloadedPanel.getByTestId("floor-partition-0-start")).toBeVisible();

    await reloadedPanel.getByTestId("floor-partition-0-start").click({ button: "right" });
    await page.getByRole("menuitem", { name: "删除分区", exact: true }).click();
    const removeWrite = sandbox.waitForWrite("project/data.js");
    await page.getByRole("button", { name: "删除分区", exact: true }).click();
    await removeWrite;
    expect(readTowerData(sandbox).main.floorPartitions).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test("AppendPic appends and removes an item sprite without reloading material consumers", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    const itemPath = "project/materials/items.png";
    const before = readPngDimensions(sandbox.readBytes(itemPath));
    const oldRows = before.height / 32;

    const layoutToggle = page.getByTestId("material-layout-toggle");
    if (await layoutToggle.getByText("展开素材区").count()) {
      const layoutWrite = sandbox.waitForWrite("_server/config.json");
      await layoutToggle.click();
      await layoutWrite;
    }

    await selectPanel(page, "appendpic", "panel-appendpic");
    await page.getByTestId("appendpic-material-type").selectOption("items");
    await page.getByTestId("appendpic-file-input").setInputFiles(
      path.resolve(PROJECT_ROOT, "materials/airwall.png"),
    );
    const sourceCanvas = page.getByTestId("appendpic-grid-canvas");
    await expect(sourceCanvas).toBeVisible();
    await sourceCanvas.click({ position: { x: 16, y: 16 } });

    const appendWrites = [
      sandbox.waitForWrite(itemPath),
      sandbox.waitForWrite("project/icons.js"),
      sandbox.waitForWrite("project/maps.js"),
      sandbox.waitForWrite("project/items.js"),
    ];
    await page.getByTestId("appendpic-append").click();
    await Promise.all(appendWrites);

    expect(readPngDimensions(sandbox.readBytes(itemPath)).height).toBe(before.height + 32);
    const materialImage = page.getByTestId("material-image-items");
    await expect.poll(() => materialImage.evaluate((image) => (image as HTMLImageElement).naturalHeight))
      .toBe(before.height + 32);

    const undoAppendWrites = [
      sandbox.waitForWrite(itemPath),
      sandbox.waitForWrite("project/icons.js"),
      sandbox.waitForWrite("project/maps.js"),
      sandbox.waitForWrite("project/items.js"),
    ];
    await page.getByTestId("operation-history-undo").click();
    await Promise.all(undoAppendWrites);
    expect(readPngDimensions(sandbox.readBytes(itemPath)).height).toBe(before.height);
    await expect.poll(() => materialImage.evaluate((image) => (image as HTMLImageElement).naturalHeight))
      .toBe(before.height);

    const redoAppendWrites = [
      sandbox.waitForWrite(itemPath),
      sandbox.waitForWrite("project/icons.js"),
      sandbox.waitForWrite("project/maps.js"),
      sandbox.waitForWrite("project/items.js"),
    ];
    await page.getByTestId("operation-history-redo").click();
    await Promise.all(redoAppendWrites);
    expect(readPngDimensions(sandbox.readBytes(itemPath)).height).toBe(before.height + 32);
    await expect.poll(() => materialImage.evaluate((image) => (image as HTMLImageElement).naturalHeight))
      .toBe(before.height + 32);

    await page.getByTestId("workspace-map").click();
    await clickMaterialCell(page, "items", 0, oldRows);
    const prefabPanel = await selectPanel(page, "enemyitem", "panel-prefab");
    await expect(prefabPanel.getByTestId("prefab-remove-registered")).toBeVisible();

    page.on("dialog", async (dialog) => dialog.accept());
    const removeWrites = [
      sandbox.waitForWrite(itemPath),
      sandbox.waitForWrite("project/icons.js"),
      sandbox.waitForWrite("project/maps.js"),
      sandbox.waitForWrite("project/items.js"),
    ];
    await prefabPanel.getByTestId("prefab-remove-registered").click();
    await Promise.all(removeWrites);

    expect(readPngDimensions(sandbox.readBytes(itemPath)).height).toBe(before.height);
    await expect.poll(() => materialImage.evaluate((image) => (image as HTMLImageElement).naturalHeight))
      .toBe(before.height);
    expect(pageErrors).toEqual([]);
  });

  test("AppendPic appends and deletes an autotile file through the shared collection", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    const autotilePath = "project/autotiles/autotile4.png";
    expect(sandbox.hasFile(autotilePath)).toBe(false);

    await selectPanel(page, "appendpic", "panel-appendpic");
    await page.getByTestId("appendpic-material-type").selectOption("autotile");
    await page.getByTestId("appendpic-file-input").setInputFiles(
      path.resolve(PROJECT_ROOT, "autotiles/autotile2.png"),
    );

    const appendWrites = [
      sandbox.waitForWrite(autotilePath),
      sandbox.waitForWrite("project/icons.js"),
      sandbox.waitForWrite("project/maps.js"),
    ];
    await page.getByTestId("appendpic-append").click();
    await Promise.all(appendWrites);
    expect(sandbox.hasFile(autotilePath)).toBe(true);

    const materialId = "autotile:autotile4.png";
    const autotileImage = page.getByTestId(`material-image-${materialId}`);
    await page.getByTestId("workspace-map").click();
    await expect(autotileImage).toBeVisible();
    await clickMaterialCell(page, materialId, 0, 0);
    const prefabPanel = await selectPanel(page, "enemyitem", "panel-prefab");
    await expect(prefabPanel.getByTestId("prefab-remove-registered")).toBeVisible();

    page.on("dialog", async (dialog) => dialog.accept());
    const deleteWrites = [
      sandbox.waitForDelete(autotilePath),
      sandbox.waitForWrite("project/icons.js"),
      sandbox.waitForWrite("project/maps.js"),
    ];
    await prefabPanel.getByTestId("prefab-remove-registered").click();
    await Promise.all(deleteWrites);

    expect(sandbox.hasFile(autotilePath)).toBe(false);
    await expect(autotileImage).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  });

  test("material deletion reports map usage before an explicit forced removal", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    const itemPath = "project/materials/items.png";
    const before = readPngDimensions(sandbox.readBytes(itemPath));
    expect(readFloorData(sandbox, "sample0").map[8][8]).toBe(21);

    await clickMaterialCell(page, "items", 0, 0);
    const prefabPanel = await selectPanel(page, "enemyitem", "panel-prefab");
    await expect(prefabPanel.getByTestId("prefab-remove-registered")).toBeVisible();

    const dialogs: string[] = [];
    page.on("dialog", async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.accept();
    });
    const writes = [
      sandbox.waitForWrite(itemPath),
      sandbox.waitForWrite("project/icons.js"),
      sandbox.waitForWrite("project/maps.js"),
      sandbox.waitForWrite("project/items.js"),
    ];
    await prefabPanel.getByTestId("prefab-remove-registered").click();
    await Promise.all(writes);

    expect(dialogs.some((message) => message.includes("地图位置使用"))).toBe(true);
    expect(readPngDimensions(sandbox.readBytes(itemPath)).height).toBe(before.height - 32);
    expect(readMapBlocks(sandbox)["21"]).toBeUndefined();
    expect(readFloorData(sandbox, "sample0").map[8][8]).toBe(21);
    expect(pageErrors).toEqual([]);
  });

  test("enemy schema loads project specials and updates inactive parameters", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    const functionsBefore = sandbox.readText("project/functions.js");
    const legacyCommentBefore = sandbox.readText("_server/table/comment.js");
    await selectFloor(page, "sample0");
    await doubleClickMapCell(page, 0, 7);
    const panel = await selectPanel(page, "enemyitem", "panel-prefab");
    await expect(panel.getByTestId("prefab-table-version")).toHaveCount(0);
    await expect(panel.getByTestId("prefab-edit-mode")).toHaveCount(0);
    await expect(panel.getByTestId("schema-field-n")).toHaveClass(/schemaTableInactive/);
    await expect(panel.getByTestId("schema-group-map-effects")).toHaveClass(/schemaTableInactive/);
    await expect(panel.getByTestId("schema-group-halo")).toHaveClass(/schemaTableInactive/);

    await panel.getByTestId("schema-input-special").getByTestId("schema-checkbox-set-open").click();
    await expect(page.getByTestId("checkbox-set-modal")).toBeVisible();
    await expect(page.getByTestId("checkbox-set-1")).toBeVisible();
    await expect(page.getByTestId("checkbox-set-6")).toBeVisible();
    await page.getByTestId("checkbox-set-6").check();
    const waitForWrite = sandbox.waitForWrite("project/enemys.js");
    await page.getByTestId("checkbox-set-modal-confirm").click();
    await waitForWrite;
    expect(sandbox.readText("project/enemys.js")).toMatch(/"special"\s*:\s*\[\s*6\s*\]/);
    expect(sandbox.writeCount("project/functions.js")).toBe(0);
    expect(sandbox.writeCount("_server/table/comment.js")).toBe(0);
    expect(sandbox.readText("project/functions.js")).toBe(functionsBefore);
    expect(sandbox.readText("_server/table/comment.js")).toBe(legacyCommentBefore);
    await expect(panel.getByTestId("schema-field-n")).not.toHaveClass(/schemaTableInactive/);

    await panel.getByTestId("prefab-reset-properties").click();
    const resetModal = page.locator(".ant-modal").filter({ hasText: "重置怪物属性" });
    await expect(resetModal.getByText("重置怪物属性", { exact: true })).toBeVisible();
    await expect(page.getByTestId("prefab-property-change-list")).toContainText("special");
    await resetModal.getByRole("button", { name: /取\s*消/ }).click();
    expect(pageErrors).toEqual([]);
  });

  test("bound images reuse the image picker without crop editing", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    await selectFloor(page, "sample0");
    await doubleClickMapCell(page, 0, 7);
    const panel = await selectPanel(page, "enemyitem", "panel-prefab");
    await panel.getByTestId("schema-input-bigImage").getByRole("button", { name: "编辑" }).click();
    const picker = page.getByTestId("image-asset-picker");
    await expect(picker).toBeVisible();
    const option = page.getByTestId("image-asset-option-dragon_0.png");
    await option.click();
    const preview = page.getByTestId("image-asset-static-preview").locator("canvas");
    await expect(preview).toBeVisible();
    await expect(picker.getByText("在图片上拖拽框选裁剪区域")).toHaveCount(0);
    await expect.poll(() =>
      preview.evaluate((canvas) => ({
        width: (canvas as HTMLCanvasElement).width,
        height: (canvas as HTMLCanvasElement).height,
      })),
    ).toEqual({ width: 384, height: 96 });
    const waitForWrite = sandbox.waitForWrite("project/enemys.js");
    await option.dblclick();
    await waitForWrite;
    expect(sandbox.readText("project/enemys.js")).toMatch(/"greenSlime"\s*:\s*\{[^}]*"bigImage"\s*:\s*"dragon_0\.png"/s);
    expect(pageErrors).toEqual([]);
  });

  test("floor images reuse the same picker with crop editing enabled", async ({ page }) => {
    const { pageErrors } = await bootWithSandbox(page);
    await selectFloor(page, "sample0");
    const panel = await selectPanel(page, "floor", "panel-floor");
    await panel.getByTestId("schema-input-images").getByRole("button", { name: "预览编辑" }).click();
    const editor = page.getByTestId("floor-image-editor");
    await expect(editor).toBeVisible();
    await editor.getByRole("button", { name: "添加贴图" }).click();

    const picker = page.getByTestId("image-asset-picker");
    await expect(picker).toBeVisible();
    await expect(picker.getByText("在图片上拖拽框选裁剪区域")).toBeVisible();
    await page.getByTestId("image-asset-option-bear.png").dblclick();
    await expect(picker).toHaveCount(0);
    await expect(editor.getByTitle("bear.png", { exact: true })).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test("animation preview plays and sound cues persist through operation history", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    const panel = await selectPanel(page, "tower", "panel-tower");
    await panel.getByTestId("table-edit-main-animates").click();
    await page.getByTestId("select-material-preview-jianji").click();
    const canvas = page.getByTestId("animation-preview-canvas");
    await expect(canvas).toBeVisible();
    const checksum = () =>
      canvas.evaluate((element) => {
        const context = (element as HTMLCanvasElement).getContext("2d");
        if (!context) return 0;
        const pixels = context.getImageData(0, 0, 416, 416).data;
        let sum = 0;
        for (let index = 3; index < pixels.length; index += 16) sum += pixels[index];
        return sum;
      });
    await expect.poll(checksum).toBeGreaterThan(0);

    await page.getByTestId("animation-cue-add").click();
    await page.getByTestId("animation-cue-sound-0").fill("attack.mp3");
    await page.getByTestId("animation-cue-pitch-0").fill("130");
    const animationPath = "project/animates/jianji.animate";
    const saveWrite = sandbox.waitForWrite(animationPath);
    await page.getByTestId("animation-cue-save").click();
    await saveWrite;
    expect(JSON.parse(sandbox.readText(animationPath))).toMatchObject({
      se: { 1: "attack.mp3" },
      pitch: { 1: 130 },
    });
    await page.getByTestId("select-material-modal-cancel").click();

    const undoWrite = sandbox.waitForWrite(animationPath);
    await page.getByTestId("operation-history-undo").click();
    await undoWrite;
    expect(JSON.parse(sandbox.readText(animationPath)).se).toBeUndefined();
    const redoWrite = sandbox.waitForWrite(animationPath);
    await page.getByTestId("operation-history-redo").click();
    await redoWrite;
    expect(JSON.parse(sandbox.readText(animationPath)).se).toEqual({ 1: "attack.mp3" });
    expect(pageErrors).toEqual([]);
  });
});
