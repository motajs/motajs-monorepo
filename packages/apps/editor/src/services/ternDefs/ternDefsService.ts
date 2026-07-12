/**
 * ternDefsService - Tern 类型定义服务
 *
 * 管理 Tern 类型定义数据（_server/CodeMirror/defs.js），提供命令式 API
 * 不依赖 React，可在任何 JavaScript 环境使用
 *
 * 核心理念：
 * - 单文件管理：Tern 定义数据只有一个文件 _server/CodeMirror/defs.js
 * - 与 functionsService 一致的架构：使用 FileHandler 管理状态
 * - 只读服务：Tern 定义数据不需要修改
 */

import { FileHandlerManager } from "@/fs/FileHandlerManager";
import type { Content } from "@/fs";
import { TernDefsDataHandler, type TernDefsData } from "./TernDefsDataHandler";

/** Tern 定义数据文件路径 */
const TERN_DEFS_DATA_PATH = "_server/CodeMirror/defs.js";

/**
 * ternDefsService - Tern 类型定义服务（命令式 API）
 */
class TernDefsServiceImpl {
  /** Tern 定义数据 DataHandler（单例，懒加载） */
  private dataHandler: TernDefsDataHandler | null = null;

  /**
   * 获取或创建 DataHandler（懒加载）
   */
  private getDataHandler(): TernDefsDataHandler {
    if (!this.dataHandler) {
      const fileHandler = FileHandlerManager.get(TERN_DEFS_DATA_PATH);
      this.dataHandler = new TernDefsDataHandler(fileHandler);
    }
    return this.dataHandler;
  }

  /**
   * 获取 Tern 定义数据（load 模式：抛出异常）
   *
   * 保证返回数据，如果加载失败则抛出异常
   *
   * 注意：调用者需要先确保文件已加载
   *
   * @example
   * // 在模块顶层或组件初始化时加载
   * await FileHandlerManager.load('_server/CodeMirror/defs.js');
   *
   * // 然后使用（同步）
   * try {
   *   const defs = ternDefsService.getTernDefs();
   *   console.log(defs.length);
   * } catch (err) {
   *   console.error('加载失败:', err);
   * }
   */
  getTernDefs(): TernDefsData {
    return this.getDataHandler().unwrap();
  }

  /**
   * 获取 Tern 定义数据（Content 模式：返回所有状态）
   *
   * 返回 Content<TernDefsData>，包含所有可能的状态
   *
   * @example
   * const content = ternDefsService.getTernDefsContent();
   * match(content)
   *   .with({ status: 'loaded' }, (c) => console.log(c.value.length))
   *   .with({ status: 'loading' }, () => console.log('Loading...'))
   *   .otherwise(() => {});
   */
  getTernDefsContent(): Content<TernDefsData> {
    return this.getDataHandler().getContent();
  }

  /**
   * 获取 DataHandler（用于直接访问 signal）
   *
   * 返回数据层的 DataHandler，可以直接访问 signal 或订阅变化
   *
   * @example
   * // 非 React 环境：直接访问 signal
   * const handler = ternDefsService.getHandler();
   * const content = handler.content();
   *
   * // 订阅变化
   * const dispose = handler.subscribe(content => {
   *   console.log('content changed:', content);
   * });
   */
  getHandler() {
    return this.getDataHandler();
  }

  /**
   * 重新加载 Tern 定义数据（从文件重新读取）
   *
   * @example
   * await ternDefsService.refetch();
   */
  async refetch(): Promise<void> {
    return FileHandlerManager.reload(TERN_DEFS_DATA_PATH);
  }
}

// 导出单例
export const ternDefsService = new TernDefsServiceImpl();
