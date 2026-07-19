import type { EditorHostStatus } from "@/idl";

const EDITOR_MANIFEST_SCHEMA_VERSION = 2;
const EDITOR_ENVIRONMENT_PROTOCOL_VERSION = 1;
const EDITOR_CHANNEL_SCHEMA_VERSION = 1;
const RELEASE_CACHE_PREFIX = "motajs-editor-release:";
const META_CACHE_NAME = "motajs-editor-meta";

export interface EditorArtifactFile {
  path: string;
  size: number;
  sha256: string;
}

export interface EditorArtifactManifest {
  schemaVersion: 2;
  environmentProtocolVersion: 1;
  runtimeProtocolVersion: number;
  editorVersion: string;
  buildId: string;
  entrypoints: { editor: "index.html"; runtime: "runtime.html" };
  files: EditorArtifactFile[];
}

export interface EditorChannelPointer {
  schemaVersion: 1;
  buildId: string;
  previousBuildId?: string;
}

export interface ResolvedEditorRelease {
  manifest: EditorArtifactManifest;
  html: string;
  releaseRoot: URL;
  source: "network" | "validated-cache" | "cache";
}

interface EditorCacheState {
  current?: string;
  previous?: string;
}

export class EditorReleaseError extends Error {
  constructor(
    public readonly reason: Extract<EditorHostStatus, { status: "unavailable" }>["reason"],
    message: string,
  ) {
    super(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function isSafeArtifactPath(value: string): boolean {
  return Boolean(
    value
      && !value.includes("\0")
      && !value.includes("\\")
      && !value.startsWith("/")
      && value.split("/").every((segment) => segment !== "" && segment !== "." && segment !== ".."),
  );
}

function assertBuildId(value: unknown): asserts value is string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) {
    throw new EditorReleaseError("invalid-artifact", "Editor buildId is invalid");
  }
}

export function parseEditorChannel(value: unknown): EditorChannelPointer {
  if (!isRecord(value) || value.schemaVersion !== EDITOR_CHANNEL_SCHEMA_VERSION) {
    throw new EditorReleaseError("invalid-artifact", "Unsupported Editor channel schema");
  }
  assertBuildId(value.buildId);
  if (value.previousBuildId !== undefined) assertBuildId(value.previousBuildId);
  return {
    schemaVersion: 1,
    buildId: value.buildId,
    ...(typeof value.previousBuildId === "string" ? { previousBuildId: value.previousBuildId } : {}),
  };
}

export function parseEditorManifest(value: unknown): EditorArtifactManifest {
  if (!isRecord(value) || value.schemaVersion !== EDITOR_MANIFEST_SCHEMA_VERSION) {
    throw new EditorReleaseError("invalid-artifact", "Unsupported Editor artifact schema");
  }
  if (value.environmentProtocolVersion !== EDITOR_ENVIRONMENT_PROTOCOL_VERSION) {
    throw new EditorReleaseError(
      "incompatible-environment",
      `Editor environment protocol ${String(value.environmentProtocolVersion)} is not supported`,
    );
  }
  assertBuildId(value.buildId);
  if (typeof value.editorVersion !== "string" || !value.editorVersion) {
    throw new EditorReleaseError("invalid-artifact", "Editor version is missing");
  }
  if (typeof value.runtimeProtocolVersion !== "number" || !Number.isInteger(value.runtimeProtocolVersion)) {
    throw new EditorReleaseError("invalid-artifact", "Editor runtime protocol is invalid");
  }
  if (
    !isRecord(value.entrypoints)
    || value.entrypoints.editor !== "index.html"
    || value.entrypoints.runtime !== "runtime.html"
  ) {
    throw new EditorReleaseError("invalid-artifact", "Editor entrypoints are incompatible");
  }
  if (!Array.isArray(value.files) || value.files.length === 0) {
    throw new EditorReleaseError("invalid-artifact", "Editor artifact file list is missing");
  }
  const paths = new Set<string>();
  const files = value.files.map((item): EditorArtifactFile => {
    if (!isRecord(item) || typeof item.path !== "string" || !isSafeArtifactPath(item.path)) {
      throw new EditorReleaseError("invalid-artifact", "Editor artifact contains an unsafe file path");
    }
    if (paths.has(item.path)) throw new EditorReleaseError("invalid-artifact", `Duplicate Editor file: ${item.path}`);
    paths.add(item.path);
    if (!Number.isSafeInteger(item.size) || (item.size as number) < 0) {
      throw new EditorReleaseError("invalid-artifact", `Invalid Editor file size: ${item.path}`);
    }
    if (typeof item.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(item.sha256)) {
      throw new EditorReleaseError("invalid-artifact", `Invalid Editor file hash: ${item.path}`);
    }
    return { path: item.path, size: item.size as number, sha256: item.sha256 };
  });
  for (const required of ["index.html", "runtime.html"]) {
    if (!paths.has(required)) throw new EditorReleaseError("invalid-artifact", `Editor artifact is missing ${required}`);
  }
  return {
    schemaVersion: 2,
    environmentProtocolVersion: 1,
    runtimeProtocolVersion: value.runtimeProtocolVersion,
    editorVersion: value.editorVersion,
    buildId: value.buildId,
    entrypoints: { editor: "index.html", runtime: "runtime.html" },
    files,
  };
}

function staticRoot(scopeUrl: URL): URL {
  return new URL("static/editor/", new URL("./", scopeUrl));
}

function releaseRoot(scopeUrl: URL, buildId: string): URL {
  return new URL(`releases/${buildId}/`, staticRoot(scopeUrl));
}

function releaseCacheName(buildId: string): string {
  return `${RELEASE_CACHE_PREFIX}${buildId}`;
}

function stateUrl(scopeUrl: URL): URL {
  return new URL(".host-state", staticRoot(scopeUrl));
}

async function responseJson(response: Response, label: string): Promise<unknown> {
  if (!response.ok) {
    const reason = response.status === 404 ? "not-installed" : "offline";
    throw new EditorReleaseError(reason, `${label} returned HTTP ${response.status}`);
  }
  try {
    return await response.json();
  } catch (error) {
    throw new EditorReleaseError(
      "invalid-artifact",
      `${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function fetchNetworkChannel(scopeUrl: URL): Promise<EditorChannelPointer> {
  let pointerResponse: Response;
  try {
    pointerResponse = await fetch(new URL("current.json", staticRoot(scopeUrl)), { cache: "no-cache" });
  } catch (error) {
    throw new EditorReleaseError("offline", `Cannot load Editor channel: ${error instanceof Error ? error.message : String(error)}`);
  }
  return parseEditorChannel(await responseJson(pointerResponse, "Editor channel"));
}

async function fetchNetworkRelease(
  scopeUrl: URL,
  pointer: EditorChannelPointer,
): Promise<ResolvedEditorRelease> {
  const root = releaseRoot(scopeUrl, pointer.buildId);
  const manifestResponse = await fetch(new URL("editor-manifest.json", root), { cache: "no-store" });
  const manifest = parseEditorManifest(await responseJson(manifestResponse, "Editor manifest"));
  if (manifest.buildId !== pointer.buildId) {
    throw new EditorReleaseError("invalid-artifact", "Editor channel and manifest buildId do not match");
  }
  const htmlResponse = await fetch(new URL(manifest.entrypoints.editor, root), { cache: "no-store" });
  if (!htmlResponse.ok) {
    throw new EditorReleaseError("invalid-artifact", `Editor HTML returned HTTP ${htmlResponse.status}`);
  }
  return { manifest, html: await htmlResponse.text(), releaseRoot: root, source: "network" };
}

async function readCacheState(scopeUrl: URL): Promise<EditorCacheState> {
  const cache = await caches.open(META_CACHE_NAME);
  const response = await cache.match(stateUrl(scopeUrl));
  if (!response) return {};
  try {
    const value = await response.json() as EditorCacheState;
    return isRecord(value) ? value : {};
  } catch {
    return {};
  }
}

async function writeCacheState(scopeUrl: URL, state: EditorCacheState): Promise<void> {
  const cache = await caches.open(META_CACHE_NAME);
  await cache.put(stateUrl(scopeUrl), Response.json(state));
}

async function loadCachedBuild(scopeUrl: URL, buildId: string): Promise<ResolvedEditorRelease | null> {
  if (!/^[a-f0-9]{64}$/.test(buildId)) return null;
  const cache = await caches.open(releaseCacheName(buildId));
  const root = releaseRoot(scopeUrl, buildId);
  const [manifestResponse, htmlResponse] = await Promise.all([
    cache.match(new URL("editor-manifest.json", root)),
    cache.match(new URL("index.html", root)),
  ]);
  if (!manifestResponse || !htmlResponse) return null;
  try {
    const manifest = parseEditorManifest(await manifestResponse.json());
    if (manifest.buildId !== buildId) return null;
    return { manifest, html: await htmlResponse.text(), releaseRoot: root, source: "cache" };
  } catch {
    return null;
  }
}

async function isPromotedCachedBuild(scopeUrl: URL, buildId: string): Promise<boolean> {
  const state = await readCacheState(scopeUrl);
  return state.current === buildId || state.previous === buildId;
}

async function demoteCachedBuild(scopeUrl: URL, buildId: string): Promise<void> {
  const state = await readCacheState(scopeUrl);
  if (state.current === buildId) {
    await writeCacheState(scopeUrl, state.previous ? { current: state.previous } : {});
  } else if (state.previous === buildId) {
    await writeCacheState(scopeUrl, state.current ? { current: state.current } : {});
  }
}

async function loadCachedRelease(scopeUrl: URL): Promise<ResolvedEditorRelease | null> {
  const state = await readCacheState(scopeUrl);
  for (const buildId of [state.current, state.previous]) {
    if (!buildId) continue;
    const release = await loadCachedBuild(scopeUrl, buildId);
    if (release) return release;
  }
  return null;
}

async function loadPromotedCachedBuild(
  scopeUrl: URL,
  buildId: string,
): Promise<ResolvedEditorRelease | null> {
  const state = await readCacheState(scopeUrl);
  if (state.current !== buildId && state.previous !== buildId) return null;
  return await loadCachedBuild(scopeUrl, buildId);
}

async function sha256(content: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", content);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function verifiedResponse(url: URL, file: EditorArtifactFile): Promise<Response> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${file.path} returned HTTP ${response.status}`);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== file.size) throw new Error(`${file.path} has an unexpected size`);
  if (await sha256(bytes) !== file.sha256) throw new Error(`${file.path} failed SHA-256 validation`);
  return new Response(bytes, { status: response.status, statusText: response.statusText, headers: response.headers });
}

async function loadAssetManifest(
  scopeUrl: URL,
  buildId: string,
  cache: Cache,
): Promise<EditorArtifactManifest> {
  const root = releaseRoot(scopeUrl, buildId);
  const manifestUrl = new URL("editor-manifest.json", root);
  const cached = await cache.match(manifestUrl);
  if (cached) {
    const manifest = parseEditorManifest(await cached.json());
    if (manifest.buildId !== buildId) {
      throw new EditorReleaseError("invalid-artifact", "Cached Editor manifest buildId does not match its release");
    }
    return manifest;
  }

  const response = await fetch(manifestUrl, { cache: "no-store" });
  const manifest = parseEditorManifest(await responseJson(response, "Editor manifest"));
  if (manifest.buildId !== buildId) {
    throw new EditorReleaseError("invalid-artifact", "Editor manifest buildId does not match its release");
  }
  await cache.put(manifestUrl, Response.json(manifest));
  return manifest;
}

export async function cacheCompleteEditorRelease(scopeUrl: URL, release: ResolvedEditorRelease): Promise<void> {
  const cache = await caches.open(releaseCacheName(release.manifest.buildId));
  const manifestUrl = new URL("editor-manifest.json", release.releaseRoot);
  await Promise.all([
    cache.put(manifestUrl, Response.json(release.manifest)),
    ...release.manifest.files.map(async (file) => {
      const url = new URL(file.path, release.releaseRoot);
      await cache.put(url, await verifiedResponse(url, file));
    }),
  ]);

  const previousState = await readCacheState(scopeUrl);
  const nextState: EditorCacheState = previousState.current === release.manifest.buildId
    ? previousState
    : { current: release.manifest.buildId, previous: previousState.current };
  await writeCacheState(scopeUrl, nextState);
  const retained = new Set([nextState.current, nextState.previous].filter(Boolean));
  const names = await caches.keys();
  await Promise.all(names
    .filter((name) => name.startsWith(RELEASE_CACHE_PREFIX) && !retained.has(name.slice(RELEASE_CACHE_PREFIX.length)))
    .map((name) => caches.delete(name)));
}

export async function resolveEditorRelease(
  scopeUrl: URL,
  schedule?: (task: Promise<unknown>) => void,
): Promise<ResolvedEditorRelease> {
  try {
    const pointer = await fetchNetworkChannel(scopeUrl);
    const cached = await loadPromotedCachedBuild(scopeUrl, pointer.buildId);
    if (cached) return { ...cached, source: "validated-cache" };

    const release = await fetchNetworkRelease(scopeUrl, pointer);
    schedule?.(cacheCompleteEditorRelease(scopeUrl, release).catch((error) => {
      console.warn("Failed to cache complete Editor release", error);
    }));
    return release;
  } catch (networkError) {
    const cached = await loadCachedRelease(scopeUrl);
    if (cached) return cached;
    throw networkError;
  }
}

export async function getEditorHostStatus(scopeUrl: URL): Promise<EditorHostStatus> {
  try {
    const release = await resolveEditorRelease(scopeUrl);
    return {
      status: "ready",
      buildId: release.manifest.buildId,
      editorVersion: release.manifest.editorVersion,
      source: release.source,
    };
  } catch (error) {
    if (error instanceof EditorReleaseError) {
      return { status: "unavailable", reason: error.reason, message: error.message };
    }
    return { status: "unavailable", reason: "offline", message: error instanceof Error ? error.message : String(error) };
  }
}

export async function serveEditorReleaseAsset(request: Request, scopeUrl: URL): Promise<Response> {
  const pathname = new URL(request.url).pathname;
  const relative = pathname.slice(staticRoot(scopeUrl).pathname.length);
  const match = /^releases\/([a-f0-9]{64})\/(.+)$/.exec(relative);
  if (!match || !isSafeArtifactPath(match[2]!)) return fetch(request);
  const [buildId, path] = [match[1]!, match[2]!];
  const cache = await caches.open(releaseCacheName(buildId));
  const cached = await cache.match(request);
  if (cached) return cached;

  const promoted = await isPromotedCachedBuild(scopeUrl, buildId);
  try {
    const manifest = await loadAssetManifest(scopeUrl, buildId, cache);
    if (path === "editor-manifest.json") {
      return (await cache.match(request)) ?? Response.json(manifest);
    }
    const file = manifest.files.find((candidate) => candidate.path === path);
    if (!file) {
      return new Response("Editor release does not contain this asset", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
      });
    }
    const response = await verifiedResponse(new URL(request.url), file);
    await cache.put(request, response.clone());
    return response;
  } catch (error) {
    if (promoted) await demoteCachedBuild(scopeUrl, buildId);
    console.warn(`Failed to repair Editor release ${buildId} asset ${path}`, error);
    return new Response("Editor cache is incomplete and the missing asset could not be restored. Reconnect and reload the Editor.", {
      status: 503,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
        "x-motajs-editor-cache": "repair-failed",
      },
    });
  }
}
