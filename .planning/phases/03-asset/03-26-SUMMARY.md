---
phase: 03-asset
plan: 26
subsystem: ui
tags: [react, asset-panel, thumbnail, image-dimensions, byte-header, png, gif, jpeg, bmp, webp, uat-gap-closure, vitest]

# Dependency graph
requires:
  - phase: 03-asset
    provides: "03-19 卡片预览分流（AssetCardPreview）与详情预览（AssetPreview）"
  - phase: 03-asset
    provides: "03-23 「图标大小」滑块与按 cardWidth 联动的缩略图盒尺寸"
  - phase: 03-asset
    provides: "03-11 详情栏结构（名称 / 路径 / 缺失提示 / 预览 / 操作行）"
provides:
  - "图片缩略图按 100% 宽高 + object-fit: contain 填满缩略图盒，卡片变大时图片本身一起放大"
  - "纯字节头图片尺寸解析器：PNG / GIF / JPEG / BMP / WebP（VP8X / VP8L / VP8）"
  - "图片素材详情栏在路径下方显示「宽 × 高」，其它分类 / 缺失 / 坏字节不显示"
affects: [03-asset UAT G-03-7 / G-03-8 复验]

actuals:
  tokens: 6840
  tasks: 3
  commits: 3
  plan_head_before: f482224b0d7dc2d01c747f4ea21ef1d1dfbce61f

tech-stack:
  added: []
  patterns:
    - "缩略图自适应：CSS 写 width/height 100% + object-fit: contain，组件再加同值内联样式，彻底摆脱图片固有像素尺寸"
    - "图片尺寸解析为纯字节头读取：DataView + 每格式最小长度 + 逐偏移边界检查，不碰 DOM / Blob / URL / createImageBitmap"
    - "所有解析结果统一过 validSize：只接受 1–1000000 的整数，非法值等同于「读不到」"
    - "详情尺寸行按 key=path 重置：切换素材时先清空再解析，旧尺寸不残留"

key-files:
  created:
    - packages/libs/editor-impl/src/asset/model/imageSize.ts
    - packages/libs/editor-impl/src/asset/model/__tests__/imageSize.test.ts
    - packages/libs/editor-impl/src/asset/components/AssetImageSize.tsx
    - packages/libs/editor-impl/src/asset/__tests__/assetDetailSize.test.tsx
  modified:
    - packages/libs/editor-impl/src/asset/asset.css
    - packages/libs/editor-impl/src/asset/components/AssetCardPreview.tsx
    - packages/libs/editor-impl/src/asset/components/AssetDetail.tsx
    - packages/libs/editor-impl/src/asset/components/index.ts
    - packages/libs/editor-impl/src/asset/model/index.ts
    - packages/libs/editor-impl/src/asset/__tests__/assetView.test.tsx

key-decisions:
  - "图片预览同时改 CSS 与组件内联样式：只改一处会在样式表加载顺序变化时退回固有像素行为"
  - "尺寸解析只读头部固定偏移，绝不按声明尺寸分配数组；截断 / 非法 / 超大尺寸一律返回 undefined 而不是抛错"
  - "WebP 三种变体分别按 VP8X（24 位减一）、VP8L（14 位位段）、VP8 起始码后的 14 位解析"
  - "详情尺寸行只在 kind === Image 且 entry.exists 时挂载；读取或解析失败静默，不新增提示"
  - "AssetImageSize 依赖数组含稳定的 setState，保证项目既有 hook 写法与 lint 一致；语义上仍只随 path 重新解析"

patterns-established:
  - "字节头测试：在测试里手写各格式最小合法头，覆盖正常值、负高度、截断、0、超大值与未知格式"
  - "详情条件渲染测试：直接渲染 AssetDetail，按分类 / 缺失 / 坏字节 / 切换素材五种情形断言尺寸节点是否存在"

requirements-completed: [ASSET-01]

coverage:
  - id: D1
    description: "拖动「图标大小」滑块时，卡片里的图片本身跟着放大 / 缩小（G-03-7）"
    requirement: ASSET-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/__tests__/assetView.test.tsx#图片预览按百分比填满缩略图并随滑块放大"
        status: pass
    human_judgment: true
    rationale: "测试只证明内联样式为 100% 且滑块后缩略图盒变为 71px；真实浏览器里的缩放观感与像素化渲染仍需人工确认"
  - id: D2
    description: "纯字节头解析 PNG / GIF / JPEG / BMP / WebP 的宽高，坏字节只得到「读不到」"
    requirement: ASSET-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/model/__tests__/imageSize.test.ts#readImageDimensions（11 条：各格式、负高度、未知、截断、0、超大）"
        status: pass
    human_judgment: false
  - id: D3
    description: "图片素材详情栏在路径下方显示「宽 × 高」，非图片 / 缺失 / 坏字节不显示"
    requirement: ASSET-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/__tests__/assetDetailSize.test.tsx#6 条（显示、音频、无字节、坏字节、缺失、切换）"
        status: pass
    human_judgment: true
    rationale: "文本内容与出现条件已由测试钉住；muted 小字、等宽数字与路径下方的实际观感需人工确认"

duration: 14min
completed: 2026-10-19
status: complete
---

# Phase 03 Plan 26: 缩略图随卡片缩放 + 详情栏图片尺寸（G-03-7 / G-03-8）Summary

**图片缩略图改为按百分比填满缩略图盒并随「图标大小」滑块一起缩放；新增纯字节头宽高解析与详情栏「宽 × 高」一行，PNG / GIF / JPEG / BMP / WebP 都能读，坏字节只得到「读不到」。**

## Performance

- **Duration:** 约 14 min
- **Started:** 2026-10-19T22:35:00+08:00
- **Completed:** 2026-10-19T22:49:00+08:00
- **Tasks:** 3
- **Files modified:** 10（4 新建 / 6 修改）

## Accomplishments

- **缩略图真的会跟着变大。** `.asset-card-thumb img` 从 `max-width/max-height` 改为 `width/height: 100%`，`AssetCardImage` 再补同值内联样式；此前图片按自身固有像素渲染，所以卡片框变大时只有盒子变大、图不变。音频波形、动画占位、字体样例与缺失占位一行未动。
- **纯字节的尺寸解析器。** 新增 `readImageDimensions(bytes)`：PNG 读 `IHDR`、GIF 读逻辑屏幕描述符、JPEG 逐段跳到 SOF 读取、BMP 读信息头（负高度取绝对值）、WebP 支持 `VP8X` / `VP8L` / `VP8 ` 三种变体。全部通过 `DataView` 与逐偏移边界检查完成，不创建 DOM / `Blob` / 图片对象，也不按声明尺寸分配像素数组。
- **坏输入只会得到「读不到」。** 截断、未知格式、宽或高为 0、超过 1000000 的伪造尺寸统一返回 `undefined`，不抛错。
- **详情栏尺寸行。** 新增 `AssetImageSize`：按素材路径读一次字节并解析；只在图片分类且文件存在时挂到路径下方，读不到或解析失败就什么也不渲染。切换素材时 `key=path` 重挂并先清空结果，旧尺寸不残留。
- **两层回归。** 模型层 11 条字节头用例；视图层新增 1 条卡片缩放用例与 6 条详情尺寸用例。

## Task Commits

Each task was committed atomically:

1. **Task 1: 图片缩略图随卡片框一起缩放（G-03-7）** - `0c6e112` (feat)
2. **Task 2: 纯字节解析图片宽高（G-03-8 基础）** - `7fc9fa7` (feat)
3. **Task 3: 详情栏显示图片尺寸（G-03-8 界面）** - `24b169a` (feat)

**Plan metadata:** 见本文件所在提交（docs: complete 03-26 plan）

## Files Created/Modified

- `packages/libs/editor-impl/src/asset/model/imageSize.ts` — `IAssetImageDimensions`、`readImageDimensions` 与各格式私有解析函数。
- `packages/libs/editor-impl/src/asset/model/index.ts` — 追加 `export * from './imageSize'`。
- `packages/libs/editor-impl/src/asset/model/__tests__/imageSize.test.ts` — 各格式最小头构造器与 11 条解析用例。
- `packages/libs/editor-impl/src/asset/components/AssetImageSize.tsx` — 详情栏「宽 × 高」行（`IAssetImageSizeProps`）。
- `packages/libs/editor-impl/src/asset/components/AssetDetail.tsx` — 在路径与缺失提示之间按条件挂载尺寸行。
- `packages/libs/editor-impl/src/asset/components/index.ts` — 追加 `AssetImageSize` 导出。
- `packages/libs/editor-impl/src/asset/components/AssetCardPreview.tsx` — 卡片图片补 100% 宽高与 `object-fit: contain` 内联样式。
- `packages/libs/editor-impl/src/asset/asset.css` — 缩略图图片改为 100% 填满；新增 `.asset-detail-size`。
- `packages/libs/editor-impl/src/asset/__tests__/assetView.test.tsx` — 新增滑块缩放后的图片样式回归。
- `packages/libs/editor-impl/src/asset/__tests__/assetDetailSize.test.tsx` — 尺寸行的显示 / 隐藏 / 切换回归。

## Decisions Made

- **CSS 与内联样式双保险。** 只改 CSS 会在样式表加载顺序变化时退回 `max-width` 行为；只在组件写内联又不利于其它入口复用，因此两处都写成 100%。
- **不做模块级缓存。** 详情预览与尺寸行各读一次字节，资源层已有 LRU 内容缓存；不为尺寸新增可变模块状态或查询表。
- **统一尺寸校验。** 所有格式最后都走同一个 `validSize`，避免各分支各写一套上限判断。
- **失败静默。** 读取抛错、字节缺失、解析失败都不提示；尺寸只是附加信息，不应干扰详情栏其它操作。

## Deviations from Plan

### AGENTS.md-driven adjustments

**1. [Convention] `imageSize.ts` 省略文件级 `//` 说明**
- **Found during:** Task 2（新建模型层解析器）
- **Issue:** 计划要求在 import 之后写一段文件级说明，但该模块没有任何 import；按项目规则「不写文件头注释」，放在文件顶部会变成被禁止的头部注释。
- **Fix:** 不写文件级注释，改由导出函数 `readImageDimensions` 与类型 `IAssetImageDimensions` 的 jsDoc 说明用途与边界；行为与计划一致。
- **Files modified:** `packages/libs/editor-impl/src/asset/model/imageSize.ts`
- **Verification:** `coreModuleState` / `coreEngineNeutral` / `coreImportType` 均退出 0；typecheck 通过。
- **Committed in:** `7fc9fa7`（Task 2 提交）

**2. [Convention] `AssetImageSize` 的 effect 依赖数组包含稳定的 `setDimensions`**
- **Found during:** Task 3（尺寸行组件）
- **Issue:** 计划写「`useEffect` 只依赖 `props.path`」；项目既有 `useAssetObjectUrl` 的写法把 `useState` 的 setter 也列进依赖，避免 lint 与团队约定分叉。
- **Fix:** 依赖数组写 `[props.path, setDimensions]`；`setDimensions` 由 `useState` 返回且引用稳定，重新解析仍只由路径变化触发。
- **Files modified:** `packages/libs/editor-impl/src/asset/components/AssetImageSize.tsx`
- **Verification:** 详情尺寸 6 条用例、整套素材测试与 typecheck 全部通过。
- **Committed in:** `24b169a`（Task 3 提交）

---

**Total deviations:** 2（均为项目规范适配，无行为变化）
**Impact on plan:** 零功能影响；两处都只是遵守 AGENTS.md 的注释与 hook 约定。

## Issues Encountered

- **jsdom 的 `getComputedStyle` 噪音。** 运行含 antd Modal 的既有用例时 jsdom 会打印 `Not implemented: window.getComputedStyle`；这是既有环境噪音，不影响退出码与断言结果。
- **测试基线。** 计划假设基线 341 条；本次新增 18 条（assetView +1、imageSize 11、assetDetailSize 6），整套 `@motajs/editor-impl` 45 个文件 359/359 通过。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- G-03-7 / G-03-8 的代码侧修复与回归已就位，等待用户在真实浏览器里复验：拖动「图标大小」滑块时图片本身是否跟着放大 / 缩小，选中图片后路径下方是否出现「宽 × 高」。
- 纯字节解析不引入 DOM 依赖，`editor-impl/src` 四道门禁保持全绿（`coreModuleState` 172 文件 / `coreEngineNeutral` 109 文件 / `coreImportType` 172 文件）。
- `AssetGrid` 的 `cardWidth` 内联尺寸链路完全未改；既有选中 / 预览 / 配置 / 转码 / 撤销路径不受影响。

---

## Self-Check: PASSED

- 10 个改动文件全部存在。
- 三个任务提交存在：`0c6e112`（Task 1）、`7fc9fa7`（Task 2）、`24b169a`（Task 3）。
- 提交计数由 ledger 实测：`git rev-list --count f482224..HEAD` = 3。
- 计划禁令核对：`editor-impl/src` 未新增 `document` / `fetch` / `navigator` / `createImageBitmap` / `import type`（门禁退出 0）；未改动 `AssetGrid` 的尺寸链路；非图片分类 / 缺失文件不显示尺寸。
- 验证结果：`@motajs/editor-impl` 359/359 测试通过；`typecheck` 退出 0；三道门禁退出 0。

---

*Phase: 03-asset*
*Completed: 2026-10-19*
