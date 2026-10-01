---
schema_version: 1
open_count: 5
waived_count: 0
fixed_count: 2
total_count: 7
last_updated: 2026-10-01T09:58:18.041Z
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
  }
]
````
