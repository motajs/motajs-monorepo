import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { FileHandlerManager } from "@/fs/FileHandlerManager";
import { persistenceMonitor } from "@/fs/PersistenceMonitor";
import { tableCommands } from "@/project/commands/tableCommands";
import { projectData } from "@/project/data/projectData";
import type { DataResource } from "@/project/data/DataResource";
import type { Action } from "@/utils/action";
import { loadSampleProject, type SampleProjectContext } from "@test/utils/sampleProject";
import { waitFor } from "@test/utils/testHelpers";

const TOWER_PATH = "project/data.js";
const EVENTS_PATH = "project/events.js";
const FLOOR_PATH = "project/floors/sample0.js";

function failedFor(path: string) {
  return persistenceMonitor.failedFiles().filter((failure) => failure.path === path);
}

function expectNoFailureFor(path: string): void {
  expect(failedFor(path), `${path} should not remain in failedFiles`).toEqual([]);
}

async function recoverResource<T>(
  project: SampleProjectContext,
  resource: DataResource<T>,
  actions: Action[],
): Promise<void> {
  project.fs.clearWriteError();
  project.fs.clearWriteErrorForPath(resource.path);
  await resource.patch(actions);
  await resource.waitForIdle();
  expect(resource.persistStatus().status).toBe("idle");
  expectNoFailureFor(resource.path);
}

describe("ProjectData persist status integration", () => {
  let project: SampleProjectContext;

  beforeEach(async () => {
    project = await loadSampleProject();
  });

  afterEach(() => {
    project.fs.clearWriteError();
    project.fs.setWriteDelay(0);
    FileHandlerManager.clear();
    projectData.resetForTests();
  });

  it("reports persisting and then idle for a successful resource patch", async () => {
    const tower = projectData.tower();
    await project.loadResource(tower);
    project.fs.setWriteDelay(50);

    await tower.patch([
      ["change", "['firstData']['title']", "Persist Status Title"],
    ]);

    expect(tower.value().firstData.title).toBe("Persist Status Title");
    expect(tower.persistStatus().status).toBe("persisting");
    expect(persistenceMonitor.persistingFiles()).toContain(TOWER_PATH);

    await tower.waitForIdle();

    expect(tower.persistStatus().status).toBe("idle");
    expect(persistenceMonitor.persistingFiles()).not.toContain(TOWER_PATH);
    expectNoFailureFor(TOWER_PATH);
    expect(project.readText(TOWER_PATH)).toContain("Persist Status Title");
  });

  it("keeps memory updates on persist failure and clears the error after a real successful retry", async () => {
    const tower = projectData.tower();
    await project.loadResource(tower);
    project.fs.setWriteError(new Error("tower persist failed"));

    try {
      const result = await tableCommands.patchResource(tower, [
        ["change", "['firstData']['title']", "Failed Persist Title"],
      ]);

      expect(result).toEqual({ ok: true });
      expect(tower.value().firstData.title).toBe("Failed Persist Title");

      await tower.waitForIdle();

      const status = tower.persistStatus();
      expect(status.status).toBe("error");
      if (status.status === "error") {
        expect(status.error.message).toBe("tower persist failed");
      }
      expect(failedFor(TOWER_PATH)[0]?.error.message).toBe("tower persist failed");
      expect(project.readText(TOWER_PATH)).not.toContain("Failed Persist Title");
    } finally {
      await recoverResource(project, tower, [
        ["change", "['firstData']['title']", "Recovered Persist Title"],
      ]);
    }

    expect(project.readText(TOWER_PATH)).toContain("Recovered Persist Title");
  });

  it("maps commonEvents persist status to the parent events resource", async () => {
    const events = projectData.events();
    const commonEvents = projectData.commonEvents();
    await project.loadResource(commonEvents);
    project.fs.setWriteDelay(50);

    await commonEvents.patch([
      ["add", "['__persistStatusEvent']", [{ type: "comment", text: "mapped resource" }]],
    ]);

    expect(commonEvents.persistStatus().status).toBe("persisting");
    expect(events.persistStatus().status).toBe("persisting");
    expect(persistenceMonitor.persistingFiles()).toContain(EVENTS_PATH);

    await commonEvents.waitForIdle();

    expect(commonEvents.persistStatus().status).toBe("idle");
    expect(events.persistStatus().status).toBe("idle");
    expectNoFailureFor(EVENTS_PATH);
    expect(project.readText(EVENTS_PATH)).toContain("__persistStatusEvent");
  });

  it("tracks concurrent ProjectData persists through the global monitor", async () => {
    const tower = projectData.tower();
    const floor = projectData.floor("sample0");
    await project.loadResource(tower);
    await project.loadResource(floor);
    project.fs.setWriteDelay(80);

    await tower.patch([
      ["change", "['firstData']['title']", "Concurrent Tower Persist"],
    ]);
    await floor.patch([
      ["change", "['title']", "Concurrent Floor Persist"],
    ]);

    await waitFor(() =>
      persistenceMonitor.persistingFiles().includes(TOWER_PATH) &&
      persistenceMonitor.persistingFiles().includes(FLOOR_PATH)
    );

    await Promise.all([tower.waitForIdle(), floor.waitForIdle()]);

    expect(persistenceMonitor.persistingFiles()).not.toContain(TOWER_PATH);
    expect(persistenceMonitor.persistingFiles()).not.toContain(FLOOR_PATH);
    expectNoFailureFor(TOWER_PATH);
    expectNoFailureFor(FLOOR_PATH);
    expect(project.readText(TOWER_PATH)).toContain("Concurrent Tower Persist");
    expect(project.readText(FLOOR_PATH)).toContain("Concurrent Floor Persist");
  });

  it("does not let one resource persist failure block another resource", async () => {
    const tower = projectData.tower();
    const floor = projectData.floor("sample0");
    await project.loadResource(tower);
    await project.loadResource(floor);
    project.fs.setWriteErrorForPath(FLOOR_PATH, new Error("floor-only persist failed"));

    try {
      const floorResult = await tableCommands.patchFloor("sample0", [
        ["change", "['title']", "Failed Floor Persist"],
      ]);
      expect(floorResult).toEqual({ ok: true });
      expect(floor.value().title).toBe("Failed Floor Persist");

      await floor.waitForIdle();
      expect(floor.persistStatus().status).toBe("error");
      expect(failedFor(FLOOR_PATH)[0]?.error.message).toBe("floor-only persist failed");

      await tower.patch([
        ["change", "['firstData']['title']", "Tower Still Persists"],
      ]);
      await tower.waitForIdle();

      expect(tower.persistStatus().status).toBe("idle");
      expectNoFailureFor(TOWER_PATH);
      expect(project.readText(TOWER_PATH)).toContain("Tower Still Persists");
      expect(project.readText(FLOOR_PATH)).not.toContain("Failed Floor Persist");
    } finally {
      await recoverResource(project, floor, [
        ["change", "['title']", "Recovered Floor Persist"],
      ]);
    }

    expect(project.readText(FLOOR_PATH)).toContain("Recovered Floor Persist");
  });
});
