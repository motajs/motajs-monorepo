---
phase: 04-map
plan: 15
subsystem: editor-core shell
tags: [shell, tab-close, onBeforeClose, editor-core, vitest]
requires:
  - phase: 04-map
    provides: "IEditorPanel.onBeforeClose?(): Promise<boolean> 的声明（04-02 已定稿）"
provides:
  - "ShellSystem.closeTab 在用户关标签前先激活目标标签、再询问面板，可取消"
  - "私有 ShellSystem.discardTab 非询问关闭路径（closeTab 询问通过后与 unregisterPanelType 共用）"
  - "shellClose.test.ts 8 个用例"
affects: [地图面板未保存守卫, editor-impl 地图面板接入, 04-16]
actuals:
  # 8e36bcf 的 diff 共 16436 字符 → chars/4。plan_head_before 取 8e36bcf 的父提交；
  # 执行期间另一个会话（03-38）在本分支又落了 1b7012d、118b709 两个提交，
  # 因此 `1d9d811..HEAD` 的计数会把这 2 条非本计划的提交算进来，本计划实际只有 8e36bcf。
  tokens: 4109
  tasks: 1
  commits: 1
  plan_head_before: 118b7093b04081f688fb47b2a6349cfc8e55778b
tech-stack:
  added: []
  patterns:
    - "询问与移除分离：询问只出现在 ShellSystem.closeTab，真正移除标签只在私有 ShellSystem.discardTab"
key-files:
  created:
    - packages/libs/editor-core/src/shell/__tests__/shellClose.test.ts
  modified:
    - packages/libs/editor-core/src/shell/shellSystem.ts
key-decisions:
  - "wasActive 在 ShellSystem.discardTab 开头重新判定：为询问而激活过的后台标签，旧值仍是 false，会跳过切邻让 activeTabId 指向已移除的标签"
  - "钩子抛错按「取消关闭」处理并记 shell.beforeCloseFailed，不把异常抛给点击 ✕ 的人"
  - "未实现钩子的标签不激活，保持既有「关后台标签不动前台」的行为"
requirements-completed: [MAP-01]
coverage:
  - id: D1
    description: "用户点 ✕ 时外壳询问 IEditorPanel.onBeforeClose：回答 true 才移除标签并释放实例，回答 false 全部保留"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-core/src/shell/__tests__/shellClose.test.ts#钩子回答 true 时移除标签并释放实例"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-core/src/shell/__tests__/shellClose.test.ts#钩子回答 false 时保留标签与实例"
        status: pass
    human_judgment: false
  - id: D2
    description: "后台标签被关闭时先激活再询问（询问发生时已切入、原前台已切出），同意关闭后活动标签落到相邻标签"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-core/src/shell/__tests__/shellClose.test.ts#关闭后台标签时先激活再询问"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-core/src/shell/__tests__/shellClose.test.ts#后台标签同意关闭后活动标签落到相邻标签"
        status: pass
    human_judgment: false
  - id: D3
    description: "注销面板类型与释放外壳全程不询问，且注销后不留半截标签（类型、标签、实例一起消失）"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-core/src/shell/__tests__/shellClose.test.ts#注销面板类型不询问且不留标签"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-core/src/shell/__tests__/shellClose.test.ts#释放外壳不询问关闭钩子"
        status: pass
      - kind: automated
        ref: "node -e \"...unregisterPanelType body must include discardTab and must not include this.closeTab\" → unregisterPanelType uses discardTab"
        status: pass
    human_judgment: false
  - id: D4
    description: "钩子抛错时保留标签并记录日志；未实现钩子的面板（表格/素材类）仍是点了 ✕ 立刻关闭，且关后台标签不动前台"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-core/src/shell/__tests__/shellClose.test.ts#钩子抛错时保留标签并记录日志"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-core/src/shell/__tests__/shellClose.test.ts#未实现钩子的面板直接关闭且前台不变"
        status: pass
    human_judgment: false
duration: 16 min
completed: 2026-10-21
status: complete
---

# Phase 04 Plan 15: 关闭标签前询问面板 Summary

**用户点标签 ✕ 时外壳先把该标签切成活动标签、再问面板「能不能关」——回答不能就什么都不做；注销类型与释放 core 仍然一键到底。**

## Performance

- **Duration:** 16 min
- **Started:** 2026-10-21T17:20:22+08:00
- **Completed:** 2026-10-21T17:36:25+08:00
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- `ShellSystem.closeTab` 变成四步：找标签 → （有钩子时）先 `ShellSystem.activateTab` → `await onBeforeClose()` → 回答 `false` 直接返回，`true` 才继续移除。
- 把原来 `ShellSystem.closeTab` 的整段移除逻辑原样抽成私有 `ShellSystem.discardTab`：它自己在开头重算 `wasActive`，因此「后台标签因为要询问被切到前台、又同意关闭」时仍会照常切到相邻标签，`activeTabId` 不会停在已移除的 id 上。
- `ShellSystem.unregisterPanelType` 改调 `ShellSystem.discardTab`：注销一个带未保存地图的类型不再弹框，标签、实例、类型在同一段逻辑里一起消失。
- 钩子抛错被 `try/catch` 兜住，记 `shell.beforeCloseFailed` 并按「取消关闭」处理。
- 新增 `shellClose.test.ts` 8 个用例，覆盖同意 / 取消 / 后台标签先激活 / 后台标签同意后切邻 / 抛错隔离 / 无钩子面板零变化 / 注销不询问 / 释放不询问。

## Task Commits

1. **Task 1: 关闭标签前先激活、再询问、可取消** — `8e36bcf` (feat)

**Plan metadata:** 本 SUMMARY 与 STATE/ROADMAP 的更新提交见紧随其后的 `docs(04-15)` 提交。

## Files Created/Modified

- `packages/libs/editor-core/src/shell/shellSystem.ts` — `ShellSystem.closeTab` 增加询问时序；新增私有 `ShellSystem.discardTab`；`ShellSystem.unregisterPanelType` 改走非询问路径。
- `packages/libs/editor-core/src/shell/__tests__/shellClose.test.ts` — 8 个用例，含 `ClosePanel`（实现钩子）与 `PlainPanel`（不实现钩子）两个测试替身。

## Decisions Made

- **`wasActive` 只能在 `ShellSystem.discardTab` 里算**：`ShellSystem.closeTab` 为了询问会把后台标签激活，调用方在激活前取的值必然过期；把判定放进移除逻辑本身，是「先激活」与「关闭后切邻」能同时成立的前提。
- **询问前激活是刻意的**：面板的未保存对话框要挂在自己的 DOM 上才可能 settle，所以后台标签会被切到前台，这是 UI-SPEC 要求的可观察行为。
- **`ShellSystem.unregisterPanelType` 不再复用 `ShellSystem.closeTab`**：注销是内部释放语义，一旦走询问，答完 `false` 会留下「类型已删、标签还在」的悬空标签；两处共用 `ShellSystem.discardTab` 而不是复用公开入口。
- **未实现钩子的标签不激活**：表格 / 素材等既有面板的行为必须与改动前逐字一致（关后台标签不动前台）。

## Deviations from Plan

### 未自动修复（受文件范围限制）

**1. [Scope restriction] `shell.beforeCloseFailed` 的消息模板没有登记进 `log/messages.ts`**
- **Found during:** Task 1（钩子抛错用例首次运行）
- **Issue:** 计划动作写的是「沿用既有 logger 的键风格，新增键 `shell.beforeCloseFailed`」，但登记模板需要改 `packages/libs/editor-core/src/log/messages.ts`，而本计划 `files_modified` 只有两个文件、用户的硬性要求是只改这两个文件，因此该文件未被触碰。结果是日志会走 `log.unknownId` 兜底，控制台输出 `shell.beforeCloseFailed Unknown log id: shell.beforeCloseFailed`（日志 id 本身正确，测试也只钉 id）。
- **Fix:** 未修复——有意保持文件范围不变，留待一次显式授权的改动，建议模板为 `'shell.beforeCloseFailed': 'Panel close hook failed: $1'`。
- **Files modified:** 无
- **Verification:** 测试断言 `logger.error` 收到 `'shell.beforeCloseFailed'` 通过；stderr 可见上述兜底文案。
- **Committed in:** 8e36bcf（钩子调用与日志 id 部分）

---

**Total deviations:** 0 auto-fixed，1 项按范围限制未修复（消息模板登记）。
**Impact on plan:** 行为语义全部达成；唯一缺口是日志文案（不是日志 id、不是判定逻辑），不影响关闭语义，也不影响任何测试。

## Issues Encountered

- **测试文件一度被 PowerShell 重编码破坏**：用 `Set-Content -Encoding utf8` 改测试文件时，中文注释被按 ANSI 再编码、换行被吞、并写入 BOM，导致 ESLint 报 `Parsing error`。改用 Write 工具整体重写、按字节剥掉 BOM 后恢复正常；最终文件无 BOM，Prettier 与 ESLint 均干净。生产文件 `shellSystem.ts` 全程只用 edit 工具，未受影响。
- **`actuals.commits` 的测量口径**：`1d9d811..HEAD` 计数为 3，但其中 `1b7012d`、`118b709` 是执行期间另一会话（03-38）落在同一分支上的提交，本计划只有 `8e36bcf`。因此 `plan_head_before` 记录为 `8e36bcf` 的父提交 `118b709`，`commits` 记录为 1。

## Known Stubs

None.

## Threat Flags

None — 本计划没有新增网络端点、鉴权路径或信任边界；威胁登记表 T-04-15-01…06 的缓解均由上述 8 个用例与 `unregisterPanelType` 静态断言覆盖。

## Verification Evidence

| 命令 | 结果 |
|------|------|
| `pnpm --filter @motajs/editor-core exec vitest run src/shell/__tests__/shellClose.test.ts` | exit 0，1 file / 8 tests passed |
| `pnpm --filter @motajs/editor-core test -- src/shell/__tests__/shellClose.test.ts`（计划原命令） | exit 0，8 tests passed |
| `pnpm --filter @motajs/editor-core test`（全量） | exit 0，14 files / 102 tests passed |
| `pnpm --filter @motajs/editor-core typecheck` | exit 0 |
| `node -e "…unregisterPanelType must call discardTab…"` | `unregisterPanelType uses discardTab`，exit 0 |
| `node scripts/verify/coreImportType.js` | exit 0，219 个源码文件 0 条 `import type` |
| `node scripts/verify/coreModuleState.js` | exit 0，真实树 0 条 error 级受限规则 |
| `eslint shellSystem.ts shellClose.test.ts` | exit 0，0 problems |
| `prettier --check` 两文件 | All matched files use Prettier code style |
| `git status --porcelain -- packages/libs/editor-core/src/panel/types.ts` | 空（接口文件未被改动） |

## Next Phase Readiness

- 04-02 声明的 `IEditorPanel.onBeforeClose` 已真正接进外壳，地图面板按接口约定实现即可工作：`false` 取消、抛错也算取消。
- 剩余待办（不阻塞）：按 Deviations 第 1 条补 `log/messages.ts` 的 `shell.beforeCloseFailed` 模板，建议与下一次触碰该文件的计划合并。

## Self-Check: PASSED

- `packages/libs/editor-core/src/shell/shellSystem.ts` FOUND
- `packages/libs/editor-core/src/shell/__tests__/shellClose.test.ts` FOUND
- Commit `8e36bcf` FOUND in `git log`
- 8/8 新增用例、全量 102 用例、typecheck、两个 verify 脚本与 lint/format 全部通过
