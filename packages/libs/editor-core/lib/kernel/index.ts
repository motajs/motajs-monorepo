// kernel 文件夹 barrel —— 汇总本文件夹各文件的公开面（内核 + 撤销契约）
// 只用同层单段再导出（`./core` 等），绝不 import `../index`（会形成环，`no-circular` 会拒绝）
export * from './core';
export * from './diagnostics';
export * from './errors';
export * from './types';
export * from './undoManager';
