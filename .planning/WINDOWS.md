---
schema_version: 1
open_count: 2
waived_count: 0
fixed_count: 0
total_count: 2
last_updated: 2026-09-22T03:19:57.843Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 01 | deviation | packages/apps/editor/package.json |  | test:e2e pinned to --project=editor so a normal e2e run cannot rewrite committed baseline PNGs | open |  | 2026-09-20T10:46:53.061Z |  |
| 2 | 02 | stub | packages/libs/editor-core/lib/react/CoreProbe.tsx | 12 | CoreProbe is temporary Phase 2 scaffolding (D-03): it must be replaced or deleted by the real React layer from Phase 4 onward and must never become permanent public API | open |  | 2026-09-22T03:19:57.843Z |  |

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
  }
]
````
