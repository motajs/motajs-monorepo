export const EDITOR_ENVIRONMENT_PROTOCOL_VERSION = 1 as const;
export const EDITOR_ENVIRONMENT_ELEMENT_ID = "mota-editor-environment";

export interface EditorReleaseIdentity {
  buildId: string;
  version: string;
}

export interface EditorEnvironment {
  protocolVersion: typeof EDITOR_ENVIRONMENT_PROTOCOL_VERSION;
  release?: EditorReleaseIdentity;
  endpoints: {
    fs: string;
    runtime: string;
    preview: string;
    docs?: string;
    project: string;
    update?: string;
  };
}

let environment: EditorEnvironment | undefined;

const endpointNames = ["fs", "runtime", "preview", "project"] as const;
type RequiredEditorEndpointName = typeof endpointNames[number];

function parseRelease(value: unknown): EditorReleaseIdentity | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object") {
    throw new Error("Editor environment release must be an object.");
  }
  const release = value as Record<string, unknown>;
  if (typeof release.buildId !== "string" || release.buildId.length === 0) {
    throw new Error("Editor environment release buildId must be non-empty.");
  }
  if (typeof release.version !== "string" || release.version.length === 0) {
    throw new Error("Editor environment release version must be non-empty.");
  }
  return { buildId: release.buildId, version: release.version };
}

export function parseEditorEnvironment(source: Document = document): EditorEnvironment {
  const elements = source.querySelectorAll(`#${EDITOR_ENVIRONMENT_ELEMENT_ID}`);
  if (elements.length !== 1) {
    throw new Error(`Expected exactly one #${EDITOR_ENVIRONMENT_ELEMENT_ID} configuration node, found ${elements.length}.`);
  }

  let input: unknown;
  try {
    input = JSON.parse(elements[0]!.textContent ?? "");
  } catch (error) {
    throw new Error(`Invalid editor environment JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!input || typeof input !== "object") throw new Error("Editor environment must be an object.");
  const record = input as Record<string, unknown>;
  if (record.protocolVersion !== EDITOR_ENVIRONMENT_PROTOCOL_VERSION) {
    throw new Error(`Unsupported editor environment protocol: ${String(record.protocolVersion)}.`);
  }
  if (!record.endpoints || typeof record.endpoints !== "object") {
    throw new Error("Editor environment endpoints are missing.");
  }

  const rawEndpoints = record.endpoints as Record<string, unknown>;
  const endpoints = {} as EditorEnvironment["endpoints"];
  for (const name of endpointNames) {
    const value = rawEndpoints[name];
    if (typeof value !== "string" || value.length === 0) {
      throw new Error(`Editor environment endpoint '${name}' must be a non-empty URL.`);
    }
    try {
      endpoints[name] = new URL(value, source.baseURI).href;
    } catch {
      throw new Error(`Editor environment endpoint '${name}' is not a valid URL.`);
    }
  }
  for (const name of ["docs", "update"] as const) {
    if (rawEndpoints[name] === undefined) continue;
    if (typeof rawEndpoints[name] !== "string" || rawEndpoints[name].length === 0) {
      throw new Error(`Editor environment endpoint '${name}' must be a non-empty URL.`);
    }
    try {
      endpoints[name] = new URL(rawEndpoints[name], source.baseURI).href;
    } catch {
      throw new Error(`Editor environment endpoint '${name}' is not a valid URL.`);
    }
  }
  const release = parseRelease(record.release);
  return {
    protocolVersion: EDITOR_ENVIRONMENT_PROTOCOL_VERSION,
    ...(release ? { release } : {}),
    endpoints,
  };
}

export function initializeEditorEnvironment(): EditorEnvironment {
  environment ??= parseEditorEnvironment();
  return environment;
}

export function getEditorEnvironment(): EditorEnvironment {
  return environment ?? initializeEditorEnvironment();
}

export function editorEndpoint(name: RequiredEditorEndpointName, path = ""): string {
  return new URL(path, getEditorEnvironment().endpoints[name]).href;
}

export function editorDocsEndpoint(path = ""): string | undefined {
  const endpoint = getEditorEnvironment().endpoints.docs;
  return endpoint ? new URL(path, endpoint).href : undefined;
}
