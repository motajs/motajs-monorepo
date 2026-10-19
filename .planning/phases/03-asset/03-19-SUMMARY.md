---
phase: 03-asset
plan: 19
subsystem: ui
tags: [react, asset-panel, preview, blob-url, font-face, demo-data, uat-gap-closure, vitest]

# Dependency graph
requires:
  - phase: 03-asset
    provides: "03-11 面板视图层（AssetGrid / AssetDetail / AssetPreview / useAssetObjectUrl）"
  - phase: 03-asset
    provides: "03-08 素材模型层（resolveAssetMime 等按扩展名推断 MIME 的工具）"
  - phase: 03-asset
    provides: "03-17 开发宿主素材演示数据（ASSET_DEMO_CATEGORIES / ASSET_DEMO_FILES / registerAssetDemo）"
provides:
  - "卡片缩略图按大分类分流：图片出图、音频固定波形图标、动画占位、字体用素材字体写「ABC」"
  - "详情栏的字体样例真正应用素材字体（`@font-face` + 已被回收的 `blob:` 地址），音频仍是 `<audio controls>`"
  - "字体分类的 MIME 是真实字体类型（font/ttf、font/otf、font/woff、font/woff2），不再落到 octet-stream"
  - "开发宿主演示数据：两张 16×16 彩色 PNG、0.4 秒 440 Hz WAV、工作区 Fira Code 真实字体"
  - "组件级 8 条预览回归 + 宿主级 2 条（字节真实性、三类预览真的渲染）"
affects: [03-asset UAT G-03-2 复验]

actuals:
  tokens: 8387
  tasks: 3
  commits: 3
  plan_head_before: 4b2caadd8b596967bc6253a4fbfa64b426638620

tech-stack:
  added: []
  patterns:
    - "预览分流：卡片按大分类只做「看得出的形态」，只有图片 / 字体读字节，音频 / 动画不碰资源层"
    - "字体预览：路径经 FNV-1a 哈希成 `asset-font-<hex>` 族名，`@font-face` 正文走 React 文本节点"
    - "演示字体内联：`FiraCode.ttf?inline` 取 data URL，逗号后 base64 解码成字节"

key-files:
  created:
    - packages/libs/editor-impl/src/asset/components/AssetCardPreview.tsx
    - packages/libs/editor-impl/src/asset/components/AssetFontSample.tsx
  modified:
    - packages/libs/editor-impl/src/asset/components/AssetGrid.tsx
    - packages/libs/editor-impl/src/asset/components/AssetPanelView.tsx
    - packages/libs/editor-impl/src/asset/components/AssetPreview.tsx
    - packages/libs/editor-impl/src/asset/components/index.ts
    - packages/libs/editor-impl/src/asset/model/assetMime.ts
    - packages/libs/editor-impl/src/asset/asset.css
    - packages/libs/editor-impl/src/asset/__tests__/assetView.test.tsx
    - packages/apps/editor-dev/src/demo/assetDemo.ts
    - packages/apps/editor-dev/src/__tests__/devHostAsset.test.tsx

key-decisions:
  - "缺失态在缩略图里只留空占位：卡片本身就是 `<button>`，右上角徽标已经在说「缺失」，缩略图里再写一遍既重复又会挤压预览区"
  - "音频卡片只画固定内联 SVG 波形，不读字节、不建 `blob:` 地址；只有图片与字体卡片经 `useAssetObjectUrl` 读字节"
  - "字体族名用路径的 FNV-1a 哈希（`asset-font-<8 位十六进制>`），`<style>` 里因此只出现自家清洗过的名字与 `blob:` 地址"
  - "详情栏字体分支复用顶部已按字体 MIME 建好的地址，不重复读字节"
  - "演示字体直接以 `?inline` 引用工作区已有的 Fira Code，未复制文件、未新增依赖"
  - "波形竖条高度数组用 `Object.freeze(...)` 声明，满足 coreModuleState 对模块级可变容器的门禁"

patterns-established:
  - "预览回归要先给 jsdom 补 `URL.createObjectURL` / `revokeObjectURL`（只补静态方法，不换 URL 构造器）"
  - "宿主级预览回归：切分类 → 等卡片出现 → 断言预览节点的 test-id 与内容"

requirements-completed: [ASSET-01]

coverage:
  - id: D1
    description: "素材网格的卡片缩略图按分类呈现：图片是图片本身、音频是固定波形图标、动画是占位、字体用该字体写「ABC」；缺失时缩略图只留空占位"
    requirement: ASSET-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/__tests__/assetView.test.tsx#图片卡片在字节可用时渲染预览图"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/__tests__/assetView.test.tsx#音频卡片渲染波形图标且不读字节"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/__tests__/assetView.test.tsx#动画卡片渲染占位"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/__tests__/assetView.test.tsx#字体卡片用素材字体写 ABC"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/__tests__/assetView.test.tsx#缺失卡片缩略图是空占位且不含缺失文字"
        status: pass
      - kind: integration
        ref: "packages/apps/editor-dev/src/__tests__/devHostAsset.test.tsx#宿主里图片、音频、字体三类卡片都显示预览"
        status: pass
    human_judgment: true
    rationale: "卡片在真实浏览器里是否「一眼能分辨素材」是视觉结论；jsdom 只能证明相应节点与地址出现"
  - id: D2
    description: "右侧详情栏能看图、听音频、看字体样例：选中音频出现 `<audio controls>`，选中字体用素材字体渲染样例文字，动画保持占位"
    requirement: ASSET-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/__tests__/assetView.test.tsx#选中音频后详情出现可播放的播放器"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/__tests__/assetView.test.tsx#未选中素材时详情不含播放器"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/__tests__/assetView.test.tsx#选中字体后详情用素材字体渲染样例"
        status: pass
    human_judgment: true
    rationale: "「点开音频能听见声音」必须由人在真实浏览器里确认；jsdom 不会解码音频，也不会加载字体"
  - id: D3
    description: "演示数据是可见 / 可听 / 真能加载的样本：16×16 彩色 PNG、0.4 秒 440 Hz WAV、工作区 Fira Code 字体"
    requirement: ASSET-01
    verification:
      - kind: integration
        ref: "packages/apps/editor-dev/src/__tests__/devHostAsset.test.tsx#演示字节是看得见、听得到、能加载的样本"
        status: pass
      - kind: integration
        ref: "packages/apps/editor-dev/src/__tests__/devHostAsset.test.tsx#宿主里图片、音频、字体三类卡片都显示预览"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-10-19
status: complete
---

# Phase 03 Plan 19: 素材预览（G-03-2）Summary

**素材管理器不再是一排空缩略图：图片卡片直接显示那幅图、音频卡片画波形图标、字体卡片用素材字体写「ABC」，右侧详情能看图 / 听音频 / 看字体样例，演示数据换成看得见的小图、听得到的 WAV 和真正的 Fira Code 字体。**

## Performance

- **Duration:** 约 20 min
- **Started:** 2026-10-19T16:56:00+08:00
- **Completed:** 2026-10-19T17:15:00+08:00
- **Tasks:** 3
- **Files modified:** 11（2 新建 + 9 修改）

## Accomplishments

- **卡片预览按分类分流。** 新增 `AssetCardPreview`：缺失 → 空的 `.asset-card-preview-missing` 占位（不再在缩略图里重复写「缺失」，该文案仍由右上角徽标呈现）；图片 → 读字节后出位图；音频 → 固定内联 SVG 波形，**完全不调用 `loadBytes`**；动画 → 「动画」占位；字体 → 用素材字体写「ABC」。`AssetGrid` 由此新增必填的 `kind` / `loadBytes`，由 `AssetPanelView.renderContent` 从当前分类与资源访问口传入。
- **字体预览真正应用了素材字体。** 新增 `AssetFontSample`：路径经 FNV-1a 哈希成 `asset-font-<8 位十六进制>` 族名，`@font-face` 的正文作为 React 文本子节点写入（不用 `dangerouslySetInnerHTML`），`src` 只接受 `URL.createObjectURL` 产生的地址；卡片与详情共用同一组件，详情文字为「魔塔 Mota 0123456789」。
- **字体不再被当成二进制。** `resolveAssetMime` 新增字体分支：`.ttf` / `.otf` / `.woff` / `.woff2` 各自返回真实字体 MIME，其余回退 `font/ttf`。
- **详情栏照旧能看、现在能听、也能看出字体差异。** `AssetPreview` 的字体分支改为复用顶部按字体 MIME 建好的地址渲染 `AssetFontSample`，不重复读字节；音频仍是 `<audio controls>`，动画仍占位。
- **演示数据变得可验证。** 两张 16×16 RGBA 棋盘 PNG（hero 与 tile 内容不同）、0.4 秒 16 kHz 16 位单声道 440 Hz 正弦波 WAV（振幅 0.25、首尾各 0.02 秒淡入淡出）、直接用 `FiraCode.ttf?inline` 解码出的真实字体字节。
- **两层回归落地。** 组件级 8 条（五类卡片预览 + 三条详情预览），宿主级 2 条（演示字节真实性、三类卡片预览在宿主里真的渲染）。

## Task Commits

Each task was committed atomically:

1. **Task 1: 卡片预览按分类分流（图片 / 波形图标 / 动画占位 / 字体 ABC）** - `164e92d` (feat)
2. **Task 2: 详情 / 预览栏真正应用素材字体，并钉住音频播放与字体样例** - `a04f550` (feat)
3. **Task 3: 演示数据换成可见小图 / 可听 WAV / 真字体，并钉住宿主级预览** - `dd5b689` (feat)

**Plan metadata:** 见本文件所在提交（docs: complete 03-19 plan）

## Files Created/Modified

- `packages/libs/editor-impl/src/asset/components/AssetCardPreview.tsx` — 新建：卡片缩略图分流（缺失占位 / 位图 / 波形 SVG / 动画占位 / 字体样例），内部 `AssetCardImage` / `AssetCardFont` 只在图片与字体时走 `useAssetObjectUrl`。
- `packages/libs/editor-impl/src/asset/components/AssetFontSample.tsx` — 新建：`IAssetFontSampleProps` + `AssetFontSample`，FNV-1a 族名、`@font-face` 文本节点、字体族内联样式。
- `packages/libs/editor-impl/src/asset/components/AssetGrid.tsx` — `IAssetGridProps` 增加 `kind` / `loadBytes`，`.asset-card-thumb` 改渲染 `AssetCardPreview`。
- `packages/libs/editor-impl/src/asset/components/AssetPanelView.tsx` — 给 `AssetGrid` 传当前分类的 `kind` 与 `props.loadBytes`。
- `packages/libs/editor-impl/src/asset/components/AssetPreview.tsx` — 字体分支改渲染 `AssetFontSample`（复用已建的 `blob:` 地址）。
- `packages/libs/editor-impl/src/asset/components/index.ts` — 追加两个新组件的 `export *`。
- `packages/libs/editor-impl/src/asset/model/assetMime.ts` — 新增 `fontMimeOf`，`resolveAssetMime` 分流字体分类。
- `packages/libs/editor-impl/src/asset/asset.css` — 新增 `.asset-card-thumb img` / `.asset-card-preview-icon` / `.asset-card-preview-animation` / `.asset-card-preview-missing` / `.asset-card-preview-font`；`.asset-preview-font` 补 `line-height: 1.5`。
- `packages/libs/editor-impl/src/asset/__tests__/assetView.test.tsx` — 补 `URL.createObjectURL` / `revokeObjectURL` 打桩，分类清单加音频 / 字体，新增 8 条预览用例。
- `packages/apps/editor-dev/src/demo/assetDemo.ts` — 两张 16×16 PNG、正弦波 WAV、`FiraCode.ttf?inline` 解码的真实字体。
- `packages/apps/editor-dev/src/__tests__/devHostAsset.test.tsx` — 补同类 URL 打桩与 ASCII / 大端读取的辅助函数，新增 2 条宿主级用例。

## Decisions Made

- **缺失只在一处说。** 缩略图内留空占位、右上角徽标写「缺失」——两处都写会让卡片显得拥挤，也让「预览是否可用」和「字节是否存在」两件事混在一起。
- **音频卡片不读字节。** 波形是装饰性图标，一屏卡片为音频批量读字节只会浪费资源层的 LRU 与 `blob:` 生命周期；只有图片与字体需要真实字节。
- **族名哈希而非原始路径。** 原始路径会进入 `<style>` 文本，路径里的引号 / 分号就是样式注入面（T-03-61 的缓解）；哈希后只暴露 `asset-font-<hex>`。
- **详情复用同一条 `blob:` 地址。** `AssetPreview` 顶部已经按字体 MIME 建好地址，字体分支直接传给 `AssetFontSample`，避免为同一文件建两条永不回收的地址。
- **演示字体不复制、不下载。** 直接用 `?inline` 引用工作区已有的 `packages/apps/editor/src/assets/FiraCode.ttf`；plan 里预留的「复制到 editor-dev」回退方案没有触发。
- **波形竖条高度用 `Object.freeze(...)`。** 门禁禁止模块级可变容器（数组也算），冻结是 `eslint.config.js` 明确允许的豁免写法，也不必引入 `as` 断言。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 波形竖条常量触发 coreModuleState 的模块级容器门禁**
- **Found during:** Task 1（卡片预览分流）
- **Issue:** 首次把竖条高度写成模块级 `const WAVEFORM_BAR_HEIGHTS: readonly number[] = [...]`，`node scripts/verify/coreModuleState.js` 真实树出现 1 条 error 级 `no-restricted-syntax`（退出码 1），门禁把模块级数组视作可变容器。
- **Fix:** 改成 `Object.freeze([...])`——`eslint.config.js` 里写明的结构性豁免，仍然保持 `readonly number[]` 类型与只读语义。
- **Files modified:** `packages/libs/editor-impl/src/asset/components/AssetCardPreview.tsx`
- **Verification:** `node scripts/verify/coreModuleState.js` 退出 0，真实树 0 条受限规则消息。
- **Committed in:** `164e92d`（Task 1 提交）

---

**Total deviations:** 1 auto-fixed（1 blocking）
**Impact on plan:** 只是常量的声明形式，没有改变预览形态或对外接口，也没有扩大范围。

## Issues Encountered

- **`?inline` 跨应用相对引用可用。** `packages/apps/editor-dev/src/demo/assetDemo.ts` 直接 `import DEMO_FONT_DATA_URL from '../../../editor/src/assets/FiraCode.ttf?inline'`，vitest 与 `tsc -b` 都通过，因此没有采用 plan 里「把字体复制到 editor-dev」的备选方案。
- **jsdom 需要补 `URL.createObjectURL`。** 两个测试文件都在顶部用 `Object.defineProperty` 只补这两个静态方法（按 plan 要求不整体替换 `URL` 构造器），否则卡片预览拿不到地址。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- G-03-2 的代码侧修复与两层回归已就位，等待用户按 03-UAT 在真实浏览器里复验观感（D1 / D2 标记为需人工判断：照片是否「看得出」、音频是否「听得到」、字体是否「真的是那套字」）。
- 本计划未触碰 `AssetPicker`、转码逻辑与 `shared/schemaForm`；`asset` 仍未 import `table` / `code` / `map`。
- 四道门禁与两包 typecheck 全绿：`coreBoundaries` / `coreModuleState` / `coreEngineNeutral` / `coreImportType` 退出 0，`@motajs/editor-impl` 316/316、`@motajs/editor-dev` 27/27。

---

## Self-Check: PASSED

- 11 个改动文件全部存在（含新建的 `AssetCardPreview.tsx`、`AssetFontSample.tsx`）。
- 三个任务提交存在：`164e92d`（Task 1）、`a04f550`（Task 2）、`dd5b689`（Task 3）。
- 提交计数由 ledger 实测：`git rev-list --count 4b2caad..HEAD` = 3。
- `AssetPicker` 相关文件与 `shared/schemaForm` 在本计划的 diff 中未出现（禁令已遵守）。

---

*Phase: 03-asset*
*Completed: 2026-10-19*
