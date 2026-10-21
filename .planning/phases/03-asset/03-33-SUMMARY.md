---
phase: 03-asset
plan: 33
subsystem: asset-registration
tags: [asset-panel, asset-scan, registration, unregister, vitest, list-filter]

# Dependency graph
requires:
  - phase: 03-asset
    provides: "IAssetEntry.registered 必填只读标记与列表写回契约（03-32）"
  - phase: 03-asset
    provides: "AssetPanel.loadCategory / addAsset / buildNewEntryConfig / toListEntries / writeCategory 现有数据层（03-03…03-30）"
provides:
  - "isAssetOriginFileName：判断 -origin 备份文件的纯函数"
  - "collectUnregisteredAssetNames：目录直接文件 → 未登记素材名（去重、升序）"
  - "AssetPanel.registerAsset：未登记条目进内存列表，配置按 defaults 合并，标记未保存"
  - "AssetPanel.unregisterAsset：已登记条目改回未登记并清空配置，不碰任何字节文件"
  - "AssetPanel.loadCategory（行为变更）：已登记条目之后追加未登记条目"
  - "AssetPanel.toListEntries（行为变更）：只写回 registered === true 的条目并重排序号"
affects: [03-34 注册-注销界面, 03-36 开发宿主整合, 03-37 人工验收]

actuals:
  tokens: 5625
  tasks: 2
  commits: 0

tech-stack:
  added: []
  patterns:
    - "扫描是纯逻辑：只吃 listDirectory 的结果与已登记名字，不读文件内容、不递归子目录"
    - "注册 / 注销只改内存条目与 unsaved 标记，落盘仍然只有 AssetPanel.save 一条路"
    - "写回闸口只有一处：toListEntries 过滤 registered === true 并按过滤后顺序重排序号"

key-files:
  created:
    - packages/libs/editor-impl/src/asset/model/assetScan.ts
    - packages/libs/editor-impl/src/asset/model/__tests__/assetScan.test.ts
    - packages/libs/editor-impl/src/asset/__tests__/assetRegistration.test.tsx
  modified:
    - packages/libs/editor-impl/src/asset/model/index.ts
    - packages/libs/editor-impl/src/asset/assetPanel.ts
  deleted: []

key-decisions:
  - "未登记候选逐条过滤：只取 File、跳过点开头 / 列表 / schema / defaults / -origin / 清洗失败，且名字反推路径必须与原路径逐字相等"
  - "未登记条目一律 `exists: true`：文件本来就在目录里，扫描结果即存在证据"
  - "注销保留 path / exists / byteVersion，只把 registered 置 false 并清空 config；不调用 deleteResource / moveResource"
  - "正在配置的素材被注销时先 closeConfig，再替换条目，避免配置表单停在已无配置的条目上"
  - "StringList 分类的列表正文是素材名（不含分类扩展名），与既有 resolveAssetName / resolveAssetBytePath 约定一致"

patterns-established:
  - "扫描规则用纯函数 + 八条单测钉死；面板只负责把结果追加成条目"
  - "注册 / 注销均标记 unsaved，复用现有手动保存模型与 publish 提示"

requirements-completed: [ASSET-01]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "目录里存在、但列表没登记的文件作为未登记条目出现在面板里"
    requirement: "ASSET-01"
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/__tests__/assetRegistration.test.tsx#未登记文件出现在网格里且保存不会把它写进列表"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/model/__tests__/assetScan.test.ts（8 条扫描规则）"
        status: pass
    human_judgment: false
  - id: D2
    description: "隐藏 / 列表 / schema / defaults / -origin / 目录 / 已登记名字都不进候选；带固定扩展名的分类不混入别的文件"
    requirement: "ASSET-01"
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/model/__tests__/assetScan.test.ts#排除隐藏文件、列表文件与 schema 文件 / 排除 defaultsPath 指向的文件 / 排除 -origin 备份 / 跳过已登记的名字 / 动画分类只产出 .anim 对应的名字 / 排除目录条目 / 结果按名字升序返回 / 输入顺序不影响结果"
        status: pass
    human_judgment: false
  - id: D3
    description: "注册后条目进内存列表（配置来自 defaults）并标记未保存；保存后名字写进 .list.jsonc"
    requirement: "ASSET-01"
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/__tests__/assetRegistration.test.tsx#注册后标记未保存且保存写进列表 / 注销后重新注册得到 defaults 配置"
        status: pass
    human_judgment: false
  - id: D4
    description: "保存时只写已登记条目（对象数组与字符串数组两种格式）"
    requirement: "ASSET-01"
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/__tests__/assetRegistration.test.tsx#保存时只写已登记名字（对象数组与字符串数组）"
        status: pass
    human_judgment: false
  - id: D5
    description: "注销只改列表与配置、字节文件仍在；正在配置的素材注销后退回浏览态"
    requirement: "ASSET-01"
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/__tests__/assetRegistration.test.tsx#注销后保存移除登记且字节文件保留 / 注销正在配置的素材会退回浏览态"
        status: pass
    human_judgment: false
  - id: D6
    description: "目录里已有未登记同名文件时新增同名素材被拒绝，既有字节不变"
    requirement: "ASSET-01"
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/__tests__/assetRegistration.test.tsx#目录里已有未登记同名文件时新增被拒绝"
        status: pass
    human_judgment: false

duration: 40min
completed: 2026-10-21
status: complete
---

# Phase 03 Plan 33: 未登记扫描与注册 / 注销数据动作 Summary

**面板现在能看见「文件夹里有、但清单没登记」的素材，并给出「注册到游戏」与「注销」两个只改清单的动作；保存时清单只写已登记条目**

## Performance

- **Duration:** 40 min
- **Tasks:** 2
- **Files modified:** 5（3 新增，2 修改）

## Accomplishments
- 新增 `asset/model/assetScan.ts`：
  - `isAssetOriginFileName` 按「去掉最后一段扩展名后以 `-origin` 结尾」判断备份文件
  - `collectUnregisteredAssetNames` 逐条过滤：只取普通文件、跳过点开头名字、跳过列表 / schema / defaults 文件的末段名、跳过 `-origin` 备份、跳过清洗失败的名字、跳过名字反推路径对不上的文件（让动画等固定扩展名分类不混入别的类型）、跳过已登记名字；去重后 `localeCompare` 升序返回
- `asset/model/index.ts` 追加 `export * from './assetScan';`（桶文件仍只有 `export *`）
- `AssetPanel.loadCategory`：无论列表文件存在与否、是否为空，都把本次 `listDirectory` 的结果交给扫描；已登记条目在前、未登记条目在后合并进同一份 `entries`，未登记条目为 `{ name, path: resolveAssetBytePath(category, name), config: undefined, exists: true, registered: false }`
- 新增 `AssetPanel.registerAsset`：找不到或已登记时直接返回；否则用 `AssetPanel.buildNewEntryConfig` 取 defaults 合并后的配置，替换成 `registered: true` 条目、标记未保存、提示「已注册素材，请记得保存」
- 新增 `AssetPanel.unregisterAsset`：找不到或本就未登记时直接返回；正在配置该素材时先 `AssetPanel.closeConfig()`；替换成 `registered: false`、`config: undefined`（保留 `path` / `exists` / `byteVersion`），标记未保存、提示「已注销素材，请记得保存」；方法体内不出现 `deleteResource` / `moveResource`
- `AssetPanel.toListEntries`：只转换 `registered === true` 的条目，并按过滤后的顺序重算 `index`；`writeCategory` / `save` 其余逻辑不变
- 新增 8 条扫描单测与 7 条数据层集成用例；既有素材测试 198 条全部保持通过

## Task Outcomes

1. **Task 1: 扫描未登记文件的纯函数** —— 两个纯函数、桶导出与八条单测；`test -- assetScan` 8/8 通过，typecheck 通过
2. **Task 2: 面板合并未登记条目 + 注册 / 注销 + 写回只写已登记** —— 数据层四处改动与七条集成用例；`test -- asset` 22 文件 / 198 用例通过，typecheck 通过，prettier 通过

## Deviations from Plan

None - plan executed exactly as written.

**说明（非偏差）：** 计划要求「注册 / 注销仍走手动保存」，实现严格如此——两个方法只改内存条目与 `unsaved`，没有任何自动落盘；未登记条目不会出现在 `StringList` 数组正文里，也不会出现在 `ObjectList` 的对象数组里。

## Issues Encountered
- 素材测试输出中仍有既有的 jsdom `window.getComputedStyle` 未实现与 antd `addonAfter` 弃用警告，属于测试环境噪音，不影响退出码与用例结果。

## Verification Evidence

| 命令 | 结果 |
|------|------|
| `pnpm --filter @motajs/editor-impl test -- assetScan` | 1 file / 8 tests passed，exit 0 |
| `pnpm --filter @motajs/editor-impl test -- asset` | 22 files / 198 tests passed，exit 0 |
| `pnpm --filter @motajs/editor-impl typecheck` | exit 0（`tsc -b` 无输出） |
| `pnpm exec prettier --check <5 个改动文件>` | All matched files use Prettier code style，exit 0 |
| `Select-String` 引擎标识术语（tower/floor/loc/…/mota） | 新增与修改的生产源码 0 命中 |

## Known Stubs
无。

## Next Phase Readiness
- 03-34 可直接在详情面板接 `AssetPanel.registerAsset` / `AssetPanel.unregisterAsset`，用 `entry.registered === false` 作为「未登记」视觉与按钮判据
- 03-36 可在开发宿主里放一张未登记样本，验证「灰色卡片 → 注册 → 保存」的顶层链路
- 本计划未产生提交（按要求由用户在独立验证后提交）；本计划只改动计划列出的 5 个文件，工作区另有执行前已存在的 `.gsd/dispatch-isolation-sentinel.json` 与 `.planning/phases/02.1-resource-layer/*` 改动，与本计划无关

---

*Phase: 03-asset*
*Completed: 2026-10-21*

## Self-Check: PASSED

- 文件存在：`assetScan.ts`、`assetScan.test.ts`、`assetRegistration.test.tsx`；`assetPanel.ts` 与 `model/index.ts` 已修改
- 未修改 `STATE.md`、`ROADMAP.md`、`packages/apps/**` 或计划外源文件
- 本计划未产生提交（用户要求独立验证后自行提交）；工作区其余改动均来自执行前
