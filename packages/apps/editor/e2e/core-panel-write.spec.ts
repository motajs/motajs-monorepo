import { expect, test, type Page } from "@playwright/test";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import JSON5 from "json5";
import { MOTA_JS_ROOT } from "../mota-root";
import { ProjectSandbox } from "./utils/projectSandbox";
import {
  clickMapCell,
  clickMaterialCell,
  doubleClickMapCell,
  editTextareaByField,
  editTextareaContaining,
  expectTextareaByFieldValue,
  expectTextareaContaining,
  rightClickMapCell,
  selectFloor,
  selectPanel,
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
    const playCallsBefore = await page.evaluate(() => (
      window as Window & { __audioPlayCalls: number }
    ).__audioPlayCalls);
    await toggle.click();
    await expect(toggle).toHaveText("暂停");
    await expect.poll(() => page.evaluate(() => (
      window as Window & { __audioPlayCalls: number }
    ).__audioPlayCalls)).toBeGreaterThan(playCallsBefore);
    await page.getByTestId("select-material-modal-cancel").click();

    expect(pageErrors).toEqual([]);
  });

  test("Blockly edits startCanvas through the modern EventEditor capability", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    await selectPanel(page, "tower", "panel-tower");

    await page.getByTestId("table-input-firstData-startCanvas").locator("textarea").dblclick();
    const editor = page.getByTestId("event-editor");
    await expect(editor).toBeVisible();
    await expect(editor).not.toContainText("未知事件");

    const source = page.getByTestId("event-editor-source");
    await expect(source).toHaveValue(/"type":"previewUI"/);
    await expect(source).toHaveValue(/"case":"keyboard"/);
    const events = JSON5.parse(await source.inputValue()) as Array<Record<string, unknown>>;
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
    await selectPanel(page, "tower", "panel-tower");
    await page.getByTestId("table-input-firstData-startCanvas").locator("textarea").dblclick();

    const before = readTowerData(sandbox);
    const source = page.getByTestId("event-editor-source");
    await source.fill('[{"type":"comment","text":"UNPARSED_SOURCE"}]');
    await expect(source).toHaveAttribute("data-source-dirty", "true");
    await page.getByTestId("event-editor-confirm").click();

    await expect(page.getByTestId("event-editor")).toBeVisible();
    await expect(source).toHaveValue(/UNPARSED_SOURCE/);
    expect(readTowerData(sandbox)).toEqual(before);
    expect(sandbox.readText("project/data.js")).not.toContain("UNPARSED_SOURCE");
    expect(pageErrors).toEqual([]);
  });

  test("Loc afterGetItem and CommonEvent open with their existing content", async ({ page }) => {
    const { pageErrors } = await bootWithSandbox(page);
    await selectFloor(page, "sample0");
    await clickMapCell(page, 8, 7);

    const locPanel = await selectPanel(page, "loc", "panel-loc");
    const afterGetItem = locPanel.getByTestId("table-input-afterGetItem").locator("textarea");
    await expect(afterGetItem).toHaveValue(/如需修改消耗品的效果/);
    await afterGetItem.dblclick();
    await expect(page.getByTestId("event-editor-source")).toHaveValue(/如需修改消耗品的效果/);
    await expect(page.getByTestId("event-editor")).not.toContainText("未知事件");
    await page.getByTestId("event-editor-cancel").click();

    const commonPanel = await selectPanel(page, "commonevent", "panel-common-event");
    await commonPanel.getByTestId("table-input-加点事件").locator("textarea").dblclick();
    await expect(page.getByTestId("event-editor-source")).toHaveValue(/flag:arg1/);
    await expect(page.getByTestId("event-editor")).toContainText("攻击+");
    await page.getByTestId("event-editor-cancel").click();
    expect(pageErrors).toEqual([]);
  });

  test("Blockly selects project material without runtime", async ({ page }) => {
    const { pageErrors } = await bootWithSandbox(page);
    await selectFloor(page, "sample0");
    await clickMapCell(page, 8, 7);
    const panel = await selectPanel(page, "loc", "panel-loc");
    await panel.getByTestId("table-input-afterGetItem").locator("textarea").dblclick();

    const source = page.getByTestId("event-editor-source");
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
    await panel.getByTestId("table-input-firstData-startCanvas").locator("textarea").dblclick();
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
    await panel.getByTestId("table-input-firstData-startCanvas").locator("textarea").dblclick();
    const source = page.getByTestId("event-editor-source");
    await source.fill(JSON.stringify([
      { type: "setValue", name: "flag:door", operator: "+=", value: "1", norefresh: true },
      { type: "showImage", code: 1, name: "bg.jpg", loc: [0, 0], opacity: 1 },
    ], null, 2));
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
    await panel.getByTestId("table-input-firstData-startCanvas").locator("textarea").dblclick();
    const source = page.getByTestId("event-editor-source");
    const events = [
      { type: "setBlockOpacity", loc: [[1, 2], [3, 4]], floorId: "sample0", opacity: 0.5 },
      { type: "setEquip", id: "sword1", valueType: "percentage", name: "atk", value: "12" },
      { type: "drawImage", image: "bg.jpg", x: 0, y: 0, w: 32, h: 32, x1: 100, y1: 100, w1: 64, h1: 64 },
    ];
    await source.fill(JSON.stringify(events, null, 2));
    await page.getByTestId("event-editor-parse").click();

    for (const type of ["mota_setBlockOpacity_s", "mota_setEquip_s", "mota_drawImage_s"]) {
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
    await panel.getByTestId("table-input-firstData-startCanvas").locator("textarea").dblclick();
    await expect(page.getByTestId("event-editor-source")).toHaveValue(/"type":"drawImage"/);
    await expect(page.getByTestId("event-editor")).not.toContainText("未知事件");
    await page.getByTestId("event-editor-cancel").click();
    expect(pageErrors).toEqual([]);
  });

  test("Functions panel edits a function body and reads it back after reload", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    const panel = await selectPanel(page, "functions", "panel-functions");

    const waitForWrite = sandbox.waitForWrite("project/functions.js");
    await editTextareaContaining(
      panel,
      "core.clearStatus()",
      "function () { return '__uiFunctionWrite'; }",
    );
    await waitForWrite;

    expect(sandbox.readText("project/functions.js")).toContain("__uiFunctionWrite");

    await page.reload();
    const reloadedPanel = await selectPanel(page, "functions", "panel-functions");
    await expectTextareaContaining(reloadedPanel, "__uiFunctionWrite");
    expect(pageErrors).toEqual([]);
  });

  test("CommonEvent panel edits an event leaf without dropping sibling data", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    const panel = await selectPanel(page, "commonevent", "panel-common-event");

    const waitForWrite = sandbox.waitForWrite("project/events.js");
    await editTextareaContaining(panel, "通过传参，flag:arg1", [
      { type: "comment", text: "UI common event write" },
    ]);
    await waitForWrite;

    const eventsText = sandbox.readText("project/events.js");
    expect(eventsText).toContain("UI common event write");
    expect(eventsText).toContain("回收钥匙商店");
    expect(eventsText).toContain("commonEvent");

    await page.reload();
    const reloadedPanel = await selectPanel(page, "commonevent", "panel-common-event");
    await expectTextareaContaining(reloadedPanel, "UI common event write");
    expect(pageErrors).toEqual([]);
  });

  test("Plugin panel edits plugin source and reads it back after reload", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    const panel = await selectPanel(page, "plugins", "panel-plugins");

    const waitForWrite = sandbox.waitForWrite("project/plugins.js");
    await editTextareaContaining(
      panel,
      "this.drawLight = function",
      "function () { this.__uiPluginWrite = true; }",
    );
    await waitForWrite;

    expect(sandbox.readText("project/plugins.js")).toContain("__uiPluginWrite");

    await page.reload();
    const reloadedPanel = await selectPanel(page, "plugins", "panel-plugins");
    await expectTextareaContaining(reloadedPanel, "__uiPluginWrite");
    expect(pageErrors).toEqual([]);
  });

  test("Plugin opens the modern CodeEditor and saves raw function source", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    const panel = await selectPanel(page, "plugins", "panel-plugins");
    const row = panel.getByTestId("table-row-init");
    await expect(row).toBeVisible();
    await row.dblclick();

    const editor = page.getByTestId("code-editor");
    await expect(editor).not.toHaveClass(/hidden-panel/);
    await expect(editor).toHaveAttribute("data-tern-status", "ready");
    await expect(page.getByTestId("code-editor-content")).toContainText("function init");
    await expect(page.getByTestId("code-editor-content")).not.toContainText('"function init');

    const waitForWrite = sandbox.waitForWrite("project/plugins.js");
    const codeInput = page.getByTestId("code-editor-input");
    await codeInput.press("ControlOrMeta+A");
    await codeInput.fill(
      "function init () { this.__uiCodeEditorPluginWrite = true; }",
      { force: true },
    );
    await page.getByTestId("code-editor-confirm").click();
    await waitForWrite;
    expect(sandbox.readText("project/plugins.js")).toContain("__uiCodeEditorPluginWrite");

    await page.reload();
    const reloadedPanel = await selectPanel(page, "plugins", "panel-plugins");
    await reloadedPanel.getByTestId("table-row-init").dblclick();
    await expect(page.getByTestId("code-editor-content")).toContainText("__uiCodeEditorPluginWrite");
    expect(pageErrors).toEqual([]);
  });

  test("Functions and table metadata use the same CodeEditor capability", async ({ page }) => {
    const { pageErrors } = await bootWithSandbox(page);
    const functionsPanel = await selectPanel(page, "functions", "panel-functions");
    const functionRow = functionsPanel.getByTestId("table-row-events-resetGame");
    await expect(functionRow).toBeVisible();
    await functionRow.dblclick();
    await expect(page.getByTestId("code-editor-content")).toContainText("function resetGame");
    await page.getByTestId("code-editor-cancel").click();

    const pluginPanel = await selectPanel(page, "plugins", "panel-plugins");
    await pluginPanel.getByTestId("configure-table").click();
    await expect(page.getByTestId("code-editor-content")).toContainText("表格配置项");
    await page.getByTestId("code-editor-cancel").click();
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

  test("Floor point fields use the modern picker without runtime", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    const floor = readFloorData(sandbox, "sample0");
    floor.upFloor = [0, 0];
    writeFloorData(sandbox, "sample0", floor);
    await page.reload();
    await selectFloor(page, "sample0");
    const panel = await selectPanel(page, "floor", "panel-floor");

    await panel.getByTestId("table-input-upFloor").locator("textarea").dblclick();
    const modal = page.getByTestId("select-point-modal");
    await expect(modal).toBeVisible();
    await expect(page.getByTestId("select-point-floor")).toHaveValue("sample0");
    await expect(page.getByTestId("map-pixi-renderer").last()).toBeVisible();

    await page.getByTestId("select-point-canvas").click({
      position: { x: 4 * 32 + 16, y: 5 * 32 + 16 },
    });
    const waitForWrite = sandbox.waitForWrite("project/floors/sample0.js");
    await page.getByTestId("select-point-confirm").click();
    await waitForWrite;

    expect(readFloorData(sandbox, "sample0").upFloor).toEqual([4, 5]);
    expect(pageErrors).toEqual([]);
  });

  test("Floor panel renames sample0 without touching the real project", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    await selectFloor(page, "sample0");
    const panel = await selectPanel(page, "floor", "panel-floor");

    const waitForNewFloor = sandbox.waitForWrite("project/floors/sample0_UI_RENAMED.js");
    const waitForOldFloorDelete = sandbox.waitForDelete("project/floors/sample0.js");
    const waitForTowerWrite = sandbox.waitForWrite("project/data.js");

    await panel.getByTestId("floor-rename-input").fill("sample0_UI_RENAMED");
    await panel.getByTestId("floor-rename-submit").click();

    await waitForNewFloor;
    await waitForOldFloorDelete;
    await waitForTowerWrite;

    expect(sandbox.hasFile("project/floors/sample0.js")).toBe(false);
    expect(sandbox.hasFile("project/floors/sample0_UI_RENAMED.js")).toBe(true);
    expect(sandbox.readText("project/floors/sample0_UI_RENAMED.js")).toContain(
      '"floorId": "sample0_UI_RENAMED"',
    );
    expect(sandbox.readText("project/data.js")).toContain('"sample0_UI_RENAMED"');
    expect(sandbox.readText("project/data.js")).not.toContain('"sample0",');

    const towerReads = sandbox.readCount("project/data.js");
    await page.reload();
    await expect.poll(() => sandbox.readCount("project/data.js")).toBeGreaterThan(towerReads);
    expect(readTowerData(sandbox).main.floorIds).toContain("sample0_UI_RENAMED");
    await selectFloor(page, "sample0_UI_RENAMED");
    const reloadedPanel = await selectPanel(page, "floor", "panel-floor");
    await expectTextareaByFieldValue(reloadedPanel, "floorId", "sample0_UI_RENAMED");
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
    expect(sandbox.readText("project/floors/sample0.js")).toContain('"2,10"');

    await page.reload();
    await selectFloor(page, "sample0");
    await clickMapCell(page, 2, 10);
    const reloadedPanel = await selectPanel(page, "loc", "panel-loc");
    await expectTextareaByFieldValue(reloadedPanel, "events", nextEvents);
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
    expect(sandbox.readText("project/items.js")).toContain('"yellowKey"');

    await page.reload();
    await selectFloor(page, "sample0");
    await doubleClickMapCell(page, 8, 8);
    const reloadedPanel = await selectPanel(page, "enemyitem", "panel-prefab");
    await expectTextareaByFieldValue(reloadedPanel, "name", "UI 黄钥匙");
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
    expect(sandbox.readText("project/enemys.js")).toContain('"greenSlime"');

    await page.reload();
    await selectFloor(page, "sample0");
    await doubleClickMapCell(page, 0, 7);
    const reloadedPanel = await selectPanel(page, "enemyitem", "panel-prefab");
    await expectTextareaByFieldValue(reloadedPanel, "name", "UI 绿头怪");
    expect(pageErrors).toEqual([]);
  });

  test("doorInfo opens its dedicated Blockly entry blocks", async ({ page }) => {
    const { pageErrors } = await bootWithSandbox(page);
    await selectFloor(page, "sample0");
    await doubleClickMapCell(page, 8, 12);
    const panel = await selectPanel(page, "enemyitem", "panel-prefab");

    await panel.getByTestId("table-input-doorInfo").locator("textarea").dblclick();
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

    await panel.getByTestId("table-input-equip").locator("textarea").dblclick();
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

    await panel.getByTestId("table-input-faceIds").locator("textarea").dblclick();
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

    await panel.getByTestId("table-input-images").locator("textarea").dblclick();
    const editor = page.getByTestId("event-editor");
    await expect(editor).toContainText("楼层贴图");
    const source = page.getByTestId("event-editor-source");
    await source.fill(JSON.stringify([{ name: "bg.jpg", canvas: "bg", x: 0, y: 0 }], null, 2));
    await page.getByTestId("event-editor-parse").click();
    await expect(editor).toContainText("图片名");
    const waitForWrite = sandbox.waitForWrite("project/floors/sample0.js");
    await page.getByTestId("event-editor-confirm").click();
    await waitForWrite;

    expect(readFloorData(sandbox, "sample0").images).toEqual([
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

  test("Map editor tileset mode repeats a dragged source pattern and records recent use", async ({ page }) => {
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
    await page.getByTestId("brush-tileset").check();

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
    expect(floor.map[5].slice(4, 8)).toEqual([first + columns, first + columns + 1, first + columns, first + columns + 1]);
    await expect(page.getByTestId(`recent-material-${first}`)).toBeVisible();
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
    await expect(page.getByTestId("edit-mode-select")).toHaveValue("map");
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

    const waitForWrite = sandbox.waitForWrite("project/floors/sample0.js");
    await panel.getByTestId("map-panel-textarea").fill(JSON.stringify(matrix));
    await panel.getByTestId("map-import-submit").click();
    await waitForWrite;

    expect(readFloorData(sandbox, "sample0").map[5][6]).toBe(21);

    await page.reload();
    await selectFloor(page, "sample0");
    await doubleClickMapCell(page, 6, 5);
    const reloadedPanel = await selectPanel(page, "enemyitem", "panel-prefab");
    await expectTextareaByFieldValue(reloadedPanel, "name", "黄钥匙");
    expect(pageErrors).toEqual([]);
  });

  test("Map panel clears the current floor map and event data", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    await selectFloor(page, "sample0");
    const panel = await selectPanel(page, "map", "panel-map");

    const waitForWrite = sandbox.waitForWrite("project/floors/sample0.js");
    page.once("dialog", (dialog) => dialog.accept());
    await panel.getByTestId("map-clear-submit").click();
    await waitForWrite;

    const floor = readFloorData(sandbox, "sample0");
    expect(floor.map.every((row: number[]) => row.every((cell) => cell === 0))).toBe(true);
    expect(floor.bgmap.every((row: number[]) => row.every((cell) => cell === 0))).toBe(true);
    expect(floor.fgmap.every((row: number[]) => row.every((cell) => cell === 0))).toBe(true);
    expect(floor.events).toEqual({});
    expect(floor.changeFloor).toEqual({});
    expect(floor.cannotMove).toEqual({});
    expect(pageErrors).toEqual([]);
  });

  test("Map panel creates and deletes a floor through commands", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    const panel = await selectPanel(page, "map", "panel-map");
    const previousFloorId = await page.getByTestId("floor-select").inputValue();

    const waitForNewFloor = sandbox.waitForWrite("project/floors/UI_MAP_NEW.js");
    const waitForTowerWrite = sandbox.waitForWrite("project/data.js");
    await panel.getByTestId("map-create-id").fill("UI_MAP_NEW");
    await panel.getByTestId("map-create-width").fill("4");
    await panel.getByTestId("map-create-height").fill("3");
    await panel.getByTestId("map-create-submit").click();
    await waitForNewFloor;
    await waitForTowerWrite;

    expect(sandbox.hasFile("project/floors/UI_MAP_NEW.js")).toBe(true);
    expect(sandbox.readText("project/data.js")).toContain('"UI_MAP_NEW"');
    await expect(page.getByTestId("floor-select")).toHaveValue("UI_MAP_NEW");

    const undoCreateDelete = sandbox.waitForDelete("project/floors/UI_MAP_NEW.js");
    const undoCreateTower = sandbox.waitForWrite("project/data.js");
    await page.getByTestId("operation-history-undo").click();
    await Promise.all([undoCreateDelete, undoCreateTower]);
    expect(sandbox.hasFile("project/floors/UI_MAP_NEW.js")).toBe(false);
    expect(sandbox.readText("project/data.js")).not.toContain('"UI_MAP_NEW"');
    await expect(page.getByTestId("floor-select")).toHaveValue(previousFloorId);

    const redoCreateFile = sandbox.waitForWrite("project/floors/UI_MAP_NEW.js");
    const redoCreateTower = sandbox.waitForWrite("project/data.js");
    await page.getByTestId("operation-history-redo").click();
    await Promise.all([redoCreateFile, redoCreateTower]);
    expect(sandbox.hasFile("project/floors/UI_MAP_NEW.js")).toBe(true);
    expect(sandbox.readText("project/data.js")).toContain('"UI_MAP_NEW"');
    await expect(page.getByTestId("floor-select")).toHaveValue("UI_MAP_NEW");

    const waitForDelete = sandbox.waitForDelete("project/floors/UI_MAP_NEW.js");
    const waitForTowerDeleteWrite = sandbox.waitForWrite("project/data.js");
    page.once("dialog", (dialog) => dialog.accept());
    await panel.getByTestId("map-delete-submit").click();
    await waitForDelete;
    await waitForTowerDeleteWrite;

    expect(sandbox.hasFile("project/floors/UI_MAP_NEW.js")).toBe(false);
    expect(sandbox.readText("project/data.js")).not.toContain('"UI_MAP_NEW"');

    const undoDeleteFile = sandbox.waitForWrite("project/floors/UI_MAP_NEW.js");
    const undoDeleteTower = sandbox.waitForWrite("project/data.js");
    await page.getByTestId("operation-history-undo").click();
    await Promise.all([undoDeleteFile, undoDeleteTower]);
    expect(sandbox.hasFile("project/floors/UI_MAP_NEW.js")).toBe(true);
    expect(sandbox.readText("project/data.js")).toContain('"UI_MAP_NEW"');

    const redoDeleteFile = sandbox.waitForDelete("project/floors/UI_MAP_NEW.js");
    const redoDeleteTower = sandbox.waitForWrite("project/data.js");
    await page.getByTestId("operation-history-redo").click();
    await Promise.all([redoDeleteFile, redoDeleteTower]);
    expect(sandbox.hasFile("project/floors/UI_MAP_NEW.js")).toBe(false);
    expect(sandbox.readText("project/data.js")).not.toContain('"UI_MAP_NEW"');
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

  test("enemy specials use the modern checkbox modal and Prefab has one mode control", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    await selectFloor(page, "sample0");
    await doubleClickMapCell(page, 0, 7);
    const panel = await selectPanel(page, "enemyitem", "panel-prefab");
    await expect(panel.getByTestId("prefab-edit-mode")).toBeVisible();
    await expect(panel.getByTestId("table-edit-special")).toBeVisible();

    await panel.getByTestId("table-edit-special").click();
    await expect(page.getByTestId("checkbox-set-modal")).toBeVisible();
    await expect(page.getByTestId("checkbox-set-1")).toBeVisible();
    await expect(page.getByTestId("checkbox-set-6")).toBeVisible();
    await page.getByTestId("checkbox-set-1").check();
    const waitForWrite = sandbox.waitForWrite("project/enemys.js");
    await page.getByTestId("checkbox-set-modal-confirm").click();
    await waitForWrite;
    expect(sandbox.readText("project/enemys.js")).toMatch(/"special"\s*:\s*\[\s*1\s*\]/);
    expect(pageErrors).toEqual([]);
  });

  test("logical split images preview from their physical source", async ({ page }) => {
    const { pageErrors } = await bootWithSandbox(page);
    await selectFloor(page, "sample0");
    await doubleClickMapCell(page, 0, 7);
    const panel = await selectPanel(page, "enemyitem", "panel-prefab");
    await panel.getByTestId("table-edit-bigImage").click();
    await expect(page.getByTestId("select-material-dragon_0.png")).toBeVisible();
    await page.getByTestId("select-material-preview-dragon_0.png").click();
    const preview = page.getByTestId("select-material-crop-preview");
    await expect(preview).toBeVisible();
    await expect.poll(() => preview.evaluate((canvas) => ({
      width: (canvas as HTMLCanvasElement).width,
      height: (canvas as HTMLCanvasElement).height,
    }))).toEqual({ width: 384, height: 96 });
    await page.getByTestId("select-material-modal-cancel").click();
    expect(pageErrors).toEqual([]);
  });

  test("animation preview plays and sound cues persist through operation history", async ({ page }) => {
    const { sandbox, pageErrors } = await bootWithSandbox(page);
    const panel = await selectPanel(page, "tower", "panel-tower");
    await panel.getByTestId("table-edit-main-animates").click();
    await page.getByTestId("select-material-preview-jianji").click();
    const canvas = page.getByTestId("animation-preview-canvas");
    await expect(canvas).toBeVisible();
    const checksum = () => canvas.evaluate((element) => {
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
