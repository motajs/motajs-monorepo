// SHIM(phase4)
/**
 * 临时应用实例模块（composition-root-lite，D-07）—— Phase 11 由真正的组合根接管后删除。
 *
 * 这里是本阶段**唯一**的 `new PersistenceMonitor(` 站点：`@motajs/editor-core` 只导出 class，
 * 实例化只发生在适配层。`src/fs/PersistenceMonitor.ts` 的 shim 会把这里的实例以旧名
 * `persistenceMonitor` 转发出去，使「同一对象被 FileHandler、DataResource.persistStatus、UI/草稿守卫
 * 与测试共同观察」这一不变量成立（两个实例会静默破坏它们）。
 *
 * 后续计划会在此文件继续挂载 `operationHistory` 实例（04-03，已完成）。
 */
import { FileHandlerManager as FileHandlerManagerClass, PersistenceMonitor } from '@motajs/editor-impl';
import { OperationHistory, type FsPort } from '@motajs/editor-core';
import { fs } from '@/services/fs';
import { captureEditorViewport, restoreEditorViewport, type EditorViewport } from '@/project/history/viewport';

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

/**
 * 编辑器的单一 `FileHandlerManager` 实例（D-06/D-07）。
 *
 * core 只导出 class；本文件是 `packages/apps/editor/src` 下**唯一**构造 `FileHandlerManager` 的站点
 * （见下方 `export const FileHandlerManager` 一行）。导出的名字保持旧的实例名 `FileHandlerManager`（editor 代码把它当值使用），因此 core 的类
 * 必须用模块局部别名 `FileHandlerManagerClass` 引入——同作用域的 `import { FileHandlerManager }`
 * 与 `export const FileHandlerManager` 是 TS2440 重声明错误。
 */
export const FileHandlerManager = new FileHandlerManagerClass({ fs: fsPort, persistenceMonitor });

/**
 * 编辑器的单一 `OperationHistory` 实例（D-06/D-07）。
 *
 * core 只导出 class；本文件是 `packages/apps/editor/src` 下**唯一**构造 `OperationHistory` 的站点。
 */
export const operationHistory = new OperationHistory();

/**
 * 把编辑器的 viewport 注册成 core 的 `UndoSystem`（D-03）。
 *
 * 这是对旧 `operationHistory.ts` 直接调 `captureEditorViewport`/`restoreEditorViewport` 并记录
 * `beforeViewport`/`afterViewport` 的替代：core 只认识 `{ id, capture, restore }`，完全不认识视口语义。
 * 注册顺序定义还原顺序（此处只有一个系统）。返回的 disposer 刻意不用：本模块与页面同生命周期。
 */
operationHistory.registerUndoSystem<EditorViewport | null>({
  id: 'viewport',
  capture: () => captureEditorViewport(),
  restore: (snapshot) => restoreEditorViewport(snapshot),
});
