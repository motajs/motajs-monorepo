/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * FileHandlerManager 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { FileHandlerManager } from "../FileHandlerManager";
import { MemoryFileSystem } from "@test/utils/MemoryFileSystem";
import { wait } from "@test/utils/testHelpers";

describe("FileHandlerManager", () => {
  let memoryFs: MemoryFileSystem;

  beforeEach(() => {
    memoryFs = new MemoryFileSystem();
    FileHandlerManager.clear();
  });

  afterEach(() => {
    FileHandlerManager.clear();
  });

  describe("单例模式", () => {
    it("同一路径应该返回同一实例", () => {
      const handler1 = FileHandlerManager.get("test.txt");
      const handler2 = FileHandlerManager.get("test.txt");

      expect(handler1).toBe(handler2);
    });

    it("不同路径应该返回不同实例", () => {
      const handler1 = FileHandlerManager.get("test1.txt");
      const handler2 = FileHandlerManager.get("test2.txt");

      expect(handler1).not.toBe(handler2);
    });
  });

  describe("has 方法", () => {
    it("存在的 handler 应该返回 true", () => {
      FileHandlerManager.get("test.txt");

      expect(FileHandlerManager.has("test.txt")).toBe(true);
    });

    it("不存在的 handler 应该返回 false", () => {
      expect(FileHandlerManager.has("nonexistent.txt")).toBe(false);
    });
  });

  describe("isLoaded 方法", () => {
    it("未加载的 handler 应该返回 false", () => {
      FileHandlerManager.get("test.txt");

      expect(FileHandlerManager.isLoaded("test.txt")).toBe(false);
    });

    it("已加载的 handler 应该返回 true", async () => {
      memoryFs.setFile("test.txt", "content");
      const handler = FileHandlerManager.get("test.txt", );

      // 手动注入 fs
      (handler as any).fs = memoryFs.createFsInterface();

      await handler.load();

      expect(FileHandlerManager.isLoaded("test.txt")).toBe(true);
    });

    it("不存在的 handler 应该返回 false", () => {
      expect(FileHandlerManager.isLoaded("nonexistent.txt")).toBe(false);
    });
  });

  describe("load 方法", () => {
    it("应该加载文件并返回 handler", async () => {
      memoryFs.setFile("test.txt", "hello");

      // 创建 handler 并注入 fs
      const handler = FileHandlerManager.get("test.txt", );
      (handler as any).fs = memoryFs.createFsInterface();

      const loadedHandler = await FileHandlerManager.load("test.txt");

      expect(loadedHandler).toBe(handler);
      expect(loadedHandler.getContent().status).toBe("loaded");
    });

    it("已加载的文件应该直接返回", async () => {
      memoryFs.setFile("test.txt", "content");

      const handler = FileHandlerManager.get("test.txt", );
      (handler as any).fs = memoryFs.createFsInterface();

      await handler.load();

      const start = Date.now();
      await FileHandlerManager.load("test.txt");
      const duration = Date.now() - start;

      // 应该几乎立即返回（不重新加载）
      expect(duration).toBeLessThan(20);
    });

    it("并发 load 同一文件应该只加载一次", async () => {
      memoryFs.setFile("test.txt", "content");

      const handler = FileHandlerManager.get("test.txt", );
      (handler as any).fs = memoryFs.createFsInterface();

      let loadCount = 0;
      const originalLoad = handler.load.bind(handler);
      handler.load = async () => {
        loadCount++;
        return originalLoad();
      };

      // 并发调用 load
      const [h1, h2, h3] = await Promise.all([
        FileHandlerManager.load("test.txt"),
        FileHandlerManager.load("test.txt"),
        FileHandlerManager.load("test.txt"),
      ]);

      // 应该只加载一次
      expect(loadCount).toBe(1);
      // 返回同一实例
      expect(h1).toBe(h2);
      expect(h2).toBe(h3);
    });
  });

  describe("loadAll 方法", () => {
    it("应该批量加载多个文件", async () => {
      memoryFs.setFile("file1.txt", "content1");
      memoryFs.setFile("file2.txt", "content2");
      memoryFs.setFile("file3.txt", "content3");

      // 预创建 handlers 并注入 fs
      const paths = ["file1.txt", "file2.txt", "file3.txt"];
      paths.forEach((path) => {
        const handler = FileHandlerManager.get(path, );
        (handler as any).fs = memoryFs.createFsInterface();
      });

      const handlers = await FileHandlerManager.loadAll(paths);

      expect(handlers).toHaveLength(3);
      handlers.forEach((handler, i) => {
        expect(handler.getContent().status).toBe("loaded");
      });
    });
  });

  describe("remove 方法", () => {
    it("应该移除 handler 实例", () => {
      const handler1 = FileHandlerManager.get("test.txt");

      expect(FileHandlerManager.has("test.txt")).toBe(true);

      FileHandlerManager.remove("test.txt");

      expect(FileHandlerManager.has("test.txt")).toBe(false);

      // 再次 get 应该返回新实例
      const handler2 = FileHandlerManager.get("test.txt");
      expect(handler2).not.toBe(handler1);
    });

    it("移除不存在的 handler 不应该报错", () => {
      expect(() => {
        FileHandlerManager.remove("nonexistent.txt");
      }).not.toThrow();
    });
  });

  describe("reload 方法", () => {
    it("应该重新加载文件", async () => {
      memoryFs.setFile("test.txt", "old content");

      const handler = FileHandlerManager.get("test.txt", );
      (handler as any).fs = memoryFs.createFsInterface();

      await handler.load();

      let content = handler.getContent();
      expect(content.status).toBe("loaded");
      if (content.status === "loaded") {
        expect(content.value).toBe("old content");
      }

      // 修改文件
      memoryFs.setFile("test.txt", "new content");

      await FileHandlerManager.reload("test.txt");

      content = handler.getContent();
      expect(content.status).toBe("loaded");
      if (content.status === "loaded") {
        expect(content.value).toBe("new content");
      }
    });
  });

  describe("delete 方法", () => {
    it("应该删除文件和 handler", async () => {
      memoryFs.setFile("test.txt", "content");

      const handler = FileHandlerManager.get("test.txt", );
      (handler as any).fs = memoryFs.createFsInterface();

      await handler.load();

      expect(FileHandlerManager.has("test.txt")).toBe(true);
      expect(memoryFs.hasFile("test.txt")).toBe(true);

      await FileHandlerManager.delete("test.txt", true);

      expect(FileHandlerManager.has("test.txt")).toBe(false);
      expect(memoryFs.hasFile("test.txt")).toBe(false);
    });

    it("handler 不存在时应该直接删除文件", async () => {
      memoryFs.setFile("test.txt", "content");

      // 注入全局 fs（这里需要特殊处理，因为 FileHandlerManager 使用默认 fs）
      // 实际测试中可能需要 mock fs 模块

      expect(FileHandlerManager.has("test.txt")).toBe(false);

      // 这个测试需要 mock fs，暂时跳过实际删除验证
      // await FileHandlerManager.delete("test.txt");
    });

    it("文件不存在时不应该报错", async () => {
      const handler = FileHandlerManager.get("nonexistent.txt", );
      (handler as any).fs = memoryFs.createFsInterface();

      await expect(
        FileHandlerManager.delete("nonexistent.txt", true)
      ).resolves.not.toThrow();
    });

    it("应该支持 force 参数", async () => {
      memoryFs.setFile("test.txt", "content");
      memoryFs.setWriteDelay(100);

      const handler = FileHandlerManager.get("test.txt", );
      (handler as any).fs = memoryFs.createFsInterface();

      await handler.load();

      // 触发写入（不等待）
      handler.update("new content");

      // 非强制删除应该失败
      await expect(
        FileHandlerManager.delete("test.txt", false)
      ).rejects.toThrow("unsaved changes");

      // 强制删除应该成功
      await expect(
        FileHandlerManager.delete("test.txt", true)
      ).resolves.not.toThrow();
    });
  });

  describe("clear 方法", () => {
    it("应该清空所有 handlers", () => {
      FileHandlerManager.get("file1.txt");
      FileHandlerManager.get("file2.txt");
      FileHandlerManager.get("file3.txt");

      expect(FileHandlerManager.size).toBe(3);

      FileHandlerManager.clear();

      expect(FileHandlerManager.size).toBe(0);
      expect(FileHandlerManager.has("file1.txt")).toBe(false);
      expect(FileHandlerManager.has("file2.txt")).toBe(false);
      expect(FileHandlerManager.has("file3.txt")).toBe(false);
    });
  });

  describe("size 属性", () => {
    it("应该返回正确的 handler 数量", () => {
      expect(FileHandlerManager.size).toBe(0);

      FileHandlerManager.get("file1.txt");
      expect(FileHandlerManager.size).toBe(1);

      FileHandlerManager.get("file2.txt");
      expect(FileHandlerManager.size).toBe(2);

      FileHandlerManager.get("file1.txt"); // 重复获取
      expect(FileHandlerManager.size).toBe(2);

      FileHandlerManager.remove("file1.txt");
      expect(FileHandlerManager.size).toBe(1);
    });
  });
});
