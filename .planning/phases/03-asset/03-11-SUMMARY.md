---
phase: 03-asset
plan: 11
subsystem: editor-impl-asset
tags: [typescript, react, antd, asset, panel, view-layer, css, blob-url, ui-states]

# Dependency graph
requires:
  - phase: 03-asset
    provides: "面板数据层 AssetPanel（IAssetPanelViewState / AssetPanelStatus / 读分类 + 手动保存 + 屏障登记）/ asset 域类型（IAssetCategory / IAssetEntry / AssetCategoryKind）/ 分类与列表路径模型"
provides:
  - "素材面板视图层：AssetPanelView（三栏布局 + 状态分发）/ AssetToolbar / CategoryNav / AssetGrid / AssetDetail / AssetPreview"
  - "useAssetObjectUrl（字节 → 可回收 blob: 地址）"
  - "asset/asset.css（面板作用域样式：--editor-* 消费 + --easset-* 遗留色）"
  - "asset/__tests__/assetView.test.tsx（11 条直接渲染用例）"
  - "AssetPanel.render() 返回真实三栏界面（订阅 store，把回调转发到数据层）"
affects: [03-12, 03-13, 03-14, 03-16, 03-17]

actuals:
  tokens: 8400
  tasks: 3
  commits: 3
  plan_head_before: 28caf454794ccb6b2974b515a28dc420f1aaccc2

tech-stack:
  added: []
  patterns:
    - "视图层是纯 props 驱动的 React 组件（不读 IEditorPanelContext、不读 core）：数据与回调全由 AssetPanel 传入，便于直接 render 断言"
    - "图片 / 音频预览走 useAssetObjectUrl：字节经 loadBytes 回调给出，依赖变化 / 卸载时 revokeObjectURL；调用方用 key=路径 触发换源"
    - "面板容器组件（AssetPanelContainer）订阅 store 并渲染 AssetPanelView；AssetPanel.render() 只做数据 → props 映射"
    - "面板状态在根节点暴露 data-status（no-category/loading/ready/empty/error），网格卡片暴露 asset-card-<name> + data-exists，供数据层与视图测试观察"

key-files:
  created:
    - packages/libs/editor-impl/src/asset/components/AssetPanelView.tsx
    - packages/libs/editor-impl/src/asset/components/AssetToolbar.tsx
    - packages/libs/editor-impl/src/asset/components/CategoryNav.tsx
    - packages/libs/editor-impl/src/asset/components/AssetGrid.tsx
    - packages/libs/editor-impl/src/asset/components/AssetDetail.tsx
    - packages/libs/editor-impl/src/asset/components/AssetPreview.tsx
    - packages/libs/editor-impl/src/asset/components/useAssetObjectUrl.ts
    - packages/libs/editor-impl/src/asset/components/index.ts
    - packages/libs/editor-impl/src/asset/asset.css
    - packages/libs/editor-impl/src/asset/__tests__/assetView.test.tsx
  modified:
    - packages/libs/editor-impl/src/asset/assetPanel.ts
    - packages/libs/editor-impl/src/asset/__tests__/assetPanel.test.tsx

key-decisions:
  - "状态呈现全部在 AssetPanelView 内部：加载 / 空 / 错误是固定块，就绪才渲染网格 + 详情；未选中详情由 AssetDetail 给「选择一个素材查看详情」"
  - "转码开关按分类 kind 计算（仅图片 / 音频可用）；加载 / 无分类时保存与新增禁用，避免空操作"
  - "选中素材不新增面板公有方法：容器回调里直接 setState 更新 selectedName，避开新增未确认的命名"
  - "预览字节经 IResource.requestBinary() 读取，失败 / 不存在都返回 undefined，交由 AssetPreview 显示占位而不破图"
  - "useAssetObjectUrl 把 loadBytes 放进 ref、效果只依赖 mime，配合 AssetPreview 的 key=路径 换源，避免函数身份变化导致的重复拉取"

patterns-established:
  - "素材面板视图 = AssetToolbar(32px) + CategoryNav(184px) + 网格(唯一滚动区) + 详情(320px)；窄面板 980px 隐藏详情、导航收窄 152px"
  - "卡片 / 详情 / 预览的 test-id 命名族：asset-toolbar-* / asset-category-* / asset-card-* / asset-detail-* / asset-state-* / asset-preview-*"
  - "所有素材名 / 路径 / 提示经 React 文本节点与 title 属性渲染，绝不 dangerouslySetInnerHTML"

requirements-completed: [ASSET-01]

coverage:
  - id: D1
    description: "三栏面板外壳：工具栏（保存 / 瘦身转码 / 新增素材）+ 分类导航（当前项 aria-current）+ 加载 / 空 / 错误 / 未选中四种状态与 UI-SPEC 固定文案"
    requirement: "ASSET-01"
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/__tests__/assetView.test.tsx（④ 加载态 + 禁用、⑤ 空态两句、⑥ 错误态 + 重试、⑨ 分类 aria-current、⑩ 动画分类禁转码、⑪ 尚无可用分类）+ 结构检查（四处 asset-state-* 与文案齐备、无 dangerouslySetInnerHTML）"
        status: pass
      - kind: other
        ref: "pnpm --filter @motajs/editor-impl typecheck（退出码 0）"
        status: pass
    human_judgment: false
  - id: D2
    description: "素材网格与卡片：自适应列卡片列表，选中 is-selected、缺失 is-missing + 缺失标记，名称单行省略 + title"
    requirement: "ASSET-01"
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/__tests__/assetView.test.tsx（① 卡片数与 title、② is-selected、③ is-missing + 缺失标记）"
        status: pass
    human_judgment: false
  - id: D3
    description: "详情 / 预览栏：名称（可换行）/ 路径（单行省略）/ 缺失提示 / 按分类分流预览（位图 pixelated / 内联播放器 / 字体样例 / 动画占位）/ 操作行三按钮；字节拿不到显示占位"
    requirement: "ASSET-01"
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/__tests__/assetView.test.tsx（⑦ 未选中引导、⑧ 名称 + 路径 + 三个操作按钮）+ 结构检查（pixelated / audio / 魔塔 Mota 0123456789 / asset-preview-missing）"
        status: pass
    human_judgment: false
  - id: D4
    description: "面板接线：AssetPanel.render() 返回订阅 store 的真实视图，loadBytes 走 requestBinary；asset.css 落地面板作用域样式与关键尺寸"
    requirement: "ASSET-01"
    verification:
      - kind: integration
        ref: "packages/libs/editor-impl/src/asset/__tests__/assetPanel.test.tsx（7 tests，经 core 打开面板渲染出 asset-panel + data-status + 卡片）+ pnpm --filter @motajs/editor-impl test -- src/asset（7 files / 73 tests 通过）"
        status: pass
      - kind: other
        ref: "结构检查（asset.css 含四个 --easset-* 变量与 116px/184px/320px/980px；assetPanel.ts 含 import './asset.css' / AssetPanelView / requestBinary / useStore）+ pnpm --filter @motajs/editor-impl test（33 files / 264 tests 通过）+ coreBoundaries.js / coreModuleState.js / coreEngineNeutral.js（均退出码 0）"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-10-18
status: complete
---

# Phase 3 Plan 11: 素材面板视图层 Summary

**把素材面板数据层接到界面上：三栏布局（分类导航 184px + 素材网格 + 详情 320px）、工具栏三个动作、分类导航 `aria-current`、卡片网格的选中 / 缺失态、按分类分流的详情预览，以及加载 / 空 / 错误 / 未选中四种状态——全部是 props 驱动的纯组件，文案逐字对齐 UI-SPEC。**

## Performance

- **Duration:** 约 25 min
- **Started:** 2026-10-18T06:36:00Z
- **Completed:** 2026-10-18T07:01:30Z
- **Tasks:** 3
- **Files modified:** 12（10 新建，2 修改）

## Accomplishments

- `asset/components/` 新建六个视图组件：`AssetPanelView`（工具栏 + 三栏主体 + 状态分发）、`AssetToolbar`（保存 / 瘦身转码 / 新增素材，加载时禁用、非图片 / 音频分类禁转码）、`CategoryNav`（注入顺序、当前项 `aria-current` + `is-selected`、空态「尚无可用分类」）、`AssetGrid`（真实 `<button>` 卡片，`is-selected` / `is-missing` / 缺失标记 / 名称单行省略 + `title`）、`AssetDetail`（未选中给「选择一个素材查看详情」；选中给名称 / 路径 / 缺失提示 / 预览 / 替换·删除·配置）、`AssetPreview`（位图 `pixelated` / `<audio controls>` / 字体样例「魔塔 Mota 0123456789」/ 动画占位；字节拿不到显示占位而不破图）。
- `asset/components/useAssetObjectUrl.ts` 新建：把延迟读取的字节变成可回收的 `blob:` 地址，依赖变化 / 卸载时 `revokeObjectURL`；`loadBytes` 放 ref、效果只依赖 `mime`，调用方用 `key=路径` 换源。
- `asset/asset.css` 新建：面板作用域样式，消费 `--editor-*`（带字面量 fallback）并定义四个 `--easset-*` 遗留色；工具栏 32px、导航 184px、网格 `repeat(auto-fill, minmax(116px, 1fr))` 唯一滚动、卡片 112px + 缩略图 64×56、详情 320px + 预览最大 360px、窄面板 980px 隐藏详情并把导航收窄 152px。
- `asset/assetPanel.ts` 接线：占位视图换成 `AssetPanelContainer`（`useStore` 订阅 → `AssetPanelView`），回调转发到 `selectCategory` / `save` / `loadCategory`，`loadBytes` 走 `context.requestResource` + `resource.requestBinary()`（失败返回 `undefined`），文件顶部 `import './asset.css'`。
- `asset/__tests__/assetView.test.tsx` 新建 11 条用例：直接渲染 `AssetPanelView`（不经 core）覆盖卡片数 / `title`、`is-selected`、`is-missing` + 缺失标记、加载态文案 + 按钮禁用、空态两句、错误态文案 + 重试回调、未选中引导、选中详情三按钮、分类 `aria-current`、动画分类禁转码、无分类文案。

## Task Commits

Each task was committed atomically:

1. **Task 1: 视图骨架、工具栏、分类导航** - `06b1f92` (feat)
2. **Task 2: 素材网格、详情、预览与图片地址 hook** - `68f9e02` (feat)
3. **Task 3: 样式表、面板接线与渲染测试** - `ac0373d` (feat)

**Plan metadata:** (本 SUMMARY 提交) (docs)

## Files Created/Modified

- `asset/components/AssetPanelView.tsx` - 新：面板外壳，三栏布局 + 状态分发 + 就绪态渲染网格 / 详情
- `asset/components/AssetToolbar.tsx` - 新：顶部工具栏（保存 / 瘦身转码 / 新增素材）
- `asset/components/CategoryNav.tsx` - 新：左侧分类导航（`aria-current`、空态文案）
- `asset/components/AssetGrid.tsx` - 新：素材卡片网格（选中 / 缺失态、名称省略 + `title`）
- `asset/components/AssetDetail.tsx` - 新：右侧详情（名称 / 路径 / 缺失提示 / 预览 / 操作行）
- `asset/components/AssetPreview.tsx` - 新：按分类分流预览 + 字节缺失占位
- `asset/components/useAssetObjectUrl.ts` - 新：字节 → 可回收 `blob:` 地址
- `asset/components/index.ts` - 新：七个模块的 `export *` 桶
- `asset/asset.css` - 新：面板作用域样式与四个 `--easset-*` 遗留色
- `asset/__tests__/assetView.test.tsx` - 新：11 条直接渲染用例
- `asset/assetPanel.ts` - 改：`import './asset.css'`，占位视图换成 `AssetPanelContainer` + `AssetPanelView` 接线
- `asset/__tests__/assetPanel.test.tsx` - 改：数据层集成用例的查询选择器从占位 `asset-entry-*` 改为 `asset-card-*`

## Decisions Made

- **视图纯 props 驱动。** 六个组件都不读 `IEditorPanelContext`、不读 core；数据 + 回调全由 `AssetPanel` 经容器组件传入，因此 11 条用例可直接 render 断言，不经 core。见 key_links 契约。
- **选中素材不新增面板公有方法。** 计划未确认 `AssetPanel.selectAsset` 这类新名字，故容器回调里直接 `setState({ ...state, selectedName })` 更新选中；避免引入未经确认的导出命名。
- **预览字节失败一律 `undefined`。** `loadBytes` 把「文件不存在」与「读取失败」都收敛成 `undefined`，由 `AssetPreview` 显示占位；`AssetDetail` 另用条目的 `exists` 显示缺失提示，二者分工明确。
- **`useAssetObjectUrl` 用 ref 持有回调。** 效果只依赖 `mime`，靠 `AssetPreview` 的 `key={entry.path}` 触发换源，避免父级每次渲染产生新函数身份导致的重复拉取。
- **面板容器组件具名化。** 为保证 `react-hooks/rules-of-hooks` 通过，`useStore` 放进具名的 `AssetPanelContainer`（props = 订阅源 + 转发回调），而非匿名 `this.component`。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `AssetPanelView` 的就绪态内容在 Task 2 直接内联网格 / 详情**
- **Found during:** Task 2（素材网格、详情、预览）
- **Issue:** 计划 Task 1 让外壳先留一个 `children` 注入点、Task 2「补齐网格与详情」。但 Task 3 的 11 条用例要求**直接 render `AssetPanelView`** 就能断到卡片与详情（①–③、⑦–⑧），children 注入无法满足。
- **Fix:** Task 1 按计划用 `children` 注入落地外壳；Task 2 建好 `AssetGrid` / `AssetDetail` 后，把 `AssetPanelView` 的就绪态分支改为直接渲染二者（去掉 `children` 与 `ReactNode` 依赖）。
- **Files modified:** `packages/libs/editor-impl/src/asset/components/AssetPanelView.tsx`
- **Verification:** `assetView.test.tsx` 11/11 通过；`typecheck` 退出码 0。
- **Committed in:** `68f9e02`

**2. [Rule 1 - Bug] 03-10 集成用例的查询选择器随占位视图一并更新**
- **Found during:** Task 3（样式表、面板接线与渲染测试）
- **Issue:** 真界面替换占位后不再输出 `asset-entry-<name>` / `data-exists`（改为卡片 `asset-card-<name>` + `data-exists`），`assetPanel.test.tsx` 的 `entryNames` / `entryExists` 失去匹配，`src/asset` 会变红。
- **Fix:** 把 `entryNames` 改为 `button[data-test-id^="asset-card-"]`、`entryExists` 改为按 `button[data-test-id="asset-card-<name>"]` 读 `data-exists`；`panelStatus` 依赖的根节点 `data-status` 由 `AssetPanelView` 保留，无需改动。
- **Files modified:** `packages/libs/editor-impl/src/asset/__tests__/assetPanel.test.tsx`
- **Verification:** `assetPanel.test.tsx` 7/7；`pnpm --filter @motajs/editor-impl test -- src/asset` 7 files / 73 tests 通过。
- **Committed in:** `ac0373d`

**3. [Rule 1 - Bug] `new Blob([bytes])` 在 TS 5.9 下类型不通过**
- **Found during:** Task 2（`useAssetObjectUrl` 首次 typecheck）
- **Issue:** `Uint8Array<ArrayBufferLike>` 不可赋给 `BlobPart`（`ArrayBufferView<ArrayBuffer>`）——`tsc` 报 TS2322。
- **Fix:** 改用 `new Blob([bytes.slice()], ...)`（`slice()` 产出 `ArrayBuffer` 背书的拷贝），与仓内既有 `imageWebp.ts` / `audioOpus.ts` 写法一致。
- **Files modified:** `packages/libs/editor-impl/src/asset/components/useAssetObjectUrl.ts`
- **Verification:** `pnpm --filter @motajs/editor-impl typecheck` 退出码 0。
- **Committed in:** `68f9e02`

**4. [Rule 1 - Lint] `useStore` 落进匿名 `this.component` 触发 hooks 规则**
- **Found during:** Task 3（提交前 eslint）
- **Issue:** `react-hooks/rules-of-hooks` 报 `useStore` 被调用在既非组件也非自定义 Hook 的函数里（匿名箭头赋给 `this.component`，名字小写）。
- **Fix:** 抽出具名模块组件 `AssetPanelContainer`（props = `store` + 转发回调）承载 `useStore` 与 `createElement(AssetPanelView, ...)`；`this.component` 只负责造 props 对象。
- **Files modified:** `packages/libs/editor-impl/src/asset/assetPanel.ts`
- **Verification:** `npx eslint` 对 asset 组件 / assetPanel.ts / 两个测试文件 0 error；`typecheck` 退出码 0；`src/asset` 73/73。
- **Committed in:** `ac0373d`

---

**Total deviations:** 4 auto-fixed（2 × Rule 1：占位选择器同步 / Blob 类型；1 × Rule 1：hooks 规则；1 × Rule 3：就绪态内联网格与详情）。
**Impact on plan:** 四条都是让「真界面替换占位」这一步既过类型又过 hooks / 测试门禁的必要修复；不改任何对外组件名、props 名或 test-id 命名族，与 `INTERFACE-NAME.md` §03-11 一致。

## Issues Encountered

- 无阻塞。`src/asset` 与全量 `editor-impl` 测试均一次跑绿；三次 `coreBoundaries.js` / `coreModuleState.js` / `coreEngineNeutral.js` 门禁均退出码 0（`coreModuleState` 真实树 149 个文件受限规则 error 级 0 条；`coreEngineNeutral` 98 个生产文件 0 违规）。
- 视图用例一律传「永为 undefined」的 `loadBytes`，因此 jsdom 下不触发 `URL.createObjectURL`，无需额外桩件。

## User Setup Required

None - 纯视图层实现与渲染测试，无外部服务、环境变量或依赖安装。

## Next Phase Readiness

- 视图层就位：03-12（选择器）可复用 `AssetPreview` / `useAssetObjectUrl` 的预览分流；03-13（字节生命周期）把 `AssetToolbar.onAddAsset` / `AssetDetail.onReplace` / `onDelete` 由「无参回调」改成接收 `IAssetUpload` 并接到 `AssetPanel.addAsset` / `replaceAsset` / `deleteAsset`；03-14（配置表单）用 `AssetDetail.onOpenConfig` 进入配置模式并在主区渲染复用表格引擎；03-16（转码）接 `AssetToolbar.onTranscode`。
- 未接线：`onTranscode` / `onAddAsset` / `onReplace` / `onDelete` / `onOpenConfig` 目前在 `AssetPanel` 未实现对应方法，容器未传，按钮点了不产生动作（符合本计划范围；由后续计划补齐）。`asset/index.ts` 尚未 `export * from './components'`（按计划属 03-14）。
- 无阻塞。

---

## Self-Check: PASSED

- FOUND: packages/libs/editor-impl/src/asset/components/AssetPanelView.tsx
- FOUND: packages/libs/editor-impl/src/asset/components/AssetToolbar.tsx
- FOUND: packages/libs/editor-impl/src/asset/components/CategoryNav.tsx
- FOUND: packages/libs/editor-impl/src/asset/components/AssetGrid.tsx
- FOUND: packages/libs/editor-impl/src/asset/components/AssetDetail.tsx
- FOUND: packages/libs/editor-impl/src/asset/components/AssetPreview.tsx
- FOUND: packages/libs/editor-impl/src/asset/components/useAssetObjectUrl.ts
- FOUND: packages/libs/editor-impl/src/asset/components/index.ts
- FOUND: packages/libs/editor-impl/src/asset/asset.css
- FOUND: packages/libs/editor-impl/src/asset/__tests__/assetView.test.tsx
- FOUND commit: 06b1f92 (Task 1)
- FOUND commit: 68f9e02 (Task 2)
- FOUND commit: ac0373d (Task 3)

*Phase: 03-asset*
*Completed: 2026-10-18*
