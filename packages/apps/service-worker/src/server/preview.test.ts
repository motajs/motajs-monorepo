import { beforeEach, describe, expect, it, vi } from "vitest";

const projectMocks = vi.hoisted(() => ({
  accessProjectById: vi.fn(),
  invalidateProject: vi.fn(),
}));
vi.mock("./project", () => projectMocks);

import { serveProjectPreview } from "./preview";

const context = (request: Request, projectPath = "media.bin") => ({
  projectId: 1055,
  projectPath,
  request,
  projectUrl: "https://example.test/service/1055/project/",
  rootUrl: "https://example.test/",
});

describe("project preview server", () => {
  const openAsBlob = vi.fn();
  beforeEach(() => {
    openAsBlob.mockResolvedValue(new Blob([new Uint8Array([0, 1, 2, 3, 4, 5])], { type: "application/octet-stream" }));
    projectMocks.accessProjectById.mockResolvedValue({
      status: "ready",
      fs: { openAsBlob, promises: { readFile: vi.fn() } },
    });
  });

  it("serves a single byte range without caching project data", async () => {
    const response = await serveProjectPreview(context(new Request(
      "https://example.test/service/1055/preview/media.bin",
      { headers: { range: "bytes=1-3" } },
    )));
    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe("bytes 1-3/6");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([1, 2, 3]);
  });

  it("supports HEAD with MIME and length headers", async () => {
    const response = await serveProjectPreview(context(new Request(
      "https://example.test/service/1055/preview/image.png",
      { method: "HEAD" },
    ), "image.png"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("content-length")).toBe("6");
    expect(await response.text()).toBe("");
  });

  it("returns structured permission errors for subresources", async () => {
    projectMocks.accessProjectById.mockResolvedValue({ status: "permission-required" });
    const response = await serveProjectPreview(context(new Request(
      "https://example.test/service/1055/preview/main.js",
    ), "main.js"));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "project-permission-required" } });
  });

  it("maps the memfs openAsBlob missing-file wrapper back to a structured 404", async () => {
    openAsBlob.mockRejectedValue(Object.assign(
      new TypeError("Unable to open file as blob"),
      { code: "ERR_INVALID_ARG_VALUE" },
    ));
    const response = await serveProjectPreview(context(new Request(
      "https://example.test/service/1055/preview/missing.png",
    ), "missing.png"));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        code: "file-not-found",
        message: "Unable to open file as blob",
        path: "missing.png",
      },
    });
  });

  it("returns a plain 404 when navigating to a missing preview file", async () => {
    openAsBlob.mockRejectedValue(Object.assign(
      new TypeError("Unable to open file as blob"),
      { code: "ERR_INVALID_ARG_VALUE" },
    ));
    const request = new Request("https://example.test/service/1055/preview/missing.html");
    Object.defineProperty(request, "mode", { value: "navigate" });
    const response = await serveProjectPreview(context(request, "missing.html"));
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("404 not found");
  });
});
