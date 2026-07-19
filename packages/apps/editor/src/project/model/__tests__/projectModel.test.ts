import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

import { FileHandlerManager } from "@/fs/FileHandlerManager";
import { persistenceMonitor } from "@/fs/PersistenceMonitor";
import { projectData } from "@/project/data/projectData";
import { projectAssets } from "@/project/assets";
import { projectModel } from "@/project/model/projectModel";
import { migrateLegacyAirwall } from "@/project/migrations";
import { fs as browserFs } from "@/services/fs";
import { loadSampleProject, type SampleProjectContext } from "@test/utils/sampleProject";

describe("ProjectModel computed resources", () => {
  it("recognizes built-in status bar icon ids without a runtime", () => {
    expect(projectModel.hasStatusBarIcon("hp")).toBe(true);
    expect(projectModel.hasStatusBarIcon("btn8")).toBe(true);
    expect(projectModel.hasStatusBarIcon("name")).toBe(false);
    expect(projectModel.hasStatusBarIcon("customEnemy")).toBe(false);
  });

  let project: SampleProjectContext;
  let assetSpies: MockInstance[];

  beforeEach(async () => {
    project = await loadSampleProject();
    projectAssets.reset();
    assetSpies = [
      vi.spyOn(browserFs.promises, "readFileBinary").mockImplementation(project.fs.readFileBinary.bind(project.fs)),
      vi.spyOn(browserFs.promises, "writeFile").mockImplementation(project.fs.writeFile.bind(project.fs)),
      vi.spyOn(browserFs.promises, "readdir").mockImplementation(project.fs.readdir.bind(project.fs)),
      vi.spyOn(browserFs.promises, "deleteFile").mockImplementation(project.fs.deleteFile.bind(project.fs)),
    ];
  });

  afterEach(() => {
    FileHandlerManager.clear();
    projectData.resetForTests();
    projectAssets.reset();
    for (const spy of assetSpies) spy.mockRestore();
  });

  it("updates blockRegistry when map block data changes", async () => {
    const registry = projectModel.blockRegistry();
    await registry.reload();
    await registry.waitForSettled();

    expect(registry.value().get(21)?.id).toBe("yellowKey");
    expect(registry.value().get(21)?.name).toBe("黄钥匙");
    expect(registry.value().get(21)).toMatchObject({
      images: "items",
      y: 0,
      materialPath: "project/materials/items.png",
    });

    await projectData.mapBlocks().patch([
      ["change", "['21']['name']", "模型层黄钥匙"],
    ]);

    expect(registry.value().get(21)?.name).toBe("模型层黄钥匙");
    await persistenceMonitor.whenQuiescent([projectData.mapBlocks().path]);
    expect(project.readText("project/maps.js")).toContain("模型层黄钥匙");
  });

  it("uses editorDisplay metadata instead of requiring an icon-sheet row", async () => {
    await projectData.mapBlocks().reload();
    await projectData.mapBlocks().patch([
      ["add", "['17']", {
        cls: "terrains",
        id: "airwall",
        noPass: true,
        editorDisplay: { type: "image", path: "project/materials/airwall.png" },
      }],
    ]);

    const registry = projectModel.blockRegistry();
    await registry.reload();
    await registry.waitForSettled();
    expect(registry.value().get(17)).toMatchObject({
      id: "airwall",
      materialPath: "project/materials/airwall.png",
      x: 0,
      y: 0,
      width: 32,
      height: 32,
    });
  });

  it("persists the airwall registration when a floor still uses idnum 17", async () => {
    const tower = await project.loadResource(projectData.tower());
    const floorId = tower.main.floorIds[0];
    const floor = projectData.floor(floorId);
    await project.loadResource(floor);
    await project.loadResource(projectData.mapBlocks());
    await floor.mutate((draft) => {
      draft.map![0][0] = 17;
    });
    expect(floor.value().map?.[0]?.[0]).toBe(17);

    await expect(migrateLegacyAirwall()).resolves.toEqual({ status: "migrated" });
    expect(projectData.mapBlocks().value()["17"]).toMatchObject({
      cls: "terrains",
      id: "airwall",
      noPass: true,
      editorDisplay: { type: "image", path: "project/materials/airwall.png" },
    });
    expect(project.readText("project/maps.js")).toContain('"editorDisplay"');
    await expect(migrateLegacyAirwall()).resolves.toEqual({ status: "already-current" });
  });

  it("materialRegistry uses the same computed projection as blockRegistry", async () => {
    const registry = projectModel.materialRegistry();
    await registry.reload();
    await registry.waitForSettled();

    expect(registry.value().get(201)?.id).toBe("greenSlime");

    await projectData.mapBlocks().patch([
      ["change", "['201']['name']", "模型层绿头怪"],
    ]);

    expect(registry.value().get(201)?.name).toBe("模型层绿头怪");
  });

  it("builds spriteRegistry from icons.js for render-only materials", async () => {
    const registry = projectModel.spriteRegistry();
    await registry.reload();
    await registry.waitForSettled();

    expect(registry.value().get("terrains:ground")).toMatchObject({
      path: "project/materials/terrains.png",
      y: 0,
      width: 32,
      height: 32,
    });
    expect(registry.value().get("items:yellowKey")).toMatchObject({
      path: "project/materials/items.png",
      y: 0,
    });
    expect(registry.value().get("enemy48:angel")).toMatchObject({
      path: "project/materials/enemy48.png",
      height: 48,
    });
  });

  it("builds a physical material catalog and reports duplicate and missing row registrations", async () => {
    const catalog = projectModel.materialCatalog();
    await catalog.reload();
    await catalog.waitForSettled();

    const yellowKey = catalog.value().byImages.get("items")?.[0];
    expect(yellowKey).toMatchObject({
      slot: { kind: "sheet-row", row: 0 },
      id: "yellowKey",
      idnum: 21,
      registered: true,
    });
    expect(catalog.value().byImages.get("autotile")?.some((entry) => entry.id === "autotile3")).toBe(true);

    await projectData.icons().patch([
      ["add", "['items']['yellowKeyAlias']", 0],
      ["add", "['items']['missingMaterialRow']", 999],
    ]);

    expect(catalog.value().diagnostics.some((diagnostic) => diagnostic.message.includes("multiple icon aliases"))).toBe(true);
    expect(catalog.value().diagnostics.some((diagnostic) => diagnostic.message.includes("missingMaterialRow")
      && diagnostic.message.includes("missing material asset"))).toBe(true);
  });
});
