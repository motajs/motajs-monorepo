---
phase: 03-asset
plan: 31
subsystem: ui
tags: [asset-panel, detail-pane, file-size, uat-gap-closure, g-03-13, vitest]

# Dependency graph
requires:
  - phase: 03-asset
    provides: "readImageDimensions / IAssetImageDimensions 的纯字节头解析（03-26）"
  - phase: 03-asset
    provides: "IAssetEntry.byteVersion 与 AssetDetail 已有的 loadBytes 入口（03-28）"
  - phase: 03-asset
    provides: "AssetPreview / useAssetObjectUrl 的预览读取路径（本计划刻意不动）"
provides:
  - "formatAssetFileSize：1024 进制的 B / KB / MB / GB 人类可读格式化纯函数"
  - "AssetFileInfo：读一次字节同时产出「文件大小」与「图片尺寸」，图片才解析尺寸"
  - "素材详情栏对图片 / 音频 / 动画 / 字体都显示文件大小；缺失 / 坏字节两行都不出现"
  - "AssetImageSize / IAssetImageSizeProps 已移除，组件桶与详情栏挂载同步更新"
affects: [03-asset UAT G-03-13 复验]

actuals:
  tokens: 4338
  tasks: 2
  commits: 2
  plan_head_before: e77b4ea8e04627f050abe737fa67ebed7d774e84

tech-stack:
  added: []
  patterns:
    - "一份字节服务两个数字：同一 effect 内先取 byteLength，再（仅图片）解析宽高，不为两个数字各读一遍文件"
    - "读字节结果放进模块内私有 interface 的单一状态对象；path / byteVersion / kind 变化即清空，避免旧数字残留"
    - "坏字节与读取异常一律吞成「不渲染」：不伪造 0 B、不出错误提示、不抛错"

key-files:
  created:
    - packages/libs/editor-impl/src/asset/model/byteSize.ts
    - packages/libs/editor-impl/src/asset/model/__tests__/byteSize.test.ts
    - packages/libs/editor-impl/src/asset/components/AssetFileInfo.tsx
    - packages/libs/editor-impl/src/asset/__tests__/assetDetailBytes.test.tsx
  modified:
    - packages/libs/editor-impl/src/asset/model/index.ts
    - packages/libs/editor-impl/src/asset/components/index.ts
    - packages/libs/editor-impl/src/asset/components/AssetDetail.tsx
    - packages/libs/editor-impl/src/asset/asset.css
  deleted:
    - packages/libs/editor-impl/src/asset/components/AssetImageSize.tsx

key-decisions:
  - "单位固定 1024 进制、非 B 单位保留一位小数：12595 字节得 `12.3 KB`，符合计划里给出的样例"
  - "非有限数与负数直接返回 `0 B`，而不是抛错或显示 `NaN B`，保证详情栏永远拿得到字符串"
  - "`kind` 也进了 effect 依赖（计划只列 path / byteVersion / loadBytes）：切换分类但路径相同时，尺寸行必须跟着分类语义重算"
  - "AssetDetail 对「文件存在」的所有分类挂载 AssetFileInfo，不再只对图片挂载；尺寸仍由组件内部按 kind 收窄"
  - "测试 ③ 只断言读取器被调用过、两行都不出现；「只读一次」由单独渲染 AssetFileInfo 的用例 ⑥ 独占证明（详情栏里预览还会各读一次，计数会变成 2）"

patterns-established:
  - "模型层纯函数回归写法：逐个单位边界（0 / 1023 / 1024 / 12.3 KB / MB / GB）+ 非法输入兜底各一条 it"
  - "详情栏信息行回归写法：图片「大小 + 尺寸」、非图片「只有大小」、缺失 / 抛错「两行都没有」、byteVersion 变化「立即刷新」、隔离渲染「只读一次」"

requirements-completed: [ASSET-01]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "选中任一有字节的素材（图片 / 音频 / 动画 / 字体）时，右侧详情显示人类可读的文件大小，例如 `12.3 KB`"
    requirement: "ASSET-01"
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/model/__tests__/byteSize.test.ts#12595 字节输出 12.3 KB"
        status: pass
      - kind: integration
        ref: "packages/libs/editor-impl/src/asset/__tests__/assetDetailBytes.test.tsx#音频素材只显示文件大小"
        status: pass
    human_judgment: false
  - id: D2
    description: "图片素材除大小外继续显示 `宽 × 高`；音频 / 动画 / 字体不显示尺寸行"
    requirement: "ASSET-01"
    verification:
      - kind: integration
        ref: "packages/libs/editor-impl/src/asset/__tests__/assetDetailBytes.test.tsx#图片素材同时显示文件大小与尺寸"
        status: pass
      - kind: integration
        ref: "packages/libs/editor-impl/src/asset/__tests__/assetDetailSize.test.tsx（既有尺寸回归 6 条）"
        status: pass
    human_judgment: false
  - id: D3
    description: "字节缺失或读取失败时，大小行与尺寸行都不出现，也不抛错、不显示 `0 B`"
    requirement: "ASSET-01"
    verification:
      - kind: integration
        ref: "packages/libs/editor-impl/src/asset/__tests__/assetDetailBytes.test.tsx#读不到字节时两行都不显示"
        status: pass
      - kind: integration
        ref: "packages/libs/editor-impl/src/asset/__tests__/assetDetailBytes.test.tsx#读取失败时两行都不显示且不抛错"
        status: pass
    human_judgment: false
  - id: D4
    description: "替换字节（`byteVersion` 变化）后大小与尺寸立即更新，无需切走再切回"
    requirement: "ASSET-01"
    verification:
      - kind: integration
        ref: "packages/libs/editor-impl/src/asset/__tests__/assetDetailBytes.test.tsx#字节版本变化后文件大小立即刷新"
        status: pass
    human_judgment: false
  - id: D5
    description: "大小与尺寸共用同一次字节读取，不为这两个数字各读一遍文件"
    requirement: "ASSET-01"
    verification:
      - kind: integration
        ref: "packages/libs/editor-impl/src/asset/__tests__/assetDetailBytes.test.tsx#文件大小与尺寸只读取一次字节"
        status: pass
    human_judgment: false

duration: 13min
completed: 2026-10-20
status: complete
---

# Phase 03 Plan 31: 详情栏显示文件大小 Summary

**右侧详情多了一行人类可读的文件大小（四个分类都有），图片仍带 `宽 × 高`；两行共用同一次字节读取，字节缺失或读坏时都不显示**

## Performance

- **Duration:** 13 min
- **Started:** 2026-10-20T16:35:00+08:00
- **Completed:** 2026-10-20T16:48:00+08:00
- **Tasks:** 2
- **Files modified:** 9（4 新增，4 修改，1 删除）

## Accomplishments
- 新增纯函数 `formatAssetFileSize`：1024 进制，不足 1 KB 输出整数字节（`1023 B`），其余保留一位小数（`1.0 KB` / `12.3 KB` / `5.0 MB` / `2.0 GB`）；负数与非有限值一律 `0 B`，不抛错、不做本地化、不碰 DOM
- 新增 `AssetFileInfo` 组件：单个 effect 里读一次字节，先记 `byteLength`，仅当 `kind` 是图片时再调 `readImageDimensions`，两个数字写进同一个状态对象；`path` / `byteVersion` / `kind` 任一变化先清空再重读
- `AssetDetail` 把「只对图片挂载的尺寸行」换成「对文件存在的所有分类挂载的文件信息」，原样转交 `kind` / `path` / `byteVersion` / `loadBytes`，保留 `key={entry.path}`；缺失文件仍只显示既有提示
- 删除 `AssetImageSize.tsx` 与其 props，`components/index.ts` 改导出 `./AssetFileInfo`；`readImageDimensions` 与 `imageSize` 模型一行未动
- `.asset-detail-bytes` 与 `.asset-detail-size` 共用同一条 muted / 12px / 等宽数字规则，未新增主题键
- 新增 13 条回归：模型层 7 条（单位边界与非法输入）+ 组件层 6 条（四分类、缺失、抛错、版本刷新、只读一次）

## Task Commits

Each task was committed atomically:

1. **Task 1: 人类可读的文件大小格式化函数** - `f7ee5c6` (feat)
2. **Task 2: 详情栏显示文件大小，并与图片尺寸共用一次读取** - `90e9899` (feat)

**Plan metadata:** 见本计划的 `docs(03-31): complete 03-31 plan` 提交

## Files Created/Modified
- `packages/libs/editor-impl/src/asset/model/byteSize.ts` - `formatAssetFileSize`：字节数 → `B` / `KB` / `MB` / `GB` 文本
- `packages/libs/editor-impl/src/asset/model/index.ts` - 追加 `export * from './byteSize'`
- `packages/libs/editor-impl/src/asset/model/__tests__/byteSize.test.ts` - 0 / 1023 / 1024 / 12595 / 5 MiB / 2 GiB / 非法输入 7 条
- `packages/libs/editor-impl/src/asset/components/AssetFileInfo.tsx` - 一次读取同时产出文件大小与图片尺寸；不导出内部状态 interface
- `packages/libs/editor-impl/src/asset/components/AssetDetail.tsx` - 尺寸行位置改为挂载 `AssetFileInfo`（所有存在的分类）
- `packages/libs/editor-impl/src/asset/components/index.ts` - `./AssetImageSize` → `./AssetFileInfo`
- `packages/libs/editor-impl/src/asset/components/AssetImageSize.tsx` - 删除（并入 `AssetFileInfo`）
- `packages/libs/editor-impl/src/asset/asset.css` - `.asset-detail-size, .asset-detail-bytes` 共用一条规则
- `packages/libs/editor-impl/src/asset/__tests__/assetDetailBytes.test.tsx` - 六条详情栏字节回归

## Decisions Made
- 单位与精度按计划样例钉死：1024 进制、非 B 单位一位小数；`12595 → 12.3 KB` 与 `1024 → 1.0 KB` 同时成立
- 非法输入走早返回 `0 B`，不进入除法分支，避免 `Infinity` / `NaN` 渗进文本
- `kind` 加入 effect 依赖：同一路径在不同分类下切换时，尺寸行必须按新分类重算（计划只列了 path / byteVersion / loadBytes，这是必要补强）
- 面板层不缓存读取结果，交给 React effect 与既有资源层：与预览、卡片的既有读取方式保持一致

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 「只读一次」用例的调用计数改为隔离渲染**
- **Found during:** Task 2（详情栏测试首次运行）
- **Issue:** 计划要求用例 ③（字节缺失）顺带断言读取器只被调用一次，但 `AssetDetail` 里 `AssetPreview` 也会读一次字节，计数实际为 2，导致用例失败
- **Fix:** 用例 ③ 改为断言「读取器被调用过 + 两行都不出现」；「只读一次」由计划本来就要求的用例 ⑥（单独渲染 `AssetFileInfo`）独占证明
- **Files modified:** `packages/libs/editor-impl/src/asset/__tests__/assetDetailBytes.test.tsx`
- **Verification:** `pnpm --filter @motajs/editor-impl test -- asset` 181 条全绿
- **Committed in:** `90e9899`（Task 2 提交）

**2. [Rule 1 - Bug] effect 依赖补上 `kind`**
- **Found during:** Task 2（实现时）
- **Issue:** 计划只要求依赖 `path` / `byteVersion` / `loadBytes`；但标签页切分类而路径恰好相同时，尺寸会沿用旧分类的解析结果
- **Fix:** 把 `props.kind` 加入依赖数组（`loadBytes` 仍走 ref，避免调用方内联函数导致重复读取）
- **Files modified:** `packages/libs/editor-impl/src/asset/components/AssetFileInfo.tsx`
- **Verification:** 类型检查 0 退出；素材测试全绿；useEffect 依赖 lint 无警告
- **Committed in:** `90e9899`（Task 2 提交）

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** 都只收紧行为正确性，不扩范围；对外名称、组件边界与计划一致。

## Issues Encountered
- **本机 `node_modules/.pnpm/zod@4.2.1` 目录损坏**（`zod/v4/core` 无法枚举，报「目录已损坏」/「File Not Found」），导致任何 ESLint 调用在**加载配置阶段**就失败，`coreModuleState` 门禁因此先报「无法解析 ESLint 的 JSON 输出」。与本次改动无关（该门禁在分析任何文件前就挂了）。处理：从 pnpm store 离线恢复 zod 到 `.pnpm/zod@4.2.1`，随后 `coreModuleState` 退出码 0；损坏的旧目录被重命名为 `v4/core_broken` 后仍无法删除（Windows 拒绝枚举其内容），留在 `node_modules`（不被 git 跟踪，不影响构建与测试）。
- 首次运行详情栏测试时 `vi.fn` 调用计数为 2，原因见上「Deviations #1」；改法已记录。

## User Setup Required
None - no external service configuration required.

## Verification Evidence

| 命令 | 结果 |
|------|------|
| `pnpm --filter @motajs/editor-impl test -- byteSize` | 1 file / 7 tests passed |
| `pnpm --filter @motajs/editor-impl test -- asset` | 20 files / 181 tests passed（168 基线 + 13 新增） |
| `pnpm --filter @motajs/editor-impl test` | 48 files / 378 tests passed（365 基线 + 13 新增） |
| `pnpm --filter @motajs/editor-impl typecheck` | exit 0 |
| `node scripts/verify/coreModuleState.js` | exit 0（176 文件，error 级受限规则 0 条） |
| `node scripts/verify/coreEngineNeutral.js` | exit 0（110 生产文件，0 条引擎标识违规） |
| `node scripts/verify/coreImportType.js` | exit 0（176 文件，0 条 `import type`） |
| `node node_modules/eslint/bin/eslint.js <6 个改动文件>` | exit 0（prettier 规则同时满足） |

## Next Phase Readiness
- G-03-13 的自动化证据已就位：四个分类的大小、图片尺寸不回退、缺失 / 坏字节不显示、版本刷新、单次读取都有用例
- 仍待人工在开发宿主里看一眼：图片详情应同时出现 `宽 × 高` 与大小；音频 / 动画 / 字体只出现大小；转码或替换后大小立即变化
- `node_modules` 里遗留的 `zod/v4/core_broken` 是坏目录残留，若后续 `pnpm install --force` 报错，删掉整个 `.pnpm/zod@4.2.1` 重装即可（与源码无关）

---
*Phase: 03-asset*
*Completed: 2026-10-20*

## Self-Check: PASSED

- 文件存在：`byteSize.ts`、`byteSize.test.ts`、`AssetFileInfo.tsx`、`assetDetailBytes.test.tsx`、`AssetDetail.tsx`、`asset.css`
- `AssetImageSize.tsx` 已删除且全仓无引用
- 提交存在：`f7ee5c6`、`90e9899`
- 未修改 `STATE.md` 与 `ROADMAP.md`（由编排器负责）
