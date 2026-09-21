import { Dexie, type EntityTable } from 'dexie';
import { randomInt } from 'es-toolkit';
import { FsaNodeFs } from 'memfs/lib/fsa-to-node';

import type { ProjectAccessResult, ProjectDetailsResponse, ProjectRecord, ProjectSummary } from '@/idl';

const PROJECT_ID_START = 1055;
const PROJECT_ID_END = 9922;

const db = new Dexie('service-worker') as Dexie & {
  project: EntityTable<ProjectRecord, 'id'>;
};

db.version(1).stores({
  project: '&id, name, lastTime',
});

export type ProjectFs = FsaNodeFs;

export type ProjectHostAccess =
  | { status: 'ready'; project: ProjectSummary; fs: ProjectFs; handle: FileSystemDirectoryHandle }
  | { status: 'permission-required'; project: ProjectSummary; handle: FileSystemDirectoryHandle }
  | { status: 'not-found' };

const activeProjectMap = new Map<number, [ProjectFs, FileSystemDirectoryHandle]>();
const activationPromises = new Map<number, Promise<ProjectHostAccess>>();

const applyProjectID = async () => {
  while (true) {
    const id = randomInt(PROJECT_ID_START, PROJECT_ID_END);
    if ((await db.project.where('id').equals(id).count()) === 0) return id;
  }
};

const getPrevProjectId = async (handle: FileSystemDirectoryHandle) => {
  const records = await db.project.where('name').equals(handle.name).toArray();
  const tests = await Promise.all(
    records.map(async (record) => {
      try {
        return [record.id, await handle.isSameEntry(record.handle)] as const;
      } catch {
        return [record.id, false] as const;
      }
    }),
  );
  return tests.find(([, same]) => same)?.[0];
};

const queryPermission = async (handle: FileSystemDirectoryHandle): Promise<PermissionState> => {
  try {
    return await handle.queryPermission({ mode: 'readwrite' });
  } catch {
    return 'denied';
  }
};

const hasIndex = async (fs: ProjectFs): Promise<boolean> => {
  try {
    const stat = await fs.promises.stat('index.html');
    return stat.isFile();
  } catch {
    return false;
  }
};

const summaryOf = async (record: ProjectRecord, knownPermission?: PermissionState): Promise<ProjectSummary> => {
  const permission = knownPermission ?? (await queryPermission(record.handle));
  const active = permission === 'granted' && activeProjectMap.has(record.id);
  const summary: ProjectSummary = {
    id: record.id,
    name: record.name,
    lastTime: record.lastTime,
    permission,
    active,
  };
  if (permission === 'granted') {
    const fs = activeProjectMap.get(record.id)?.[0] ?? new FsaNodeFs(record.handle as never);
    summary.hasIndex = await hasIndex(fs);
  }
  return summary;
};

const publicAccess = (access: ProjectHostAccess): ProjectAccessResult => {
  if (access.status === 'not-found') return access;
  return { status: access.status, project: access.project };
};

export const registerProject = async (handle: FileSystemDirectoryHandle) => {
  const prevProjectId = await getPrevProjectId(handle);
  const now = Date.now();
  if (prevProjectId !== undefined) {
    await db.project.update(prevProjectId, { lastTime: now, name: handle.name, handle });
    activeProjectMap.set(prevProjectId, [new FsaNodeFs(handle as never), handle]);
    return prevProjectId;
  }
  const projectId = await applyProjectID();
  await db.project.add({ id: projectId, name: handle.name, handle, lastTime: now });
  activeProjectMap.set(projectId, [new FsaNodeFs(handle as never), handle]);
  return projectId;
};

export const forgetProject = async (id: number) => {
  await db.project.delete(id);
  activeProjectMap.delete(id);
  activationPromises.delete(id);
};

export const invalidateProject = (id: number) => {
  activeProjectMap.delete(id);
};

const activate = async (id: number): Promise<ProjectHostAccess> => {
  const record = await db.project.get(id);
  if (!record) return { status: 'not-found' };
  const permission = await queryPermission(record.handle);
  if (permission !== 'granted') {
    activeProjectMap.delete(id);
    return {
      status: 'permission-required',
      project: await summaryOf(record, permission),
      handle: record.handle,
    };
  }
  const fs = new FsaNodeFs(record.handle as never);
  activeProjectMap.set(id, [fs, record.handle]);
  const lastTime = Date.now();
  await db.project.update(id, { lastTime });
  const nextRecord = { ...record, lastTime };
  return {
    status: 'ready',
    project: await summaryOf(nextRecord, permission),
    fs,
    handle: record.handle,
  };
};

export const activateProject = async (id: number): Promise<ProjectHostAccess> => {
  const pending = activationPromises.get(id);
  if (pending) return pending;
  const promise = activate(id).finally(() => activationPromises.delete(id));
  activationPromises.set(id, promise);
  return promise;
};

export const accessProjectById = async (id: number): Promise<ProjectHostAccess> => {
  if (!Number.isSafeInteger(id)) return { status: 'not-found' };
  const record = await db.project.get(id);
  if (!record) return { status: 'not-found' };
  const permission = await queryPermission(record.handle);
  if (permission !== 'granted') {
    activeProjectMap.delete(id);
    return {
      status: 'permission-required',
      project: await summaryOf(record, permission),
      handle: record.handle,
    };
  }
  const active = activeProjectMap.get(id);
  if (active) {
    return {
      status: 'ready',
      project: await summaryOf(record, permission),
      fs: active[0],
      handle: active[1],
    };
  }
  return activateProject(id);
};

export const getProjectDetails = async (id: number): Promise<ProjectDetailsResponse> => {
  const access = await accessProjectById(id);
  return {
    access: publicAccess(access),
    handle: access.status === 'not-found' ? undefined : access.handle,
  };
};

export const listProject = async (): Promise<ProjectSummary[]> => {
  const records = await db.project.orderBy('lastTime').reverse().toArray();
  return Promise.all(records.map((record) => summaryOf(record)));
};

export const toProjectAccessResult = publicAccess;
