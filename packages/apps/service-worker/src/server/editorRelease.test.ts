import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  parseEditorChannel,
  parseEditorManifest,
  getEditorReleaseManager,
  resetEditorReleaseManagersForTest,
  resolveEditorRelease,
  serveEditorReleaseAsset,
  type EditorArtifactManifest,
} from "./editorRelease";

const scope = new URL("https://example.test/server/");
const buildId = "a".repeat(64);
const files = new Map([
  ["index.html", '<html><head></head><script id="mota-editor-environment" type="application/json">{}</script>'],
  ["runtime.html", "runtime"],
  ["assets/editor.js", "editor"],
]);

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const manifest: EditorArtifactManifest = {
  schemaVersion: 2,
  environmentProtocolVersion: 1,
  runtimeProtocolVersion: 7,
  editorVersion: "2.0.0",
  buildId,
  entrypoints: { editor: "index.html", runtime: "runtime.html" },
  files: [...files].map(([path, content]) => ({ path, size: content.length, sha256: digest(content) })),
};

class MemoryCache {
  private readonly values = new Map<string, Response>();

  async match(input: RequestInfo | URL): Promise<Response | undefined> {
    return this.values.get(String(input instanceof Request ? input.url : input))?.clone();
  }

  async put(input: RequestInfo | URL, response: Response): Promise<void> {
    this.values.set(String(input instanceof Request ? input.url : input), response.clone());
  }

  async delete(input: RequestInfo | URL): Promise<boolean> {
    return this.values.delete(String(input instanceof Request ? input.url : input));
  }

  async keys(): Promise<Request[]> {
    return [...this.values.keys()].map((url) => new Request(url));
  }
}

class MemoryCacheStorage {
  private readonly values = new Map<string, MemoryCache>();

  async open(name: string): Promise<MemoryCache> {
    let cache = this.values.get(name);
    if (!cache) {
      cache = new MemoryCache();
      this.values.set(name, cache);
    }
    return cache;
  }

  async keys(): Promise<string[]> {
    return [...this.values.keys()];
  }

  async delete(name: string): Promise<boolean> {
    return this.values.delete(name);
  }
}

function responseFor(url: string): Response {
  if (url.endsWith("/current.json")) return Response.json({ schemaVersion: 1, buildId });
  if (url.endsWith("/editor-manifest.json")) return Response.json(manifest);
  const path = url.split(`/${buildId}/`)[1];
  const content = path ? files.get(path) : undefined;
  return content === undefined ? new Response("missing", { status: 404 }) : new Response(content);
}

describe("Editor release host", () => {
  let cacheStorage: MemoryCacheStorage;

  beforeEach(() => {
    vi.unstubAllGlobals();
    resetEditorReleaseManagersForTest();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    cacheStorage = new MemoryCacheStorage();
    vi.stubGlobal("caches", cacheStorage);
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      return responseFor(url);
    }));
  });

  it("validates channel, file paths and environment compatibility", () => {
    expect(parseEditorChannel({ schemaVersion: 1, buildId })).toEqual({ schemaVersion: 1, buildId });
    expect(parseEditorManifest(manifest).runtimeProtocolVersion).toBe(7);
    expect(() => parseEditorManifest({ ...manifest, environmentProtocolVersion: 2 })).toThrow("not supported");
    expect(() => parseEditorManifest({
      ...manifest,
      files: [...manifest.files, { path: "../escape", size: 0, sha256: "0".repeat(64) }],
    })).toThrow("unsafe");
  });

  it("loads the network release, promotes a verified complete cache, and starts cache-first", async () => {
    const background: Promise<unknown>[] = [];
    const online = await resolveEditorRelease(scope, (task) => background.push(task));
    expect(online.source).toBe("network");
    expect(online.releaseRoot.href).toBe(`https://example.test/server/static/editor/releases/${buildId}/`);
    await Promise.all(background);

    vi.mocked(fetch).mockClear();
    const validated = await resolveEditorRelease(scope);
    expect(validated.source).toBe("cache");
    expect(validated.html).toBe(files.get("index.html"));
    expect(fetch).not.toHaveBeenCalled();

    vi.mocked(fetch).mockRejectedValue(new Error("offline"));
    const offline = await resolveEditorRelease(scope);
    expect(offline.source).toBe("cache");
    expect(offline.html).toBe(files.get("index.html"));
  });

  it("does not promote a release when a file hash is invalid", async () => {
    const invalid = { ...manifest, files: manifest.files.map((file) => (
      file.path === "runtime.html" ? { ...file, sha256: "0".repeat(64) } : file
    )) };
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.endsWith("/editor-manifest.json")) return Response.json(invalid);
      return responseFor(url);
    });
    const background: Promise<unknown>[] = [];
    await resolveEditorRelease(scope, (task) => background.push(task));
    await Promise.all(background);

    vi.mocked(fetch).mockRejectedValue(new Error("offline"));
    await expect(resolveEditorRelease(scope)).rejects.toThrow("offline");
  });

  it("repairs a promoted cache miss with a verified response", async () => {
    const background: Promise<unknown>[] = [];
    await resolveEditorRelease(scope, (task) => background.push(task));
    await Promise.all(background);

    const assetUrl = new URL(`static/editor/releases/${buildId}/assets/editor.js`, scope);
    const blobUrl = new URL(`static/editor/.blobs/${digest("editor")}.js`, scope);
    const blobCache = await cacheStorage.open("motajs-editor-blobs");
    await blobCache.delete(blobUrl);

    vi.mocked(fetch).mockClear();
    const response = await serveEditorReleaseAsset(new Request(assetUrl), scope);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("editor");
    expect(await (await blobCache.match(blobUrl))?.text()).toBe("editor");
  });

  it("deduplicates scheduled update checks for ten minutes", async () => {
    const background: Promise<unknown>[] = [];
    await resolveEditorRelease(scope, (task) => background.push(task));
    await Promise.all(background);
    const manager = getEditorReleaseManager(scope);
    vi.mocked(fetch).mockClear();
    await manager.checkForUpdates();
    await manager.checkForUpdates();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain("current.json");
  });

  it("stages a candidate and applies it on the next navigation without retaining an unused old build", async () => {
    const background: Promise<unknown>[] = [];
    await resolveEditorRelease(scope, (task) => background.push(task));
    await Promise.all(background);

    const nextBuildId = "b".repeat(64);
    const nextFiles = new Map([...files].map(([path, content]) => [path, `${content}-next`]));
    const nextManifest: EditorArtifactManifest = {
      ...manifest,
      buildId: nextBuildId,
      editorVersion: "2.1.0",
      files: [...nextFiles].map(([path, content]) => ({ path, size: content.length, sha256: digest(content) })),
    };
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.endsWith("/current.json")) return Response.json({ schemaVersion: 1, buildId: nextBuildId });
      if (url.endsWith(`/${nextBuildId}/editor-manifest.json`)) return Response.json(nextManifest);
      const path = url.split(`/${nextBuildId}/`)[1];
      if (path) return new Response(nextFiles.get(path) ?? "missing", { status: nextFiles.has(path) ? 200 : 404 });
      return responseFor(url);
    });

    const manager = getEditorReleaseManager(scope);
    await manager.checkForUpdates(true);
    expect(await manager.getUpdateState()).toMatchObject({
      launch: { buildId },
      candidate: { buildId: nextBuildId },
    });

    const next = await resolveEditorRelease(scope);
    expect(next.manifest.buildId).toBe(nextBuildId);
    expect(await manager.getUpdateState()).toMatchObject({ launch: { buildId: nextBuildId } });
    expect((await cacheStorage.keys()).filter((name) => name.startsWith("motajs-editor-release:"))).toEqual([
      `motajs-editor-release:${nextBuildId}`,
    ]);
  });

  it("keeps every build used by a live page and releases it after that page closes", async () => {
    let activeIds = ["old-client"];
    vi.stubGlobal("clients", {
      matchAll: vi.fn(async () => activeIds.map((id) => ({ id, postMessage: vi.fn() }))),
    });
    const background: Promise<unknown>[] = [];
    await resolveEditorRelease(scope, (task) => background.push(task), "old-client");
    await Promise.all(background);

    const nextBuildId = "c".repeat(64);
    const nextFiles = new Map([...files].map(([path, content]) => [path, `${content}-live-next`]));
    const nextManifest: EditorArtifactManifest = {
      ...manifest,
      buildId: nextBuildId,
      files: [...nextFiles].map(([path, content]) => ({ path, size: content.length, sha256: digest(content) })),
    };
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.endsWith("/current.json")) return Response.json({ schemaVersion: 1, buildId: nextBuildId });
      if (url.endsWith(`/${nextBuildId}/editor-manifest.json`)) return Response.json(nextManifest);
      const path = url.split(`/${nextBuildId}/`)[1];
      if (path) return new Response(nextFiles.get(path) ?? "missing", { status: nextFiles.has(path) ? 200 : 404 });
      return responseFor(url);
    });
    const manager = getEditorReleaseManager(scope);
    await manager.checkForUpdates(true);
    activeIds = ["old-client", "new-client"];
    await resolveEditorRelease(scope, undefined, "new-client");
    expect((await cacheStorage.keys()).filter((name) => name.startsWith("motajs-editor-release:")).sort()).toEqual([
      `motajs-editor-release:${buildId}`,
      `motajs-editor-release:${nextBuildId}`,
    ].sort());

    activeIds = ["new-client"];
    await manager.cleanupCaches();
    expect((await cacheStorage.keys()).filter((name) => name.startsWith("motajs-editor-release:"))).toEqual([
      `motajs-editor-release:${nextBuildId}`,
    ]);
  });

  it("reports a failed repair without keeping a fixed previous slot", async () => {
    const background: Promise<unknown>[] = [];
    await resolveEditorRelease(scope, (task) => background.push(task));
    await Promise.all(background);

    const assetUrl = new URL(`static/editor/releases/${buildId}/assets/editor.js`, scope);
    const blobUrl = new URL(`static/editor/.blobs/${digest("editor")}.js`, scope);
    const blobCache = await cacheStorage.open("motajs-editor-blobs");
    await blobCache.delete(blobUrl);

    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url === assetUrl.href) return new Response("corrupt");
      return responseFor(url);
    });

    const response = await serveEditorReleaseAsset(new Request(assetUrl), scope);
    expect(response.status).toBe(503);
    expect(response.headers.get("x-motajs-editor-cache")).toBe("repair-failed");
  });
});
