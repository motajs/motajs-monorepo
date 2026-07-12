/**
 * FileHandler 单元测试
 */

import { describe, it, expect, beforeEach } from "vitest";
import { FileHandler } from "../FileHandler";
import { ContentUtils } from "../ContentUtils";
import { MemoryFileSystem } from "@test/utils/MemoryFileSystem";
import { wait } from "@test/utils/testHelpers";

describe("FileHandler", () => {
  let memoryFs: MemoryFileSystem;

  beforeEach(() => {
    memoryFs = new MemoryFileSystem();
  });

  describe("基础功能", () => {
    it("应该创建 FileHandler 实例", () => {
      const handler = new FileHandler("test.txt", memoryFs.createFsInterface());
      expect(handler).toBeInstanceOf(FileHandler);
      expect(handler.getPath()).toBe("test.txt");
    });

    it("初始状态应该是 idle", () => {
      const handler = new FileHandler("test.txt", memoryFs.createFsInterface());
      const content = handler.getContent();
      expect(ContentUtils.isIdle(content)).toBe(true);
    });

    it("应该能够加载文件", async () => {
      memoryFs.setFile("test.txt", "hello world");
      const handler = new FileHandler("test.txt", memoryFs.createFsInterface());

      await handler.load();

      const content = handler.getContent();
      expect(ContentUtils.isLoaded(content)).toBe(true);
      if (ContentUtils.isLoaded(content)) {
        expect(content.value).toBe("hello world");
      }
    });

    it("文件不存在时应该返回 not-found", async () => {
      const handler = new FileHandler("nonexistent.txt", memoryFs.createFsInterface());

      await handler.load();

      const content = handler.getContent();
      expect(ContentUtils.isNotFound(content)).toBe(true);
    });
  });

  describe("update 方法", () => {
    it("应该同步更新内存", async () => {
      memoryFs.setFile("test.txt", "old");
      const handler = new FileHandler("test.txt",  memoryFs.createFsInterface());
      await handler.load();

      handler.update("new");

      // 立即检查内存（同步）
      const content = handler.getContent();
      expect(ContentUtils.isLoaded(content)).toBe(true);
      if (ContentUtils.isLoaded(content)) {
        expect(content.value).toBe("new");
      }
    });

    it("应该异步落盘", async () => {
      memoryFs.setFile("test.txt", "old");
      const handler = new FileHandler("test.txt",  memoryFs.createFsInterface());
      await handler.load();

      handler.update("new");

      // 等待落盘
      await handler.waitForIdle();

      // 检查文件系统
      expect(memoryFs.getFile("test.txt")).toBe("new");
    });

    it("应该支持同步转换函数", async () => {
      memoryFs.setFile("test.txt", "hello");
      const handler = new FileHandler("test.txt",  memoryFs.createFsInterface());
      await handler.load();

      handler.update((current) => current + " world");

      const content = handler.getContent();
      expect(ContentUtils.isLoaded(content)).toBe(true);
      if (ContentUtils.isLoaded(content)) {
        expect(content.value).toBe("hello world");
      }

      await handler.waitForIdle();
      expect(memoryFs.getFile("test.txt")).toBe("hello world");
    });

    it("应该支持异步转换函数", async () => {
      memoryFs.setFile("test.txt", "hello");
      const handler = new FileHandler("test.txt",  memoryFs.createFsInterface());
      await handler.load();

      await handler.update(async (current) => {
        await wait(10);
        return current + " async";
      });

      const content = handler.getContent();
      expect(ContentUtils.isLoaded(content)).toBe(true);
      if (ContentUtils.isLoaded(content)) {
        expect(content.value).toBe("hello async");
      }

      await handler.waitForIdle();
      expect(memoryFs.getFile("test.txt")).toBe("hello async");
    });
  });

  describe("并发写入", () => {
    it("应该串行化写入操作", async () => {
      memoryFs.setWriteDelay(50); // 模拟慢速写入
      memoryFs.setFile("test.txt", "0");
      const handler = new FileHandler("test.txt",  memoryFs.createFsInterface());
      await handler.load();

      // 并发写入
      handler.update("1");
      handler.update("2");
      handler.update("3");

      await handler.waitForIdle();

      // 最后一次写入应该生效
      expect(memoryFs.getFile("test.txt")).toBe("3");
    });

    it("应该优化写入队列（最多保留 2 个任务）", async () => {
      memoryFs.setWriteDelay(50);
      memoryFs.setFile("test.txt", "0");
      const handler = new FileHandler("test.txt",  memoryFs.createFsInterface());
      await handler.load();

      // 快速连续写入多次
      handler.update("1");
      handler.update("2");
      handler.update("3");
      handler.update("4");
      handler.update("5");

      await handler.waitForIdle();

      // 应该只保留最后一次写入
      expect(memoryFs.getFile("test.txt")).toBe("5");
    });
  });

  describe("signal 自动通知", () => {
    it("应该在内容变化时通知订阅者", async () => {
      memoryFs.setFile("test.txt", "old");
      const handler = new FileHandler("test.txt",  memoryFs.createFsInterface());
      await handler.load();

      const changes: string[] = [];
      const unsubscribe = handler.subscribe((content) => {
        if (ContentUtils.isLoaded(content)) {
          changes.push(content.value);
        }
      });

      handler.update("new1");
      handler.update("new2");

      await handler.waitForIdle();

      // 应该收到所有更新
      expect(changes).toContain("new1");
      expect(changes).toContain("new2");

      unsubscribe();
    });

    it("应该在加载时通知订阅者", async () => {
      memoryFs.setFile("test.txt", "content");
      const handler = new FileHandler("test.txt",  memoryFs.createFsInterface());

      const statuses: string[] = [];
      const unsubscribe = handler.subscribe((content) => {
        statuses.push(content.status);
      });

      await handler.load();

      // 应该收到 idle -> loading -> loaded
      expect(statuses).toContain("idle");
      expect(statuses).toContain("loading");
      expect(statuses).toContain("loaded");

      unsubscribe();
    });
  });

  describe("refetch", () => {
    it("应该重新加载文件", async () => {
      memoryFs.setFile("test.txt", "old");
      const handler = new FileHandler("test.txt",  memoryFs.createFsInterface());
      await handler.load();

      // 修改文件系统中的文件
      memoryFs.setFile("test.txt", "new");

      // 等待 refetch 完成
      await handler.refetch();

      const content = handler.getContent();
      expect(ContentUtils.isLoaded(content)).toBe(true);
      if (ContentUtils.isLoaded(content)) {
        expect(content.value).toBe("new");
      }
    });

    it("refetch 时应该转换到 loading 状态", async () => {
      memoryFs.setFile("test.txt", "content");
      const handler = new FileHandler("test.txt",  memoryFs.createFsInterface());
      await handler.load();

      const statuses: string[] = [];
      const unsubscribe = handler.subscribe((content) => {
        statuses.push(content.status);
      });

      await handler.refetch();

      // 应该包含 loading 状态
      expect(statuses).toContain("loading");

      unsubscribe();
    });
  });

  describe("删除管理", () => {
    it("删除时应该等待写入队列清空", async () => {
      memoryFs.setFile("test.txt", "content");
      memoryFs.setWriteDelay(50); // 模拟慢速写入
      const handler = new FileHandler("test.txt",  memoryFs.createFsInterface());
      await handler.load();

      // 触发一个写入
      handler.update("new content");

      // 立即尝试删除（应该等待写入完成）
      await handler.delete();

      // 文件应该被删除
      expect(memoryFs.hasFile("test.txt")).toBe(false);

      // 状态应该是 not-found
      const content = handler.getContent();
      expect(ContentUtils.isNotFound(content)).toBe(true);
    });

    it("有未保存修改时应该拒绝删除", async () => {
      memoryFs.setFile("test.txt", "content");
      memoryFs.setWriteDelay(100); // 模拟慢速写入
      const handler = new FileHandler("test.txt",  memoryFs.createFsInterface());
      await handler.load();

      // 触发一个写入（不等待完成）
      handler.update("new content");

      // 立即尝试删除（应该失败）
      await expect(handler.delete(false)).rejects.toThrow("unsaved changes");
    });

    it("强制删除应该忽略未保存的修改", async () => {
      memoryFs.setFile("test.txt", "content");
      memoryFs.setWriteDelay(100); // 模拟慢速写入
      const handler = new FileHandler("test.txt",  memoryFs.createFsInterface());
      await handler.load();

      // 触发一个写入（不等待完成）
      handler.update("new content");

      // 强制删除（应该成功）
      await handler.delete(true);

      // 文件应该被删除
      expect(memoryFs.hasFile("test.txt")).toBe(false);
    });

    it("删除后应该阻止新的写入", async () => {
      memoryFs.setFile("test.txt", "content");
      const handler = new FileHandler("test.txt",  memoryFs.createFsInterface());
      await handler.load();

      // 开始删除（不等待完成）
      const deletePromise = handler.delete();

      // 尝试写入（应该失败）
      expect(() => {
        handler.update("new");
      }).toThrow("deletion pending");

      await deletePromise;
    });
  });

  describe("错误处理", () => {
    it("未加载时直接设置值应该创建文件", async () => {
      const handler = new FileHandler("test.txt",  memoryFs.createFsInterface());

      handler.update("new");

      const content = handler.getContent();
      expect(ContentUtils.isLoaded(content)).toBe(true);
      if (ContentUtils.isLoaded(content)) {
        expect(content.value).toBe("new");
      }

      await handler.waitForIdle();
      expect(memoryFs.getFile("test.txt")).toBe("new");
    });

    it("写入失败时不应该影响内存状态", async () => {
      memoryFs.setFile("test.txt", "content");
      const handler = new FileHandler("test.txt",  memoryFs.createFsInterface());
      await handler.load();

      // 创建一个会失败的 fs 接口
      const failingFs = memoryFs.createFsInterface();
      failingFs.promises.writeFile = async () => {
        throw new Error("Write failed");
      };

      // 替换 handler 的 fs（通过私有属性访问）
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (handler as any).fs = failingFs;

      handler.update("new");

      // 等待写入尝试
      await handler.waitForIdle();

      const content = handler.getContent();
      // 注意：持久化失败不应该影响内存状态
      // 内存中的数据仍然有效
      expect(ContentUtils.isLoaded(content)).toBe(true);
      if (ContentUtils.isLoaded(content)) {
        expect(content.value).toBe("new");
      }
    });
  });
});
