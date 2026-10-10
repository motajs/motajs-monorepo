# Phase 1: 编辑器外壳与通用 fs 接口 - Research

**Researched:** 2026-10-09
**Domain:** 既有 TypeScript/React 19 monorepo 内部重构——把 `@motajs/editor-core` 的面板系统从「注册面板对象」改造为「注册面板类型 + 动态实例」，并新增一个只定义不实现的通用 fs 接口类型
**Confidence:** HIGH（结论均来自本会话对仓库源码的逐文件阅读与实测运行；无需外部资料）

## Summary

本阶段是**纯仓库内重构**，不引入任何新外部库、不访问网络、不涉及数据库/服务。研究结论全部来自对现有 `packages/libs/editor-core/src/**`、`packages/apps/editor/src/Workbench/**`、`packages/apps/editor/src/services/fs/fs.ts`、`packages/apps/service-worker/src/server/fsApi.ts` 的阅读，以及对现有测试与门禁脚本的实测运行。

**最关键的三条事实（研究过程中发现、直接影响规划）：**

1. **当前仓库整体是「红」的，只有 `editor-core` 自身是绿的。** `@motajs/editor` 应用在旧里程碑末尾被刻意留成编译失败（数百条 TS 错误，因其 import 的旧 core/impl API 已被删除），`editor-impl` 只剩 `export {};` 占位。`editor-core` 自身 `tsc -b` 通过、`vitest` 45/45 通过。因此「现有测试全绿」这一验收基线在本阶段**只能按 `editor-core` 理解**，不能理解为「全仓 `pnpm test`/`pnpm typecheck` 绿」。
2. **面板系统是本阶段唯一被有意打破的公开契约。** `EditorPanelCreator` 当前签名是 `(context) => Promise<IEditorPanel>`（`panel/types.ts:95`），`registerPanel` 一调用即创建并登记**单个**面板实例；本阶段要改成「注册面板**类型**（含 id/名称/图标 + 工厂），由 core 生成唯一实例 id 并支持同类型多实例」。这会改写 `panelSystem.test.ts`（17 个用例）与 `core.test.ts` 中依赖旧 API 的用例——这是 D-07 明确接受的 one-way 变更，不是回归。
3. **CI 门禁部分已经过时失效。** `scripts/verify/coreExports.js` 指向已归档目录的 `subpathStatus.json`（实测 exit 1）；`scripts/verify/coreBoundaries.js` 引用了已不存在的 `editor-impl` 能力目录（实测 exit 1）；`coreModuleState.js`/`coreImportType.js`/`coreEngineNeutral.js` 三个门禁实测对当前 `editor-core` 通过，且**会继续约束本阶段新写的代码**。新 shell 代码必须满足这些门禁（禁 `import type`、禁模块级可变状态/容器、禁 `fetch`/`document`/`navigator`等全局、禁引擎术语、禁底层 IO 调用形态）。

**Primary recommendation:** 本阶段按「先接口、后实现」拆成两组计划——第一批只写**类型定义**（面板类型/实例契约、菜单项契约、fs 接口类型，落在 `editor-core` 的 `types.ts` 与新增的 `fs` 定义文件，不含任何实现体），经 `INTERFACE-NAME.md` 确认命名后再写实现（Shell 渲染根 + 标签/实例管理 + 相应测试）。fs 接口只作为**导出类型**存在，仓库内不得有任何 `implements`/调用；用一条可失败的门禁断言「仓库不存在默认实现」来满足 SHELL-01/CORE-01 的验收 5。

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 外壳布局（菜单行 + 标签行 + 内容区） | editor-core（React 组件） | — | D-14：外壳及其页面/标签管理属 core，引擎无关 |
| 面板类型注册表（id/名称/图标/工厂） | editor-core（内存状态） | 外部装配方（注册动作） | D-08/D-10/D-14；core 提供 API，外部在装配时调用 |
| 面板实例生命周期（创建/销毁） | editor-core | 面板实现（`IEditorPanel`） | D-09/D-10/D-11；core 生成实例 id 并调度 `initialize`/`dispose` |
| 标签页管理（新建/关闭/自动切换） | editor-core | — | D-02..D-05；纯 UI 导航状态 |
| 菜单项注册与渲染 | editor-core（渲染） | 外部（标题 + 回调） | D-12；core 负责画那一行，外部提供内容 |
| 通用 fs 接口 | editor-core（**仅类型导出**） | 宿主（真正实现，本仓库外） | D-13/CORE-01；core 与 impl 都不实现、不引用 |
| fs 实现（HTTP / FSA / Node） | 宿主（`@motajs/editor` 或 service-worker） | — | 本阶段明确不做；现有实现位于 `apps/editor/src/services/fs/fs.ts` 与 `apps/service-worker/src/server/fsApi.ts`，仅作方法集参照 |
| mota-js 引擎适配 | `@motajs/editor`（本阶段不动） | — | 本阶段为 core 内部重构，不触碰编辑器应用 |

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SHELL-01 | 编辑器以固定外壳呈现（固定布局 + 命名插槽），完成后画面与现状一致 | 由面板类型/实例模型（D-07..D-11）+ 标签状态机（D-02..D-05）+ 菜单项注册（D-12）实现；渲染根复用现有 `panelSystem.render()` 的位置与 `useSyncExternalStore` 机制（`panelSystem.ts:33-36,62,168-170`）。「画面与现状一致」在本阶段是指外壳本身可被渲染与操作，而非与现有工作台 UI 逐像素相同（现有工作台是工作区导航，不是标签外壳）。 |
| CORE-01 | `editor-core` 暴露通用 fs 接口（只定义接口、不提供实现），由外部注入真正的实现 | 接口方法集对齐 `apps/editor/src/services/fs/fs.ts` 的 `FsPromiseApi`（`readFile`/`readFileBinary`/`writeFile`/`writeMultiFiles`/`readdir`/`mkdir`/`moveFile`/`deleteFile`）与宿主 `apps/service-worker/src/server/fsApi.ts` 的操作集（`readFile`/`writeFile`/`writeMultiFiles`/`listFile`/`makeDir`/`moveFile`/`deleteFile`）；D-13 要求覆盖读/写/列目录/建目录/移动/删除。只导出类型，无实现。 |
</phase_requirements>

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** 外壳顶部为**两行**：第一行菜单行（文件/编辑/…），第二行标签行；下方为内容区。
- **D-02:** 编辑器加载完成后**默认打开一个空白新标签页**；**允许存在多个**空白新标签页。
- **D-03:** 标签栏每个标签对应一个**面板实例**，各带一个 **×** 关闭；标签栏最右是一个 **+**，点击打开一个新的空白新标签页。
- **D-04:** 空白新标签页内列出**当前已注册的面板类型**（显示 **名称 + 图标**）；点击某一项即用该类型的一个新实例**替换这个空白标签页**。
- **D-05:** 关闭标签（×）= **销毁该实例（`dispose`）并移除标签**；随后**自动切到相邻标签**；若已无其它标签，则回到一个**空白新标签页**。
- **D-06:** 空壳（未注册任何面板类型时）外壳照常呈现：菜单行 + 标签行（含 `+` 与默认空白标签），空白页的列表为空。
- **D-07:** 面板注册由「注册面板**对象**」改为「注册面板**类型**（工厂/构造器）」；同一类型可创建**多个独立实例**（例如两个表格面板编辑不同内容，互不冲突）。 — **Reversibility:** one-way — 这会改动 `panel/types.ts` 的公开契约（`registerPanel`/`EditorPanelCreator`/`IPanelSystem`），一旦有其他实现或调用方依赖旧签名，回退需要迁移它们。
- **D-08:** 面板类型携带元信息：**唯一 id**、**名称**、**图标**（分类分组后续有需求再加）。
- **D-09:** `core` 创建实例时向工厂传 **`(context, 实例 id)`**；**实例 id 由 core 生成、唯一**，用于区分同类型的多个实例。**本阶段不引入额外的「打开参数」**——「编辑不同内容」靠实例 id（以及后续能力层自行解决）。
- **D-10:** `core` 支持**动态注册/注销面板类型**，以及**动态创建/关闭面板实例**。
- **D-11:** 保留 `IEditorPanel` 作为**实例**接口（实例有唯一 id 与方法）。
- **D-12:** 菜单行由外部以「**菜单项（标题 + 点击回调）**」注册；`core` 负责渲染这一行。
- **D-13:** 通用 fs 接口**只是 `editor-core` 导出的一个接口类型**（无默认实现、无占位实现）；`editor-core` 与 `editor-impl` **都不实现也不引用**它，由外部实现并自行使用。方法覆盖：**读 / 写 / 列目录 / 建目录 / 移动 / 删除**。
- **D-14:** 外壳及其页面/标签管理属 **`editor-core`**；面板类型与菜单项由**外部（impl / 编辑器顶层）**注册；fs 实现由**宿主**提供。
- **D-15:** 编辑器由**外部装配**；加载完成后基本系统（面板类型、菜单项等）**应已注册完毕**。

### the agent's Discretion
- 具体接口命名、方法签名、内部结构（标签状态如何存放、渲染根如何组成）由 agent 在规划时提出；**命名按项目规则先经用户确认**。
- 空白新标签页列表的具体视觉（布局/样式）由 agent 决定，保持**朴素、简洁**（D-09，项目 Code style）。

### Deferred Ideas (OUT OF SCOPE)
- **面板类型分类分组** —— 用户 2026-10-09：暂时「名称 + 图标」，后续有需求再加分类。
- **「打开参数」** —— 本阶段不做；「编辑不同内容」靠实例 id，后续能力层再定。
- **通用 fs 接口的实现 / 占位实现** —— 本阶段只定义接口。
- **插件加载 / 注册 / 生命周期机制** —— 后续里程碑。
- **布局自定义** —— 明确不做。
</user_constraints>

## Standard Stack

本阶段**不新增任何依赖**。全部实现在既有 `editor-core` 的依赖面上完成。

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | 19.3.0（`packages/libs/editor-core/package.json:17`） | 外壳组件与渲染根 | core 已是 React 库；`render(): FC` 契约早已存在 |
| @tanstack/store | `catalog:default`（`packages/libs/editor-core/package.json:16`） | 变更通知源，供 `useSyncExternalStore` 订阅 | 现有 `PanelSystem` 即用 `Store<number>` + `useSyncExternalStore`（`panelSystem.ts:1,56,71`）；沿用即可，无需引入 `@tanstack/react-store` |

### Supporting（现有、内部复用，非新增）
| Library | Location | Purpose | When to Use |
|---------|----------|---------|-------------|
| vitest 4.0.18 | `packages/libs/editor-core/vitest.config.ts` | 单元/组件测试 | 所有新测试 |
| @testing-library/react 16.3.2 | `packages/libs/editor-core/package.json:21` | jsdom 下渲染与交互断言 | Shell 组件测试 |
| jsdom 26.1.0 | `packages/libs/editor-core/package.json:23` | DOM 环境 | 测试运行环境 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@tanstack/store` + `useSyncExternalStore` | `@tanstack/react-store` 的 `useStore` | 需要给 `editor-core` 新增依赖；与「不因拆分引入不必要运行时依赖」约束冲突；现有代码已示范 `useSyncExternalStore` 方案 |
| 纯 CSS / 内联样式 | PandaCSS / antd | `editor-core` 当前**没有任何** UI 库依赖（`package.json:15-27` 仅 `@tanstack/store` + `react`）；外壳朴素即可，不应为它拉入 UI 框架 |

**Installation:**
```bash
# 无。本阶段不执行任何安装。
```

**Version verification:** 无需——未引入新包。既有依赖版本以 `packages/libs/editor-core/package.json` 与 `pnpm-workspace.yaml` catalog 为准。

## Package Legitimacy Audit

**本阶段不安装任何外部包**（`editor-core` 现有依赖 `react@19.3.0`、`@tanstack/store@catalog:default` 已在 lockfile 中）。因此**无需**运行 Package Legitimacy Gate，审计表为空。

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| *(无新增)* | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
外部装配方（editor-impl / 编辑器顶层 / 宿主）
      │  registerPanelType(type)      registerMenuItem(item)
      ▼                                ▼
┌──────────────────────────────────────────────────────────────┐
│ EditorCore (组合根, src/core.ts)                                │
│  ├─ undoSystem    (现有, 不直接参与外壳)                        │
│  ├─ resourceSystem(现有, 经注入供给面板上下文)                   │
│  └─ panelSystem / shellSystem  ← 本阶段改造对象                  │
│        ├─ 面板类型注册表  Map<typeId, IEditorPanelType>          │
│        ├─ 菜单项注册表    IEditorMenuItem[]                      │
│        ├─ 标签列表        IEditorTab[]（tabId + instanceId|null）│
│        ├─ 实例注册表      Map<instanceId, IEditorPanel>          │
│        └─ Store + useSyncExternalStore  → 变更即重渲染           │
└──────────────────────────────────────────────────────────────┘
      │  shellSystem.render(): FC
      ▼
  <ShellRoot>  (缓存一次的根组件)
   ├─ <MenuRow>   菜单行：遍历菜单项，点击调 onClick
   ├─ <TabRow>    标签行：每个标签 × 关闭；末尾 + 新建空白标签
   └─ <ContentArea>
        activeTab.instanceId == null
          → <BlankTab> 列出全部已注册类型（名称 + 图标），点击 → 用该类型实例替换本标签
          → <PanelHost> createElement(instance.render())
```

数据流：外部注册动作 → 注册表 → `Store` 版本自增 → `useSyncExternalStore` 使 `<ShellRoot>` 重渲染 → 内容区按当前标签渲染 `IEditorPanel.render()`。关闭标签时先 `instance.dispose()` 再更新标签列表并自动激活相邻标签。

### Recommended Project Structure

```
packages/libs/editor-core/src/
├── core.ts                 # 组合根：构造并 initialize/dispose 各系统（现有，需接线新外壳）
├── types.ts                # IEditorCore / IEditorCoreInjection（现有，可能扩展注入）
├── index.ts                # 包根桶（现有，追加导出）
├── panel/                  # 【本阶段主要改造面】
│   ├── types.ts            # 面板类型/实例/上下文/系统契约（改）
│   ├── panelSystem.ts      # 类型与实例/标签管理实现（改）
│   ├── panelContext.ts     # 面板侧上下文（基本不变）
│   ├── shellSystem.ts      # 【建议新增】外壳渲染根（或并入 panelSystem）
│   └── index.ts            # 桶
├── fs/                     # 【本阶段新增，仅类型】
│   ├── types.ts            # 通用 fs 接口类型（只定义）
│   └── index.ts            # 桶
├── resource/ undo/ hook/ log/  # 现有系统（不改）
└── __tests__/ panel/__tests__/ # 测试（panel 测试需按新契约重写）
```

> 目录/文件命名以上为**建议**，须经 `INTERFACE-NAME.md` 确认（见文末「Proposed Names」）。

### Pattern 1: 面板类型注册 + 动态实例（替换现有「注册对象」）
**What:** 注册表键从「面板实例 id」变为「面板类型 id」；实例 id 由 core 生成，工厂签名变为 `(context, instanceId) => Promise<IEditorPanel>`。
**When to use:** 外部在装配时调用 `registerPanelType`；用户点击空白标签中的类型项时调用内部 `createInstance`。
**Example（形如现状的最小骨架，非最终实现）:**
```typescript
// 现有契约（改动前，来源：packages/libs/editor-core/src/panel/types.ts:95,113）
export type EditorPanelCreator = (context: IEditorPanelContext) => Promise<IEditorPanel>;
// registerPanel(panel: EditorPanelCreator): Promise<IEditorPanel | null>;
```

### Pattern 2: `useSyncExternalStore` + 版本号发布订阅
**What:** 用一个 `Store<number>` 或缓存快照对象作为唯一变更源，`render()` 返回**一次性缓存**的根组件（避免每次 `render()` 产生新组件导致重挂）。
**When to use:** 标签栏/内容区/菜单行任何状态变化。
**Example（现状，来源：packages/libs/editor-core/src/panel/panelSystem.ts:33-36,62,71-73,168-170）:**
```typescript
function PanelRoot(props: IPanelRootProps): ReactElement | null {
  const current = useSyncExternalStore(props.subscribe, props.getSnapshot);
  return current ? createElement(current.render()) : null;
}
// ...
this.RootComponent = () => createElement(PanelRoot, { subscribe: this.subscribe, getSnapshot: this.getSnapshot });
```
**关键陷阱：** `useSyncExternalStore` 的 `getSnapshot` 在无变化时必须返回**引用稳定**的值。现有代码返回 `this.currentPanel`（稳定引用）。改为「标签数组快照」时**不能**每次返回新数组，否则触发无限重渲染——要么返回版本号并在组件内读取可变状态（现状做法），要么缓存不可变快照对象。

### Pattern 3: 实例级资源钩子
**What:** 现有 `EditorPanelHooks` 把资源更新桥接给面板（`panelSystem.ts:213-239`），且以 `Map<IEditorPanel, IHookController>` 绑定（`panelSystem.ts:48`）。新模型需按 `instanceId` 绑定，且注销类型/关闭标签时必须 `unload()`，否则「关闭/注销不残留实例」失败。
**When to use:** `createInstance` 时 `addHook`，`closeInstance`/`unregisterPanelType` 时 `unload`。

### Anti-Patterns to Avoid
- **把「面板类型」和「面板实例」混为一谈：** 注册类型时**不得**创建实例（D-07/D-10）；否则「已注册但未打开」的类型也会 `initialize`，且无法同类型多实例。
- **在壳里实现 fs：** D-13 明确禁止。core 只导出类型。
- **在 core 里写模块级可变状态/容器：** `coreModuleState.js` 门禁会红（详见 Common Pitfalls）。
- **渲染根每次 `render()` 返回新组件：** 会导致 React 反复重挂实例、丢失面板内部状态。

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 变更 → 重渲染 | 自造事件总线 + `useState` 强制刷新 | 现有 `@tanstack/store` + `useSyncExternalStore` 模式 | 仓库既有范式（`panelSystem.ts`），且无需新依赖；手动 `useState` 容易在标签状态与实例状态间产生一致性 bug |
| 唯一实例 id | 自造自增计数器 / 时间戳 | 现有可用的稳定 id 方案 | 需在「同一次会话内唯一、可预测、可测」，并在关闭后不重用；时间戳有碰撞风险 |
| fs 方法集设计 | 凭空造一套名字 | 对齐既有 `FsPromiseApi` / 宿主 fsApi 操作集 | 保证未来宿主实现能无缝适配现有 HTTP/FSA 后端（见 Standard Stack 与 Code Examples） |
| 面板上下文资源桥接 | 重新实现资源请求 | 复用 `PanelContext`（`panelContext.ts`）与 `EditorPanelHooks` | 现有实现已处理资源列表缓存与钩子隔离 |

**Key insight:** 本阶段所有「轮子」在仓库里几乎都已存在——真正的风险不是缺能力，而是**打破既有面板契约后忘记同步测试与门禁**。

## Runtime State Inventory

> 本阶段是重构/契约变更（面板注册从「对象」改为「类型」）。逐类回答：

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None** —— 面板系统状态仅存在于内存（`Map`/`Store`），不落盘、不进 IndexedDB、不进任何持久化格式。已核对 `panelSystem.ts` 全部成员与 `core.ts` 生命周期。 | 无数据迁移 |
| Live service config | **None** —— core 不调用任何外部服务；`panelType`/菜单注册是进程内内存动作。 | 无 |
| OS-registered state | **None** —— 不涉及任务计划/服务/守护进程。 | 无 |
| Secrets/env vars | **None** —— 无密钥、无环境变量名引用（`coreModuleState.js` 还禁止 `process.env`/`import.meta.env`）。 | 无 |
| Build artifacts | `packages/libs/editor-core/tsconfig.tsbuildinfo`（`tsc -b` 增量产物）会在新增/删除源文件后陈旧；非源码、非契约，重建即可。 | 增量编译自动重建，无需手工迁移 |

**Nothing found** 的类别均已逐条显式说明，非「未检查」。

## Common Pitfalls

### Pitfall 1: 旧面板契约测试全红被误判为「回归」
**What goes wrong:** 改造 `registerPanel`/`EditorPanelCreator`/`IPanelSystem` 后，`panelSystem.test.ts`（17 用例）与 `core.test.ts` 中注册/切换面板的用例必然失败；若把它当作「必须保持的现有测试」就会卡死。
**Why it happens:** D-07 是**有意**的 one-way 契约变更；旧测试钉住的是被废除的契约。
**How to avoid:** 明确将这些用例归类为「按新契约重写」，其余测试（undo/resource/hook/log/infrastructure/core 结构）必须保持通过。规划中把「重写 panel 测试」列为显式任务，而非意外。
**Warning signs:** 计划里写「保持全部现有测试通过」而没有区分 panel 测试。

### Pitfall 2: `useSyncExternalStore` 的 `getSnapshot` 返回新引用导致无限渲染
**What goes wrong:** 若把标签列表作为快照，每次 `getSnapshot()` `map()` 出新数组，`useSyncExternalStore` 会认为状态永远在变，触发无限重渲染。
**Why it happens:** `useSyncExternalStore` 用 `Object.is` 比较快照。
**How to avoid:** 沿用现状「版本号 + 组件内读取可变状态」策略，或缓存不可变快照（仅在变更时重建）。
**Warning signs:** 测试里 `render()` 后出现 `Maximum update depth exceeded`。

### Pitfall 3: 模块级状态/容器门禁（实测会红）
**What goes wrong:** `coreModuleState.js` 对 `packages/libs/{editor-core,editor-impl}/src` 的**生产**源码强制：禁止模块级 `let`/`var`；禁止模块级 `const` 以 `new Map()/Set/WeakMap/WeakSet`、数组字面量、对象字面量初始化。只有 `Object.freeze({...})` 与 `{...} as const` 豁免，且 `src/core.ts`、测试目录被豁免。
**Why it happens:** Phase 2 教训——无法失败的门禁与没有门禁不可区分；Vite/ESM 下模块级可变状态会破坏多实例与热更新。
**How to avoid:** 把注册表/标签状态全部放进类实例字段；常量表用 `Object.freeze({...})`（现状 `log/messages.ts:4` 即此写法）。
**Warning signs:** `pnpm lint` 在 core 新增文件上报 `no-restricted-syntax`（error）。

### Pitfall 4: 开发/禁用全局与 `import.meta.env`（实测会红）
**What goes wrong:** 同一门禁禁止在 core/impl 生产源码出现 `fetch`/`document`/`navigator`/`localStorage`/`XMLHttpRequest`（`window` 已被豁免）与 `process.env`/`import.meta.env`。窗口焦点监听现用 `window.addEventListener`（`panelSystem.ts:94-95`，被豁免）。
**How to avoid:** 外壳不得自行读取文档/存储/网络；一切数据经注册注入。

### Pitfall 5: 引擎术语门禁（含**注释**，实测会红）
**What goes wrong:** `coreEngineNeutral.js` 扫描 core/impl 生产源码**原始文本**（注释也算），禁词：`tower`/`floor`/`loc`/`autopass`/`autotile`/`idnum`/`airwall`/`commonEvent`/`prefab`/`mota`，大小写敏感，`\b` 词边界（`Math.floor` 的成员访问被豁免）。
**How to avoid:** 外壳/类型/注释里不要出现这些词；尤其不要写「mota-js」「commonEvent」等示例。用中性的「面板/标签/类型」词汇。

### Pitfall 6: 底层 IO 调用形态门禁（实测会红，且**不剥离注释**）
**What goes wrong:** `coreBoundaries.js` 的「底层 IO 清零」扫描 `packages/libs/editor-core/src` **原始文本**，禁 token：`this.fs`、`.readFile(`、`.readFileBinary(`、`.writeFile(`、`.deleteFile(`、`.readdir(`、`.mkdir(`、`.moveFile(`。**JSDoc 里若写 `fs.readFile(...)`（带前导点）会误触**。
**How to avoid:** fs 接口用**方法签名**（`readFile(path: string): Promise<string>;`，无前导点）；注释示例避免 `xxx.readFile(` 形式。
**Warning signs:** `coreBoundaries` 报「底层出现 N 条文件读写调用」。

### Pitfall 7: 注销/关闭后残留实例
**What goes wrong:** 只从注册表删除而忘记 `dispose()` 实例、`unload()` 资源钩子，或忘记关闭其标签，导致「关闭/注销不残留实例」验收失败。
**How to avoid:** 单一出口：`unregisterPanelType(id)` 内部先遍历该类型所有活跃实例执行关闭，再删类型；`closeTab(tabId)` 内部负责 dispose + 钩子卸载 + 标签移除 + 自动切换。

### Pitfall 8: 全仓门禁已红被误当作本阶段责任
**What goes wrong:** `coreExports.js`、`coreBoundaries.js` 当前因引用已归档里程碑的路径/目录而失败（实测 exit 1）；`@motajs/editor` 应用编译失败数百条。若计划把「CI 全绿」当作本阶段验收，范围会爆炸。
**How to avoid:** 本阶段验收限定在 `editor-core`（其 `typecheck` + `test` + 三个仍生效的 core 门禁）。是否修复过时门禁/应用是**独立的范围决策**，需用户确认（见 Open Questions）。

## Code Examples

以下均为对**现有源码**的引用（本次会话已逐文件读取），用于对齐新接口的形状；**不是**要照抄的实现。

### 现有面板公开契约（改动前 —— 本阶段要打破的对象）
```typescript
// Source: packages/libs/editor-core/src/panel/types.ts:39-41,95,99-142,145-147
export interface IEditorPanel extends IUndoable {
  /** 编辑器功能的标识符 */
  readonly id: string;
  // initialize()/dispose()/render(): FC/onFocus/onBlur/onSwitchIn/onSwitchOut/onUpdateResource/onUpdateResourceList
}
export type EditorPanelCreator = (context: IEditorPanelContext) => Promise<IEditorPanel>;
export interface IPanelSystem extends IUndoable {
  readonly currentPanel: IEditorPanel | null;
  registerPanel(panel: EditorPanelCreator): Promise<IEditorPanel | null>;
  disposePanel(panel: IEditorPanel): Promise<void>;
  getPanel(id: string): IEditorPanel | null;
  switchTo(panel: IEditorPanel, param?: Record<string, unknown>): Promise<void>;
  render(): FC;
  dispose(): Promise<void>;
}
export const enum PanelUndoType {
  /** 面板切换 */
  Switch,
}
```

### 现有 FS Promise 方法集（新通用 fs 接口的方法集参照）
```typescript
// Source: packages/apps/editor/src/services/fs/fs.ts:23-32
export interface FsPromiseApi {
  readFile(filename: string, encoding: FileEncoding): Promise<string>;
  readFileBinary(filename: string): Promise<ArrayBuffer>;
  writeFile(filename: string, data: string, encoding: FileEncoding): Promise<void>;
  writeMultiFiles(filenames: string[], dataList: string[]): Promise<void>;
  readdir(path: string): Promise<string[]>;
  mkdir(path: string): Promise<void>;
  moveFile(src: string, dest: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
}
```
```typescript
// Source: packages/apps/service-worker/src/server/fsApi.ts:53-100（宿主操作集）
// switch (operation): readFile / writeFile / writeMultiFiles / listFile / makeDir / moveFile / deleteFile
```

### 现有 `useSyncExternalStore` 渲染根
```typescript
// Source: packages/libs/editor-core/src/panel/panelSystem.ts:33-36
function PanelRoot(props: IPanelRootProps): ReactElement | null {
  const current = useSyncExternalStore(props.subscribe, props.getSnapshot);
  return current ? createElement(current.render()) : null;
}
```

### 现有组合根生命周期（外壳接线位置）
```typescript
// Source: packages/libs/editor-core/src/core.ts:38-47
const arr = [this.undoSystem.initialize(injection), this.resourceSystem.initialize(injection)];
await Promise.all(arr);
await this.panelSystem.initialize(injection);
// dispose 逆序：
await this.panelSystem.dispose();
await this.resourceSystem.dispose();
await this.undoSystem.dispose();
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 注册面板**对象**（一次注册即一个实例，`registerPanel(creator)` 立即创建） | 注册面板**类型**（含元信息 + 工厂），core 生成实例 id，支持同类型多实例 | 本阶段（D-07，one-way） | `registerPanel`/`EditorPanelCreator`/`IPanelSystem` 契约变更；旧面板测试需重写 |
| `currentPanel` 单当前面板 | 浏览器式标签列表 + 活动标签 | 本阶段 | 新增标签状态机；是否保留「面板切换」撤销需决策（见 Open Questions） |
| 现有 `@motajs/editor` 工作区导航（顶部工作区按钮） | core 提供菜单行 + 标签行外壳 | 本阶段仅为 core 内部新能力；编辑器应用后续阶段才接入 | 本阶段「画面与现状一致」按「外壳可渲染、可操作」理解，非逐像素对齐现有工作台 |

**Deprecated/outdated:**
- `scripts/verify/coreExports.js` 中写死的 `subpathStatus.json` 路径（指向归档里程碑 `.planning/phases/02-package-boundary-build-scaffolding/`）与 `coreBoundaries.js` 对 `editor-impl` 能力目录（`code`/`table`/`map`/`asset`/`shell`/`react`）的引用——随旧里程碑归档而失效。本阶段不必然修复，但须知悉。

## Proposed Names (UNCONFIRMED — 必须先写 `INTERFACE-NAME.md` 并经用户确认)

> 以下**全部为提案**，尚未经用户确认，**不得**直接写入代码/计划/配置。按项目规则，命名须在对应 Phase 目录的 `INTERFACE-NAME.md` 中逐 Plan 一节列出「该命名是干什么的」，确认后方可落盘。

| 提案名 | 种类 | 用途 |
|--------|------|------|
| `IEditorPanelType` | interface | 描述一个「面板类型」：id、名称、图标、创建实例的工厂 |
| `EditorPanelFactory` | type | 面板实例工厂签名：`(context, instanceId) => Promise<IEditorPanel>`（替代/演进 `EditorPanelCreator`） |
| `IEditorMenuItem` | interface | 菜单项：id、标题、点击回调（D-12） |
| `IEditorTab` | interface | 一个标签：标签 id + 其对应的实例 id（`null` 表示空白标签） |
| `IPanelSystem`（修订） | interface | 面板类型/实例/标签/菜单的统一对外契约（或拆出 `IEditorShellSystem`） |
| `ShellSystem` | class | 外壳实现（渲染根、注册表、标签状态机） |
| `IEditorFileSystem` | interface | 通用 fs 接口类型（只定义，读写/列目录/建目录/移动/删除） |
| `editorFileSystem.ts` / `packages/libs/editor-core/src/fs/` | path | fs 接口定义文件与目录 |
| `shellSystem.ts` | path | 外壳实现文件 |
| 日志 id（如 `panelType.duplicateId`） | string 常量键 | 新增日志消息，写入 `log/messages.ts` |

**可命名空间备选：** 面板系统文件名保持 `panel/`，外壳作为其中的 `shellSystem.ts`，或另开 `shell/` 目录——由用户/规划确定。

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 本阶段验收基线是 `editor-core` 自身（`tsc -b` + `vitest`），而非全仓 `pnpm test`/`pnpm typecheck` | Summary / Pitfall 8 | 若用户期望全仓绿，本阶段范围会大幅膨胀，需重新界定并可能阻塞 |
| A2 | 面板切换不再需要进入撤销/重做历史（`PanelUndoType.Switch` 可移除或改为不记录），因为标签导航不是文档编辑 | Open Questions / State of the Art | 若用户期望标签切换可撤销，需保留并改造 `PanelUndoType` 及 `IUndoSystem` 接线与测试 |
| A3 | 外壳视觉采用纯 React +（内联样式或 core 自带 CSS），不引入 PandaCSS/antd | Standard Stack / Discretion | 若用户期望与现有 `@motajs/editor` 视觉一致，需评估在无 UI 依赖的 core 中如何复用样式 |
| A4 | 「图标」以 React 可渲染值（组件或 `ReactNode`）表达，由外部提供，core 不做图标解析 | Architecture / D-08 | 若用户期望图标是字符串名并由 core 统一解析成图标库，接口形状会变 |
| A5 | 现有三个仍生效的 core 门禁（moduleState/importType/engineNeutral/boundaries-IO）继续适用，新代码必须满足 | Common Pitfalls | 若用户决定暂时放宽门禁，实现约束会变化 |

**如果本表非空：** 上述 A1–A5 需在规划/讨论阶段与用户确认，尤其 A1（验收基线）与 A2（撤销语义）会决定计划数量与测试范围。

## Open Questions

1. **验收基线范围（A1）**
   - What we know: `editor-core` 自身绿（45 测试通过、`tsc -b` 通过）；`@motajs/editor` 与部分 CI 门禁当前红（旧里程碑遗留）。
   - What's unclear: 本阶段是否要求修复过时门禁（`coreExports.js`/`coreBoundaries.js`）或触及编辑器应用。
   - Recommendation: 默认**只对 `editor-core` 负责**；修复过时门禁作为独立可选任务，先向用户确认。

2. **标签切换是否进入撤销历史（A2）**
   - What we know: 现状 `switchTo` 记录 `PanelUndoType.Switch` 并参与 `undoSystem`。
   - What's unclear: 新标签模型中关闭标签/切换标签是否应可撤销。
   - Recommendation: 建议**不**将标签导航纳入撤销（导航非编辑）；在 `INTERFACE-NAME.md`/计划中显式声明并由用户确认。

3. **外壳与面板系统的边界（`shellSystem` vs `panelSystem`）**
   - What we know: D-14 说外壳与标签管理属 core；D-12 菜单是独立关注点。
   - What's unclear: 是 `IPanelSystem` 同时管面板类型/实例/标签/菜单，还是拆成 `IShellSystem`（外壳+标签+菜单）包含 `IPanelSystem`（类型+实例）。
   - Recommendation: 倾向拆分关注点但保持对外仅经 `core` 暴露；最终由接口定义计划确定并经命名确认。

4. **是否在核心内提供默认空白标签的初始状态**
   - What we know: D-02 要求加载后默认一个空白标签。
   - What's unclear: 该默认标签是 `initialize` 时自动创建，还是由外部显式调用。
   - Recommendation: 由 `EditorCore.initialize`（或 shell 初始化）自动放置一个空白标签，符合 D-15「加载完成后基本系统已就绪」。

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | 构建/测试 | ✓ | v24.21.0 | — |
| pnpm | workspace 脚本 | ✓ | 12.5.1（`.github/workflows/ci.yml:22`） | — |
| Vitest | core 测试 | ✓ | 4.0.18（`packages/libs/editor-core/vitest.config.ts` 实测） | — |
| jsdom | 组件测试环境 | ✓ | 26.1.0 | — |
| React | 外壳渲染 | ✓ | 19.3.0（catalog 同款） | — |
| @tanstack/store | 变更通知 | ✓ | catalog:default | — |
| ESLint（含 core 门禁块） | 门禁 | ✓ | 9.39.2 | — |
| dependency-cruiser | `coreBoundaries.js` | ✓ | catalog:default | — |

**Missing dependencies with no fallback:** 无。

**Missing dependencies with fallback:** 无。

> 本阶段无外部服务、数据库、CLI 工具依赖；上表均为本地已存在的开发依赖（通过运行 `pnpm --filter @motajs/editor-core test` 45/45、`tsc -b` 通过验证其可用）。

## Validation Architecture

> `.planning/config.json` 中 `workflow.nyquist_validation: true` → 本节启用。

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 + @testing-library/react 16.3.2 + jsdom 26.1.0 |
| Config file | `packages/libs/editor-core/vitest.config.ts` |
| Quick run command | `pnpm --filter @motajs/editor-core test` |
| Full suite command | `pnpm test`（**注意：当前全仓红**，见 Open Question 1；本阶段以 core 过滤命令为准） |
| Typecheck command | `pnpm --filter @motajs/editor-core typecheck` |
| Core gates（仍生效） | `node scripts/verify/coreModuleState.js`、`node scripts/verify/coreImportType.js`、`node scripts/verify/coreEngineNeutral.js`、`node scripts/verify/coreBoundaries.js`（后者的 IO 断言部分） |

**实测基线（本会话）：**
- `pnpm --filter @motajs/editor-core test` → 5 文件 45 测试全通过。
- `pnpm --filter @motajs/editor-core typecheck` → 退出 0。
- `node scripts/verify/coreModuleState.js` → 通过；`coreImportType.js` → 通过；`coreEngineNeutral.js` → 通过。
- `node scripts/verify/coreExports.js` → **exit 1**（引用已归档的 `subpathStatus.json`）。
- `node scripts/verify/coreBoundaries.js` → **exit 1**（「能力互斥」合成 fixture 因 `editor-impl` 能力目录不存在而不触发；及后继的 editor→impl 边断言）。
- `pnpm --filter @motajs/editor typecheck` → **exit 2**（应用数百条错误，旧里程碑遗留，本阶段不动）。

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SHELL-01 | 加载后渲染外壳：菜单行 + 标签行（含 `+` 与一个默认空白标签） | component | `pnpm --filter @motajs/editor-core test -- -t "外壳"`（示例） | ❌ Wave 0（需新建 shell 测试） |
| SHELL-01 | 注册面板类型 → 空白标签列出该类型（名称 + 图标）；点击即开实例替换空白标签 | component | 同上 | ❌ Wave 0 |
| SHELL-01 | 同类型多实例互相独立、生命周期各自独立 | component/unit | 同上 | ❌ Wave 0 |
| SHELL-01 | 关闭标签销毁实例并自动切换；无标签时回到空白标签 | component/unit | 同上 | ❌ Wave 0 |
| SHELL-01 | 注销面板类型：不残留实例与标签；已注册菜单项可注销 | unit | 同上 | ❌ Wave 0 |
| SHELL-01 | 空壳（零类型）仍渲染菜单行 + 标签行 + 空白标签 | component | 同上 | ❌ Wave 0 |
| SHELL-01 | 现有面板契约用例按新契约重写后通过 | unit | `pnpm --filter @motajs/editor-core test` | ✅ 需重写 `src/panel/__tests__/panelSystem.test.ts`、`src/__tests__/core.test.ts` |
| CORE-01 | fs 接口类型可被外部 `import` 到并结构匹配（类型层） | typecheck | `pnpm --filter @motajs/editor-core typecheck` | ❌ Wave 0（新增 `fs/types.ts`） |
| CORE-01 | 仓库中不存在 fs 默认实现，core/impl 不引用 | static gate | 新增/扩展门禁脚本（见下） | ❌ Wave 0 |
| CORE-01 | 新 fs 接口定义不触发底层 IO 清零门禁 | static gate | `node scripts/verify/coreBoundaries.js`（IO 断言） | ✅ 现有（须保持通过） |

### Sampling Rate
- **Per task commit:** `pnpm --filter @motajs/editor-core test`
- **Per wave merge:** `pnpm --filter @motajs/editor-core test` + `pnpm --filter @motajs/editor-core typecheck` + 三个仍生效 core 门禁
- **Phase gate:** core 测试全绿 + core typecheck 通过 + 三个仍生效 core 门禁通过，再做关键流程手动验收

### Wave 0 Gaps
- [ ] `packages/libs/editor-core/src/__tests__/`（或 shell 同目录 `__tests__/`）——外壳行为测试（SHELL-01）
- [ ] 面板系统测试按新契约重写（现有 `src/panel/__tests__/panelSystem.test.ts`）
- [ ] `src/__tests__/core.test.ts` 中依赖旧面板 API 的用例更新
- [ ] fs 接口定义文件 `packages/libs/editor-core/src/fs/types.ts` + 桶（CORE-01）
- [ ] 一条可失败的「不存在 fs 默认实现 / core·impl 不引用」门禁（建议新增 `scripts/verify/coreFsSurface.js` 或扩展现有脚本），采用与既有门禁相同的「真实树 + 两极性 fixture」写法
- [ ] 共享测试夹具（若有）：面板类型/实例的 Fake 实现，避免多处重复

*(部分基础设施已存在：`infrastructure.test.ts` 证明 jsdom+RTL 可用，`mapPolyfill.ts` 提供 `Map.getOrInsert*` 垫片。)*

## Security Domain

> `.planning/config.json`：`security_enforcement: true`、`security_asvs_level: 1` → 本节启用。

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | 本阶段无认证 |
| V3 Session Management | no | 无会话 |
| V4 Access Control | no | 无权限面 |
| V5 Input Validation | yes（弱） | 面板类型/菜单注册入参校验（唯一 id、非空名称、重复 id 拒绝并记日志）；React 默认转义渲染文本 |
| V6 Cryptography | no | 无加密 |

### Known Threat Patterns for editor-core 外壳 + 类型定义

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 通过面板名称/标题注入标记（XSS） | Tampering | React 默认对文本转义；**不得**用 `dangerouslySetInnerHTML` 渲染注册内容 |
| 重复/伪造面板类型 id 覆盖既有注册 | Tampering | 注册时校验唯一 id，重复则拒绝并 `logger.error`（沿用 `panel.duplicateId` 思路） |
| core 越权触达文件/网络 | Information Disclosure / Elevation | D-13 + 门禁：core 不实现、不调用 fs；不读写文档/存储/网络（`coreModuleState.js` 禁全局） |
| 宿主 fs 路径穿越 | Tampering | **不在本阶段范围**——当前路径安全由宿主的 `normalizeProjectPath`（`apps/service-worker/src/server/fsApi.ts:24-37`）承担；core 只定义类型、不校验路径 |

> 结论：本阶段安全面很小，主要是「不引入 IO/网络/HTML 注入」。真正的路径安全与认证属宿主，本阶段不动。

## Sources

### Primary (HIGH confidence) — 本会话直接阅读/实测的仓库源码
- `packages/libs/editor-core/src/panel/types.ts`（面板公开契约，逐行引用）
- `packages/libs/editor-core/src/panel/panelSystem.ts`（实现、`useSyncExternalStore`、生命周期）
- `packages/libs/editor-core/src/panel/panelContext.ts`、`src/core.ts`、`src/types.ts`、`src/index.ts`
- `packages/libs/editor-core/src/{resource,undo,hook,log}/**`、`src/__tests__/core.test.ts`、`src/panel/__tests__/panelSystem.test.ts`
- `packages/libs/editor-core/package.json`、`tsconfig.json`、`vitest.config.ts`
- `packages/apps/editor/src/services/fs/fs.ts`、`packages/apps/service-worker/src/server/fsApi.ts`（fs 方法集参照）
- `packages/apps/editor/src/Workbench/index.tsx`、`Workbench/AppTopBar.tsx`、`stores/PanelStore.ts`（外壳视觉/机制参照）
- `scripts/verify/{coreExports,coreImportType,coreModuleState,coreEngineNeutral,coreBoundaries}.js`、`.dependencyCruiser.cjs`、`.github/workflows/ci.yml`（门禁约束）
- 实测命令输出：`pnpm --filter @motajs/editor-core test`（45/45）、`pnpm --filter @motajs/editor-core typecheck`（exit 0）、各门禁退出码

### Secondary (MEDIUM confidence)
- `.planning/` 文档（PROJECT/REQUIREMENTS/ROADMAP/STATE/CONTEXT）作为需求与决策来源（用户产出）

### Tertiary (LOW confidence)
- 无。本阶段**未使用**外部网络检索：该阶段领域是本仓库的内部重构，锁定决策已足够，且 `.planning/config.json` 未配置任何搜索 provider（`exa/brave/firecrawl/tavily/ref/perplexity/jina` 全为 `false`）。

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH —— 无新依赖；现有依赖与测试框架实测可用。
- Architecture: HIGH —— 契约、生命周期、渲染机制均逐行读过；改造点为公开契约的有意变更，路径清晰。
- Pitfalls: HIGH —— 门禁均实测运行并确认绿色/红色状态；`import type`/模块状态/引擎术语/底层 IO 四类门禁真实存在。
- fs 方法集: HIGH —— 同时对照编辑器侧与宿主侧两份实现得出。

**Research date:** 2026-10-09
**Valid until:** 约 30 天（内部重构，稳定）；若旧里程碑门禁脚本/编辑器应用状态变化则需复核。
