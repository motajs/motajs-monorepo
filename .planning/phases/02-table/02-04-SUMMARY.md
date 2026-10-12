---
phase: 02-table
plan: 04
subsystem: editor-impl
tags: [table, tracer, json-schema, panel, resource-layer, antd, vitest, jsdom, editor-impl]

# Dependency graph
requires:
  - phase: 01-shell
    provides: "editor-core 外壳（ShellSystem.registerPanelType / createPanelInstance）与面板模型（IEditorPanel / IEditorPanelContext.requestResource）"
  - phase: 02-table
    provides: "src/table 的类型面与 TableResourceType 枚举（02-02）：ITableSchemaNode / ITableRowNode / ITablePanelTarget / ITablePanel"
provides:
  - "editor-impl 的测试工程脚手（vitest setupFiles + Map 垫片 + 根桶），使套件首次非空"
  - "@motajs/editor-impl/table 的可用面板类型 tablePanelType 与只读四栏表格组件 TableGrid"
  - "经资源层读取 table.<name> / table#schema.<name> 的端到端读路径，与递归行树构建 buildTableTree"
affects: [02-05, 02-06, 02-07, 02-08, 02-09, 02-10]

# Actuals (#2632)
# tokens = chars/4 over the realized editor-impl diff (lockfile 生成物与编辑器外文件不计入)
actuals:
  tokens: 8416
  tasks: 3
  commits: 3
  plan_head_before: 73642aa2ce481eae0ef0e486856bd87570a1ae7d

# Tech tracking
tech-stack:
  added:
    - "@testing-library/react 16.3.2（devDependency，jsdom 组件测试；T-02-SC 允许，无运行时依赖）"
  patterns:
    - "面板经 context.requestResource 读资源；数据与 schema 一律走资源层，绝不碰通用 fs 接口或宿主/引擎代码"
    - "面板实例状态（目标表、已加载内容）留在实例字段；视图状态经实例级 @tanstack/store Store + @tanstack/react-store useStore 发布给渲染组件"
    - "表格组件完全由 props 驱动（rows + status + mode + 回调），面板类型只是它的一个消费者（D-01/D-18）"
    - "结构桶：每个目录一个 index.ts（export *），父桶只 export * 子目录，不写跨目录深路径转发"

key-files:
  created:
    - "packages/libs/editor-impl/src/__tests__/mapPolyfill.ts"
    - "packages/libs/editor-impl/src/table/model/traversal.ts"
    - "packages/libs/editor-impl/src/table/model/index.ts"
    - "packages/libs/editor-impl/src/table/tablePanel.ts"
    - "packages/libs/editor-impl/src/table/tablePanelType.ts"
    - "packages/libs/editor-impl/src/table/components/TableGrid.tsx"
    - "packages/libs/editor-impl/src/table/components/index.ts"
    - "packages/libs/editor-impl/src/table/table.css"
    - "packages/libs/editor-impl/src/table/__tests__/fixtures.ts"
    - "packages/libs/editor-impl/src/table/__tests__/tracer.test.tsx"
  modified:
    - "packages/libs/editor-impl/vitest.config.ts"
    - "packages/libs/editor-impl/package.json"
    - "packages/libs/editor-impl/src/index.ts"
    - "packages/libs/editor-impl/src/table/resourceType.ts"
    - "packages/libs/editor-impl/src/table/index.ts"
    - "pnpm-lock.yaml"

key-decisions:
  - "面板状态枚举 TablePanelStatus 与组件 props ITableGridProps 落在 TableGrid.tsx：types.ts 不在本计划 files_modified 内，且若让 TableGrid 反向引用 tablePanel 会形成环依赖（AGENTS.md 禁循环引用）"
  - "schema 缺失或非对象 → 不产生任何行（空态，正文「尚未定义任何字段。」，遵 D-29 与 must_haves 真值 35）；schema 是对象但无 properties → 回退用数据自身键作叶子行（遵 Task 2 action 原文）"
  - "tablePanelType 用 Object.freeze({...}) 定义：模块级对象字面量会被 coreModuleState 门禁判红，Object.freeze(...) 是门禁明示的结构性豁免"
  - "行树 key 用字段路径字符串（如 nested.inner）；分组行/叶子行由 schema 节点是否 object 且自带 properties 判定（D-24）"
  - "onSwitchIn 重新请求数据与 schema 并重算（D-15 修订 / D-31）；本阶段 ShellSystem 尚未调用 onSwitchIn，测试直接调用以作确定性同步点"

patterns-established:
  - "只读 tracer：单元格值以 React 文本节点渲染（字符串原样、其余 JSON 文本），绝不 dangerouslySetInnerHTML"
  - "错误态在行为关键路径用 try/catch 落回固定文案，不把后端错误/栈透出（T-02-13）"

requirements-completed: [TABLE-01]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "表格面板类型可注册进真实 ShellSystem，并由其工厂创建出面板实例"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/tracer.test.tsx#tablePanelType 可注册进外壳"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/tracer.test.tsx#未设目标时渲染未设置目标态"
        status: pass
    human_judgment: false
  - id: D2
    description: "设定目标后经资源层读取数据与 schema，递归构建行树并渲染只读四栏网格（含可折叠分组行）"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/tracer.test.tsx#设置目标后渲染四栏网格与分组 / 叶子行"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/tracer.test.tsx#分组行折叠与展开切换子行是否在 DOM 中"
        status: pass
    human_judgment: false
  - id: D3
    description: "加载 / 空 / 错误 / 未设目标四种状态渲染固定中文文案"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/tracer.test.tsx#资源尚未返回时显示加载态"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/tracer.test.tsx#schema 无字段时显示空态默认文案"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/tracer.test.tsx#schema 缺失时显示尚未定义任何字段"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/tracer.test.tsx#资源请求失败时显示错误态且面板保持打开"
        status: pass
    human_judgment: false
  - id: D4
    description: "单元格内容一律作文本渲染，脚本样值不生成任何元素（T-02-11）"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/tracer.test.tsx#危险值以字面文本渲染"
        status: pass
    human_judgment: false
  - id: D5
    description: "editor-impl 测试工程脚手就位，套件首次非空且全绿（Wave 0）"
    requirement: TABLE-01
    verification:
      - kind: other
        ref: "pnpm --filter @motajs/editor-impl test"
        status: pass
      - kind: other
        ref: "pnpm --filter @motajs/editor-impl typecheck"
        status: pass
    human_judgment: false
  - id: D6
    description: "表格画面观感（约 400px 固定栏宽、栏间/行间分割线、横向滚动、悬停高亮）"
    requirement: TABLE-01
    verification: []
    human_judgment: true
    rationale: "布局/滚动/悬停依赖真实浏览器渲染，jsdom 不做布局；按 02-VALIDATION.md 属手动验收，留待宿主集成或人工目视。"

# Metrics
duration: 44min
completed: 2026-10-12
status: complete
---

# Phase 2 Plan 04: 表格 tracer（注册 → 打开 → 设目标 → 读 → 渲染）Summary

**让 editor-impl 第一次能跑测试，并把「表格面板」这条最薄的端到端链路打通并锁死：面板类型注册进外壳、实例被创建、经资源层读 `table.<name>` 与 `table#schema.<name>`、按 JSON Schema 的 properties 递归成行树、渲染成只读四栏网格**

## Performance

- **Duration:** ~44 min
- **Started:** 2026-10-12T13:21:08Z
- **Completed:** 2026-10-12T14:05:36Z
- **Tasks:** 3
- **Files modified:** 16（含 `pnpm-lock.yaml`）

## Accomplishments

- **打通一条端到端链路**：`tablePanelType`（面板类型）注册进真实 `ShellSystem` → 工厂造出 `TablePanel` → `TablePanel.setTable` 设目标 → 经面板上下文的**资源层**读数据与 schema → `buildTableTree` 递归成行树 → `TableGrid` 渲染四栏。
- **数据与 schema 只走资源层**：`TablePanel` 只调 `context.requestResource`，不碰通用 fs 接口、不导入宿主/引擎代码；面板不持有任何全局「当前表格」。
- **行树按标准 JSON Schema 递归**：schema 的 `properties` 为行；`type === 'object'` 且自带 `properties` 的节点成可折叠分组行，其余成叶子行；schema 未声明但数据里有的字段补成叶子行兜底（D-29）。
- **工程脚手就位（Wave 0）**：`vitest.config.ts` 加 `setupFiles`、新增 Map 垫片、`sideEffects` 改为 CSS glob、根桶改为 `export * from './table'`；editor-impl 套件**首次非空**（9 用例全绿）。
- **四种状态与安全渲染**：加载 / 空 / 错误 / 未设目标各渲染固定中文文案；单元格一律 React 文本节点，脚本样值只作字面文本（T-02-11）。

## Task Commits

每个任务原子提交：

1. **Task 1: 工程脚手与 Wave-0 测试基线** — `24d60cb` (chore)
2. **Task 2: 端到端 tracer 实现（注册 → 打开 → 设目标 → 读 → 渲染）** — `c4fabdb` (feat)
3. **Task 3: 用测试端到端证伪/证实这条链路** — `ffd3647` (test)

**Plan metadata:** 本 SUMMARY 与 STATE.md/ROADMAP.md 的更新随后以 docs 提交。

## Files Created/Modified

- `packages/libs/editor-impl/vitest.config.ts` — 加 `setupFiles: ['src/__tests__/mapPolyfill.ts']`（其余环境/含/插件不动）。
- `packages/libs/editor-impl/package.json` — `sideEffects` 改 CSS glob；devDeps 加 `@testing-library/react`、`react`/`react-dom` 钉到 `19.3.0`。
- `packages/libs/editor-impl/src/index.ts` — 根桶改为 `export * from './table'`。
- `packages/libs/editor-impl/src/__tests__/mapPolyfill.ts` — `Map.getOrInsert` / `getOrInsertComputed` 垫片（复用 editor-core 实现）。
- `packages/libs/editor-impl/src/table/resourceType.ts` — 实现两个 id 构造器 `tableDataResourceId` / `tableSchemaResourceId`。
- `packages/libs/editor-impl/src/table/model/traversal.ts` — `buildTableTree(schema, data)` 递归行树构建。
- `packages/libs/editor-impl/src/table/model/index.ts`、`components/index.ts` — 目录桶（`export *`）。
- `packages/libs/editor-impl/src/table/tablePanel.ts` — `TablePanel` 类（实现 `IEditorPanel` + `ITablePanel`），实例级 `Store`，`onSwitchIn` 重取资源。
- `packages/libs/editor-impl/src/table/tablePanelType.ts` — 可注册的面板类型（id/name/内联 SVG 图标/同步工厂）。
- `packages/libs/editor-impl/src/table/components/TableGrid.tsx` — 只读四栏网格 + 分组折叠 + 四种状态视图；`TablePanelStatus` 与 `ITableGridProps`。
- `packages/libs/editor-impl/src/table/table.css` — 约 400px 固定四栏、分割线、横向滚动、悬停样式。
- `packages/libs/editor-impl/src/table/index.ts` — 汇总新导出面。
- `packages/libs/editor-impl/src/table/__tests__/fixtures.ts` — 内存资源后端 `FakeResourceInjection`（seed / failing / hanging）。
- `packages/libs/editor-impl/src/table/__tests__/tracer.test.tsx` — 9 个端到端 / 状态用例。

## Decisions Made

- **状态枚举与组件 props 的落点**：`TablePanelStatus` 与 `ITableGridProps` 放在 `TableGrid.tsx`。`types.ts` 不在本计划 `files_modified` 内；且若把枚举放 `tablePanel.ts`、让 `TableGrid` 反向 import 面板，就形成 `TableGrid ↔ tablePanel` 环依赖（AGENTS.md「无循环引用」）。放到组件侧后依赖单向（面板 → 组件）。
- **schema 缺失 / 无 properties 的分级（对两处书面要求的取舍）**：must_haves 真值 35 说「schema 缺失或非对象 → 不产生任何行」，而 Task 2 action 原文说「schema 缺失或没有 properties → 回退用数据自身键」。取二者可同时成立的读法：**缺失或非对象 → 空态（正文「尚未定义任何字段。」，与 D-29 一致）；是对象但无 `properties` → 用数据自身键作叶子行**。
- **`Object.freeze` 定义面板类型**：模块级对象字面量会被 `coreModuleState` 门禁判红；`Object.freeze({...})` 是该门禁明示的结构性豁免，也是对外的冻结常量。
- **`onSwitchIn` 作为确定性同步点**：`setTable` 是 `void` 异步刷新，接口形状已确认；测试在 `setTable` 后 `await panel.onSwitchIn()`，既等待刷新完成又顺带验证 D-15 修订版的重取行为。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 补 `@testing-library/react` devDependency 并安装**
- **Found during:** Task 3（首个 `.tsx` 测试无法解析 `@testing-library/react`）
- **Issue:** editor-impl 未声明该包，jsdom 组件测试无从写起。
- **Fix:** 在 devDependencies 声明 `@testing-library/react: 16.3.2`（对齐 editor-core），经代理安装（T-02-SC 明确允许为编译/运行测试补 devDependency）。
- **Files modified:** `packages/libs/editor-impl/package.json`、`pnpm-lock.yaml`
- **Verification:** 探针用例可解析并通过。
- **Committed in:** `ffd3647`

**2. [Rule 3 - Blocking] `react` / `react-dom` devDependency 钉到 `19.3.0`**
- **Found during:** Task 3（`react-dom` 抛 "Incompatible React versions"）
- **Issue:** 二者原用 `catalog:default`，锁文件解析出 `react@19.2.3` 与 `react-dom@19.3.0`，`react-dom` 在 import 时直接报版本不一致并拒绝加载——任何渲染测试都跑不起来。
- **Fix:** 将两者 devDependency 钉为精确 `19.3.0`（与 editor-core 完全一致；peerDependency 的 catalog 范围不动）。
- **Files modified:** `packages/libs/editor-impl/package.json`、`pnpm-lock.yaml`
- **Verification:** `react` 与 `react-dom` 均为 `19.3.0`，测试通过。
- **Committed in:** `ffd3647`

**3. [Rule 3 - Blocking] 补 `src/table/index.ts` 与新桶 `model/index.ts`、`components/index.ts`**
- **Found during:** Task 2（`./table` 需要导出新增的公开面）
- **Issue:** 计划 `files_modified` 未列 `src/table/index.ts`，但 D-01 要求 `./table` 导出面板类型与表格组件；且 AGENTS.md 桶规则禁跨目录深路径转发，故 `traversal` / `TableGrid` 需各自目录的桶。
- **Fix:** 更新 `src/table/index.ts`（`export *` 直系文件与子目录），新增 `src/table/model/index.ts`、`src/table/components/index.ts`。
- **Files modified:** `packages/libs/editor-impl/src/table/index.ts`、`src/table/model/index.ts`、`src/table/components/index.ts`
- **Verification:** `pnpm --filter @motajs/editor-impl typecheck` 退出 0；测试经桶导入成功。
- **Committed in:** `c4fabdb`

**4. [Rule 1 - Bug] antd 按钮禁自动插空格（`autoInsertSpace: false`）**
- **Found during:** Task 3（错误态用例取不到「重试」按钮文本）
- **Issue:** antd 对「恰两个中文字」的按钮会自动在两字之间插一个空格，默认按钮渲染成「重 试」，精确文本断言失败（`type: 'text'` 的折叠按钮因属无边框类型而不受影响）。
- **Fix:** 给重试与折叠按钮加 `autoInsertSpace: false`，使渲染文本与标签一致。
- **Files modified:** `packages/libs/editor-impl/src/table/components/TableGrid.tsx`
- **Verification:** 错误态用例取到「重试」且其 `closest('button')` 非空。
- **Committed in:** `c4fabdb`（Task 2 实现文件）→ 修正随后并入同一实现提交前的工作树，最终随 `c4fabdb`/`ffd3647` 落地

### Flagged Notes（非偏差，但需知悉）

- **`scripts/verify/implExports.js` 已知为红且不在本计划范围**：它断言 `sideEffects === false`（并指向已归档里程碑的 `subpathStatus.json`）。本计划按计划要求把 `sideEffects` 改为 `["./src/**/*.css"]`（与 editor-core 现行约定一字不差），**故意**不保留 `false`；该门禁的修复属 02-10 记账范围，非本计划。
- **新增命名（本计划引入，未在 `INTERFACE-NAME.md` 预先列出）**：`TablePanelStatus`（面板状态枚举：NoTarget/Loading/EmptySchema/Empty/Error/Ready）、`ITableGridProps`、`TableGridChangeHandler`、`ITablePanelViewState`，以及测试侧的 `FakeResourceInjection`。均只在 `src/table` 与测试内使用；因计划已获批准执行，此处按 AGENTS.md「重要命名先确认」**如实登记**而非阻塞；若后续计划需改名，应回到命名确认流程。
- **行为关键路径的 `try/catch`**：`TablePanel.refresh` 用 `try/catch` 把资源读取失败落成固定错误态（D-29 / T-02-13），符合 AGENTS.md 对「保留行为关键路径 try/catch」的覆盖条款，非新增滥用。

---

**Total deviations:** 4 auto-fixed（3 blocking、1 bug），另 3 条为需知悉的登记项。
**Impact on plan:** 三处阻塞均为「让测试跑起来 / 让公开面导出得出来」的必要修补，未改变对外形态；一处 bug 为渲染保真修正。无范围蔓延。

## Issues Encountered

- **本机 shell 是 PowerShell，无 bash**：GSD 的 `gsd_run` 壳脚本是 bash 语法，无法直接执行；改用 GSD MCP 工具（`gsd_gsd_invoke_command` / `gsd_gsd_read_state`）读状态，验证脚本以 `node`/`pnpm` 直接运行。
- **`pnpm install` 走代理会卡死**：带 `HTTP(S)_PROXY` 的第二次安装挂起超过 10 分钟；改用 `pnpm install --filter @motajs/editor-impl --offline`（包已在 store 中）后 13 秒完成。
- **验证脚本必须串行**：四个 `scripts/verify/*.js` 会往 `editor-core/src` 写/删探针并全量 lint；逐个顺序执行，全部退出 0 且无残留（与 02-02/02-03 结论一致）。

## Known Stubs

无。tracer 阶段只读是**已确认的设计**（可交互控件留待 02-06）：`TableGrid` 的 `onChange` 回调成员为已声明的前向接缝，本阶段不触发；`ITableGridProps.mode` 由面板传入 `TableEditMode.Change`。均非「未接线」的 stub。

## Threat Flags

无新增威胁面。落实的缓解：T-02-11（单元格全作文本，无 `dangerouslySetInnerHTML`，且有回归用例）、T-02-12（无表达式求值器，schema 文本从不执行）、T-02-13（读取失败只显示固定文案，不透出后端错误）、T-02-SC（未新增运行时依赖，仅按门禁允许补一个测试 devDependency）。

## Verification Evidence

| 命令 | 结果 |
|------|------|
| `pnpm --filter @motajs/editor-impl typecheck` | 退出 0 |
| `pnpm --filter @motajs/editor-impl test` | 退出 0（1 文件 / 9 测试全通过；套件首次非空） |
| `pnpm --filter @motajs/editor-core test` | 退出 0（5 文件 / 54 测试全通过） |
| `node scripts/verify/coreImportType.js` | 退出 0（扫描 49 文件，0 条 `import type`） |
| `node scripts/verify/coreEngineNeutral.js` | 退出 0（扫描 40 生产文件，0 条引擎标识） |
| `node scripts/verify/coreModuleState.js` | 退出 0（受限规则 error 级 0 条；两极性成立） |
| `node scripts/verify/coreFsSurface.js` | 退出 0（49 文件，`IEditorFileSystem` 仅在声明文件） |
| `pnpm exec prettier --check packages/libs/editor-impl/src` | 退出 0（全部符合 Prettier） |
| `node node_modules/eslint/bin/eslint.js packages/libs/editor-impl/src` | 退出 0（0 error / 2 warning：`react-refresh` 与 02-02 遗留的空接口，均 warn 级） |

## Next Phase Readiness

- `@motajs/editor-impl/table` 现在导出可用的面板类型与可复用的只读表格组件，端到端链路已被提交的测试锁死；02-06（校验 + 行内输入控件）、02-07（编辑模式 + 增删 + 撤销）、02-08（切入刷新 + schema 呈现）、02-09（外部编辑器 + 弹窗）可直接在此组件/面板骨架上叠加。
- 后续计划需注意两点：① `TableGrid` 的 props 是公开面，新增控件/回调时优先扩展它而非在面板里塞逻辑；② `TablePanelStatus` 目前寄居 `TableGrid.tsx`，若后续要独立类型文件，应走命名确认流程并保持无环依赖。
- 手动验收待办（留 02-10 / 宿主集成）：约 400px 固定栏宽、栏间/行间分割线、横向滚动、悬停高亮等**布局观感**在 jsdom 下未断言。

## Self-Check: PASSED

- 新建/修改文件均存在（14 个 editor-impl 文件逐一 `Test-Path` 命中）✔
- 三个任务提交均存在：`24d60cb`、`c4fabdb`、`ffd3647` ✔
- `commits: 3` 为从 `plan_head_before` 实测（`git rev-list --count`）✔

---
*Phase: 02-table*
*Completed: 2026-10-12*
