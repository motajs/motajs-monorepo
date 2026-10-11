---
phase: 01-shell
plan: 04
subsystem: editor-core
tags: [verification, gate, editor-core, fs, typescript, tsc]

# Dependency graph
requires:
  - phase: 01-shell
    provides: "01-01 通用 fs 契约 IEditorFileSystem（只声明、经 fs 桶与包根导出）"
  - phase: 01-shell
    provides: "01-02 / 01-03 外壳实现与样式（共享 editor-core 的 tsc 增量产物，需顺序化）"
provides:
  - "CORE-01 的可失败门禁 scripts/verify/coreFsSurface.js（真实树无实现/引用 + 两极性 fixture + 包根导入 typecheck 探针）"
affects: [phase-01 验证, CORE-01]

actuals:
  tokens: 2927
  tasks: 2
  commits: 2
  plan_head_before: a343b6aae851abd7a1b68a0d532a779238239f32

tech-stack:
  added: []
  patterns:
    - "门禁脚本范式：真实树断言 + 两极性 fixture（脚本创建/删除，finally 后断言已删）+ 非空转下界"
    - "包根可达性用 tsc 探针证明：正极性（tsc 退出 0）+ 负极性（引入不存在的成员 → TS2305）"

key-files:
  created:
    - scripts/verify/coreFsSurface.js
  modified: []

key-decisions:
  - "门禁扫描面 = 两个包 src 全量（含测试树），使 IEditorFileSystem 只允许出现在声明文件 fs/types.ts"
  - "负极性探针从包根 ./index 引入不存在的成员；TypeScript 实测报 TS2305（非计划所写 TS2307），门禁断言真实错误码"
  - "MIN_EXPECTED_SOURCES = 20（真实树 33 文件），比 >0 更紧以观测范围被削弱"

patterns-established:
  - "门禁必须可失败：合成 fixture 走同一条断言，真实树非空转下界防范围削弱"

requirements-completed: [CORE-01]

coverage:
  - id: D1
    description: "coreFsSurface 门禁断言真实树中 IEditorFileSystem 仅出现在其声明文件，core/impl 无实现或引用"
    requirement: "CORE-01"
    verification:
      - kind: automated
        ref: "node scripts/verify/coreFsSurface.js"
        status: pass
    human_judgment: false
  - id: D2
    description: "门禁可失败：class 实现接口的合成 fixture 被同一逐行断言拦下且自删；包根导入正/负探针证明接口经 '.' 可达"
    requirement: "CORE-01"
    verification:
      - kind: automated
        ref: "node scripts/verify/coreFsSurface.js"
        status: pass
    human_judgment: false

duration: ~15min
completed: 2026-10-11
status: complete
---

# Phase 1 Plan 04: fs 面门禁（CORE-01） Summary

**新增一条可失败的 `scripts/verify/coreFsSurface.js` 门禁——用「真实树 + 两极性 fixture + 非空转下界 + 包根导入 tsc 探针」证明通用 fs 接口 `IEditorFileSystem` 只定义、不实现、不引用，且经包根可被外部统一实现。**

## Performance

- **Duration:** 约 15 min
- **Started:** 2026-10-11 (approx)
- **Completed:** 2026-10-11
- **Tasks:** 2
- **Files modified:** 1（新增 `scripts/verify/coreFsSurface.js`）

## Accomplishments

- 真实树断言：`packages/libs/{editor-core,editor-impl}/src` 全量 `*.ts`/`*.tsx`（含测试）中，标识符 `IEditorFileSystem` 只允许出现在声明文件 `fs/types.ts`；真实树扫描 33 文件、其余 0 命中。
- 非空转下界 `MIN_EXPECTED_SOURCES = 20`：扫描范围被削弱（glob 写错 / 只扫一个包）会立刻变红。
- 两极性 fixture：临时写入 `class FsSurfaceProbe implements IEditorFileSystem`，同一条逐行断言必须命中；`finally` 删除并断言文件确实不存在。
- 包根导入正极性：普通 import 从 `./index` 引入 `IEditorFileSystem` 作类型使用，`pnpm --filter @motajs/editor-core exec tsc -p tsconfig.json` 退出 0，证明 CORE-01 的「外部可统一实现」出口存在。
- 包根导入负极性：把探针改为从 `./index` 引入不存在的名字 `IDefinitelyMissingFs`，同一条 tsc 非零退出并报 `TS2305` 且错误指向探针文件，证明该 typecheck 真的在检查探针而非空转通过。
- 全部探针在 `finally` 删除并断言不存在；未入库、未残留。

## Task Commits

Each task was committed atomically:

1. **Task 1: 建立 coreFsSurface 门禁（真实树 + 两极性 fixture）** - `41dd33d` (test)
2. **Task 2: 门禁补「包根可导入」typecheck 探针（含负极性）** - `c8f6a91` (test)

**Plan metadata:** 本次 SUMMARY 提交（docs: complete plan）

_Note: 无 TDD 任务。_

## Files Created/Modified

- `scripts/verify/coreFsSurface.js` - CORE-01 的可失败门禁：真实树扫描 + 两极性 fixture + 包根导入 tsc 探针（正/负极性）。全量 347 行。

## Decisions Made

- 门禁扫描面与既有 `coreImportType.js` / `coreEngineNeutral.js` / `coreModuleState.js` 一致（两个包 src 全量，含测试树），使「标识符仅出现在声明文件」成为单一、可复读的断言。
- `MIN_EXPECTED_SOURCES = 20`（真实树 33），保守但比 `>0` 更紧。
- 负极性探针沿用计划指定的「从包根 `./index` 引入不存在的名字」形态；实测 TypeScript 对该情形报 `TS2305`（见偏差），门禁据此断言真实错误码。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 负极性探针的错误码由计划的 TS2307 更正为实测 TS2305**
- **Found during:** Task 2（包根导入负极性）
- **Issue:** 计划（Task 2 `<action>` 与 `<fails_when>`）要求「从 `./index` 引入不存在的名字 → 输出含 `TS2307`」。但 `./index` 是**存在**的模块，从已解析模块引入不存在的**成员**时 TypeScript 报的是 `TS2305`（`Module "./index" has no exported member ...`）；`TS2307` 只用于「找不到模块」。计划描述的探针形态无法产生 `TS2307`。
- **Fix:** 保留计划指定的探针形态（从 `./index` 引入不存在的名字），把断言改为实测的 `TS2305`，并额外断言错误输出指向探针文件 `__fsImportProbe__`。这同样证明「该 typecheck 真的在检查这个探针」（计划的括号内意图），且门禁可正常通过。
- **Files modified:** `scripts/verify/coreFsSurface.js`
- **Verification:** 手工实验与门禁运行均确认：`import { IDefinitelyMissingFs } from './index'` → tsc 非零退出、输出 `src/__fsImportProbe__.ts(1,10): error TS2305: Module '"./index"' has no exported member 'IDefinitelyMissingFs'.`
- **Committed in:** `c8f6a91` (Task 2)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** 无功能影响——门禁仍按计划证明「接口经包根可导入」，只是断言了 TypeScript 的真实错误码。计划文本中的 `TS2307` 系规划错误，未据此写出「永远变红」的门禁。

## Issues Encountered

- 发现 `.git/gsd-plan-head-before-01-04` 存在上一次运行的陈旧基线（指向 402 个提交之前）。执行前已将基线重置为本次计划起点 `a343b6a`，故 SUMMARY 的 `commits: 2` 由 `git rev-list --count a343b6a..HEAD` 实测得出，真实反映本计划提交数。
- `pnpm ... exec tsc` 经 `spawnSync(..., { shell: true })` 调用时，Node 24 打印一条 `DEP0190` 弃用警告（与既有 `scripts/verify/coreBoundaries.js` 的调用方式一致）；不影响退出码与断言。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CORE-01 已由一条可失败、可复读的门禁证明：无默认实现、core/impl 不引用、接口经包根可达。
- 本计划为 Phase 01 的最后一个计划；四个计划（01-01..01-04）全部完成。
- 说明：`node scripts/verify/coreBoundaries.js` 当前整体为红（引用已归档里程碑的能力目录，见 RESEARCH Pitfall 8 / Open Q1），按计划**不作为**本阶段门禁；其「底层 IO 清零」断言已由 `coreFsSurface.js` 针对 fs 面单列覆盖。

## Verification Evidence

- `node scripts/verify/coreFsSurface.js` → 退出 0（真实树 33 文件 0 命中、两极性 fixture 被逐行拦下并删除、包根正极性 tsc 退出 0、负极性报 TS2305 且指向探针）。
- `pnpm --filter @motajs/editor-core typecheck`（`tsc -b`）→ 退出 0。
- `pnpm --filter @motajs/editor-core test` → 5 文件 / 51 用例全绿。
- `node scripts/verify/coreImportType.js` → 真实树 33 文件、0 条 `import type`；两极性成立。
- `node scripts/verify/coreEngineNeutral.js` → 真实树 27 生产文件、0 条引擎术语；两极性成立。
- `node scripts/verify/coreModuleState.js` → 真实树 0 条 error 级受限规则；组合根与测试树豁免成立；PORT-02 成立。

## Self-Check: PASSED

---
*Phase: 01-shell*
*Completed: 2026-10-11*
