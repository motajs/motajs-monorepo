export interface IResourceIdentifier {
  /** 资源类型，由外部的枚举真正进行定义 */
  readonly type: number;
  /** 资源的标识符 */
  readonly id: string;
}
