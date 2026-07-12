/**
 * 字符串工具函数单元测试
 */

import { describe, it, expect } from "vitest";
import {
  escapeNewlines,
  unescapeNewlines,
  isFunctionString,
  isJsonStringFormat,
} from "../string";

describe("string utils", () => {
  describe("escapeNewlines", () => {
    it("应该将换行符转换为转义序列", () => {
      expect(escapeNewlines("line1\nline2")).toBe("line1\\nline2");
    });

    it("应该处理多个换行符", () => {
      expect(escapeNewlines("a\nb\nc")).toBe("a\\nb\\nc");
    });

    it("应该处理空字符串", () => {
      expect(escapeNewlines("")).toBe("");
    });

    it("应该处理没有换行符的字符串", () => {
      expect(escapeNewlines("no newlines")).toBe("no newlines");
    });

    it("应该处理 null/undefined", () => {
      expect(escapeNewlines(null as unknown as string)).toBe(null);
      expect(escapeNewlines(undefined as unknown as string)).toBe(undefined);
    });
  });

  describe("unescapeNewlines", () => {
    it("应该将转义序列转换为换行符", () => {
      expect(unescapeNewlines("line1\\nline2")).toBe("line1\nline2");
    });

    it("应该处理多个转义序列", () => {
      expect(unescapeNewlines("a\\nb\\nc")).toBe("a\nb\nc");
    });

    it("应该处理空字符串", () => {
      expect(unescapeNewlines("")).toBe("");
    });

    it("应该处理没有转义序列的字符串", () => {
      expect(unescapeNewlines("no escapes")).toBe("no escapes");
    });

    it("escape 和 unescape 应该互为逆操作", () => {
      const original = "line1\nline2\nline3";
      expect(unescapeNewlines(escapeNewlines(original))).toBe(original);
    });
  });

  describe("isFunctionString", () => {
    it("应该识别以 function 开头的字符串", () => {
      expect(isFunctionString("function() {}")).toBe(true);
      expect(isFunctionString("function test() { return 1; }")).toBe(true);
    });

    it("应该拒绝非函数字符串", () => {
      expect(isFunctionString("not a function")).toBe(false);
      expect(isFunctionString("")).toBe(false);
      expect(isFunctionString("func")).toBe(false);
    });

    it("应该处理非字符串输入", () => {
      expect(isFunctionString(123 as unknown as string)).toBe(false);
      expect(isFunctionString(null as unknown as string)).toBe(false);
    });
  });

  describe("isJsonStringFormat", () => {
    it("应该识别以引号开头的字符串", () => {
      expect(isJsonStringFormat('"hello"')).toBe(true);
      expect(isJsonStringFormat('"function() {}"')).toBe(true);
    });

    it("应该拒绝非引号开头的字符串", () => {
      expect(isJsonStringFormat("hello")).toBe(false);
      expect(isJsonStringFormat("123")).toBe(false);
      expect(isJsonStringFormat("")).toBe(false);
    });

    it("应该处理非字符串输入", () => {
      expect(isJsonStringFormat(123 as unknown as string)).toBe(false);
    });
  });
});
