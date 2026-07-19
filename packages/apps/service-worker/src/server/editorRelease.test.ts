import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  parseEditorChannel,
  parseEditorManifest,
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

  it("loads the network release, promotes a verified complete cache, and falls back offline", async () => {
    const background: Promise<unknown>[] = [];
    const online = await resolveEditorRelease(scope, (task) => background.push(task));
    expect(online.source).toBe("network");
    expect(online.releaseRoot.href).toBe(`https://example.test/server/static/editor/releases/${buildId}/`);
    await Promise.all(background);

    vi.mocked(fetch).mockClear();
    const validated = await resolveEditorRelease(scope);
    expect(validated.source).toBe("validated-cache");
    expect(validated.html).toBe(files.get("index.html"));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch).mock.calls[0]?.[1]).toMatchObject({ cache: "no-cache" });

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
    const releaseCache = await cacheStorage.open(`motajs-editor-release:${buildId}`);
    await releaseCache.delete(assetUrl);

    vi.mocked(fetch).mockClear();
    const response = await serveEditorReleaseAsset(new Request(assetUrl), scope);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("editor");
    expect(await (await releaseCache.match(assetUrl))?.text()).toBe("editor");
  });

  it("demotes a promoted release when a missing asset cannot be repaired safely", async () => {
    const background: Promise<unknown>[] = [];
    await resolveEditorRelease(scope, (task) => background.push(task));
    await Promise.all(background);

    const assetUrl = new URL(`static/editor/releases/${buildId}/assets/editor.js`, scope);
    const releaseCache = await cacheStorage.open(`motajs-editor-release:${buildId}`);
    await releaseCache.delete(assetUrl);

    const previousBuildId = "b".repeat(64);
    const previousRoot = new URL(`static/editor/releases/${previousBuildId}/`, scope);
    const previousCache = await cacheStorage.open(`motajs-editor-release:${previousBuildId}`);
    await previousCache.put(
      new URL("editor-manifest.json", previousRoot),
      Response.json({ ...manifest, buildId: previousBuildId }),
    );
    await previousCache.put(new URL("index.html", previousRoot), new Response("previous editor"));
    const metaCache = await cacheStorage.open("motajs-editor-meta");
    await metaCache.put(
      new URL("static/editor/.host-state", scope),
      Response.json({ current: buildId, previous: previousBuildId }),
    );

    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url === assetUrl.href) return new Response("corrupt");
      return responseFor(url);
    });

    const response = await serveEditorReleaseAsset(new Request(assetUrl), scope);
    expect(response.status).toBe(503);
    expect(response.headers.get("x-motajs-editor-cache")).toBe("repair-failed");

    vi.mocked(fetch).mockRejectedValue(new Error("offline"));
    const fallback = await resolveEditorRelease(scope);
    expect(fallback.source).toBe("cache");
    expect(fallback.manifest.buildId).toBe(previousBuildId);
    expect(fallback.html).toBe("previous editor");
  });
});
