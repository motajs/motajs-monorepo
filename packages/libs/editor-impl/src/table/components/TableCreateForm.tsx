// 可复用的新建表格表单契约：收集一个表格名并在当前目录下建一对文件。

export interface ITableCreateFormProps {
  /** 新建所在目录路径；根目录为空串 */
  readonly directory: string;
  /** 名称校验 / 写入失败时的提示文案；缺省时不显示 */
  readonly error?: string;
  /** 确认新建回调，携带所在目录与表格名 */
  onCreate(directory: string, name: string): void;
}
