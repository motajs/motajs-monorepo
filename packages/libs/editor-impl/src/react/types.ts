import { ITableSchemaNode } from '../shared/schemaForm/types';

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
  /** 选项的音频试听地址（素材选择时使用）；存在时选择器渲染内联试听 */
  readonly audio?: string;
  /** 选项是否有动画预览；为 true 时选择器渲染动画预览提示 */
  readonly animation?: boolean;
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

export const enum AssetCategoryKind {
  /** 图片 */
  Image,
  /** 音频 */
  Audio,
  /** 动画 */
  Animation,
  /** 字体 */
  Font,
}

export const enum AssetListFormat {
  /** 列表正文是 `string[]` */
  StringList,
  /** 列表正文是挂在某个键下的对象数组 */
  ObjectList,
}

export interface IAssetCategory {
  /** 分类标识，如 `texture` */
  readonly id: string;
  /** 分类显示名，如「图片」 */
  readonly label: string;
  /** 大分类的种类，决定默认列表格式、默认预览与能否转码 */
  readonly kind: AssetCategoryKind;
  /** 分类对应的字节目录，如 `content/texture` */
  readonly dir: string;
  /** 列表文件路径，如 `content/texture/.list.jsonc` */
  readonly listPath: string;
  /** 列表文件的正文格式 */
  readonly listFormat: AssetListFormat;
  /** `ObjectList` 时数组所在的键，如 `textures`；`StringList` 时为 undefined */
  readonly listKey?: string;
  /** `ObjectList` 时条目里存文件名的键；缺省为 `source` */
  readonly sourceField?: string;
  /** 列表名里不含的扩展名，如 `.anim`；缺省表示列表名即完整文件名 */
  readonly extension?: string;
  /** 引擎自带 schema 的文件路径；缺省按 `dir + '/.schema.jsonc'` 推导 */
  readonly schemaPath?: string;
  /** 默认值文件路径；缺省时新增条目不合并默认值 */
  readonly defaultsPath?: string;
  /** 装配方选定的回退 schema，用于渲染该分类的配置表单 */
  readonly schema?: ITableSchemaNode;
}

export interface IAssetPickerOpenRequest {
  /** 选择器弹窗的标题 */
  readonly title: string;
  /** 打开时定位的分类标识；缺省时用默认分类 */
  readonly categoryId?: string;
  /** 是否允许选中多项；缺省时单选 */
  readonly multiple?: boolean;
  /** 打开时已选中的素材名列表 */
  readonly selectedIds?: readonly string[];
}

export interface IAssetPickerResult {
  /** 用户确认后的选中素材名列表 */
  readonly ids: readonly string[];
}
