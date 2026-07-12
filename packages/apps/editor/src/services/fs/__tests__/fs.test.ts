/**
 * fs 模块单元测试
 *
 * 这些测试用于固定原有 fs.ts API 的行为
 * 重构过程中不得修改这些测试，以确保重构前后行为一致
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fs } from "../fs";

// Mock window for tests
const mockWindow = { main: null };
vi.stubGlobal("window", mockWindow);

const mockFetch = vi.fn();

function createFetchResponse(payload: string, ok: boolean = true, status: number = 200) {
  return {
    ok,
    status,
    text: async () => payload,
  } as Response;
}

describe("fs module - 原有 API 行为测试", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe("fs.readFile", () => {
    it("应该使用 utf-8 编码读取文件", async () => {
      const mockContent = "Hello, World!";
      mockFetch.mockResolvedValueOnce(createFetchResponse(mockContent));
      const callbackPromise = new Promise<{ err: string | null; data?: string }>((resolve) => {
        fs.readFile("test.txt", "utf-8", (err, data) => {
          resolve({ err, data });
        });
      });

      expect(mockFetch).toHaveBeenCalledWith(
        new URL("/readFile", document.baseURI).href,
        expect.objectContaining({
          method: "POST",
          body: "type=utf8&name=test.txt",
        }),
      );

      const result = await callbackPromise;
      expect(result.err).toBeNull();
      expect(result.data).toBe(mockContent);
    });

    it("应该使用 base64 编码读取文件", async () => {
      const mockContent = "SGVsbG8sIFdvcmxkIQ==";
      mockFetch.mockResolvedValueOnce(createFetchResponse(mockContent));
      const callbackPromise = new Promise<{ err: string | null; data?: string }>((resolve) => {
        fs.readFile("image.png", "base64", (err, data) => {
          resolve({ err, data });
        });
      });

      expect(mockFetch).toHaveBeenCalledWith(
        new URL("/readFile", document.baseURI).href,
        expect.objectContaining({
          method: "POST",
          body: "type=base64&name=image.png",
        }),
      );

      const result = await callbackPromise;
      expect(result.err).toBeNull();
      expect(result.data).toBe(mockContent);
    });

    it("应该在 filename 不是字符串时抛出错误", () => {
      expect(() => {
        // @ts-expect-error - 测试无效输入
        fs.readFile(123, "utf-8", () => {});
      }).toThrow("Type Error in fs.readFile");
    });

    it("应该在 encoding 无效时抛出错误", () => {
      expect(() => {
        // @ts-expect-error - 测试无效输入
        fs.readFile("test.txt", "invalid", () => {});
      }).toThrow("Type Error in fs.readFile");
    });

    it("应该在服务器返回 error: 前缀时传递错误", async () => {
      mockFetch.mockResolvedValueOnce(createFetchResponse("error: File not found"));
      const callbackPromise = new Promise<{ err: string | null; data?: string }>((resolve) => {
        fs.readFile("notfound.txt", "utf-8", (err, data) => {
          resolve({ err, data });
        });
      });

      const result = await callbackPromise;
      expect(result.err).toBe("error: File not found");
      expect(result.data).toBeNull();
    });

    it("应该在 HTTP 错误时调用回调并传递错误信息", async () => {
      mockFetch.mockResolvedValueOnce(createFetchResponse("", false, 500));
      const callbackPromise = new Promise<{ err: string | null }>((resolve) => {
        fs.readFile("test.txt", "utf-8", (err) => {
          resolve({ err });
        });
      });

      const result = await callbackPromise;
      expect(result.err).toContain("HTTP 500");
    });

    it("应该在连接错误时调用回调并传递错误信息", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Error on Connection"));
      const callbackPromise = new Promise<{ err: string | null }>((resolve) => {
        fs.readFile("test.txt", "utf-8", (err) => {
          resolve({ err });
        });
      });

      const result = await callbackPromise;
      expect(result.err).toContain("Error on Connection");
    });
  });

  describe("fs.writeFile", () => {
    it("应该使用 utf-8 编码写入文件", async () => {
      mockFetch.mockResolvedValueOnce(createFetchResponse("success"));
      const callbackPromise = new Promise<{ err: string | null }>((resolve) => {
        fs.writeFile("test.txt", "Hello, World!", "utf-8", (err) => {
          resolve({ err });
        });
      });

      expect(mockFetch).toHaveBeenCalledWith(
        new URL("/writeFile", document.baseURI).href,
        expect.objectContaining({
          method: "POST",
          body: "type=utf8&name=test.txt&value=Hello%2C+World%21",
        }),
      );

      const result = await callbackPromise;
      expect(result.err).toBeNull();
    });

    it("应该使用 base64 编码写入文件", async () => {
      mockFetch.mockResolvedValueOnce(createFetchResponse("success"));
      const callbackPromise = new Promise<{ err: string | null }>((resolve) => {
        fs.writeFile("image.png", "SGVsbG8=", "base64", (err) => {
          resolve({ err });
        });
      });

      expect(mockFetch).toHaveBeenCalledWith(
        new URL("/writeFile", document.baseURI).href,
        expect.objectContaining({
          method: "POST",
          body: "type=base64&name=image.png&value=SGVsbG8%3D",
        }),
      );

      const result = await callbackPromise;
      expect(result.err).toBeNull();
    });

    it("应该在 filename 不是字符串时抛出错误", () => {
      expect(() => {
        // @ts-expect-error - 测试无效输入
        fs.writeFile(123, "content", "utf-8", () => {});
      }).toThrow("Type Error in fs.writeFile");
    });

    it("应该在 datastr 不是字符串时抛出错误", () => {
      expect(() => {
        // @ts-expect-error - 测试无效输入
        fs.writeFile("test.txt", 123, "utf-8", () => {});
      }).toThrow("Type Error in fs.writeFile");
    });

    it("应该在 encoding 无效时抛出错误", () => {
      expect(() => {
        // @ts-expect-error - 测试无效输入
        fs.writeFile("test.txt", "content", "invalid", () => {});
      }).toThrow("Type Error in fs.writeFile");
    });
  });

  describe("fs.writeMultiFiles", () => {
    it("应该批量写入多个文件", async () => {
      mockFetch.mockResolvedValueOnce(createFetchResponse("success"));
      const callbackPromise = new Promise<{ err: string | null }>((resolve) => {
        fs.writeMultiFiles(["file1.txt", "file2.txt"], ["content1", "content2"], (err) => {
          resolve({ err });
        });
      });

      expect(mockFetch).toHaveBeenCalledWith(
        new URL("/writeMultiFiles", document.baseURI).href,
        expect.objectContaining({
          method: "POST",
          body: "name=file1.txt%3Bfile2.txt&value=content1%3Bcontent2",
        }),
      );

      const result = await callbackPromise;
      expect(result.err).toBeNull();
    });
  });

  describe("fs.readdir", () => {
    it("应该读取目录内容", async () => {
      const mockFiles = ["file1.txt", "file2.txt", "subdir"];
      mockFetch.mockResolvedValueOnce(createFetchResponse(JSON.stringify(mockFiles)));
      const callbackPromise = new Promise<{ err: string | null; data?: string[] }>((resolve) => {
        fs.readdir("path/to/dir", (err, data) => {
          resolve({ err, data });
        });
      });

      expect(mockFetch).toHaveBeenCalledWith(
        new URL("/listFile", document.baseURI).href,
        expect.objectContaining({
          method: "POST",
          body: "name=path%2Fto%2Fdir",
        }),
      );

      const result = await callbackPromise;
      expect(result.err).toBeNull();
      expect(result.data).toEqual(mockFiles);
    });

    it("应该在 path 不是字符串时抛出错误", () => {
      expect(() => {
        // @ts-expect-error - 测试无效输入
        fs.readdir(123, () => {});
      }).toThrow("Type Error in fs.readdir");
    });

    it("应该在返回无效 JSON 时传递错误", async () => {
      mockFetch.mockResolvedValueOnce(createFetchResponse("invalid json"));
      const callbackPromise = new Promise<{ err: string | null; data?: unknown }>((resolve) => {
        fs.readdir("path/to/dir", (err, data) => {
          resolve({ err, data });
        });
      });

      const result = await callbackPromise;
      expect(result.err).toBe("Invalid /listFile");
      expect(result.data).toBeNull();
    });
  });

  describe("fs.mkdir", () => {
    it("应该创建目录", async () => {
      mockFetch.mockResolvedValueOnce(createFetchResponse("success"));
      const callbackPromise = new Promise<{ err: string | null }>((resolve) => {
        fs.mkdir("path/to/new/dir", (err) => {
          resolve({ err });
        });
      });

      expect(mockFetch).toHaveBeenCalledWith(
        new URL("/makeDir", document.baseURI).href,
        expect.objectContaining({
          method: "POST",
          body: "name=path%2Fto%2Fnew%2Fdir",
        }),
      );

      const result = await callbackPromise;
      expect(result.err).toBeNull();
    });

    it("应该在 path 不是字符串时抛出错误", () => {
      expect(() => {
        // @ts-expect-error - 测试无效输入
        fs.mkdir(123, () => {});
      }).toThrow("Type Error in fs.readdir");
    });
  });

  describe("fs.moveFile", () => {
    it("应该移动文件", async () => {
      mockFetch.mockResolvedValueOnce(createFetchResponse("success"));
      const callbackPromise = new Promise<{ err: string | null }>((resolve) => {
        fs.moveFile("old/path.txt", "new/path.txt", (err) => {
          resolve({ err });
        });
      });

      expect(mockFetch).toHaveBeenCalledWith(
        new URL("/moveFile", document.baseURI).href,
        expect.objectContaining({
          method: "POST",
          body: "src=old%2Fpath.txt&dest=new%2Fpath.txt",
        }),
      );

      const result = await callbackPromise;
      expect(result.err).toBeNull();
    });

    it("应该在 src 不是字符串时抛出错误", () => {
      expect(() => {
        // @ts-expect-error - 测试无效输入
        fs.moveFile(123, "dest.txt", () => {});
      }).toThrow("Type Error in fs.readdir");
    });

    it("应该在 dest 不是字符串时抛出错误", () => {
      expect(() => {
        // @ts-expect-error - 测试无效输入
        fs.moveFile("src.txt", 123, () => {});
      }).toThrow("Type Error in fs.readdir");
    });
  });

  describe("fs.deleteFile", () => {
    it("应该删除文件", async () => {
      mockFetch.mockResolvedValueOnce(createFetchResponse("success"));
      const callbackPromise = new Promise<{ err: string | null }>((resolve) => {
        fs.deleteFile("path/to/file.txt", (err) => {
          resolve({ err });
        });
      });

      expect(mockFetch).toHaveBeenCalledWith(
        new URL("/deleteFile", document.baseURI).href,
        expect.objectContaining({
          method: "POST",
          body: "name=path%2Fto%2Ffile.txt",
        }),
      );

      const result = await callbackPromise;
      expect(result.err).toBeNull();
    });

    it("应该在 path 不是字符串时抛出错误", () => {
      expect(() => {
        // @ts-expect-error - 测试无效输入
        fs.deleteFile(123, () => {});
      }).toThrow("Type Error in fs.readdir");
    });
  });
});

// ==================== Promise API 测试 ====================
describe("fs.promises API 测试", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe("fs.promises.readFile", () => {
    it("应该返回 Promise 并解析文件内容", async () => {
      const mockContent = "Hello, World!";
      mockFetch.mockResolvedValueOnce(createFetchResponse(mockContent));
      const promise = fs.promises.readFile("test.txt", "utf-8");

      const result = await promise;
      expect(result).toBe(mockContent);
    });

    it("应该在错误时 reject Promise", async () => {
      mockFetch.mockResolvedValueOnce(createFetchResponse("error: File not found"));
      const promise = fs.promises.readFile("test.txt", "utf-8");

      await expect(promise).rejects.toThrow("error: File not found");
    });
  });

  describe("fs.promises.readFileBinary", () => {
    it("应该返回 ArrayBuffer", async () => {
      const base64 = "SGVsbG8=";
      mockFetch.mockResolvedValueOnce(createFetchResponse(base64));
      const promise = fs.promises.readFileBinary("test.bin");

      const result = await promise;
      expect(result).toBeInstanceOf(ArrayBuffer);
      expect(new TextDecoder().decode(result)).toBe("Hello");
    });
  });

  describe("fs.promises.writeFile", () => {
    it("应该返回 Promise 并成功写入", async () => {
      mockFetch.mockResolvedValueOnce(createFetchResponse("success"));
      const promise = fs.promises.writeFile("test.txt", "content", "utf-8");

      // void 方法返回的 Promise 解析为 undefined 或服务器响应
      await expect(promise).resolves.toBeDefined();
    });
  });

  describe("fs.promises.readdir", () => {
    it("应该返回 Promise 并解析目录内容", async () => {
      const mockFiles = ["file1.txt", "file2.txt"];
      mockFetch.mockResolvedValueOnce(createFetchResponse(JSON.stringify(mockFiles)));
      const promise = fs.promises.readdir("path/to/dir");

      const result = await promise;
      expect(result).toEqual(mockFiles);
    });
  });

  describe("fs.promises.mkdir", () => {
    it("应该返回 Promise 并成功创建目录", async () => {
      mockFetch.mockResolvedValueOnce(createFetchResponse("success"));
      const promise = fs.promises.mkdir("path/to/new/dir");

      await expect(promise).resolves.toBeDefined();
    });
  });

  describe("fs.promises.moveFile", () => {
    it("应该返回 Promise 并成功移动文件", async () => {
      mockFetch.mockResolvedValueOnce(createFetchResponse("success"));
      const promise = fs.promises.moveFile("old.txt", "new.txt");

      await expect(promise).resolves.toBeDefined();
    });
  });

  describe("fs.promises.deleteFile", () => {
    it("应该返回 Promise 并成功删除文件", async () => {
      mockFetch.mockResolvedValueOnce(createFetchResponse("success"));
      const promise = fs.promises.deleteFile("file.txt");

      await expect(promise).resolves.toBeDefined();
    });
  });
});
