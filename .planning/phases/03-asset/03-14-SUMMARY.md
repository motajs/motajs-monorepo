---
phase: 03-asset
plan: 14
subsystem: editor-impl-asset
tags: [typescript, react, antd, asset, config-form, schema-form, undo, integration-test]

# Dependency graph
requires:
  - phase: 03-asset
    provides: "中立表单渲染层 shared/schemaForm/components（TableGrid / TablePanelStatus / 行内控件）与模型（buildTableTree / setByFieldPath），asset 可复用同一套表单引擎而不 import table（D-28 / D-07）"
  - phase: 03-asset
    provides: "asset 模型层 resolveAssetSchema / resolveAssetSchemaPath / collectRequiredPaths / validateAssetConfig 与内置 schema"
  - phase: 03-asset
    provides: "AssetPanel 数据层（读分类 / 手动保存 / registerConfigUndo / undo / redo / registerBarrier）与字节生命周期（addAsset / replaceAsset / deleteAsset 登记屏障）"
provides:
  - "AssetPanel.openConfig / closeConfig / applyConfigEdit（进入配置模式、可撤销重做、手动保存、重算校验）"
  - "配置模式的撤销 / 重做回放：Config 条目按 data 回放并刷新行树与 configErrors；Barrier 条目保持不做事"
  - "AssetConfigView（面包屑「← 返回素材列表」+ 错误列表 + 复用 TableGrid），AssetPanelView 按 AssetPanelMode.Configure 切换到主区整幅宽度"
  - "defaults 的 @required 经 configErrors 一路贯通到界面（D-10）"
  - "asset/__tests__/assetUndo.uat.test.tsx（8 条配置 / 撤销 / schema 优先级集成用例）"
affects: [03-16, 03-17]

actuals:
  tokens: 7558
  tasks: 3
  commits: 3
  plan_head_before: e46328c08f33372bfaa748dbc7d4e6103160864c

tech-stack:
  added: []
  patterns:
    - "配置编辑走共享表单模型：行树由 buildTableTree(schema, config) 生成、改值由 setByFieldPath(config, path, value) 应用，asset 不复制也不改 shared/schemaForm"
    - "配置模式状态放在面板实例上（mode / configName / configSchema / configDocument / configRequiredPaths / configRows / configErrors），publish 每次从实例读出——配置改动与列表改动共用同一条手动保存路径"
    - "撤销载荷 { categoryId, name, path, previous, next }：undo 应用 previous、redo 应用 next；正在配置的素材同时刷新行树与 configErrors"
    - "配置表单占主区整幅宽度（不塞进 320px 详情栏），带「← 返回素材列表」退回浏览态（UI-SPEC F1 默认）"

key-files:
  created:
    - packages/libs/editor-impl/src/asset/components/AssetConfigView.tsx
    - packages/libs/editor-impl/src/asset/__tests__/assetUndo.uat.test.tsx
  modified:
    - packages/libs/editor-impl/src/asset/assetPanel.ts
    - packages/libs/editor-impl/src/asset/components/AssetPanelView.tsx
    - packages/libs/editor-impl/src/asset/components/index.ts
    - packages/libs/editor-impl/src/asset/index.ts

key-decisions:
  - "撤销载荷保留 categoryId（计划 key_links 写作 { name, path, previous, next }）：既有 isAssetConfigUndoData 与 03-10 的 assetPanel.test.tsx 都按含 categoryId 的形状回放，去掉会让「选中分类 + 名字」无法定位条目、并回归既有用例；含 categoryId 是原形状的超集"
  - "正在配置的素材用 configName 比对（不另存分类）：回放时若 data.name === configName 则同步刷新 configDocument / 行树 / configErrors，其余素材只改内存条目"
  - "AssetConfigView 的 TablePanelStatus 按行数取：无字段时 EmptySchema（落回「尚未定义任何字段。」空态）、否则 Ready——以兑现 must_have 的空 schema 空态（计划 Task 2 动作字面只写了 Ready）"
  - "selectCategory 在配置态先 closeConfig 再切分类：避免配置表单停留在上一个分类的素材上（内存改动保留）"
  - "antd 6 Alert 用 title 而非已弃用的 message（避免弃用告警）"
  - "容器（AssetPanelContainer）在 Task 2 一并接线 onOpenConfig / onChange / onBack：计划 Task 2 的 <files> 漏了 assetPanel.ts，但不接线则「配置」按钮点了没反应、特性不成立"

patterns-established:
  - "配置模式：openConfig 解析 schema → 建行树 → 收集 @required → 算校验；applyConfigEdit 改内存 + 登记 Config 撤销 + 重算；closeConfig 只退模式、保留内存改动与未保存标记"
  - "配置编辑的集成测试用「先动作、后渲染」：动作间 unmount（cleanup）后再动作，避开异步 store 更新落在 act 之外"

requirements-completed: [ASSET-01]

coverage:
  - id: D1
    description: "面板能在浏览 / 配置两种模式间切换：openConfig 解析 schema 建行树并收集 defaults 的 @required、closeConfig 退回列表保留内存改动、applyConfigEdit 用 setByFieldPath 改内存并登记可撤销条目；undo / redo 按 data 回放"
    requirement: "ASSET-01"
    verification:
      - kind: integration
        ref: "packages/libs/editor-impl/src/asset/__tests__/assetUndo.uat.test.tsx（① 内置字段行树；② 配置改动可撤销且恢复旧值；③ 可重做回新值；④ 字节屏障挡住撤销且不回退配置）"
        status: pass
      - kind: other
        ref: "结构检查（assetPanel.ts 含 openConfig/closeConfig/applyConfigEdit/resolveAssetSchema/buildTableTree/setByFieldPath/validateAssetConfig/collectRequiredPaths/该素材的配置无法解析 与 AssetUndoType.Config）+ pnpm --filter @motajs/editor-impl typecheck（退出码 0）"
        status: pass
    human_judgment: false
  - id: D2
    description: "配置视图与主区挂载：AssetConfigView 含「← 返回素材列表」+ 错误列表 + 复用 TableGrid；AssetPanelView 按 AssetPanelMode.Configure 把主区换成配置视图、工具栏与分类导航保持可见；浏览态行为不变"
    requirement: "ASSET-01"
    verification:
      - kind: other
        ref: "结构检查（AssetConfigView 含 asset-config-back/asset-config-errors/asset-config-view/TableGrid/TablePanelStatus.Ready；AssetPanelView 含 AssetPanelMode.Configure/AssetConfigView/state.configErrors；桶加 ./AssetConfigView 与 ./components）+ pnpm --filter @motajs/editor-impl typecheck（退出码 0）"
        status: pass
      - kind: integration
        ref: "pnpm --filter @motajs/editor-impl test -- src/asset（10 files / 98 tests 通过，含 assetView.test.tsx 对浏览态的既有断言）"
        status: pass
    human_judgment: false
  - id: D3
    description: "配置 / 撤销 / schema 优先级集成测试：8 条用例钉住内置字段行树、可撤销可重做、字节屏障不回退、工程 schema 覆盖内置、非法 schema 保持浏览态、手动保存保留前缀"
    requirement: "ASSET-01"
    verification:
      - kind: integration
        ref: "pnpm --filter @motajs/editor-impl test -- src/asset/__tests__/assetUndo.uat.test.tsx（8/8）；pnpm --filter @motajs/editor-impl test（36 files / 289 tests，基线 281 → 无回归）"
        status: pass
      - kind: other
        ref: "node scripts/verify/coreBoundaries.js / coreModuleState.js / coreEngineNeutral.js（真实树均 0 违规，退出码 0）"
        status: pass
    human_judgment: false
  - id: D4
    description: "defaults 的 @required 一路走到界面：缺 read 时 AssetConfigView 错误列表（configErrors）非空且含「字段「read」为必填」，补齐后清空（D-10）"
    requirement: "ASSET-01"
    verification:
      - kind: integration
        ref: "packages/libs/editor-impl/src/asset/__tests__/assetUndo.uat.test.tsx（⑧ defaults 的 @required 校验贯通到配置视图）"
        status: pass
    human_judgment: false

duration: 26min
completed: 2026-10-18
status: complete
---

# Phase 3 Plan 14: 每素材配置表单 Summary

**点「配置」后在主区整幅宽度用抽出来的表格表单引擎编辑该素材配置：改动可撤销可重做、字节改动记成屏障挡住撤销、defaults 的 `@required` 缺字段时错误出现在配置视图里、补齐后清空，仍需手动保存才落盘。**

## Performance

- **Duration:** 约 26 min
- **Started:** 2026-10-18T08:53:00Z
- **Completed:** 2026-10-18T09:18:58Z
- **Tasks:** 3
- **Files modified:** 6（2 新建，4 修改）

## Accomplishments

- `assetPanel.ts` 追加配置模式：`AssetPanel.openConfig(name)` 解析 schema（工程内 `.schema.jsonc` → 注入 → 内置）、读 `defaultsPath` 收集 `@required`、建行树 `buildTableTree(schema, config)` 并算 `validateAssetConfig`，把 `mode` 置 `Configure` 后发布；`AssetPanel.closeConfig()` 退回浏览态、保留内存改动与未保存标记；`AssetPanel.applyConfigEdit(path, value)` 用 `setByFieldPath` 写内存配置与条目、登记一条 `AssetUndoType.Config` 撤销记录、标记未保存、重建行树并重算 `configErrors`。`undo` / `redo` 的 `Config` 分支按 `data.path` 回放 `previous` / `next`，正在配置该素材时一并刷新行树与校验结果；`Barrier` 分支不做事。
- 新建 `AssetConfigView.tsx`：顶部 `Button type="link"`「← 返回素材列表」、有错误时用 antd `Alert type="error"` 逐条列出（`asset-config-errors`）、主体是复用共享表单引擎的 `TableGrid`。`AssetPanelView` 在 `state.mode === AssetPanelMode.Configure` 时把主区（网格 + 详情两栏所占整幅宽度）换成配置视图，工具栏与分类导航保持可见；浏览态行为一字未改。
- 容器接线：`AssetPanelContainer` 新增 `onOpenConfig`（读选中的素材名进配置）/ `onChange`（转 `applyConfigEdit`）/ `onBack`（转 `closeConfig`），「配置」按钮此后真正能进配置模式。
- `asset/components/index.ts` 追加 `AssetConfigView`，`asset/index.ts` 追加 `./components` 导出——`./asset` 子路径的对外导出面现含底层组件。
- 新建 `assetUndo.uat.test.tsx` 8 条集成用例：① 打开配置行树含内置图片 schema 的 `read` / `usage`；② 配置改动可撤销且恢复旧值（同时断言 `unsaved` 与 `undo()` 为 `true`）；③ 撤销可重做回新值；④ 配置改动后再做字节改动，`undo()` 为 `false` 且配置**停在**改动后状态（屏障不跳过）；⑤ 工程内 `content/texture/.schema.jsonc` 含 `customNote` → 行树出现该字段（工程优先）；⑥ 非法工程 schema → 保持浏览态（不出现 `asset-config-view`）；⑦ 配置改动 `save()` 后列表正文含新值且首行仍是系统前缀；⑧ defaults 的 `@required` 缺 `read` 时 `configErrors` 含「字段「read」为必填」，`applyConfigEdit("['read']", 0)` 后清空。

## Task Commits

Each task was committed atomically:

1. **Task 1: 面板的配置模式与撤销回放** - `190391c` (feat)
2. **Task 2: 配置视图与主区挂载** - `ce4e2e3` (feat)
3. **Task 3: 配置 / 撤销 / schema 优先级集成测试** - `0cd075d` (test)

**Plan metadata:**（本 SUMMARY 提交）(docs)

_Note: 本计划无 TDD 循环；Task 3 的提交含一处 Task 2 文件的 antd 6 弃用修正（见 Deviations）。_

## Files Created/Modified

- `packages/libs/editor-impl/src/asset/assetPanel.ts` - 追加 `openConfig` / `closeConfig` / `applyConfigEdit` 与私有 `readSchemaText` / `storeEntryConfig` / `refreshConfigView`；`publish` 改为从实例读配置模式状态；`replayConfigUndo` 回放并刷新；容器接线 `onOpenConfig` / `onChange` / `onBack`
- `packages/libs/editor-impl/src/asset/components/AssetConfigView.tsx` - 新：面包屑 + 错误列表 + 复用 `TableGrid`
- `packages/libs/editor-impl/src/asset/components/AssetPanelView.tsx` - 改：按 `AssetPanelMode.Configure` 切换主区；新增 `onChange?` / `onBack?` props 与缺省实现
- `packages/libs/editor-impl/src/asset/components/index.ts` - 改：追加 `./AssetConfigView` 导出
- `packages/libs/editor-impl/src/asset/index.ts` - 改：追加 `./components` 导出
- `packages/libs/editor-impl/src/asset/__tests__/assetUndo.uat.test.tsx` - 新：8 条配置 / 撤销 / schema 优先级集成用例

## Decisions Made

- **撤销载荷保留 `categoryId`。** 计划 key_links 把载荷写作 `{ name, path, previous, next }`，但既有 `isAssetConfigUndoData` 守卫与 03-10 的 `assetPanel.test.tsx` 都按含 `categoryId` 的形状回放；去掉会让「按分类 + 名字定位条目」落空并回归既有用例。故载荷为原形状的超集 `{ categoryId, name, path, previous, next }`。
- **按 `configName` 判定「正在配置的素材」。** 回放时若 `data.categoryId === 当前分类` 且 `data.name === configName` 才同步刷新 `configDocument` / 行树 / `configErrors`；其余素材只改内存条目，不动配置视图。
- **空 schema 走 EmptySchema 状态。** `AssetConfigView` 按行数取 `TablePanelStatus`：无字段时 `EmptySchema`（落回表格引擎既有的「尚未定义任何字段。」空态），否则 `Ready`——兑现 must_have，而非计划 Task 2 动作字面写的固定 `Ready`。
- **切分类自动退出配置态。** `selectCategory` 在 `Configure` 时先 `closeConfig()` 再切，避免配置表单停留在上一个分类的素材上（内存改动保留）。
- **工程 schema 读不到不等于失败。** `readSchemaText` 把「文件不存在 / 读取失败」都归成「没有工程 schema」，交由 `resolveAssetSchema` 回退注入 / 内置；只有工程 schema **存在但无效**时才返回 `null`、发布错误并保持浏览态（D-09 / T-03-44）。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 计划 Task 2 的 `<files>` 漏了 `assetPanel.ts`，但不接线则特性不成立**
- **Found during:** Task 2（配置视图与主区挂载）
- **Issue:** Task 2 只列了视图与桶四个文件，未列 `assetPanel.ts`；但「配置」按钮要真正能用，必须由容器把 `onOpenConfig` / `onChange` / `onBack` 接到 `AssetPanel.openConfig` / `applyConfigEdit` / `closeConfig`——这些回调都在 `assetPanel.ts`。
- **Fix:** 在 Task 2 的提交里一并给 `IAssetPanelContainerProps` 补三个回调、在 `createElement` 与 `AssetPanelContainer` 中透传（`onOpenConfig` 读 `store.state.selectedName` 再 `openConfig`）。
- **Files modified:** `packages/libs/editor-impl/src/asset/assetPanel.ts`
- **Verification:** `pnpm --filter @motajs/editor-impl typecheck` 退出码 0；`src/asset` 全量绿。
- **Committed in:** `ce4e2e3` (Task 2)

**2. [Rule 1 - Bug] 切分类时配置态不退出会让配置表单停留在上一个分类的素材上**
- **Found during:** Task 1（面板的配置模式）
- **Issue:** 配置模式下分类导航仍可见；若切分类不重置配置态，主区会继续渲染上一个分类素材的行树，属错误状态。
- **Fix:** `selectCategory` 在 `Configure` 时先 `closeConfig()`（内存改动与未保存标记保留）再 `loadCategory`。
- **Files modified:** `packages/libs/editor-impl/src/asset/assetPanel.ts`
- **Verification:** typecheck 退出码 0；既有 asset 用例无回归。
- **Committed in:** `190391c` (Task 1)

**3. [Rule 1 - Bug] antd 6 弃用 `Alert` 的 `message`，改用 `title`**
- **Found during:** Task 3（集成测试运行期告警）
- **Issue:** `Alert` 用 `message` 时 antd 6.2.1 打印弃用告警（`@deprecated please use title instead`）。
- **Fix:** `AssetConfigView` 的 `Alert` 由 `message="配置校验未通过"` 改为 `title="配置校验未通过"`。
- **Files modified:** `packages/libs/editor-impl/src/asset/components/AssetConfigView.tsx`
- **Verification:** 用例 ⑧ 仍绿；告警消失。
- **Committed in:** `0cd075d` (Task 3)

### Plan-doc reconciliation (not a code defect)

**4. 撤销载荷形状与计划 key_links 的差异。** 见「Decisions Made」第 1 条：计划写作 `{ name, path, previous, next }`，实现保留 `categoryId`（既有守卫与 03-10 用例所依赖）。行为与计划意图一致（配置改动可撤销、回放刷新）。

---

**Total deviations:** 3 auto-fixed（2 × Rule 1，1 × Rule 3）+ 1 处计划文档措辞与既有实现的取舍（如实记录）
**Impact on plan:** 三处 auto-fix 均为让特性真正可用 / 正确所需，无范围蔓延；未改动 `shared/schemaForm` 的行为，未新开配置写路径。

## Issues Encountered

- **数字枚举字段渲染成下拉而非数字框。** 内置图片 schema 的 `read` / `usage` 带 `enum`，共享表单引擎按 `inferControlKind` 渲染为 antd `Select`（不是 `InputNumber`）。测试的取值辅助因此读取 `Select` 的选中项文本（`.ant-select-content-value`）而非 `input.value`。这是既有引擎行为，非本计划缺陷。
- **jsdom 下 antd 弹层仍打印 `window.getComputedStyle` 既有噪声**，不影响任何用例结果（与 03-10 / 03-11 / 03-13 记录一致）。
- 用例一律「先动作、后渲染」并在需要连续观察时于两次渲染之间 `cleanup()`，避开异步 store 更新落在 React `act` 之外产生的告警。

## User Setup Required

None - 本计划纯前端配置表单实现与集成测试，无外部服务、环境变量或依赖安装。

## Known Stubs

None - 配置表单接的是真实 schema / defaults / 内存配置与手动保存路径，无占位、无 TODO、无空数据源。

## Threat Flags

None - 未引入计划 `<threat_model>` 之外的新信任面。T-03-43（`setByFieldPath` 写入配置）复用共享模型层对 `__proto__` / `constructor` / `prototype` 的拦截，配置编辑未另开写路径；T-03-44（非法工程 schema）由 `resolveAssetSchema` 返回 `null` → 发布错误并保持浏览态（用例 ⑥）；T-03-45（配置撤销绕过屏障）由 `registerBarrier` 生成的屏障条目与 core 层撤销拦截兜底（用例 ④ 断言 `undo()` 为 `false` 且配置未被继续回退）。

## Next Phase Readiness

- 配置模式就位：03-16（转码弹窗）可沿用「立即写字节 + 屏障」与「配置 / 列表手动保存」两条既有路径；03-17（dev 宿主）经工具栏 / 详情回调驱动真实上传与配置保存。
- `asset` 仍零跨能力 import（只依赖 `../react` 与 `../shared`）；四道门禁（typecheck / coreBoundaries / coreModuleState / coreEngineNeutral）本次均绿。
- 无阻塞。

---

## Self-Check: PASSED

- FOUND: packages/libs/editor-impl/src/asset/components/AssetConfigView.tsx
- FOUND: packages/libs/editor-impl/src/asset/__tests__/assetUndo.uat.test.tsx
- FOUND: packages/libs/editor-impl/src/asset/assetPanel.ts
- FOUND: packages/libs/editor-impl/src/asset/components/AssetPanelView.tsx
- FOUND: packages/libs/editor-impl/src/asset/components/index.ts
- FOUND: packages/libs/editor-impl/src/asset/index.ts
- FOUND commit: 190391c (Task 1)
- FOUND commit: ce4e2e3 (Task 2)
- FOUND commit: 0cd075d (Task 3)
- PASS: `pnpm --filter @motajs/editor-impl test -- src/asset/__tests__/assetUndo.uat.test.tsx` (8/8)
- PASS: `pnpm --filter @motajs/editor-impl test -- src/asset` (10 files / 98 tests)
- PASS: `pnpm --filter @motajs/editor-impl test` (36 files / 289 tests, baseline 281 → no regression)
- PASS: `pnpm --filter @motajs/editor-impl typecheck` (exit 0)
- PASS: `node scripts/verify/coreBoundaries.js` (exit 0)
- PASS: `node scripts/verify/coreModuleState.js` (exit 0)
- PASS: `node scripts/verify/coreEngineNeutral.js` (exit 0)

*Phase: 03-asset*
*Completed: 2026-10-18*
