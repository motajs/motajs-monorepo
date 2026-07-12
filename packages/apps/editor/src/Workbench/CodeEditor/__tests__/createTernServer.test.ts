/**
 * createTernServer 单元测试
 *
 * 测试 Tern Server 工厂函数
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import type { CoreType, DataCommentType, FunctionsType } from "../types";
import type { TernServerInstance } from "../utils/createTernServer";

// Mock codemirror 模块
const mockTernServerConstructor = vi.fn();
const mockDocConstructor = vi.fn();
const mockTernServerInstance = {
  addDoc: vi.fn(),
  delDoc: vi.fn(),
  complete: vi.fn(),
  updateArgHints: vi.fn(),
  showDocs: vi.fn(),
  jumpToDef: vi.fn(),
  rename: vi.fn(),
};

vi.mock("codemirror", () => {
  class MockTernServer {
    constructor(options: unknown) {
      mockTernServerConstructor(options);
      Object.assign(this, mockTernServerInstance);
    }
  }

  class MockDoc {
    value: string;
    mode: string;
    constructor(value: string, mode: string) {
      mockDocConstructor(value, mode);
      this.value = value;
      this.mode = mode;
    }
  }

  return {
    default: {
      Doc: MockDoc,
    },
    TernServer: MockTernServer,
    Doc: MockDoc,
  };
});

// 在 mock 之后导入被测模块
import { addTernDocument, createTernServer } from "../utils/createTernServer";

// 创建 Mock core 对象
function createMockCore(): CoreType {
  return {
    material: {
      enemys: { slime: { name: "史莱姆" } },
      bgms: { bgm1: {} },
      sounds: { attack: {} },
      animates: { explosion: {} },
      images: {},
      items: { key: { name: "钥匙" } },
    },
    status: {
      maps: { MT1: { title: "第一层" } },
      shops: { shop1: { textInList: "商店" } },
      textAttribute: {},
      bgmaps: {},
      fgmaps: {},
    },
    canvas: {},
    values: { hp: 100 },
    flags: { enable: true },
  };
}

// 创建 Mock functions 对象
function createMockFunctions(): FunctionsType {
  return {
    enemys: {
      getSpecials: () => [[1, "先攻"]],
    },
  };
}

// 创建 Mock dataComment 对象
function createMockDataComment(): DataCommentType {
  return {
    _data: {
      values: {
        _data: {
          hp: { _data: "生命值" },
        },
      },
      flags: {
        _data: {
          enable: { _data: "开启" },
        },
      },
    },
  };
}

// 创建 Mock ternDefs
import type * as Tern from "tern";

function createMockTernDefs(): Tern.Def[] {
  return [
    {}, // ternDefs[0]
    {}, // ternDefs[1]
    {
      // ternDefs[2] - coredef
      core: {
        material: {
          enemys: {},
          bgms: {},
          sounds: {},
          animates: {},
          images: {},
          items: {},
        },
        enemys: {
          hasSpecial: { "!doc": "" },
        },
        canvas: {},
        status: {
          maps: {},
          bgmaps: {},
          fgmaps: {},
          shops: {},
          textAttribute: {},
        },
        values: {},
        flags: {},
      },
    },
  ];
}

describe("createTernServer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createTernServer", () => {
    it("应该正确创建 TernServer 实例", () => {
      const mockCore = createMockCore();
      const mockFunctions = createMockFunctions();
      const mockDataComment = createMockDataComment();
      const mockTernDefs = createMockTernDefs();

      const ternServer = createTernServer({
        ternDefs: mockTernDefs,
        core: mockCore,
        functions: mockFunctions,
        dataComment: mockDataComment,
      });

      // 验证 TernServer 构造函数被调用
      expect(mockTernServerConstructor).toHaveBeenCalledTimes(1);

      // 验证返回的实例有正确的方法
      expect(ternServer.addDoc).toBeDefined();
      expect(ternServer.delDoc).toBeDefined();
      expect(ternServer.complete).toBeDefined();
      expect(ternServer.updateArgHints).toBeDefined();
      expect(ternServer.showDocs).toBeDefined();
      expect(ternServer.jumpToDef).toBeDefined();
      expect(ternServer.rename).toBeDefined();
    });

    it("应该使用默认配置", () => {
      createTernServer({
        ternDefs: createMockTernDefs(),
        core: createMockCore(),
        functions: createMockFunctions(),
        dataComment: createMockDataComment(),
      });

      // 验证默认配置
      expect(mockTernServerConstructor).toHaveBeenCalledWith(
        expect.objectContaining({
          plugins: {
            doc_comment: true,
            complete_strings: true,
          },
          useWorker: false,
        })
      );
    });

    it("应该接受自定义服务器配置", () => {
      createTernServer({
        ternDefs: createMockTernDefs(),
        core: createMockCore(),
        functions: createMockFunctions(),
        dataComment: createMockDataComment(),
        serverOptions: {
          useWorker: true,
          docComment: false,
          completeStrings: false,
        },
      });

      expect(mockTernServerConstructor).toHaveBeenCalledWith(
        expect.objectContaining({
          plugins: {
            doc_comment: false,
            complete_strings: false,
          },
          useWorker: true,
        })
      );
    });

    it("不应该修改已经构建好的 ternDefs", () => {
      const mockTernDefs = createMockTernDefs();
      const original = structuredClone(mockTernDefs);

      createTernServer({
        ternDefs: mockTernDefs,
      });

      expect(mockTernDefs).toEqual(original);
    });

    it("应该加载工程合成文档", () => {
      createTernServer({
        ternDefs: createMockTernDefs(),
        documents: [{ name: "project-functions.js", text: "core.test = function () {};" }],
      });

      expect(mockTernServerInstance.addDoc).toHaveBeenCalledWith(
        "project-functions.js",
        expect.anything(),
      );
    });
  });

  describe("addTernDocument", () => {
    it("应该先删除再添加文档", () => {
      const mockTernServer = {
        addDoc: vi.fn(),
        delDoc: vi.fn(),
      } as unknown as TernServerInstance;

      addTernDocument(mockTernServer, "doc", "const x = 1;");

      // 验证调用顺序：先 delDoc，再 addDoc
      expect(mockTernServer.delDoc).toHaveBeenCalledWith("doc");
      expect(mockTernServer.addDoc).toHaveBeenCalled();
    });

    it("应该使用默认 javascript 模式", () => {
      const mockTernServer = {
        addDoc: vi.fn(),
        delDoc: vi.fn(),
      } as unknown as TernServerInstance;

      addTernDocument(mockTernServer, "test", "code");

      expect(mockDocConstructor).toHaveBeenCalledWith("code", "javascript");
    });

    it("应该支持自定义模式", () => {
      const mockTernServer = {
        addDoc: vi.fn(),
        delDoc: vi.fn(),
      } as unknown as TernServerInstance;

      addTernDocument(mockTernServer, "test", "code", "json");

      expect(mockDocConstructor).toHaveBeenCalledWith("code", "json");
    });
  });
});
