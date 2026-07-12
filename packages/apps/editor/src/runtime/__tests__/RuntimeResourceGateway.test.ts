import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { FileHandlerManager } from "@/fs/FileHandlerManager";
import { projectAssets } from "@/project/assets";
import { projectData } from "@/project/data/projectData";
import { fs as browserFs } from "@/services/fs";
import { loadSampleProject, type SampleProjectContext } from "@test/utils/sampleProject";
import { RuntimeResourceGateway } from "../RuntimeResourceGateway";

describe("RuntimeResourceGateway", () => {
  let project: SampleProjectContext;
  let spies: MockInstance[];
  let gateway: RuntimeResourceGateway;

  beforeEach(async () => {
    project = await loadSampleProject();
    projectAssets.reset();
    spies = [
      vi.spyOn(browserFs.promises, "readFile").mockImplementation(project.fs.readFile.bind(project.fs)),
      vi.spyOn(browserFs.promises, "readFileBinary").mockImplementation(project.fs.readFileBinary.bind(project.fs)),
      vi.spyOn(browserFs.promises, "writeFile").mockImplementation(project.fs.writeFile.bind(project.fs)),
      vi.spyOn(browserFs.promises, "readdir").mockImplementation(project.fs.readdir.bind(project.fs)),
      vi.spyOn(browserFs.promises, "deleteFile").mockImplementation(project.fs.deleteFile.bind(project.fs)),
    ];
    gateway = new RuntimeResourceGateway();
  });

  afterEach(() => {
    gateway.dispose();
    FileHandlerManager.clear();
    projectData.resetForTests();
    projectAssets.reset();
    spies.forEach((spy) => spy.mockRestore());
  });

  it("returns the latest in-memory raw source and emits a deduplicatable change", async () => {
    const changes: string[] = [];
    gateway.setChangeListener((change) => changes.push(`${change.path}:${change.state}`));
    await gateway.readText("project/data.js");

    await projectData.tower().mutate((tower) => {
      tower.firstData.title = "RUNTIME_MEMORY_TITLE";
    });
    const current = await gateway.readText("project/data.js");

    expect(current.text).toContain("RUNTIME_MEMORY_TITLE");
    expect(changes).toContain("project/data.js:loaded");
  });

  it("returns binary copies while reusing the shared asset cache", async () => {
    const readBinary = spies[1];
    const first = await gateway.readBinary("project/images/hero.png");
    const expected = first.bytes[0];
    first.bytes[0] = expected ^ 0xff;
    const second = await gateway.readBinary("project/images/hero.png");

    expect(second.bytes[0]).toBe(expected);
    expect(readBinary).toHaveBeenCalledTimes(1);
  });

  it("rejects engine paths outside the project gateway", async () => {
    await expect(gateway.readText("libs/core.js")).rejects.toThrow("denied");
  });
});
