---
phase: 03-asset
plan: 36
subsystem: editor-dev-host
tags: [asset-panel, editor-dev, integration-test, file-input, unregistered, vitest]

# Dependency graph
requires:
  - phase: 03-asset
    provides: "AssetPanel.registerAsset / unregisterAsset、未登记卡片（data-registered / is-unregistered）与两次确认注销（03-33 / 03-34）"
  - phase: 03-asset
    provides: "ASSET_DEMO_FILES / ASSET_DEMO_CATEGORIES / registerAssetDemo / seedAssetDemo（03-30 / 03-31）"
  - phase: 03-asset
    provides: "ASSET_PANEL_TYPE_ID 与 shellSystem.openPanelInTab / closeTab / openBlankTab（03-10…03-31）"
provides:
  - "devHostAssetAdd.test.tsx：五条经真实界面入口的顶层集成用例（选文件 → 卡片 → 保存 → 重新切入 / 新面板实例 / 未登记样本）"
  - "DEMO_UNREGISTERED_TEXTURE_NAME / createUnregisteredAssetDemoFiles / seedUnregisteredAssetDemo：开发宿主启动即带一张未登记图片"
  - "main.tsx 在 seedAssetDemo 之后、initialize 之前预置未登记样本"
affects: [03-37 人工验收]

actuals:
  tokens: 2718
  tasks: 3
  commits: 0

tech-stack:
  added: []
  patterns:
    - "新增素材链路只经真实界面入口验证：asset-toolbar-add-input 选文件、asset-toolbar-save 保存，禁止直接调数据层方法"
    - "文件选择的字节在测试内复制成 Uint8Array<ArrayBuffer> 再交给 File，兼作 jsdom 缺 arrayBuffer 时的替身来源"
    - "重新切入用外壳 closeTab + openBlankTab + openPanelInTab；第二个核心只证明新面板实例能读回同一内存文件系统，不声称等价于浏览器刷新"
    - "预置未登记样本单独经 seedUnregisteredAssetDemo 写入，绝不进 ASSET_DEMO_FILES"

key-files:
  created:
    - packages/apps/editor-dev/src/__tests__/devHostAssetAdd.test.tsx
  modified:
    - packages/apps/editor-dev/src/demo/assetDemo.ts
    - packages/apps/editor-dev/src/main.tsx
  deleted: []

key-decisions:
  - "未登记样本用 48×48、调色板 38 单独生成，只写字节文件；36 / 38 两条既有计数断言不变"
  - "测试先等首屏 hero.png 出现再选文件，避开初始 loadCategory 覆盖刚新增内存条目的竞态"
  - "系统前缀断言同时比结束标记行与演示列表的完整首行前缀（逐字一致）"
  - "新增用例只断言 data-test-id、data-registered、class 与注入文件系统内容，不读组件内部状态"

requirements-completed: [ASSET-01]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "经工具栏真实的文件选择框选一个本地文件后，网格里立刻多出一张新卡片"
    requirement: "ASSET-01"
    verification:
      - kind: integration
        ref: "packages/apps/editor-dev/src/__tests__/devHostAssetAdd.test.tsx#从工具栏选文件后网格里多出新卡片"
        status: pass
    human_judgment: false
  - id: D2
    description: "点保存后 .list.jsonc 含新名字、系统前缀逐字不变，字节文件与选中文件完全一致"
    requirement: "ASSET-01"
    verification:
      - kind: integration
        ref: "packages/apps/editor-dev/src/__tests__/devHostAssetAdd.test.tsx#保存后列表含新名字且系统前缀不变"
        status: pass
    human_judgment: false
  - id: D3
    description: "关闭标签页后新开标签页重新切入素材面板（同一会话内），新卡片仍在，总数 37"
    requirement: "ASSET-01"
    verification:
      - kind: integration
        ref: "packages/apps/editor-dev/src/__tests__/devHostAssetAdd.test.tsx#关闭标签页后重新切入素材面板新卡片仍在"
        status: pass
    human_judgment: false
  - id: D4
    description: "同一内存文件系统上重新初始化核心、新面板实例能读回已保存的卡片（不是浏览器刷新）"
    requirement: "ASSET-01"
    verification:
      - kind: integration
        ref: "packages/apps/editor-dev/src/__tests__/devHostAssetAdd.test.tsx#同文件系统上重新初始化核心后新面板实例仍读到新卡片"
        status: pass
    human_judgment: false
  - id: D5
    description: "开发宿主预置的未登记样本以黄卡出现：data-registered=false、is-unregistered、总数 37"
    requirement: "ASSET-01"
    verification:
      - kind: integration
        ref: "packages/apps/editor-dev/src/__tests__/devHostAssetAdd.test.tsx#预置的未登记样本以黄卡出现"
        status: pass
    human_judgment: false
  - id: D6
    description: "既有开发宿主用例（36 张演示图 / 38 条含大图 / 分类数 / 撤销屏障）无回归"
    requirement: "ASSET-01"
    verification:
      - kind: integration
        ref: "packages/apps/editor-dev/src/__tests__/devHostAsset.test.tsx（9 条）"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-10-21
status: complete
---

# Phase 03 Plan 36: 开发宿主新增素材顶层整合 Summary

**「新增素材」第一次从真实界面入口被走通：工具栏的文件选择框选文件 → 网格多出一张卡片 → 点保存 → 列表与字节真的落盘 → 关闭重开 / 换新面板实例仍在；开发宿主启动时还预置了一张黄色未登记图**

## Performance

- **Duration:** 12 min
- **Tasks:** 3
- **Files modified:** 3（1 新增，2 修改）

## Accomplishments

- 新增 `devHostAssetAdd.test.tsx`：五条顶层集成用例，全部只经真实界面入口与注入的 `MemoryBackend`
  - 经 `asset-toolbar-add-input` 用 `File` 选一张图 → 卡片 `asset-card-picked-hero.png` 出现、卡片数 +1
  - 点 `asset-toolbar-save` → `.list.jsonc` 含 `"source": "picked-hero.png"`、完整首行系统前缀逐字不变 → `content/texture/picked-hero.png` 与选中字节逐字节相同
  - 外壳 `closeTab` + `openBlankTab` + `openPanelInTab` 重新切入 → 新卡片仍在、总数 37
  - 同一 `MemoryBackend` 上新建第二个 `EditorCore` → 新面板实例读回已保存的卡片、总数 37（用例注释写明这不是浏览器刷新）
- `demo/assetDemo.ts` 新增三样（都不进 `ASSET_DEMO_FILES`）：
  - `DEMO_UNREGISTERED_TEXTURE_NAME = 'unregistered.png'`
  - `createUnregisteredAssetDemoFiles()`：复用 `encodePng` 生成 48×48、调色板 38 的演示 PNG
  - `seedUnregisteredAssetDemo(backend)`：只写字节文件，不写列表
- `main.tsx` 在 `await seedAssetDemo(backend)` 之后、`core.initialize(...)` 之前调用 `seedUnregisteredAssetDemo(backend)`
- 新增用例「预置的未登记样本以黄卡出现」：`data-registered="false"`、`class` 含 `is-unregistered`、总数 37（36 + 1）
- 既有 `devHostAsset.test.tsx` 一个字未改：36 张 / 38 条 / 分类数 / 撤销屏障四条断言仍全绿

## Task Outcomes

1. **Task 1：真实文件选择 → 卡片出现 → 保存 → 列表含新名字** —— 新建测试文件、两个 helper（`createHost` / `openAssetPanel` / `pickFile`）与两条用例；`test -- devHostAssetAdd` 1 文件 / 5 用例通过，typecheck 通过
2. **Task 2：重新切入后仍然在（同会话内）** —— 抽出 `addAndSave`，新增关标签重开与第二个核心两条用例；`test -- devHostAssetAdd` 与全量 `test` 均通过
3. **Task 3：开发宿主预置一个未登记样本** —— `assetDemo.ts` 两个函数 + 一个常量、`main.tsx` 接线、`createHostWithUnregistered` 与黄卡用例；全量测试、typecheck、prettier 均通过

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - 类型错误] 选文件前先把演示字节复制成 `Uint8Array<ArrayBuffer>`**
- **Found during:** Task 1（`typecheck` 首次运行）
- **Issue:** `ASSET_DEMO_FILES` 的内容类型是 `string | Uint8Array`，窄化后仍是 `Uint8Array<ArrayBufferLike>`，直接交给 `new File([bytes], ...)` 报 TS2322（`ArrayBufferLike` 不满足 `BlobPart` 的 `ArrayBufferView<ArrayBuffer>`）
- **Fix:** `pickFile` 里用 `new Uint8Array(source.length)` 复制一份（推断为 `Uint8Array<ArrayBuffer>`），再交给 `File`；`arrayBuffer` 替身也返回这份复制的 `buffer`，内容与选中字节完全一致
- **Files modified:** `packages/apps/editor-dev/src/__tests__/devHostAssetAdd.test.tsx`

其余按计划执行：未改 `editor-core` / `editor-impl` 的任何行为，未给 `AssetPanel` / `AssetToolbar` / `AssetFileInput` 加测试专用入口，未把未登记样本塞进 `ASSET_DEMO_FILES`，未改既有 `devHostAsset.test.tsx`。

## Issues Encountered

- 选文件必须等首屏 `hero.png` 出现后再做：`loadCategory` 只在入口检查 `unsaved`，若在它挂起期间新增，返回的目录结果可能覆盖刚追加的内存条目。`addAndSave` 与用例一都先等首屏就绪，规避该竞态
- 全量测试仍有既有的 jsdom `window.getComputedStyle` 未实现噪音（来自 antd `@rc-component/portal`），不影响退出码与用例结果

## Verification Evidence

| 命令 | 结果 |
|------|------|
| `pnpm --filter @motajs/editor-dev test -- devHostAssetAdd` | 1 file / 5 tests passed，exit 0 |
| `pnpm --filter @motajs/editor-dev test` | 6 files / 34 tests passed，exit 0 |
| `pnpm --filter @motajs/editor-dev typecheck` | exit 0（`tsc -b` 无输出） |
| `pnpm exec prettier --check <3 个改动文件>` | All matched files use Prettier code style，exit 0 |

## Threat Flags

无新增信任边界：本计划只加测试与开发宿主的演示数据，仍走既有 `AssetFileInput` / `AssetPanel.addAsset` / `save` 与既有文件名清洗、体积上限校验。

## Known Stubs

无。

## Next Phase Readiness

- 03-37 人工验收可直接在 `pnpm --filter @motajs/editor-dev dev` 里复用同一条路径：工具栏「新增素材」选文件 → 保存 → 关标签重开仍在；图片分类里已有一张黄色 `unregistered.png` 可直接做「注册 → 保存 → 两次确认注销 → 保存」流程
- 本计划未产生提交（按要求由用户独立验证后提交）；工作区另有执行前已存在的 `.gsd/dispatch-isolation-sentinel.json`、`.planning/phases/02.1-resource-layer/*` 改动，与本计划无关

---

*Phase: 03-asset*
*Completed: 2026-10-21*

## Self-Check: PASSED

- 文件存在：`packages/apps/editor-dev/src/__tests__/devHostAssetAdd.test.tsx`；`packages/apps/editor-dev/src/demo/assetDemo.ts`、`packages/apps/editor-dev/src/main.tsx` 已修改
- 未修改 `STATE.md`、`ROADMAP.md`、`.planning/phases/04-map/**` 或 `packages/apps/editor-dev` 以外的包
- 本计划未产生提交（用户要求独立验证后自行提交）；工作区其余改动均来自执行前
