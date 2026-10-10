---
phase: 01-shell
plan: 02
subsystem: editor-core
tags: [typescript, react, editor-core, shell, tabs, panel-registry]

# Dependency graph
requires:
  - phase: 01-shell
    plan: 01
    provides: "外壳契约 IShellSystem / IShellInjection / IEditorMenuItem / IEditorTab；面板类型契约 IEditorPanelType / EditorPanelFactory"
provides:
  - "ShellSystem：面板类型注册表、面板实例生命周期、浏览器式标签状态机、菜单项注册与渲染根"
  - "ShellPanelHooks：按实例 id 绑定资源更新的桥接钩子（承接被删除的 EditorPanelHooks）"
  - "EditorCore 经 IEditorCore.shellSystem 暴露外壳；旧 PanelSystem / IPanelSystem / EditorPanelCreator / PanelUndoType 被移除"
  - "EditorPanelFactory 改为同步单参数 (param: IEditorPanelFactoryParam) => IEditorPanel"
affects: [01-03 外壳样式, 01-04 fs 面门禁, editor-impl]

actuals:
  tokens: 16867
  tasks: 2
  commits: 2
  plan_head_before: faa4cff

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useSyncExternalStore 订阅 Store<number> 版本源 + 一次性缓存根组件"
    - "getSnapshot 返回在状态变更时重建、其余时刻引用稳定的缓存视图状态"
    - "外壳状态（注册表/实例/标签/菜单）全放实例字段；模块层只放纯函数组件"

key-files:
  created:
    - packages/libs/editor-core/src/shell/shellSystem.ts
    - packages/libs/editor-core/src/shell/__tests__/shellSystem.test.ts
  modified:
    - packages/libs/editor-core/src/panel/types.ts
    - packages/libs/editor-core/src/shell/index.ts
    - packages/libs/editor-core/src/core.ts
    - packages/libs/editor-core/src/types.ts
    - packages/libs/editor-core/src/panel/index.ts
    - packages/libs/editor-core/src/__tests__/core.test.ts
  deleted:
    - packages/libs/editor-core/src/panel/panelSystem.ts
    - packages/libs/editor-core/src/panel/__tests__/panelSystem.test.ts

key-decisions:
  - "getSnapshot 返回在 notify() 时重建的缓存视图状态（含 activeTab/activePanel/状态），而非每次新建数组，避免无限重渲染"
  - "实例创建拆为同步 createInstance + 异步 initializeInstance，使「标签已存在、实例初始化中」的加载态真实可达"
  - "工厂抛错 → openPanelInTab 返回 false 且标签保持空白；IEditorPanel.initialize() reject → 标签显示「面板打开失败」错误态（标签保持可关闭）"
  - "注销面板类型时经 closeTab 关闭其全部标签（并 dispose 对应实例），再清理不在标签内的残留实例"
  - "组件用 createElement（非 JSX），文件为 .ts；菜单行/标签行用 aria-label，控件为原生 button"

patterns-established:
  - "外壳状态机：每次变更重建快照并自增版本源，唯一订阅点在 ShellRoot"
  - "面板类型注册原子校验（id/name 非空、create 为函数），重复 id 记 shell.duplicatePanelType 且不覆盖"

requirements-completed: [SHELL-01]

coverage:
  - id: D1
    description: "ShellSystem 端到端闭环：注册类型 → 空白标签列出 → 打开实例替换标签 → 内容区渲染 → 关闭自动切换/重建"
    requirement: "SHELL-01"
    verification:
      - kind: unit
        ref: "packages/libs/editor-core/src/shell/__tests__/shellSystem.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "EditorCore 经 shellSystem 暴露外壳，旧 PanelSystem 契约与测试被彻底移除（无残留引用）"
    requirement: "SHELL-01"
    verification:
      - kind: unit
        ref: "packages/libs/editor-core/src/__tests__/core.test.ts"
        status: pass
      - kind: other
        ref: "pnpm --filter @motajs/editor-core typecheck"
        status: pass
      - kind: other
        ref: "node scripts/verify/coreImportType.js && node scripts/verify/coreEngineNeutral.js && node scripts/verify/coreModuleState.js"
        status: pass
    human_judgment: false
  - id: D3
    description: "内容区状态覆盖：零类型空态、初始化中加载行、初始化失败错误文案、标签导航不进撤销历史"
    requirement: "SHELL-01"
    verification:
      - kind: unit
        ref: "packages/libs/editor-core/src/shell/__tests__/shellSystem.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "外壳的最终目视验收（菜单行/标签行/内容区的视觉呈现与样式）"
    verification: []
    human_judgment: true
    rationale: "本计划仅实现引擎无关的行为与结构；样式表属 01-03、宿主接入属 @motajs/editor 阶段，视觉验收须在真实宿主中人工判定。"

# Metrics
duration: 25min
completed: 2026-10-10
status: complete
---

# Phase 1 Plan 02: 外壳系统实现 Summary

**一个引擎无关的 ShellSystem 落地：注册面板类型即可从空白标签页打开同类型多实例，标签可关闭并自动切换到相邻标签，EditorCore 改经 shellSystem 暴露外壳，旧 PanelSystem 被彻底删除**

## Performance

- **Duration:** 约 25 min
- **Started:** 2026-10-10T19:20Z (approx)
- **Completed:** 2026-10-10T19:45Z (approx)
- **Tasks:** 2（Task 1 为已由用户解决的 checkpoint；本次执行 Task 2、Task 3）
- **Files modified:** 10（2 新增 / 6 修改 / 2 删除）

## Accomplishments
- `ShellSystem` 实现 `IShellSystem` 全部方法：面板类型注册表、实例生命周期、标签状态机、菜单项、渲染根；零注册时仍稳定呈现菜单行 + 标签行 + 空白标签页。
- 端到端 tracer 走通：注册类型 → 空白标签页列出 → 打开实例原位替换标签 → 内容区渲染 → 关闭触发 `dispose` 并自动切到相邻标签（优先左邻）→ 关闭最后一个标签重建空白标签。
- 同类型多实例互不冲突、各自独立 `dispose`；注销面板类型会关闭其全部实例与标签且不残留。
- `EditorCore` 改为构造/注入/释放 `shellSystem`（逆序释放）；`IEditorCore` 暴露 `shellSystem: IShellSystem`；`EditorPanelFactory` 改为同步单参数形。
- 删除 `panelSystem.ts` 与其测试，移除 `IPanelSystem` / `EditorPanelCreator` / `PanelUndoType` / `IPanelInjection`，全仓无残留引用。

## Task Commits

Each task was committed atomically:

1. **Task 2: 实现 ShellSystem** - `6afe235` (feat)
2. **Task 3: 迁移 EditorCore 到 shellSystem 并删除旧 PanelSystem** - `2aec6f4` (refactor)

**Plan metadata:** 本次 SUMMARY 提交（docs: complete plan）

_Note: 无 TDD 任务，无多提交。接口修订提交 `faa4cff`（EditorPanelFactory 单参数同步形）由编排器在 checkpoint 解决时落库。_

## Files Created/Modified
- `packages/libs/editor-core/src/shell/shellSystem.ts` - 新增。`ShellSystem` + `ShellPanelHooks` + 模块层渲染组件（`ShellRoot`/`MenuRow`/`TabRow`/`ContentArea`/`BlankTabList`/`PanelHost`）
- `packages/libs/editor-core/src/shell/__tests__/shellSystem.test.ts` - 新增。端到端 + 状态机 + 资源桥接 + 状态覆盖共 16 用例
- `packages/libs/editor-core/src/panel/types.ts` - 新增 `IEditorPanelFactoryParam`、`EditorPanelFactory` 改同步单参数；删除 `EditorPanelCreator` / `IPanelSystem` / `PanelUndoType` / `IPanelInjection`
- `packages/libs/editor-core/src/shell/index.ts` - 追加 `export * from './shellSystem'`
- `packages/libs/editor-core/src/core.ts` - 组合根改用 `shellSystem`（构造/注入/逆序释放）
- `packages/libs/editor-core/src/types.ts` - `IEditorCoreInjection extends IShellInjection`；`IEditorCore` 暴露 `shellSystem`
- `packages/libs/editor-core/src/panel/index.ts` - 移除 `./panelSystem` 导出
- `packages/libs/editor-core/src/__tests__/core.test.ts` - 面板相关用例改走 `shellSystem` 新 API
- `packages/libs/editor-core/src/panel/panelSystem.ts` - 删除（被 `ShellSystem` 取代）
- `packages/libs/editor-core/src/panel/__tests__/panelSystem.test.ts` - 删除

## Decisions Made
- **快照策略**：`IShellSystem.getSnapshot` 返回在 `notify()` 时重建、其余时刻引用稳定的缓存视图状态（含 `activeTab` / `activePanel` / 状态）；订阅点唯一在 `ShellRoot`，避免每次渲染新建数组导致无限重渲染（对应 T-02-04）。
- **加载态可达性**：把实例创建拆为同步 `createInstance` + 异步 `initializeInstance`；`openPanelInTab` 先改写标签（引用新实例）并订阅通知，再 `await initialize`，因此「标签已存在、实例初始化中」的加载行真实可见。
- **失败语义**：工厂抛错 → `openPanelInTab` 返回 `false`、标签保持空白（`shell.instanceCreateFailed`）；`IEditorPanel.initialize()` reject → 该标签显示「面板打开失败」错误文案、标签保持可关闭。
- **注销语义**：`unregisterPanelType` 先经 `closeTab` 关闭该类型的全部标签（顺带 `dispose` 实例），再清理不在任何标签内的残留实例，最后删除类型。
- **渲染实现**：组件用 `createElement`（文件为 `.ts`，非 JSX）；菜单行/标签行用 `aria-label`（「主菜单」/「编辑器标签页」），控件均为原生 `<button type="button">`，`+` 与 `×` 带 `aria-label`。

## Deviations from Plan

### Auto-fixed / in-plan adjustments

**1. [Within-plan] 实例创建拆为 `createInstance` / `initializeInstance`（私有）**
- **Found during:** Task 2
- **Issue:** 计划把「工厂同步创建 + 登记」与「await initialize」都写进 `createPanelInstance`，并让 `openPanelInTab` 在 `createPanelInstance` 成功后改写标签——这会让标签在初始化完成前一直保持空白，加载态不可达。
- **Fix:** 抽出私有 `createInstance`（同步：解析类型/生成 id/调用工厂/登记/挂资源钩子/通知）与 `initializeInstance`（异步：初始化并记录 Loading/Ready/Error）；`openPanelInTab` 用前者先改写标签使加载态可达，`createPanelInstance` 仍按计划在末尾 `await initializeInstance`。
- **Files modified:** `packages/libs/editor-core/src/shell/shellSystem.ts`
- **Verification:** `shellSystem.test.ts` 的「实例初始化未完成时显示加载行」「实例初始化失败时显示错误态」通过。
- **Committed in:** `6afe235`

**2. [Within-plan] 快照采用缓存视图状态而非每次新建数组**
- **Found during:** Task 2
- **Issue:** 计划允许 `getSnapshot` 返回「引用稳定的版本号或缓存快照」；若直接返回每次 `map()` 出的新数组会触发无限重渲染。
- **Fix:** 用实例字段缓存 `IShellViewState`，仅 `notify()` 时重建。
- **Files modified:** `packages/libs/editor-core/src/shell/shellSystem.ts`
- **Verification:** 所有渲染用例无 `Maximum update depth exceeded`。
- **Committed in:** `6afe235`

**3. [Within-plan] 同时移除已无引用的 `IPanelInjection`**
- **Found during:** Task 3
- **Issue:** 计划允许「若 `IPanelInjection` 已无引用可一并删除，但需同步 types.ts」；切到 `IShellInjection` 后其确实无引用。
- **Fix:** 删除 `IPanelInjection`，`IEditorCoreInjection` 改 extends `IShellInjection`。
- **Files modified:** `panel/types.ts`、`types.ts`
- **Committed in:** `2aec6f4`

**4. [Rule 3 - Blocking] 测试显式调用 RTL `cleanup()`**
- **Found during:** Task 2（`shellSystem.test.ts` 首轮失败）
- **Issue:** vitest 未开启 `globals`，RTL 自动清理未注册，导致 DOM 在用例间累积、`getByText` / `getByLabelText` 命中多个元素。
- **Fix:** 测试文件顶层 `afterEach(() => cleanup())`。
- **Files modified:** `packages/libs/editor-core/src/shell/__tests__/shellSystem.test.ts`
- **Verification:** 单文件 16/16 绿；不触发 `coreModuleState` 的 module-state 规则（测试树豁免）。
- **Committed in:** `6afe235`

**Total deviations:** 4（3 项计划内设计选择，1 项测试基建修阻）
**Impact on plan:** 均为实现正确性所需；无范围蔓延，未引入新依赖。

## Issues Encountered
- `.git/gsd-plan-head-before-01-02` 存在上一次运行的陈旧基线（指向 406 个提交之前）。执行前已把基线重置为本计划起点 `faa4cff`，故 `actuals.commits: 2` 由 `git rev-list --count faa4cff..HEAD` 实测得出。
- `findstr` 对中文子串匹配在本机代码页下不可靠，直接用脚本自身退出码与输出判定门禁结果。

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 外壳行为与状态机已就绪并经单测覆盖；01-03（外壳样式 `shell.css` + `global.d.ts` + `package.json` sideEffects）可在其渲染结构上补齐视觉。
- 待用户确认：`INTERFACE-NAME.md` Plan 02 的命名（`ShellSystem` / `ShellPanelHooks` / 组件名与 props 接口）与 A6（实例 id 会话内递增）。
- 本计划**未**触碰 `log/messages.ts` 的旧 `panel.*` 条目（无害的中央消息表数据，按计划保留）；也**未**更新 STATE.md / ROADMAP.md（由编排器负责）。

## Verification Evidence
- `pnpm --filter @motajs/editor-core typecheck`（`tsc -b`）→ 退出 0。
- `pnpm --filter @motajs/editor-core test` → 5 文件 / 44 用例全绿（新增 shell 16；旧 `panelSystem.test.ts` 17 已删除）。
- `node scripts/verify/coreImportType.js` → 真实树 32 文件、0 条 `import type`；两极性成立。
- `node scripts/verify/coreEngineNeutral.js` → 真实树 26 生产文件、0 条引擎术语；两极性成立。
- `node scripts/verify/coreModuleState.js` → 真实树 0 条 error 级受限规则；豁免与覆盖面成立。
- 无残留契约：`registerPanel\b|IPanelSystem|EditorPanelCreator|PanelUndoType` 在 `packages/libs/editor-core/src` 下 0 命中。

## Self-Check: PASSED

- 文件 `packages/libs/editor-core/src/shell/shellSystem.ts` → FOUND
- 文件 `packages/libs/editor-core/src/shell/__tests__/shellSystem.test.ts` → FOUND
- 提交 `6afe235` → FOUND
- 提交 `2aec6f4` → FOUND

---
*Phase: 01-shell*
*Completed: 2026-10-10*
