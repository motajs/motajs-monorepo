---
status: testing
phase: 01-shell
source: [01-VERIFICATION.md]
started: 2026-10-11T08:00:00Z
updated: 2026-10-11T08:00:00Z
---

## Current Test

number: 1
name: Shell visual acceptance in a real host
expected: |
  Menu row 32px, tab row 36px, active tab uses `--editor-selected` tint + 2px accent bottom bar; `+`/`×` are 24×24 hit targets; long names ellipsize with single-line ellipsis; overflow clips with no wrap.
awaiting: user response

## Tests

### 1. Shell visual acceptance in a real host
expected: Mount `ShellSystem.render()` inside a real editor host and inspect the menu row (top), tab row (below, with `+` rightmost), and content area, including hover/focus states and long-name ellipsis. Expected: menu row 32px, tab row 36px, active tab uses the `--editor-selected` tint + 2px accent bottom bar; `+`/`×` are compact 24×24 hit targets; long names ellipsize; overflow clips with no wrap.
result: [pending]

### 2. Tab-row overflow backstop (pinned `+`)
expected: Open enough tabs that the tab strip overflows the tab-row width in a real browser, then observe the tab row. Expected: the tab strip clips horizontally with no wrapping; the `+` control remains pinned to the right edge and is fully visible/clickable.
result: [pending]

### 3. Carried-open spec-less probe item (awareness/decision)
expected: Acknowledge `[flagged — SHELL-01/CORE-01, spec-less probe row unclassified/unresolved]`. This phase has no SPEC.md, so the spec-less edge probe left both rows `unresolved` (neither auto-resolved nor silently dropped); their acceptance surface is carried by the plans' must_haves. No code action required unless an explicit classification is wanted.
result: [pending]

### 4. Judgment-tier prohibition sign-off (ADR-550 D4)
expected: Confirm the phase's must-NOT items were not violated — no `dangerouslySetInnerHTML`; tab open/close/switch never recorded in undo history; core imports no host/engine code and performs no file/network/storage IO; no fs-interface implementation/reference; the fs gate is genuinely failable; no new runtime/build dependency.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
