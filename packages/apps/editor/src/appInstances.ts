// SHIM(phase4)
/**
 * 临时应用实例模块（composition-root-lite，D-07）—— Phase 11 由真正的组合根接管后删除。
 *
 * 这里是本阶段**唯一**的 `new PersistenceMonitor(` 站点：`@motajs/editor-core` 只导出 class，
 * 实例化只发生在适配层。`src/fs/PersistenceMonitor.ts` 的 shim 会把这里的实例以旧名
 * `persistenceMonitor` 转发出去，使「同一对象被 FileHandler、DataResource.persistStatus、UI/草稿守卫
 * 与测试共同观察」这一不变量成立（两个实例会静默破坏它们）。
 *
 * 后续计划会在此文件继续挂载 `FileHandlerManager` 与 `operationHistory` 实例（04-02/04-03）。
 */
import { PersistenceMonitor, type FsPort } from '@motajs/editor-core';
import { fs } from '@/services/fs';

/**
 * 单一的 `FsPort` 绑定。
 *
 * `FsPromiseApi`（`fs.promises`）结构上是 `FsPort` 的超集（多一个 `writeMultiFiles`），因此直接赋值、
 * 不做任何断言——断言会掩盖契约检查（D-05）。
 *
 * 导出而非模块私有：它的首个读取方（`FileHandlerManager` 的构造）要到 04-02 才出现；在那之前，
 * 一个无人读取的模块级绑定会被 editor program 的 `noUnusedLocals` 判为 TS6133。
 */
export const fsPort: FsPort = fs.promises;

export const persistenceMonitor = new PersistenceMonitor();
