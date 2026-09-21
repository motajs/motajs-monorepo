/**
 * towerService - 全塔属性服务
 *
 * 管理全塔属性数据（project/data.js），提供命令式 API
 * 不依赖 React，可在任何 JavaScript 环境使用
 *
 * 核心理念：
 * - 单文件管理：全塔数据只有一个文件 project/data.js
 * - 使用 FileHandler 管理状态
 * - 内存数据源 + 异步落盘
 */

import { produce } from 'immer';
import { FileHandlerManager } from '@/fs/FileHandlerManager';
import type { Content } from '@/fs';
import { applyActions, type Action } from '@/utils/action';
import { TowerDataHandler } from './TowerDataHandler';

/** 全塔数据文件路径 */
const TOWER_DATA_PATH = 'project/data.js';

/**
 * 全塔数据类型
 */
export interface TowerData {
  main: {
    floorIds: string[];
    title?: string;
    [key: string]: unknown;
  };
  firstData: {
    floorId: string;
    [key: string]: unknown;
  };
  values?: Record<string, unknown>;
  flags?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * towerService - 全塔属性服务（命令式 API）
 */
class TowerServiceImpl {
  /** 全塔数据 DataHandler（单例，懒加载） */
  private dataHandler: TowerDataHandler | null = null;

  /**
   * 获取或创建 DataHandler（懒加载）
   */
  private getDataHandler(): TowerDataHandler {
    if (!this.dataHandler) {
      const fileHandler = FileHandlerManager.get(TOWER_DATA_PATH);
      this.dataHandler = new TowerDataHandler(fileHandler);
    }
    return this.dataHandler;
  }

  /**
   * 获取全塔数据（load 模式：抛出异常）
   *
   * 保证返回数据，如果加载失败则抛出异常
   *
   * 注意：调用者需要先确保文件已加载
   *
   * @example
   * // 在模块顶层或组件初始化时加载
   * await FileHandlerManager.load('project/data.js');
   *
   * // 然后使用（同步）
   * try {
   *   const data = towerService.getTowerData();
   *   console.log(data.main.floorIds);
   * } catch (err) {
   *   console.error('加载失败:', err);
   * }
   */
  getTowerData(): TowerData {
    return this.getDataHandler().unwrap();
  }

  /**
   * 获取全塔数据（Content 模式：返回所有状态）
   *
   * 返回 Content<TowerData>，包含所有可能的状态
   *
   * @example
   * const content = towerService.getTowerDataContent();
   * match(content)
   *   .with({ status: 'loaded' }, (c) => console.log(c.value.main.floorIds))
   *   .with({ status: 'loading' }, () => console.log('Loading...'))
   *   .otherwise(() => {});
   */
  getTowerDataContent(): Content<TowerData> {
    return this.getDataHandler().getContent();
  }

  /**
   * 获取 DataHandler（用于直接访问 signal）
   *
   * 返回数据层的 DataHandler，可以直接访问 signal 或订阅变化
   *
   * @example
   * // 非 React 环境：直接访问 signal
   * const handler = towerService.getHandler();
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
   * 保存全塔数据修改
   *
   * 应用 actions 到全塔数据，立即更新内存并异步落盘
   *
   * 使用 immer 保证不可变性
   *
   * 注意：调用者需要先确保文件已加载
   *
   * @example
   * towerService.saveTowerData([
   *   ['change', "['main']['title']", '新标题']
   * ]);
   */
  saveTowerData(actions: Action[]): void {
    if (actions.length === 0) {
      return;
    }

    // 使用 handler.update() 的转换函数模式 + immer
    this.getDataHandler().update((currentData) =>
      produce(currentData, (draft) => {
        // 应用 actions
        applyActions(draft as unknown as Record<string, unknown>, actions);

        // 验证 firstData.floorId 是否在 main.floorIds 中
        const mainFloorIds = draft.main.floorIds;
        const firstDataFloorId = draft.firstData.floorId;

        if (mainFloorIds && firstDataFloorId && Array.isArray(mainFloorIds)) {
          if (!mainFloorIds.includes(firstDataFloorId)) {
            // 如果 firstData.floorId 不在列表中，设置为第一个楼层
            if (mainFloorIds.length > 0) {
              draft.firstData.floorId = mainFloorIds[0];
            }
          }
        }
      }),
    );
  }

  /**
   * 重新加载全塔数据（从文件重新读取）
   *
   * @example
   * await towerService.refetch();
   */
  async refetch(): Promise<void> {
    return FileHandlerManager.reload(TOWER_DATA_PATH);
  }

  /**
   * 预览变更后的内容（不实际写入）
   *
   * 使用 immer 保证不修改原数据
   *
   * @example
   * const preview = towerService.previewChanges([
   *   ['change', "['main']['title']", '新标题']
   * ]);
   * console.log(preview.main.title); // '新标题'
   */
  previewChanges(actions: Action[]): TowerData {
    // 获取当前数据
    const currentData = this.getTowerData();

    // 使用 immer 创建草稿并应用 actions
    return produce(currentData, (draft) => {
      applyActions(draft as unknown as Record<string, unknown>, actions);
    });
  }

  // ==================== 楼层 ID 管理辅助方法 ====================

  /**
   * 添加楼层 ID 到 floorIds 列表
   *
   * 注意：调用者需要先确保文件已加载
   *
   * @example
   * towerService.addFloorId('MT10');
   */
  addFloorId(floorId: string): void {
    // 获取全塔数据（如果未加载会抛出异常）
    const towerData = this.getDataHandler().unwrap();

    // 获取 main.floorIds
    const floorIds = towerData.main.floorIds;

    // 如果已存在，不重复添加
    if (floorIds.includes(floorId)) {
      return;
    }

    // 添加到列表
    floorIds.push(floorId);

    // 更新 DataHandler
    this.getDataHandler().update(towerData);
  }

  /**
   * 从 floorIds 列表中移除楼层 ID
   *
   * 注意：调用者需要先确保文件已加载
   *
   * @example
   * towerService.removeFloorId('MT10');
   */
  removeFloorId(floorId: string): void {
    // 获取全塔数据（如果未加载会抛出异常）
    const towerData = this.getDataHandler().unwrap();

    // 获取 main.floorIds
    const floorIds = towerData.main.floorIds;

    // 移除楼层 ID
    const index = floorIds.indexOf(floorId);
    if (index !== -1) {
      floorIds.splice(index, 1);
    }

    // 如果 firstData.floorId 是被删除的楼层，更新为第一个楼层
    if (towerData.firstData.floorId === floorId && floorIds.length > 0) {
      towerData.firstData.floorId = floorIds[0];
    }

    // 更新 DataHandler
    this.getDataHandler().update(towerData);
  }

  /**
   * 重命名 floorIds 列表中的楼层 ID
   *
   * 保持位置不变，只替换 ID
   *
   * 注意：调用者需要先确保文件已加载
   *
   * @example
   * towerService.renameFloorId('MT1', 'MT1_new');
   */
  renameFloorId(oldFloorId: string, newFloorId: string): void {
    // 获取全塔数据（如果未加载会抛出异常）
    const towerData = this.getDataHandler().unwrap();

    // 获取 main.floorIds
    const floorIds = towerData.main.floorIds;

    // 找到旧 ID 的位置并替换
    const index = floorIds.indexOf(oldFloorId);
    if (index !== -1) {
      floorIds[index] = newFloorId;
    }

    // 如果 firstData.floorId 是旧的，也要更新
    if (towerData.firstData.floorId === oldFloorId) {
      towerData.firstData.floorId = newFloorId;
    }

    // 更新 DataHandler
    this.getDataHandler().update(towerData);
  }

  /**
   * 获取所有楼层 ID
   *
   * @example
   * const floorIds = towerService.getFloorIds();
   * console.log(floorIds); // ['MT1', 'MT2', 'MT3']
   */
  getFloorIds(): string[] {
    const data = this.getTowerData();
    return data.main.floorIds;
  }

  /**
   * 检查楼层 ID 是否存在
   *
   * @example
   * const exists = towerService.hasFloorId('MT1');
   */
  hasFloorId(floorId: string): boolean {
    const floorIds = this.getFloorIds();
    return floorIds.includes(floorId);
  }
}

// 导出单例
export const towerService = new TowerServiceImpl();
