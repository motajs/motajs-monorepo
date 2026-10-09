---
gsd_state_version: "1.0"
milestone: v1.0
current_phase: 1
current_phase_name: 编辑器外壳与通用 fs 接口
status: planned
stopped_at: Phase 1 context gathered
last_updated: "2026-10-09T09:02:56.849Z"
last_activity: 2026-10-09
last_activity_desc: v1.0 roadmap created (7 requirements → 6 phases)
state_head: 3a780d5b6234c26fb5f9b46c47d997db3616c888
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
milestone_name: editor-core 空壳 + editor-impl 重做
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-09)

**Core value:** 把编辑器内核与引擎细节彻底解耦——`editor-core` 只给接口、`editor-impl` 写默认实现，让新旧引擎共用同一套编辑能力，第三方可高自由度定制。
**Current focus:** Phase 1 — 编辑器外壳与通用 fs 接口

## Current Position

Phase: 1 of 6 (编辑器外壳与通用 fs 接口)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-10-09 — v1.0 roadmap created (7 requirements → 6 phases)

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 0 (this milestone)
- Average duration: - min
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. 编辑器外壳与通用 fs 接口 | 0 | - | - |
| 2. 表格编辑 | 0 | - | - |
| 3. 素材管理 | 0 | - | - |
| 4. 地图编辑 | 0 | - | - |
| 5. 代码编辑 | 0 | - | - |
| 6. 事件编辑器 | 0 | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: N/A

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Milestone v1.0, 2026-10-09]: 旧里程碑阶段全部作废，归档至 `.planning/milestones/archived-20261009-phases/`；本里程碑 Phase 重新从 1 编号。
- [Roadmap v1.0]: `editor-core` 只定义接口（含通用 fs 接口 CORE-01），`editor-impl` 写默认实现；外壳先行（SHELL-01），能力顺序 table → asset → map → code → event。
- [Roadmap v1.0]: CORE-01（通用 fs 接口）并入 Phase 1——外壳与接口同为最底层地基，避免把「只定义接口」单列成一个空阶段。
- [Phase 05.3]: `editor-core` 的 `window` 门禁豁免；`editor-impl` 对外 subpath 为 `.` / `./code` / `./table` / `./map` / `./asset` / `./shell` / `./react`。

### Pending Todos

None yet.

### Blockers/Concerns

- 旧 `@motajs/editor` 仍与 mota-js 文件格式深度耦合；`editor-impl` 成为默认实现后，`@motajs/editor` 需改为调用 core/impl 并自行承担引擎适配（对外行为保持不变）。
- 各能力阶段的 schema / 端口设计尚未展开，由对应阶段的 discuss/plan 时确定，本 roadmap 不预设。

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-10-09T09:02:56.832Z
Stopped at: Phase 1 context gathered
Resume file: .planning/phases/01-fs/01-CONTEXT.md
