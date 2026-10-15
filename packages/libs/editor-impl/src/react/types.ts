export interface ICodeEditorOpenRequest {
  /** 代码编辑器的标题，如字段名或文件名 */
  readonly title: string;
  /** 要在代码编辑器中打开的整份内容 */
  readonly content: string;
}

export interface IEventEditorOpenRequest {
  /** 事件编辑器的标题，如字段名 */
  readonly title: string;
  /** 要在事件编辑器中打开的整份内容 */
  readonly content: string;
}

export interface IMultiSelectItem {
  /** 选项的稳定标识，确认后作为选中结果返回 */
  readonly id: string;
  /** 显示给用户的选项文本 */
  readonly label: string;
  /** 选项的缩略图地址（素材选择时使用）；无缩略图时为 undefined */
  readonly thumbnail?: string;
}

export interface IMultiSelectOpenRequest {
  /** 多选弹窗的标题 */
  readonly title: string;
  /** 可供选择的全部候选项 */
  readonly items: readonly IMultiSelectItem[];
  /** 打开时已选中的项 id 列表 */
  readonly selectedIds: readonly string[];
}

export interface IMultiSelectResult {
  /** 用户确认后的选中项 id 列表 */
  readonly ids: readonly string[];
}

export interface IPointSelectOpenRequest {
  /** 坐标选择弹窗的标题 */
  readonly title: string;
  /** 打开时显示的初始 x 坐标；无初始值时为 undefined */
  readonly x?: number;
  /** 打开时显示的初始 y 坐标；无初始值时为 undefined */
  readonly y?: number;
}

export interface IPointSelectResult {
  /** 选中的 x 坐标 */
  readonly x: number;
  /** 选中的 y 坐标 */
  readonly y: number;
}

export interface ITablePreset {
  /** 预设表的显示名 */
  readonly name: string;
  /** 预设表的数据文件路径 */
  readonly path: string;
}
