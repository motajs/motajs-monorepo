/**
 * TableMeta Service - 表格元数据服务（重构版）
 *
 * 使用 FileHandler + DataHandler 架构，提供命令式 API
 *
 * 职责：
 * - 提供命令式 API（getTableMeta, getHandler）
 * - 使用 FileHandler 读取元数据文件
 * - 不依赖 React
 */

import type { CommentObject } from '@/components/Table';
import { FileHandlerManager } from '@/fs/FileHandlerManager';
import { TableMetaDataHandler } from './TableMetaDataHandler';
import type { Content } from '@/fs/types';

// ==================== 类型定义 ====================

/**
 * 元数据文件的 key
 * 每个 key 对应一个 comment 文件
 */
export type MetaFileKey =
  | 'comment'           // comment.js (包含 items, enemys, maps, floors)
  | 'dataComment'       // data.comment.js (全塔属性)
  | 'functionsComment'  // functions.comment.js (脚本编辑)
  | 'eventsComment'     // events.comment.js (公共事件)
  | 'pluginsComment';   // plugins.comment.js (插件)

/**
 * 元数据文件配置
 */
export interface MetaFileConfig {
  /** 文件路径 */
  filePath: string;
  /** JS 变量名（用于解析文件内容） */
  varName: string;
  /** 资源名称（用于错误消息） */
  resourceName: string;
}

// ==================== 配置 ====================

/**
 * 元数据文件配置映射表
 */
export const META_FILE_CONFIG: Record<MetaFileKey, MetaFileConfig> = {
  comment: {
    filePath: '_server/table/comment.js',
    varName: 'comment_c456ea59_6018_45ef_8bcc_211a24c627dc',
    resourceName: 'Comment metadata',
  },
  dataComment: {
    filePath: '_server/table/data.comment.js',
    varName: 'data_comment_c456ea59_6018_45ef_8bcc_211a24c627dc',
    resourceName: 'Data comment metadata',
  },
  functionsComment: {
    filePath: '_server/table/functions.comment.js',
    varName: 'functions_comment_c456ea59_6018_45ef_8bcc_211a24c627dc',
    resourceName: 'Functions comment metadata',
  },
  eventsComment: {
    filePath: '_server/table/events.comment.js',
    varName: 'events_comment_c456ea59_6018_45ef_8bcc_211a24c627dc',
    resourceName: 'Events comment metadata',
  },
  pluginsComment: {
    filePath: '_server/table/plugins.comment.js',
    varName: 'plugins_comment_c456ea59_6018_45ef_8bcc_211a24c627dc',
    resourceName: 'Plugins comment metadata',
  },
};

/**
 * 所有有效的 MetaFileKey 列表
 */
export const VALID_META_FILE_KEYS: MetaFileKey[] = Object.keys(META_FILE_CONFIG) as MetaFileKey[];

// ==================== DataHandler 缓存 ====================

/**
 * TableMetaDataHandler 实例缓存
 */
const dataHandlerCache = new Map<MetaFileKey, TableMetaDataHandler>();

/**
 * 清空 DataHandler 缓存（测试用）
 * @internal
 */
export function clearDataHandlerCache(): void {
  dataHandlerCache.clear();
}

/**
 * 获取或创建 TableMetaDataHandler
 */
function getDataHandler(key: MetaFileKey): TableMetaDataHandler {
  let handler = dataHandlerCache.get(key);

  if (!handler) {
    // 使用 hasOwnProperty 检查，避免原型链上的属性（如 constructor）
    if (!Object.prototype.hasOwnProperty.call(META_FILE_CONFIG, key)) {
      throw new Error(`无效的文件 key: ${key}`);
    }

    const config = META_FILE_CONFIG[key];
    const fileHandler = FileHandlerManager.get(config.filePath);
    handler = new TableMetaDataHandler(fileHandler, config.varName, config.resourceName);
    dataHandlerCache.set(key, handler);
  }

  return handler;
}

// ==================== 命令式 API ====================

/**
 * tableMetaService - 表格元数据服务
 *
 * 提供命令式 API，不依赖 React
 */
export const tableMetaService = {
  /**
   * 获取表格元数据（load 模式：抛出异常）
   *
   * @param key - 文件 key
   * @returns CommentObject 元数据对象
   * @throws 当文件未加载或加载失败时抛出错误
   *
   * @example
   * const meta = tableMetaService.getTableMeta('comment');
   * console.log(meta._data.floors);
   */
  getTableMeta(key: MetaFileKey): CommentObject {
    const handler = getDataHandler(key);
    return handler.unwrap();
  },

  /**
   * 获取表格元数据（Content 模式：返回所有状态）
   *
   * @param key - 文件 key
   * @returns Content<CommentObject> 元数据内容
   *
   * @example
   * const content = tableMetaService.getTableMetaContent('comment');
   * if (ContentUtils.isLoaded(content)) {
   *   console.log(content.value._data.floors);
   * }
   */
  getTableMetaContent(key: MetaFileKey): Content<CommentObject> {
    const handler = getDataHandler(key);
    return handler.getContent();
  },

  /**
   * 获取 Handler（可写，也可类型转换为只读）
   *
   * @param key - 文件 key
   * @returns TableMetaDataHandler
   *
   * @example
   * // 直接访问 signal
   * const handler = tableMetaService.getHandler('comment');
   * const content = handler.content();
   *
   * // 订阅变化（非 React 环境）
   * const dispose = handler.subscribe(content => {
   *   console.log('元数据变化:', content);
   * });
   *
   * // 使用 computed 做细粒度订阅
   * const floorsMeta = computed(() => {
   *   return ContentUtils.map(handler.content(), data => data._data?.floors);
   * });
   */
  getHandler(key: MetaFileKey): TableMetaDataHandler {
    return getDataHandler(key);
  },

  /**
   * 保存表格元数据
   *
   * @param key - 文件 key
   * @param data - 元数据对象
   * @returns void
   *
   * @example
   * tableMetaService.saveTableMeta('comment', updatedMeta);
   */
  saveTableMeta(key: MetaFileKey, data: CommentObject): void {
    const handler = getDataHandler(key);
    handler.update(data);
  },

  /**
   * 重新加载表格元数据（从文件重新读取）
   *
   * @param key - 文件 key
   * @returns Promise<void>
   *
   * @example
   * await tableMetaService.refetch('comment');
   */
  async refetch(key: MetaFileKey): Promise<void> {
    const config = META_FILE_CONFIG[key];
    return FileHandlerManager.reload(config.filePath);
  },
};

// ==================== 兼容旧 API（保留） ====================

/**
 * 加载元数据文件内容（裸文本）
 *
 * @deprecated 使用 tableMetaService.getHandler(key).fileHandler.getContent() 代替
 */
export async function loadTableMetaFile(key: MetaFileKey): Promise<string> {
  // 使用 hasOwnProperty 检查，避免原型链上的属性（如 constructor）
  if (!Object.prototype.hasOwnProperty.call(META_FILE_CONFIG, key)) {
    throw new Error(`无效的文件 key: ${key}`);
  }

  const config = META_FILE_CONFIG[key];
  const fileHandler = FileHandlerManager.get(config.filePath);
  await fileHandler.load();
  const content = fileHandler.getContent();

  if (content.status === 'loaded') {
    return content.value;
  }

  throw new Error(`读取 ${config.filePath} 失败: ${content.status}`);
}

/**
 * 保存元数据文件内容
 *
 * @deprecated 使用 tableMetaService.saveTableMeta() 代替
 */
export async function saveTableMetaFile(key: MetaFileKey, content: string): Promise<void> {
  const config = META_FILE_CONFIG[key];
  const fileHandler = FileHandlerManager.get(config.filePath);
  fileHandler.update(content);
}
