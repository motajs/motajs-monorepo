import { expect, test, type Page } from "@playwright/test";
import { ProjectSandbox } from "./utils/projectSandbox";
import { clickMaterialCell } from "./utils/tableEditing";

async function countPaintPreviewPixels(page: Page): Promise<number> {
  return page.getByTestId("map-canvas-input").evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const context = canvas.getContext("2d");
    if (!context) return 0;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] !== 0) count += 1;
    }
    return count;
  });
}

test("selecting a material does not reuse a previous map click as a paint gesture", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await ProjectSandbox.create(page);
  await page.goto("/");

  const canvas = page.getByTestId("map-canvas-input");
  await expect(canvas).toBeVisible();
  await canvas.click({ position: { x: 32 + 16, y: 32 + 16 } });
  await clickMaterialCell(page, "terrains", 0, 1);

  const canvasBox = await canvas.boundingBox();
  expect(canvasBox).not.toBeNull();
  await page.mouse.move(canvasBox!.x + 5 * 32 + 16, canvasBox!.y + 5 * 32 + 16);

  await expect.poll(() => countPaintPreviewPixels(page)).toBe(0);
  expect(pageErrors).toEqual([]);
});

test("material palette preserves full sheets and folds rows with fixed controls", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const sandbox = await ProjectSandbox.create(page);
  const config = JSON.parse(sandbox.readText("_server/config.json"));
  sandbox.writeText("_server/config.json", JSON.stringify({ ...config, folded: false, foldPerCol: 50 }));
  await page.goto("/");

  const surface = page.getByTestId("map-editor-surface");
  const terrains = page.getByTestId("material-image-terrains");
  await expect(terrains).toHaveAttribute("width", "32");
  await expect(terrains).toHaveAttribute("height", "1184");
  await clickMaterialCell(page, "terrains", 0, 1);
  await expect(surface).toHaveAttribute("data-selected-idnum", "17");
  await expect(page.getByTestId("material-selection-airwall")).toHaveCSS("top", "32px");

  const enemies = page.getByTestId("material-image-enemys");
  await expect(enemies).toBeVisible();
  await expect(enemies).toHaveJSProperty("tagName", "IMG");
  await expect.poll(() =>
    enemies.evaluate((element) => ({
      natural: (element as HTMLImageElement).naturalWidth,
      rendered: element.getBoundingClientRect().width,
    }))
  ).toEqual({ natural: 64, rendered: 64 });

  const scrollArea = page.getByTestId("material-scroll-area");
  await expect.poll(() => scrollArea.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  await scrollArea.evaluate((element) => element.scrollTo({ left: 200 }));
  await expect.poll(() => scrollArea.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);

  await clickMaterialCell(page, "enemys", 1, 0);
  const selectedFromSecondFrame = await surface.getAttribute("data-selected-idnum");
  expect(selectedFromSecondFrame).not.toBeNull();
  await expect(page.getByTestId("material-selection-enemys")).toHaveCSS("left", "0px");
  await clickMaterialCell(page, "enemys", 0, 0);
  await expect(surface).toHaveAttribute("data-selected-idnum", selectedFromSecondFrame!);

  const tileset = page.getByTestId("material-image-tileset:magictower.png");
  await tileset.scrollIntoViewIfNeeded();
  const tilesetBox = await tileset.boundingBox();
  expect(tilesetBox).not.toBeNull();
  await page.mouse.move(tilesetBox!.x + 48, tilesetBox!.y + 48);
  await page.mouse.down();
  await page.mouse.move(tilesetBox!.x + 80, tilesetBox!.y + 80, { steps: 4 });
  const regionPreview = page.getByTestId("material-region-preview-tileset:magictower.png");
  await expect(regionPreview).toBeVisible();
  await expect.poll(() =>
    regionPreview.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { width: rect.width, height: rect.height, animation: getComputedStyle(element).animationName };
    })
  ).toEqual({ width: 64, height: 64, animation: "material-region-marquee" });
  await page.mouse.up();
  await expect(regionPreview).toHaveCount(0);
  const tilesetSelection = page.getByTestId("material-selection-tileset:magictower.png");
  await expect.poll(() =>
    tilesetSelection.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    })
  ).toEqual({ width: 58, height: 58 });

  const toggle = page.getByTestId("material-layout-toggle");
  const toggleBox = await toggle.boundingBox();
  expect(toggleBox).not.toBeNull();
  const foldWrite = sandbox.waitForWrite("_server/config.json");
  await toggle.click();
  await foldWrite;
  await expect(enemies).toHaveJSProperty("tagName", "CANVAS");
  await expect(enemies).toHaveAttribute("width", "64");
  await expect(enemies).toHaveAttribute("height", "1600");
  await expect(page.getByTestId("material-image-autotile:autotile1.png")).toHaveAttribute("width", "32");
  await expect(page.getByTestId("material-image-autotile:autotile1.png")).toHaveAttribute("height", "32");
  await expect(page.getByTestId("material-image-tileset:magictower.png")).toHaveJSProperty("tagName", "IMG");

  await scrollArea.evaluate((element) => element.scrollTo(600, 600));
  const scrolledToggleBox = await toggle.boundingBox();
  expect(scrolledToggleBox).toEqual(toggleBox);

  await page.getByTestId("material-layout-settings").click();
  const rows = page.getByTestId("material-fold-rows");
  await expect(rows).toHaveValue("50");
  const rowsWrite = sandbox.waitForWrite("_server/config.json");
  await rows.fill("10");
  await rows.press("Enter");
  await rowsWrite;
  await expect(enemies).toHaveAttribute("width", "256");
  await expect(enemies).toHaveAttribute("height", "320");
  await expect(terrains).toHaveAttribute("width", "128");
  await expect(terrains).toHaveAttribute("height", "320");

  await clickMaterialCell(page, "enemys", 1, 0);
  const foldedRowTen = await surface.getAttribute("data-selected-idnum");
  const unfoldWrite = sandbox.waitForWrite("_server/config.json");
  await toggle.click();
  await unfoldWrite;
  await clickMaterialCell(page, "enemys", 1, 10);
  await expect(surface).toHaveAttribute("data-selected-idnum", foldedRowTen!);

  await page.reload();
  await expect(page.getByTestId("material-image-enemys")).toHaveJSProperty("tagName", "IMG");
  await page.getByTestId("material-layout-settings").click();
  await expect(page.getByTestId("material-fold-rows")).toHaveValue("10");
  expect(pageErrors).toEqual([]);
});
