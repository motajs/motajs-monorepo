---
schema_version: 1
open_count: 1
waived_count: 0
fixed_count: 0
total_count: 1
last_updated: 2026-09-20T10:46:53.061Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 01 | deviation | packages/apps/editor/package.json |  | test:e2e pinned to --project=editor so a normal e2e run cannot rewrite committed baseline PNGs | open |  | 2026-09-20T10:46:53.061Z |  |

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
  }
]
````
