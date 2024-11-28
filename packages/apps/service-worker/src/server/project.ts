import { Dexie, EntityTable } from "dexie";
import { random } from "lodash-es";
import { FsaNodeFs } from "memfs/lib/fsa-to-node";
import { idempotentByKey } from "@motajs/utils";
import { ProjectRecord } from "@/idl";

const PROJECT_ID_START = 1055;
const PROJECT_ID_END = 9922;

const db = new Dexie("service-worker") as Dexie & {
  project: EntityTable<ProjectRecord, "id">;
};

db.version(1).stores({
  project: "&id, name, lastTime",
});

const activeProjectMap = new Map<number, [FsaNodeFs, FileSystemDirectoryHandle]>();

const applyProjectID = async () => {
  while (true) {
    const id = random(PROJECT_ID_START, PROJECT_ID_END);
    if (await db.project.where("id").equals(id).count() === 0) {
      return id;
    }
  }
};

const getPrevProjectId = async (handle: FileSystemDirectoryHandle) => {
  const records = await db.project.where("name").equals(handle.name).toArray();
  const tests = await Promise.all(records.map(async (e) => [e.id, await handle.isSameEntry(e.handle)] as const));
  return tests.find(([k, v]) => v)?.[0];
};

export const registerProject = async (handle: FileSystemDirectoryHandle) => {
  const prevProjectId = await getPrevProjectId(handle);
  if (prevProjectId) {
    db.project.update(prevProjectId, { lastTime: Date.now() });
    return prevProjectId;
  }
  const fs = new FsaNodeFs(handle as any);
  const projectId = await applyProjectID();
  await db.project.add({
    id: projectId,
    name: handle.name,
    handle,
    lastTime: Date.now(),
  });
  activeProjectMap.set(projectId, [fs, handle]);
  return projectId;
};

export const forgetProject = async (id: number) => {
  await db.project.delete(id);
  activeProjectMap.delete(id);
};

const tryActiveProject = idempotentByKey(async (id: number) => {
  const result = await db.project.get(id);
  if (!result) return void 0;
  const { handle } = result;
  const state = await handle.queryPermission({ mode: "readwrite" });
  if (state === "denied") {
    await db.project.delete(id);
    return void 0;
  }
  if (state === "prompt") {
    try {
      const newState = await handle.requestPermission({ mode: "readwrite" });
      if (newState === "denied") {
        await db.project.delete(id);
      }
      if (newState !== "granted") {
        return void 0;
      }
    } catch {
      // 激活失败的情况
      return void 0;
    }
  }
  db.project.update(id, { lastTime: Date.now() });
  const fs = new FsaNodeFs(handle as any);
  activeProjectMap.set(id, [fs, handle]);
  return [fs, handle] as const;
});

export const accessProjectById = async (id: number) => {
  const activeProject = activeProjectMap.get(id);
  if (activeProject) return activeProject;
  return tryActiveProject(id);
};

export const listProject = async () => {
  const result = await db.project.orderBy("lastTime").reverse().toArray();
  return result.map((e) => [e, activeProjectMap.has(e.id)] as const);
};
