---
status: complete
phase: 01-shell
source: [01-VERIFICATION.md]
started: 2026-10-11T08:00:00Z
updated: 2026-10-12T01:10:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Shell visual acceptance in a real host
expected: Mount `ShellSystem.render()` inside a real editor host and inspect the menu row (top), tab row (below, with `+` rightmost), and content area, including hover/focus states and long-name ellipsis. Expected: menu row 32px, tab row 36px, active tab uses the `--editor-selected` tint + 2px accent bottom bar; `+`/`×` are compact 24×24 hit targets; long names ellipsize; overflow clips with no wrap.
result: pass

### 2. 标签行溢出（浏览器式 `+`）
expected: 在 dev host 里开足够多标签使标签条溢出标签行宽度：标签条横向裁切、不换行；`+` 紧跟最后一个标签（浏览器式），溢出时随标签一起被裁切——不再保证 `+` 始终可见（2026-10-12 经 G-1.1-01 接受的取舍；原「`+` 固定右侧始终可见」的预期已随 Phase-1 D-03 更正而作废）。
result: pass
note: 原为 skipped（当时无独立可运行外壳）；2026-10-12 在 dev host 里补跑通过。预期已按更正后的 D-03（`+` 跟在最后一个标签之后）更新。

### 3. Carried-open spec-less probe item (awareness/decision)
expected: Acknowledge `[flagged — SHELL-01/CORE-01, spec-less probe row unclassified/unresolved]`. This phase has no SPEC.md, so the spec-less edge probe left both rows `unresolved` (neither auto-resolved nor silently dropped); their acceptance surface is carried by the plans' must_haves. No code action required unless an explicit classification is wanted.
result: pass

### 4. Judgment-tier prohibition sign-off (ADR-550 D4)
expected: Confirm the phase's must-NOT items were not violated — no `dangerouslySetInnerHTML`; tab open/close/switch never recorded in undo history; core imports no host/engine code and performs no file/network/storage IO; no fs-interface implementation/reference; the fs gate is genuinely failable; no new runtime/build dependency.
result: pass

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
