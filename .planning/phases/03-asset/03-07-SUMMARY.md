---
phase: 03-asset
plan: 07
subsystem: editor-impl-shared
tags: [typescript, schema-form, module-relocation, asset, refactor, css]

# Dependency graph
requires:
  - phase: 03-asset
    provides: "中立目录 src/shared/schemaForm（types + model）与 src/shared/jsonc；本计划把渲染层与样式并入同一目录"
  - phase: 02-table
    provides: "schema 驱动的表格渲染（TableGrid / TableRow / GapRow / 工具栏 / 行内控件 / etable-* 样式）"
provides:
  - "中立表单渲染层 src/shared/schemaForm/components（7 个组件 + 6 个行内控件 + 桶）"
  - "中立表单样式 src/shared/schemaForm/schemaForm.css（类名仍是 etable-*，内容逐字节不变）"
  - "asset 可 import ../../shared/schemaForm/components/TableGrid 渲染每素材配置表单，而不触发 asset → table（D-28 / D-07）"
affects: [03-14]

actuals:
  tokens: 4304
  tasks: 3
  commits: 3
  plan_head_before: b2375debb402a0339875b95b88234b1ce51bdfe0

tech-stack:
  added: []
  patterns:
    - "共享渲染整块搬迁：组件 + 行内控件 + 样式表一起落到中立目录，能力侧只保留自己的专属组件（D-28）"
    - "搬迁用 git mv + 相似度断言验证——TableGrid 98%、TableRow 98%、GapRow 98%、SchemaBanner 96%，其余 100%，差异全部落在 import 行"

key-files:
  created:
    - packages/libs/editor-impl/src/shared/schemaForm/schemaForm.css
    - packages/libs/editor-impl/src/shared/schemaForm/components/TableGrid.tsx
    - packages/libs/editor-impl/src/shared/schemaForm/components/TableRow.tsx
    - packages/libs/editor-impl/src/shared/schemaForm/components/GapRow.tsx
    - packages/libs/editor-impl/src/shared/schemaForm/components/EditModeSegmented.tsx
    - packages/libs/editor-impl/src/shared/schemaForm/components/TableToolbar.tsx
    - packages/libs/editor-impl/src/shared/schemaForm/components/SchemaBanner.tsx
    - packages/libs/editor-impl/src/shared/schemaForm/components/ActionButtons.tsx
    - packages/libs/editor-impl/src/shared/schemaForm/components/index.ts
    - packages/libs/editor-impl/src/shared/schemaForm/components/inputs/index.ts
    - packages/libs/editor-impl/src/shared/schemaForm/components/inputs/CheckboxInput.tsx
    - packages/libs/editor-impl/src/shared/schemaForm/components/inputs/CheckboxSet.tsx
    - packages/libs/editor-impl/src/shared/schemaForm/components/inputs/ColorInput.tsx
    - packages/libs/editor-impl/src/shared/schemaForm/components/inputs/NumberInput.tsx
    - packages/libs/editor-impl/src/shared/schemaForm/components/inputs/SelectInput.tsx
    - packages/libs/editor-impl/src/shared/schemaForm/components/inputs/TextareaInput.tsx
  modified:
    - packages/libs/editor-impl/src/shared/schemaForm/index.ts
    - packages/libs/editor-impl/src/table/tablePanel.ts
    - packages/libs/editor-impl/src/table/components/index.ts
    - packages/libs/editor-impl/src/table/components/TableEmptyColumn.tsx
    - packages/libs/editor-impl/src/table/components/TablePicker.tsx
    - packages/libs/editor-impl/src/table/components/TableCreateForm.tsx
    - packages/libs/editor-impl/src/table/__tests__/edit.test.tsx
    - packages/libs/editor-impl/src/table/__tests__/inputs.test.tsx
    - packages/libs/editor-impl/src/table/__tests__/interaction.uat.test.tsx
    - packages/libs/editor-impl/src/table/__tests__/layout.uat.test.tsx
  removed:
    - packages/libs/editor-impl/src/table/table.css
    - packages/libs/editor-impl/src/table/components/inputs/CheckboxInput.tsx
    - packages/libs/editor-impl/src/table/components/inputs/CheckboxSet.tsx
    - packages/libs/editor-impl/src/table/components/inputs/ColorInput.tsx
    - packages/libs/editor-impl/src/table/components/inputs/NumberInput.tsx
    - packages/libs/editor-impl/src/table/components/inputs/SelectInput.tsx
    - packages/libs/editor-impl/src/table/components/inputs/TextareaInput.tsx
    - packages/libs/editor-impl/src/table/components/inputs/index.ts
    - packages/libs/editor-impl/src/table/components/TableGrid.tsx
    - packages/libs/editor-impl/src/table/components/TableRow.tsx
    - packages/libs/editor-impl/src/table/components/GapRow.tsx
    - packages/libs/editor-impl/src/table/components/EditModeSegmented.tsx
    - packages/libs/editor-impl/src/table/components/TableToolbar.tsx
    - packages/libs/editor-impl/src/table/components/SchemaBanner.tsx
    - packages/libs/editor-impl/src/table/components/ActionButtons.tsx

key-decisions:
  - "样式表与六个行内控件先搬（Task 1）、七个渲染组件再搬（Task 2）、表格侧改指与测试跟随收口在 Task 3——每个提交意图单一，且中间态只影响引用方，不影响被搬内容"
  - "组件里指向 schema 模型的相对路径由 '../../shared/schemaForm/model/*' 收成 '../model/*'（计划任务只点名了 '../../react'），因为搬迁后旧写法会解析到不存在的 src/shared/shared/schemaForm/model"
  - "表格桶只保留三个表格专属组件导出、不做任何跨目录转发（代码风格禁止导出不属于本文件夹的内容）；表单渲染对外统一由 ./shared 暴露"
  - "两个 uat 测试仍以 `TABLE_CSS` 变量做正则断言，只把内联来源换成共享样式表——断言文本一字未改，191 个用例原样通过"

patterns-established:
  - "共享渲染整块：CSS 与组件同时迁移，样式导入随文件 location 改指，避免「组件搬了但样式丢了」这种 jsdom 测不出、只能人工发现的缺口"

requirements-completed: [ASSET-01]

coverage:
  - id: D1
    description: "表格的网格 / 行 / 分组 / 编辑模式 / 工具栏 / 六个行内控件 / 样式整体落在 src/shared/schemaForm，table 与 asset 能渲染同一套表单；外观与行为不变（类名仍 etable-*、data-test-id 全保留）"
    requirement: "ASSET-01"
    verification:
      - kind: unit
        ref: "pnpm --filter @motajs/editor-impl test（26 files / 191 tests 通过，含 interaction.uat / layout.uat 对共享样式表的内联正则断言）"
        status: pass
      - kind: other
        ref: "git diff -M b2375de..HEAD 相似度：ActionButtons / EditModeSegmented / TableToolbar / 六个 inputs / inputs 桶 / schemaForm.css 均 100%，TableGrid 98%、TableRow 98%、GapRow 98%、SchemaBanner 96%，差异全部在 import 行；TableGrid.tsx 仍含 data-test-id"
        status: pass
    human_judgment: false
  - id: D2
    description: "table 侧只剩 TablePicker / TableCreateForm / TableEmptyColumn 三个专属组件，不再拥有表单引擎；shared 不反向 import 任何能力目录"
    requirement: "ASSET-01"
    verification:
      - kind: other
        ref: "结构断言（table/table.css 与 table/components/inputs 已不存在；table/components/index.ts 只有三条导出；tablePanel 从 ../shared/schemaForm/components/TableGrid 取组件）"
        status: pass
      - kind: other
        ref: "node scripts/verify/coreBoundaries.js 退出码 0（真实树 0 error / 0 warn 违规，135 模块 82 依赖；两包包内相对边全部解析回本包）"
        status: pass
      - kind: other
        ref: "pnpm --filter @motajs/editor-impl typecheck 退出码 0"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-10-17
status: complete
---

# Phase 3 Plan 07: 表单渲染抽到 `shared/schemaForm/components` Summary

**把表格的「网格 + 行 + 分组 + 行内控件 + 工具栏 + 样式」整块搬进中立目录 `shared/schemaForm`，表格改为从那里 import——素材的每素材配置表单以后能直接复用同一套渲染，而不用 import 表格。外观、类名、test-id、文案全未变。**

## Performance

- **Duration:** 8 min
- **Started:** 2026-10-17T15:21:13Z
- **Completed:** 2026-10-17T15:29:18Z
- **Tasks:** 3
- **Files modified:** 26 file changes（16 新增/迁入、10 修改；净为 16 个文件整体搬迁）

## Accomplishments

- `table/table.css` 整体搬到 `shared/schemaForm/schemaForm.css`，**逐字节不变**（git 记录 100% rename），类名仍是 `etable-*`；六个行内控件（`CheckboxInput` / `CheckboxSet` / `ColorInput` / `NumberInput` / `SelectInput` / `TextareaInput`）连同 `inputs/index.ts` 一并搬到 `shared/schemaForm/components/inputs/`，同样 100% 不变。
- 七个渲染组件搬到 `shared/schemaForm/components/`。`git diff -M` 显示相似度 96%–100%，差异只落在 import 行：`TableGrid` / `SchemaBanner` 的样式导入改为 `'../schemaForm.css'`；`TableGrid` / `TableRow` 指向 `src/react` 的路径加深为 `'../../../react'`；指向 schema 模型的路径收成 `'../model/*'`。JSX、类名、`data-test-id`、文案一字未动。
- 新建 `shared/schemaForm/components/index.ts`（7 个组件 + `./inputs` 的 `export *`），并在 `shared/schemaForm/index.ts` 追加 `export * from './components'`——现在该桶同时含 types / model / components。
- 表格侧收口：`tablePanel.ts` 从 `../shared/schemaForm/components/TableGrid` 取网格；`table/components/index.ts` 只剩 `TableEmptyColumn` / `TablePicker` / `TableCreateForm` 三条导出；这三个组件与两个 uat 测试的样式引用改指共享样式表。
- 三门禁全绿：`pnpm --filter @motajs/editor-impl test` 26 文件 / 191 用例通过；`typecheck` 退出码 0；`node scripts/verify/coreBoundaries.js` 退出码 0（真实树 0 条 error / 0 条 warn 违规，`shared` 未反向 import 任何能力目录）。

## Task Commits

Each task was committed atomically:

1. **Task 1: 样式表与六个行内控件搬进 shared** - `c0c9d06` (refactor)
2. **Task 2: 七个表单组件搬进 shared 并修正样式导入** - `7572d4f` (refactor)
3. **Task 3: 表格侧改指、桶收敛、测试导入跟随** - `f246438` (refactor)

**Plan metadata:** (本 SUMMARY 提交) (docs)

_Note: 本计划为纯搬迁，无 TDD 循环。_

## Files Created/Modified

- `src/shared/schemaForm/schemaForm.css` - 迁（原 `table/table.css`）：`etable-*` 面板 / 行 / 折叠 / 工具栏样式，逐字节不变
- `src/shared/schemaForm/components/TableGrid.tsx` - 迁：四栏网格 + 工具栏 + 状态视图（`TablePanelStatus` / `ITableGridProps` 等类型随文件迁址）
- `src/shared/schemaForm/components/TableRow.tsx` - 迁：值单元格编辑 + 双击打开 + 控件分发
- `src/shared/schemaForm/components/GapRow.tsx` - 迁：可折叠分组行
- `src/shared/schemaForm/components/EditModeSegmented.tsx` - 迁：编辑 / 添加 / 删除三态切换
- `src/shared/schemaForm/components/TableToolbar.tsx` - 迁：标题 + 模式切换 + Schema / 代码编辑器 / 关闭 / 保存按钮
- `src/shared/schemaForm/components/SchemaBanner.tsx` - 迁：schema 模式提示条
- `src/shared/schemaForm/components/ActionButtons.tsx` - 迁：注释 / 编辑 / 复制行内动作
- `src/shared/schemaForm/components/inputs/{CheckboxInput,CheckboxSet,ColorInput,NumberInput,SelectInput,TextareaInput}.tsx` + `index.ts` - 迁：六个行内控件与桶（100% 不变）
- `src/shared/schemaForm/components/index.ts` - 新：7 个组件 + inputs 的 `export *` 桶
- `src/shared/schemaForm/index.ts` - 改：追加 `export * from './components'`
- `src/table/tablePanel.ts` - 改：`TableGrid` 相关 import 改指 `../shared/schemaForm/components/TableGrid`
- `src/table/components/index.ts` - 改：只保留三个表格专属组件导出
- `src/table/components/{TableEmptyColumn,TablePicker,TableCreateForm}.tsx` - 改：样式导入改指 `'../../shared/schemaForm/schemaForm.css'`
- `src/table/__tests__/edit.test.tsx` / `inputs.test.tsx` - 改：组件与行内控件 import 改指 shared
- `src/table/__tests__/interaction.uat.test.tsx` / `layout.uat.test.tsx` - 改：内联样式来源改为 `'../../shared/schemaForm/schemaForm.css?inline'`
- `src/table/table.css`、`src/table/components/inputs/`、`src/table/components/{TableGrid,TableRow,GapRow,EditModeSegmented,TableToolbar,SchemaBanner,ActionButtons}.tsx` - 删：旧位置（内容已迁至 shared）

## Decisions Made

- **三段提交：搬样式与控件 → 搬组件 → 表格侧改指。** 被搬内容本身逐字节不动，中间态的红只出现在「引用尚未改指」的地方，且集中在下一任务的授权范围内。
- **模型 import 收短一层。** 03-06 把模型搬到 shared 后，组件里写的是 `'../../shared/schemaForm/model/*'`；从 `shared/schemaForm/components/` 出发这条会解析到不存在的 `src/shared/shared/schemaForm/model`，故改为 `'../model/*'`——这正是计划 must_haves 里「`../types` / `../model/*` 位置不变」的落地形态。
- **表格桶不转发。** 代码风格禁止「一个文件导出不属于本文件夹的内容」，故 `table/components/index.ts` 直接删掉已搬走的 8 条导出，不给跨目录转发；表单渲染对外由 `./shared` 暴露。
- **uat 测试只换样式来源。** `interaction.uat` / `layout.uat` 用 `TABLE_CSS` 变量对样式表原文做正则断言；变量名与断言文本保持不变，只把 `?inline` 的来源换成共享路径，191 个用例一次通过。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 组件内指向 schema 模型的相对路径必须收短一层**
- **Found during:** Task 2（搬迁七个组件）
- **Issue:** 计划的 `<action>` 只点名了 `'../../react'` → `'../../../react'` 一类深度修正，但组件里还有三条 `'../../shared/schemaForm/model/*'`。搬到 `shared/schemaForm/components/` 后该路径解析为 `src/shared/shared/schemaForm/model/*`，文件不存在，typecheck 必红。
- **Fix:** 在 `TableGrid` / `TableRow` / `GapRow` 中把 `'../../shared/schemaForm/model/X'` 改为 `'../model/X'`——与计划 must_haves「搬迁后 `../types` / `../model/*` 位置不变」一致，符号名与用法未动。
- **Files modified:** `shared/schemaForm/components/{TableGrid,TableRow,GapRow}.tsx`
- **Verification:** 搬迁后 `pnpm --filter @motajs/editor-impl typecheck` 无一条错误落在 `shared/schemaForm` 内；整包 191 用例通过。
- **Committed in:** `7572d4f` (Task 2)

### Plan-doc inconsistency (not a code defect)

**2. [Rule 3 - Blocking / plan gate unsatisfiable] Task 2 的 `typecheck` 门禁无法单独为绿**
- **Found during:** Task 2
- **Issue:** Task 2 的 `<verify>` 要求 `pnpm --filter @motajs/editor-impl typecheck` 退出 0，但 Task 2 只搬组件、不改引用；此时 `table/components/index.ts`（仍逐条导出已搬走的 8 个模块）、`tablePanel.ts`（仍 import `./components/TableGrid`）、`edit.test.tsx` 与 `inputs.test.tsx`（仍 import `../components/*`）必然 TS2307 —— 而这些改指正是 Task 3 的授权动作。即 Task 2 的 typecheck 在「尊重 Task 3 文件归属」的前提下不可能单独满足。
- **Fix:** 保持文件归属与提交边界不变：Task 2 只按其结构断言提交，并实测确认 15 条 `TS2307` **全部**落在 Task 3 的待改文件内、无一条来自被搬组件；Task 3 改指后整包 test / typecheck 全绿。与 03-06 同性质的「计划自身设计的过渡红」。
- **Files modified:** 无（未超出计划授权范围）
- **Verification:** Task 2 结构断言通过；Task 3 的 `pnpm --filter @motajs/editor-impl test`（191/191）、`typecheck`（退出码 0）、`node scripts/verify/coreBoundaries.js`（退出码 0）全绿。
- **Committed in:** Task 2 `7572d4f`、Task 3 `f246438`

---

**Total deviations:** 1 auto-fixed import-path fix + 1 处计划文档内部矛盾（按计划文件归属处置并如实记录）
**Impact on plan:** 无行为影响。计划级 `<verification>` 三条命令全部通过、成功标准全部满足；唯一影响是 Task 2 这一中间提交不是独立 typecheck-green（与 03-06 一致的过渡态）。

## Issues Encountered

None - 除上述两点外，搬迁、改指、测试跟随均一次通过。

## User Setup Required

None - 纯代码搬迁与引用改指，无外部服务、环境变量或依赖安装。

## Known Stubs

None - 本计划只搬既有实现并新增桶 / 改指引用，不含桩或占位。

## Threat Flags

None - 未新增网络端点、鉴权路径或文件访问。T-03-19（`shared` 反向 import 能力目录）由 `coreBoundaries.js` 实测 0 违规兜底；T-03-20（丢 `data-test-id`）由结构断言 + 191 个以 test-id 查询的用例共同证明未发生；T-03-21（样式表搬迁）为计划内 accept 项，作用域仍是 `etable-*` 面板内类名，无新增披露面。

## Next Phase Readiness

- `shared/schemaForm` 现同时拥有模型（03-06）与渲染 + 样式（本计划），`asset` 可直接 import `../../shared/schemaForm/components/TableGrid` 渲染「每素材配置」表单而不触发 `asset → table`（D-28 / D-07 前提落地）。
- 表格只剩 `TablePicker` / `TableCreateForm` / `TableEmptyColumn` 三个专属组件，能力边界干净。
- 03-14（每素材配置表单）可直接复用 `ITableGridProps` / `TableGrid`；无阻塞。

---

## Self-Check: PASSED

- FOUND: packages/libs/editor-impl/src/shared/schemaForm/schemaForm.css
- FOUND: packages/libs/editor-impl/src/shared/schemaForm/components/TableGrid.tsx
- FOUND: packages/libs/editor-impl/src/shared/schemaForm/components/TableRow.tsx
- FOUND: packages/libs/editor-impl/src/shared/schemaForm/components/GapRow.tsx
- FOUND: packages/libs/editor-impl/src/shared/schemaForm/components/EditModeSegmented.tsx
- FOUND: packages/libs/editor-impl/src/shared/schemaForm/components/TableToolbar.tsx
- FOUND: packages/libs/editor-impl/src/shared/schemaForm/components/SchemaBanner.tsx
- FOUND: packages/libs/editor-impl/src/shared/schemaForm/components/ActionButtons.tsx
- FOUND: packages/libs/editor-impl/src/shared/schemaForm/components/index.ts
- FOUND: packages/libs/editor-impl/src/shared/schemaForm/components/inputs/index.ts
- ABSENT (expected): packages/libs/editor-impl/src/table/table.css
- ABSENT (expected): packages/libs/editor-impl/src/table/components/inputs/
- FOUND commit: c0c9d06 (Task 1)
- FOUND commit: 7572d4f (Task 2)
- FOUND commit: f246438 (Task 3)

*Phase: 03-asset*
*Completed: 2026-10-17*
