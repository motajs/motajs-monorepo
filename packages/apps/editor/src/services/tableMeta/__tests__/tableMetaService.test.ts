/**
 * tableMetaService 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { tableMetaService, clearDataHandlerCache } from "../tableMetaService";
import { FileHandlerManager } from "@/fs/FileHandlerManager";
import { FileHandler } from "@/fs/FileHandler";
import { MemoryFileSystem } from "@test/utils/MemoryFileSystem";
import { ContentUtils } from "@/fs/ContentUtils";
import { encode64 } from "@/utils/encoding";

describe("tableMetaService", () => {
  let memoryFs: MemoryFileSystem;

  beforeEach(() => {
    memoryFs = new MemoryFileSystem();
    FileHandlerManager.clear();
    clearDataHandlerCache();
  });

  afterEach(() => {
    FileHandlerManager.clear();
    clearDataHandlerCache();
  });

  /**
   * 辅助函数：设置元数据文件
   */
  async function setupMetaFile(key: "comment", content: string): Promise<void> {
    const path = "_server/table/comment.js";
    // 直接存储原始内容，不需要编码
    memoryFs.setFile(path, content);

    // 创建 FileHandler 并加载
    const handler = new FileHandler(path, memoryFs.createFsInterface());
    await handler.load();

    // 注入到 FileHandlerManager
    (FileHandlerManager as any).handlers.set(path, handler);
  }

  describe("getTableMeta", () => {
    it("应该加载并解析元数据文件", async () => {
      // 准备测试数据
      const testMeta = {
        _type: "object",
        _data: {
          floors: {
            _type: "object",
            _data: {
              floor: { _type: "object", _data: {} },
              loc: { _type: "object", _data: {} },
            },
          },
        },
      };

      const fileContent = `var comment_c456ea59_6018_45ef_8bcc_211a24c627dc = ${JSON.stringify(testMeta)};`;
      await setupMetaFile("comment", fileContent);

      // 执行
      const meta = tableMetaService.getTableMeta("comment");

      // 验证
      expect(meta).toEqual(testMeta);
      expect(meta._data?.floors).toBeDefined();
    });

    it("应该在文件未加载时抛出错误", () => {
      // 执行 & 验证 - 文件未加载时应该抛出错误
      expect(() => tableMetaService.getTableMeta("comment")).toThrow("Comment metadata not available");
    });
  });

  describe("getTableMetaContent", () => {
    it("未加载时应该返回 idle 状态", () => {
      // 执行
      const content = tableMetaService.getTableMetaContent("comment");

      // 验证 - 未加载时 FileHandler 是 idle，DataHandler 的 andThen 会传递 idle 状态
      expect(ContentUtils.isIdle(content)).toBe(true);
    });

    it("加载后应该返回 loaded 状态", async () => {
      // 准备测试数据
      const testMeta = { _type: "object", _data: {} };
      const fileContent = `var comment_c456ea59_6018_45ef_8bcc_211a24c627dc = ${JSON.stringify(testMeta)};`;
      await setupMetaFile("comment", fileContent);

      // 执行
      const content = tableMetaService.getTableMetaContent("comment");

      // 验证
      expect(ContentUtils.isLoaded(content)).toBe(true);
      if (ContentUtils.isLoaded(content)) {
        expect(content.value).toEqual(testMeta);
      }
    });
  });

  describe("getHandler", () => {
    it("应该返回 DataHandler 实例", () => {
      // 执行
      const handler = tableMetaService.getHandler("comment");

      // 验证
      expect(handler).toBeDefined();
      expect(handler.content).toBeDefined();
      expect(typeof handler.content).toBe("function");
    });

    it("多次调用应该返回同一个实例", () => {
      // 执行
      const handler1 = tableMetaService.getHandler("comment");
      const handler2 = tableMetaService.getHandler("comment");

      // 验证
      expect(handler1).toBe(handler2);
    });
  });

  describe("saveTableMeta", () => {
    it("应该保存元数据到文件", async () => {
      // 准备初始数据
      const initialMeta = { _type: "object", _data: {} };
      const fileContent = `var comment_c456ea59_6018_45ef_8bcc_211a24c627dc = ${JSON.stringify(initialMeta)};`;
      await setupMetaFile("comment", fileContent);

      // 准备新数据
      const updatedMeta = {
        _type: "object",
        _data: { newField: "newValue" },
      };

      // 执行
      tableMetaService.saveTableMeta("comment", updatedMeta);

      // 等待持久化
      const handler = tableMetaService.getHandler("comment");
      await handler.waitForIdle();

      // 验证 - 内存中的数据应该立即更新
      const content = tableMetaService.getTableMetaContent("comment");
      expect(ContentUtils.isLoaded(content)).toBe(true);
      if (ContentUtils.isLoaded(content)) {
        expect(content.value).toEqual(updatedMeta);
      }

      // 验证 - 文件应该被更新
      const path = "_server/table/comment.js";
      const savedContent = memoryFs.getFile(path);
      expect(savedContent).toBeDefined();
      if (savedContent) {
        // 文件内容应该包含新数据
        expect(savedContent).toContain("comment_c456ea59_6018_45ef_8bcc_211a24c627dc");
        expect(savedContent).toContain("newField");
        expect(savedContent).toContain("newValue");
      }
    });
  });

  describe("refetch", () => {
    it("应该重新加载文件", async () => {
      // 准备初始数据
      const initialMeta = { _type: "object", _data: { version: 1 } };
      const fileContent = `var comment_c456ea59_6018_45ef_8bcc_211a24c627dc = ${JSON.stringify(initialMeta)};`;
      await setupMetaFile("comment", fileContent);

      // 验证初始数据
      let content = tableMetaService.getTableMetaContent("comment");
      expect(ContentUtils.isLoaded(content)).toBe(true);
      if (ContentUtils.isLoaded(content)) {
        expect(content.value._data).toEqual({ version: 1 });
      }

      // 修改文件（模拟外部修改）
      const updatedMeta = { _type: "object", _data: { version: 2 } };
      const updatedContent = `var comment_c456ea59_6018_45ef_8bcc_211a24c627dc = ${JSON.stringify(updatedMeta)};`;
      const path = "_server/table/comment.js";
      memoryFs.setFile(path, updatedContent);

      // 执行 refetch
      await tableMetaService.refetch("comment");

      // 验证 - 数据应该更新
      content = tableMetaService.getTableMetaContent("comment");
      expect(ContentUtils.isLoaded(content)).toBe(true);
      if (ContentUtils.isLoaded(content)) {
        expect(content.value._data).toEqual({ version: 2 });
      }
    });
  });
});
