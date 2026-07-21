import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  handleFsRequest: vi.fn(),
  serveProjectPreview: vi.fn(),
  networkFirst: vi.fn(),
  cacheFirst: vi.fn(),
  serveProjectEditor: vi.fn(),
  serveEditorUpdateStatus: vi.fn(),
  serveEditorReleaseAsset: vi.fn(),
}));

vi.mock("./fsApi", () => ({ handleFsRequest: mocks.handleFsRequest }));
vi.mock("./preview", () => ({ serveProjectPreview: mocks.serveProjectPreview }));
vi.mock("./cache", () => ({ networkFirst: mocks.networkFirst, cacheFirst: mocks.cacheFirst }));
vi.mock("./editorHost", () => ({
  serveEditorUpdateStatus: mocks.serveEditorUpdateStatus,
  serveProjectEditor: mocks.serveProjectEditor,
}));
vi.mock("./editorRelease", () => ({ serveEditorReleaseAsset: mocks.serveEditorReleaseAsset }));

import { routeRequest } from "./router";

const scope = new URL("https://example.test/app/");

describe("service worker router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.handleFsRequest.mockResolvedValue(new Response("fs"));
    mocks.serveProjectPreview.mockResolvedValue(new Response("preview"));
    mocks.networkFirst.mockResolvedValue(new Response("<html><head></head><body>app</body></html>"));
    mocks.serveProjectEditor.mockResolvedValue(new Response("editor"));
    mocks.serveEditorUpdateStatus.mockResolvedValue(new Response("update"));
    mocks.serveEditorReleaseAsset.mockResolvedValue(new Response("editor-asset"));
  });

  it("routes the project-scoped Editor update capability", async () => {
    const request = new Request("https://example.test/app/service/1055/api/editor-update/");
    expect(await (await routeRequest(request, scope))?.text()).toBe("update");
    expect(mocks.serveEditorUpdateStatus).toHaveBeenCalledWith(request, scope, undefined);
  });

  it("uses the project page as the canonical project URL", async () => {
    const response = await routeRequest(new Request("https://example.test/app/service/1055/?from=list"), scope);
    expect(response?.status).toBe(308);
    expect(response?.headers.get("location")).toBe("https://example.test/app/service/1055/project/?from=list");
  });

  it("serves the shared app shell with the deployment base", async () => {
    const response = await routeRequest(new Request("https://example.test/app/service/1055/project/"), scope);
    expect(await response?.text()).toContain("<base href=\"/app/\">");
  });

  it("routes canonical and preview-compatible file APIs to one handler", async () => {
    const canonical = new Request("https://example.test/app/service/1055/api/fs/readFile", { method: "POST" });
    await routeRequest(canonical, scope);
    expect(mocks.handleFsRequest).toHaveBeenCalledWith(1055, "readFile", canonical);

    const legacy = new Request("https://example.test/app/service/1055/preview/fs/writeFile", { method: "POST" });
    await routeRequest(legacy, scope);
    expect(mocks.handleFsRequest).toHaveBeenCalledWith(1055, "writeFile", legacy);
  });

  it("serves the project editor and redirects its missing trailing slash", async () => {
    const redirect = await routeRequest(new Request("https://example.test/app/service/1055/editor"), scope);
    expect(redirect?.status).toBe(308);
    expect(redirect?.headers.get("location")).toBe("https://example.test/app/service/1055/editor/");

    const request = new Request("https://example.test/app/service/1055/editor/");
    expect(await (await routeRequest(request, scope))?.text()).toBe("editor");
    expect(mocks.serveProjectEditor).toHaveBeenCalledWith(
      request,
      scope,
      1055,
      "https://example.test/app/service/1055/project/",
      undefined,
      undefined,
    );
  });

  it("routes immutable Editor release assets through the release cache", async () => {
    const asset = new Request(`https://example.test/app/static/editor/releases/${"a".repeat(64)}/assets/editor-123.js`);
    expect(await (await routeRequest(asset, scope))?.text()).toBe("editor-asset");
    expect(mocks.serveEditorReleaseAsset).toHaveBeenCalledWith(asset, scope);
  });

  it("redirects old tower URLs to preview while preserving path and query", async () => {
    const response = await routeRequest(new Request("https://example.test/app/tower/1055/project/main.js?v=2"), scope);
    expect(response?.status).toBe(308);
    expect(response?.headers.get("location")).toBe("https://example.test/app/service/1055/preview/project/main.js?v=2");
  });

  it("passes preview resources directly to the project host", async () => {
    const request = new Request("https://example.test/app/service/1055/preview/project/data.js");
    const response = await routeRequest(request, scope);
    expect(await response?.text()).toBe("preview");
    expect(mocks.serveProjectPreview).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 1055,
      projectPath: "project/data.js",
      request,
    }));
    expect(mocks.cacheFirst).not.toHaveBeenCalled();
  });
});
