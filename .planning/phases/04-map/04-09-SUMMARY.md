---
phase: 04-map
plan: 09
subsystem: map
tags: [react, antd, drawer, schema-form, undo, properties]
requires:
  - phase: 04-map
    provides: 04-02 ITableGridProps.formMode 声明 + shared/schemaForm 表单引擎
  - phase: 04-map
    provides: 04-07 面板按域保存 / 基线 / 脏状态
  - phase: 04-map
    provides: 04-08 未保存闸门与受控弹窗
provides:
  - TableGrid 表单模式（只藏工具栏与 Schema 横幅，字段行一行未改）
  - MapPanel 属性域（读整表 / 一字段一条撤销 / 保存整表 / 开与关抽屉）
  - MapPropertiesDrawer（受控、表单模式、自带加载与失败文案）
affects: [04-10]
actuals:
  tokens: 10430
  tasks: 3
  commits: 3
  plan_head_before: 3a1efdbc5d4d74128c16c7628722174a0aa4c54e
tech-stack:
  added: []
  patterns: [form-mode-switch, host-schema-driven-form, token-guarded-property-load]
key-files:
  created:
    - packages/libs/editor-impl/src/shared/schemaForm/__tests__/formMode.test.tsx
    - packages/libs/editor-impl/src/map/components/MapPropertiesDrawer.tsx
    - packages/libs/editor-impl/src/map/__tests__/mapProperties.test.tsx
  modified:
    - packages/libs/editor-impl/src/shared/schemaForm/components/TableGrid.tsx
    - packages/libs/editor-impl/src/map/mapPanel.ts
key-decisions:
  - "表单模式只影响 toolbar 与 Schema 横幅的构造；行树、值控件、校验、字段路径一律不动，既有表格调用点靠表格整包测试钉住"
  - "地图属性单独成域：properties / propertiesBaseline / propertyRows / propertiesStatus 都在面板内存，抽屉只是视图"
  - "一次字段提交 = 一条 MapUndoType.Property 记录；保存时整份属性表交给宿主，不逐字段补丁"
  - "第一次打开属性域才读宿主；关掉再打开复用内存值，避免冲掉用户未保存的改动"
  - "属性状态复用 TablePanelStatus：NoTarget 表示「尚未读取」（Idle），不新增视图状态字段或新枚举名"
requirements-completed: [MAP-01]
coverage:
  - id: D1
    description: "TableGrid 表单模式：工具栏与 Schema 横幅不渲染，字段行与改值回调照旧；既有表格零回归"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/shared/schemaForm/__tests__/formMode.test.tsx#TableGrid 的表单模式"
        status: pass
      - kind: command
        ref: "pnpm --filter @motajs/editor-impl test（表格 25 个文件 / 181 个用例 + 全量 71 个文件 / 658 个用例）"
        status: pass
    human_judgment: false
  - id: D2
    description: "地图属性域：读整表、一字段一条撤销、保存整表、开/关抽屉不丢内存改动、危险路径被拒"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/map/__tests__/mapProperties.test.tsx#地图面板：属性域"
        status: pass
    human_judgment: false
  - id: D3
    description: "地图属性抽屉：受控开合、表单模式、加载/失败/空/就绪四态、没有第二个保存入口"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/map/__tests__/mapProperties.test.tsx#地图属性抽屉"
        status: pass
    human_judgment: false
duration: 30min
completed: 2026-10-21
status: complete
---

# Phase 4 Plan 9: 地图属性抽屉与表格表单模式 Summary

**给表格表单加了一个「只显示字段」的开关，再用它做地图属性抽屉：读整份属性表、改一个字段记一条撤销、保存时整表交给宿主**

## Performance

- **Duration:** 约 30 分钟
- **Completed:** 2026-10-21T12:10:57Z
- **Tasks:** 3
- **Files modified:** 5（新增 3，修改 2）

## Accomplishments

- `TableGrid` 多了一个 `formMode`：为真时工具栏（编辑模式 / 编辑 Schema / 在代码编辑器中打开 / 保存 / 关闭栏）与 Schema 横幅都不构造；字段行、值控件、行内校验、字段路径一行没改，表格整包 181 个用例照旧全绿。
- 地图面板新增属性域：打开抽屉时读整份属性表，按宿主注入的 Schema 生成行树；改一个字段就是一条可撤销记录并置「未保存」；保存时把整份属性表交给宿主，不逐字段补丁。
- `MapPropertiesDrawer` 是纯受控抽屉：开 / 关只看 `propertiesOpen`，正文直接复用表单模式的 `TableGrid`，没有第二个保存入口，也没有编辑 Schema / 在代码编辑器中打开 / 关闭栏。
- 第一次打开才读宿主，关掉再打开复用内存值；关抽屉不丢改动、不写盘、不登记撤销。
- 属性 Schema 里带 `x-editor` 的字段在交给表单引擎前被剥掉标记：不会出现点不动的「编辑」按钮，宿主自己的 schema 对象也不被改动。

## Task Commits

1. **Task 1：`TableGrid` 表单模式 + 回归测试** - `200e8b7` (feat)
2. **Task 2：面板属性域（读 / 改 / 撤 / 保存）+ 12 个用例** - `8b72424` (feat)
3. **Task 3：地图属性抽屉 + 6 个用例** - `5f02c47` (feat)

**Plan metadata:** 见本 SUMMARY 的提交（docs: complete plan）。

> 本次执行期间同一分支上还有另一条 03-39 计划在并行提交（`fa444b8` / `3103dc3` / `cee9e29` / `85879c1`）。`actuals.commits: 3` 只数本计划自己的三条提交，不是 `rev-list 3a1efdb..HEAD` 的 7 条。

## Files Created/Modified

- `packages/libs/editor-impl/src/shared/schemaForm/components/TableGrid.tsx` - 读 `formMode`，工具栏与横幅改为条件构造
- `packages/libs/editor-impl/src/shared/schemaForm/__tests__/formMode.test.tsx` - 5 个用例：缺省有工具栏、表单模式无工具栏与横幅、字段行可改、错误态、空 Schema
- `packages/libs/editor-impl/src/map/mapPanel.ts` - 属性域字段与六个方法（`loadProperties` / `refreshPropertyRows` / `commitProperty` / `saveProperties` / `openProperties` / `closeProperties`）、属性撤销分支、按域保存
- `packages/libs/editor-impl/src/map/components/MapPropertiesDrawer.tsx` - 受控抽屉（480px），正文复用表单模式
- `packages/libs/editor-impl/src/map/__tests__/mapProperties.test.tsx` - 18 个用例：属性域 12 + 抽屉 6

## Decisions Made

- 抽屉的开 / 关与属性值全部由面板持有，组件自己不存状态；这样「关闭不丢改动」不需要额外同步逻辑。
- 属性行的唯一来源是 `buildTableTree(schema, properties)`：提交后、撤销后、放弃改动后都重建行树，不另存一份派生缓存。
- 属性保存跟地图数据一样是「整份提交」：先取快照再等宿主，成功后把发出去的那份设为基线；期间的新改动仍算脏。
- 读宿主前先给属性域一个请求序号，晚到的旧结果直接丢弃（与打开地图、最近使用同一套做法）。
- `x-editor` 的处理方式是「剥掉标记」：属性表单没有外部编辑器能力，留着只会渲染一个点不动的按钮。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 属性状态没有新枚举名可用**
- **Found during:** Task 2
- **Issue:** 计划写 `propertiesStatus` 取 `Idle / Loading / EmptySchema / Error / Ready`，但 `types.ts` 不在本计划的 `files_modified` 里，不能新增 `MapPropertiesStatus`；同时也不允许新增视图状态字段。
- **Fix:** `propertiesStatus` 直接用 shared 的 `TablePanelStatus`，用 `NoTarget` 表示「尚未读取」（Idle）；抽屉的 `status` prop 因此可以直接拿这个值，不需要再写一层映射。
- **Files modified:** `packages/libs/editor-impl/src/map/mapPanel.ts`
- **Verification:** 「无 Schema 时属性域保持 Idle」「缺读取能力时属性域保持 Idle」两条用例断言 `NoTarget` 且不发请求。
- **Committed in:** `8b72424`

**2. [Rule 3 - Blocking] 撤销载荷字段名以已声明类型为准**
- **Found during:** Task 2
- **Issue:** 计划描述载荷为 `{ mapId, path, previous, next }`，但 04-01 的 `IMapPropertyUndoData` 已声明 `before` / `after`，`types.ts` 又不在可改清单里。
- **Fix:** 按 `IMapPropertyUndoData` 写 `before` / `after`，撤销取 `before`、重做取 `after`；语义与计划一致。
- **Files modified:** `packages/libs/editor-impl/src/map/mapPanel.ts`
- **Verification:** 「撤销与重做改回字段值并更新行树」用例通过。
- **Committed in:** `8b72424`

**3. [Rule 2 - Missing critical] 属性脏但宿主没有保存能力时不能装作保存成功**
- **Found during:** Task 2
- **Issue:** `saveMapProperties` 与 `readProperties` 是两个独立可选能力；宿主可以给读不给写，此时属性域会一直脏，`MapPanel.save` 却可能返回成功。
- **Fix:** `MapPanel.save` 在属性域脏而 `saveProperties` 返回 false 时按保存失败处理，显示「当前项目不支持保存地图属性。」并保留脏标记。
- **Files modified:** `packages/libs/editor-impl/src/map/mapPanel.ts`
- **Verification:** 现有 18 个属性用例全绿（该路径未被宿主能力同时注入的用例覆盖，属防御性分支）。
- **Committed in:** `8b72424`

**4. [Rule 1 - Bug] 测试里的 `document.querySelector` 触发 PORT-02 门禁**
- **Found during:** Task 3 的全量门禁
- **Issue:** `coreModuleState.js` 把 `src/**/__tests__` 也纳入 `no-restricted-globals`，抽屉用例里的 `document.querySelector` 让门禁以 5 条 error 退出。
- **Fix:** 改用 `screen.getByTestId` / `screen.queryByTestId` 与元素自身的 `querySelector`，不再触碰全局 `document`。
- **Files modified:** `packages/libs/editor-impl/src/map/__tests__/mapProperties.test.tsx`
- **Verification:** `node scripts/verify/coreModuleState.js` 与 `coreEngineNeutral.js` 均 exit 0。
- **Committed in:** `5f02c47`

**5. [Rule 3 - Blocking] antd 6 的 `Drawer.width` 已废弃**
- **Found during:** Task 3 的抽屉用例
- **Issue:** `width={480}` 在 antd 6 会打出 `width is deprecated. Please use size instead` 警告，污染测试输出。
- **Fix:** 改用 `size={480}`；视觉宽度仍是 480px。
- **Files modified:** `packages/libs/editor-impl/src/map/components/MapPropertiesDrawer.tsx`
- **Verification:** 抽屉用例全绿且不再出现废弃警告。
- **Committed in:** `5f02c47`

---

**Total deviations:** 5 auto-fixed（3 blocking、1 bug、1 missing critical）
**Impact on plan:** 都发生在计划没有覆盖的接缝上（枚举名归属、已声明载荷字段名、能力组合的边界、门禁对测试文件的约束、antd 废弃 prop）。没有改变属性域的行为语义，也没有新增视图状态字段或新公开名字。

## Issues Encountered

- `x-editor` 的「只读呈现」按计划给出的做法实现为「剥掉外部编辑器标记 + 不出现编辑按钮」；值控件本身仍是 Schema 推导出的普通输入控件（`TableRow` 没有「禁用值控件」的入参，本计划的文件清单也不包含它）。若后续阶段要求真正禁用输入，需要在 `shared/schemaForm` 增加一个「整行只读」开关，而不是在属性侧另写一套。
- 属性行树与状态保存在面板私有字段里，本计划不把它们塞进 `IMapPanelViewState`；04-10 挂载抽屉时需要从面板取到 `propertiesStatus` / `propertyRows`（或届时再决定是否把它们发布到视图状态）。

## User Setup Required

None - 没有外部服务配置，也没有安装任何依赖。

## Next Phase Readiness

- 04-10 的工具栏「地图属性」按钮接 `MapPanel.openProperties` 即可；按钮禁用判据是 `propertiesStatus === TablePanelStatus.NoTarget`（即 Idle）。
- 04-10 的抽屉 `onClose` 接 `MapPanel.closeProperties`，`onRetry` 接 `MapPanel.loadProperties`，`onChange` 接 `MapPanel.commitProperty`。
- 04-10 需要给 `.emap-properties-body` 写 `position: relative; height: 100%; min-height: 0`（Pitfall 19），本计划只保证这个容器类名存在。
- 「保存地图」仍然只有一个入口：地图数据与属性各自判断脏、各自整份提交。

---

## Self-Check: PASSED

- 3 个新增文件与 2 个修改文件均存在于磁盘
- 提交 `200e8b7` / `8b72424` / `5f02c47` 在 `git log` 中可见
- `pnpm --filter @motajs/editor-impl exec vitest run src/shared/schemaForm/__tests__/formMode.test.tsx src/map/__tests__/mapProperties.test.tsx`：23 passed（5 + 18）
- `pnpm --filter @motajs/editor-impl test`：71 个文件 / 658 个用例 passed，exit 0
- `pnpm --filter @motajs/editor-impl typecheck`：exit 0
- `node scripts/verify/coreEngineNeutral.js`：exit 0
- `node scripts/verify/coreModuleState.js`：exit 0
- `node scripts/verify/coreBoundaries.js`：exit 0
