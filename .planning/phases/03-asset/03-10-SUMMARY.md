---
phase: 03-asset
plan: 10
subsystem: editor-impl-asset
tags: [typescript, asset, panel, resource-layer, jsonc, manual-save, undo-barrier]

# Dependency graph
requires:
  - phase: 03-asset
    provides: "asset 域类型（IAssetPanel / IAssetPanelViewState / AssetPanelStatus / AssetUndoType）/ 中立 `.jsonc` 编解码 shared/jsonc（parseTableText / serializeTableText）/ 模型层（readAssetList / writeAssetList / resolveAssetBytePath）/ `@motajs/editor-impl/shared` 子路径"
provides:
  - "素材面板数据层 AssetPanel（读分类 / 内存改动 / 手动保存保留前缀 / 屏障登记 / 配置回放）"
  - "面板类型工厂 createAssetPanelType(capabilities) 与常量 ASSET_PANEL_TYPE_ID（冻结的 IEditorPanelType，id 'asset'）"
  - "asset/__tests__/fixtures.ts（自持 FakeFileSystem + createAssetHarness + 四个测试分类 + listText）与 7 条集成用例"
affects: [03-11, 03-12, 03-13, 03-14, 03-16, 03-17]

actuals:
  tokens: 7934
  tasks: 3
  commits: 4
plan_head_before: d1bad8accf76a9157545d9e4368650dd235cbe4a

tech-stack:
  added: []
  patterns:
    - "面板手动保存：改动先留内存、只有 save() 写盘；未落盘时再读一次直接返回，保住内存改动（沿用表格）"
    - "资源层读不到的文件会抛错，无法区分「不存在」与「读取失败」，故先 listDirectory 核对列表文件是否存在（缺失按空分类）——与 TablePanel.fileExists 同款"
    - "列表文件写回一律经 serializeTableText，系统前缀逐字保留；不出现任何直接 JSON.stringify 写盘"
    - "面板类型用工厂把分类清单闭包进去（core 创建面板时不传能力），仍是顶层注册一个 IEditorPanelType"

key-files:
  created:
    - packages/libs/editor-impl/src/asset/assetPanel.ts
    - packages/libs/editor-impl/src/asset/assetPanelType.ts
    - packages/libs/editor-impl/src/asset/__tests__/fixtures.ts
    - packages/libs/editor-impl/src/asset/__tests__/assetPanel.test.tsx
  modified:
    - packages/libs/editor-impl/src/asset/index.ts

key-decisions:
  - "IAssetPanel 从 ./types 导入、不重复声明；本地只声明模块私有的 IAssetPanelState（与 IAssetConfigUndoData）"
  - "列表文件是否存在用 listDirectory 核对而非依赖 requestResource 返回 null——资源层对任意路径都返回句柄、读取时才抛错，只有先列目录才能把「缺失」与「读取失败」分开（T-03-30/T-03-31）"
  - "配置撤销先落一个「按 data 回放」的最小实现：redo 应用 data.next、undo 应用 data.previous，载荷含 categoryId / name / path / previous / next，03-14 接上真实入口后沿用同一形状"
  - "占位视图除 data-test-id 外额外暴露 data-status 与逐条 asset-entry-<name> / data-exists，使数据层可被集成测试观察（03-11 用真界面替换）"
  - "面板类型工厂内联 id: 'asset' 字面量并另导出 ASSET_PANEL_TYPE_ID（按计划 Task 2 的形状）；isAssetPanelTarget 模块内私有（与 tablePanelType 的 isTablePanelTarget 一致）"

patterns-established:
  - "素材面板读一个分类 = 先 listDirectory(分类目录) 拿路径集合 → 有 .list.jsonc 才读并解析 → 逐条算 exists；列表为空/缺失都落 Empty 而非 Error"
  - "能力包不自行装配进 core：面板类型由装配方经 createAssetPanelType(注入分类) 造出并注册"

requirements-completed: [ASSET-01]

coverage:
  - id: D1
    description: "面板数据层：切分类读列表与目录、算字节文件是否存在、改动留内存、手动保存逐字保留前缀、登记屏障撤销条目、配置按 data 回放"
    requirement: "ASSET-01"
    verification:
      - kind: integration
        ref: "packages/libs/editor-impl/src/asset/__tests__/assetPanel.test.tsx（7 tests：读取 / 缺字节 / 空 / 非法 / 保存保留前缀 / 未落盘守卫 / 工厂注册渲染）"
        status: pass
      - kind: other
        ref: "结构检查（类声明 implements IEditorPanel, IAssetPanel + loadCategory/selectCategory/registerBarrier/registerConfigUndo/serializeTableText/parseTableText/listDirectory/data-test-id 齐备；未重声明 IAssetPanel、无原生对话框、无 asset→table import）+ pnpm --filter @motajs/editor-impl typecheck（退出码 0）"
        status: pass
    human_judgment: false
  - id: D2
    description: "面板类型工厂：createAssetPanelType 返回冻结的 IEditorPanelType（id 'asset' / name 素材管理器），opaque open-param 经守卫后才 setTarget"
    requirement: "ASSET-01"
    verification:
      - kind: other
        ref: "结构检查（createAssetPanelType / isAssetPanelTarget / createElement / Object.freeze / ASSET_PANEL_TYPE_ID / 素材管理器 / id: 'asset' 齐备）+ pnpm --filter @motajs/editor-impl typecheck（退出码 0）"
        status: pass
    human_judgment: false
  - id: D3
    description: "自持测试替身与集成用例：内存文件系统 + 已初始化 core + 四个测试分类 + 带系统前缀的列表文本工具"
    requirement: "ASSET-01"
    verification:
      - kind: integration
        ref: "pnpm --filter @motajs/editor-impl test -- src/asset/__tests__/assetPanel.test.tsx（7/7 通过）；pnpm --filter @motajs/editor-impl test（32 files / 253 tests 通过）"
        status: pass
      - kind: other
        ref: "node scripts/verify/coreBoundaries.js（真实树 0 违规、能力互斥与依赖方向两极性）退出码 0"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-10-18
status: complete
---

# Phase 3 Plan 10: 素材面板数据层 Summary

**把素材面板的数据层做出来——切分类读列表与目录、算出每条素材的字节文件是否存在、改动只留内存、点保存才按 `serializeTableText` 写回（逐字保留 `.jsonc` 系统前缀）、字节改动登记成不可撤销的屏障；界面留到 03-11。**

## Performance

- **Duration:** 约 15 min
- **Started:** 2026-10-18T14:02:00Z
- **Completed:** 2026-10-18T14:17:00Z
- **Tasks:** 3
- **Files modified:** 5（4 新建，1 修改）

## Accomplishments

- `asset/assetPanel.ts` 新建 `AssetPanel implements IEditorPanel, IAssetPanel`：`loadCategory` 读一个分类（先 `listDirectory(分类目录)` 拿路径集合，列表文件在则读并经 `parseTableText` 分流——`Conforming` 记住 `prefix`、`Invalid`/`NeedsCommentStrip` 进错误态；`readAssetList` 取条目，格式异常进错误态；逐条 `resolveAssetBytePath` 算 `exists`；0 条 → `Empty`，否则 `Ready`；异常一律捕获后进错误态不抛穿）；`save` 只写未落盘分类、写回路径经 `serializeTableText(document, prefix)`（资源在则 `write`、不在则 `createResource`）；`registerBarrier` 登记带 `barrier: true` 的条目、`registerConfigUndo` 登记普通可撤销条目；`undo`/`redo` 按 `data` 回放配置改动。
- `asset/assetPanelType.ts` 新建 `createAssetPanelType(capabilities)`：返回 `Object.freeze` 的 `IEditorPanelType`（`id: 'asset'`、`name: '素材管理器'`、自包含内联 SVG 图标），`create` 里把注入分类闭包进 `AssetPanel`，并用模块私有的 `isAssetPanelTarget` 守卫 opaque open-param 后才 `setTarget`；另导出 `ASSET_PANEL_TYPE_ID = 'asset'`。
- `asset/index.ts` 追加 `export * from './assetPanel'` 与 `'./assetPanelType'`；`./asset` 子路径对外导出面含面板类与工厂。
- `asset/__tests__/fixtures.ts` 自持一份 `FakeFileSystem`（与表格侧同形但不借用，满足能力互不依赖）+ `createAssetHarness` + 四个测试分类（图片/音频 `ObjectList`、动画/字体 `StringList`）+ `ASSET_TEST_PREFIX` + `listText` 工具。
- `asset/__tests__/assetPanel.test.tsx` 7 条集成用例全绿：读取就绪 / 缺字节标 false / 列表缺失为空 / 正文非法为错误 / 保存保留前缀且含改动 / 未落盘不覆盖 / 经工厂注册后渲染出 `data-test-id="asset-panel"`。

## Task Commits

Each task was committed atomically:

1. **Task 1: 面板数据层** - `7aa2cf9` (feat)
2. **Task 2: 面板类型工厂与桶文件** - `2f25048` (feat)
3. **Task 3 前置修复：列表文件缺失按空分类处理** - `343b7e0` (fix)
4. **Task 3: 共享测试替身与面板集成测试** - `9c77873` (test)

**Plan metadata:** (本 SUMMARY 提交) (docs)

_Note: 本计划无 TDD 循环；`343b7e0` 是让 Task 3 用例 3（列表缺失 → Empty）成立的必要修复，见 Deviations。_

## Files Created/Modified

- `packages/libs/editor-impl/src/asset/assetPanel.ts` - 新：`AssetPanel` 数据层（`IAssetPanelState` / `IAssetConfigUndoData` 模块私有；占位视图 `AssetPanelPlaceholder`）
- `packages/libs/editor-impl/src/asset/assetPanelType.ts` - 新：`createAssetPanelType` / `ASSET_PANEL_TYPE_ID` / 内联 SVG 图标 / 模块私有 `isAssetPanelTarget`
- `packages/libs/editor-impl/src/asset/index.ts` - 改：追加 assetPanel / assetPanelType 两个桶导出
- `packages/libs/editor-impl/src/asset/__tests__/fixtures.ts` - 新：自持 `FakeFileSystem` / `createAssetHarness` / `ASSET_TEST_CATEGORIES` / `ASSET_TEST_PREFIX` / `listText`
- `packages/libs/editor-impl/src/asset/__tests__/assetPanel.test.tsx` - 新：7 条集成用例

## Decisions Made

- **列表文件是否存在用目录列举核对。** 资源层 `requestResource` 对任意路径都返回句柄、读取时才抛错，无法把「文件不存在」与「读取失败」分开；故 `AssetPanel.loadCategory` 先 `listDirectory(分类目录)` 拿路径集合，列表文件在才读——缺失按空分类（`Empty`）而非错误态，与 `TablePanel.fileExists` 同款。见 Deviations。
- **配置撤销先落最小回放。** 03-14 才接真实入口，本计划先让 `undo`/`redo` 按 `data` 直接回放（`redo` 用 `next`、`undo` 用 `previous`），载荷 `{ categoryId, name, path, previous, next }`；这也是集成用例 5/6 造「内存改动」的入口。
- **占位视图额外暴露状态与条目。** 除 `data-test-id="asset-panel"` 外给 `data-status` 与逐条 `asset-entry-<name>` / `data-exists`，让数据层可被集成测试观察；03-11 会用真正的三栏界面替换整块占位。
- **`isAssetPanelTarget` 模块内私有。** 与 `tablePanelType.ts` 的 `isTablePanelTarget` 一致（计划 Task 2 明确「不导出」；编排器 scope note 里写的「export」未采纳，以计划正文为准）。
- **工厂内联 `id: 'asset'`。** 按计划 Task 2 的形状在冻结对象里写 `id: 'asset'`，并另导出 `ASSET_PANEL_TYPE_ID` 供装配方引用（结构检查要求字面量 `id: 'asset'`）。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 列表文件缺失被当作读取失败（错误态），与「缺失按空分类」相悖**
- **Found during:** Task 3（集成用例 3：列表文件不存在 → `Empty`）
- **Issue:** 计划假设「`context.requestResource(listPath)` 为 null 即文件缺失」，但 `ResourceSystem.requestResource` 对任何路径都返回一个 `Resource` 句柄，真正的读取在 `resource.request()` 里经 `fs.readFile` 发生——文件不存在时抛错。原实现把它归入 `catch` → `Error` 态，用例 3 得到 `error` 而非 `empty`。
- **Fix:** `loadCategory` 改为先 `context.listDirectory(category.dir)` 取路径集合，列表文件在集合里才读；`buildEntries` 从 async 改同步并复用同一路径集合算 `exists`。缺失 → `Empty`，非法/读取失败 → `Error` 的语义因此分开。
- **Files modified:** `packages/libs/editor-impl/src/asset/assetPanel.ts`
- **Verification:** 用例 3 由 `error` 变为 `empty`；7/7 用例通过；`pnpm --filter @motajs/editor-impl typecheck` 退出码 0；`node scripts/verify/coreBoundaries.js` 退出码 0。
- **Committed in:** `343b7e0`

**2. [Rule 1 - Style] Prettier 排版**
- **Found during:** Task 3 收尾（`prettier --check` 新文件）
- **Issue:** `assetPanel.ts`（import 折行）与 `assetPanel.test.tsx` 未过 Prettier（`prettier/prettier: error` 由 ESLint 强制）。
- **Fix:** `prettier --write` 两文件。
- **Files modified:** `assetPanel.ts`、`assetPanel.test.tsx`
- **Verification:** `prettier --check` 五文件全绿。
- **Committed in:** `343b7e0`（assetPanel.ts）、`9c77873`（测试文件）

---

**Total deviations:** 2 auto-fixed（2 × Rule 1：1 语义修复 / 1 排版）
**Impact on plan:** 语义修复把「列表缺失」与「读取失败」正确分开，是计划验收标准（用例 3 为 `Empty`）成立的前提；不改任何对外方法签名与命名，与 `INTERFACE-NAME.md` §03-10 一致。

## Issues Encountered

- **`pnpm --filter @motajs/editor-impl test` 全量并行时 `src/table/__tests__/schemaMode.test.tsx` 一次 5s 超时。** 该文件单独跑 12/12 通过、全量再跑 32 files / 253 tests 全绿——属既有的满套件并行争用性抖动（与表格无关，本计划未触碰 `table`）。记入 `deferred-items.md`，不在本计划修复（SCOPE BOUNDARY）。
- **jsdom 的 `window.getComputedStyle` 报错** 是 antd 弹层在测试环境下的既有噪声（与 asset 无关），不影响 253/253 通过。

## User Setup Required

None - 本计划纯数据层实现与集成测试，无外部服务、环境变量或依赖安装。

## Next Phase Readiness

- 数据层就位：03-11（视图层）可直接消费 `AssetPanel.render()` 与 `IAssetPanelViewState`（占位视图将被三栏界面替换）；03-12（选择器）可复用 `AssetPanel.loadCategory` 的读分类路径；03-13（字节生命周期）经 `AssetPanel.registerBarrier` 登记屏障；03-14（配置表单）用 `AssetPanel.registerConfigUndo` / `undo` / `redo` 接上可撤销配置编辑；03-16（转码）用 `resolveTranscodedPath` + 屏障。
- `asset` 仍零跨能力 import（只依赖 `../react` 与 `../shared`）；`pnpm --filter @motajs/editor-impl typecheck`、`coreBoundaries.js`、`coreModuleState.js`（真实树 140 文件受限规则 error 级 0 条）、`coreEngineNeutral.js`（90 生产文件 0 违规）四道门禁本次均退出码 0。
- 无阻塞。

---

## Self-Check: PASSED

- FOUND: packages/libs/editor-impl/src/asset/assetPanel.ts
- FOUND: packages/libs/editor-impl/src/asset/assetPanelType.ts
- FOUND: packages/libs/editor-impl/src/asset/index.ts
- FOUND: packages/libs/editor-impl/src/asset/__tests__/fixtures.ts
- FOUND: packages/libs/editor-impl/src/asset/__tests__/assetPanel.test.tsx
- FOUND commit: 7aa2cf9 (Task 1)
- FOUND commit: 2f25048 (Task 2)
- FOUND commit: 343b7e0 (Task 3 fix)
- FOUND commit: 9c77873 (Task 3)

*Phase: 03-asset*
*Completed: 2026-10-18*
