/**
 * ports barrel —— 面向实现者的四个契约（引擎无关，D-16）。
 *
 * 只做纯类型再导出：`isolatedModules` 下 `export type` 是仓内类型再导出的既有写法。
 * 四个 port 各自有不同消费者、在不同阶段长大（D-14），因此一文件一 port，barrel 只做汇总。
 * 只 import `lib/ports/` 内的同级文件，绝不 import `../index`（会形成环，`no-circular` 会拒绝）。
 */
export type { EngineAdapter } from './engine';
export type { FsPort } from './fs';
export type { HostPort } from './host';
export type { PreviewAdapter } from './preview';
