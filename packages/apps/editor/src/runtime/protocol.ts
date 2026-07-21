import type { FloorData } from "@/types";
import type { UIData } from "@/Workbench/modals/shared/types";

export const RUNTIME_PROTOCOL_VERSION = 3;

export interface RuntimeConnectMessage {
  type: "mota-runtime-connect";
  version: typeof RUNTIME_PROTOCOL_VERSION;
  previewUrl: string;
}

export type RuntimeStatus = "starting" | "ready" | "updating" | "error";

export interface RuntimePreviewContext {
  floorId?: string;
  floor?: FloorData;
  tower: {
    firstData: unknown;
    values: Record<string, unknown>;
    flags: Record<string, unknown>;
    nameMap: Record<string, string>;
  };
  blockRegistry: {
    maps: Record<string, unknown>;
    icons: Record<string, unknown>;
    items: Record<string, Record<string, unknown>>;
    enemys: Record<string, Record<string, unknown>>;
    assets: Array<{ path: string; images?: string; id?: string }>;
  };
}

export interface RuntimeUIPreviewRequest {
  list: UIData[];
  background: string;
  context: RuntimePreviewContext;
}

export interface RuntimeStatusBarRequest {
  code: string;
  orientation: "horizontal" | "vertical";
  values: Record<string, string>;
  context: RuntimePreviewContext;
}

export interface RuntimeMemberSnapshot {
  name: string;
  kind: "function" | "array" | "object" | "string" | "number" | "boolean" | "unknown";
}

export interface RuntimeLanguageSnapshot {
  core: RuntimeMemberSnapshot[];
  modules: Record<string, RuntimeMemberSnapshot[]>;
  catalogs: Record<string, RuntimeMemberSnapshot[]>;
  specials: Array<{ id: number; name: string }>;
}

export interface ProjectResourceChange {
  revision: number;
  path: string;
  state: "loaded" | "deleted" | "error";
  kind: "data" | "floor" | "image" | "animation" | "audio" | "font";
}

export type HostRequestPayload
  = | { type: "render-ui"; payload: RuntimeUIPreviewRequest }
    | { type: "render-status-bar"; payload: RuntimeStatusBarRequest }
    | { type: "language-snapshot" }
    | { type: "close-preview" };

export type HostRequest = HostRequestPayload & { id: number };

export type RuntimeRequest = {
  id: number;
  type: "resource";
  path: string;
  binary: boolean;
};

export type RuntimeMessage
  = | { type: "ready"; version: number; instanceId: string }
    | { type: "fatal"; message: string }
    | { type: "diagnostic"; message: string }
    | { type: "response"; id: number; ok: boolean; error?: string; width?: number; height?: number; payload?: unknown }
    | RuntimeRequest;

export type HostMessage = HostRequest | { type: "resources-changed"; changes: ProjectResourceChange[] } | {
  type: "resource-response";
  id: number;
  ok: boolean;
  revision?: number;
  text?: string;
  bytes?: ArrayBuffer;
  error?: string;
};

export type HostResourceResponse = Extract<HostMessage, { type: "resource-response" }>;
