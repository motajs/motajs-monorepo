---
phase: 02-table
plan: 18
subsystem: ui
tags: [editor-impl, table, gap-row, gutter, x-order, insert-after, antd, uat-fix]

requires:
  - phase: 02-table
    provides: 表格引擎（schema 驱动行树、统一撤销、schema 专用呈现、多栏布局）与类型面 `ITableSchemaNode['x-order']`
provides:
  - 分组行左侧折叠指示 + 对象名 + 子行缩进（L2）
  - 左侧 ± 圆形 gutter 按钮取代原生 prompt / confirm（B4）
  - `insertAfterFieldPath` 与按锚点插入、`x-order` 同级排序（L3）
affects: [02-19]

actuals:
  tokens: 15514
  tasks: 3
  commits: 3
  plan_head_before: 9c48cf7eb63ae6b58e0bf9332e4fbe767cdd3775

tech-stack:
  added: []
  patterns:
    - "行内增删改由左侧常驻 gutter 驱动，不使用浏览器原生对话框"
    - "同级字段顺序优先按 schema 的 x-order，缺失时回退对象自然键序（向后兼容）"
    - "不可变「插到锚点键之后」写入助手（insertAfterFieldPath）"

key-files:
  created:
    - packages/libs/editor-impl/src/table/__tests__/interaction.uat.test.tsx
  modified:
    - packages/libs/editor-impl/src/table/components/GapRow.tsx
    - packages/libs/editor-impl/src/table/components/TableGrid.tsx
    - packages/libs/editor-impl/src/table/components/TableRow.tsx
    - packages/libs/editor-impl/src/table/model/traversal.ts
    - packages/libs/editor-impl/src/table/model/fieldPath.ts
    - packages/libs/editor-impl/src/table/tablePanel.ts
    - packages/libs/editor-impl/src/table/table.css
    - packages/libs/editor-impl/src/table/__tests__/edit.test.tsx
    - packages/libs/editor-impl/src/table/__tests__/tracer.test.tsx
    - packages/libs/editor-impl/src/table/__tests__/openParam.test.tsx
    - packages/libs/editor-impl/src/table/__tests__/behaviour.uat.test.tsx
    - packages/libs/editor-impl/src/table/__tests__/integration.test.tsx

key-decisions:
  - "B4 新字段名来源：点 + 后在插入点内联渲染 antd Input（Enter 确认、Escape / 失焦取消），确认前经 validateId 校验；不使用 window.prompt"
  - "L3 x-order：数据表新增时把新名称按完整同级顺序写进该层 schema 的 x-order（缺省时新建）；schema 视图写自身"
  - "删除不再用 window.confirm：`−` 直接在统一撤销路径上删除一行（可 Ctrl+Z 回退）"
  - "删除守卫由 TableRow 移到 TableGrid：schema 禁止 null 时 `−` 按钮禁用"

patterns-established:
  - "Gutter 增删：TableGrid.renderGutter 计算行 gutter 内容，经 gutter prop 注入 TableRow / GapRow"
  - "同级排序：buildRows 接受该层 x-order，orderKeys 合并 x-order 与自然顺序"
  - "锚点插入：insertAfterFieldPath 逐层浅拷贝并把新键插到锚点键之后"

requirements-completed: [TABLE-01]

coverage:
  - id: D1
    description: "分组行最左有可折叠指示与对象名，其子行渲染在带缩进的容器内（L2）"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/interaction.uat.test.tsx#分组行呈现（L2）"
        status: pass
    human_judgment: false
  - id: D2
    description: "添加模式行上出现 +、删除模式行上出现 −；增删不再触碰 window.prompt / window.confirm（B4）"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/interaction.uat.test.tsx#左侧 ± 圆形按钮（B4）"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/edit.test.tsx"
        status: pass
    human_judgment: false
  - id: D3
    description: "新增行插到锚点行之后、行树按 x-order 排序、撤销可还原位置（L3）"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/interaction.uat.test.tsx#新增位置与 x-order（L3）"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/undo.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "整体观感与旧表格对齐（分组范围一眼可读、± 圆形按钮观感、缩进幅度）"
    verification: []
    human_judgment: true
    rationale: "jsdom 不做布局计算，无法验证缩进幅度、圆形按钮尺寸与视觉分组边界；需人工目视确认。"

duration: ~30min
completed: 2026-10-13
status: complete
---

# Phase 02 Plan 18: 表格行交互与呈现修复（L2 / B4 / L3）Summary

**分组行加折叠指示与缩进；用左侧 ± 圆形按钮取代原生 prompt / confirm；新增行插在锚点行之后并同步写 x-order。**

## Performance

- **Duration:** ~30min
- **Started:** 2026-10-13T15:33:00Z
- **Completed:** 2026-10-13T16:02:00Z
- **Tasks:** 3 / 3
- **Files modified:** 13

## Accomplishments

- 分组行（object）最左改为可折叠指示 + 对象名，子行收进带 12px 缩进与细左边框的容器，分组范围一眼可读（L2）。
- 表格左侧预留 24px gutter：「添加」模式每行出现绿底圆形 `+`（点后在内联 antd 输入里填名字），「删除」模式每行出现红底圆形 `−`（直接删除，schema 禁止 null 时禁用）；`TableRow` 里删掉了原生 `prompt` / `confirm`（B4）。
- 同级字段排序改用 schema 的 `x-order`；新增行落在锚点行之后，并把完整同级顺序写进该层 schema 的 `x-order`；撤销 / 重做同时还原数据与 schema（L3）。

## Task Commits

Each task was committed atomically:

1. **Task 1: 分组行折叠指示、对象名与子行缩进（L2）** - `1eec2ad` (feat)
2. **Task 3: 新增行插到锚点行之后并尊重 x-order（L3）** - `8222acd` (feat)
3. **Task 2: 左侧 ± 圆形按钮取代原生对话框（B4）+ 测试** - `2b2207a` (feat)

**Plan metadata:** (docs commit below, recorded as `plan_head_before` = `9c48cf7`)

_Note: 三个任务的源文件互相重叠（`TableGrid.tsx` / `table.css` / `interaction.uat.test.tsx` 同属多个任务），按「数据层 / 分组呈现 / gutter 交互与测试」三个关注点拆成不重叠的原子提交。_

## Files Created/Modified

- `packages/libs/editor-impl/src/table/components/GapRow.tsx` - 折叠指示 + 对象名 + 子行缩进容器
- `packages/libs/editor-impl/src/table/components/TableGrid.tsx` - 常驻 gutter、`GutterButton`、`renderGutter` / `isGutterRow`、`TableGridAddHandler` 形状改为 `(anchorKey, name)`
- `packages/libs/editor-impl/src/table/components/TableRow.tsx` - 最左 gutter 占位；移除原生 prompt / confirm 双击路径
- `packages/libs/editor-impl/src/table/model/fieldPath.ts` - 新增 `insertAfterFieldPath`
- `packages/libs/editor-impl/src/table/model/traversal.ts` - `x-order` 同级排序（`readOrder` / `orderKeys`）
- `packages/libs/editor-impl/src/table/tablePanel.ts` - `addItem(anchorKey, name)`、x-order 同步、撤销载荷扩展（锚点 + schema 前后）
- `packages/libs/editor-impl/src/table/table.css` - gutter / 圆形按钮 / 分组缩进样式
- `packages/libs/editor-impl/src/table/__tests__/interaction.uat.test.tsx` - 新增（L2 / B4 / L3 共 7 个用例）
- `packages/libs/editor-impl/src/table/__tests__/{edit,tracer,openParam,behaviour.uat,integration}.test.tsx` - 同步到 gutter 交互与新的分组行呈现

## Decisions Made

- **B4 名称来源**（用户确认）：点 `+` 后在插入点内联渲染 antd `Input`，Enter 确认 / Escape 或失焦取消，确认前 `validateId` 校验；不使用原生 `prompt`。
- **L3 x-order**（用户确认）：ALWAYS 写——数据表新增时把新名称按完整同级顺序写入该层 schema 的 `x-order`（缺省时新建）；schema 视图写自身文档。
- 删除不弹确认：`−` 直接走统一撤销路径，可用 Ctrl+Z 回退。
- 删除守卫从 `TableRow` 移到 `TableGrid`：schema 禁止 null 时 `−` 禁用。
- gutter 增删按钮只落在「行」（叶子行与 schema 视图的 `properties` 属性行），schema 关键字行不显示。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 空路径读取导致根层新增失败**
- **Found during:** Task 3
- **Issue:** `get(obj, [])`（es-toolkit / lodash 语义）返回 `undefined`，根层新增时父对象读到 `undefined`、`wasAdded` 误判失败，数据不落盘（既有 `addItem('')` 也受影响）。
- **Fix:** 新增 `readAt`（空路径直接返回源对象）并用于 `addItem` 的父对象读取与 `wasAdded` 判定。
- **Files modified:** `packages/libs/editor-impl/src/table/tablePanel.ts`
- **Verification:** `interaction.uat.test.tsx` 的「新增行插到锚点行之后」用例通过。
- **Committed in:** `8222acd`

### Deviation from plan text (not an auto-fix, recorded for transparency)

**1. 既有测试同步更新（计划外文件）**
- **Found during:** Task 1 / Task 2 / Task 3
- **Issue:** 计划 `files_modified` 只列了 `interaction.uat.test.tsx`，但移除原生 prompt / confirm、改 `addItem` 签名、改分组行呈现，必然使 `edit.test.tsx` / `behaviour.uat.test.tsx` / `integration.test.tsx` / `tracer.test.tsx` / `openParam.test.tsx` / `undo.test.ts` 变红（计划 `<fails_when>` 亦预期到这点）。
- **Fix:** 把这些既有测试同步到 gutter 交互与新的分组行呈现（不改断言意图，只改交互方式）。
- **Files modified:** `edit.test.tsx` / `behaviour.uat.test.tsx` / `integration.test.tsx` / `tracer.test.tsx` / `openParam.test.tsx`
- **Verification:** `pnpm --filter @motajs/editor-impl test` 全绿（104 passed）。
- **Committed in:** `2b2207a`

**2. `integration.test.tsx` 的 schema 断言纳入 `x-order`**
- **Found during:** Task 3
- **Issue:** 用户确认「数据表新增 ALWAYS 写 schema 的 x-order」后，端到端流程里的 schema 文档会多出 `'x-order': ['name','extra','note']`。
- **Fix:** 该断言同步加入 `x-order`；`undo.test.ts` 的 `addItem('', 'extra')` 因锚点为空自动追加到末尾，无需改动即保持绿。
- **Verification:** `integration.test.ts` 通过。

**3. 局部函数重命名避开反例扫描误报**
- **Found during:** Task 2 反例扫描
- **Issue:** 计划的反例正则 `\bconfirm\(` 会命中 gutter 内部名为 `confirm` 的局部函数（非 `window.confirm` 误报）。
- **Fix:** 将该局部函数改名 `commitName`，使扫描「无命中」。
- **Committed in:** `2b2207a`

---

**Total deviations:** 1 auto-fixed (Rule 1)，另有 3 条合成说明（既有测试同步、断言扩展、命名微调）。
**Impact on plan:** 无范围蔓延；功能面严格按计划与用户确认实现。

## Issues Encountered

- 无阻塞性问题。所有既有 96 个用例中受交互变化影响的 9 个已同步，最终 104 个用例全绿。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 行呈现与增删交互已与旧表格整体对齐；`interaction.uat.test.tsx` 覆盖 L2 / B4 / L3 三条主线，可供人工 UAT 复核观感（缩进幅度、按钮尺寸）。
- **待人工确认（非功能）**：已在本次执行前确认——`insertAfterFieldPath` / `TableGridAddHandler(anchorKey, name)` / `TablePanel.addItem(anchorKey, name)` 命名定案，以及「新增名称来源 = 插入点 antd 输入」。
- 下一个计划 02-19（全局撤销 / 重做快捷键）可在此基础上进行。

---

*Phase: 02-table*
*Completed: 2026-10-13*

## Self-Check: PASSED

- 13 个源 / 测试文件全部存在。
- 3 个任务提交 `1eec2ad` / `8222acd` / `2b2207a` 均在历史中。
- `pnpm --filter @motajs/editor-impl test`：104 passed（14 文件）；`typecheck` 退出 0。
- `pnpm --filter @motajs/editor-core test`：64 passed。
- 四个门禁脚本 `coreImportType` / `coreEngineNeutral` / `coreModuleState` / `coreFsSurface` 均退出 0。
- 反例扫描 `window.(prompt|confirm)` / `prompt(` / `confirm(`：无命中。
- Prettier：改动文件全部符合格式。
