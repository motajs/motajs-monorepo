# Phase 05.2: editor-core/impl 代码风格整改 — INTERFACE-NAME.md

> **状态：部分已确认。** §Plan 01、§Plan 02、§Plan 03、§Plan 04、§Plan 05（无新名字，纯风格扫尾）已于 2026-09-29 经用户确认；其余各节待各自计划简报确认。本文件是**执行前的规划产物**：由 planner 在写计划时一并产出，
> 不是任何执行任务创建的。按 `AGENTS.md` §Project Rules，任何**重要命名**（文件名 / 目录名 / 类型名 /
> 类名 / 方法名 / 枚举成员名 / 导出符号名 / 门禁标签名）都必须先写在本文件里、**并说明它是干什么的**，
> 经用户确认后才可落盘。函数体内的 `let`/`const` 局部变量不受此限。
>
> **一句话**：本阶段是「按 `AGENTS.md` §Code style 把两个包（含测试）的代码风格改齐」的纯风格整改，
> 不改功能、不改行为。第一批计划只动**接口层**（`readonly`、类型迁 `types.ts`、字符串枚举改数字枚举），
> 之后才动**实现层**（注释、空行/成员顺序、裸函数类化、桶文件 `export *`、空值约定）。
>
> **方法一律写 `类名.方法名`**（如 `EditorCoreKernel.registerCapability`）；自由函数才裸写。
>
> **不做的改名**：本阶段**不**新增/修改 `I` 前缀（`IEngineAdapter` 等是 05.1 已定的名字，沿用）；
> **不**改任何对外协议、不新增依赖。

---

## 命名约定（本阶段适用）

- 新增/迁移的**导出类型**（interface / type）一律落到该层的 `types.ts`（`AGENTS.md` §Code style「类型」）。
- 新增数字枚举成员用 **UPPER_SNAKE** 成员名（沿用仓内 `ErrorCode.ZIP_NOT_FOUND` 的成员名风格）；
  枚举值用**数字**（`AGENTS.md` §Code style「枚举」明确禁字符串枚举）。
- 桶文件一律 `export *`；**不跨目录深路径转发**（不写 `export * from './x/y'`）。
- 类方法在文档里写 `类名.方法名`；工厂/纯函数裸写。
- 本阶段新建的**文件**只有 `editor-core/lib/ports/types.ts`、`editor-core/lib/kernel/index.ts`、
  `editor-impl/lib/resources/index.ts`、`editor-impl/lib/edit/index.ts`；其余为迁移/合并/删除。

---

## Plan 05.2-01 — `editor-core` 接口层整改（D-02 / D-06 / D-07 / D-10 / D-18）

**这个计划只动底层的「接口层」——把散落的导出类型收进 `types.ts`、给接口成员补 `readonly`、
把 `DiagnosticSeverity` 改成数字枚举；一行实现逻辑都不改。** 另含一处最小编辑器改动：关闭
`packages/apps/editor/tsconfig.app.json` 的 `erasableSyntaxOnly`（D-18，见下表）。

| 名字 | 种类 | 它是干什么的 |
|------|------|--------------|
| `packages/libs/editor-core/lib/kernel/types.ts` | 文件（现有，扩容） | 底层对外类型的**唯一**集中出口。本计划把 `registry.ts` 的三个能力登记类型与 `diagnostics.ts` 的两个诊断类型并进来。 |
| `DiagnosticSeverity` | 数字枚举（迁入 `kernel/types.ts`） | 诊断级别：给一条诊断标注严重程度，让测试与 CI 能按级别断言。**取代**现在的字符串联合 `'error' \| 'warning' \| 'info'`。 |
| `DiagnosticSeverity.Error` / `DiagnosticSeverity.Warning` / `DiagnosticSeverity.Info` | 枚举成员 | 由重到轻三级。取值 `0 / 1 / 2`（计划里必须顺带 grep 证明仓库内不存在对 `severity` 的真值判断，0 为假值不影响行为）。 |
| `Diagnostic` / `DiagnosticBus` | interface（迁入 `kernel/types.ts`） | 一条诊断 / 诊断总线。**只挪位置**，形状不变（`Diagnostic` 成员已 `readonly`）。 |
| `CapabilityRef` / `RegisterCapabilityOptions` / `RegisterCapabilityResult` | interface（迁入 `kernel/types.ts`） | 能力登记三件套：快照条目 / 登记选项 / 登记结果。**只挪位置**。 |
| `DIAGNOSTIC_CODES` / `DiagnosticCode` | 值表 + 派生类型（**保留**在 `kernel/diagnostics.ts`） | 稳定机器码表及由它派生的联合类型。**不迁** `types.ts`：类型与值同源，迁出会让 `types.ts` 反向 import 值文件而成环；且机器码字符串是对外契约，按 §Code style「枚举」的例外**保留字符串**（不是枚举）。 |
| `packages/libs/editor-core/lib/ports/types.ts` | 文件（**新建**） | ports 层导出类型的集中出口：`IFsPort` / `IHostPort` / `IPreviewAdapter` / `IEngineAdapter` / `ResourceDependencies` / `PreloadStrategy` / `ResourceDescriptor` / `EngineDescription`。 |
| `packages/libs/editor-core/lib/ports/fs.ts`、`host.ts`、`preview.ts` | 文件（**删除**） | 它们的内容只剩一个 interface，已迁入 `ports/types.ts`；留着就是空壳。删后 `ports/engine.ts` 只留「逻辑/值」。 |
| `packages/libs/editor-core/lib/ports/index.ts` | 文件（改） | 从只再导出 `./engine`/`./fs`/`./host`/`./preview` 改为再导出 `./engine` + `./types`。 |
| `readonly`（成员态） | 修饰 | 接口成员默认只读；本计划给 `OperationMeta.{label,stage}`、`AppliedOperation.{value,inverse,changed}`、`OperationHistoryEntry.{id,label,timestamp,paths}`、`OperationHistoryState.{entries,current,busy}` 补 `readonly`。 |
| `packages/apps/editor/tsconfig.app.json` | 配置（改；D-18） | 编辑器把两包源码并入自己的编译程序，它开着的 `erasableSyntaxOnly: true` 会禁掉两包要用的数字 `enum`；本计划把它改为 `false`（只改这一个开关、补一行注释）。**不引入新名字。** |

---

## Plan 05.2-02 — `editor-impl` 接口层整改（D-02 / D-07 / D-10）

**这个计划只动默认实现层的「接口层」——把资源层的两个类型文件合成一个 `types.ts`、给接口成员补
`readonly`；不改任何实现逻辑。**

| 名字 | 种类 | 它是干什么的 |
|------|------|--------------|
| `packages/libs/editor-impl/lib/resources/types.ts` | 文件（**合并**） | 资源层对外类型的**唯一**出口 = 现在的 `types.ts` + `interfaces.ts` 两部分内容合在一起。 |
| `packages/libs/editor-impl/lib/resources/interfaces.ts` | 文件（**删除**） | 内容已并入 `types.ts`（`AGENTS.md` §Code style「类型」要求导出类型集中到 `types.ts`）。删前必须一次性把所有 import 从 `./interfaces` 改到 `./types`，否则会成环/找不到。 |
| `PersistenceIntent` / `PersistFailure` 的成员 | 成员（改） | 加 `readonly`：`PersistenceIntent.{kind,execute}`、`PersistFailure.{path,error}`。 |
| `ReadonlySignal` / `IContentView` / `IContentHandler` / `IDataHandler` / `IRecoverableResource` / `IResourceView` / `ILoadableResource` / `FileHandlerDependencies` / `IFileHandlerManager` / `IPersistExecutor` / `IPersistenceMonitor` / `ResourceRegistryEntry` / `IResourceRegistry` | interface（**挪位置**） | 全部并入 `resources/types.ts`；形状与名称不变。 |
| `Content` / `FileContent` / `ExecutorStatus` | 类型别名（**原地**） | 已在 `resources/types.ts`，本计划只做 D-02 的注释对象校正（type 要写 jsDoc）。 |

> **保留字符串的例外（不改枚举）**：`Content.status`、`ExecutorStatus.status`、`PersistenceIntent.kind`、
> `IPersistenceMonitor.statusFor` 的返回值是「状态名」，被编辑器大量用字符串比较（如
> `if (content.status === 'idle')`）。按 `AGENTS.md` §Code style「枚举」的例外条
> （「除非使用处要求必须是字符串」）**保留字符串联合**，并在计划里写明理由。

---

## Plan 05.2-03 — 其余数字枚举 + 编辑器最小跟随（D-06 / D-14 / D-18）

**这个计划把剩下的两个「改数字枚举」点（资源预加载策略、表格动作类型）落地，并把它连带的编辑器
字符串字面量改成枚举成员——这是本阶段唯一允许触碰 `@motajs/editor` 的一类机械改动。**

| 名字 | 种类 | 它是干什么的 |
|------|------|--------------|
| `PreloadStrategy` | 数字枚举（迁入 `packages/libs/editor-core/lib/ports/types.ts`） | 一个资源在加载时「什么时候加载」的策略。**取代**现在的 `'eager' \| 'lazy' \| 'on-demand'` 字符串联合。 |
| `PreloadStrategy.Eager` / `PreloadStrategy.Lazy` / `PreloadStrategy.OnDemand` | 枚举成员 | 立即加载 / 惰性加载 / 按需加载。取值 `0 / 1 / 2`。 |
| `ActionType` | 数字枚举（**原地** `packages/libs/editor-impl/lib/table/types.ts`） | 一条表格动作是「改值 / 新增 / 删除」里的哪一种。**取代**现在的 `'change' \| 'add' \| 'delete'` 字符串联合。 |
| `ActionType.Change` / `ActionType.Add` / `ActionType.Delete` | 枚举成员 | 改值 / 新增 / 删除。取值 `0 / 1 / 2`。 |
| 编辑器机械跟随 | 改动（`packages/apps/editor/src/**`） | 只把「给 `PreloadStrategy`/`ActionType` 位置喂字符串」的字面量改成枚举成员；不改功能、UI、宿主协议。已知站点：`adapter/motaEngine.ts`（8×`preload: 'eager'`、1×`'lazy'`）、`adapter/motaFloor.ts`（`'on-demand'`）、以及所有构造 impl `Action` 元组的位置（`project/commands/*`、`Workbench/*Panel`、`Workbench/*Workspace`、`project/migrations/airwallMigration.ts`、`project/model/floorCoordinateReferences.ts`、`components/Table/**`、相关测试）。以 `pnpm --filter @motajs/editor typecheck` 报出的 `TS2322` 为准逐个替换，不多改一处。 |
| 编辑器侧 `EditMode` / `TableAction` | 类型/字面量（按需改） | `components/Table/types.ts` 的 `TableAction = ['change'\|'add'\|'delete', string, unknown]` 若因须赋给 impl 的 `Action` 而报错，则换成 `[ActionType, string, unknown]` 并同步其构造点；纯 UI 的 `EditMode`（分段控件）可按 typecheck 结果决定是否跟随，目标是**最小**改动。 |
| `packages/apps/editor/src/utils/action.ts` | shim（改；属 D-14 的机械跟随） | 编辑器取 `Action`/`ActionType` 的转发 shim。`ActionType` 改成数字枚举后它是**值**，故该行由 `export type { Action, ActionType }` 改为 `export { ActionType }` + `export type { Action }`（仍只做转发，过 `editorShims.js`「只转发」检查）。**不引入新名字。** |

---

## Plan 05.2-04 — 裸函数类化 / 去内嵌函数 + D-17（D-05 / D-17）

**这个计划把「有状态的两家工厂」改成类、把函数体里的小函数挪出去，并去掉一个 getter 和一个
多余参数；行为保持不变。**

| 名字 | 种类 | 它是干什么的 |
|------|------|--------------|
| `EditorCoreKernel` | 类（**取代**裸函数 `createEditorCore`；`implements EditorCore`） | 底层组合根：把一个 per-instance 的内核对象图装配起来（诊断总线、能力登记表、拆除栈）。构造参数 `config: EditorCoreConfig`。 |
| `EditorCoreKernel.constructor` / `EditorCoreKernel.registerCapability` / `EditorCoreKernel.getCapability` / `EditorCoreKernel.getCapabilityOrThrow` / `EditorCoreKernel.snapshotCapabilities` / `EditorCoreKernel.dispose` | 方法 | 原 `createEditorCore` 闭包里的六个内嵌函数各变成一个方法；对外形状与 `EditorCore` 接口逐字一致。 |
| `EditorCoreKernel.keyOf` / `EditorCoreKernel.drainTeardowns` / `EditorCoreKernel.noop` | 私有方法 | 原闭包内的 `keyOf`/`drainTeardowns`/`noop`；私有方法必须写完整注释（`AGENTS.md` §Code style「注释」）。 |
| `DiagnosticBusImpl` | 类（**取代**裸函数 `createDiagnosticBus`；`implements DiagnosticBus`） | per-instance 诊断总线：追加式历史 + 同步派发 + 订阅隔离。无参构造。 |
| `DiagnosticBusImpl.push` / `DiagnosticBusImpl.snapshot` / `DiagnosticBusImpl.subscribe` / `DiagnosticBusImpl.dispatch` | 方法 | `dispatch` 为私有方法；原闭包内嵌函数全部变成方法。 |
| `ContentUtils` | 类（**静态方法**；取代现在的 `Object.freeze({…})` 对象字面量） | `Content<T>` 的五态辅助工具。用 `static` 方法，使 `ContentUtils.map(...)` 调用点**一字不改**（编辑器经 shim 在用）。 |
| `visitDependency` | 函数（模块私有，**新**） | 从 `defineEngine` 内部挪出的 DFS 访问函数（原内嵌 `visit`）；纯函数、模块级，不再是内嵌函数。 |
| `FileHandlerManager.size` | 方法（**取代** `get size(): number`） | 当前处理器数量。由 getter 改为方法（D-17）；`IFileHandlerManager` 的 `readonly size: number` 随之改为 `size(): number`。 |
| `FileHandler.delete` | 方法（改签名） | 去掉 `_force` 参数与其一句话 `void _force;`（§Code style 禁下划线开头未使用参数）。行为不变（删除语义本来就不依赖它）。 |

---

## Plan 05.2-05 — `editor-core` 实现层风格扫尾（D-03 / D-04 / D-09 / D-11）

**这个计划只改底层（`editor-core/lib/**`，含测试）的注释、空行/成员顺序与空值字面量，不引入任何新名字。**

| 名字 | 种类 | 它是干什么的 |
|------|------|--------------|
| （无新名字） | — | 只做 D-03（方法/成员/私有注释风格）、D-04（空行与成员在方法前）、D-09（`undefined`/`null`/`[]`）的机械整改。测试文件按 dev.md 要求给每个 `it`/`test` 补一行 `//` 说明。已有测试辅助函数名不变。 |

---

## Plan 05.2-06 — `editor-impl` 资源层实现层风格扫尾（D-03 / D-04 / D-09 / D-11）

**这个计划只改资源层（`editor-impl/lib/resources/**`，含测试）的注释、空行/成员顺序与空值字面量，
不引入任何新名字。**

| 名字 | 种类 | 它是干什么的 |
|------|------|--------------|
| （无新名字） | — | 同 Plan 05 的机械整改，作用于资源层处理器组、工具组及其测试。资源层测试辅助函数名不变。 |

---

## Plan 05.2-07 — `editor-impl` 编辑/表格/React 层实现层风格扫尾（D-03 / D-04 / D-09 / D-11）

**这个计划只改编辑层、表格层、React 层与四个能力目录（含测试）的注释、空行/成员顺序与空值字面量。**

| 名字 | 种类 | 它是干什么的 |
|------|------|--------------|
| `CoreProbeProps` | interface（新；`react/CoreProbe.tsx`） | `CoreProbe` 探针组件的 props：目前就地内联的 `{ label?: string }` 抽成一个具名 interface（dev.md 类型规则：出现对象类型时单独声明 interface）。仅当用户批准时随本计划落地，否则该行不改。 |
| （其余无新名字） | — | 同 Plan 05 的机械整改，作用于 edit/table/react 与 `{code,map,asset,shell}` 及其测试；`CoreProbe.tsx` 的 PandaCSS 模板调用与 hook 逐字不动（门禁依赖）。 |

---

## Plan 05.2-08 — 桶文件 `export *` + 门禁同步（D-08 / D-15 / D-16）

**这个计划把两个包的桶文件改成「默认转发整个文件夹」，并同步会因此变红的门禁与状态文件。**

| 名字 | 种类 | 它是干什么的 |
|------|------|--------------|
| `packages/libs/editor-core/lib/kernel/index.ts` | 文件（**新建**） | 内核层文件夹 barrel：`export *` 本文件夹各文件；父 barrel 只 `export * from './kernel'`（不写三段深路径）。 |
| `packages/libs/editor-core/lib/ports/index.ts` | 文件（改） | 改为 `export * from './engine'; export * from './types';`。 |
| `packages/libs/editor-core/lib/index.ts` | 文件（改） | 根 barrel 改为 `export * from './kernel'; export * from './ports';` + D-16 别名行。 |
| `packages/libs/editor-impl/lib/resources/index.ts` | 文件（**新建**） | 资源层文件夹 barrel（`export *`）。 |
| `packages/libs/editor-impl/lib/edit/index.ts` | 文件（**新建**） | 编辑层文件夹 barrel（`export *`）。 |
| `packages/libs/editor-impl/lib/table/index.ts` | 文件（改） | 由 `export {}` 改为 `export *`（D-15）。 |
| `packages/libs/editor-impl/lib/react/index.ts` | 文件（改） | `export { CoreProbe } …` 改为 `export * from './CoreProbe';`；`useOperationHistory` 仍在本文件声明。 |
| `packages/libs/editor-impl/lib/index.ts` | 文件（改） | 根 barrel 改为 `export * from './resources'; export * from './edit'; export * from './table';` + D-16 别名行。 |
| `table-exports` | subpath content 标签（**新**） | `./table` 变成非空 barrel 后，`scripts/verify/implExports.js` 的 `SUBPATH_CONTENT['./table']` 与 `subpathStatus.json` 里 `./table` 的 `content` 由 `empty-barrel` 改为 `table-exports`（**同一次提交**，D-15）。 |
| D-16 旧名别名行 | 导出语句 | `EngineAdapter` / `FsPort` / `HostPort` / `PreviewAdapter` / `ResourceView` / `LoadableResource` / `RecoverableResource` / `PatchableResource` / `OperationHistory` 用**显式别名行**保留（`export *` 无法表达改名）。这是「不逐个列导出名」的**唯一**例外：别名不枚举既有面，只新增旧名绑定。 |

---

## Plan 05.2-09 — 收尾全量回归（无新名字）

| 名字 | 种类 | 它是干什么的 |
|------|------|--------------|
| （无新名字） | — | 只跑全量校验：两包 typecheck/test、`pnpm typecheck`/`test`/`lint`/`format:check`、七条 `scripts/verify/*.js` + `ci-workflow.js`，并确认 `packages/apps/editor` 只有本阶段批准的枚举跟随改动。 |

---

*Materialized 2026-09-29 as a pre-execution planning artifact. Any further important name must be
added here and confirmed before it lands in code. All names are provisional until confirmed at the
per-plan briefing (`AGENTS.md` §Project Rules).*
