import { expect, type Locator, type Page, test } from "@playwright/test";
import { ProjectSandbox } from "./utils/projectSandbox";
import { clickMapCell, doubleClickMapCell, selectFloor } from "./utils/tableEditing";

async function enterAndInspectTable(
  page: Page,
  panel: Locator,
  nodeId: string,
): Promise<void> {
  await panel.getByRole("button", { name: /^自定义表格/ }).click();
  await expect(panel.getByTestId("schema-customization-toolbar")).toBeVisible();

  await panel.locator(`[data-schema-node-id="${nodeId}"]`).click();
  const drawer = page.locator(".schemaCustomizationDrawer");
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText("表格节点", { exact: true })).toBeVisible();
  await expect(drawer.getByText("字段定义", { exact: true })).toBeVisible();
  await drawer.locator(".ant-drawer-close").click();

  await panel.getByRole("button", { name: "完成自定义" }).click();
  await expect(panel.getByTestId("schema-customization-toolbar")).toHaveCount(0);
}

async function boot(page: Page): Promise<{ sandbox: ProjectSandbox; pageErrors: string[] }> {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const sandbox = await ProjectSandbox.create(page);
  await page.goto("/");
  await expect(page.getByTestId("edit-mode-select")).toBeVisible();
  return { sandbox, pageErrors };
}

const cases: Array<{
  name: string;
  nodeId: string;
  paths: [string, string];
  setup(page: Page): Promise<Locator>;
}> = [
  {
    name: "floor",
    nodeId: "floor-floorId",
    paths: ["floor.fields", "floor-properties"],
    setup: async (page) => {
      await selectFloor(page, "sample0");
      await page.getByTestId("map-panel-tab-floor").click();
      return page.getByTestId("panel-floor");
    },
  },
  {
    name: "loc",
    nodeId: "loc-events",
    paths: ["loc.fields", "loc-properties"],
    setup: async (page) => {
      await selectFloor(page, "sample0");
      await page.getByTestId("map-panel-tab-loc").click();
      await clickMapCell(page, 0, 0);
      return page.getByTestId("panel-loc");
    },
  },
  {
    name: "map block",
    nodeId: "mapBlock-id",
    paths: ["map-block.fields", "map-block-properties"],
    setup: async (page) => {
      await selectFloor(page, "sample0");
      await doubleClickMapCell(page, 8, 12);
      await page.getByTestId("edit-mode-select").selectOption("enemyitem");
      return page.getByTestId("panel-prefab");
    },
  },
  {
    name: "item",
    nodeId: "item-id",
    paths: ["item.fields", "item-properties"],
    setup: async (page) => {
      await selectFloor(page, "sample0");
      await doubleClickMapCell(page, 8, 8);
      await page.getByTestId("edit-mode-select").selectOption("enemyitem");
      return page.getByTestId("panel-prefab");
    },
  },
  {
    name: "enemy",
    nodeId: "enemy-id",
    paths: ["enemy.fields", "enemy-properties"],
    setup: async (page) => {
      await selectFloor(page, "sample0");
      await doubleClickMapCell(page, 0, 7);
      await page.getByTestId("edit-mode-select").selectOption("enemyitem");
      return page.getByTestId("panel-prefab");
    },
  },
  {
    name: "tower",
    nodeId: "tower-title",
    paths: ["tower.fields", "tower-properties"],
    setup: async (page) => {
      await page.getByTestId("workspace-tower").click();
      return page.getByTestId("panel-tower");
    },
  },
];

for (const current of cases) test(`${current.name} exposes non-writing inline customization`, async ({ page }) => {
  const { sandbox, pageErrors } = await boot(page);
  const panel = await current.setup(page);
  await enterAndInspectTable(page, panel, current.nodeId);
  expect(sandbox.hasFile(`.metaphysics/schemas/field/${current.paths[0]}.json`)).toBe(false);
  expect(sandbox.hasFile(`.metaphysics/schemas/ui/${current.paths[1]}.json`)).toBe(false);
  expect(pageErrors).toEqual([]);
});
