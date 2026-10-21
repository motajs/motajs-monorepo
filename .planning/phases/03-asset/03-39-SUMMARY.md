---
phase: 03-asset
plan: 39
subsystem: asset-save-model
tags: [asset-panel, auto-save, switch-out, unsaved-indicator, uat]
requires:
  - phase: 03-asset
    provides: "03-38 文件选择修复、后缀白名单与未登记黄卡"
provides:
  - "新增 / 注册成功后自动写当前分类的 .list.jsonc"
  - "面板切出时保存所有未落盘分类"
  - "有未保存改动时工具栏保存按钮变黄"
  - "未成功读过的分类绝不自动写盘（loaded 守卫）"
  - "03-UAT.md Tests 4/5 pass、G-03-14/G-03-15 resolved"
affects: [03-40 后续]
actuals:
  tokens: 26000
  tasks: 3
  commits: 2
requirements-completed: [ASSET-01]
---

# Phase 03 Plan 39: 保存模型修订 Summary

**新增 / 注册现在会自动写列表；切出面板会把未保存改动一起写盘；有未保存改动时保存按钮变黄。**

## Performance

- **Duration:** 约 30 min（含用户实机复验）
- **Tasks:** 3 / 3
- **Files modified:** 8 个源码 / 测试文件 + 1 个 VALIDATION + 1 个 UAT

## Accomplishments

- `IAssetPanelState.loaded`：分类是否成功读过盘；`AssetPanel.stateAt` 初始 false，`AssetPanel.loadCategory` 成功置 true，`AssetPanel.setError` 置 false。
- `AssetPanel.writeCategory`：唯一写盘点，新增 `successNotice` 参数并返回 `Promise<boolean>`；开头 `loaded` 守卫，未读分类不写盘、报错并返回 false。
- `AssetPanel.addAsset` / `AssetPanel.registerAsset`：成功后 `await AssetPanel.writeCategory(...)` 自动保存当前分类，提示改为「已新增素材并保存」/「已注册素材并保存」。
- `AssetPanel.onSwitchOut`：改为 `await this.save()`，切出时写盘全部未落盘分类；未读分类由守卫挡住。
- `AssetPanel.save`：聚合计一次「已保存」，被守卫跳过或失败不会假成功。
- `AssetToolbar` + `asset.css`：有未保存改动时保存按钮使用 `is-unsaved` 黄色态；无改动仍是普通禁用态。
- 注销 / 删除 / 转码仍按手动保存；切出面板时会随 `onSwitchOut` 一起落盘。

## Verification Evidence

| 命令 | 结果 |
|------|------|
| `pnpm --filter @motajs/editor-impl exec vitest run src/asset/__tests__/assetAutoSave.test.tsx src/asset/__tests__/assetView.test.tsx` | 2 files / 40 tests passed，exit 0 |
| `pnpm --filter @motajs/editor-impl test` | 70 files / 640 tests passed，exit 0 |
| `pnpm --filter @motajs/editor-dev test` | 6 files / 35 tests passed，exit 0 |
| `pnpm --filter @motajs/editor-impl typecheck` | exit 0 |
| `pnpm --filter @motajs/editor-dev typecheck` | exit 0 |
| UAT 收口闸门（5 pass / 5 total / issues 0 / 15 resolved / 0 open / resolved_by 03-39 = 2） | 通过 |
| 历史闸门（Tests 1–3、G-03-1…13、source/started 未改；无 03-38-PLAN.md） | 通过 |

## UAT

- 用户 2026-10-21 实机复验通过：新增图片 / 音频不点保存即可被第二个面板看到已登记；注册后第二个面板同样已登记；未登记黄卡可见；注销在只切分类时仍保持已登记，切标签页后随切出写盘生效；保存按钮在有未保存改动时明显变黄。
- `03-UAT.md`：status complete，Tests 4/5 pass，Summary 5/5/0；G-03-14 / G-03-15 resolved 到 03-39。
- 「注册后提示配置不符合字段定义」仍未解决，按用户决定暂不处理，只作为已知限制保留。

## Deviations

- 无范围偏差。`INTERFACE-NAME.md` 里曾把 `AssetPanel.autoSaveCategory` 标为取消；实现按计划未新增该包装方法，自动保存直接调用 `AssetPanel.writeCategory`。
- 工作树中 `packages/libs/editor-impl/src/map/**` 等第四阶段并行改动未被触碰、未提交。

## Commits

- `fa444b8` feat(03-39): auto-save added and registered assets and highlight unsaved state
- `3103dc3` docs(03-39): update validation for auto-save model
- 本 SUMMARY 与 `03-UAT.md` 收口随后的文档提交
