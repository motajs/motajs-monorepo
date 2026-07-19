/**
 * MotaAction 解析器类型定义
 *
 * 定义事件数据和 Blockly State 之间的类型
 */

// ============================================
// 事件数据类型 (游戏格式)
// ============================================

/**
 * 事件数据可以是字符串（简单文本）或事件对象
 */
export type EventData = string | EventObject;

/**
 * 事件对象
 */
export interface EventObject {
  type: string;
  [key: string]: unknown;
}

/**
 * 文本事件
 */
export interface TextEvent extends EventObject {
  type: 'text';
  text: string;
  pos?: [number, number, number];
  code?: number;
  async?: boolean;
}

/**
 * 条件判断事件
 */
export interface IfEvent extends EventObject {
  type: 'if';
  condition: string;
  true: EventData[];
  false?: EventData[];
}

/**
 * 设置值事件
 */
export interface SetValueEvent extends EventObject {
  type: 'setValue';
  name: string;
  operator?: string;
  value: string | number | boolean;
  norefresh?: boolean;
}

/**
 * 注释事件
 */
export interface CommentEvent extends EventObject {
  type: 'comment';
  text: string;
}

/**
 * 显示事件
 */
export interface ShowEvent extends EventObject {
  type: 'show';
  loc?: [number, number] | [number, number][];
  floorId?: string;
  time?: number;
  async?: boolean;
}

/**
 * 隐藏事件
 */
export interface HideEvent extends EventObject {
  type: 'hide';
  loc?: [number, number] | [number, number][];
  floorId?: string;
  remove?: boolean;
  time?: number;
  async?: boolean;
}

// ============================================
// Blockly State 类型 (v12 格式)
// ============================================

/**
 * Blockly Block State
 * 对应 Blockly.serialization.blocks.State
 */
export interface BlockState {
  type: string;
  id?: string;
  x?: number;
  y?: number;
  collapsed?: boolean;
  enabled?: boolean;
  fields?: Record<string, unknown>;
  inputs?: Record<string, ConnectionState>;
  next?: ConnectionState;
  extraState?: unknown;
}

/**
 * 连接状态（用于 inputs 和 next）
 */
export interface ConnectionState {
  shadow?: BlockState;
  block?: BlockState;
}

/**
 * Workspace 状态
 */
export interface WorkspaceState {
  blocks?: {
    languageVersion: number;
    blocks: BlockState[];
  };
  variables?: Array<{
    name: string;
    id: string;
    type?: string;
  }>;
}

// ============================================
// 解析上下文
// ============================================

/**
 * 解析上下文
 */
export interface ParseContext {
  /** 入口类型: event, shop, level 等 */
  entryType: string;
  project?: {
    bgms: readonly string[];
    sounds: readonly string[];
    images: readonly string[];
    animates: readonly string[];
  };
}

// ============================================
// 块定义类型
// ============================================

/**
 * Blockly JSON Block 定义
 */
export interface BlockDefinition {
  type: string;
  message0: string;
  args0?: BlockArg[];
  message1?: string;
  args1?: BlockArg[];
  message2?: string;
  args2?: BlockArg[];
  output?: string | string[] | null;
  previousStatement?: string | string[] | null;
  nextStatement?: string | string[] | null;
  colour: number | string;
  tooltip?: string;
  helpUrl?: string;
  inputsInline?: boolean;
  extensions?: string[];
  [key: `message${number}`]: unknown;
  [key: `args${number}`]: unknown;
}

/**
 * Block 参数定义
 */
export type BlockArg =
  | FieldInputArg
  | FieldNumberArg
  | FieldColourArg
  | FieldLabelArg
  | FieldMultilineArg
  | FieldCheckboxArg
  | FieldDropdownArg
  | FieldActionArg
  | FieldPointArg
  | InputValueArg
  | InputStatementArg
  | InputDummyArg;

export interface FieldInputArg {
  type: 'field_input';
  name: string;
  text?: string;
}

export interface FieldNumberArg {
  type: 'field_number';
  name: string;
  value?: number;
  min?: number;
  max?: number;
  precision?: number;
}

export interface FieldColourArg {
  type: 'field_colour';
  name: string;
  colour?: string;
}

export interface FieldLabelArg {
  type: 'field_label';
  name?: string;
  text: string;
}

export interface FieldMultilineArg {
  type: 'field_multilinetext';
  name: string;
  text?: string;
  maxLines?: number;
}

export interface FieldCheckboxArg {
  type: 'field_checkbox';
  name: string;
  checked?: boolean;
}

export interface FieldDropdownArg {
  type: 'field_dropdown';
  name: string;
  options: Array<[string, string]>;
}

export interface FieldActionArg {
  type: 'field_mota_action';
  name?: string;
  text: string;
  action: 'registerUnknownEvent';
}

/**
 * 地图选点字段
 */
export interface FieldPointArg {
  type: 'field_point';
  name: string;
  /** 是否包含楼层，默认 true */
  includeFloor?: boolean;
  /** 是否支持多选，默认 false */
  multiSelect?: boolean;
  /** 初始 x 坐标 */
  x?: number;
  /** 初始 y 坐标 */
  y?: number;
  /** 初始楼层 ID */
  floorId?: string;
}

export interface InputValueArg {
  type: 'input_value';
  name: string;
  check?: string | string[];
}

export interface InputStatementArg {
  type: 'input_statement';
  name: string;
  check?: string | string[];
}

export interface InputDummyArg {
  type: 'input_dummy';
  name?: string;
}
