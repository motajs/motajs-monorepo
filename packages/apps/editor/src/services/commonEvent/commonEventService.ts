/**
 * commonEventService - 公共事件服务
 *
 * 管理公共事件数据（project/events.js 中的 commonEvent 字段），提供命令式 API
 * 不依赖 React，可在任何 JavaScript 环境使用
 *
 * 核心理念：
 * - 单文件管理：公共事件数据存储在 project/events.js
 * - 只暴露 commonEvent 字段的读写操作
 * - 内存数据源 + 异步落盘
 */

import { produce } from "immer";
import { FileHandlerManager } from "@/fs/FileHandlerManager";
import { Json2xDataHandler } from "@/fs/Json2xDataHandler";
import type { Content } from "@/fs";
import { applyActions, type Action } from "@/utils/action";
import { ContentUtils } from "@/fs/ContentUtils";
import { tableCommands } from "@/project/commands";

/** 事件数据文件路径 */
const EVENTS_DATA_PATH = "project/events.js";

/** 数据变量名 */
const EVENTS_VAR_NAME = "events_c12a15a8_c380_4b28_8144_256cba95f760";

/**
 * 公共事件数据类型
 * 键是事件名称，值是事件指令数组
 */
export type CommonEventData = Record<string, unknown[]>;

/**
 * 完整的 events.js 数据结构
 */
interface EventsData {
  commonEvent: CommonEventData;
  [key: string]: unknown;
}

/**
 * commonEventService - 公共事件服务（命令式 API）
 */
class CommonEventServiceImpl {
  /** Events 数据 DataHandler（单例，懒加载） */
  private dataHandler: Json2xDataHandler<EventsData> | null = null;

  /**
   * 获取或创建 DataHandler（懒加载）
   */
  private getDataHandler(): Json2xDataHandler<EventsData> {
    if (!this.dataHandler) {
      const fileHandler = FileHandlerManager.get(EVENTS_DATA_PATH);
      this.dataHandler = new Json2xDataHandler<EventsData>(
        fileHandler,
        EVENTS_VAR_NAME,
        "Events Data",
      );
    }
    return this.dataHandler;
  }

  /**
   * 获取公共事件数据（load 模式：抛出异常）
   *
   * 保证返回数据，如果加载失败则抛出异常
   *
   * 注意：调用者需要先确保文件已加载
   *
   * @example
   * // 在模块顶层或组件初始化时加载
   * await FileHandlerManager.load('project/events.js');
   *
   * // 然后使用（同步）
   * try {
   *   const data = commonEventService.getCommonEventData();
   *   console.log(data['加点事件']);
   * } catch (err) {
   *   console.error('加载失败:', err);
   * }
   */
  getCommonEventData(): CommonEventData {
    const eventsData = this.getDataHandler().unwrap();
    return eventsData.commonEvent;
  }

  /**
   * 获取公共事件数据（Content 模式：返回所有状态）
   *
   * 返回 Content<CommonEventData>，包含所有可能的状态
   *
   * @example
   * const content = commonEventService.getCommonEventDataContent();
   * match(content)
   *   .with({ status: 'loaded' }, (c) => console.log(c.value['加点事件']))
   *   .with({ status: 'loading' }, () => console.log('Loading...'))
   *   .otherwise(() => {});
   */
  getCommonEventDataContent(): Content<CommonEventData> {
    const eventsContent = this.getDataHandler().getContent();
    return ContentUtils.map(eventsContent, (data) => data.commonEvent);
  }

  /**
   * 获取 DataHandler（用于直接访问 signal）
   *
   * 返回数据层的 DataHandler，可以直接访问 signal 或订阅变化
   * 注意：返回的是整个 events.js 的 handler，不仅仅是 commonEvent
   *
   * @example
   * // 非 React 环境：直接访问 signal
   * const handler = commonEventService.getHandler();
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
   * 保存公共事件数据修改
   *
   * 应用 actions 到公共事件数据，立即更新内存并异步落盘
   * 会自动在 action 路径前添加 ['commonEvent'] 前缀
   *
   * 使用 immer 保证不可变性
   *
   * 注意：调用者需要先确保文件已加载
   *
   * @example
   * commonEventService.saveCommonEventData([
   *   ['change', "['新事件']", [{ type: 'comment', text: '注释' }]]
   * ]);
   */
  saveCommonEventData(actions: Action[]): void {
    if (actions.length === 0) {
      return;
    }

    void tableCommands.patchCommonEvents(actions);
  }

  /**
   * 重新加载公共事件数据（从文件重新读取）
   *
   * @example
   * await commonEventService.refetch();
   */
  async refetch(): Promise<void> {
    return FileHandlerManager.reload(EVENTS_DATA_PATH);
  }

  /**
   * 预览变更后的内容（不实际写入）
   *
   * 使用 immer 保证不修改原数据
   *
   * @example
   * const preview = commonEventService.previewChanges([
   *   ['change', "['新事件']", [{ type: 'comment', text: '注释' }]]
   * ]);
   * console.log(preview['新事件']);
   */
  previewChanges(actions: Action[]): CommonEventData {
    // 获取当前数据
    const currentData = this.getCommonEventData();

    // 使用 immer 创建草稿并应用 actions
    return produce(currentData, (draft) => {
      applyActions(draft as unknown as Record<string, unknown>, actions);
    });
  }
}

// 导出单例
export const commonEventService = new CommonEventServiceImpl();
