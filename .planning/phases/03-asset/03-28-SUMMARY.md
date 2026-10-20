---
phase: 03-asset
plan: 28
subsystem: ui
tags: [asset-panel, byte-version, blob-url, react-effect, image-dimensions, uat-gap-closure, vitest]

# Dependency graph
requires:
  - phase: 03-asset
    provides: "03-19 卡片缩略图 AssetCardPreview 与详情预览 AssetPreview 的 blob: 地址渲染"
  - phase: 03-asset
    provides: "03-26 详情尺寸行 AssetImageSize 与按路径重解析的 effect"
  - phase: 03-asset
    provides: "03-28 前置的替换 / 原地转码 / 配置写回三条数据通路"
provides:
  - "IAssetEntry.byteVersion：逐条目的字节版本号，加载得到的条目按 0 处理"
  - "AssetPanel.replaceAsset 与 AssetPanel.transcodeAssets 在字节写入成功后把该条目版本加一"
  - "useAssetObjectUrl(loadBytes, mime, byteVersion) 把版本纳入 effect 依赖，版本变化先回收旧 blob: 再读新字节"
  - "卡片 / 详情预览 / 尺寸行透传条目版本，同路径替换即刻刷新，不依赖组件重挂"
  - "assetReplaceRefresh 回归测试钉住卡片 src、详情 src 与尺寸行三者同时更新，且只重读被替换条目"
affects: [03-asset UAT G-03-10 复验]

actuals:
  tokens: 2800
  tasks: 3
  commits: 4
  plan_head_before: f9eed2fd921a197d04db118a794d821411c83f52

tech-stack:
  added: []
  patterns:
    - "字节版本是个逐条目、可预期递增的整数（缺省 0），不是全局时间戳或随机数"
    - "预览刷新走 effect 依赖：key 仍只按素材路径，字节变化由 byteVersion 驱动重读"
    - "版本变化时 effect cleanup 先 revokeObjectURL 再创建新地址，避免 blob: 泄漏"
    - "只有版本变化的条目重读字节，其它卡片保持原 blob: 地址"

key-files:
  created:
    - packages/libs/editor-impl/src/asset/__tests__/assetReplaceRefresh.test.tsx
  modified:
    - packages/libs/editor-impl/src/asset/types.ts
    - packages/libs/editor-impl/src/asset/assetPanel.ts
    - packages/libs/editor-impl/src/asset/components/useAssetObjectUrl.ts
    - packages/libs/editor-impl/src/asset/components/AssetGrid.tsx
    - packages/libs/editor-impl/src/asset/components/AssetCardPreview.tsx
    - packages/libs/editor-impl/src/asset/components/AssetDetail.tsx
    - packages/libs/editor-impl/src/asset/components/AssetPreview.tsx
    - packages/libs/editor-impl/src/asset/components/AssetImageSize.tsx

key-decisions:
  - "用逐条目 byteVersion 而不是重挂组件：替换时路径与素材名都没变，key 无法触发刷新"
  - "原地转码即使输出路径变化也把版本加一：素材名可能不变、卡片不会重挂，只靠路径不可靠"
  - "storeEntryConfig 保留原版本，纯改配置不触发一次多余重读"
  - "AssetImageSize 把版本加入依赖并在重读前清空旧尺寸，避免旧宽高短暂残留"
  - "保留 key={entry.path}：路径切换仍靠重挂，字节替换靠版本，两条路径互不干扰"

patterns-established:
  - "预览刷新测试：真实挂载面板后只做同路径替换，断言三处界面同时变化，并统计 createObjectURL 调用次数证明确实重读"
  - "blob: 地址替身随调用递增（blob:asset-N），使「新地址 ≠ 旧地址」成为可断言的刷新证据"

requirements-completed: [ASSET-01]

duration: 13min
completed: 2026-10-20
status: complete
---

# Phase 03 Plan 28: 同路径替换后预览立即刷新 Summary

**每个素材带一个字节版本号，替换或原地转码后卡片缩略图、右侧预览与尺寸行立刻重读新字节，不再要求用户切走再切回**

## Performance

- **Duration:** 13 min
- **Started:** 2026-10-20T13:38:00+08:00
- **Completed:** 2026-10-20T13:51:00+08:00
- **Tasks:** 3
- **Files modified:** 9（1 新增，8 修改）

## Accomplishments
- `IAssetEntry` 新增可选只读 `byteVersion`；`AssetPanel.replaceAsset` 与 `AssetPanel.transcodeAssets` 在字节写入成功后把该条目版本加一，`AssetPanel.storeEntryConfig` 改配置时保留原版本
- `useAssetObjectUrl` 增加第三个参数 `byteVersion`（缺省 0）并纳入 effect 依赖；版本变化时执行 cleanup 回收旧 `blob:` 地址后重读字节
- 卡片、详情预览与尺寸行三处都拿到条目版本：`key={entry.path}` 保持不变，刷新由版本驱动，不再依赖重挂
- 新增 `assetReplaceRefresh` 回归测试：同路径替换后卡片 `src`、详情 `src` 与尺寸行同时变化，另一张卡片地址不变，旧地址被回收

## Task Commits

Each task was committed atomically:

1. **Task 1: 给条目加字节版本，并让预览 hook 依赖它** - `4271185` (feat)
2. **Task 2: 把字节版本透传到卡片、详情与尺寸行** - `ef7053c` (feat)
3. **Task 3: 回归测试——替换后预览与尺寸立即更新** - `1cfa738` (test)
4. **格式修正（Task 1 行宽）** - `753f043` (style)

**Plan metadata:** 见本计划的 `docs(03-28): complete 03-28 plan` 提交

## Files Created/Modified
- `packages/libs/editor-impl/src/asset/types.ts` - `IAssetEntry.byteVersion` 及 jsDoc
- `packages/libs/editor-impl/src/asset/assetPanel.ts` - 替换 / 原地转码递增版本，配置写回保留版本
- `packages/libs/editor-impl/src/asset/components/useAssetObjectUrl.ts` - 版本入依赖，版本变化重读并回收旧地址
- `packages/libs/editor-impl/src/asset/components/AssetGrid.tsx` - 把 `entry.byteVersion ?? 0` 传给卡片预览
- `packages/libs/editor-impl/src/asset/components/AssetCardPreview.tsx` - 两组内部预览 props 增加 `byteVersion` 并传给 hook
- `packages/libs/editor-impl/src/asset/components/AssetDetail.tsx` - 版本传给 `AssetImageSize` 与 `AssetPreview`
- `packages/libs/editor-impl/src/asset/components/AssetPreview.tsx` - 新 prop 传入 hook
- `packages/libs/editor-impl/src/asset/components/AssetImageSize.tsx` - 版本加入 effect 依赖，变化时重解析尺寸
- `packages/libs/editor-impl/src/asset/__tests__/assetReplaceRefresh.test.tsx` - 同路径替换刷新回归测试（2 个用例）

## Decisions Made
- 用逐条目 `byteVersion` 而非组件 key：替换时路径与素材名都没变，key 不会变，重挂无从发生
- 原地转码即便输出路径变化也递增版本：素材名可能不变，只靠路径判断会漏刷新
- `AssetPanel.storeEntryConfig` 保留版本，避免「只改配置」触发多余重读
- `AssetImageSize` 在版本变化时先清空旧尺寸再读取，避免旧宽高短暂残留
- 版本是逐条目整数、缺省 0，不使用全局时间戳或随机数（可预期、只影响被替换条目）

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Task 1 新增的 `storeEntryConfig` 条目字面量超过 120 列，Prettier 检查失败**
- **Found during:** Task 3（提交测试前统一跑格式检查）
- **Issue:** `entries[index] = { name, path, config, exists, byteVersion }` 单行 123 列，`prettier --check` 报 `assetPanel.ts` 不合规；Task 1 的验证命令只有 typecheck，未覆盖格式
- **Fix:** 用 `prettier --write` 把该对象字面量拆成多行，单独提交一个 `style(03-28)` commit，避免污染 Task 3 的测试提交
- **Files modified:** `packages/libs/editor-impl/src/asset/assetPanel.ts`
- **Verification:** `prettier --check` 全部通过；`tsc -b` 与全量测试仍绿
- **Committed in:** `753f043`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** 纯格式修正，无行为变化、无范围扩张。

## Issues Encountered
- 无。计划对根因（预览 effect 依赖只有 MIME、key 只有路径）判断准确，三个任务一次通过。

## User Setup Required
None - no external service configuration required.

## Verification Evidence

| 命令 | 结果 |
|------|------|
| `pnpm --filter @motajs/editor-impl test -- assetReplaceRefresh` | 2 tests passed |
| `pnpm --filter @motajs/editor-impl test` | 46 files / 361 tests passed（03-27 后基线 359 + 2） |
| `pnpm --filter @motajs/editor-impl typecheck` | exit 0 |
| `node scripts/verify/coreModuleState.js` | exit 0（173 文件，error 级受限规则 0 条） |
| `node scripts/verify/coreEngineNeutral.js` | exit 0（109 生产文件，0 条引擎标识违规） |
| `node scripts/verify/coreImportType.js` | exit 0（173 源码文件，0 条 `import type`） |
| `pnpm exec prettier --check <9 个改动文件>` | 全部通过 |
| `pnpm exec eslint <9 个改动文件>` | 无输出（无错误） |

## Next Phase Readiness
- G-03-10 的自动化证据已就位，等待人工在开发宿主复验：选中一张图片 → 替换为尺寸不同的图片 → 卡片、右侧预览与尺寸行应立即变化
- 03-29（G-03-11 非法工程 schema 的可见错误态）尚未执行，接口命名已在 `INTERFACE-NAME.md` 确认

---
*Phase: 03-asset*
*Completed: 2026-10-20*
