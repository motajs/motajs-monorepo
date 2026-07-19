import {
  getEditorEnvironment,
  type EditorEnvironment,
  type EditorReleaseIdentity,
} from "@/environment";

interface ReadyEditorUpdateStatus {
  protocolVersion: 1;
  status: "ready";
  release: EditorReleaseIdentity;
}

interface UnavailableEditorUpdateStatus {
  protocolVersion: 1;
  status: "unavailable";
  message: string;
}

export type EditorUpdateStatus = ReadyEditorUpdateStatus | UnavailableEditorUpdateStatus;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function parseEditorUpdateStatus(value: unknown): EditorUpdateStatus {
  if (!isRecord(value) || value.protocolVersion !== 1) {
    throw new Error("编辑器更新接口返回了不兼容的数据。");
  }
  if (value.status === "unavailable") {
    if (typeof value.message !== "string") throw new Error("编辑器更新状态缺少错误信息。");
    return { protocolVersion: 1, status: "unavailable", message: value.message };
  }
  if (value.status !== "ready" || !isRecord(value.release)) {
    throw new Error("编辑器更新状态格式无效。");
  }
  const { buildId, version } = value.release;
  if (typeof buildId !== "string" || buildId.length === 0) {
    throw new Error("编辑器更新状态缺少 buildId。");
  }
  if (typeof version !== "string" || version.length === 0) {
    throw new Error("编辑器更新状态缺少版本号。");
  }
  return { protocolVersion: 1, status: "ready", release: { buildId, version } };
}

export async function checkEditorUpdate(
  environment: EditorEnvironment = getEditorEnvironment(),
  signal?: AbortSignal,
): Promise<EditorReleaseIdentity | null> {
  const { release } = environment;
  const endpoint = environment.endpoints.update;
  if (!release || !endpoint) return null;
  const response = await fetch(endpoint, {
    cache: "no-store",
    headers: { accept: "application/json" },
    signal,
  });
  if (!response.ok) throw new Error(`编辑器更新检查失败：HTTP ${response.status}`);
  const status = parseEditorUpdateStatus(await response.json());
  if (status.status !== "ready" || status.release.buildId === release.buildId) return null;
  return status.release;
}
