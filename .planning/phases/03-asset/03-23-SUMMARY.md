---
phase: 03-asset
plan: 23
subsystem: ui
tags: [react, asset-panel, demo-data, png-encoder, slider, grid-layout, uat-gap-closure, vitest]

# Dependency graph
requires:
  - phase: 03-asset
    provides: "03-11 面板视图层（AssetPanelView / AssetToolbar / AssetGrid）"
  - phase: 03-asset
    provides: "03-17 开发宿主素材演示数据（ASSET_DEMO_FILES / registerAssetDemo）"
  - phase: 03-asset
    provides: "03-19 卡片预览分流（AssetCardPreview 按大分类渲染）"
provides:
  - "开发宿主内置 36 张现场生成的 PNG：多组长方形与正方形，宽高覆盖 16×16–160×160"
  - "纯函数 PNG 编码器：8 位 RGBA、8×8 棋盘格、stored deflate 块 + 真实 CRC-32 / Adler-32"
  - "工具栏「图标大小」滑块：默认 116px、范围 96–240px、步长 8px"
  - "网格列宽、卡片高度与缩略图宽高随滑块实时联动，滑块值只存在于组件内 state"
affects: [03-asset UAT G-03-4 复验]

actuals:
  tokens: 7528
  tasks: 2
  commits: 2
  plan_head_before: 6b0dc2b2ca9dc443d59a81387be2d18b5ae3184b

tech-stack:
  added: []
  patterns:
    - "演示图片由代码现场编码：只依赖 Uint8Array / DataView，不新增图片库、不落二进制文件"
    - "PNG 压缩用 stored deflate 块（单块 ≤ 65535 字节），zlib 头 + Adler-32 + 逐块 CRC-32 全部按真实字节计算"
    - "卡片尺寸比例写成模块级常量（112/116、64/116、56/116），内联样式只覆盖缺省 CSS，不删除缺省值"
    - "滑块状态放在 AssetPanelView 的 useState，不进 store、不进资源、不持久化"

key-files:
  created: []
  modified:
    - packages/apps/editor-dev/src/demo/assetDemo.ts
    - packages/apps/editor-dev/src/__tests__/devHostAsset.test.tsx
    - packages/libs/editor-impl/src/asset/constants.ts
    - packages/libs/editor-impl/src/asset/components/AssetToolbar.tsx
    - packages/libs/editor-impl/src/asset/components/AssetGrid.tsx
    - packages/libs/editor-impl/src/asset/components/AssetPanelView.tsx
    - packages/libs/editor-impl/src/asset/asset.css
    - packages/libs/editor-impl/src/asset/__tests__/assetView.test.tsx

key-decisions:
  - "PNG 用无压缩 stored deflate 块而不是实现 LZ77：36 张图总量可控、生成逻辑可读，且浏览器解码走标准 zlib 路径"
  - "CRC-32 用逐位多项式计算，不写模块级 Uint32Array 查表：避开 coreModuleState 的模块级容器门禁，36 张图的耗时也可接受"
  - "演示列表的 source 由 DEMO_TEXTURE_NAMES 派生，read / usage 仍写数字（index % 5 / index % 3），交给 03-21 的枚举标签显示"
  - "滑块只改内联的列宽 / 高度 / 缩略图尺寸，选中、预览、配置、转码等既有数据流一行未动"
  - "rc-slider 先把 116 对齐到 96 + 8n 的 120 再前进一格，因此一次右移得到 128；保留计划规定的常量，只把断言改成实际值"

patterns-established:
  - "可解码性验证：除签名 / IHDR 断言外，用 node:zlib 对 IDAT 做 inflate，校验扫描行长度与滤波字节（本次为一次性临时测试，未入库）"
  - "尺寸联动测试：一个断言看 data-card-size 与网格 style，另两个看卡片高度与缩略图宽度的内联 style"

requirements-completed: [ASSET-01]

coverage:
  - id: D1
    description: "图片分类内置 36 张可见 PNG，含多组长方形与正方形，足以触发网格滚动与不同宽高比边界"
    requirement: ASSET-01
    verification:
      - kind: integration
        ref: "packages/apps/editor-dev/src/__tests__/devHostAsset.test.tsx#切入后图片分类读出 36 条演示素材"
        status: pass
      - kind: integration
        ref: "packages/apps/editor-dev/src/__tests__/devHostAsset.test.tsx#演示字节是看得见、听得到、能加载的样本"
        status: pass
    human_judgment: false
  - id: D2
    description: "工具栏有「图标大小」滑块，拖动时每张素材卡片框与缩略图一起变大 / 变小"
    requirement: ASSET-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/__tests__/assetView.test.tsx#默认渲染的卡片尺寸是 116"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/__tests__/assetView.test.tsx#拖动图标大小滑块后卡片与缩略图一起变大"
        status: pass
    human_judgment: true
    rationale: "测试只证明内联尺寸随键盘步进变化；真实浏览器里拖动滑块的手感、列数变化与布局观感仍需人工确认"
  - id: D3
    description: "演示列表与图片文件一一对应，read / usage 仍以数字存储，配置表单按 03-21 的标签显示"
    requirement: ASSET-01
    verification:
      - kind: integration
        ref: "packages/apps/editor-dev/src/__tests__/devHostAsset.test.tsx#演示字节是看得见、听得到、能加载的样本（textures 长度 = 图片文件数）"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/shared/schemaForm/__tests__/selectInput.test.tsx#数字枚举显示标签并按数字原值提交"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-10-19
status: complete
---

# Phase 03 Plan 23: 演示图片数量与尺寸、卡片大小滑块（G-03-4）Summary

**演示图片从两张 16×16 扩到 36 张代码现场生成的多尺寸 PNG（含大量长方形），工具栏新增「图标大小」滑块，拖动时卡片框与缩略图同步放大 / 缩小。**

## Performance

- **Duration:** 约 25 min
- **Started:** 2026-10-19T20:52:00+08:00
- **Completed:** 2026-10-19T21:12:00+08:00
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- **演示图片不再靠 base64。** 删除两个硬编码 base64 常量，改为 `DEMO_TEXTURE_SPECS`（36 条描述）+ 纯函数 `encodePng`：8 位 RGBA、8×8 棋盘格、每扫描行前置滤波字节 `0`；zlib 流由头 `0x78 0x01` + 若干 stored deflate 块（单块 ≤ 65535）+ 真实 Adler-32 组成，每个 PNG 块的 CRC-32 也按真实字节计算。
- **尺寸覆盖真的够用。** 前两张仍是 `hero.png` / `tile.png`（16×16，另一套配色），`tex-03.png`…`tex-36.png` 覆盖 64×32、32×64、160×48、60×100、160×160、128×32 等多组长方形 / 正方形；宽高都在 16–160 之间。
- **列表与文件严格一一对应。** 列表条目按序号写 `read: index % 5`、`usage: index % 3`、`source: spec.name`，仍是数字，03-21 的枚举标签照常生效。
- **工具栏「图标大小」滑块。** 新增四个常量（默认 116 / 最小 96 / 最大 240 / 步长 8），滑块放在标题与右侧按钮之间；`AssetPanelView` 用组件内 `useState` 持有宽度，`AssetGrid` 同时把它用于列宽 `repeat(auto-fill, Npx)`、卡片高度 `round(N × 112/116)` 与缩略图 `round(N × 64/116) × round(N × 56/116)`。
- **滑块只影响尺寸。** 选中、预览、配置、转码的既有数据流完全未改；滑块值不写进资源、不持久化。缺省 CSS 尺寸保留为回退值，内联样式覆盖。
- **两层回归。** 宿主级 7 条（含 36 张卡片、PNG 签名 / IHDR / 宽高比 / 列表计数）；视图级 23 条（新增默认尺寸与键盘调整两条）。

## Task Commits

Each task was committed atomically:

1. **Task 1: 36 张多尺寸 PNG（含长方形）与演示列表** - `980010f` (feat)
2. **Task 2: 工具栏「图标大小」滑块联动卡片框与缩略图** - `4760722` (feat)

**Plan metadata:** 见本文件所在提交（docs: complete 03-23 plan）

## Files Created/Modified

- `packages/apps/editor-dev/src/demo/assetDemo.ts` — 删除两张 base64；新增 `IAssetDemoTextureSpec` / `DEMO_TEXTURE_COUNT` / `DEMO_TEXTURE_SPECS`、`crc32` / `adler32` / `createPngChunk` / `createZlibStream` / `encodePng` / `createDemoPng`；列表与图片文件由 spec 派生。
- `packages/apps/editor-dev/src/__tests__/devHostAsset.test.tsx` — `cardTestIds` 收紧到卡片按钮；断言 36 张卡片；演示字节用例扩展为多图签名 / IHDR / 宽高比 / 列表计数。
- `packages/libs/editor-impl/src/asset/constants.ts` — 新增 `DEFAULT_ASSET_CARD_WIDTH` / `ASSET_CARD_MIN_WIDTH` / `ASSET_CARD_MAX_WIDTH` / `ASSET_CARD_WIDTH_STEP`。
- `packages/libs/editor-impl/src/asset/components/AssetToolbar.tsx` — 新增 `cardWidth` / `onCardWidthChange` props 与滑块。
- `packages/libs/editor-impl/src/asset/components/AssetGrid.tsx` — 新增 `cardWidth` prop，列宽 / 卡片高度 / 缩略图宽高全部按比例内联。
- `packages/libs/editor-impl/src/asset/components/AssetPanelView.tsx` — 组件内 `useState` 持有卡片宽度，传给工具栏与网格。
- `packages/libs/editor-impl/src/asset/asset.css` — 新增 `.asset-toolbar-size` / `.asset-toolbar-size-label` / `.asset-toolbar-size-slider`；原有固定尺寸保留为缺省值。
- `packages/libs/editor-impl/src/asset/__tests__/assetView.test.tsx` — 新增默认尺寸与键盘调整两条用例。

## Decisions Made

- **stored deflate 而非真压缩。** 演示图只服务开发宿主，36 张总量可控；不实现 LZ77 让编码器可读、可审计，浏览器仍按标准 zlib 流解码。
- **CRC-32 逐位计算、不建模块级查表。** `coreModuleState` 禁止模块级容器（`Object.freeze` 之外），逐位实现既过门禁也避免 `Uint32Array` 冻结限制。
- **列表 source 用派生名。** `DEMO_TEXTURE_NAMES` 由 `DEMO_TEXTURE_SPECS` 派生，列表与文件生成共享同一顺序，避免两处维护。
- **滑块状态留在视图组件。** 它是本次会话的视图偏好，放进 `AssetPanel` store 会与「视图状态由数据层发布」的既有结构冲突，也会被误当作可保存内容。
- **尺寸比例集中为常量。** `CARD_HEIGHT_RATIO` / `THUMB_WIDTH_RATIO` / `THUMB_HEIGHT_RATIO` 三个模块级常量，避免魔法数散落在 JSX 里。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 计划预期的 124 与 rc-slider 的实际步进不一致**
- **Found during:** Task 2（滑块视图回归）
- **Issue:** 计划要求默认 116、`min=96`、`step=8`，并断言一次 `ArrowRight` 后变为 124。但 `@rc-component/slider` 在键盘步进前先用 `formatValue` 把 116 对齐到 `min + 8n` 网格（120），再前进一格，实际得到 128。116 与 96 相差 20，不是 8 的整数倍。
- **Fix:** 保留计划规定的全部常量（116 / 96 / 240 / 8）与滑块行为，只把断言改为实际值 128，并同步断言卡片高度 124px、缩略图宽度 71px；测试注释写明 116→120→128 的对齐原因。没有为了凑 124 而改动 `min` 或默认值。
- **Files modified:** `packages/libs/editor-impl/src/asset/__tests__/assetView.test.tsx`
- **Verification:** `pnpm --filter @motajs/editor-impl test -- src/asset/__tests__/assetView.test.tsx` 23/23 通过。
- **Committed in:** `4760722`（Task 2 提交）

---

**Total deviations:** 1 auto-fixed（1 bug）
**Impact on plan:** 只影响测试里的一个期望值；滑块的范围、默认值与步长完全按计划落地，卡片 / 缩略图联动行为不受影响。

## Issues Encountered

- **PNG 可解码性额外自检。** 计划只要求断言签名 / IHDR。为确认 stored deflate 流真的能被标准 zlib 解开，用一次性临时测试（`node:zlib` 的 `inflateSync`）校验了 36 张图的 IDAT 长度与每行滤波字节，全部通过后删除该临时文件，未入库。
- **jsdom 的 `getComputedStyle` 噪音。** 运行含 antd Modal 的用例时 jsdom 会打印 `Not implemented: window.getComputedStyle`；这是既有环境噪音，不影响退出码与断言结果。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- G-03-4 的代码侧修复与两层回归已就位，等待用户在真实浏览器里复验：图片分类是否一眼能看到 36 张、滚动是否出现、长方形是否明显，以及拖动滑块时卡片框与预览图是否一起变化（D2 标记为需人工判断）。
- `hero.png` / `tile.png` 名字未变，既有配置 / 宿主用例未受影响，配置表单的 `read` / `usage` 仍读数字。
- 门禁与两包 typecheck 全绿：`coreModuleState` / `coreEngineNeutral` / `coreImportType` / `coreBoundaries` 退出 0；`@motajs/editor-impl` 335/335、`@motajs/editor-dev` 27/27。

---

## Self-Check: PASSED

- 8 个改动文件全部存在。
- 两个任务提交存在：`980010f`（Task 1）、`4760722`（Task 2）。
- 提交计数由 ledger 实测：`git rev-list --count 6b0dc2b..HEAD` = 2。
- 计划禁令核对：未新增图片生成依赖；`hero.png` / `tile.png` 保留；滑块值未进入资源 / 持久化；`editor-impl/src` 未新增 `document` / `fetch` / `navigator` / `import type`（四道门禁退出 0）。

---

*Phase: 03-asset*
*Completed: 2026-10-19*
