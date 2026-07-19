import { beforeEach, describe, expect, it, vi } from "vitest";

const projectMocks = vi.hoisted(() => ({
  accessProjectById: vi.fn(),
  invalidateProject: vi.fn(),
}));

vi.mock("./project", () => projectMocks);

import { handleFsRequest, normalizeProjectPath } from "./fsApi";

const formRequest = (operation: string, values: Record<string, string>, method = "POST") => new Request(
  `https://example.test/service/1055/api/fs/${operation}`,
  { method, body: method === "POST" ? new URLSearchParams(values) : undefined },
);

describe("project fs api", () => {
  const files = new Map<string, string>();
  const writeFile = vi.fn(async (path: string, value: string) => {
    files.set(path, value);
  });
  const fs = {
    promises: {
      readFile: vi.fn(async (path: string) => {
        if (!files.has(path)) throw Object.assign(new Error("missing"), { code: "ENOENT" });
        return files.get(path)!;
      }),
      writeFile,
      readdir: vi.fn(async () => [...files.keys()]),
      mkdir: vi.fn(async () => undefined),
      rename: vi.fn(async (src: string, dest: string) => {
        if (!files.has(src)) throw Object.assign(new Error("missing"), { code: "ENOENT" });
        files.set(dest, files.get(src)!);
        files.delete(src);
      }),
      unlink: vi.fn(async (path: string) => { files.delete(path); }),
    },
  };

  beforeEach(() => {
    files.clear();
    writeFile.mockClear();
    projectMocks.accessProjectById.mockResolvedValue({ status: "ready", fs });
  });

  it("round-trips URL encoded text without corrupting special characters", async () => {
    const value = "中文 + % & = spaces";
    const write = await handleFsRequest(1055, "writeFile", formRequest("writeFile", {
      name: "project/data.js",
      type: "utf-8",
      value,
    }));
    expect(write.status).toBe(200);
    expect(files.get("project/data.js")).toBe(value);

    const read = await handleFsRequest(1055, "readFile", formRequest("readFile", {
      name: "project/data.js",
      type: "utf8",
    }));
    expect(await read.text()).toBe(value);
  });

  it("distinguishes an empty file from a missing file", async () => {
    files.set("empty.txt", "");
    const empty = await handleFsRequest(1055, "readFile", formRequest("readFile", {
      name: "empty.txt", type: "utf8",
    }));
    expect(empty.status).toBe(200);
    expect(await empty.text()).toBe("");

    const missing = await handleFsRequest(1055, "readFile", formRequest("readFile", {
      name: "missing.txt", type: "utf8",
    }));
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ error: { code: "file-not-found" } });
  });

  it.each(["../secret", "/absolute", "a\\b", "a/../../b", "bad\u0093name.png"])("rejects unsafe path %s", (path) => {
    expect(() => normalizeProjectPath(path)).toThrow();
  });

  it("validates a multi-file request before writing anything", async () => {
    const response = await handleFsRequest(1055, "writeMultiFiles", formRequest("writeMultiFiles", {
      name: "one;../two",
      value: "YQ==;Yg==",
    }));
    expect(response.status).toBe(400);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("rejects unsupported methods, encodings and missing parameters", async () => {
    expect((await handleFsRequest(1055, "readFile", formRequest("readFile", {}, "GET"))).status).toBe(405);
    expect((await handleFsRequest(1055, "readFile", formRequest("readFile", {
      name: "a", type: "latin1",
    }))).status).toBe(400);
    expect((await handleFsRequest(1055, "writeFile", formRequest("writeFile", {
      name: "a", type: "utf8",
    }))).status).toBe(400);
  });
});
