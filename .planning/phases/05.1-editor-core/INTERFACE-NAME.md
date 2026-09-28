# Phase 05.1: editor-core 接口与实现整改 — INTERFACE-NAME.md

> **Status: PROVISIONAL — 待用户在每个 plan 的简报里逐节确认。** 按 `AGENTS.md` §Project Rules，
> 任何**重要命名**（文件名 / 目录名 / 包名 / 接口名 / 类名 / 方法名 / 类型别名 / 导出符号名 / 新门禁脚本名 /
> 依赖规则名 / subpath 名）都必须先写在本文件里、**并说明它是干什么的**，经用户确认后才可落盘。
> 函数体内的 `let`/`const` 局部变量不受此限。
>
> **本文件是「执行前」的规划产物**：它由 planner 在写计划时一并产出（不是某个执行任务创建的）。
> 每个接口定义计划的 Task 1 **校验本文件存在且与计划一致**，绝不新建它；任何未列在此处的名字
> 都不得写进代码。
>
> 方法一律写 `类名.方法名`（如 `IUndoManager.execute`）；自由函数才裸写。
>
> 本阶段是**纯重构**：`@motajs/editor` 只做「被强制的最小机械跟随」（见 Plan 08），不改功能与 UI。

---

## 本次重排的核心：从「一个包内分层」改为「两个包」

> **这是本轮修订唯一的结构性改动，取代此前「一个包、不建文件夹」的方案（D-01 已据用户指示改写）。**

| | `@motajs/editor-core`（底层） | `@motajs/editor-impl`（新包，默认实现层） |
|---|---|---|
| 职责 | 只**定义接口** + **做管理**（能力登记、撤销操作栈）。不读文件、不持有编辑内容。 | 表格/地图/代码编辑这类**基本编辑功能**；**自己持有自己的内容**。 |
| 物理内容 | 现有 `lib/kernel/**` + `lib/ports/**`（保留、不搬文件夹） | 现有 `lib/resources/`、`lib/edit/`、`lib/table/`、能力目录（`code`/`map`/`asset`/`shell`）、`lib/react/`（**整体迁入**） |
| 对外 subpath | `.`（仅此一个） | `.`、`./code`、`./table`、`./map`、`./asset`、`./shell`、`./react` |
| 依赖方向 | **绝不** import `editor-impl` | **可以** import `editor-impl` ← `editor-core`（单向） |

- 引擎层（mota-js，`@motajs/editor`）在更上层，**同时依赖这两个包**。
- `@motajs/editor` 的 18 个 `// SHIM(phase4)` 转发文件按**它们转发的符号属于哪个包**改指新包
  （转发符号在底层的 → `@motajs/editor-core`；在默认实现的 → `@motajs/editor-impl`）；这次改指是
  **机械替换说明符**，集中在 Plan 08（唯一触碰 `@motajs/editor` 的计划），不改任何行为/UI/宿主协议。

**一句话**：`editor-core` 只留「定义 + 管理」；其它编辑功能整包搬到新 `editor-impl`；谁都不能反向依赖。

---

## 命名约定

- 代码文件名用**小驼峰**；只有 React 组件（`.tsx`）用大驼峰。本阶段不新建 `.tsx`（`CoreProbe.tsx` 是搬迁）。
- 会被 `implements` 的接口统一加 **`I` 前缀**（D-07）；每个类必须 `implements` 对应接口。
- 改名后的**旧名一律以别名继续导出**（D-18），使 `@motajs/editor` 除机械跟随外不改也能编译：
  - 类型别名：`export type { INew as Old } from '...'`（**不得**用普通 `export`，`isolatedModules` 会报 TS1205）。
  - 值别名：`export { NewClass as OldClass } from '...'`。
- 全程相对路径导入（底层 `lib/kernel`、`lib/ports` 内不得用 `@/` 别名；dependency-cruiser 不解析别名）。
- **撤销契约类型写进 `types.ts`**（`lib/kernel/types.ts`），**不新建** `undoTypes.ts` 之类文件（用户明确）。
  底层类型只有一个出口：`lib/kernel/types.ts`（撤销契约 + 内核三接口）。
- **不新建 `lib/core/`**：底层物理上就是 `editor-core` 的现有 `lib/kernel/` + `lib/ports/`。
- **包内 subpath 目录**：能力目录（`code`/`map`/`asset`/`shell`）与 `table`/`react` 迁入 `editor-impl` 后仍是
  各自 `index.ts` 空 barrel / 探针 barrel，**不得互相 import**（由 capability 规则守）。

---

## 新包与目录总览（执行前请逐条确认）

| 名字 | 种类 | 它是干什么的 |
|------|------|--------------|
| `packages/libs/editor-impl/` | 目录（新包根） | 新包 `@motajs/editor-impl` 的根；与 `packages/libs/editor-core/` 平级。 |
| `packages/libs/editor-impl/package.json` | 文件（新） | 新包清单：`private: true`、`type: "module"`、`sideEffects: false`、7 个 subpath exports、9 个 `catalog:default` peer（`@douyinfe/semi-ui` optional）、`dependencies` 含 `@motajs/editor-core: workspace:*`；`scripts` 恰好 `typecheck`+`test`（无 build）。 |
| `packages/libs/editor-impl/tsconfig.json` | 文件（新） | `extends @motajs/config/tsconfig.lib.base.json`；`paths` 的 `@/*` 指向本包 `lib/*`；`include` 本包 `lib`。 |
| `packages/libs/editor-impl/vitest.config.ts` | 文件（新） | 与 editor-core 同款（react 插件 + `resolvePlugin` + jsdom + `include: ['lib/**/*.test.{ts,tsx}']`）。 |
| `packages/libs/editor-impl/lib/index.ts` | 文件（新） | 新包的 `.` 公开面 barrel：具名再导出 `resources`/`edit`/`table` 的公开名（值 + 类型分开、类型用 `export type`）。**不**再导出能力 subpath。 |
| `packages/libs/editor-impl/lib/{code,table,map,asset,shell}/index.ts` | 文件（迁入） | 五个能力/表格目录的 barrel，随目录整体迁自 `editor-core/lib/`；内容与现状一致（多为 `export {}`）。 |
| `packages/libs/editor-impl/lib/react/{index.ts,CoreProbe.tsx}` | 文件（迁入） | `./react` 公开面：`useOperationHistory` 值 + `CoreProbe` 探针。`CoreProbe.tsx` 的路径被门禁硬编码，本阶段只改门禁里的路径常量、不删文件。 |
| `packages/libs/editor-impl/lib/resources/**`、`lib/edit/**` | 目录（迁入） | 现有资源层与编辑层整体迁入（`git mv`），内部相对导入不变。 |

> **已确认的接口形状选择（候选 A）：** 操作自带逆（`apply()` 返回 `inverse`），而不是给每个操作类再加显式 `undo()`/`redo()`。
> 理由：它与仓库现有的 `AppliedOperation.inverse`、以及「组合操作按已成功子操作的逆序回退」完全同构，行为等价最容易证明。
> 用户可在 Plan 01 的简报上改选候选 B（显式 `undo`/`redo`）。

---

## Plan 05.1-01 — 底层（`editor-core`）撤销契约定义

**这个计划只定义「底层（core 本身）怎么管撤销」的接口，一行实现都不写。**
底层只认识两件事：一个「能被撤销的操作」长什么样，一个「管操作先后」的管理器长什么样。

| 名字 | 种类 | 它是干什么的 |
|------|------|--------------|
| `packages/libs/editor-core/lib/kernel/` | 目录（现有） | 底层的「管理」半边：内核组合根 + 能力登记契约 + 诊断 + 启动错误（**本阶段不新建、不搬**）。 |
| `packages/libs/editor-core/lib/ports/` | 目录（现有） | 底层的「接口」半边：引擎/宿主/预览/文件读写（`fs.ts`）四个 port（**本阶段不新建、不搬**）。 |
| `packages/libs/editor-core/lib/kernel/types.ts` | 文件（新） | 底层对外类型的**唯一**集中出口（D-08）。本计划先放撤销契约类型；Plan 03 会把内核三个接口（`CapabilityRegistrar`/`EditorCoreConfig`/`EditorCore`）也并进来。**不另建 `undoTypes.ts`。** |
| `OperationMeta` | 接口 | 一次操作的元数据：给人看的标签 `label`、失败定位用的 `stage`，外加可选的自报影响路径 `paths`（取代旧 `targets` 里的路径）。 |
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
| `editor-core-must-not-import-editor-impl` | dependency-cruiser 规则名 | 待 Plan 03 落地的门禁：`editor-core` 的任何文件都不得 import `editor-impl`（D-01 的单向依赖）。 |

---

## Plan 05.1-02 — 默认实现层（迁入 `editor-impl`）接口与约定定义

**这个计划只定义「默认实现层」要用的接口，一行实现都不写。**
默认实现就是表格/地图/代码编辑这类功能：它们**自己持有自己的内容**，只依赖底层。
> **落点说明：** 本计划在编辑器内容尚未搬迁时，先把这些声明文件建在 **`editor-core` 的当前位置**
> （`lib/resources/`、`lib/edit/`、`lib/table/`），因为此刻内容还在那里；Plan 03 的整体搬迁会把这些
> 文件连同目录一起 `git mv` 到 `editor-impl`。计划中的路径因此以**搬迁后**的 `editor-impl` 为准。

| 名字 | 种类 | 它是干什么的 |
|------|------|--------------|
| `packages/libs/editor-impl/lib/edit/types.ts` | 文件（新，Plan 03 后位于 impl） | 编辑层（默认实现）对外类型的集中出口（D-08）。 |
| `IPatchableResource<T>` | 接口 | **能被 patch 的资源**的最小契约：`path`（身份）、`raw()`（拿到底层文本内容处理器）、`mutate(recipe)`（改内容）。让 patch 操作不必认识任何引擎/编辑器类型。它取代旧的 `PatchableResource`。 |
| `packages/libs/editor-impl/lib/resources/interfaces.ts` | 文件（改） | 资源层类型集中处；本计划补两个资源视图接口（`ReadonlySignal`/`Content` 已在此文件或其单行依赖里，避免新增环）。 |
| `IResourceView<T>` | 接口 | **可读资源视图**：`id`、`content`（只读响应式 signal）、`snapshot()`、`value()`、`subscribe()`。它取代旧的 `ResourceView`。 |
| `ILoadableResource<T>` | 接口 | 在 `IResourceView<T>` 之外再加 `ensureLoaded()` / `reload()` / `waitForSettled()`。它取代旧的 `LoadableResource`。 |
| `packages/libs/editor-impl/lib/table/types.ts` | 文件（新，Plan 03 后位于 impl） | 表格专属类型声明处。 |
| `ActionType` | 类型别名 | 表格动作的三种类型：`'change' \| 'add' \| 'delete'`。 |
| `Action` | 类型别名 | 一条表格动作：`[ActionType, 字段路径字符串, 值]`。字符串路径属表格层（用户反馈 #3）。 |
| 内容持有约定（无新接口） | 约定（文字） | 默认实现之间**不引入新的「统一内容抽象」**：每个编辑系统自己持有内容、经 `IResourceView`/`ILoadableResource` 对外暴露。这是 D-03 的一体两面。 |

---

## Plan 05.1-03 — 两包拆分（建 `editor-impl` + 迁移）+ 底层边界门禁 + 底层 IO 清零

**这个计划做三件事：建新包、把默认实现整包搬过去、把「底层不得依赖上层」和「底层不读文件」变成机器门禁。**

| 名字 | 种类 | 它是干什么的 |
|------|------|--------------|
| `packages/libs/editor-impl/` | 目录（新包） | 见上「新包与目录总览」。 |
| `git mv`（`editor-core/lib/{resources,edit,table,react,code,map,asset,shell}` → `editor-impl/lib/`） | 迁移动作 | 默认实现层整体迁入新包；内部相对导入不变。 |
| `packages/libs/editor-core/lib/index.ts` | 文件（改） | 底层根 barrel：只再导出内核 + 端口（撤销契约来自 `./kernel/types`）；**删除**对 `resources`/`edit` 的再导出（它们已不在本包）。 |
| `packages/libs/editor-core/lib/kernel/core.ts` | 文件（改） | 内核组合根，**留在原地**；本计划把三个内核接口收拢到 `lib/kernel/types.ts`（见下），它改为 import。 |
| `packages/libs/editor-core/lib/kernel/types.ts` | 文件（改） | 底层的唯一对外类型出口：Plan 01 的撤销契约类型 + 本计划并入的内核三接口（`CapabilityRegistrar`/`EditorCoreConfig`/`EditorCore`）。 |
| `packages/libs/editor-core/lib/ports/engine.ts` | 文件（改） | 引擎适配器契约，**留在原地**；本计划把逻辑 id 谓词 `isValidResourceId` 连同 `LOGICAL_ID_PATTERN`/`RESERVED_IDS`/原型污染防线归它自持，并让 `editor-impl` 的 `lib/resources/resourceRegistry.ts` 反向 import（消除倒挂）。 |
| `packages/libs/editor-core/lib/**` | 依赖规则（现有目录） | 底层 = 整个 `editor-core` 包；其中任何文件都不得 import `editor-impl`。 |
| `editor-core-must-not-import-editor-impl` | dependency-cruiser 规则名 | `from: ^packages/libs/editor-core/lib/.+`，`to: ^packages/libs/editor-impl/lib/.+`，`severity: 'error'`；真实树 0 违规、合成违规必红（两极性）。取代旧的 `kernel-must-not-import-capabilities` 与 `bottom-layer-must-not-import-upper-layers`（它们针对「一个包内分层」，已不适用）。 |
| `editor-impl-must-not-import-consumers` 意图并入 `core-must-not-import-consumers` | dependency-cruiser 规则（改） | 把 `core-must-not-import-consumers` 的 `from` 扩到覆盖 `editor-impl/lib/**`：两个包都不得 import editor/宿主/引擎。 |
| `capabilities-must-not-import-each-other` / `react-and-shell-must-not-import-capabilities` / `resources-edit-must-not-import-capabilities` | dependency-cruiser 规则（改） | `from` 由 `editor-core/lib/...` 改指 `editor-impl/lib/...`（能力目录已迁入新包）。 |
| `bottom-layer-io-free` | 门禁断言名（`coreBoundaries.js`） | 底层（`editor-core/lib/**`）不得出现文件读写调用（`this.fs`、`.readFile(` 等），且必须有两极性证明。 |
| `scripts/verify/coreModuleState.js` 的 `CORE_LIB` | 常量（改） | 由单个 `editor-core/lib` 改为**同时覆盖**两个包的 `lib`（模块级可变绑定对两包都禁）。 |
| `scripts/verify/coreEngineNeutral.js` 的 `CORE_LIB` | 常量（改） | 扫描范围扩到两个包的 `lib`（引擎词汇对两包都禁；`MIN_EXPECTED_SOURCES` 保持 30，合并后约 37）。 |
| `scripts/verify/coreBoundaries.js` 的 `CORE_LIB` / `EDITOR_TO_CORE_EDGE` | 常量（改） | cruise 目标扩到两个包的 `lib`；`editor→core` 的边改为 `@motajs/editor-impl/react`（`App.tsx` 的新说明符）。 |
| `scripts/verify/implExports.js` | 文件（新门禁脚本） | 新包 `editor-impl` 的 PKG-01/PKG-02 结构自检：`private`/`type`/`sideEffects`、恰好七个 subpath（`.`/`./code`/`./table`/`./map`/`./asset`/`./shell`/`./react`）、9 peer（`catalog:default`、Semi optional）、脚本恰好 `typecheck`+`test`、subpathStatus 同步。前缀 `implExports`。 |
| `packages/libs/editor-core/package.json` | 文件（改） | 只保留一个 subpath `.`；新增 `dependencies` 里**不**含 `editor-impl`（方向约束）。 |
| `.planning/phases/02-package-boundary-build-scaffolding/subpathStatus.json` | 文件（改） | 拆成两份记录：`editor-core` 只剩 `.`；`editor-impl` 七个 subpath 各一条。 |
| `packages/apps/editor/panda.config.ts` | 文件（改） | `include` 由 `../../libs/editor-core/lib/**` 改为 `../../libs/editor-impl/lib/**`（`CoreProbe.tsx` 已随 `lib/react/` 迁入新包）。 |
| `scripts/verify/coreReactCompiler.js` 的 `PROBE_MODULE` | 常量（改） | 由 `/packages/libs/editor-core/lib/react/CoreProbe.tsx` 改为 `/packages/libs/editor-impl/lib/react/CoreProbe.tsx`。 |
| `packages/libs/editor-core/lib/kernel/undoManager.ts` | 文件（新） | 撤销操作栈管理器的实现（**Plan 04 落地**）：串行队列 + 容量 100 + 无快照。 |
| `.dependencyCruiser.cjs` | 文件（改） | 见上各条规则改动。 |

> **归属决定（研究开放点 c）：** `ResourceRegistry` **随 `lib/resources/` 迁入 `editor-impl`**，不进底层。
> 理由：它登记的是「内容视图」，而 D-03 明确底层不认识被编辑内容。底层自己的登记机制是 `EditorCore.registerCapability`。
> 本阶段对它的唯一改动是把共享的逻辑 id 谓词 `isValidResourceId` 改为**底层（`editor-core/lib/ports/engine.ts`）持有**、
> `resourceRegistry.ts` 反向跨包 import（`editor-impl` → `editor-core`，方向允许）。
> **文件 IO 决定（D-02）：** `fileHandler*`/`binaryFileHandler`/`persistExecutor`/`persistenceMonitor`/`fileResource`
> 全部随 `lib/resources/` 迁入 `editor-impl`；底层只保 `editor-core/lib/ports/fs.ts` 一个纯接口文件，且**永不调用**。

---

## Plan 05.1-04 — 撤销重构实现

| 名字 | 种类 | 它是干什么的 |
|------|------|--------------|
| `packages/libs/editor-core/lib/kernel/undoManager.ts` | 文件（新） | 撤销操作栈管理器的实现：串行队列 + 容量 100 + 无快照。 |
| `UndoManager.constructor` | 方法 | 无参构造；per-instance 的 `Store` 与内部队列都在实例字段上，因此两个实例天然互不干扰。 |
| `UndoManager.execute` / `UndoManager.undo` / `UndoManager.redo` / `UndoManager.clear` | 方法 | 见 Plan 01 的 `IUndoManager.*` 说明。 |
| `packages/libs/editor-core/lib/__tests__/undoManager.invariants.test.ts` | 文件（新，取代旧 `lib/edit/__tests__/operationHistory.invariants.test.ts`） | 纯内存不变量测试：容量 100、逆操作 undo/redo、redo 截断、无改动不入历史、组合失败按逆序回退。**删除**所有 target/snapshot 用例。 |
| `packages/libs/editor-impl/lib/edit/undoSystem.ts` | 文件（删除） | 旧的快照委托接缝，D-05 明确移除。 |
| `packages/libs/editor-impl/lib/edit/operationHistory.ts` | 文件（删除） | 旧管理器文件；类型迁入 `editor-core/lib/kernel/types.ts`，实现迁入 `editor-core/lib/kernel/undoManager.ts`。 |
| `OperationTarget` / `operationPathTarget` / `dataResourceTarget` / `captureSystems` / `restoreSystems` / `systemsBefore` / `systemsAfter` | 符号（删除） | 快照式撤销的全部残骸（D-05）。 |

> **兼容取舍（已定，D-18）：** 上面这组删除会击穿 `@motajs/editor` 的
> `src/project/history/*` 与 `src/appInstances.ts`（它们 import `OperationTarget`/`operationPathTarget` 并在
> `appInstances.ts` 调 `operationHistory.registerUndoSystem(...)`）。用户已选 **A：core 彻底删除 +
> 编辑器做最小机械跟随**——不保留任何弃用兼容导出。编辑器改动集中在 **05.1-08**（唯一触碰
> `@motajs/editor` 的计划），它与 05.1-03/05.1-04 **同处 wave 2 且排在最后**；wave 边界处全仓恢复可编译/测试绿。

---

## Plan 05.1-05 — 表格专用代码归位

| 名字 | 种类 | 它是干什么的 |
|------|------|--------------|
| `packages/libs/editor-impl/lib/table/fieldPath.ts` | 文件（移动） | 由 `lib/edit/fieldPath.ts` 移入：把 `"['a']['b']"` 这种字符串路径解析/读写的表格工具（含 `fieldToDataAttr` 这类 DOM 属性转换）。 |
| `packages/libs/editor-impl/lib/table/action.ts` | 文件（移动） | 由 `lib/edit/action.ts` 移入：表格动作 `Action` 的应用与逆运算生成；含 `cloneActionValue`。 |
| `packages/libs/editor-impl/lib/table/patchResourceOperation.ts` | 文件（移动） | 由 `lib/edit/operations.ts` 拆出：`ResourcePatchOperation` 类与 `patchResourceOperation` 工厂（因为「用表格动作 patch 资源」本身就是表格层的事）。 |
| `ResourcePatchOperation` | 类 | `IEditorOperation` 的实现：对一个 `IPatchableResource` 应用一组表格动作，并产出自带逆的操作。 |
| `patchResourceOperation` | 函数 | 工厂，返回一个 `IEditorOperation`；公开名保持 `patchResourceOperation` 不变，编辑器 shim 无需改。 |
| `cloneActionValue` | 函数 | 深拷贝「原值」以便生成逆动作。**保留**，不换 `structuredClone`——后者遇函数/DOM 节点会抛错、不保留原型与属性描述符。 |
| `packages/libs/editor-impl/lib/table/index.ts` | 文件（保持空 barrel） | `./table` 仍是空 barrel（`export {}`）；被移动的表格符号**只从根 `.` 再导出**，否则 `subpathStatus.json`/`implExports.js` 会红。 |

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
| `scripts/verify/coreImportType.js` | 文件（新门禁脚本） | D-11 的可失败检查：扫两个包 `lib/**/*.{ts,tsx}` 里行首的 `import type`，真实树必须 0 条、合成 fixture 必须逐行命中，并证明删除 fixture 后不存在。 |
| `coreImportType` | 门禁前缀 | 该脚本的失败信息前缀（与 `coreModuleState`/`coreBoundaries` 同族）。 |
| `IFileHandlerManager` | 接口（新） | `FileHandlerManager` 的契约：按路径加载/重载/清理/查询文件处理器。让这个类不再「裸」。 |
| `IPersistExecutor` | 接口（新） | `PersistExecutor` 的契约：排程某个路径的持久化意图与查询状态。 |
| `IPersistenceMonitor` | 接口（新） | `PersistenceMonitor` 的契约：项目级持久化状态、flush、失败记录与重试。 |
| `IResourceRegistry` | 接口（新） | `ResourceRegistry` 的契约：按逻辑 id 登记/取用/查询资源。 |
| `packages/libs/editor-core/lib/kernel/types.ts` | 文件（收口） | 底层的唯一对外类型出口：内核三个接口 + 撤销契约类型都从这里汇总。 |
| `packages/libs/editor-impl/lib/resources/interfaces.ts` | 文件（收口） | 资源层唯一对外类型出口。 |
| `packages/libs/editor-impl/lib/edit/types.ts` | 文件（收口） | 编辑层唯一对外类型出口。 |
| `packages/libs/editor-impl/lib/table/types.ts` | 文件（收口） | 表格层唯一对外类型出口。 |
| `getParentField` | 函数（收口） | 去掉 `export const getParentFieldPath = getParentField` 这种「把函数赋给临时常量」的别名写法：两个名字都保留为真正的函数导出，旧名以别名再导出。 |

---

## Plan 05.1-08 — 编辑器适配层机械跟随（**唯一触碰 `@motajs/editor` 的计划**）

> **这一节的名字是 `@motajs/editor` 侧的文件，不是 core/impl 的文件。** 本计划做两类**纯机械**改动：
> (A) 两包拆分后，把 18 个 shim / adapter / `App.tsx` 的 `@motajs/editor-core` 说明符按**符号所属的包**
> 改指 `editor-core` 或 `editor-impl`；(B) 快照撤销删除后，删掉编辑器里失效的老接口用法、按 D-19 改写一条测试。
> **不改任何功能、UI 或宿主协议。**
>
> **波次：** 本计划与 05.1-03（拆分）、05.1-04（撤销）**同处 wave 2**，且必须排在最后执行（先拆包、再删 core 旧符号，最后修编辑器）；
> 三者同一波完成，wave 末全仓保持可编译/测试绿。

| 名字 | 种类 | 它是干什么的 |
|------|------|--------------|
| `packages/apps/editor/package.json` | 文件（改） | 新增 `@motajs/editor-impl: "workspace:*"` 依赖（编辑器同时依赖两个包）。 |
| `packages/apps/editor/src/App.tsx` | 文件（改） | `CoreProbe` 的 import 由 `@motajs/editor-core/react` 改指 `@motajs/editor-impl/react`。 |
| `packages/apps/editor/src/__tests__/editorCoreResolution.test.tsx` | 文件（改） | 同步 `CoreProbe` 的 import 说明符改指 `@motajs/editor-impl/react`。 |
| `packages/apps/editor/src/fs/*.ts`（12 个 shim） | 文件（改） | 转发 `resources`/`edit` 符号的 shim 说明符由 `@motajs/editor-core` 改指 `@motajs/editor-impl`。 |
| `packages/apps/editor/src/project/resources.ts`、`src/utils/{action,fieldPath}.ts`、`src/utils/base/signal.ts`（4 个 shim） | 文件（改） | 同上改指 `@motajs/editor-impl`。 |
| `packages/apps/editor/src/project/history/operationHistory.ts` | 文件（改） | `OperationHistory`/两个状态类型都属底层 → 说明符保留 `@motajs/editor-core`（`UndoManager` 在底层）。 |
| `packages/apps/editor/src/project/history/operations.ts` | 文件（改） | 转发 shim：`compositeOperation`/`patchResourceOperation` 改指 `@motajs/editor-impl`；`AppliedOperation`/`EditorOperation`/`OperationMeta` 保留 `@motajs/editor-core`；**删除** `operationPathTarget`（值）与 `OperationTarget`（类型）两条已消失的再导出。 |
| `packages/apps/editor/src/project/history/index.ts` | 文件（改） | 删掉 `operationPathTarget` 与 `type OperationTarget` 两个已消失的再导出；其余说明符按所属包改指。 |
| `packages/apps/editor/src/adapter/motaEngine.ts`、`motaFloor.ts` | 文件（改） | 按符号分拆 import：`defineEngine`/`isValidResourceId`/`ResourceDependencies`/`ResourceDescriptor`/`EngineAdapter`（底层）保留 `@motajs/editor-core`；`FileResource`/`JsonDataHandler`（默认实现）改指 `@motajs/editor-impl`。 |
| `packages/apps/editor/src/appInstances.ts` | 文件（改） | `FileHandlerManager`/`OperationHistory`/`PersistenceMonitor` 改指 `@motajs/editor-impl`（或仍从 core 经其再导出解析）；`FsPort`（底层类型）从 `@motajs/editor-core` 取；删掉 `operationHistory.registerUndoSystem(...)` 整块与其不再使用的 import。 |
| `packages/apps/editor/src/project/history/{materialOperations,textFileOperations,viewportOperations}.ts`、`src/project/commands/{animationCommands,schemaOverrideCommands}.ts` | 文件（改） | 删掉 `operationPathTarget`/`OperationTarget` 用法与操作的 `targets` 字段；改名跟随（`EditorOperation` 等旧名别名保证继续编译）。 |
| `packages/apps/editor/src/project/history/__tests__/operationHistory.test.ts` | 文件（改） | 按 D-19 改写：删掉「用快照目标恢复失败操作」用例与「数据 undo 顺带恢复视口」断言，记录新行为（撤销数据改动不再连带恢复地图视口）。 |

---

*Materialized 2026-09-28 as a pre-execution planning artifact. Any further important name must be added
here and confirmed before it lands in code.*
