// ports barrel —— 面向实现者的契约（引擎无关，D-16）
// 汇总 ports 层两个文件：`./engine` 的**逻辑/值**（谓词、版本常量、错误类、定义函数、拓扑排序）
// 与 `./types` 的**类型**（四个契约 + 描述符类型）。只 import `lib/ports/` 内的同级文件，
// 绝不 import `../index`（会形成环，`no-circular` 会拒绝）
export {
  defineEngine,
  ENGINE_ADAPTER_API_VERSION,
  EngineDefinitionError,
  isValidResourceId,
  RESERVED_IDS,
  resolvePreloadOrder,
} from './engine';
export type {
  EngineDescription,
  IEngineAdapter,
  IFsPort,
  IHostPort,
  IPreviewAdapter,
  PreloadStrategy,
  ResourceDependencies,
  ResourceDescriptor,
} from './types';
