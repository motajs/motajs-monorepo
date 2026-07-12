/**
 * itemService - 道具数据服务
 *
 * 管理道具数据（project/items.js），提供命令式 API
 * 不依赖 React，可在任何 JavaScript 环境使用
 *
 * 核心理念：
 * - 单文件管理：道具数据只有一个文件 project/items.js
 * - 与 towerService 一致的架构：使用 FileHandler 管理状态
 * - 内存数据源 + 异步落盘
 */

import { FileHandlerManager } from "@/fs/FileHandlerManager";
import type { Content } from "@/fs";
import type { Action } from "@/utils/action";
import { ItemsDataHandler } from "./ItemsDataHandler";
import { projectData } from "@/project/data/projectData";

/** 道具数据文件路径 */
const ITEMS_DATA_PATH = "project/items.js";

/**
 * 道具信息类型
 */
export interface ItemInfo {
  cls?: string;
  name?: string;
  text?: string;
  hideInToolbox?: boolean;
  hideInReplay?: boolean;
  itemEffect?: string;
  itemEffectTip?: string;
  useItemEffect?: string;
  canUseItemEffect?: string;
  useItemEvent?: unknown[];
  equip?: {
    type?: number;
    animate?: string;
    value?: Record<string, number>;
  };
  [key: string]: unknown;
}

/**
 * 道具数据类型
 */
export interface ItemsData {
  [id: string]: ItemInfo;
}

/**
 * itemService - 道具数据服务（命令式 API）
 */
class ItemServiceImpl {
  /** 道具数据 DataHandler（单例，懒加载） */
  private dataHandler: ItemsDataHandler | null = null;

  /**
   * 获取或创建 DataHandler（懒加载）
   */
  private getDataHandler(): ItemsDataHandler {
    if (!this.dataHandler) {
      const fileHandler = FileHandlerManager.get(ITEMS_DATA_PATH);
      this.dataHandler = new ItemsDataHandler(fileHandler);
    }
    return this.dataHandler;
  }

  /**
   * 获取道具数据（load 模式：抛出异常）
   *
   * 保证返回数据，如果加载失败则抛出异常
   *
   * 注意：调用者需要先确保文件已加载
   */
  getItemsData(): ItemsData {
    return this.getDataHandler().unwrap();
  }

  /**
   * 获取道具数据（Content 模式：返回所有状态）
   */
  getItemsDataContent(): Content<ItemsData> {
    return this.getDataHandler().getContent();
  }

  /**
   * 获取 DataHandler（用于直接访问 signal）
   */
  getHandler(): ItemsDataHandler {
    return this.getDataHandler();
  }

  /**
   * 获取单个道具信息
   */
  getItem(id: string): ItemInfo | undefined {
    const data = this.getItemsData();
    return data[id];
  }

  /**
   * 保存道具数据修改
   *
   * 应用 actions 到道具数据，立即更新内存并异步落盘
   */
  saveItem(id: string, actions: Action[]): void {
    if (actions.length === 0) {
      return;
    }

    const prefixedActions: Action[] = actions.map(([type, path, value]) => [
      type,
      `['${id}']${path}`,
      value,
    ]);
    void projectData.items().patch(prefixedActions);
  }

  /**
   * 直接保存整个道具数据
   */
  saveItemsData(actions: Action[]): void {
    if (actions.length === 0) {
      return;
    }

    void projectData.items().patch(actions);
  }

  /**
   * 重新加载道具数据（从文件重新读取）
   */
  async refetch(): Promise<void> {
    return FileHandlerManager.reload(ITEMS_DATA_PATH);
  }

  /**
   * 获取文件路径
   */
  getPath(): string {
    return ITEMS_DATA_PATH;
  }
}

// 导出单例
export const itemService = new ItemServiceImpl();
