# Phase 05.1: editor-core 接口与实现整改 — INTERFACE-NAME.md

> **Status: PROVISIONAL — 待用户在每个 plan 的简报里逐节确认。** 按 `AGENTS.md` §Project Rules，
> 任何**重要命名**（文件名 / 目录名 / 接口名 / 类名 / 方法名 / 类型别名 / 导出符号名 / 新门禁脚本名 /
> 依赖规则名）都必须先写在本文件里、**并说明它是干什么的**，经用户确认后才可落盘。函数体内的
> `let`/`const` 局部变量不受此限。
>
> **本文件是「执行前」的规划产物**：它由 planner 在写计划时一并产出（不是某个执行任务创建的）。
> 每个接口定义计划的 Task 1 **校验本文件存在且与计划一致**，绝不新建它；任何未列在此处的名字
> 都不得写进代码。
>
> 方法一律写 `类名.方法名`（如 `IUndoManager.execute`）；自由函数才裸写。
>
> 本阶段是**纯重构**：`@motajs/editor` 只做「被强制的最小机械跟随」（见 Plan 08），不改功能与 UI。

---

## 命名约定

- 代码文件名用**小驼峰**；只有 React 组件（`.tsx`）用大驼峰。本阶段不新建 `.tsx`。
- 会被 `implements` 的接口统一加 **`I` 前缀**（D-07）；每个类必须 `implements` 对应接口。
- 改名后的**旧名一律以别名继续导出**（D-18），使 `@motajs/editor` 不改也能编译：
  - 类型别名：`export type { INew as Old } from '...'`（**不得**用普通 `export`，`isolatedModules` 会报 TS1205）。
  - 值别名：`export { NewClass as OldClass } from '...'`。
- 全程相对路径导入（底层 `lib/kernel`、`lib/ports` 内不得用 `@/` 别名；dependency-cruiser 不解析别名）。
- **分层不新建文件夹**：底层（core 本身）**物理上就是现有的 `lib/kernel/` + `lib/ports/`**；包内默认实现留在
  `lib/resources/`、`lib/edit/`、`lib/table/`、四个能力目录、`lib/react/`。分层只由一条**依赖规则**保证：
  `lib/kernel/**` 与 `lib/ports/**` 不得 import 默认实现目录。**不新建 `lib/core/`**。

---

## Plan 05.1-01 — 底层接口定义

**这个计划只定义「底层（core 本身）怎么管撤销」的接口，一行实现都不写。**
底层只认识两件事：一个「能被撤销的操作」长什么样，一个「管操作先后」的管理器长什么样。

| 名字 | 种类 | 它是干什么的 |
|------|------|--------------|
| `packages/libs/editor-core/lib/kernel/` | 目录（现有） | 底层的「管理」半边：内核组合根 + 能力登记契约 + 诊断 + 启动错误（**本阶段不新建、不搬**）。 |
| `packages/libs/editor-core/lib/ports/` | 目录（现有） | 底层的「接口」半边：引擎/宿主/预览/文件读写（`fs.ts`）四个 port（**本阶段不新建、不搬**）。 |
| `packages/libs/editor-core/lib/kernel/types.ts` | 文件（新） | 底层对外类型的集中出口（D-08）。Plan 03 会把内核的三个接口也并进来。 |
| `packages/libs/editor-core/lib/kernel/undoTypes.ts` | 文件（新） | 撤销契约的集中声明处：管理器接口 + 可撤销操作接口 + 历史条目/状态类型。 |
| `OperationMeta` | 接口 | 一次操作的元数据：给人看的标签 `label`、失败定位用的 `stage`，外加可选的自报影响路径 `paths`（取代旧 `targets` 里的路径，见下）。 |
| `OperationMeta.paths` | 成员（可选） | 操作**自己上报**它这次改动了哪些路径，供历史面板显示。旧实现从快照目标 `targets` 里抄路径；删掉快照后唯一诚实的来源就是操作本身。不给就退化为空数组。 |
| `AppliedOperation<T>` | 接口 | 一次「应用」的结果：`value`（操作的返回值）、`inverse`（能把它撤回来的逆操作）、`changed`（是否真的改了东西，没改就不入历史）。 |
| `IEditorOperation<T>` | 接口 | **一次可撤销的编辑**。只有 `meta` 与 `apply()`：成功时 `apply()` 自己返回逆操作。底层不认识操作细节。它取代旧的 `EditorOperation`（去掉快照载荷 `targets`）。 |
| `IEditorOperation.apply` | 方法 | 执行这次编辑；成功时把「怎么撤回来」作为 `AppliedOperation.inverse` 交出来。 |
| `IUndoManager` | 接口 | **撤销操作栈管理器**：只记先后、在撤销时调该操作的逆、重做时再调原操作。**不存快照**。 |
| `IUndoManager.execute` | 方法 | 执行一个操作；成功且确有改动就记一条历史。 |
| `IUndoManager.undo` | 方法 | 撤销最近一条：对当前条目存的逆操作调 `apply()`。 |
| `IUndoManager.redo` | 方法 | 重做刚撤销的一条：再对原操作调 `apply()`。 |
| `IUndoManager.clear` | 方法 | 清空历史（不入队、不触发任何回调）。 |
| `IUndoManager.store` | 成员 | 只读的状态容器（`@tanstack/store` 的 `Store`），供 React `useOperationHistory` 订阅历史条目、当前指针与 busy。 |
| `OperationHistoryEntry` | 接口 | 对外的**一条历史记录**：`id` / `label` / `timestamp` / `paths`（路径来自 `IEditorOperation.meta.paths`）。 |
| `OperationHistoryState` | 接口 | 管理器的对外状态：`entries`（历史记录）、`current`（当前指针）、`busy`（是否有操作在排队）。 |
| `UndoManager` | 类 | `IUndoManager` 的实现（**Plan 04 落地**，本计划只声明接口）。 |
| `EditorOperation` | 类型别名（过渡） | 旧名，指向 `IEditorOperation`（D-18）。`@motajs/editor` 靠它继续编译，Phase 11 删除。 |
| `OperationHistory` | 值别名（过渡） | 旧类名，指向 `UndoManager`（D-18）。编辑器 `new OperationHistory()` 继续可用，Phase 11 删除。 |
| `bottom-layer-must-not-import-upper-layers` | dependency-cruiser 规则名 | 待 Plan 03 落地的门禁规则：底层 `lib/kernel/**` + `lib/ports/**` 不得 import 包内默认实现（`resources`/`edit`/`table`/`code`/`map`/`asset`/`shell`/`react`）。 |

> **已确认的接口形状选择（候选 A，研究推荐）：** 操作自带逆（`apply()` 返回 `inverse`），而不是给每个操作类再加显式 `undo()`/`redo()`。
> 理由：它与仓库现有的 `AppliedOperation.inverse`、以及「组合操作按已成功子操作的逆序回退」完全同构，行为等价最容易证明。
> 用户可在 Plan 01 的简报上改选候选 B（显式 `undo`/`redo`）。

---

## Plan 05.1-02 — 包内默认实现接口与约定定义

**这个计划只定义「包内默认实现层」要用的接口，一行实现都不写。**
默认实现就是表格/地图/代码编辑这类功能：它们**自己持有自己的内容**，只依赖底层。

| 名字 | 种类 | 它是干什么的 |
|------|------|--------------|
| `packages/libs/editor-core/lib/edit/types.ts` | 文件（新） | 编辑层（默认实现）对外类型的集中出口（D-08）。 |
| `IPatchableResource<T>` | 接口 | **能被 patch 的资源**的最小契约：`path`（身份）、`raw()`（拿到底层文本内容处理器）、`mutate(recipe)`（改内容）。让 patch 操作不必认识任何引擎/编辑器类型。它取代旧的 `PatchableResource`。 |
| `packages/libs/editor-core/lib/resources/interfaces.ts` | 文件（改） | 资源层类型集中处；本计划补两个资源视图接口（`ReadonlySignal`/`Content` 已在此文件或其单行依赖里，避免新增环）。 |
| `IResourceView<T>` | 接口 | **可读资源视图**：`id`、`content`（只读响应式 signal）、`snapshot()`、`value()`、`subscribe()`。它取代旧的 `ResourceView`。 |
| `ILoadableResource<T>` | 接口 | 在 `IResourceView<T>` 之外再加 `ensureLoaded()` / `reload()` / `waitForSettled()`。它取代旧的 `LoadableResource`。 |
| `packages/libs/editor-core/lib/table/types.ts` | 文件（新） | 表格专属类型声明处。 |
| `ActionType` | 类型别名 | 表格动作的三种类型：`'change' \| 'add' \| 'delete'`。 |
| `Action` | 类型别名 | 一条表格动作：`[ActionType, 字段路径字符串, 值]`。字符串路径属表格层（用户反馈 #3）。 |
| 内容持有约定（无新接口） | 约定（文字） | 默认实现之间**不引入新的「统一内容抽象」**：每个编辑系统自己持有内容、经 `IResourceView`/`ILoadableResource` 对外暴露。这是 D-03 的一体两面。 |

---

## Plan 05.1-03 — 底层依赖门禁 + 底层 IO 清零（不新建目录、不搬文件）

| 名字 | 种类 | 它是干什么的 |
|------|------|--------------|
| `packages/libs/editor-core/lib/kernel/core.ts` | 文件（改） | 内核组合根，**留在原地**；本计划只把三个接口收拢到 `lib/kernel/types.ts`（见下），它改为 import。 |
| `packages/libs/editor-core/lib/kernel/types.ts` | 文件（改） | 底层的唯一对外类型出口：Plan 01 的撤销契约类型 + 本计划并入的内核三接口（`CapabilityRegistrar`/`EditorCoreConfig`/`EditorCore`）。 |
| `packages/libs/editor-core/lib/ports/engine.ts` | 文件（改） | 引擎适配器契约，**留在原地**；本计划把逻辑 id 谓词 `isValidResourceId` 连同 `LOGICAL_ID_PATTERN`/`RESERVED_IDS`/原型污染防线归它自持，并让 `lib/resources/resourceRegistry.ts` 反向 import（消除底层依赖上层的倒挂）。 |
| `lib/kernel/**` + `lib/ports/**` | 依赖规则（现有目录） | 底层 = 这两个**现有**目录；`lib/kernel/**` + `lib/ports/**` 不得 import 默认实现目录（`resources`/`edit`/`table`/`code`/`map`/`asset`/`shell`/`react`）。 |
| `bottom-layer-io-free` | 门禁断言名 | 加在 `scripts/verify/coreBoundaries.js` 里的断言：底层 `lib/kernel/**` + `lib/ports/**` 不得出现文件读写调用（如 `readFile(`/`writeFile(`、`this.fs`），且必须有两极性证明。 |
| `kernel-must-not-import-capabilities` | dependency-cruiser 规则名（**删除**，意图并入 `bottom-layer-must-not-import-upper-layers`） | 旧规则把 `lib/index.ts` 也当作内核、禁止它 import 能力目录。05.1 之后 `lib/index.ts` 是包的**公开面**，必须能再导出表格等能力符号（Plan 05 依赖这一点），故删除该规则、并入只覆盖 `lib/kernel/**` + `lib/ports/**` 的新规则；新规则的 `to` 是旧规则 `to` 的超集，底层覆盖不降低，并新增覆盖 `lib/ports/**`。 |

> **归属决定（研究开放点 c）：** `ResourceRegistry` **留在 `lib/resources/`（包内默认实现层）**，不进底层。
> 理由：它登记的是「内容视图」，而 D-03 明确底层不认识被编辑内容。底层自己的登记机制是 `EditorCore.registerCapability`。
> 本阶段对它的唯一改动是把共享的逻辑 id 谓词 `isValidResourceId` 改为**底层持有**、`resourceRegistry.ts` 反向 import。
> **文件 IO 决定（D-02）：** `fileHandler*`/`binaryFileHandler`/`persistExecutor`/`persistenceMonitor`/`fileResource`
> 全部留在 `lib/resources/`；底层只保 `lib/ports/fs.ts` 一个纯接口文件，且**永不调用**。
> **公开面标签不动：** `.` 内容标签仍是 `kernel+resources+edit-exports`（`coreExports.js` 与 `subpathStatus.json` 都不改，因为目录名没变）。

---

## Plan 05.1-04 — 撤销重构实现

| 名字 | 种类 | 它是干什么的 |
|------|------|--------------|
| `packages/libs/editor-core/lib/kernel/undoManager.ts` | 文件（新） | 撤销操作栈管理器的实现：串行队列 + 容量 100 + 无快照。 |
| `UndoManager.constructor` | 方法 | 无参构造；per-instance 的 `Store` 与内部队列都在实例字段上，因此两个实例天然互不干扰。 |
| `UndoManager.execute` / `UndoManager.undo` / `UndoManager.redo` / `UndoManager.clear` | 方法 | 见 Plan 01 的 `IUndoManager.*` 说明。 |
| `packages/libs/editor-core/lib/__tests__/undoManager.invariants.test.ts` | 文件（新，取代旧 `lib/edit/__tests__/operationHistory.invariants.test.ts`） | 纯内存不变量测试：容量 100、逆操作 undo/redo、redo 截断、无改动不入历史、组合失败按逆序回退。**删除**所有 target/snapshot 用例。 |
| `packages/libs/editor-core/lib/edit/undoSystem.ts` | 文件（删除） | 旧的快照委托接缝，D-05 明确移除。 |
| `packages/libs/editor-core/lib/edit/operationHistory.ts` | 文件（删除） | 旧管理器文件；类型迁入 `lib/kernel/undoTypes.ts`，实现迁入 `lib/kernel/undoManager.ts`。 |
| `OperationTarget` / `operationPathTarget` / `dataResourceTarget` / `captureSystems` / `restoreSystems` / `systemsBefore` / `systemsAfter` | 符号（删除） | 快照式撤销的全部残骸（D-05）。 |

> **兼容取舍（已定，D-18 更新后）：** 上面这组删除会击穿 `@motajs/editor` 的
> `src/project/history/*` 与 `src/appInstances.ts`（它们 import `OperationTarget`/`operationPathTarget` 并在
> `appInstances.ts` 调 `operationHistory.registerUndoSystem(...)`）。用户已选 **A：core 彻底删除 +
> 编辑器做最小机械跟随**——不保留任何弃用兼容导出。编辑器改动集中在 **05.1-08**（唯一触碰
> `@motajs/editor` 的计划），它与 05.1-04 **同处 wave 3 且排在 05.1-04 之后**，二者在同一波完成，
> wave 边界全仓保持可编译/测试绿。

---

## Plan 05.1-05 — 表格专用代码归位

| 名字 | 种类 | 它是干什么的 |
|------|------|--------------|
| `packages/libs/editor-core/lib/table/fieldPath.ts` | 文件（移动） | 由 `lib/edit/fieldPath.ts` 移入：把 `"['a']['b']"` 这种字符串路径解析/读写的表格工具（含 `fieldToDataAttr` 这类 DOM 属性转换）。 |
| `packages/libs/editor-core/lib/table/action.ts` | 文件（移动） | 由 `lib/edit/action.ts` 移入：表格动作 `Action` 的应用与逆运算生成；含 `cloneActionValue`。 |
| `packages/libs/editor-core/lib/table/patchResourceOperation.ts` | 文件（移动） | 由 `lib/edit/operations.ts` 拆出：`ResourcePatchOperation` 类与 `patchResourceOperation` 工厂（因为「用表格动作 patch 资源」本身就是表格层的事）。 |
| `ResourcePatchOperation` | 类 | `IEditorOperation` 的实现：对一个 `IPatchableResource` 应用一组表格动作，并产出自带逆的操作。 |
| `patchResourceOperation` | 函数 | 工厂，返回一个 `IEditorOperation`；公开名保持 `patchResourceOperation` 不变，编辑器 shim 无需改。 |
| `cloneActionValue` | 函数 | 深拷贝「原值」以便生成逆动作。**保留**，不换 `structuredClone`——后者遇函数/DOM 节点会抛错、不保留原型与属性描述符。 |
| `lib/table/index.ts` | 文件（保持空 barrel） | `./table` 仍是空 barrel（`export {}`）；被移动的表格符号**只从根 `.` 再导出**，否则 `subpathStatus.json`/`coreExports.js` 会红。 |

---

## Plan 05.1-06 — 接口改名（`I` 前缀）与类 `implements`

| 名字 | 种类 | 它是干什么的 |
|------|------|--------------|
| `IFsPort` | 接口（改名） | 由 `FsPort` 加 `I` 前缀：宿主的 7 个文件读写操作。 |
| `IHostPort` | 接口（改名） | 由 `HostPort` 加 `I` 前缀：宿主端点契约。 |
| `IEngineAdapter` | 接口（改名） | 由 `EngineAdapter` 加 `I` 前缀：引擎适配器入口形状。 |
| `IPreviewAdapter` | 接口（改名） | 由 `PreviewAdapter` 加 `I` 前缀：预览适配器占位。 |
| `IRecoverableResource<T>` | 接口（改名） | 由 `RecoverableResource` 加 `I` 前缀：公共恢复协议。 |
| `IResourceView<T>` / `ILoadableResource<T>` | 接口（改名） | 见 Plan 02；本计划把旧名 `ResourceView`/`LoadableResource` 变成别名。 |
| `IPatchableResource<T>` | 接口（改名） | 见 Plan 02；本计划把旧名 `PatchableResource` 变成别名。 |
| `FsPort` / `HostPort` / `EngineAdapter` / `PreviewAdapter` / `RecoverableResource` / `ResourceView` / `LoadableResource` / `PatchableResource` | 类型别名（过渡） | 旧名，分别指向对应的 `I*` 新名（D-18），Phase 11 删除。 |
| `ComputedResource` / `CompositeOperation` / `ResourcePatchOperation` / `UndoManager` / `FileHandler` / `FileHandlerManager` / `FileResource` / `PersistenceMonitor` / `PersistExecutor` / `DataHandler` / `JsonDataHandler` / `BinaryFileHandler` / `ResourceRegistry` | 类 | 每个类都必须 `implements` 一个接口（D-07）；凡有对应接口者显式写上 `implements`。 |

---

## Plan 05.1-07 — 文件形态扫尾 + 公开面/门禁收口

| 名字 | 种类 | 它是干什么的 |
|------|------|--------------|
| `scripts/verify/coreImportType.js` | 文件（新门禁脚本） | D-11 的可失败检查：扫 `lib/**/*.{ts,tsx}` 里行首的 `import type`，真实树必须 0 条、合成 fixture 必须逐行命中，并证明删除 fixture 后不存在。 |
| `coreImportType` | 门禁前缀 | 该脚本的失败信息前缀（与 `coreModuleState`/`coreBoundaries` 同族）。 |
| `IFileHandlerManager` | 接口（新） | `FileHandlerManager` 的契约：按路径加载/重载/清理/查询文件处理器。让这个类不再「裸」。 |
| `IPersistExecutor` | 接口（新） | `PersistExecutor` 的契约：排程某个路径的持久化意图与查询状态。 |
| `IPersistenceMonitor` | 接口（新） | `PersistenceMonitor` 的契约：项目级持久化状态、flush、失败记录与重试。 |
| `IResourceRegistry` | 接口（新） | `ResourceRegistry` 的契约：按逻辑 id 登记/取用/查询资源。 |
| `packages/libs/editor-core/lib/kernel/types.ts` | 文件（收口） | 底层的唯一对外类型出口：内核三个接口（`CapabilityRegistrar`/`EditorCoreConfig`/`EditorCore`）+ 撤销契约类型都从这里汇总。 |
| `packages/libs/editor-core/lib/resources/types.ts` | 文件（收口） | 资源层唯一对外类型出口。 |
| `packages/libs/editor-core/lib/edit/types.ts` | 文件（收口） | 编辑层唯一对外类型出口。 |
| `packages/libs/editor-core/lib/table/types.ts` | 文件（收口） | 表格层唯一对外类型出口。 |
| `getParentField` | 函数（收口） | 去掉 `export const getParentFieldPath = getParentField` 这种「把函数赋给临时常量」的别名写法：两个名字都保留为真正的函数导出，旧名以别名再导出。 |

---

## Plan 05.1-08 — 编辑器适配层机械跟随（**唯一触碰 `@motajs/editor` 的计划**）

> **这一节的名字是 `@motajs/editor` 侧的文件，不是 core 的文件。** 本计划被 D-05/D-19 强制：
> 快照撤销不存在了，编辑器里「注册视口快照」和「操作里的快照目标」就无处安放。**纯机械**——只删
> 失效的老接口用法、跟随改名、把编辑器那条「数据 undo 恢复视口」的测试改成记录 D-19 的新行为；
> **不改任何功能、UI 或宿主协议。**
>
> **波次：** 本计划与 05.1-04 **同处 wave 3**，且必须排在 05.1-04 之后执行（先删 core 旧符号，再修
> 编辑器）；两者在同一波完成，wave 末全仓保持可编译/测试绿。

| 名字 | 种类 | 它是干什么的 |
|------|------|--------------|
| `packages/apps/editor/src/appInstances.ts` | 文件（改） | 删掉 `operationHistory.registerUndoSystem(...)` 整块及其不再使用的 import。 |
| `packages/apps/editor/src/project/history/operations.ts` | 文件（改） | 转发 shim：只删 `operationPathTarget`（值）与 `OperationTarget`（类型）两条已消失的再导出，保留 `compositeOperation`/`patchResourceOperation` 与其余类型别名——整个文件必须继续是「只转发」。 |
| `packages/apps/editor/src/project/history/index.ts` | 文件（改） | 删掉 `operationPathTarget` 与 `type OperationTarget` 两个已消失的再导出。 |
| `packages/apps/editor/src/project/history/materialOperations.ts` | 文件（改） | 删掉 `operationPathTarget` 用法与操作的 `targets` 字段。 |
| `packages/apps/editor/src/project/history/textFileOperations.ts` | 文件（改） | 删掉 `OperationTarget`/`textFileTarget` 与 `targets` 字段。 |
| `packages/apps/editor/src/project/history/viewportOperations.ts` | 文件（改） | 删掉两个操作类的 `readonly targets = []` 空字段。 |
| `packages/apps/editor/src/project/commands/animationCommands.ts` | 文件（改） | 删掉 `OperationTarget` import 与 `targets` 字段。 |
| `packages/apps/editor/src/project/history/__tests__/operationHistory.test.ts` | 文件（改） | 按 D-19 改写：删掉「用快照目标恢复失败操作」用例与「数据 undo 顺带恢复视口」断言，记录新行为（撤销数据改动不再连带恢复地图视口）。 |

---

*Materialized 2026-09-28 as a pre-execution planning artifact. Any further important name must be added
here and confirmed before it lands in code.*
