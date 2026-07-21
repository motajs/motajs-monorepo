import { expect, test } from "@playwright/test";
import { ProjectSandbox } from "./utils/projectSandbox";
import { expectScriptSource, setScriptSource } from "./utils/tableEditing";

test("opening the new editor never rewrites legacy comment or function sources", async ({ page }) => {
  const sandbox = await ProjectSandbox.create(page);
  const commentBefore = sandbox.readText("_server/table/comment.js");
  const functionsBefore = sandbox.readText("project/functions.js");

  await page.goto("/");
  await expect(page.getByTestId("app-topbar")).toBeVisible();
  await page.getByTestId("workspace-scripts").click();
  await expect(page.getByTestId("scripts-workspace")).toBeVisible();
  await page.getByTestId("workspace-map").click();
  await page.getByTestId("map-panel-tab-enemyitem").click();
  await expect(page.getByTestId("panel-slot-enemyitem")).toBeVisible();

  expect(sandbox.writeCount("_server/table/comment.js")).toBe(0);
  expect(sandbox.writeCount("project/functions.js")).toBe(0);
  expect(sandbox.readText("_server/table/comment.js")).toBe(commentBefore);
  expect(sandbox.readText("project/functions.js")).toBe(functionsBefore);
});

test("map panel shortcuts stay scoped to the map workspace", async ({ page }) => {
  await page.goto("/");

  await page.getByTestId("workspace-scripts").click();
  await expect(page.getByTestId("scripts-workspace")).toBeVisible();
  await page.keyboard.press("v");
  await expect(page.getByTestId("scripts-workspace")).toBeVisible();
  await expect(page.getByTestId("workspace-scripts")).toHaveClass(/is-active/);

  await page.getByTestId("workspace-map").click();
  await page.keyboard.press("v");
  await expect(page.getByTestId("map-panel-tab-floor")).toHaveAttribute("aria-selected", "true");
});

test("only SchemaTable exposes project table customization", async ({ page }) => {
  test.setTimeout(60_000);
  const sandbox = await ProjectSandbox.create(page);
  await page.goto("/");

  await expect(page.getByTestId("app-topbar").getByRole("button", { name: "自定义表格" }))
    .toHaveCount(0);
  await page.getByTestId("workspace-tower").click();
  const tower = page.getByTestId("panel-tower");

  await tower.getByRole("button", { name: "自定义表格" }).click();
  await tower.getByRole("button", { name: "完整 Table 源码", exact: true }).click();
  await expect.poll(() => page.getByTestId("code-editor-content").evaluate((element) => {
    const host = element as HTMLElement & { __motajsMonacoEditor: { getValue(): string } };
    return host.__motajsMonacoEditor.getValue();
  })).toContain('"schemaId": "tower-properties"');
  await page.getByTestId("code-editor-content").evaluate((element) => {
    const host = element as HTMLElement & { __motajsMonacoEditor: { getValue(): string; setValue(value: string): void } };
    const schema = JSON.parse(host.__motajsMonacoEditor.getValue()) as { nodes: Array<{ label?: string }> };
    schema.nodes[0]!.label = "工程信息（自定义）";
    host.__motajsMonacoEditor.setValue(JSON.stringify(schema, null, 2));
  });
  const schemaWrite = sandbox.waitForWrite(".metaphysics/schemas/ui/tower-properties.json");
  await page.getByTestId("code-editor-confirm").click();
  await schemaWrite;
  const override = JSON.parse(sandbox.readText(".metaphysics/schemas/ui/tower-properties.json")) as {
    schemaId: string;
    forkedFrom: { revision: number; digest: string };
  };
  expect(override).toMatchObject({
    schemaId: "tower-properties",
    forkedFrom: { revision: 1 },
  });
  expect(override.forkedFrom.digest).toMatch(/^sha256:[a-f0-9]{64}$/);

  await tower.locator(".ant-segmented-item", { hasText: "旧版" }).click();
  await expect(tower.getByRole("button", { name: "自定义表格" })).toHaveCount(0);
});

test("top bar workspaces, schema tower, drafts, scripts and theme stay coherent", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const sandbox = await ProjectSandbox.create(page);
  await page.goto("/");

  await expect(page.getByTestId("app-topbar")).toBeVisible();
  await expect(page.locator(".appProjectTitle")).not.toHaveText("工作区");
  await expect(page.locator(".mapWorkspace")).toBeVisible();

  await page.getByTestId("workspace-tower").click();
  const tower = page.getByTestId("panel-tower");
  await expect(tower).toBeVisible();
  await expect(tower.locator(".schemaTable")).toHaveAttribute("data-columns", "2");
  await expect(tower.locator(".towerAnchor")).toBeVisible();

  const title = tower.getByTestId("schema-input-firstData-title").locator("input");
  const titleWrite = sandbox.waitForWrite("project/data.js");
  await title.fill("Workspace Schema Title");
  await title.blur();
  await titleWrite;
  expect(sandbox.readText("project/data.js")).toContain("Workspace Schema Title");

  await page.getByTestId("workspace-resources").click();
  await expect(page.getByTestId("resources-workspace")).toBeVisible();
  await expect(page.locator(".resourceCard")).not.toHaveCount(0);
  await expect(page.locator("button button")).toHaveCount(0);
  await expect(page.locator(".resourceRegister .ant-switch")).toHaveCount(0);
  await expect(page.locator(".resourceRegister .ant-checkbox")).not.toHaveCount(0);
  const dragon = page.getByTestId("resource-images-dragon.png");
  const splitFolder = dragon.locator("xpath=following-sibling::*[1]");
  await expect(splitFolder).toHaveClass(/resourceSplitFolder/);
  await expect(splitFolder.locator("canvas")).toBeVisible();
  await splitFolder.click();
  await expect(page.getByTestId("resource-images-dragon_0.png")).toBeVisible();

  await page.locator(".resourceCard").first().click();
  const selectedResourceName = await page.locator(".resourceDetail h2").textContent();
  await page.getByTestId("resources-nav-bgms").click();
  await expect(page.locator(".resourceDetail h2")).toHaveText(selectedResourceName ?? "");
  await expect(page.locator(".resourceMissingNotice")).toHaveCount(0);
  await page.getByTestId("resources-nav-autotiles").click();
  const registeredAutotile = page.getByTestId("resource-autotiles-autotile.png");
  await expect(registeredAutotile).toBeVisible();
  await expect(registeredAutotile.locator(".ant-checkbox-input")).toBeChecked();
  await expect(page.getByTestId("resource-autotiles-autotile")).toHaveCount(0);

  await page.getByTestId("workspace-common-events").click();
  await expect(page.getByTestId("common-events-workspace")).toBeVisible();
  await expect(page.locator(".commonEventItem")).not.toHaveCount(0);
  await expect(page.locator(".commonEventItem i[title=\"未保存\"]")).toHaveCount(0);
  await expect(page.locator("#common-event-editor-host").getByTestId("event-editor")).toBeVisible();

  await page.getByTestId("workspace-scripts").click();
  const scripts = page.getByTestId("scripts-workspace");
  await expect(scripts).toBeVisible();
  await scripts.locator(".scriptTreeLeaf").first().click();
  await expect(scripts.locator(".scriptTab")).toHaveCount(1);
  await expect(scripts.getByTestId("script-monaco-editor")).toBeVisible();
  await scripts.locator(".scriptTreeLeaf").nth(1).click();
  await expect(scripts.locator(".scriptTab")).toHaveCount(2);
  const scriptEditor = scripts.getByTestId("script-code-editor");
  await expect(scriptEditor).toBeVisible();
  const originalScript = await scriptEditor.evaluate((element) => {
    const host = element as HTMLElement & { __motajsMonacoEditor: { getValue(): string } };
    return host.__motajsMonacoEditor.getValue();
  });
  await scriptEditor.evaluate((element) => {
    const host = element as HTMLElement & { __motajsMonacoEditor: { getValue(): string; setValue(value: string): void } };
    host.__motajsMonacoEditor.setValue(`${host.__motajsMonacoEditor.getValue()}\n// activity-preserved-draft`);
  });
  await expect(scripts.locator(".scriptTab.is-active i")).toBeVisible();

  await page.getByTestId("workspace-tower").click();
  await expect(tower).toBeVisible();
  await page.getByTestId("workspace-scripts").click();
  await expect(scripts.locator(".scriptTab")).toHaveCount(2);
  await expect(scriptEditor).toBeVisible();
  await expect.poll(() => scriptEditor.evaluate((element) => {
    const host = element as HTMLElement & { __motajsMonacoEditor: { getValue(): string } };
    return host.__motajsMonacoEditor.getValue();
  })).toContain("activity-preserved-draft");
  await scriptEditor.evaluate((element, value) => {
    const host = element as HTMLElement & { __motajsMonacoEditor: { setValue(source: string): void } };
    host.__motajsMonacoEditor.setValue(value);
  }, originalScript);
  await expect(scripts.locator(".scriptTab.is-active i")).toHaveCount(0);

  const themeBefore = await page.locator("html").getAttribute("data-editor-theme");
  await page.getByTestId("theme-toggle").click();
  await expect(page.locator("html")).not.toHaveAttribute("data-editor-theme", themeBefore ?? "light");
  const changedTheme = await page.locator("html").getAttribute("data-editor-theme");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-editor-theme", changedTheme ?? "dark");
  expect(pageErrors).toEqual([]);
});

test("switching public events atomically replaces the Blockly workspace", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await ProjectSandbox.create(page);
  await page.goto("/");
  await page.getByTestId("workspace-common-events").click();

  const source = page.getByTestId("event-editor-source");
  const blockCanvas = page.locator("#common-event-editor-host .blocklyBlockCanvas").first();
  const addPointEvent = page.locator(".commonEventSelect").filter({ hasText: "加点事件" });
  const keyShopEvent = page.locator(".commonEventSelect").filter({ hasText: "回收钥匙商店" });

  // 首次进入工作区时，默认事件应直接完成可视导入，不需要再点一次。
  await expect(source).toHaveValue(/通过传参/);
  await expect.poll(() => blockCanvas.evaluate((element) => element.childElementCount)).toBeGreaterThan(0);

  for (let index = 0; index < 3; index += 1) {
    await keyShopEvent.click();
    await expect(source).toHaveValue(/黄钥匙/);
    await expect.poll(() => blockCanvas.evaluate((element) => element.childElementCount)).toBeGreaterThan(0);
    await expect(keyShopEvent.locator("i")).toHaveCount(0);

    // Loading another public event is a document replacement, not a Blockly
    // user edit. Undo must never bring blocks from the previous event across.
    await page.keyboard.press("Control+z");
    await expect(source).toHaveValue(/黄钥匙/);
    await expect(source).not.toHaveValue(/通过传参/);
    await expect(keyShopEvent.locator("i")).toHaveCount(0);

    await addPointEvent.click();
    await expect(source).toHaveValue(/通过传参/);
    await expect.poll(() => blockCanvas.evaluate((element) => element.childElementCount)).toBeGreaterThan(0);
  }
  expect(pageErrors).toEqual([]);
});

test("public events follow the dark editor theme without recreating Blockly", async ({ page }) => {
  await ProjectSandbox.create(page);
  await page.goto("/");
  await page.getByTestId("workspace-common-events").click();

  const source = page.getByTestId("event-editor-source");
  const blockCanvas = page.locator("#common-event-editor-host .blocklyBlockCanvas").first();
  await expect(source).toHaveValue(/通过传参/);
  await expect.poll(() => blockCanvas.evaluate((element) => element.childElementCount)).toBeGreaterThan(0);

  const sourceBeforeThemeChange = await source.inputValue();
  const blockCountBeforeThemeChange = await blockCanvas.evaluate((element) => element.childElementCount);
  if (await page.locator("html").getAttribute("data-editor-theme") !== "dark") {
    await page.getByTestId("theme-toggle").click();
  }

  await expect(page.locator("html")).toHaveAttribute("data-editor-theme", "dark");
  await expect(page.locator("#common-event-editor-host .blocklyToolbox")).toHaveCSS(
    "background-color",
    "rgb(41, 42, 47)",
  );
  await expect(page.locator("#common-event-editor-host .blocklyToolboxCategoryLabel").first()).toHaveCSS(
    "color",
    "rgb(215, 217, 223)",
  );
  const inactiveFieldText = page.locator([
    "#common-event-editor-host .blocklyEditableField:not(.blocklyEditing) > text",
    "#common-event-editor-host .blocklyNonEditableField > text",
  ].join(", ")).first();
  await expect(inactiveFieldText).toBeVisible();
  await expect(inactiveFieldText).toHaveCSS("fill", "rgb(240, 241, 244)");
  await expect(source).toHaveCSS("background-color", "rgb(48, 48, 53)");
  await expect(source).toHaveCSS("color", "rgb(212, 212, 212)");
  await expect(source).toHaveValue(sourceBeforeThemeChange);
  await expect.poll(() => blockCanvas.evaluate((element) => element.childElementCount))
    .toBe(blockCountBeforeThemeChange);
});

test("missing tower data stays inside the map panel without a derived-resource error", async ({ page }) => {
  const sandbox = await ProjectSandbox.create(page);
  sandbox.removeFile("project/data.js");
  await page.goto("/");

  const recovery = page.getByTestId("panel-slot-map").locator(".leftTabError");
  await expect(recovery).toBeVisible();
  await expect(recovery).toContainText("文件不存在: project/data.js");
  await expect(recovery).toHaveCSS("position", "absolute");
  await expect(recovery).toHaveCSS("width", "435px");
  await expect(page.getByRole("tablist", { name: "地图编辑面板" })).toBeVisible();
  await expect(page.getByTestId("map-editor-error")).toHaveCount(0);
  await expect(page.getByText("tilesetCatalog not found")).toHaveCount(0);
});

test("a registered floor with a missing file can be rebuilt from the floor list", async ({ page }) => {
  const sandbox = await ProjectSandbox.create(page);
  sandbox.removeFile("project/floors/sample0.js");
  await page.goto("/");

  const row = page.getByTestId("floor-management-row-sample0");
  await expect(row).toHaveClass(/is-missing/);
  await row.getByRole("button", { name: "sample0 更多操作" }).click();
  await page.getByTestId("map-rebuild-sample0").click();

  const floorWrite = sandbox.waitForWrite("project/floors/sample0.js");
  await page.getByRole("button", { name: "重建空白楼层", exact: true }).click();
  await floorWrite;
  await expect(row).not.toHaveClass(/is-missing/);
  expect(sandbox.hasFile("project/floors/sample0.js")).toBe(true);
  expect(sandbox.readText("project/floors/sample0.js")).toContain("\"width\": 13");
  await expect(page.getByTestId("map-editor-error")).toHaveCount(0);
});

test("dedicated common-event and script workspaces save through guarded commands", async ({ page }) => {
  test.setTimeout(60_000);
  const sandbox = await ProjectSandbox.create(page);
  await page.goto("/");

  await page.getByTestId("workspace-common-events").click();
  const eventSource = page.getByTestId("event-editor-source");
  await expect(eventSource).toBeVisible();
  await expect(page.getByTestId("event-editor-save")).toBeVisible();
  await expect(page.getByTestId("event-editor-confirm")).toHaveCount(0);
  await expect(page.getByTestId("event-editor-cancel")).toHaveCount(0);
  await eventSource.fill(JSON.stringify([{ type: "comment", text: "Workspace common event write" }]));
  await page.getByTestId("event-editor-parse").click();
  const eventWrite = sandbox.waitForWrite("project/events.js");
  await page.getByTestId("event-editor-save").click();
  await eventWrite;
  expect(sandbox.readText("project/events.js")).toContain("Workspace common event write");

  await page.getByTestId("workspace-scripts").click();
  const scripts = page.getByTestId("scripts-workspace");
  await scripts.locator(".scriptTreeLeaf").filter({ hasText: "resetGame" }).click();
  const scriptSurface = scripts.getByTestId("script-code-editor");
  const monacoEditor = scripts.locator(".monaco-editor");
  await expect(scriptSurface).toBeVisible();
  await expect(scripts.getByTestId("script-code-editor")).toHaveAttribute("data-language-status", /ready|degraded/);

  // The Activity-preserved Blockly workspace still has its global toolbox
  // shortcuts mounted. They must not consume digit input from Monaco.
  const sourceBeforeDigitInput = await scriptSurface.evaluate((element) => {
    const host = element as HTMLElement & { __motajsMonacoEditor: { getValue(): string } };
    return host.__motajsMonacoEditor.getValue();
  });
  await scriptSurface.evaluate((element) => {
    const host = element as HTMLElement & {
      __motajsMonacoEditor: {
        focus(): void;
        setPosition(position: { lineNumber: number; column: number }): void;
      };
    };
    host.__motajsMonacoEditor.setPosition({ lineNumber: 1, column: 1 });
    host.__motajsMonacoEditor.focus();
  });
  await page.keyboard.type("123456789");
  await expectScriptSource(scripts, `123456789${sourceBeforeDigitInput}`);
  await setScriptSource(scripts, sourceBeforeDigitInput);

  // Each tab is a stable Monaco model. Switching tabs preserves both content
  // and view state while the TypeScript worker keeps semantic information.
  await scripts.locator(".scriptTreeLeaf").filter({ hasText: "flyTo" }).click();
  await expectScriptSource(scripts, "function flyTo");
  await expect(monacoEditor.locator(".monaco-type-function").filter({ hasText: "flyTo" }).first()).toBeVisible();
  await expect(monacoEditor.locator(".monaco-type-function").filter({ hasText: "callback" }).first()).toBeVisible();
  await scripts.locator(".scriptTab").filter({ hasText: "resetGame" }).click();
  const before = Array.from({ length: 12 }, (_, index) => `\t// before ${index + 1}`).join("\n");
  await setScriptSource(scripts, `function () {\n${before}\n\tconst broken = ;\n\treturn broken;\n}`);
  const syntaxMarker = monacoEditor.locator(".squiggly-error").first();
  await expect(syntaxMarker).toBeVisible();
  await scriptSurface.evaluate(async (element) => {
    const host = element as HTMLElement & {
      __motajsMonacoEditor: {
        getAction(id: string): { run(): Promise<void> } | null;
        setPosition(position: { lineNumber: number; column: number }): void;
      };
    };
    host.__motajsMonacoEditor.setPosition({ lineNumber: 14, column: 18 });
    await host.__motajsMonacoEditor.getAction("editor.action.showHover")?.run();
  });
  await expect(page.locator(".monaco-hover")).toBeVisible();
  await expect(scripts.getByTestId("script-validate")).toHaveAttribute("data-validation", "invalid");
  await expect(scripts.getByTestId("script-validate")).toContainText(/错误 [1-9]\d* 警告 \d+/);
  await scripts.getByTestId("script-validate").click();
  const validationPopover = page.getByTestId("script-validation-popover");
  await expect(validationPopover).toContainText(/错误 [1-9]\d*，警告 \d+/);
  await validationPopover.getByTestId("script-validation-diagnostic").first().click();
  await scripts.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("脚本无法保存");
  await page.getByRole("button", { name: "返回修改" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  expect(sandbox.readText("project/functions.js")).not.toContain("const broken = ;");

  await setScriptSource(scripts, "function(){const value=1;return value;}");
  await scripts.getByTestId("script-format").click();
  await expectScriptSource(scripts, "\n\treturn value;");
  await expect(scripts.getByTestId("script-validate")).toHaveAttribute("data-validation", "valid");
  await expect(scripts.getByTestId("script-validate")).toContainText("错误 0 警告 0");

  // Monaco suggestions filter in place; typing one letter never commits the
  // selected suggestion until the user explicitly accepts it.
  await setScriptSource(scripts, "function () { co }");
  await scriptSurface.evaluate((element) => {
    const host = element as HTMLElement & {
      __motajsMonacoEditor: { focus(): void; setPosition(position: { lineNumber: number; column: number }): void };
    };
    host.__motajsMonacoEditor.setPosition({ lineNumber: 1, column: 17 });
    host.__motajsMonacoEditor.focus();
  });
  await page.keyboard.press("Control+Space");
  await expect(page.locator(".suggest-widget.visible")).toBeVisible();
  await page.keyboard.type("r");
  await expectScriptSource(scripts, "function () { cor }");
  await page.keyboard.press("Escape");

  await setScriptSource(scripts, "function resetGame () { return '__workspaceFunctionWrite'; }");
  const functionWrite = sandbox.waitForWrite("project/functions.js");
  await scripts.getByRole("button", { name: "保存", exact: true }).click();
  await functionWrite;
  expect(sandbox.readText("project/functions.js")).toContain("__workspaceFunctionWrite");
});

test("Blockly builtin text fields retain contextual autocomplete", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await ProjectSandbox.create(page);
  await page.goto("/");
  await page.getByTestId("workspace-common-events").click();

  const source = page.getByTestId("event-editor-source");
  await source.fill(JSON.stringify([{ type: "useItem", id: "yellowKey" }]));
  await page.getByTestId("event-editor-parse").click();
  const itemField = page.locator("#common-event-editor-host").getByText("yellowKey", { exact: true });
  await expect(itemField).toBeVisible();
  await itemField.dblclick();

  const input = page.locator(".blocklyWidgetDiv .blocklyHtmlInput");
  await expect(input).toBeVisible();
  await input.fill("red");
  const completions = page.locator(".blocklyWidgetDiv .blocklyAutocomplete > ul");
  await expect(completions).toBeVisible();
  await expect.poll(() => completions.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThanOrEqual(260);
  const redKey = completions.getByRole("option", { name: /^redKey/ });
  await expect(redKey).toBeVisible();
  await redKey.click();
  await expect(input).toHaveValue("redKey");
  await page.keyboard.press("Enter");

  await source.fill(JSON.stringify([{
    type: "choices",
    text: "请选择",
    choices: [{ text: "普通选项", icon: "yellowKey", action: [] }],
  }]));
  await page.getByTestId("event-editor-parse").click();
  const choiceText = page.locator("#common-event-editor-host").getByText("普通选项", { exact: true });
  await expect(choiceText).toBeVisible();
  await choiceText.dblclick();
  const choiceInput = page.locator(".blocklyWidgetDiv .blocklyHtmlInput");
  await expect(choiceInput).toBeVisible();
  await choiceInput.fill("普通文本");
  await expect(completions).toBeHidden();
  await choiceInput.fill("获得${item:r");
  await expect(completions).toBeVisible();
  const contextualRedKey = completions.getByRole("option", { name: /^redKey/ });
  await expect(contextualRedKey).toBeVisible();
  await contextualRedKey.click();
  await expect(choiceInput).toHaveValue("获得${item:redKey");
  expect(pageErrors).toEqual([]);
});
