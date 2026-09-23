/**
 * `HostPort` —— core 依赖的宿主端点解析契约（引擎无关，D-14）。
 *
 * 成员名是宿主**现有的逻辑端点名**，不是新造词汇：`endpoints` 的四项与两个可选端点直接对应
 * `EditorEnvironment.endpoints`（`packages/apps/editor/src/environment.ts`）。core **不 import**
 * 任何宿主类型——契约由 core 声明、由适配器实现，绝不反向。
 *
 * 这里只表达「端点在哪里」；core 不解析 DOM、不读环境全局、不发起传输（PORT-02 由静态门禁保证，
 * 传输由适配器负责）。
 */
export interface HostPort {
  /** 必需端点的逻辑名 → URL（`HostPort.endpoints`）。 */
  readonly endpoints: Readonly<Record<'fs' | 'runtime' | 'preview' | 'project', string>>;

  /** 可选的文档端点（`HostPort.docs`）。 */
  readonly docs?: string;

  /** 可选的自更新端点（`HostPort.update`）。 */
  readonly update?: string;
}
