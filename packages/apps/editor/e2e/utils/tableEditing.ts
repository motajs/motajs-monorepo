import { expect, type Locator, type Page } from "@playwright/test";

export async function selectPanel(page: Page, mode: string, testId: string): Promise<Locator> {
  await page.getByTestId("edit-mode-select").selectOption(mode);
  const panel = page.getByTestId(testId);
  await expect(panel).toBeVisible();
  return panel;
}

export async function selectFloor(page: Page, floorId: string): Promise<void> {
  const floorSelect = page.getByTestId("floor-select");
  await expect(floorSelect).toBeVisible();
  await floorSelect.selectOption(floorId);
}

export async function clickMapCell(page: Page, x: number, y: number): Promise<void> {
  const canvas = page.getByTestId("map-canvas-input");
  await expect(canvas).toBeVisible();
  await canvas.click({ position: { x: x * 32 + 16, y: y * 32 + 16 } });
}

export async function rightClickMapCell(page: Page, x: number, y: number): Promise<void> {
  const canvas = page.getByTestId("map-canvas-input");
  await expect(canvas).toBeVisible();
  await canvas.click({ button: "right", position: { x: x * 32 + 16, y: y * 32 + 16 } });
}

export async function doubleClickMapCell(page: Page, x: number, y: number): Promise<void> {
  const canvas = page.getByTestId("map-canvas-input");
  await expect(canvas).toBeVisible();
  await canvas.dblclick({ position: { x: x * 32 + 16, y: y * 32 + 16 } });
}

export async function clickMaterialCell(page: Page, materialId: string, x: number, y: number): Promise<void> {
  const image = page.getByTestId(`material-image-${materialId}`);
  await expect(image).toBeVisible();
  await image.click({ position: { x: x * 32 + 16, y: y * 32 + 16 } });
}

export async function editTextareaByField(
  panel: Locator,
  dataField: string,
  value: unknown,
): Promise<void> {
  const textarea = panel.getByTestId(`table-input-${dataField}`).locator("textarea");
  await expect(textarea).toBeVisible();
  await textarea.fill(JSON.stringify(value));
  await textarea.evaluate((element) => {
    (element as HTMLTextAreaElement).blur();
  });
}

export async function editTextareaContaining(
  panel: Locator,
  substring: string,
  value: unknown,
): Promise<void> {
  const index = await findTextareaIndex(panel, substring);
  const textarea = panel.getByTestId("data-table").locator("textarea").nth(index);
  await textarea.fill(JSON.stringify(value));
  await textarea.evaluate((element) => {
    (element as HTMLTextAreaElement).blur();
  });
}

export async function expectTextareaByFieldValue(
  panel: Locator,
  dataField: string,
  value: unknown,
): Promise<void> {
  const textarea = panel.getByTestId(`table-input-${dataField}`).locator("textarea");
  await expect(textarea).toHaveValue(JSON.stringify(value));
}

export async function expectTextareaContaining(panel: Locator, substring: string): Promise<void> {
  await expect.poll(() => findTextareaIndexOrMissing(panel, substring)).not.toBe(-1);
}

async function findTextareaIndex(panel: Locator, substring: string): Promise<number> {
  await expect.poll(() => findTextareaIndexOrMissing(panel, substring)).not.toBe(-1);
  return findTextareaIndexOrMissing(panel, substring);
}

async function findTextareaIndexOrMissing(panel: Locator, substring: string): Promise<number> {
  return panel.getByTestId("data-table").locator("textarea").evaluateAll((elements, expected) => {
    return elements.findIndex((element) =>
      (element as HTMLTextAreaElement).value.includes(expected as string)
    );
  }, substring);
}
