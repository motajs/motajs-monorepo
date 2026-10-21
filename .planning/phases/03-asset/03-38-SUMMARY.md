---
phase: 03-asset
plan: 38
subsystem: asset-uat-fixes
tags: [asset-panel, file-input, suffix-whitelist, unregistered, uat]
requires:
  - phase: 03-asset
    provides: "03-36 开发宿主新增素材整合与未登记样本"
  - phase: 03-asset
    provides: "03-37 UAT 失败记录与 G-03-14 / G-03-15"
provides:
  - "文件选择先取文件后清空，修复真实浏览器新增无效"
  - "按分类的内置后缀白名单（图片 / 音频 / 动画 / 字体）"
  - "未登记卡片的深黄边框、内描边与左上角「未登记」徽标"
affects: [03-39 保存模型修订]
actuals:
  tokens: 52000
  tasks: 2
  commits: 2
requirements-completed: []
---

# Phase 03 Plan 38: UAT 修复 Summary

**修好了真实浏览器里「新增没反应」、补了后缀白名单、让未登记黄卡在图片上也看得见。**

## Performance

- **Duration:** 约 35 min
- **Tasks:** 2 / 3（第 3 个 blocking 人工验收被 03-39 接替）
- **Files modified:** 13 个源码 / 测试文件（另加本 SUMMARY）

## Accomplishments

- `AssetFileInput.tsx`：先取 `event.target.files` 里的文件，再清空 `value`；补了能复现旧顺序的回归测试（旧顺序下 3/3 失败）。
- 新增包内私有 `asset/model/internal/assetFileTypes.ts`：四类后缀白名单、`isAssetFileAccepted`、`resolveKindFileExtensions`、`resolveAssetFileExtensions`、拒绝文案；未进 `model/index.ts` / `asset/index.ts`。
- 新增 / 替换 / 未登记扫描共用同一判断；不支持的格式在选中后明确提示。
- 未登记卡片：深黄边框 + 2px 内描边 + 左上角「未登记」徽标，不再依赖会被不透明图片盖住的缩略图背景。
- `collectUnregisteredAssetNames` 只收白名单后缀；按既定取舍，`.svg` / `.oga` / 无后缀不再算未登记候选。

## Verification Evidence

| 命令 | 结果 |
|------|------|
| `pnpm --filter @motajs/editor-impl test` | 65 files / 567 tests passed，exit 0 |
| `pnpm --filter @motajs/editor-dev test` | 6 files / 35 tests passed，exit 0 |
| `pnpm --filter @motajs/editor-impl typecheck` | exit 0 |
| `pnpm --filter @motajs/editor-dev typecheck` | exit 0 |
| 白名单模块私有性检查（barrel 不含 `assetFileTypes`、无 `model/internal/index.ts`） | PASS |
| Prettier / ESLint（改动文件） | 通过 |

## Deviations

- 后缀数组用 `Object.freeze` 包裹，满足模块级可变容器门禁；名称、类型、取值不变。
- `AssetPanel.onReject` 仍走 antd `message.info` 顶部提示，而不是面板内红色错误条；`assetPanel.ts` 不在本计划文件范围，未改。

## UAT / Ledger

- 03-38 的 blocking 人工验收**未执行**，按用户后续决定由 03-39 接替；`03-UAT.md` 仍保持 Tests 4/5 fail、G-03-14 / G-03-15 open。
- 本 SUMMARY 不声称两条缺口已解决；收口由 03-39 在其人工验收通过后完成。
- 用户新增决定（见 `03-CONTEXT.md` §J）：新增 / 注册自动保存，切出面板自动保存，保存按钮在有未保存改动时变黄。
