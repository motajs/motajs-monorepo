/**
 * CodeEditor 组件测试
 *
 * 测试配置工具函数的实际行为
 */

import { describe, it, expect } from "vitest";
import { getShortcutKeys, commandsName } from "../config/commands";

describe("CodeEditor Component Utilities", () => {
  describe("getShortcutKeys", () => {
    it("should return keys that all exist in commandsName", () => {
      const keys = getShortcutKeys();
      keys.forEach((key) => {
        expect(commandsName[key]).toBeDefined();
        expect(typeof commandsName[key]).toBe("string");
      });
    });
  });
});
