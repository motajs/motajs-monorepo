/**
 * CodeEditor 组件测试
 *
 * 测试配置工具函数的实际行为
 */

import { describe, it, expect } from "vitest";
import {
  CODEMIRROR_HINT_OPTIONS,
  DEFAULT_CODEMIRROR_OPTIONS,
  PERSISTENT_SEARCH_KEYS,
  getShortcutKeys,
  commandsName,
} from "../config/commands";

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

  it("keeps search persistent and never auto-commits a single hint", () => {
    expect(PERSISTENT_SEARCH_KEYS).toEqual({
      "Cmd-F": "findPersistent",
      "Ctrl-F": "findPersistent",
    });
    expect(CODEMIRROR_HINT_OPTIONS.completeSingle).toBe(false);
    expect(DEFAULT_CODEMIRROR_OPTIONS.hintOptions).toBe(CODEMIRROR_HINT_OPTIONS);
  });
});
