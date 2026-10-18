---
phase: 03-asset
plan: 13
subsystem: editor-impl-asset
tags: [typescript, react, antd, asset, byte-lifecycle, upload, undo-barrier, integration-test]

# Dependency graph
requires:
  - phase: 03-asset
    provides: "面板数据层 AssetPanel（读分类 / 手动保存 / registerBarrier）/ `IAssetCategory` 的 sanitizeAssetFileName / resolveAssetName / resolveAssetBytePath / mergeAssetDefaults / parseTableText / ASSET_MAX_UPLOAD_BYTES / 真实撤销屏障（UndoSystem.undo 命中屏障返回 false）"
provides:
  - "IAssetUpload（上传文件名 + 字节）"
  - "AssetPanel.addAsset / AssetPanel.replaceAsset / AssetPanel.deleteAsset（三个字节动作，立即写字节、登记屏障）"
  - "AssetFileInput（隐藏原生文件选择 + 按钮触发 + 超限拦截）"
  - "AssetToolbar.onAddAsset(upload) / AssetDetail.onReplace(upload) 与 AssetPanelView 的字节回调透传；删除二次确认（antd Modal）"
  - "asset/__tests__/assetLifecycle.uat.test.tsx（9 条生命周期集成用例）"
affects: [03-14, 03-16, 03-17]

actuals:
  tokens: 7759
  tasks: 3
  commits: 3
  plan_head_before: b627750c896d2460251614d7c8c35be290689be0

tech-stack:
  added: []
  patterns:
    - "字节改动立即落盘、列表改动手动保存：新增把字节写进资源层后只把条目留内存（unsaved），刷新后未保存的新条目不在列表里（INTERFACE-NAME 偏离 6）"
    - "三个字节动作都先校验后写盘：文件名（sanitizeAssetFileName）→ 体积（ASSET_MAX_UPLOAD_BYTES）→ 同名，任一不过就在写盘前返回并给出固定中文提示"
    - "每次写/删字节后调用 AssetPanel.registerBarrier，屏障条目在 addUndoContext 时带 barrier: true——撤销碰到即停、返回 false、不跳过屏障去撤更早的配置改动"
    - "新增条目默认值：读 category.defaultsPath（Conforming 才用）→ mergeAssetDefaults 合并进「仅含来源字段」的基底；StringList 分类直接只有名字"
    - "上传控件用隐藏的原生 <input type=\"file\" ref> 配文案按钮，只用标准 ref 模式、不触碰 document；超限在 arrayBuffer 之前拦下"

key-files:
  created:
    - packages/libs/editor-impl/src/asset/components/AssetFileInput.tsx
    - packages/libs/editor-impl/src/asset/__tests__/assetLifecycle.uat.test.tsx
  modified:
    - packages/libs/editor-impl/src/asset/types.ts
    - packages/libs/editor-impl/src/asset/assetPanel.ts
    - packages/libs/editor-impl/src/asset/components/AssetToolbar.tsx
    - packages/libs/editor-impl/src/asset/components/AssetDetail.tsx
    - packages/libs/editor-impl/src/asset/components/AssetPanelView.tsx
    - packages/libs/editor-impl/src/asset/components/index.ts

key-decisions:
  - "新增条目的配置必须带来源字段：writeAssetList 对 ObjectList 条目「有 config 就原样用」，故新 config 以 { [sourceField]: name } 为基底再合并 defaults，避免写出的列表丢文件名（sourceField 缺省 'source'）"
  - "读 defaults 用 category.defaultsPath + parseTableText + mergeAssetDefaults；未配置 / 缺失 / 非 Conforming 都归成「没有默认值」，不拦住新增"
  - "replaceAsset 覆盖后把该条目的 exists 纠正为 true——否则对「已登记但文件缺失」的条目做替换后，界面会继续显示缺失直到重读"
  - "deleteAsset 把 deleteResource 的失败隔离成「继续移除列表条目」——字节文件本就不存在时也不该卡住删除"
  - "两个字节入口（工具栏新增 / 详情替换）共用同一个 AssetFileInput；AssetDetail.onReplace 由无参改为接收 IAssetUpload（名字 + 字节），AssetPanelView 再把名字与字节拆开交给面板"
  - "删除确认用受控 antd Modal（danger 确认按钮），文案逐字取 UI-SPEC『确定要删除该素材吗？此操作不可恢复。』，绝不用 window.confirm"

patterns-established:
  - "字节入口的通路：AssetFileInput.onPick(upload) → AssetToolbar.onAddAsset(upload) / AssetDetail.onReplace(upload) → AssetPanelView 透传 → AssetPanel.addAsset(upload) / AssetPanel.replaceAsset(upload.name, upload.bytes)"
  - "面板容器（AssetPanelContainer）统一承接字节回调并转发给 AssetPanel 的同名方法；视图组件保持纯 props 驱动"
  - "生命周期集成测试用 FakeFileSystem 直读字节（fs.readBinary）与 system.resourceSystem.readContent 读回写结果，用面板渲染断言内存条目 / unsaved"

requirements-completed: [ASSET-01]

coverage:
  - id: D1
    description: "面板侧三个字节动作：新增（校验文件名 / 体积 / 同名 → 写字节 → defaults 合并追加条目 → 标记未保存 → 屏障）、替换（覆盖字节 → 屏障）、删除（删字节 + 移除条目 → 屏障），三者写失败都转固定中文提示"
    requirement: "ASSET-01"
    verification:
      - kind: integration
        ref: "packages/libs/editor-impl/src/asset/__tests__/assetLifecycle.uat.test.tsx（① 新增写盘 + 条目 + unsaved；② 保存保留前缀含新名；③ 同名拒绝且字节不变；④ 非法名拒绝且零写入；⑤ 超限拒绝且目标不存在；⑥ 替换 + undo false；⑦ 删除 + unsaved；⑧ 删除后连续两次 undo false；⑨ defaults 合并）"
        status: pass
      - kind: other
        ref: "结构检查（types.ts 含 IAssetUpload；assetPanel.ts 含 addAsset/replaceAsset/deleteAsset/sanitizeAssetFileName/resolveAssetBytePath/ASSET_MAX_UPLOAD_BYTES/registerBarrier/mergeAssetDefaults 与 '32 MiB'）+ pnpm --filter @motajs/editor-impl typecheck（退出码 0）"
        status: pass
    human_judgment: false
  - id: D2
    description: "文件选择入口与工具栏 / 详情 / 面板接线：AssetFileInput（隐藏原生 file input + 按钮、读前拦超限并回调 onReject、选完清空可重复选同一文件）；工具栏新增与详情替换共用它；删除走 antd Modal 二次确认（danger）"
    requirement: "ASSET-01"
    verification:
      - kind: other
        ref: "结构检查（AssetFileInput 含 type=\"file\"/arrayBuffer/ASSET_MAX_UPLOAD_BYTES/onReject/inputRef/IAssetUpload；工具栏含 AssetFileInput + asset-toolbar-add + onAddAsset?(upload: IAssetUpload)；详情含 AssetFileInput + onReplace?(upload: IAssetUpload) + 删除确认文案 + asset-delete-confirm/asset-delete-cancel + danger；面板视图透传 onAddAsset/onReplace/onDelete；components/index.ts 导出 AssetFileInput）+ pnpm --filter @motajs/editor-impl typecheck（退出码 0）"
        status: pass
      - kind: integration
        ref: "pnpm --filter @motajs/editor-impl test -- src/asset（9 files / 90 tests 通过，含 assetView.test.tsx 11 条对工具栏 / 详情按钮的渲染断言）"
        status: pass
    human_judgment: false
  - id: D3
    description: "生命周期集成测试：9 条用例钉住新增 / 替换 / 删除的字节与列表效果、四类拒绝路径（非法名 / 超限 / 同名）、以及撤销屏障（两条显式断言 undo() 为 false）"
    requirement: "ASSET-01"
    verification:
      - kind: integration
        ref: "pnpm --filter @motajs/editor-impl test -- src/asset/__tests__/assetLifecycle.uat.test.tsx（9/9）；pnpm --filter @motajs/editor-impl test -- src/asset（9 files / 90 tests）；pnpm --filter @motajs/editor-impl test（35 files / 281 tests，基线 272 → 无回归）"
        status: pass
      - kind: other
        ref: "node scripts/verify/coreBoundaries.js / coreModuleState.js / coreEngineNeutral.js（均退出码 0）"
        status: pass
    human_judgment: false

duration: ~35min
completed: 2026-10-18
status: complete
---

# Phase 3 Plan 13: 字节生命周期（新增 / 替换 / 删除）Summary

**让用户能真正改动素材文件：上传新增、覆盖替换、确认删除。三种操作都立即写字节、都不进撤销，而是记成一道屏障——撤销碰到它就停住、返回 `false`，不会跳过它去撤更早的配置改动；列表条目仍走手动保存。**

## Performance

- **Duration:** 约 35 min
- **Tasks:** 3
- **Files modified:** 8（2 新建，6 修改）

## Accomplishments

- `asset/types.ts` 追加 `IAssetUpload`（原始文件名 + 字节）。
- `asset/assetPanel.ts` 新增三个面板动作：`AssetPanel.addAsset(upload)`（先 `sanitizeAssetFileName` → 体积 `ASSET_MAX_UPLOAD_BYTES` → 同名逐关校验，任一不过就在写盘前返回；过关后 `createResource` 写字节 → 读 `defaultsPath` 合并默认值 → 往内存列表追加一条 → 标记未保存 → `registerBarrier({ action: 'add', path })` → 发布「已新增素材，请记得保存」）；`AssetPanel.replaceAsset(name, bytes)`（找不到条目 / 超限直接拒绝，否则覆盖字节并把 `exists` 纠正为 `true` → 屏障 → 发布「已替换素材」）；`AssetPanel.deleteAsset(name)`（隔离删除失败后从内存列表移除该条目 → 屏障 → 按空 / 就绪发布「已删除素材，请记得保存」）。三者都把写入异常转成固定中文提示，不抛穿。
- `asset/components/AssetFileInput.tsx` 新建：隐藏的原生 `<input type="file" ref>` + 文案按钮；`file.size` 超限在 `arrayBuffer` 之前拦下并回调 `onReject('文件过大，单个素材不能超过 32 MiB')`；每次选完清空 `input.value`，允许重复选同一文件；只用标准 ref 模式、不触碰 `document`。
- `AssetToolbar` 的「新增素材」换成 `AssetFileInput`（`primary`、`testId="asset-toolbar-add"`），`onAddAsset` 签名由无参改为接收 `IAssetUpload`；`AssetDetail` 的「替换」换成 `AssetFileInput`（`testId="asset-detail-replace"`），`onReplace` 同样由无参改为接收 `IAssetUpload`，「删除」改为弹受控 antd `Modal`（标题「删除素材」、正文「确定要删除该素材吗？此操作不可恢复。」、`danger` 确认按钮、`asset-delete-confirm`/`asset-delete-cancel`）；`AssetPanelView` 把三者透传，并在容器 `AssetPanelContainer` 里接到 `AssetPanel.addAsset` / `replaceAsset(upload.name, upload.bytes)` / `deleteAsset(name)`（名字与字节在面板处拆开）。
- `asset/components/index.ts` 追加 `export * from './AssetFileInput'`。
- `asset/__tests__/assetLifecycle.uat.test.tsx` 新建 9 条集成用例（每条前 `//` 注释）：① 新增写盘 + 条目 + 未保存；② 保存逐字保留系统前缀且含新名字；③ 同名拒绝且字节不变；④ 非法名（`../evil.png`）拒绝且零写入；⑤ 超限拒绝且目标路径不存在；⑥ 替换 + `undo()` 为 `false`；⑦ 删除 + 未保存；⑧ 删除后连续两次 `undo()` 为 `false`；⑨ `ObjectList` 新增合并 defaults 字段。

## Task Commits

Each task was committed atomically:

1. **Task 1: 面板侧三个字节动作** - `348a96e` (feat)
2. **Task 2: 文件选择入口与工具栏 / 详情 / 面板接线** - `7b0f5e7` (feat)
3. **Task 3: 生命周期集成测试（含屏障）** - `75c9135` (test)

**Plan metadata:** （本 SUMMARY 提交）(docs)

## Files Created/Modified

- `packages/libs/editor-impl/src/asset/types.ts` - 追加 `IAssetUpload`
- `packages/libs/editor-impl/src/asset/assetPanel.ts` - `addAsset` / `replaceAsset` / `deleteAsset` + 私有 `readDefaultsValue` / `buildNewEntryConfig` + 容器字节回调接线
- `packages/libs/editor-impl/src/asset/components/AssetFileInput.tsx` - 新：隐藏原生文件选择 + 按钮触发 + 超限拦截
- `packages/libs/editor-impl/src/asset/components/AssetToolbar.tsx` - 「新增素材」改用 `AssetFileInput`，`onAddAsset(upload)`
- `packages/libs/editor-impl/src/asset/components/AssetDetail.tsx` - 「替换」改用 `AssetFileInput`，`onReplace(upload)`；「删除」走 antd `Modal` 二次确认
- `packages/libs/editor-impl/src/asset/components/AssetPanelView.tsx` - 透传 `onAddAsset(upload)` / `onReplace(upload)` / `onDelete(name)`
- `packages/libs/editor-impl/src/asset/components/index.ts` - 追加 `AssetFileInput` 桶导出
- `packages/libs/editor-impl/src/asset/__tests__/assetLifecycle.uat.test.tsx` - 新：9 条生命周期集成用例

## Decisions Made

- **新增条目配置必须带来源字段。** `writeAssetList` 对 `ObjectList` 条目「有 `config` 就原样写」，若新条目只放 defaults 会丢文件名；故新 config 以 `{ [sourceField]: name }` 为基底再 `mergeAssetDefaults`（`sourceField` 缺省 `'source'`）。
- **读 defaults 不拦住新增。** 未配置 `defaultsPath`、文件缺失、或解析非 `Conforming`，都归成「没有默认值」，新增照常进行。
- **替换后纠正 `exists`。** 对「已登记但文件缺失」的条目做替换后，字节已创建，条目 `exists` 一并置 `true`，避免界面继续显示缺失。
- **删除隔离字节删除失败。** 字节文件本就不存在时 `deleteResource` 可能抛错，但那不该卡住「从列表移除条目」，故隔离成继续。
- **两个字节入口共用 `AssetFileInput`。** `AssetDetail.onReplace` / `AssetToolbar.onAddAsset` 由无参改为接收 `IAssetUpload`，名字与字节在面板容器处拆开（`replaceAsset(upload.name, upload.bytes)`）。
- **删除确认用受控 antd `Modal`。** 破坏性按钮 `danger: true`，文案逐字取 UI-SPEC，绝不用 `window.confirm`。

## Deviations from Plan

None - plan executed exactly as written.

> 唯一需要说明的时序：Task 1 只加了面板侧三个方法与 `IAssetUpload`，**未**同时改容器 / 视图接线——因为接线引用的是 Task 2 才引入的新视图签名，若在 Task 1 一并改会让 Task 1 自己的 `typecheck` 门禁失败（`AssetPanelView` 尚未接收 `IAssetUpload`）。故 Task 1 的 `assetPanel.ts` 改动严格限于三个方法与两个私有 helper，容器接线放回 Task 2（Task 2 的 `files` 列表本就包含 `assetPanel.ts`）。这不是偏离，而是按计划的任务边界落位。

## Issues Encountered

- 无阻塞。`src/asset` 全量 9 files / 90 tests、全量 `editor-impl` 35 files / 281 tests（基线 272 + 新增 9）一次跑绿；`typecheck` 与 `coreBoundaries.js` / `coreModuleState.js` / `coreEngineNeutral.js` 四道门禁均退出码 0。
- jsdom 下 antd 弹层（`assetPicker` 等既有用例）仍会打印 `window.getComputedStyle` 既有噪声，不影响任何用例结果（与 03-10 / 03-11 记录一致）。
- 用例 ①–⑨ 一律「先动作、后渲染」，避免异步 store 更新落在 React `act` 之外产生的告警。

## Threat Flags

None - 未引入计划 `<threat_model>` 之外的新信任面。T-03-39（文件名穿越）由 `sanitizeAssetFileName` + 注入 fs 二次拒绝、T-03-40（超大上传）由 `file.size` + 字节长度两次校验、T-03-41（同名覆盖）由同名直接拒绝、T-03-42（删除不可恢复）由 antd `Modal` 二次确认，均在实现中落地并有对应用例。

## Known Stubs

None.

## User Setup Required

None - 本计划纯字节生命周期实现与集成测试，无外部服务、环境变量或依赖安装。

## Next Phase Readiness

- 字节动作就位：03-14（配置表单）在新增 / 配置后沿用同一内存列表与手动保存路径；03-16（转码）可复用 `AssetPanel.registerBarrier` 与「立即写字节」的落盘约定，并接 `moveResource` 做旧文件改名；03-17（dev 宿主）可经工具栏 / 详情的字节回调驱动真实上传。
- 面板视图仍是纯 props 驱动；容器统一承接字节回调。未接线项（`onTranscode` / `onOpenConfig`）按计划归 03-14 / 03-16。
- 无阻塞。

---

## Self-Check: PASSED

- FOUND: packages/libs/editor-impl/src/asset/components/AssetFileInput.tsx
- FOUND: packages/libs/editor-impl/src/asset/__tests__/assetLifecycle.uat.test.tsx
- FOUND: packages/libs/editor-impl/src/asset/types.ts
- FOUND: packages/libs/editor-impl/src/asset/assetPanel.ts
- FOUND: packages/libs/editor-impl/src/asset/components/AssetToolbar.tsx
- FOUND: packages/libs/editor-impl/src/asset/components/AssetDetail.tsx
- FOUND: packages/libs/editor-impl/src/asset/components/AssetPanelView.tsx
- FOUND: packages/libs/editor-impl/src/asset/components/index.ts
- FOUND commit: 348a96e (Task 1)
- FOUND commit: 7b0f5e7 (Task 2)
- FOUND commit: 75c9135 (Task 3)
- PASS: `pnpm --filter @motajs/editor-impl test -- src/asset/__tests__/assetLifecycle.uat.test.tsx` (9/9)
- PASS: `pnpm --filter @motajs/editor-impl test -- src/asset` (9 files / 90 tests)
- PASS: `pnpm --filter @motajs/editor-impl test` (35 files / 281 tests)
- PASS: `pnpm --filter @motajs/editor-impl typecheck` (exit 0)
- PASS: `node scripts/verify/coreBoundaries.js` (exit 0)
- PASS: `node scripts/verify/coreModuleState.js` (exit 0)
- PASS: `node scripts/verify/coreEngineNeutral.js` (exit 0)

*Phase: 03-asset*
*Completed: 2026-10-18*
