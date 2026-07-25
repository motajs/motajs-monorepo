import { expect, test } from "@playwright/test";
import { ProjectSandbox } from "./utils/projectSandbox";
import { openEventEditor, selectPanel, selectScript } from "./utils/tableEditing";

test("runtime iframe renders Blockly UI through the resource gateway", async ({ page }) => {
  const pageErrors: string[] = [];
  const directProjectRequests: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    if (request.frame().url().includes("/runtime.html") && new URL(request.url()).pathname.startsWith("/project/")) {
      directProjectRequests.push(request.url());
    }
  });

  await ProjectSandbox.create(page);
  await page.goto("/");
  const runtimeHost = page.getByTestId("runtime-host");
  await expect(runtimeHost).toHaveAttribute("data-runtime-status", "ready", { timeout: 20_000 });
  const instanceId = await runtimeHost.getAttribute("data-runtime-instance-id");

  const tower = await selectPanel(page, "tower", "panel-tower");
  await openEventEditor(
    page,
    tower.getByTestId("table-input-firstData-startCanvas").locator("textarea"),
    /在这里可以用事件来自定义绘制标题界面/,
  );
  const previewBlocks = page.getByTestId("blockly-block-mota_previewUI_s");
  await expect(previewBlocks).toHaveCount(2);
  await previewBlocks.nth(0).dispatchEvent("dblclick");

  await expect(page.getByTestId("preview-ui-modal")).toBeVisible();
  await expect(page.getByTestId("runtime-ui-preview")).toBeVisible();
  const canvas = page.frameLocator('[data-test-id="runtime-iframe"]').locator("canvas#uievent");
  await expect(canvas).toBeVisible();
  await expect.poll(async () => {
    try {
      return await page.frameLocator('[data-test-id="runtime-iframe"]').locator("canvas#uievent").evaluate((element) => {
        const target = element as HTMLCanvasElement;
        const pixels = target.getContext("2d")?.getImageData(0, 0, target.width, target.height).data;
        if (!pixels) return 0;
        let nonEmpty = 0;
        for (let index = 3; index < pixels.length; index += 4) if (pixels[index] !== 0) nonEmpty += 1;
        return nonEmpty;
      });
    } catch {
      return 0;
    }
  }).toBeGreaterThan(0);

  expect(directProjectRequests).toEqual([]);
  await expect(runtimeHost).toHaveAttribute("data-runtime-instance-id", instanceId!);
  await page.getByTestId("preview-ui-modal-cancel").click();
  await expect(page.getByTestId("preview-ui-modal")).toBeHidden();
  await expect(runtimeHost).toHaveCSS("visibility", "hidden");
  await expect(canvas).toBeHidden();

  await previewBlocks.nth(1).dispatchEvent("dblclick");
  await expect(page.getByTestId("runtime-ui-preview")).toBeVisible();
  await expect(page.getByTestId("runtime-ui-preview-fallback")).toHaveCount(0);
  await page.getByTestId("preview-ui-modal-cancel").click();

  await page.getByTestId("event-editor-source").fill(JSON.stringify(["\b[this]带位置的剧情文本"]));
  await page.getByTestId("event-editor-parse").click();
  await page.getByTestId("blockly-block-mota_text_1_s").dispatchEvent("dblclick");
  await expect(page.getByTestId("runtime-ui-preview")).toBeVisible();
  await expect(page.getByTestId("runtime-ui-preview-fallback")).toHaveCount(0);
  await page.getByTestId("preview-ui-modal-cancel").click();
  expect(pageErrors).toEqual([]);
});

test("status bar preview executes only inside the runtime iframe", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await ProjectSandbox.create(page);
  await page.goto("/");
  await expect(page.getByTestId("runtime-host")).toHaveAttribute("data-runtime-status", "ready", { timeout: 20_000 });

  const scripts = await selectScript(page, "functions", "drawStatusBar");
  await scripts.getByTestId("script-preview").click();
  await expect(page.getByTestId("status-bar-preview-modal")).toBeVisible();
  await expect(page.getByTestId("runtime-status-bar-preview")).toBeVisible();
  const canvas = page.frameLocator('[data-test-id="runtime-iframe"]').locator("canvas#runtimeStatusPreview");
  await expect(canvas).toBeVisible();
  await expect.poll(() => canvas.evaluate((element) => {
    const target = element as HTMLCanvasElement;
    return target.width * target.height;
  })).toBeGreaterThan(0);
  expect(pageErrors).toEqual([]);
});

test("runtime crash falls back explicitly and manual retry restores the live surface", async ({ page }) => {
  await ProjectSandbox.create(page);
  await page.goto("/");
  const runtimeHost = page.getByTestId("runtime-host");
  await expect(runtimeHost).toHaveAttribute("data-runtime-status", "ready", { timeout: 20_000 });

  const tower = await selectPanel(page, "tower", "panel-tower");
  await openEventEditor(
    page,
    tower.getByTestId("table-input-firstData-startCanvas").locator("textarea"),
    /在这里可以用事件来自定义绘制标题界面/,
  );
  await page.getByTestId("event-editor-source").fill(JSON.stringify([{
    type: "previewUI",
    action: [{ type: "fillRect", x: 0, y: 0, width: 64, height: 64, style: [0, 255, 0, 1] }],
  }]));
  await page.getByTestId("event-editor-parse").click();
  const block = page.getByTestId("blockly-block-mota_previewUI_s");
  // Dispatch only dblclick (without the two synthetic click events) to prove
  // loaded blocks received the native interaction binding.
  await block.dispatchEvent("dblclick");
  await expect(page.getByTestId("runtime-ui-preview")).toBeVisible();
  await page.getByTestId("preview-ui-modal-cancel").click();

  const firstInstance = await runtimeHost.getAttribute("data-runtime-instance-id");
  const crash = async () => page.frameLocator('[data-test-id="runtime-iframe"]').locator("body").evaluate(() => {
    window.dispatchEvent(new ErrorEvent("error", { message: "runtime preview crash test" }));
  });
  await crash();
  await expect.poll(() => runtimeHost.getAttribute("data-runtime-instance-id"), { timeout: 20_000 })
    .not.toBe(firstInstance);
  await expect(runtimeHost).toHaveAttribute("data-runtime-status", "ready");

  await crash();
  await expect(runtimeHost).toHaveAttribute("data-runtime-status", "error");
  await block.dispatchEvent("dblclick");
  await expect(page.getByTestId("runtime-ui-preview-fallback")).toBeVisible();
  await page.getByTestId("runtime-retry").click();
  await expect(runtimeHost).toHaveAttribute("data-runtime-status", "ready", { timeout: 20_000 });
  await expect(page.getByTestId("runtime-ui-preview")).toBeVisible();
});

test("game route serves the original game shell", async ({ page }) => {
  await page.goto("/game.html");
  await expect(page).toHaveTitle(/HTML5魔塔$/);
  await expect(page.locator("#gameGroup")).toBeAttached();
});
