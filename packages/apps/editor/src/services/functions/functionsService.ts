/**
 * functionsService - 脚本函数服务
 *
 * 管理脚本函数数据（project/functions.js），提供命令式 API
 * 不依赖 React，可在任何 JavaScript 环境使用
 *
 * 核心理念：
 * - 单文件管理：脚本函数数据只有一个文件 project/functions.js
 * - 与 towerService 一致的架构：使用 FileHandler 管理状态
 * - 内存数据源 + 异步落盘
 */

import { produce } from "immer";
import { FileHandlerManager } from "@/fs/FileHandlerManager";
import type { Content } from "@/fs";
import { applyActions, type Action } from "@/utils/action";
import { FunctionsDataHandler, type FunctionsData } from "./FunctionsDataHandler";
import { tableCommands } from "@/project/commands";

/** 脚本函数数据文件路径 */
const FUNCTIONS_DATA_PATH = "project/functions.js";

/**
 * functionsService - 脚本函数服务（命令式 API）
 */
class FunctionsServiceImpl {
  /** 脚本函数数据 DataHandler（单例，懒加载） */
  private dataHandler: FunctionsDataHandler | null = null;

  /**
   * 获取或创建 DataHandler（懒加载）
   */
  private getDataHandler(): FunctionsDataHandler {
    if (!this.dataHandler) {
      const fileHandler = FileHandlerManager.get(FUNCTIONS_DATA_PATH);
      this.dataHandler = new FunctionsDataHandler(fileHandler);
    }
    return this.dataHandler;
  }

  /**
   * 获取脚本函数数据（load 模式：抛出异常）
   *
   * 保证返回数据，如果加载失败则抛出异常
   *
   * 注意：调用者需要先确保文件已加载
   *
   * @example
   * // 在模块顶层或组件初始化时加载
   * await FileHandlerManager.load('project/functions.js');
   *
   * // 然后使用（同步）
   * try {
   *   const data = functionsService.getFunctionsData();
   *   console.log(data.events);
   * } catch (err) {
   *   console.error('加载失败:', err);
   * }
   */
  getFunctionsData(): FunctionsData {
    return this.getDataHandler().unwrap();
  }

  /**
   * 获取脚本函数数据（Content 模式：返回所有状态）
   *
   * 返回 Content<FunctionsData>，包含所有可能的状态
   *
   * @example
   * const content = functionsService.getFunctionsDataContent();
   * match(content)
   *   .with({ status: 'loaded' }, (c) => console.log(c.value.events))
   *   .with({ status: 'loading' }, () => console.log('Loading...'))
   *   .otherwise(() => {});
   */
  getFunctionsDataContent(): Content<FunctionsData> {
    return this.getDataHandler().getContent();
  }

  /**
   * 获取 DataHandler（用于直接访问 signal）
   *
   * 返回数据层的 DataHandler，可以直接访问 signal 或订阅变化
   *
   * @example
   * // 非 React 环境：直接访问 signal
   * const handler = functionsService.getHandler();
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
   * 保存脚本函数数据修改
   *
   * 应用 actions 到脚本函数数据，立即更新内存并异步落盘
   *
   * 使用 immer 保证不可变性
   *
   * 注意：调用者需要先确保文件已加载
   *
   * @example
   * functionsService.saveFunctionsData([
   *   ['change', "['events']['afterChangeLight']", 'function afterChangeLight() { ... }']
   * ]);
   */
  saveFunctionsData(actions: Action[]): void {
    if (actions.length === 0) {
      return;
    }

    void tableCommands.patchFunctions(actions);
  }

  /**
   * 重新加载脚本函数数据（从文件重新读取）
   *
   * @example
   * await functionsService.refetch();
   */
  async refetch(): Promise<void> {
    return FileHandlerManager.reload(FUNCTIONS_DATA_PATH);
  }

  /**
   * 预览变更后的内容（不实际写入）
   *
   * 使用 immer 保证不修改原数据
   *
   * @example
   * const preview = functionsService.previewChanges([
   *   ['change', "['events']['afterChangeLight']", 'function afterChangeLight() { ... }']
   * ]);
   * console.log(preview.events.afterChangeLight);
   */
  previewChanges(actions: Action[]): FunctionsData {
    const currentData = this.getFunctionsData();
    return produce(currentData, (draft) => {
      applyActions(draft as unknown as Record<string, unknown>, actions);
    });
  }
}

// 导出单例
export const functionsService = new FunctionsServiceImpl();
