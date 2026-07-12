/**
 * encoding 单元测试
 *
 * 测试 Base64 编码/解码功能
 */

import { describe, expect, it } from "vitest";
import { decode64, encode64 } from "../encoding";

describe("encoding", () => {
  describe("encode64", () => {
    it("应该正确编码 ASCII 字符串", () => {
      expect(encode64("Hello, World!")).toBe("SGVsbG8sIFdvcmxkIQ==");
    });

    it("应该正确编码中文字符串", () => {
      const encoded = encode64("你好，世界！");
      expect(encoded).toBeTruthy();
      // 验证往返一致性
      expect(decode64(encoded)).toBe("你好，世界！");
    });

    it("应该正确编码混合字符串", () => {
      const original = "Hello, 世界! 🎉";
      const encoded = encode64(original);
      expect(decode64(encoded)).toBe(original);
    });

    it("应该处理空字符串", () => {
      expect(encode64("")).toBe("");
    });

    it("应该处理特殊字符", () => {
      const original = "特殊字符：<>&\"'\\n\\t";
      const encoded = encode64(original);
      expect(decode64(encoded)).toBe(original);
    });

    it("应该正确编码包含换行符的字符串", () => {
      const original = "line1\nline2\nline3";
      const encoded = encode64(original);
      expect(decode64(encoded)).toBe(original);
    });

    it("应该正确编码 JavaScript 代码", () => {
      const code = `function hello() {
  console.log("Hello, 世界!");
  return { name: "测试" };
}`;
      const encoded = encode64(code);
      expect(decode64(encoded)).toBe(code);
    });
  });

  describe("decode64", () => {
    it("应该正确解码标准 Base64", () => {
      expect(decode64("SGVsbG8sIFdvcmxkIQ==")).toBe("Hello, World!");
    });

    it("应该处理空字符串", () => {
      expect(decode64("")).toBe("");
    });

    it("应该支持 URL-safe Base64（- 替换 +）", () => {
      // 标准 Base64 中的 + 在 URL-safe 版本中是 -
      const standard = encode64("test?query=1");
      const urlSafe = standard.replace(/\+/g, "-");
      expect(decode64(urlSafe)).toBe("test?query=1");
    });

    it("应该支持 URL-safe Base64（_ 替换 /）", () => {
      // 标准 Base64 中的 / 在 URL-safe 版本中是 _
      const standard = encode64("test/path");
      const urlSafe = standard.replace(/\//g, "_");
      expect(decode64(urlSafe)).toBe("test/path");
    });

    it("应该忽略空白字符", () => {
      const encoded = encode64("test");
      const withSpaces = encoded.split("").join(" ");
      expect(decode64(withSpaces)).toBe("test");
    });
  });

  describe("往返一致性", () => {
    const testCases = [
      "简单文本",
      "Hello, World!",
      "混合 Mixed テキスト",
      "特殊符号：!@#$%^&*()_+-=[]{}|;':\",./<>?",
      "换行符\n制表符\t",
      "JSON: {\"key\": \"值\"}",
      "emoji: 😀🎉🚀",
      "很长的文本".repeat(100),
    ];

    testCases.forEach((original) => {
      it(`encode64 -> decode64 应该还原: "${original.slice(0, 30)}..."`, () => {
        const encoded = encode64(original);
        const decoded = decode64(encoded);
        expect(decoded).toBe(original);
      });
    });
  });
});
