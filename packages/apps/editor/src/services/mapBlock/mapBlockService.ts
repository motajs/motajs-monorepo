/**
 * mapBlockService - 地图块数据服务
 *
 * 管理地图块数据（project/maps.js），提供命令式 API
 * 不依赖 React，可在任何 JavaScript 环境使用
 *
 * 核心理念：
 * - 单文件管理：地图块数据只有一个文件 project/maps.js
 * - 与 towerService 一致的架构：使用 FileHandler 管理状态
 * - 内存数据源 + 异步落盘
 */

import { FileHandlerManager } from "@/fs/FileHandlerManager";
import type { Content } from "@/fs";
import type { Action } from "@/utils/action";
import { MapsBlocksDataHandler } from "./MapsBlocksDataHandler";
import { projectData } from "@/project/data/projectData";

/** 地图块数据文件路径 */
const MAPS_BLOCKS_DATA_PATH = "project/maps.js";

/**
 * 地图块信息类型
 */
export interface BlockInfo {
  cls?: string;
  id?: string;
  name?: string;
  canBreak?: boolean;
  canPass?: boolean;
  animate?: number;
  trigger?: string;
  script?: string;
  doorInfo?: {
    time?: number;
    openSound?: string;
    closeSound?: string;
    keys?: Record<string, number>;
  };
  cannotOut?: string[];
  cannotIn?: string[];
  faceIds?: Record<string, string>;
  [key: string]: unknown;
}

/**
 * 地图块数据类型（key 是 idnum 字符串）
 */
export interface MapsBlocksData {
  [idnum: string]: BlockInfo;
}

/**
 * mapBlockService - 地图块数据服务（命令式 API）
 */
class MapBlockServiceImpl {
  /** 地图块数据 DataHandler（单例，懒加载） */
  private dataHandler: MapsBlocksDataHandler | null = null;

  /**
   * 获取或创建 DataHandler（懒加载）
   */
  private getDataHandler(): MapsBlocksDataHandler {
    if (!this.dataHandler) {
      const fileHandler = FileHandlerManager.get(MAPS_BLOCKS_DATA_PATH);
      this.dataHandler = new MapsBlocksDataHandler(fileHandler);
    }
    return this.dataHandler;
  }

  /**
   * 获取地图块数据（load 模式：抛出异常）
   *
   * 保证返回数据，如果加载失败则抛出异常
   *
   * 注意：调用者需要先确保文件已加载
   */
  getMapsBlocksData(): MapsBlocksData {
    return this.getDataHandler().unwrap();
  }

  /**
   * 获取地图块数据（Content 模式：返回所有状态）
   */
  getMapsBlocksDataContent(): Content<MapsBlocksData> {
    return this.getDataHandler().getContent();
  }

  /**
   * 获取 DataHandler（用于直接访问 signal）
   */
  getHandler(): MapsBlocksDataHandler {
    return this.getDataHandler();
  }

  /**
   * 获取单个地图块信息
   */
  getBlock(idnum: number | string): BlockInfo | undefined {
    const data = this.getMapsBlocksData();
    return data[String(idnum)];
  }

  /**
   * 保存地图块数据修改
   *
   * 应用 actions 到地图块数据，立即更新内存并异步落盘
   */
  saveBlock(idnum: number | string, actions: Action[]): void {
    if (actions.length === 0) {
      return;
    }

    const idnumStr = String(idnum);

    const prefixedActions: Action[] = actions.map(([type, path, value]) => [
      type,
      `['${idnumStr}']${path}`,
      value,
    ]);
    void projectData.mapBlocks().patch(prefixedActions);
  }

  /**
   * 直接保存整个地图块数据
   */
  saveMapsBlocksData(actions: Action[]): void {
    if (actions.length === 0) {
      return;
    }

    void projectData.mapBlocks().patch(actions);
  }

  /**
   * 重新加载地图块数据（从文件重新读取）
   */
  async refetch(): Promise<void> {
    return FileHandlerManager.reload(MAPS_BLOCKS_DATA_PATH);
  }

  /**
   * 获取文件路径
   */
  getPath(): string {
    return MAPS_BLOCKS_DATA_PATH;
  }
}

// 导出单例
export const mapBlockService = new MapBlockServiceImpl();
