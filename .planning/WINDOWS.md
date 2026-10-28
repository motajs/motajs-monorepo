---
schema_version: 1
open_count: 16
waived_count: 0
fixed_count: 4
total_count: 20
last_updated: 2026-10-28T16:20:31.238Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 01 | deviation | packages/apps/editor/package.json |  | test:e2e pinned to --project=editor so a normal e2e run cannot rewrite committed baseline PNGs | open |  | 2026-09-20T10:46:53.061Z |  |
| 2 | 02 | stub | packages/libs/editor-core/lib/react/CoreProbe.tsx | 12 | CoreProbe is temporary Phase 2 scaffolding (D-03): it must be replaced or deleted by the real React layer from Phase 4 onward and must never become permanent public API | open |  | 2026-09-22T03:19:57.843Z |  |
| 3 | 02 | stub | .dependencyCruiser.cjs | 54 | core-singletons-only-imported-by-composition-root is deliberately vacuous in Phase 2 (D-17): core has no module-level singletons yet, so the rule passes on an empty set and only starts biting once Phase 3 adds lib/kernel/core.ts and the six singletons | open |  | 2026-09-22T04:21:53.283Z |  |
| 4 | 04 | unrun-verify | .planning/phases/04-resource-edit-layers-moved/04-04-PLAN.md |  | Manual parity check (04-VALIDATION.md Manual-Only) not run by the executor: dev-server workbench/floor/undo/persistence parity against .planning/baseline/screenshots/ | fixed |  | 2026-09-24T08:17:49.851Z | 2026-09-24T10:15:17.118Z |
| 5 | 05.1 | deviation | packages/apps/editor/src/project/commands/animationCommands.ts | 8 | pnpm lint 仍有 1 条 prettier 报错（该文件属 @motajs/editor，plan 05.1-07 禁止触碰） | open |  | 2026-09-29T07:36:58.846Z |  |
| 6 | 05.2 | deviation | packages/libs/editor-core/lib/__tests__/coreApiSurface.test.ts | 163 | const enum 化后 ts 不允许把 PreloadStrategy 当值用(TS2475)，断言改为逐一断言成员取值 | fixed |  | 2026-10-01T09:15:53.165Z | 2026-10-01T09:17:47.768Z |
| 7 | 05.2 | deviation | packages/libs/editor-impl/lib/__tests__/implApiSurface.test.ts | 132 | ActionType const enum -> TS2475; typeof assertion replaced with member value assertions | open |  | 2026-10-01T09:58:18.041Z |  |
| 8 | 05.2 | deviation | eslint.config.js | 75 | //#region required spaced-comment marker whitelist (#region/#endregion); severity unchanged | open |  | 2026-10-01T11:26:23.330Z |  |
| 9 | 05.2 | deviation | packages/libs/editor-impl/lib/__tests__/implApiSurface.test.ts | 112 | ContentUtils de-classed: typeof assertion changed from function to object (stale expectation, outside plan files) | open |  | 2026-10-01T12:51:09.375Z |  |
| 10 | 05.2 | deviation | packages/libs/editor-impl/lib/resources/fileHandler.ts | 143 | contentSignal rename pushed load() catch ternary past printWidth; prettier wrapped it | open |  | 2026-10-01T12:51:11.429Z |  |
| 11 | 05.2 | deviation | packages/libs/react-monaco-editor/lib/modelScope.test.ts |  | pnpm test full recursive run intermittently exits 1: monaco worker-close races a pending module fetch (Unhandled Rejection 'Closing rpc while fetch was pending'); 6/6 tests pass, passes isolated; package untouched by 05.2 | open |  | 2026-10-01T15:10:15.467Z |  |
| 12 | 05.2 | deviation | packages/apps/editor/src/Workbench/CodeEditor/__tests__/ternDeclaration.test.ts | 37 | pnpm test full recursive run intermittently times out this test at 5000ms (measured 6569ms) under memory pressure; 785/785 pass isolated; editor untouched by 05.2 | open |  | 2026-10-01T15:10:16.989Z |  |
| 13 | 01.1-dev-host | unrun-verify |  |  | Manual dev-host acceptance not run by executor (needs a browser): start pnpm --filter @motajs/editor-dev dev at http://127.0.0.1:1056, verify + follows the last tab and closing a non-active of three tabs keeps the active one | open |  | 2026-10-12T08:00:04.110Z |  |
| 14 | 02.1 | deviation | packages/libs/editor-core/vitest.config.ts |  | editor-core vitest 未处理 CSS 致 ?inline 返回空串，样式断言无法成立（Plan 23 已修复） | fixed |  | 2026-10-16T16:43:44.904Z | 2026-10-16T16:44:51.427Z |
| 15 | 02.1 | deviation | packages/libs/editor-impl/src/table/__tests__/integration.test.tsx |  | 重量级端到端用例超 5s 默认超时（满套件并行争用，HEAD 亦同），Plan 23 放宽到 20s | fixed |  | 2026-10-16T16:43:45.730Z | 2026-10-16T16:44:52.288Z |
| 16 | 04.1 | deviation | packages/libs/editor-impl/src/map/__tests__/model.cellMetrics.test.ts |  | Task 2 的 RED 未在实现前观察到：实现已由 tracer Task 1 落地；已用一次性变异验证代替 RED 证据 | open |  | 2026-10-23T13:55:27.758Z |  |
| 17 | 04.1 | deviation | packages/libs/editor-impl/src/map/__tests__/model.tileFrame.test.ts |  | 两个 TDD 任务的 RED 均为导入解析失败（模块尚不存在，属 INVALID_RED）；已用一次性变异证明测试能盯住行为 | open |  | 2026-10-23T14:17:46.935Z |  |
| 18 | 04.1 | deviation | packages/libs/editor-impl/src/map/model/tileFrame.ts | 196 | resolveFrameRect 增加可选第三参数 frameColumns（Scan 帧轴折行所需）；IMapFrameInfo 未新增成员（P-01） | open |  | 2026-10-23T14:17:56.083Z |  |
| 19 | 04.1 | fixme | packages/apps/editor-dev/src/__tests__/devHostMap.test.tsx | 480 | Plan 36 默认打开帧数角标后，map-tile- 前缀选择器命中 map-tile-frames-N，devHostMap 端到端用例断言 NaN 失败；留待 04.1-31 收口修选择器 | open |  | 2026-10-26T12:48:36.009Z |  |
| 20 | 04.2 | deviation | packages/libs/editor-impl/src/table/tablePanel.ts |  | ExternalChangeDialog 按执行器要求挂在 TablePanelView 根上（单一面板级 conflictStore），而 PLAN 任务文本写的是 TableColumn 逐栏挂载 | open |  | 2026-10-28T16:20:31.238Z |  |

````json
[
  {
    "id": 1,
    "kind": "deviation",
    "phase": "01",
    "file": "packages/apps/editor/package.json",
    "line": null,
    "description": "test:e2e pinned to --project=editor so a normal e2e run cannot rewrite committed baseline PNGs",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-20T10:46:53.061Z",
    "resolved_at": null
  },
  {
    "id": 2,
    "kind": "stub",
    "phase": "02",
    "file": "packages/libs/editor-core/lib/react/CoreProbe.tsx",
    "line": 12,
    "description": "CoreProbe is temporary Phase 2 scaffolding (D-03): it must be replaced or deleted by the real React layer from Phase 4 onward and must never become permanent public API",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-22T03:19:57.843Z",
    "resolved_at": null
  },
  {
    "id": 3,
    "kind": "stub",
    "phase": "02",
    "file": ".dependencyCruiser.cjs",
    "line": 54,
    "description": "core-singletons-only-imported-by-composition-root is deliberately vacuous in Phase 2 (D-17): core has no module-level singletons yet, so the rule passes on an empty set and only starts biting once Phase 3 adds lib/kernel/core.ts and the six singletons",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-22T04:21:53.283Z",
    "resolved_at": null
  },
  {
    "id": 4,
    "kind": "unrun-verify",
    "phase": "04",
    "file": ".planning/phases/04-resource-edit-layers-moved/04-04-PLAN.md",
    "line": null,
    "description": "Manual parity check (04-VALIDATION.md Manual-Only) not run by the executor: dev-server workbench/floor/undo/persistence parity against .planning/baseline/screenshots/",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-24T08:17:49.851Z",
    "resolved_at": "2026-09-24T10:15:17.118Z"
  },
  {
    "id": 5,
    "kind": "deviation",
    "phase": "05.1",
    "file": "packages/apps/editor/src/project/commands/animationCommands.ts",
    "line": 8,
    "description": "pnpm lint 仍有 1 条 prettier 报错（该文件属 @motajs/editor，plan 05.1-07 禁止触碰）",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-29T07:36:58.846Z",
    "resolved_at": null
  },
  {
    "id": 6,
    "kind": "deviation",
    "phase": "05.2",
    "file": "packages/libs/editor-core/lib/__tests__/coreApiSurface.test.ts",
    "line": 163,
    "description": "const enum 化后 ts 不允许把 PreloadStrategy 当值用(TS2475)，断言改为逐一断言成员取值",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-10-01T09:15:53.165Z",
    "resolved_at": "2026-10-01T09:17:47.768Z"
  },
  {
    "id": 7,
    "kind": "deviation",
    "phase": "05.2",
    "file": "packages/libs/editor-impl/lib/__tests__/implApiSurface.test.ts",
    "line": 132,
    "description": "ActionType const enum -> TS2475; typeof assertion replaced with member value assertions",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-01T09:58:18.041Z",
    "resolved_at": null
  },
  {
    "id": 8,
    "kind": "deviation",
    "phase": "05.2",
    "file": "eslint.config.js",
    "line": 75,
    "description": "//#region required spaced-comment marker whitelist (#region/#endregion); severity unchanged",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-01T11:26:23.330Z",
    "resolved_at": null
  },
  {
    "id": 9,
    "kind": "deviation",
    "phase": "05.2",
    "file": "packages/libs/editor-impl/lib/__tests__/implApiSurface.test.ts",
    "line": 112,
    "description": "ContentUtils de-classed: typeof assertion changed from function to object (stale expectation, outside plan files)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-01T12:51:09.375Z",
    "resolved_at": null
  },
  {
    "id": 10,
    "kind": "deviation",
    "phase": "05.2",
    "file": "packages/libs/editor-impl/lib/resources/fileHandler.ts",
    "line": 143,
    "description": "contentSignal rename pushed load() catch ternary past printWidth; prettier wrapped it",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-01T12:51:11.429Z",
    "resolved_at": null
  },
  {
    "id": 11,
    "kind": "deviation",
    "phase": "05.2",
    "file": "packages/libs/react-monaco-editor/lib/modelScope.test.ts",
    "line": null,
    "description": "pnpm test full recursive run intermittently exits 1: monaco worker-close races a pending module fetch (Unhandled Rejection 'Closing rpc while fetch was pending'); 6/6 tests pass, passes isolated; package untouched by 05.2",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-01T15:10:15.467Z",
    "resolved_at": null
  },
  {
    "id": 12,
    "kind": "deviation",
    "phase": "05.2",
    "file": "packages/apps/editor/src/Workbench/CodeEditor/__tests__/ternDeclaration.test.ts",
    "line": 37,
    "description": "pnpm test full recursive run intermittently times out this test at 5000ms (measured 6569ms) under memory pressure; 785/785 pass isolated; editor untouched by 05.2",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-01T15:10:16.989Z",
    "resolved_at": null
  },
  {
    "id": 13,
    "kind": "unrun-verify",
    "phase": "01.1-dev-host",
    "file": "",
    "line": null,
    "description": "Manual dev-host acceptance not run by executor (needs a browser): start pnpm --filter @motajs/editor-dev dev at http://127.0.0.1:1056, verify + follows the last tab and closing a non-active of three tabs keeps the active one",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-12T08:00:04.110Z",
    "resolved_at": null
  },
  {
    "id": 14,
    "kind": "deviation",
    "phase": "02.1",
    "file": "packages/libs/editor-core/vitest.config.ts",
    "line": null,
    "description": "editor-core vitest 未处理 CSS 致 ?inline 返回空串，样式断言无法成立（Plan 23 已修复）",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-10-16T16:43:44.904Z",
    "resolved_at": "2026-10-16T16:44:51.427Z"
  },
  {
    "id": 15,
    "kind": "deviation",
    "phase": "02.1",
    "file": "packages/libs/editor-impl/src/table/__tests__/integration.test.tsx",
    "line": null,
    "description": "重量级端到端用例超 5s 默认超时（满套件并行争用，HEAD 亦同），Plan 23 放宽到 20s",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-10-16T16:43:45.730Z",
    "resolved_at": "2026-10-16T16:44:52.288Z"
  },
  {
    "id": 16,
    "kind": "deviation",
    "phase": "04.1",
    "file": "packages/libs/editor-impl/src/map/__tests__/model.cellMetrics.test.ts",
    "line": null,
    "description": "Task 2 的 RED 未在实现前观察到：实现已由 tracer Task 1 落地；已用一次性变异验证代替 RED 证据",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-23T13:55:27.758Z",
    "resolved_at": null
  },
  {
    "id": 17,
    "kind": "deviation",
    "phase": "04.1",
    "file": "packages/libs/editor-impl/src/map/__tests__/model.tileFrame.test.ts",
    "line": null,
    "description": "两个 TDD 任务的 RED 均为导入解析失败（模块尚不存在，属 INVALID_RED）；已用一次性变异证明测试能盯住行为",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-23T14:17:46.935Z",
    "resolved_at": null
  },
  {
    "id": 18,
    "kind": "deviation",
    "phase": "04.1",
    "file": "packages/libs/editor-impl/src/map/model/tileFrame.ts",
    "line": 196,
    "description": "resolveFrameRect 增加可选第三参数 frameColumns（Scan 帧轴折行所需）；IMapFrameInfo 未新增成员（P-01）",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-23T14:17:56.083Z",
    "resolved_at": null
  },
  {
    "id": 19,
    "kind": "fixme",
    "phase": "04.1",
    "file": "packages/apps/editor-dev/src/__tests__/devHostMap.test.tsx",
    "line": 480,
    "description": "Plan 36 默认打开帧数角标后，map-tile- 前缀选择器命中 map-tile-frames-N，devHostMap 端到端用例断言 NaN 失败；留待 04.1-31 收口修选择器",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-26T12:48:36.009Z",
    "resolved_at": null
  },
  {
    "id": 20,
    "kind": "deviation",
    "phase": "04.2",
    "file": "packages/libs/editor-impl/src/table/tablePanel.ts",
    "line": null,
    "description": "ExternalChangeDialog 按执行器要求挂在 TablePanelView 根上（单一面板级 conflictStore），而 PLAN 任务文本写的是 TableColumn 逐栏挂载",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-28T16:20:31.238Z",
    "resolved_at": null
  }
]
````
