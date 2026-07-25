import type {
  EditorReleaseIdentity,
  EditorUpdateState,
} from "@/idl";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function parseRelease(value: unknown): EditorReleaseIdentity | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value) || typeof value.buildId !== "string" || !value.buildId) {
    throw new Error("Editor release buildId is missing");
  }
  if (typeof value.version !== "string" || !value.version) {
    throw new Error("Editor release version is missing");
  }
  return { buildId: value.buildId, version: value.version };
}

export function parseEditorUpdateState(value: unknown): EditorUpdateState {
  if (!isRecord(value) || value.protocolVersion !== 2 || value.status !== "ready") {
    throw new Error("Editor update status is incompatible");
  }
  const launch = parseRelease(value.launch);
  const candidate = parseRelease(value.candidate);
  let staging: EditorUpdateState["staging"];
  if (value.staging !== undefined) {
    if (!isRecord(value.staging) || typeof value.staging.buildId !== "string") {
      throw new Error("Editor update progress is invalid");
    }
    const stagingValue = value.staging;
    const numeric = ["completedFiles", "totalFiles", "completedBytes", "totalBytes"] as const;
    if (numeric.some((key) => typeof stagingValue[key] !== "number")) {
      throw new Error("Editor update progress is invalid");
    }
    staging = {
      buildId: stagingValue.buildId as string,
      ...(typeof stagingValue.version === "string" ? { version: stagingValue.version } : {}),
      completedFiles: stagingValue.completedFiles as number,
      totalFiles: stagingValue.totalFiles as number,
      completedBytes: stagingValue.completedBytes as number,
      totalBytes: stagingValue.totalBytes as number,
      ...(typeof stagingValue.error === "string" ? { error: stagingValue.error } : {}),
    };
  }
  return {
    protocolVersion: 2,
    status: "ready",
    ...(launch ? { launch } : {}),
    ...(candidate ? { candidate } : {}),
    ...(staging ? { staging } : {}),
    ...(typeof value.lastCheckedAt === "number" ? { lastCheckedAt: value.lastCheckedAt } : {}),
  };
}

async function requestEditorUpdate(url: string, init?: RequestInit): Promise<EditorUpdateState> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { "accept": "application/json", "content-type": "application/json" },
    ...init,
  });
  if (!response.ok) throw new Error(`Editor update request failed: HTTP ${response.status}`);
  return parseEditorUpdateState(await response.json());
}

export function getEditorUpdateState(url: string, signal?: AbortSignal): Promise<EditorUpdateState> {
  return requestEditorUpdate(url, { method: "GET", signal });
}

export function checkEditorUpdate(url: string, force = false, signal?: AbortSignal): Promise<EditorUpdateState> {
  return requestEditorUpdate(url, {
    method: "POST",
    body: JSON.stringify({ action: "check", ...(force ? { force: true } : {}) }),
    signal,
  });
}

export function editorReleaseLabel(release: EditorReleaseIdentity | undefined): string {
  if (!release) return "未知构建";
  if (release.version !== "0.0.0") return `Editor ${release.version}`;
  return `Editor 构建 ${release.buildId.slice(0, 12)}`;
}

export function stagingPercent(staging: NonNullable<EditorUpdateState["staging"]>): number {
  if (staging.totalBytes > 0) return Math.round(staging.completedBytes / staging.totalBytes * 100);
  if (staging.totalFiles > 0) return Math.round(staging.completedFiles / staging.totalFiles * 100);
  return 0;
}

export function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 ** 2).toFixed(1)} MB`;
}
