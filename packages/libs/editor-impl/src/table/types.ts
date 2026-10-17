import { ITablePreset } from '../react/types';
import { TableEditMode } from '../shared/schemaForm/types';

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
