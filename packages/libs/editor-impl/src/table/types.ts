import { ITablePreset } from '../react/types';
import { JSONSchema } from 'json-schema-typed';

export type { ITablePreset };

export const enum TableExternalEditor {
  /** 代码编辑器 */
  Code,
  /** 事件编辑器 */
  Event,
  /** 素材选择器 */
  Material,
  /** 坐标选择器 */
  Point,
  /** 多选编辑器 */
  MultiSelect,
}

export const enum TableControlKind {
  /** 单行文本 */
  Text,
  /** 数字 */
  Number,
  /** 复选框 */
  Checkbox,
  /** 下拉选择 */
  Select,
  /** 多选 */
  MultiSelect,
  /** 颜色 */
  Color,
}

export const enum TableEditMode {
  /** 修改既有字段的值 */
  Change,
  /** 新增字段 */
  Add,
  /** 删除字段 */
  Delete,
}

export const enum TableEmptyMode {
  /** 空栏初始态：显示「打开表格 / 新建表格 / 删除表格」三个按钮 */
  Buttons,
  /** 内联展示打开表格组件 */
  Open,
  /** 内联展示新建表格组件 */
  Create,
  /** 内联展示删除表格组件 */
  Delete,
}

export interface ITableSchemaNode extends JSONSchema.Interface {
  /** 该字段使用的外部编辑器（`x-editor` 扩展键） */
  readonly 'x-editor'?: TableExternalEditor;
  /** 无法从标准关键字推导行内控件时显式指定的控件（`x-control` 扩展键） */
  readonly 'x-control'?: TableControlKind;
  /** 同级字段的呈现顺序提示（列出子属性名）；据此新增行可插在双击行之后，而不依赖对象键顺序 */
  readonly 'x-order'?: readonly string[];
  /** 嵌套对象的字段 schema，递归为同样的节点类型 */
  readonly properties?: Record<string, ITableSchemaNode>;
  /** 数组元素的 schema，递归为同样的节点类型 */
  readonly items?: ITableSchemaNode;
}

export interface ITableRowNode {
  /** 行的稳定标识，通常是字段路径 */
  readonly key: string;
  /** 叶子行的当前值；分组行为 undefined */
  readonly value?: unknown;
  /** 行对应的字段描述；无描述时为 undefined */
  readonly description?: string;
  /** 分组行的子节点；叶子行为 undefined */
  readonly children?: readonly ITableRowNode[];
  /** 行对应的 schema 节点；无对应项时为 undefined */
  readonly config?: ITableSchemaNode;
}

/** 一次变更的载荷：编辑模式、字段路径与目标值 */
export type TableAction = readonly [mode: TableEditMode, path: readonly string[], value: unknown];

export interface ITablePanelTarget {
  /** 表格面板要编辑的数据文件路径；schema 路径一律按 `xxx.schema.json(c)` 约定推导，不允许单独指定；schema 视图同样使用此字段，其值本身是一个 schema 文件路径 */
  readonly dataPath: string;
}

export interface ITablePanel {
  /**
   * 从外部设置此面板实例某一栏要编辑的目标表
   * @param target 目标表的单一数据文件路径
   * @param columnIndex 目标栏的序号（0 基）；省略时默认为第 0 栏
   */
  setTable(target: ITablePanelTarget, columnIndex?: number): void;

  /**
   * 把某一栏内存中的未落盘改动写回资源：数据文件，以及需要写回的镜像 schema 文件；该栏无未落盘改动时不动盘
   * @param columnIndex 目标栏的序号（0 基）；省略时默认为第 0 栏
   */
  save?(columnIndex?: number): Promise<void>;
}

export interface ITablePanelParam extends Record<string, unknown> {
  /** 多栏布局中每一栏的像素宽度；缺省约 500px */
  readonly columnWidth?: number;
}

export interface IPairedFieldGroup {
  /** 成对呈现的关键字名，如 `minimum` 与 `maximum` */
  readonly keywords: readonly string[];
}

export interface ISchemaPresentationRule {
  /** 规则命中的 schema 关键字名 */
  readonly keyword: string;
  /** 与该关键字成对呈现的分组；不成对时为 undefined */
  readonly pair?: IPairedFieldGroup;
  /** 是否以紧凑标量呈现 */
  readonly compact?: boolean;
}
