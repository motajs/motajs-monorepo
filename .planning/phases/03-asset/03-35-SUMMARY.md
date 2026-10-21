---
phase: 03-asset
plan: 35
subsystem: asset-transcode
tags: [asset-panel, transcode, preset, units, kbps, khz, vitest]

# Dependency graph
requires:
  - phase: 03-asset
    provides: "AssetImagePreset / AssetAudioPreset、四档契约、预设表、默认档与三段说明文案（03-32）"
  - phase: 03-asset
    provides: "resolveOriginPath 与 -origin 改名约定（03-01…03-31）"
provides:
  - "kbpsToBps / khzToHz / bpsToKbps / hzToKHz：界面边界的两向单位换算"
  - "resolveImagePresetQuality：图片档位 + 自定义质量 → 0–100 质量"
  - "resolveAudioPresetOptions：音频档位 + 自定义 kbps/kHz → 内部契约的 bps/Hz"
  - "TranscodeModal：四档预设 + 实际参数 + 说明 + 不覆盖时的改名提示（kbps / kHz）"
affects: [03-36 开发宿主整合, 03-37 人工验收]

actuals:
  tokens: 11198
  tasks: 2
  commits: 0

tech-stack:
  added: []
  patterns:
    - "单位换算只在界面边界：弹窗收 kbps / kHz，内部契约仍是 bps / Hz"
    - "档位 → 内部参数只有一个换算点（resolveImagePresetQuality / resolveAudioPresetOptions）"
    - "预设档位默认值一律从 ASSET_DEFAULT_*_PRESET 取，弹窗不写死档位"
    - "源音频探测只预填「自定义」输入框，并靠 touched 标记避免覆盖用户输入"

key-files:
  created:
    - packages/libs/editor-impl/src/asset/transcode/units.ts
    - packages/libs/editor-impl/src/asset/transcode/__tests__/transcodePresets.test.ts
  modified:
    - packages/libs/editor-impl/src/asset/transcode/presets.ts
    - packages/libs/editor-impl/src/asset/transcode/index.ts
    - packages/libs/editor-impl/src/asset/components/TranscodeModal.tsx
    - packages/libs/editor-impl/src/asset/asset.css
    - packages/libs/editor-impl/src/asset/__tests__/transcodeModal.test.tsx
  deleted: []

key-decisions:
  - "换算函数对非有限值与负数一律返回 0，避免界面出现 NaN"
  - "自定义质量先四舍五入再夹到 0–100；自定义码率 / 采样率换算后至少 1"
  - "音频「本档实际参数」用档位里的 kbps / kHz 数值拼出 `128 kbps + 48 kHz`，不带档位名（档位名只出现在选择器上）"
  - "两个预设数组用 Object.freeze 包住，满足 core 模块级可变容器门禁，对外类型仍是 readonly"
  - "采样率输入框 step 0.1、precision 1，故界面显示 48.0 / 16.0；用例按数值断言"

patterns-established:
  - "弹窗只认档位枚举，换算交给纯函数；测试按选项文字点击、按 data-test-id 与文本断言"
  - "说明文案常驻显示（取舍说明两种分类都有，像素风说明只在图片分类）"

requirements-completed: [ASSET-01]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "图片与音频都渲染四档预设，图片默认无损压缩（100）、音频默认常规压缩（128 kbps + 48 kHz）"
    requirement: "ASSET-01"
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/__tests__/transcodeModal.test.tsx#图片默认档为无损压缩且不显示质量输入框 / 音频默认档为常规压缩且不显示码率与采样率输入框"
        status: pass
    human_judgment: false
  - id: D2
    description: "只有自定义档出现数字输入框；音频单位是 kbps / kHz，采样率支持 44.1"
    requirement: "ASSET-01"
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/__tests__/transcodeModal.test.tsx#切换图片档位时实际参数跟着变，自定义档才出现输入框 / 音频自定义档出现码率与采样率输入框且单位是 kbps / kHz / 音频自定义参数开始转换时换算成 64000 bps 与 44100 Hz"
        status: pass
    human_judgment: false
  - id: D3
    description: "每档都显示「本档实际参数」，取舍说明两种分类都有，像素风说明只在图片分类且提到「无损」"
    requirement: "ASSET-01"
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/__tests__/transcodeModal.test.tsx#图片与音频都显示取舍说明 / 像素风说明只在图片分类出现且提到无损"
        status: pass
    human_judgment: false
  - id: D4
    description: "不勾覆盖时显示改名提示与具体例子；勾选时两者都不出现，破坏性二次确认保留"
    requirement: "ASSET-01"
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/__tests__/transcodeModal.test.tsx#不勾覆盖时显示改名提示与具体例子"
        status: pass
    human_judgment: false
  - id: D5
    description: "开始转换时把档位换算回内部契约（质量 + bps / Hz + coverOrigin），内部契约未变"
    requirement: "ASSET-01"
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/__tests__/transcodeModal.test.tsx#开始转换时按档位给出图片质量 / 音频自定义参数开始转换时换算成 64000 bps 与 44100 Hz"
        status: pass
      - kind: integration
        ref: "packages/libs/editor-impl/src/asset/__tests__/transcode.uat.test.tsx（11 条编排回归）"
        status: pass
    human_judgment: false
  - id: D6
    description: "单位换算与档位解析可被单测直接验证（含 44.1 kHz、非法输入、0–100 夹紧）"
    requirement: "ASSET-01"
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/transcode/__tests__/transcodePresets.test.ts（7 条）"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-10-21
status: complete
---

# Phase 03 Plan 35: 转码预设界面与说明 Summary

**转码弹窗从「一串裸数字」变成「选档位 + 看说明」：图片默认无损压缩、音频默认常规压缩，单位用 kbps / kHz，只有自定义档才出现输入框**

## Performance

- **Duration:** 25 min
- **Tasks:** 2
- **Files modified:** 7（2 新增，5 修改）

## Accomplishments

- 新增 `asset/transcode/units.ts`：`kbpsToBps` / `khzToHz` / `bpsToKbps` / `hzToKHz` 四个纯函数，`44.1 kHz → 44100 Hz`、`128 kbps → 128000 bps`；非有限值与负数一律返回 0
- `asset/transcode/presets.ts` 追加两个解析函数：
  - `resolveImagePresetQuality`：三档依次 80 / 92 / 100；自定义先四舍五入再夹到 0–100；档位缺失回落到 `ASSET_DEFAULT_WEBP_QUALITY`
  - `resolveAudioPresetOptions`：三档换算成 64000 + 44100、92000 + 48000、128000 + 48000；自定义经 `kbpsToBps` / `khzToHz` 换算、下界 1；档位缺失回落到默认码率 / 采样率
- `asset/transcode/index.ts` 追加 `export * from './units';`（桶文件仍只有 `export *`）
- `TranscodeModal` 改成预设界面：
  - 图片四档（体积优先 80 / 常规压缩 92 / 无损压缩 100 / 自定义参数），默认无损压缩；音频四档（最小体积 64+44.1 / 体积优先 92+48 / 常规压缩 128+48 / 自定义参数），默认常规压缩；默认值取自 `ASSET_DEFAULT_*_PRESET`
  - 只有自定义档渲染输入框；音频单位改为 `kbps` / `kHz`，采样率 `step 0.1` / `precision 1`
  - 新增「本档实际参数」、取舍说明、像素风说明（仅图片）；不勾「覆盖旧文件」时显示 `-origin` 改名提示与当前选中文件的例子
  - 覆盖的破坏性二次确认、输出格式说明、多选列表、转码中状态原样保留
  - `start()` 经两个解析函数换算成质量 + bps / Hz + coverOrigin；`IAssetTranscodeOptions` 一个字未改
- 探测 effect 保留，落点改为只预填自定义输入框（`bpsToKbps` / `hzToKHz`），不再改预设档
- `asset.css` 新增 `.asset-transcode-preset` / `.asset-transcode-effective` / `.asset-transcode-note`，沿用 `--editor-*` 变量
- 重写 `transcodeModal.test.tsx`：保留 4 条版面用例，探测用例改为自定义档语义，新增档位 / 单位 / 说明 / 转换参数 / 改名提示用例；新增 7 条 `transcodePresets.test.ts`

## Task Outcomes

1. **Task 1: 单位换算与预设解析** —— 新增 `units.ts`、两个解析函数、桶导出与 7 条单测；`test -- transcodePresets` 1 文件 / 7 用例通过，typecheck 通过
2. **Task 2: 弹窗改成预设选择 + 说明 + 覆盖提示（kbps / kHz）** —— 重写组件、补样式与 16 条弹窗用例；`test -- transcodeModal` 1 文件 / 16 用例通过，`test -- transcode.uat` 1 文件 / 11 用例通过，typecheck 与 prettier 通过

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - 既有门禁] 两个预设数组补 `Object.freeze`**
- **Found during:** Task 2（对改动文件跑 ESLint 时）
- **Issue:** `presets.ts` 里 03-32 落下的 `ASSET_IMAGE_PRESETS` / `ASSET_AUDIO_PRESETS` 是模块级数组字面量，命中 `no-restricted-syntax` 的 core 模块级可变容器门禁（2 条 error）。这是 03-32 遗留，但该文件在本计划改动范围内。
- **Fix:** 两个数组改为 `Object.freeze([...])`，对外类型仍是 `readonly IAsset…Option[]`，内容与顺序不变
- **Files modified:** `packages/libs/editor-impl/src/asset/transcode/presets.ts`

### 口径偏离（按计划自身的 must_have 取舍）

**1. 音频「本档实际参数」用数值拼文案，不用预设项的 `summary`**
- **Found during:** Task 2
- **Issue:** 计划「做法·四」写「非自定义显示预设项的 `summary`」，但音频 `summary` 与档位显示名同文案（`常规压缩 128 kbps + 48 kHz`），而 must_have 与测试要求实际参数为 `128 kbps + 48 kHz`。
- **Fix:** 非自定义档用预设项的 `bitrateKbps` / `sampleRateKHz` 拼出「参数 + 单位」，与自定义档同一格式；`summary` 仍用于档位显示名之外的地方（图片实际参数就是 `summary`）
- **Files modified:** `packages/libs/editor-impl/src/asset/components/TranscodeModal.tsx`

其余按计划执行：内部契约未改，注册 / 扫描逻辑未动，`packages/apps/**` 未改。

## Issues Encountered

- 采样率输入框按计划设了 `precision: 1`，antd 会把 `48` / `16` 显示为 `48.0` / `16.0`；用例按数值断言（`Number(inputValue(...))`），以免把显示格式钉死
- 弹窗测试输出仍有既有的 jsdom `window.getComputedStyle` 未实现噪音，不影响退出码与用例结果
- ESLint 在探测 effect 上保留一条既有性质的 `exhaustive-deps` 警告（状态数组不适合进依赖）；0 error，退出码 0

## Verification Evidence

| 命令 | 结果 |
|------|------|
| `pnpm --filter @motajs/editor-impl test -- transcodePresets` | 1 file / 7 tests passed，exit 0 |
| `pnpm --filter @motajs/editor-impl test -- transcodeModal` | 1 file / 16 tests passed，exit 0 |
| `pnpm --filter @motajs/editor-impl test -- transcode.uat` | 1 file / 11 tests passed，exit 0 |
| `pnpm --filter @motajs/editor-impl typecheck` | exit 0（`tsc -b` 无输出） |
| `pnpm exec prettier --check <7 个改动文件>` | All matched files use Prettier code style，exit 0 |
| `pnpm exec eslint <6 个改动源码文件>`（额外） | 0 error / 1 warning，exit 0 |
| `node scripts/verify/coreEngineNeutral.js`（额外） | 真实树 113 个生产文件、0 条引擎标识违规，exit 0 |

## Known Stubs

无。

## Next Phase Readiness

- 03-36 可在开发宿主里走「新增素材 → 保存」链路，不受本计划影响
- 03-37 的人工验收可直接观察：图片默认「无损压缩 / WebP 质量 100」→ 切常规压缩看到 92、切体积优先看到 80 → 切自定义填 85；取消勾选覆盖看到 `-origin` 改名提示
- 本计划未产生提交（按要求由用户在独立验证后提交）；工作区另有执行前已存在的 `.gsd/dispatch-isolation-sentinel.json`、`.planning/phases/02.1-resource-layer/*` 改动，与本计划无关

---

*Phase: 03-asset*
*Completed: 2026-10-21*

## Self-Check: PASSED

- 文件存在：`units.ts`、`transcodePresets.test.ts`；`presets.ts`、`transcode/index.ts`、`TranscodeModal.tsx`、`asset.css`、`transcodeModal.test.tsx` 已修改
- 未修改 `STATE.md`、`ROADMAP.md`、`packages/apps/**`、`packages/apps/editor/**` 或其他包
- 本计划未产生提交（用户要求独立验证后自行提交）；工作区其余改动均来自执行前
