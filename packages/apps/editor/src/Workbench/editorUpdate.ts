import { getEditorEnvironment, type EditorEnvironment, type EditorReleaseIdentity } from '@/environment';

export interface EditorUpdateStaging {
  buildId: string;
  version?: string;
  completedFiles: number;
  totalFiles: number;
  completedBytes: number;
  totalBytes: number;
  error?: string;
}

export interface EditorUpdateStatus {
  protocolVersion: 2;
  status: 'ready';
  launch?: EditorReleaseIdentity;
  candidate?: EditorReleaseIdentity;
  staging?: EditorUpdateStaging;
  lastCheckedAt?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function parseRelease(value: unknown, label: string): EditorReleaseIdentity | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value) || typeof value.buildId !== 'string' || !value.buildId) {
    throw new Error(`编辑器更新状态缺少${label} buildId。`);
  }
  if (typeof value.version !== 'string' || !value.version) {
    throw new Error(`编辑器更新状态缺少${label}版本号。`);
  }
  return { buildId: value.buildId, version: value.version };
}

export function parseEditorUpdateStatus(value: unknown): EditorUpdateStatus {
  if (!isRecord(value) || value.protocolVersion !== 2 || value.status !== 'ready') {
    throw new Error('编辑器更新接口返回了不兼容的数据。');
  }
  const launch = parseRelease(value.launch, '当前版本');
  const candidate = parseRelease(value.candidate, '候选版本');
  let staging: EditorUpdateStaging | undefined;
  if (value.staging !== undefined) {
    if (!isRecord(value.staging) || typeof value.staging.buildId !== 'string') {
      throw new Error('编辑器更新状态中的下载进度无效。');
    }
    const stagingValue = value.staging;
    const numeric = ['completedFiles', 'totalFiles', 'completedBytes', 'totalBytes'] as const;
    if (numeric.some((key) => typeof stagingValue[key] !== 'number')) {
      throw new Error('编辑器更新状态中的下载进度无效。');
    }
    staging = {
      buildId: stagingValue.buildId as string,
      ...(typeof stagingValue.version === 'string' ? { version: stagingValue.version } : {}),
      completedFiles: stagingValue.completedFiles as number,
      totalFiles: stagingValue.totalFiles as number,
      completedBytes: stagingValue.completedBytes as number,
      totalBytes: stagingValue.totalBytes as number,
      ...(typeof stagingValue.error === 'string' ? { error: stagingValue.error } : {}),
    };
  }
  return {
    protocolVersion: 2,
    status: 'ready',
    ...(launch ? { launch } : {}),
    ...(candidate ? { candidate } : {}),
    ...(staging ? { staging } : {}),
    ...(typeof value.lastCheckedAt === 'number' ? { lastCheckedAt: value.lastCheckedAt } : {}),
  };
}

async function requestUpdateEndpoint(environment: EditorEnvironment, init: RequestInit): Promise<EditorUpdateStatus> {
  const endpoint = environment.endpoints.update;
  if (!endpoint) throw new Error('当前编辑器宿主未提供更新能力。');
  const response = await fetch(endpoint, {
    cache: 'no-store',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    ...init,
  });
  if (!response.ok) throw new Error(`编辑器更新请求失败：HTTP ${response.status}`);
  return parseEditorUpdateStatus(await response.json());
}

export async function getEditorUpdateState(
  environment: EditorEnvironment = getEditorEnvironment(),
  signal?: AbortSignal,
): Promise<EditorUpdateStatus | null> {
  if (!environment.release || !environment.endpoints.update) return null;
  return await requestUpdateEndpoint(environment, { method: 'GET', signal });
}

export async function checkEditorUpdate(
  environment: EditorEnvironment = getEditorEnvironment(),
  signal?: AbortSignal,
  force = false,
): Promise<EditorUpdateStatus | null> {
  if (!environment.release || !environment.endpoints.update) return null;
  return await requestUpdateEndpoint(environment, {
    method: 'POST',
    body: JSON.stringify({ action: 'check', ...(force ? { force: true } : {}) }),
    signal,
  });
}

export async function activateEditorUpdate(
  buildId: string,
  environment: EditorEnvironment = getEditorEnvironment(),
): Promise<EditorUpdateStatus> {
  return await requestUpdateEndpoint(environment, {
    method: 'POST',
    body: JSON.stringify({ action: 'activate', buildId }),
  });
}

export function availableEditorRelease(
  status: EditorUpdateStatus | null | undefined,
  running: EditorReleaseIdentity | undefined,
): EditorReleaseIdentity | undefined {
  if (!status || !running) return undefined;
  const release = status.candidate ?? status.launch;
  return release && release.buildId !== running.buildId ? release : undefined;
}
