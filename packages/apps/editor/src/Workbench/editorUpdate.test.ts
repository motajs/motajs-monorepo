import { afterEach, describe, expect, it, vi } from "vitest";
import type { EditorEnvironment } from "@/environment";
import { checkEditorUpdate, parseEditorUpdateStatus } from "./editorUpdate";

const environment: EditorEnvironment = {
  protocolVersion: 1,
  release: { buildId: "old-build", version: "1.0.0" },
  endpoints: {
    fs: "https://example.test/fs/",
    runtime: "https://example.test/runtime.html",
    preview: "https://example.test/preview/",
    docs: "https://example.test/docs/",
    project: "https://example.test/project/",
    update: "https://example.test/editor-update/",
  },
};

afterEach(() => vi.unstubAllGlobals());

describe("Editor update check", () => {
  it("returns a release only when its build differs from the running build", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({
        protocolVersion: 1,
        status: "ready",
        release: { buildId: "new-build", version: "2.0.0" },
      }))
      .mockResolvedValueOnce(Response.json({
        protocolVersion: 1,
        status: "ready",
        release: environment.release,
      }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(checkEditorUpdate(environment)).resolves.toEqual({ buildId: "new-build", version: "2.0.0" });
    await expect(checkEditorUpdate(environment)).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(environment.endpoints.update, expect.objectContaining({ cache: "no-store" }));
  });

  it("is disabled when the host did not provide the optional capability", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(checkEditorUpdate({
      ...environment,
      endpoints: { ...environment.endpoints, update: undefined },
    })).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects malformed responses", () => {
    expect(() => parseEditorUpdateStatus({ protocolVersion: 2, status: "ready" })).toThrow("不兼容");
    expect(() => parseEditorUpdateStatus({ protocolVersion: 1, status: "ready", release: {} })).toThrow("buildId");
  });
});
