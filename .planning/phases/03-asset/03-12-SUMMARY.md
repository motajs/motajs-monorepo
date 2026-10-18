---
phase: 03-asset
plan: 12
subsystem: editor-impl-asset
tags: [typescript, react, asset, picker, capability-injection, blob-url, antd]

# Dependency graph
requires:
  - phase: 03-asset
    provides: "asset 模型层（readAssetList / resolveAssetBytePath）与共享 `.jsonc` 编解码（parseTableText / TableTextParseStatus）"
  - phase: 03-asset
    provides: "react 接缝的素材能力契约（IAssetCategory / IAssetPickerOpener / IAssetPickerOpenRequest / IAssetPickerResult / ITableEditorCapabilities.asset）与通用多选弹窗壳（MultiSelectModal / CapabilityProvider）"
provides:
  - "候选项加载器：loadPickerItems（asset/picker/assetPickerItems.ts）——按分类读列表，生成图片 blob 缩略图 / 音频 blob 试听 / 动画预览提示，返回候选项与需回收的 blob 地址"
  - "IAssetPickerItems（候选项 + 需回收的 blob 地址）"
  - "IMultiSelectItem.audio / IMultiSelectItem.animation 两个可选预览字段与 MultiSelectModal 的三类预览渲染"
  - "AssetCapabilityProvider / IAssetCapabilityProviderProps：包一层即得默认素材选择器"
  - "CapabilityProvider 的 asset 透传与上层能力包合并（嵌套 Provider 不再互相吞掉能力）"
affects: [03-13, 03-14, 03-16, 03-17]

actuals:
  tokens: 7147
  tasks: 3
  commits: 3
plan_head_before: d295ad918f9f3aeffc3fa57fd5e72f089a6b5c58

tech-stack:
  added: []
  patterns:
    - "选择器候选项与面板同源：走 parseTableText + readAssetList（不另写一套列表解析），非法正文抛错、读不到字节只跳过该项预览"
    - "三类预览经 IMultiSelectItem 的可选字段（thumbnail / audio / animation）下发给共享弹窗，普通多选弹窗缺省时行为不变"
    - "blob: 地址在弹窗结束（确认 / 取消）时统一 revokeObjectURL 回收；迟到的加载结果按请求令牌自回收，不泄漏"
    - "素材能力 Provider 复用既有 CapabilityProvider：补 asset 字段、与上层能力包合并，而不是另造一套 Provider"

key-files:
  created:
    - packages/libs/editor-impl/src/asset/picker/assetPickerItems.ts
    - packages/libs/editor-impl/src/asset/assetCapabilityProvider.tsx
    - packages/libs/editor-impl/src/asset/picker/index.ts
    - packages/libs/editor-impl/src/asset/__tests__/assetPicker.test.tsx
  modified:
    - packages/libs/editor-impl/src/asset/types.ts
    - packages/libs/editor-impl/src/asset/index.ts
    - packages/libs/editor-impl/src/react/types.ts
    - packages/libs/editor-impl/src/react/components/MultiSelectModal.tsx
    - packages/libs/editor-impl/src/react/components/CapabilityProvider.tsx
    - packages/libs/editor-impl/src/react/modal.css

key-decisions:
  - "loadPickerItems 先用 listDirectory 核对列表文件是否存在（缺失按空列表），再读正文——与 AssetPanel.loadCategory 同款，资源层读不到的文件会抛错、无法区分「不存在」与「读取失败」"
  - "blob 字节用 bytes.slice() 再建 Blob：Uint8Array<ArrayBufferLike> 不能直接作 BlobPart（typecheck 要求 ArrayBufferView<ArrayBuffer>），与既有 useAssetObjectUrl 写法一致"
  - "CapabilityProvider 重建能力对象时写成「provided 显式给出 ?? 上层已有 ?? 本层默认打开器」的合并语义；asset 同款合并，满足「嵌套 Provider 不互相吞掉能力」"
  - "AssetCapabilityProvider 用请求令牌丢弃过期加载结果：取消后迟到的候选项其 blob 地址就地 revokeObjectURL，避免泄漏（T-03-37）"
  - "三类预览渲染挂在共享 MultiSelectModal 上（thumbnail 补 test-id、audio 内联 <audio controls>、animation 文本提示），既有加载 / 错误 / 空 / 列表优先级与 .eimodal-* 结构不动"

patterns-established:
  - "素材选择器 = 既有多选弹窗壳 + 素材专属预览字段；调用方（表格 / Blockly）只经 ITableEditorCapabilities.asset.picker 取用，不重复实现弹窗"
  - "装配方包一层 AssetCapabilityProvider 即得可用选择器；显式注入 picker 优先，缺省时用默认实现"

requirements-completed: [ASSET-01]

coverage:
  - id: D1
    description: "候选项加载器：按分类读列表（与面板同一套模型），图片生成 blob 缩略图、音频生成 blob 试听、动画置预览提示、字体无预览，返回候选项与需回收的 blob 地址"
    requirement: "ASSET-01"
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/__tests__/assetPicker.test.tsx（图片 / 音频 / 动画三类预览 + 空列表 + 非法正文，5 用例）"
        status: pass
      - kind: other
        ref: "结构检查（loadPickerItems / readAssetList / parseTableText / resolveAssetBytePath / createObjectURL / 三类 AssetCategoryKind 齐备；无 document）+ pnpm --filter @motajs/editor-impl typecheck（退出码 0）"
        status: pass
    human_judgment: false
  - id: D2
    description: "共享弹窗与能力包的预览渲染与透传：MultiSelectModal 按 thumbnail / audio / animation 渲染三类预览；CapabilityProvider 补 asset 字段并与上层能力合并"
    requirement: "ASSET-01"
    verification:
      - kind: integration
        ref: "pnpm --filter @motajs/editor-impl test（34 files / 272 tests 通过——含既有 modals.test.tsx 的能力 Provider 用例）"
        status: pass
      - kind: other
        ref: "结构检查（MultiSelectModal 三类 test-id 与 item.audio / item.animation；CapabilityProvider 含 asset: provided?.asset 与 useTableCapabilities）"
        status: pass
    human_judgment: false
  - id: D3
    description: "默认素材选择器 Provider：包一层即可用，确认 / 取消都结束 Promise 并回收 blob 地址，显式注入的选择器优先"
    requirement: "ASSET-01"
    verification:
      - kind: integration
        ref: "packages/libs/editor-impl/src/asset/__tests__/assetPicker.test.tsx（确认解析选中 id / 取消解析 null 并回收 blob / 注入优先，3 用例）"
        status: pass
      - kind: other
        ref: "node scripts/verify/coreBoundaries.js + coreModuleState.js + coreEngineNeutral.js 均退出码 0"
        status: pass
    human_judgment: false

duration: 14min
completed: 2026-10-18
status: complete
---

# Phase 3 Plan 12: 默认素材选择器 Summary

**给表格 / 未来的 Blockly 一个「选素材」弹窗——按分类列素材、图片给缩略图、音频能内联试听、动画给预览提示，多选后返回选中的素材名；装配方只要在既有能力那层外面包一层素材能力 Provider 就能用。**

## Performance

- **Duration:** 约 14 min
- **Started:** 2026-10-18T15:08:23+08:00
- **Completed:** 2026-10-18T15:22:29+08:00
- **Tasks:** 3
- **Files modified:** 10（4 新建，6 修改）

## Accomplishments

- 新增 `asset/picker/assetPickerItems.ts` 的 `loadPickerItems(access, category)`：先 `listDirectory` 核对列表文件是否存在（缺失按空列表），`parseTableText` 解析正文（`Invalid` / `NeedsCommentStrip` 抛 `素材列表格式不正确`），`readAssetList` 得条目；逐条按分类种类补预览——图片读字节生成 `blob:` 缩略图、音频读字节生成 `blob:` 试听、动画置 `animation = true`、字体不加预览；单条读不到字节只跳过该项预览，不中断整份列表。返回 `{ items, objectUrls }`。
- `react/types.ts` 的 `IMultiSelectItem` 追加可选 `audio?`（试听地址）与 `animation?`（是否有动画预览）；`asset/types.ts` 新增 `IAssetPickerItems`（候选项 + 需回收的 `blob:` 地址）。
- `react/components/MultiSelectModal.tsx` 在候选项标签处按预览字段渲染：`thumbnail` → 带 `multiselect-thumb-<id>` 的 `<img>`、`audio` → 带 `multiselect-audio-<id>` 的内联 `<audio controls>`、`animation === true` → 带 `multiselect-anim-<id>` 的「动画」提示；三者缺省时普通多选行为不变，加载 / 错误 / 空 / 列表优先级与 `.eimodal-*` 结构不动。
- `react/components/CapabilityProvider.tsx` 补 `asset: provided?.asset` 并用 `useTableCapabilities()` 读上层能力包，重建时按「本次显式给出 ?? 上层已有 ?? 本层默认打开器」合并——「宿主 → 代码编辑器 Provider → 素材 Provider」这类嵌套不再互相吞掉能力。
- 新增 `asset/assetCapabilityProvider.tsx` 的 `AssetCapabilityProvider`：默认打开器按 `request.categoryId ?? 首个分类` 定位分类，找不到立即错误态「该分类不存在」，找到则先挂请求（加载态）再异步 `loadPickerItems`；用请求令牌丢弃过期结果并就地回收其 `blob:` 地址；渲染时用 `CapabilityProvider` 透传既有能力并补 `asset`，请求存在时挂共享 `MultiSelectModal`；确认 / 取消都 `resolve` 结束 Promise、清空请求、`revokeObjectURL` 回收本次地址。`asset/picker/index.ts` 与 `asset/index.ts` 汇总导出。
- 新增 `asset/__tests__/assetPicker.test.tsx` 八条用例全绿：图片缩略图 / 音频试听 / 动画提示 / 空态 / 错误态 / 确认返回选中名 / 取消回收 `blob:` 地址 / 注入选择器优先。

## Task Commits

Each task was committed atomically:

1. **Task 1: 候选项加载器（三类预览）** - `c6cbd20` (feat)
2. **Task 2: 素材能力 Provider、预览渲染、能力包透传与桶文件** - `8c7322f` (feat)
3. **Task 3: 选择器测试** - `f7235c2` (test)

**Plan metadata:** (本 SUMMARY 提交) (docs)

_Note: 本计划无 TDD 循环；三个任务各一次提交，无修订提交。_

## Files Created/Modified

- `packages/libs/editor-impl/src/asset/picker/assetPickerItems.ts` - 新：`loadPickerItems` 与两个私有辅助（`readAssetBytes` / `readListText`）、`buildPickerItem`
- `packages/libs/editor-impl/src/asset/picker/index.ts` - 新：`export * from './assetPickerItems';`
- `packages/libs/editor-impl/src/asset/assetCapabilityProvider.tsx` - 新：`AssetCapabilityProvider` / `IAssetCapabilityProviderProps` / 模块内 `findPickerCategory`
- `packages/libs/editor-impl/src/asset/__tests__/assetPicker.test.tsx` - 新：8 条集成用例 + `PickerHost` / `renderPicker` 测试宿主
- `packages/libs/editor-impl/src/asset/types.ts` - 改：追加 `IAssetPickerItems`
- `packages/libs/editor-impl/src/asset/index.ts` - 改：追加 `./picker` 与 `./assetCapabilityProvider` 桶导出
- `packages/libs/editor-impl/src/react/types.ts` - 改：`IMultiSelectItem` 追加 `audio?` / `animation?`
- `packages/libs/editor-impl/src/react/components/MultiSelectModal.tsx` - 改：候选项渲染三类预览（含 test-id）
- `packages/libs/editor-impl/src/react/components/CapabilityProvider.tsx` - 改：补 `asset` 字段并与上层能力包合并
- `packages/libs/editor-impl/src/react/modal.css` - 改：追加 `.eimodal-audio` / `.eimodal-anim` 样式

## Decisions Made

- **列表文件是否存在用目录列举核对。** 资源层 `requestResource` 对任意路径都返回句柄、读取时才抛错，无法把「不存在」与「读取失败」分开；故 `loadPickerItems` 先 `listDirectory(category.dir)` 拿路径集合，列表文件在才读——与 `AssetPanel.loadCategory` 同款。
- **Blob 前先 `bytes.slice()`。** `Uint8Array<ArrayBufferLike>` 不能直接作 `BlobPart`（typecheck 报 `ArrayBufferView<ArrayBuffer>` 不兼容），改用 `bytes.slice()`（返回 `Uint8Array<ArrayBuffer>`），与既有 `useAssetObjectUrl` 一致、行为不变。
- **能力包合并语义。** `CapabilityProvider` 重建时统一写成「provided 显式给出 → 上层 ambient → 本层默认」；多选 / 坐标的默认补齐仍在（`openMultiSelect` / `openPointSelect` 兜底），新增 `asset` 同款合并。
- **迟到加载结果就地回收。** `AssetCapabilityProvider` 用递增令牌标记每次打开；确认 / 取消时令牌自增使在途加载失效，迟到的 `blob:` 地址就地 `revokeObjectURL`（T-03-37）。
- **三类预览挂在共享弹窗上。** 不新造弹窗壳，只在 `MultiSelectModal` 上加三类预览渲染（`thumbnail` / `audio` / `animation`），普通多选缺省行为不变。

## Deviations from Plan

None - plan executed exactly as written.

（任务 1 首次 typecheck 因 `new Blob([bytes])` 报 `Uint8Array<ArrayBufferLike>` 不兼容而改用 `bytes.slice()`；这是把计划写的字面写法调成能通过类型检查的等价写法，未改任何对外签名或行为，不构成偏离。）

## Issues Encountered

- **jsdom 的 `window.getComputedStyle` 报错** 是 antd 弹层在测试环境下的既有噪声（与 asset 无关），不影响 8/8 与全量 272/272 通过。
- **首次结构检查缺 `AssetCategoryKind.Audio` 字面量**：加载器起初用三元把音频并进 else 分支，`assetPickerItems.ts` 里没有显式 `AssetCategoryKind.Audio` 字样；改为显式 `if (category.kind === AssetCategoryKind.Audio)` 分支后通过（同时让三分类分支更清晰）。

## User Setup Required

None - 本计划为编辑器默认实现层的实现与集成测试，无外部服务、环境变量或依赖安装。

## Known Stubs

None - 三类预览、错误 / 空 / 加载态、确认 / 取消、注入优先均有可运行实现与断言，无占位、无 TODO、无空数据源。

## Threat Flags

None - 未新增网络端点、鉴权路径或文件访问。威胁登记表中 T-03-36（候选项标签经 React 文本节点渲染、Provider 无 `dangerouslySetInnerHTML`）与 T-03-37（确认 / 取消与迟到结果均 `revokeObjectURL`）已以实现与测试落地；T-03-38（大分类一次性读全部缩略图）按登记 `accept`。

## Next Phase Readiness

- 默认选择器经 `ITableEditorCapabilities.asset.picker` 可被表格 / Blockly 经接缝调用；`AssetCapabilityProvider` 提供「包一层即用」的装配形态，显式注入优先。
- 03-13（字节生命周期）、03-14（配置表单）、03-16（转码）可直接复用面板与模型层；本计划未改动 `asset` 的跨能力依赖（仍只依赖 `../react` 与 `../shared`）。
- 四道门禁（typecheck、coreBoundaries、coreModuleState、coreEngineNeutral）与全量 `editor-impl` 测试（34 files / 272 tests）本次均绿；无阻塞。

---

## Self-Check: PASSED

- FOUND: packages/libs/editor-impl/src/asset/picker/assetPickerItems.ts
- FOUND: packages/libs/editor-impl/src/asset/picker/index.ts
- FOUND: packages/libs/editor-impl/src/asset/assetCapabilityProvider.tsx
- FOUND: packages/libs/editor-impl/src/asset/__tests__/assetPicker.test.tsx
- FOUND: packages/libs/editor-impl/src/asset/types.ts
- FOUND: packages/libs/editor-impl/src/asset/index.ts
- FOUND: packages/libs/editor-impl/src/react/types.ts
- FOUND: packages/libs/editor-impl/src/react/components/MultiSelectModal.tsx
- FOUND: packages/libs/editor-impl/src/react/components/CapabilityProvider.tsx
- FOUND: packages/libs/editor-impl/src/react/modal.css
- FOUND commit: c6cbd20 (Task 1)
- FOUND commit: 8c7322f (Task 2)
- FOUND commit: f7235c2 (Task 3)

*Phase: 03-asset*
*Completed: 2026-10-18*
