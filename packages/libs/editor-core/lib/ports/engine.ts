/**
 * `EngineAdapter` —— 引擎适配器的**入口形状**（引擎无关，D-14）。
 *
 * Phase 3 只声明「可被识别、可被版本核对」的最小形状；完整的适配器契约由 **Phase 5** 通过一次
 * 显式的接口演进扩充（给已发布的接口加成员对实现者是破坏性变更，因此本阶段不猜、不写空接口）。
 *
 * `apiVersion` 沿用仓内「版本化契约」的约定（参照 `RUNTIME_PROTOCOL_VERSION`）。
 */
export interface EngineAdapter {
  /** 适配器的逻辑身份，供 Phase 5 以它作为引擎描述的键（`EngineAdapter.id`）。 */
  readonly id: string;

  /** 适配器实现的契约版本（`EngineAdapter.apiVersion`）。 */
  readonly apiVersion: string;
}
