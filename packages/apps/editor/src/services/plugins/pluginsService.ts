/**
 * pluginsService - 插件服务
 *
 * 管理插件数据（project/plugins.js），提供命令式 API
 * 不依赖 React，可在任何 JavaScript 环境使用
 *
 * 核心理念：
 * - 单文件管理：插件数据只有一个文件 project/plugins.js
 * - 与 functionsService 一致的架构：使用 FileHandler 管理状态
 * - 内存数据源 + 异步落盘
 */

import { produce } from "immer";
import { FileHandlerManager } from "@/fs/FileHandlerManager";
import type { Content } from "@/fs";
import { applyActions, type Action } from "@/utils/action";
import { PluginsDataHandler, type PluginsData } from "./PluginsDataHandler";
import { tableCommands } from "@/project/commands";

/** 插件数据文件路径 */
const PLUGINS_DATA_PATH = "project/plugins.js";

/**
 * pluginsService - 插件服务（命令式 API）
 */
class PluginsServiceImpl {
  /** 插件数据 DataHandler（单例，懒加载） */
  private dataHandler: PluginsDataHandler | null = null;

  /**
   * 获取或创建 DataHandler（懒加载）
   */
  private getDataHandler(): PluginsDataHandler {
    if (!this.dataHandler) {
      const fileHandler = FileHandlerManager.get(PLUGINS_DATA_PATH);
      this.dataHandler = new PluginsDataHandler(fileHandler);
    }
    return this.dataHandler;
  }

  /**
   * 获取插件数据（load 模式：抛出异常）
   *
   * 保证返回数据，如果加载失败则抛出异常
   *
   * 注意：调用者需要先确保文件已加载
   *
   * @example
   * // 在模块顶层或组件初始化时加载
   * await FileHandlerManager.load('project/plugins.js');
   *
   * // 然后使用（同步）
   * try {
   *   const data = pluginsService.getPluginsData();
   *   console.log(data.init);
   * } catch (err) {
   *   console.error('加载失败:', err);
   * }
   */
  getPluginsData(): PluginsData {
    return this.getDataHandler().unwrap();
  }

  /**
   * 获取插件数据（Content 模式：返回所有状态）
   *
   * 返回 Content<PluginsData>，包含所有可能的状态
   *
   * @example
   * const content = pluginsService.getPluginsDataContent();
   * match(content)
   *   .with({ status: 'loaded' }, (c) => console.log(c.value.init))
   *   .with({ status: 'loading' }, () => console.log('Loading...'))
   *   .otherwise(() => {});
   */
  getPluginsDataContent(): Content<PluginsData> {
    return this.getDataHandler().getContent();
  }

  /**
   * 获取 DataHandler（用于直接访问 signal）
   *
   * 返回数据层的 DataHandler，可以直接访问 signal 或订阅变化
   *
   * @example
   * // 非 React 环境：直接访问 signal
   * const handler = pluginsService.getHandler();
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
   * 保存插件数据修改
   *
   * 应用 actions 到插件数据，立即更新内存并异步落盘
   *
   * 使用 immer 保证不可变性
   *
   * 注意：调用者需要先确保文件已加载
   *
   * @example
   * pluginsService.savePluginsData([
   *   ['change', "['init']", 'function init() { ... }']
   * ]);
   */
  savePluginsData(actions: Action[]): void {
    if (actions.length === 0) {
      return;
    }

    void tableCommands.patchPlugins(actions);
  }

  /**
   * 重新加载插件数据（从文件重新读取）
   *
   * @example
   * await pluginsService.refetch();
   */
  async refetch(): Promise<void> {
    return FileHandlerManager.reload(PLUGINS_DATA_PATH);
  }

  /**
   * 预览变更后的内容（不实际写入）
   *
   * 使用 immer 保证不修改原数据
   *
   * @example
   * const preview = pluginsService.previewChanges([
   *   ['change', "['init']", 'function init() { ... }']
   * ]);
   * console.log(preview.init);
   */
  previewChanges(actions: Action[]): PluginsData {
    // 获取当前数据
    const currentData = this.getPluginsData();

    // 使用 immer 创建草稿并应用 actions
    return produce(currentData, (draft) => {
      applyActions(draft as unknown as Record<string, unknown>, actions);
    });
  }
}

// 导出单例
export const pluginsService = new PluginsServiceImpl();
