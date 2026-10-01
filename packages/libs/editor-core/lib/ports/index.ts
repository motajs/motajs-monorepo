// ports 文件夹 barrel —— 面向实现者的契约（引擎无关，D-16）
// 汇总 `./engine` 的逻辑/值（谓词、版本常量、错误类、定义函数、拓扑排序）与 `./types` 的类型
// （四个契约 + 资源描述符类型）；只用同层单段再导出，绝不 import `../index`（会形成环，`no-circular` 会拒绝）
export * from './engine';
export * from './types';
