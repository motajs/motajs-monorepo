/**
 * Tern Server 工厂函数
 *
 * 创建并初始化 Tern.js 服务器实例，用于代码编辑器的智能提示和自动补全。
 */

import CodeMirror, { TernServer } from "codemirror";
import * as TernRuntime from "tern";
import type * as Tern from "tern";
import type { TernDefinitionDocument } from "@/project/model/projectModel";

/**
 * Tern Server 配置选项
 */
export interface TernServerOptions {
  /** 是否使用 Web Worker */
  useWorker?: boolean;
  /** 是否启用文档注释插件 */
  docComment?: boolean;
  /** 是否启用字符串补全插件 */
  completeStrings?: boolean;
}

/**
 * TernServer 实例类型别名
 * 直接使用 @types/codemirror 提供的类型
 */
export type TernServerInstance = TernServer;

/**
 * 创建 Tern Server 实例
 *
 * 接收 ProjectModel 已经构建好的 defs 和合成文档，创建 TernServer 实例。
 *
 * @param options - 创建选项
 * @param options.ternDefs - 已克隆并扩展的 Tern 定义数组
 * @param options.documents - 工程函数和插件的合成文档
 * @param options.serverOptions - 可选的服务器配置
 * @returns 初始化好的 TernServer 实例
 *
 * @example
 * ```ts
 * const ternServer = createTernServer({
 *   ternDefs: bundle.defs,
 *   documents: bundle.documents,
 * });
 * ```
 */
export function createTernServer(options: {
  ternDefs: Tern.Def[];
  documents?: TernDefinitionDocument[];
  serverOptions?: TernServerOptions;
}): TernServerInstance {
  const {
    ternDefs,
    documents = [],
    serverOptions = {},
  } = options;

  const {
    useWorker = false,
    docComment = true,
    completeStrings = true,
  } = serverOptions;

  // CodeMirror 5's tern addon still resolves the engine from a global.
  const globalRecord = globalThis as typeof globalThis & { tern?: typeof TernRuntime };
  globalRecord.tern ??= TernRuntime;

  // 创建 TernServer 实例
  const ternServer = new TernServer({
    defs: ternDefs,
    plugins: {
      doc_comment: docComment,
      complete_strings: completeStrings,
    } as unknown as Tern.ConstructorOptions["plugins"],
    useWorker,
  });

  for (const document of documents) {
    ternServer.addDoc(document.name, new CodeMirror.Doc(document.text, "javascript"));
  }

  return ternServer;
}

/**
 * 为 TernServer 添加新文档
 *
 * @param ternServer - TernServer 实例
 * @param name - 文档名称
 * @param value - 文档内容
 * @param mode - 文档模式，默认 'javascript'
 */
export function addTernDocument(
  ternServer: TernServerInstance,
  name: string,
  value: string,
  mode = "javascript"
): void {
  ternServer.delDoc(name);
  ternServer.addDoc(name, new CodeMirror.Doc(value, mode));
}
