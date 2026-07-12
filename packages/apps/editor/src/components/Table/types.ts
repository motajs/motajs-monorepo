/**
 * Table Component Types
 *
 * TypeScript type definitions for the Table component system.
 * Based on the original editor_table.ts implementation.
 */

/** Field type enumeration - defines the type of input control to render */
export type FieldType =
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'checkboxSet'
  | 'popCheckboxSet'
  | 'event'
  | 'material'
  | 'color'
  | 'point'
  | 'disable';

/** Field arguments passed to dynamic configuration functions */
export interface FieldArgs {
  /** Field path, e.g., "['main']['floorIds']" */
  field: string;
  /** Comment field path, e.g., "['_data']['main']['_data']['floorIds']" */
  cfield: string;
  /** Value object at this field */
  vobj: unknown;
  /** Configuration object for this field */
  cobj: FieldConfig;
}

/** Select input configuration */
export interface SelectConfig {
  /** Available options for the select dropdown */
  values: unknown[];
}

/** Checkbox set configuration */
export interface CheckboxSetConfig {
  /** Keys for each checkbox option */
  key: (string | number)[];
  /** Prefix labels for each checkbox option */
  prefix: string[];
}

/** Field configuration interface - defines how a field should be rendered and validated */
export interface FieldConfig {
  /** Whether this is a leaf node (renders as editable row) */
  _leaf?: boolean | ((args: FieldArgs) => boolean);
  /** Field type determining the input control */
  _type?: FieldType;
  /** Full comment/description text */
  _data?: string;
  /** Short documentation shown as button tooltip */
  _docs?: string;
  /** Whether to hide this field */
  _hide?: boolean | ((args: FieldArgs) => boolean);
  /** Validation expression using 'thiseval' as the value variable */
  _range?: string;
  /** Whether the value is a string type */
  _string?: boolean | ((args: FieldArgs) => boolean);
  /** Select dropdown configuration */
  _select?: SelectConfig;
  /** Checkbox set configuration */
  _checkboxSet?: CheckboxSetConfig | (() => CheckboxSetConfig);
  /** Event type for event editor */
  _event?: string;
  /** Directory path for material selector */
  _directory?: string;
  /** Transform function string for material values */
  _transform?: string;
  /** Confirm callback function string */
  _onconfirm?: string;
  /** Whether to enable code linting */
  _lint?: boolean;
  /** Template string for textarea */
  _template?: string;
  /** Whether to show preview */
  _preview?: boolean;
  /** JSON indentation level */
  indent?: number;
}

/** Comment object interface - defines the structure of table configuration */
export interface CommentObject {
  /** Type marker, typically 'object' */
  _type?: 'object';
  /**
   * Child field configurations.
   * Can be a record of field configs or a function that returns config for a given key.
   */
  _data?: Record<string, FieldConfig | CommentObject> | ((key: string) => FieldConfig);
  /** Action function called during traversal */
  _action?: (args: FieldArgs) => void;
}

/** Table node representing a row in the table tree */
export interface TableNode {
  /** Field path, e.g., "['main']['floorIds']" */
  field: string;
  /** Short field name (last segment of path) */
  shortField: string;
  /** Whether this is a gap row (non-leaf node with children) */
  isGap: boolean;
  /** Current value (only for leaf nodes) */
  value?: unknown;
  /** Field configuration */
  config: FieldConfig;
  /** Full comment text */
  comment: string;
  /** Short comment for button display */
  shortComment?: string;
  /** Child nodes (only for gap nodes) */
  children?: TableNode[];
}

/** 编辑模式类型 */
export type EditMode = 'change' | 'add' | 'delete';

/** @deprecated 使用 EditMode 代替 */
export type DoubleClickMode = EditMode;

/** Table Action 类型：[操作类型, 字段路径, 值] */
export type TableAction = ['change' | 'add' | 'delete', string, unknown];

/** Props for the main Table component */
export interface TableProps {
  /** Data object to display/edit */
  data: Record<string, unknown>;
  /** Comment configuration object */
  commentObj: CommentObject;
  /**
   * 统一的变更回调，接收 Action 元组
   * Action 格式: ['change' | 'add' | 'delete', field, value]
   */
  onChange?: (action: TableAction) => void | Promise<void>;
  /**
   * 打开外部编辑器的回调
   * 当字段类型需要外部编辑器（如 event、textarea、material 等）时调用
   * 如果未提供，Table 会使用内置的外部编辑器集成
   */
  onOpenExternalEditor?: (field: string, type: FieldType | undefined, config: FieldConfig) => void;
  /** 编辑模式：'change' 编辑 | 'add' 添加 | 'delete' 删除，受控属性 */
  editMode?: EditMode;
}

/**
 * Props for TableRow component (重构后简化版)
 *
 * 重构说明：
 * - 原先 TableRowProps 包含所有展开的属性和回调
 * - 现在简化为只接收 node，回调通过 DataStore.useStore() 获取
 * - checkRange 验证在 TableRow 内部统一处理
 */
export interface TableRowProps {
  /** 节点数据 */
  node: TableNode;
}

/** Props for GapRow component */
export interface GapRowProps {
  /** Field path */
  field: string;
  /** Short field name for display */
  shortField: string;
  /** Child nodes to render when expanded */
  children: React.ReactNode;
}

/** Return type for useFold hook */
export interface UseFoldReturn {
  /** Whether the current field is folded */
  isFolded: boolean;
  /** Toggle fold state */
  toggleFold: () => void;
}

/** Table context value interface */
export interface TableContextValue {
  /** Tree structure of table data */
  rootNodes: TableNode[];
  /** All foldable field paths */
  gapFields: string[];
  /** Set of currently folded field paths */
  foldedFields: Set<string>;
  /** Toggle fold state for a field */
  toggleFold: (field: string) => void;
  /** Fold all gap fields */
  foldAll: () => void;
  /** Unfold all gap fields */
  unfoldAll: () => void;
  /** Value change callback */
  onValueChange: (field: string, value: unknown) => void | Promise<void>;
  /** Add item callback */
  onAddItem: (field: string, name: string) => void;
  /** Delete item callback */
  onDeleteItem: (field: string) => void;
}

/** Props for ActionButtons component */
export interface ActionButtonsProps {
  testId?: string;
  /** Whether to show comment button */
  showComment: boolean;
  /** Field type */
  type?: FieldType;
  /** Comment button click callback */
  onCommentClick?: () => void;
  /** 打开外部编辑器按钮点击回调 */
  onOpenExternalEditor?: () => void;
  /** Copy button click callback */
  onCopyClick?: () => void;
}

/** Base props for input components */
export interface BaseInputProps {
  /** Current value */
  value: unknown;
  /** Value change callback */
  onChange: (value: unknown) => void;
  /** Whether the input is disabled */
  disabled?: boolean;
}

/** Props for TextareaInput component */
export interface TextareaInputProps extends BaseInputProps {
  /** JSON indentation level */
  indent?: number;
  /** Whether the input is readonly */
  readonly?: boolean;
}

/** Props for SelectInput component */
export interface SelectInputProps extends BaseInputProps {
  /** Available options */
  options: unknown[];
}

/** Props for CheckboxInput component */
export interface CheckboxInputProps extends Omit<BaseInputProps, 'value'> {
  /** Boolean value */
  value: boolean;
}

/** Props for CheckboxSet component */
export interface CheckboxSetProps extends BaseInputProps {
  /** Option keys */
  keys: (string | number)[];
  /** Option prefix labels */
  prefixStrings: string[];
}
