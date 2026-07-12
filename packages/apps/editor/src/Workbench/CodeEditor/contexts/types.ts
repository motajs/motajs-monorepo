/**
 * EditContext 类型定义
 *
 * 用于代码编辑器的多态编辑上下文。
 */

/**
 * 编辑上下文接口
 *
 * 每次打开编辑器时创建一个 EditContext 实例，
 * 负责处理该次编辑的确认和取消逻辑。
 */
export interface EditContext {
  /** 上下文标识：表格元素 ID | "callFromBlockly" | "importFile" */
  readonly id: string;

  /**
   * 确认编辑，保存数据到目标
   * @param keep - 是否保持编辑器打开
   */
  confirm(keep?: boolean): void | Promise<void>;

  /**
   * 取消编辑，执行必要的清理
   */
  cancel(): void;

  onPreview?(value: string): void | Promise<void>;
}

/**
 * 编辑器配置
 * 用于打开编辑器时的初始配置
 */
export interface EditorConfig {
  /** 初始值 */
  initialValue: string;
  /** 是否启用 lint 检查 */
  lint?: boolean;
  /** 预览数据 */
  preview?: unknown;
  /** 滚动位置 */
  scrollTop?: number;
}

/**
 * 代码编辑器 API
 * 提供给 EditContext 使用的编辑器操作接口
 */
export interface CodeEditorAPI {
  /** 获取编辑器值 */
  getValue(): string;
  /** 设置编辑器值 */
  setValue(value: string): void;
  /** 格式化代码 */
  format(): void;
  /** 隐藏编辑器 */
  hide(): void;
  /** 获取滚动信息 */
  getScrollInfo(): { top: number };
  /** 滚动到指定位置 */
  scrollTo(x: number, y: number): void;
  /** 打印成功消息 */
  printf(message: string): void;
  /** 打印错误消息 */
  printe(message: string): void;
}

/**
 * 多行编辑参数
 */
export interface MultiLineArgs {
  /** 是否启用 lint */
  lint?: boolean;
}

/**
 * 多行编辑回调
 */
export type MultiLineCallback = (newValue: string, b: unknown, f: unknown) => void;

/**
 * open 函数配置选项
 * 用于 editor_multi.open 的配置参数
 */
export interface OpenConfig {
  /** 旧 textarea 编辑器的字符串模式标记 */
  isString?: boolean;
  /** 是否启用语法检查 */
  lint?: boolean;
  /** 预览数据 */
  preview?: unknown;
  /** 滚动位置（用于恢复） */
  scrollTop?: number;
  /** 上下文标识（用于 legacy API 兼容） */
  contextId?: string;
}

/**
 * open 函数回调
 * 用于 editor_multi.open 的回调参数
 */
export interface OpenCallbacks {
  /** 确认编辑时调用，传入编辑后的值 */
  onConfirm: (value: string) => void | Promise<void>;
  /** 取消编辑时调用（可选） */
  onCancel?: () => void;
  onPreview?: (value: string) => void | Promise<void>;
}
