---
phase: 03-asset
plan: 30
subsystem: ui
tags: [asset-panel, transcode, origin-backup, uat-gap-closure, g-03-12, d-21, vitest]

# Dependency graph
requires:
  - phase: 03-asset
    provides: "AssetPanel.transcodeEntry 的三种写回分支（同路径就地写、覆盖时写新扩展名并删源、不覆盖时先改名再写）"
  - phase: 03-asset
    provides: "assetPaths 的 resolveTranscodedPath / resolveOriginPath 路径推导"
  - phase: 03-asset
    provides: "AssetPanel.transcodeAssets 在批量开始时用 listDirectory 建好的 paths 集合"
provides:
  - "AssetPanel.transcodeEntry 的同路径分支按 options.coverOrigin 分流：覆盖就地写回，不覆盖先 moveResource 备份为 {file}-origin.{ext} 再写回原路径"
  - "同路径 + 不覆盖时 origin 路径碰撞即整项失败，不移动也不写入"
  - "transcode.uat 四条回归：同路径不覆盖留 origin、同路径覆盖不留 origin、.png 不覆盖行为不变、同路径 origin 碰撞失败且双文件未改写"
affects: [03-asset UAT G-03-12 复验]

actuals:
  tokens: 1031
  tasks: 2
  commits: 2
  plan_head_before: 8b61b0621cf9104a22ba50f85f401af31584f508

tech-stack:
  added: []
  patterns:
    - "同路径写回也走「先备份、后写新」：moveResource 到 origin 再 createResource 回原路径，绝不先写后删同一路径"
    - "origin 碰撞守卫只认批量开始时建好的 paths 集合，命中即整项失败，保持整批失败隔离"
    - "不可达分支靠集成用例钉住行为：界面过滤掉「源已是目标扩展名」的条目，同路径分支只能由 transcode.uat 证明"

key-files:
  created: []
  modified:
    - packages/libs/editor-impl/src/asset/assetPanel.ts
    - packages/libs/editor-impl/src/asset/__tests__/transcode.uat.test.tsx

key-decisions:
  - "同路径分支先判 options.coverOrigin 再决定写法：coverOrigin 为真保持既有就地写回，为假走 moveResource → createResource"
  - "origin 碰撞检查放在移动之前，与 .png 不覆盖分支保持同一套守卫语义与同一句错误文案「保留文件已存在」"
  - "`.png → .webp` 的两条既有分支与 paths 集合的末尾增删一律不动，缺口只涉及同路径分支"
  - "不放宽 AssetPanelView.transcodeCandidates 的候选过滤（CR-01 刻意为之），同路径分支只由自动化用例覆盖，不做人工复测"

patterns-established:
  - "同路径转码不覆盖的回归写法：断言 origin 保留源字节 + 原路径为新字节 + 列表条目名不变"
  - "同路径 origin 碰撞的回归写法：断言源与既有备份字节都没变，且 message.error 收到「保留文件已存在」"

requirements-completed: [ASSET-01]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "不勾「覆盖旧文件」时，源已是 `.webp` 也先把源字节备份到 `<name>-origin.webp`，再把新字节写回 `<name>.webp`，素材列表条目名不变"
    requirement: "ASSET-01"
    verification:
      - kind: integration
        ref: "packages/libs/editor-impl/src/asset/__tests__/transcode.uat.test.tsx#不覆盖且源已是目标扩展名时先备份 origin 再写回原路径"
        status: pass
    human_judgment: false
  - id: D2
    description: "勾选「覆盖旧文件」时，同路径源就地覆盖写回，不产生 `-origin` 文件"
    requirement: "ASSET-01"
    verification:
      - kind: integration
        ref: "packages/libs/editor-impl/src/asset/__tests__/transcode.uat.test.tsx#源文件已是目标扩展名时原地覆盖而不删除源文件"
        status: pass
    human_judgment: false
  - id: D3
    description: "`.png → .webp` 且不勾覆盖时行为不变：旧文件保留为 `<name>-origin.png`，新 `.webp` 写入原素材名"
    requirement: "ASSET-01"
    verification:
      - kind: integration
        ref: "packages/libs/editor-impl/src/asset/__tests__/transcode.uat.test.tsx#不覆盖时保留 origin 文件并改名列表条目"
        status: pass
    human_judgment: false
  - id: D4
    description: "同路径 + 不覆盖 + `-origin.webp` 已存在时该项失败，源文件与既有备份都不被改写"
    requirement: "ASSET-01"
    verification:
      - kind: integration
        ref: "packages/libs/editor-impl/src/asset/__tests__/transcode.uat.test.tsx#同路径且保留文件已存在时不改写源文件与既有备份"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-10-20
status: complete
---

# Phase 03 Plan 30: 同路径转码也必须先备份再加盖 Summary

**不勾「覆盖旧文件」时，即使源文件本来就是 `.webp`，转码也会先把源字节留成 `<name>-origin.webp`，再把新字节写到原路径；只有勾了覆盖才在原地替换**

## Performance

- **Duration:** 12 min
- **Started:** 2026-10-20T16:22:00+08:00
- **Completed:** 2026-10-20T16:34:00+08:00
- **Tasks:** 2
- **Files modified:** 2（0 新增，2 修改）

## Accomplishments
- `AssetPanel.transcodeEntry` 的同路径分支不再无条件就地覆盖：`options.coverOrigin` 为真时保持 `createResource(entry.path, output)`；为假时先 `resolveOriginPath` 算出 origin，命中 `paths` 直接返回 `{ ok: false, error: '保留文件已存在' }`，否则 `moveResource(entry.path, originPath)` → `createResource(entry.path, output)` → `paths.add(originPath)`
- 碰撞守卫放在移动之前：`moveResource` 会先删目标，先查 `paths` 才能保证既有备份不被覆盖
- `.png → .webp` 的覆盖 / 不覆盖两条分支与末尾 `paths.delete` / `paths.add` 完全未动，`transcodeAssets`、列表改名与界面一律不碰
- 测试用例 ⑨ 从「钉住错误行为」改写为缺口要求的行为（origin 保留源字节、原路径为新字节、列表名仍是 `b.webp`），并新增用例 ⑪ 覆盖同路径 origin 碰撞

## Task Commits

Each task was committed atomically:

1. **Task 1: 同路径转码也遵守「覆盖旧文件」** - `2bc362c` (fix)
2. **Task 2: 回归——同路径不覆盖必须留 origin，覆盖不留** - `9eb4c3f` (test)

**Plan metadata:** 见本计划的 `docs(03-30): complete 03-30 plan` 提交

## Files Created/Modified
- `packages/libs/editor-impl/src/asset/assetPanel.ts` - `AssetPanel.transcodeEntry` 同路径分支按 `coverOrigin` 分流（覆盖就地写、不覆盖先备份再写、origin 碰撞即失败）
- `packages/libs/editor-impl/src/asset/__tests__/transcode.uat.test.tsx` - 用例 ⑨ 改写为不覆盖留 origin；新增用例 ⑪ 同路径 origin 碰撞不改写

## Decisions Made
- 同路径分支先判 `coverOrigin`，再决定写回方式；不用「写新文件 → 删旧文件」这类同路径写法（会把刚写好的产物删掉）
- origin 碰撞守卫与 `.png` 不覆盖分支共用同一判断与同一句文案，避免两条路径给出不一致的失败原因
- 末尾 `paths.delete(entry.path)` + `paths.add(targetPath)` 保持不变：同路径时先删后加，集合结果仍是该路径存在
- 不放宽 `AssetPanelView.transcodeCandidates` 的候选过滤：该过滤是 CR-01 的刻意修复，同路径分支在当前界面不可达，只由 `transcode.uat` 证明

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- 无。根因（同路径分支先于 `coverOrigin` 判断）判断准确，两个任务一次通过。

## User Setup Required
None - no external service configuration required.

## Verification Evidence

| 命令 | 结果 |
|------|------|
| `pnpm --filter @motajs/editor-impl test -- transcode.uat` | 1 file / 11 tests passed |
| `pnpm --filter @motajs/editor-impl test` | 46 files / 365 tests passed（03-29 后基线 364 + 1 新增） |
| `pnpm --filter @motajs/editor-impl typecheck` | exit 0 |
| `node scripts/verify/coreModuleState.js` | exit 0（173 文件，error 级受限规则 0 条） |
| `node scripts/verify/coreEngineNeutral.js` | exit 0（109 生产文件，0 条引擎标识违规） |
| `pnpm exec prettier --check <2 个改动文件>` | All matched files use Prettier code style |
| `pnpm exec eslint <2 个改动文件>` | exit 0 |

## Next Phase Readiness
- G-03-12 的自动化证据已就位；同路径分支在界面上不可达，无需人工复测该分支
- 界面可达路径仍待人工确认：图片分类里选一个 `.png`，**取消勾选**「覆盖旧文件」转码 → 出现 `<name>-origin.png` 与 `<name>.webp`；**勾选**覆盖再转一次 → 只剩新的 `.webp`

---
*Phase: 03-asset*
*Completed: 2026-10-20*

## Self-Check: PASSED

- 文件存在：`assetPanel.ts`、`transcode.uat.test.tsx`
- 提交存在：`2bc362c`、`9eb4c3f`
- 未修改 `STATE.md` 与 `ROADMAP.md`（由编排器负责）
