---
phase: 04-map
plan: 01
subsystem: map
tags: [editor-impl, map, types, interfaces, constants]

# Dependency graph
requires:
  - phase: 03-asset
    provides: shared/schemaForm 的中立类型（ITableSchemaNode / ITableRowNode）
provides:
  - 地图域的全部纯声明（中立文档 / 图块目录 / 宿主注入面 / 面板状态 / 撤销载荷 / 渲染模型）
  - 13 个 MAP_* 裸常量与 @motajs/editor-impl/map 子路径入口
affects: [04-02, 04-03, 04-04, 04-05, 04-06, 04-07, 04-08, 04-09, 04-10, 04-11, 04-12, 04-13, 04-14, 04-15, 04-16]

actuals:
  tokens: 4185
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - 能力域类型集中在一个 types.ts，常量集中在一个 constants.ts，桶文件只 export *
    - 接口成员默认 readonly，每个成员一行 JSDoc；枚举成员大驼峰并逐个写 JSDoc

key-files:
  created:
    - packages/libs/editor-impl/src/map/types.ts
    - packages/libs/editor-impl/src/map/constants.ts
    - packages/libs/editor-impl/src/map/index.ts
  modified:
    - .planning/phases/04-map/INTERFACE-NAME.md

key-decisions:
  - "中立文档自足：宽高 + 图层（含 zIndex）+ 宿主算好的图块目录，面板不认识文件格式与路径"
  - "IMapTilePass 固定为 out / in / onlyEventLayer；IMapRenderCell 的 imagePath / crop 为可选"
  - "IMapPanelViewState 一次声明 propertiesOpen / passMarks / aboveLayerOpacity 等字段，后续计划不再改 types.ts"
  - "通行性只读，类型层不出现任何通行性编辑入口"
  - "命名与 12 项开放问题口径经用户逐条确认后才落地"

requirements-completed: [MAP-01]

coverage:
  - id: D1
    description: "命名与接口报告（16 个计划节 + 12 项开放问题决议 + 范围修订记录 + 待确认清单）"
    requirement: MAP-01
    verification:
      - kind: other
        ref: "node -e 结构检查：16 节 / 名称表 / OQ1…OQ12 / 关键名字全部存在"
        status: pass
    human_judgment: false
  - id: D2
    description: "地图域类型与常量声明，整包可编译且通过两条结构门禁"
    requirement: MAP-01
    verification:
      - kind: other
        ref: "pnpm --filter @motajs/editor-impl typecheck (exit 0)"
        status: pass
      - kind: other
        ref: "node scripts/verify/coreEngineNeutral.js (exit 0)"
        status: pass
      - kind: other
        ref: "node scripts/verify/coreModuleState.js (exit 0)"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-10-21
status: complete
---

# Phase 4 Plan 01: 地图域命名报告与纯声明 Summary

**地图能力的数据形状、宿主注入面、面板状态与渲染模型全部落成纯声明，整包可编译、两条结构门禁全绿。**

## Performance

- **Duration:** 约 15 分钟
- **Completed:** 2026-10-21
- **Tasks:** 3/3
- **Files modified:** 4（3 个新建 + 1 个报告增补）

## Accomplishments

- 命名与接口报告落盘并通过用户逐条确认：16 个计划节、12 项开放问题口径、范围修订记录、待确认清单。
- 新建 `src/map/types.ts`：31 个接口 + 8 个 `const enum`，覆盖中立文档、图块目录、宿主能力、面板视图状态、两种撤销载荷与渲染模型。
- 新建 `src/map/constants.ts`：13 个裸常量（格子边长、默认尺寸、最近使用路径 / 字段 / 上限、大地图阈值、图层不透明度、文案、面板类型 id）。
- 新建 `src/map/index.ts`：只导出 `./types` 与 `./constants`，`@motajs/editor-impl/map` 子路径即可解析。
- 整包 typecheck、`coreEngineNeutral`、`coreModuleState` 三条验证全部通过。

## Task Commits

1. **Task 1: 写出本阶段的命名与接口报告** - `b710337` (docs)
2. **Task 2: 用户确认命名与 12 项开放问题口径** - checkpoint，无提交（用户回复「确认」）
3. **Task 3: 落地地图域类型与常量（纯声明）** - `e190590` (feat)

**Plan metadata:** 本次 SUMMARY 提交（docs）

## Files Created/Modified

- `packages/libs/editor-impl/src/map/types.ts` - 地图域全部类型与枚举声明，无任何逻辑
- `packages/libs/editor-impl/src/map/constants.ts` - 13 个裸 `MAP_*` 常量
- `packages/libs/editor-impl/src/map/index.ts` - `./map` 子路径桶文件
- `.planning/phases/04-map/INTERFACE-NAME.md` - 命名与接口报告（补 `map-recent-clear-dialog` 测试标识）

## Decisions Made

- 中立文档自足（D-02）：图块目录随文档到达，面板不需要第二条数据通道。
- 图层新增 `zIndex`：绘制顺序由宿主给定，低于当前层正常绘制、高于当前层统一调不透明度（OQ5）。
- 事件接口本阶段不声明（OQ7）：`saveMapData` 的宿主实现负责保留事件与额外字段。
- 通行性只读（D-13 / D-23）：类型层没有任何通行性编辑字段或入口。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] 报告缺少一个已确认的测试标识**
- **Found during:** Task 1（写出命名与接口报告）
- **Issue:** 计划要求覆盖 UI 测试标识 `map-recent-clear-dialog`，报告已有 `MapRecentClearDialog` 组件但没有登记这个 `data-test-id`。
- **Fix:** 在 Plan 04-11 的调色板测试标识行补上该标识。
- **Files modified:** `.planning/phases/04-map/INTERFACE-NAME.md`
- **Verification:** 结构检查脚本通过；关键字扫描包含 `map-recent-clear-dialog`。
- **Committed in:** `b710337`

---

**Total deviations:** 1 auto-fixed（1 missing critical）
**Impact on plan:** 仅补齐报告覆盖项，无范围扩大。

## Issues Encountered

- 报告正文在规划阶段已经存在并提交；本次按验收标准逐条核对后只补了一处缺失标识，没有重写正文。
- 并行执行的 Phase 3 计划在本计划两次提交之间落入了自己的提交；本计划只暂存并提交自己的文件，未触碰其它计划的改动。

## Verification Evidence

- `pnpm --filter @motajs/editor-impl typecheck` → exit 0，无 `error TS`。
- `node scripts/verify/coreEngineNeutral.js` → exit 0（扫描 116 个生产文件，0 条引擎标识违规）。
- `node scripts/verify/coreModuleState.js` → exit 0（186 个文件，受限规则 error 级 0 条）。
- `git status --porcelain -- <三个 map 文件>` 在创建前为空。

## Next Phase Readiness

- `@motajs/editor-impl/map` 已可解析类型与常量，04-02 可在此基础上声明跨包可选成员。
- 未修改 `.planning/ROADMAP.md` 或 `.planning/REQUIREMENTS.md`（按计划要求）。

## Self-Check: PASSED

- 三个源码文件均存在：`types.ts` / `constants.ts` / `index.ts`。
- 两个任务提交均存在：`b710337`、`e190590`。
- 本计划未改动 `packages/libs/editor-impl/src/asset/**` 或 Phase 3 的规划文件。
