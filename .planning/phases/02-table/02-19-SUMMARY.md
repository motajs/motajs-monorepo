---
phase: 02-table
plan: 19
subsystem: ui
tags: [editor-core, shell, undo, redo, keyboard-shortcut, uat-fix, gap-closure]

requires:
  - phase: 02-table
    provides: editor-core 统一撤销系统（`UndoSystem.undo()` / `redo()`）与外壳渲染根（`ShellSystem.render()`）
provides:
  - 全局撤销 / 重做快捷键绑在 editor-core 外壳：任何渲染 `shellSystem.render()` 的宿主零接线即得（B5）
  - Ctrl/Cmd+Z 撤销，Ctrl/Cmd+Shift+Z 与 Ctrl/Cmd+Y 重做，命中时 `preventDefault()` 拦下浏览器原生撤销
affects: [02-20, 02-23]

actuals:
  tokens: 1752
  tasks: 2
  commits: 2
  plan_head_before: d397cef7a1ec7f1a750051d1a3716bfc08824a19

tech-stack:
  added: []
  patterns:
    - "全局键盘快捷键绑定在外壳渲染根（`ShellRoot` 的 `useEffect`），宿主自动获得、无需各自接线"
    - "按键组合解析为纯函数（`resolveUndoRedoShortcut`），状态不落模块层，符合 `coreModuleState` 门禁"
    - "快捷键监听挂 `window`（PORT-02 禁 `document` 全局；D-38 明确允许 core 监听 window 事件）"

key-files:
  created:
    - packages/libs/editor-core/src/shell/__tests__/shellUndoShortcut.test.ts
  modified:
    - packages/libs/editor-core/src/shell/shellSystem.ts

key-decisions:
  - "层选择 = editor-core 外壳（`ShellSystem`），不是各宿主组合根：撤销由 `UndoSystem` 拥有、外壳持有它并渲染 UI 根，绑这里即「一次实现、处处生效」，根治「没人接线」"
  - "键位（用户确认）：Ctrl/Cmd+Z → 撤销；Ctrl/Cmd+Shift+Z 与 Ctrl/Cmd+Y → 重做；macOS 的 Cmd（Meta）一并接受"
  - "ALWAYS `preventDefault()`：即使焦点在可编辑元素内也拦下并 preventDefault，不再让浏览器做文本撤销（用户确认）"
  - "执行器经 `IShellRootProps.onUndo` / `onRedo` 传入，由构造函数绑定到 `undoSystem`（与 `subscribe` / `getSnapshot` 同一模式）；对外 `IShellSystem` 签名未动"

patterns-established:
  - "外壳级全局快捷键：`ShellRoot` 内 `useEffect` 在 window 上增删 `keydown`，清理函数成对移除"
  - "纯按键解析：`resolveUndoRedoShortcut(event): UndoRedoShortcut`（非导出），实现与测试共用同一判定"
  - "监听生命周期随根组件挂载 / 卸载，避免全局监听泄漏（T-02-19-01）"

requirements-completed: [TABLE-01]

coverage:
  - id: D1
    description: "在 editor-core 外壳里 Ctrl/Cmd+Z 触发统一撤销、Ctrl/Cmd+Shift+Z 与 Ctrl/Cmd+Y 触发重做，且命中时调用 preventDefault；宿主渲染 shellSystem.render() 即得"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-core/src/shell/__tests__/shellUndoShortcut.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "真实浏览器里按 Ctrl+Z 不再触发浏览器自身原生撤销、而是走编辑器统一撤销"
    verification: []
    human_judgment: true
    rationale: "jsdom 不执行浏览器的原生撤销行为，只能用 event.defaultPrevented 作代理断言；真实浏览器内的观感需人工在宿主里按一次确认。"

duration: ~15min
completed: 2026-10-14
status: complete
---

# Phase 02 Plan 19: 全局撤销 / 重做快捷键（B5）Summary

**把 Ctrl/Cmd+Z、Ctrl/Cmd+Shift+Z、Ctrl/Cmd+Y 接到 editor-core 统一撤销系统并 preventDefault，绑在外壳所以每个宿主零接线即得。**

## Performance

- **Duration:** ~15min
- **Tasks:** 2 / 2
- **Files modified:** 2

## Accomplishments

- 修复 B5：表格编辑早已走统一撤销（D-09），但没有键盘入口，Ctrl+Z 只触发浏览器原生撤销。现在三种组合都接到 `UndoSystem`，并 `preventDefault()` 拦下浏览器原生行为（即使焦点在输入框内）。
- 快捷键绑在 editor-core 的**外壳渲染根**（`ShellSystem` 的 `ShellRoot`），因此 editor-dev 现在、`@motajs/editor` 与第三方将来只要渲染 `shellSystem.render()` 就自动获得，不必各自接线。
- 判定按键组合的逻辑抽成非导出纯函数 `resolveUndoRedoShortcut`，不依赖模块级状态，满足 `coreModuleState` 门禁；监听器随根组件挂载 / 卸载成对增删。

## Task Commits

Each task was committed atomically:

1. **Task 1: 外壳绑定全局撤销 / 重做快捷键并 preventDefault（B5，端到端）** - `f3c808c` (feat)
2. **Task 2: 快捷键测试（三种组合 / preventDefault / 空栈安全）** - `65c71e1` (test)

**Plan metadata:** `d397cef` (plan_head_before；docs 提交于其后的收尾步骤)

## Files Created/Modified

- `packages/libs/editor-core/src/shell/shellSystem.ts` - 新增非导出 `const enum UndoRedoShortcut` 与纯函数 `resolveUndoRedoShortcut`；`IShellRootProps` 增 `onUndo` / `onRedo`；`ShellRoot` 用 `useEffect` 在 window 上挂 `keydown`；构造函数把执行器绑到 `undoSystem` 并随 `system` / `subscribe` / `getSnapshot` 传入。
- `packages/libs/editor-core/src/shell/__tests__/shellUndoShortcut.test.ts` - 新增：Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y / Meta+Z、preventDefault 正反例、空栈安全，共 6 个用例。

## Decisions Made

- **层选择 = editor-core 外壳**（用户要求给出理由）：撤销 / 重做由 editor-core 的 `UndoSystem` 拥有，`ShellSystem` 构造时即持有它、并负责渲染编辑器 UI 根；把它交给组合根意味着 editor-dev、`@motajs/editor`、第三方各自重复接线、且极易漏——正是本次「没人接线」缺口的成因。绑在外壳是「所有宿主共有」的那一层，一次实现、处处生效，且不碰文件、不碰引擎。
- **键位**（用户确认）：Ctrl/Cmd+Z → 撤销；Ctrl/Cmd+Shift+Z 与 Ctrl/Cmd+Y → 重做；macOS 的 Cmd（Meta）一并接受。
- **ALWAYS 拦截**（用户确认）：命中组合时一律 `preventDefault()`，即使焦点在某输入框内也不跳过、不让浏览器做文本撤销。
- **命名**（用户确认）：非导出 `const enum UndoRedoShortcut`、非导出 `resolveUndoRedoShortcut`、`IShellRootProps.onUndo` / `onRedo`。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 监听目标由 `document` 改为 `window`**
- **Found during:** Task 1（首次跑 `coreModuleState.js` 前静态核对）
- **Issue:** 计划 Task 1 明确要求「在 `document` 上挂载 `keydown`」。但 `eslint.config.js` 的 Block A（PORT-02）对 `packages/libs/{editor-core,editor-impl}/**` 把 `document` 列为 `no-restricted-globals` error 级，且**不写 `ignores`**（测试文件同样覆盖）；`coreModuleState.js` 门禁 `(a)` 要求真实树 0 条 error 级受限规则消息。直接用 `document` 会让 `coreModuleState.js` 与 `pnpm lint` 变红——与计划自身 `<verification>` 要求四门禁退出 0 相矛盾。
- **Fix:** 改为 `window.addEventListener('keydown', ...)`。D-38 明确说明「`window` 不再被禁：core 可直接监听 `window` 的 focus / blur」，因此 `window` 是门禁认可的、行为等价的全局监听目标；同时测试也用 `window.dispatchEvent` 派发，避免在测试里引用 `document`。
- **Files modified:** `packages/libs/editor-core/src/shell/shellSystem.ts`、`packages/libs/editor-core/src/shell/__tests__/shellUndoShortcut.test.ts`
- **Verification:** `node scripts/verify/coreModuleState.js` 退出 0（真实树 88 文件、受限规则 error 级 0 条）；`pnpm --filter @motajs/editor-core test` 全绿。
- **Committed in:** `f3c808c`（实现）与 `65c71e1`（测试）

### Deviation from plan text (not an auto-fix, recorded for transparency)

**1. 新增一支 Meta+Z 用例**
- **Found during:** Task 2
- **Issue:** 计划任务只用例列了 Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y 三种组合；但用户在执行前确认 macOS 也接受 Cmd（Meta）。
- **Fix:** 追加以 `metaKey: true` 的用例，钉住 Cmd+Z → 撤销。
- **Verification:** `shellUndoShortcut.test.ts` 6 个用例全绿。
- **Committed in:** `65c71e1`

**2. `createSystem` 在本文件内声明（未跨文件复用）**
- **Found during:** Task 2
- **Issue:** 计划提示「沿用 `shellSwitch.test.ts` 的 `createSystem`」，但该函数不导出、且未返回 `undoSystem`（本测试需要 `vi.spyOn(undoSystem, 'undo')`）。
- **Fix:** 按计划括注「或在本文件内声明」在本文件内声明一个最小 `createSystem`（`EmptyInjection` + `UndoSystem` + `ShellSystem` + 一个最小面板类型），并返回 `{ shellSystem, undoSystem }`。不新增依赖。

---

**Total deviations:** 1 auto-fixed（Rule 3 - Blocking），另有 2 条合成说明（补 Meta 用例、本文件内声明 createSystem）。
**Impact on plan:** 无范围蔓延；功能行为严格按计划与用户确认实现，唯一实质差异是监听目标从 `document` 换成门禁允许的 `window`（行为等价）。

## Issues Encountered

- 无阻塞性问题。计划的 `document` 指示与 PORT-02 门禁冲突，已在实现前识别并按 HARD 门禁（四脚本退出 0）解决（见上）。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- B5 已修复：任何渲染 `shellSystem.render()` 的宿主自动获得全局撤销 / 重做快捷键；既有 editor-core / editor-impl 测试与四个门禁全绿。
- **待人工确认（非功能）**：本次执行前已确认——`UndoRedoShortcut` / `resolveUndoRedoShortcut` / `onUndo` / `onRedo` 命名定案，以及 macOS Cmd 键接受、「焦点在可编辑元素时也拦截并 preventDefault」两项开放假设。
- 下一个计划可在此基础上继续（02-20 多栏机制等）。

---

*Phase: 02-table*
*Completed: 2026-10-14*

## Self-Check: PASSED

- 2 个文件均存在（`shellSystem.ts`、`shellUndoShortcut.test.ts`）。
- 2 个任务提交 `f3c808c` / `65c71e1` 均在历史中；`plan_head_before` = `d397cef`，`git rev-list --count` = 2。
- `pnpm --filter @motajs/editor-core typecheck`：退出 0。
- `pnpm --filter @motajs/editor-core test`：70 passed（9 文件）；`pnpm --filter @motajs/editor-impl test`：104 passed（14 文件）。
- 四个门禁脚本 `coreImportType` / `coreEngineNeutral` / `coreModuleState` / `coreFsSurface` 均退出 0。
- Prettier：改动文件全部符合格式。
