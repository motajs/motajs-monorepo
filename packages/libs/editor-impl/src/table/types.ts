import { ICodeEditorOpener, ITablePanelOpener } from '../react/capabilities';
import { ITablePreset } from '../react/types';
import { IEditableContentProps } from '../shared/editable/types';
import { TablePanelStatus } from '../shared/schemaForm/components/TableGrid';
import { ITableRowNode, TableEditMode } from '../shared/schemaForm/types';

export type { ITablePreset };
export { TableControlKind, TableEditMode, TableExternalEditor } from '../shared/schemaForm/types';
export type {
  ITableSchemaNode,
  ITableRowNode,
  IPairedFieldGroup,
  ISchemaPresentationRule,
} from '../shared/schemaForm/types';

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

/** 一次变更的载荷：编辑模式、字段路径与目标值 */
export type TableAction = readonly [mode: TableEditMode, path: readonly string[], value: unknown];

export interface ITablePanelTarget {
  /** 表格面板要编辑的数据文件路径；schema 路径一律按 `xxx.schema.json(c)` 约定推导，不允许单独指定；schema 视图同样使用此字段，其值本身是一个 schema 文件路径 */
  readonly dataPath: string;
}

export interface ITablePanel {
  /**
   * 从外部设置此面板实例某一栏要编辑的目标表
   *
   * 同一个表格面板内不许两栏指向同一个数据文件；选到已被占用的文件时本栏保持原目标——
   * 同面板另一栏持有则闪一下那一栏，另一个标签持有则切过去。空串路径不参与查重。
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

// 表格可编辑组件的内容与编辑入口：内容类型是**面板结构**，不要求等于文件结构（D-39）。
// 这些名字由本计划一次定稿，组件与面板只引用、不另造同义形状。

export interface ITableDocument {
  /** 该栏当前呈现的数据内容 */
  readonly data: unknown;

  /** 该栏用于呈现的 schema；schema 视图下与 `data` 同源 */
  readonly schema: unknown;

  /** 该栏的目标是 schema 文件时为真，决定用 schema 树还是数据树呈现 */
  readonly schemaMode: boolean;
}

export const enum TableEditKind {
  /** 改值：把指定字段路径的值替换为新值 */
  Change,
  /** 新增：在锚点字段之后插入一个具名子字段 */
  Add,
  /** 删除：移除指定字段路径的字段 */
  Delete,
}

export interface ITableEdit {
  /** 这次编辑的意图种类 */
  readonly kind: TableEditKind;

  /** 字段路径；`Add` 时这里是锚点路径 */
  readonly key: string;

  /** `Change` 的新值 */
  readonly value?: unknown;

  /** `Add` 的锚点字段路径 */
  readonly anchorKey?: string;

  /** `Add` 的新字段名 */
  readonly name?: string;

  /** `Change` 用于校验的行内配置，由组件从自己的行树里取 */
  readonly config?: ITableRowNode['config'];
}

export interface ITableEditableProps extends IEditableContentProps<ITableDocument> {
  /**
   * 面板侧唯一的编辑入口：组件把一次编辑意图交给面板，由面板落成新文档
   * @param edit 组件这次要执行的编辑意图
   * @param document 组件提交时的文档
   * @returns 编辑后的新文档；为 null 表示这次编辑被拒绝且面板已发布错误
   */
  applyEdit(edit: ITableEdit, document: ITableDocument): ITableDocument | null;

  /** 透传给表格网格的数据状态 */
  readonly status: TablePanelStatus;

  /** 透传给表格网格的标题 */
  readonly title?: string;

  /** 透传给表格网格的成功提示 */
  readonly message?: string;

  /** 透传给表格网格的错误提示 */
  readonly error?: string;

  /**
   * 透传给表格网格的「重试」回调
   */
  onRetry?(): void;

  /**
   * 透传给表格网格的「编辑 Schema」回调
   * @param opener 表格网格构造的面板打开器
   */
  onOpenSchema?(opener: ITablePanelOpener): void;

  /**
   * 透传给表格网格的「在代码编辑器中打开」回调
   * @param opener 表格网格构造的代码编辑器打开器
   */
  onOpenInCodeEditor?(opener: ICodeEditorOpener): void;

  /**
   * 透传给表格网格的「关闭本栏」回调
   */
  onCloseColumn?(): void;

  /** 面板侧是否还有未落盘的改动：撤销、代码编辑器写回、确认剥离注释这类不经组件草稿的改动会置真 */
  readonly unsaved?: boolean;
}

export interface ITablePendingConflict {
  /** 外部改动的文件路径，用于该栏匹配与去重 */
  readonly path: string;

  /** 读到的外部原文 */
  readonly text: string;
}

export interface ITableCloseDialogState {
  /** 关闭弹窗是否打开 */
  readonly open: boolean;

  /** 是否正在保存 */
  readonly saving?: boolean;

  /** 保存失败的原因 */
  readonly error?: string;
}
