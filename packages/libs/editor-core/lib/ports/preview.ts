/**
 * `PreviewAdapter` —— 预览适配器的**最小占位**（引擎无关，D-14）。
 *
 * Phase 3 只留一个非空成员，使接口是**真实契约**而非空壳（空接口既违反 D-14 的「不写空接口」，
 * 也会被 `@typescript-eslint/no-empty-object-type` 警告）。预览的启动钩子由 **Phase 11** 通过一次
 * 显式的接口演进扩充。
 */
export interface PreviewAdapter {
  /** 适配器实现的契约版本（`PreviewAdapter.apiVersion`）。 */
  readonly apiVersion: string;
}
