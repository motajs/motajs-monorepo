---
phase: 03-asset
plan: 37
subsystem: asset-uat
tags: [asset-panel, uat, unregistered, add-asset, gaps]
requires:
  - phase: 03-asset
    provides: "03-33 未登记扫描 / 注册 / 注销数据动作"
  - phase: 03-asset
    provides: "03-34 未登记黄卡与两步注销界面"
  - phase: 03-asset
    provides: "03-35 转码预设界面"
  - phase: 03-asset
    provides: "03-36 开发宿主新增素材顶层整合与未登记样本"
provides:
  - "03-UAT.md Tests 4 / 5 的人工验收结论"
  - "G-03-14：新增图片 / 音频无效"
  - "G-03-15：未登记黄卡未生效；注册后配置校验提示（后者用户决定暂不解决）"
affects: [后续修复计划]
actuals:
  tokens: 1800
  tasks: 3
  commits: 0
requirements-completed: []
---

# Phase 03 Plan 37: 追加人工验收 Summary

**两条追加人工验收未通过：新增素材完全无效；未登记卡片没有黄色背景，注册后还出现配置校验提示。**

## Performance

- **Duration:** 约 20 min（含用户实机操作）
- **Tasks:** 3（2 个人工检查点 + 1 个 UAT 写回）
- **Files modified:** 1（`03-UAT.md`）+ 本 SUMMARY

## Outcomes

- Tests 4「新增素材链路（开发宿主）」：**fail**。用户实测 `.png` / `.jpg` 新增后没有出现新卡片；音频 `.flac` / `.wav` / `.mp3` 同样无法新增。
- Tests 5「未登记素材的注册与注销」：**fail**。未登记素材选中后能正确显示「注册到游戏」，但卡片没有黄色背景；注册后进入时提示「配置不符合该分类的字段定义」。用户明确表示配置校验问题先不解决，后续再考虑方案。
- 已按计划登记 `G-03-14`（新增素材无效，blocker）与 `G-03-15`（黄卡未生效 + 配置校验提示，major）。
- `03-UAT.md` 文首 `status` 改为 `partial`；`## Summary` 改为 `total: 5 / passed: 3 / issues: 2 / pending: 0 / skipped: 0`。
- 既有 Tests 1–3 与 `G-03-1` … `G-03-13` 未改动。

## Deviations from Plan

- 无代码改动（遵循计划「验收失败不改代码，登记为缺口」的约束）。
- 用户补充了一条新需求：面板内置常见后缀白名单，不要什么文件都能选；已写入 `G-03-14` 的 reason，供后续修复计划使用。

## Issues Encountered

- 新增素材在自动化顶层集成测试里通过，但真实浏览器里失败；说明自动化用的 `File` / 文件选择替身没有覆盖真实浏览器路径。后续修复需要先定位真实差异，不能只靠现有测试。
- 黄色背景规则写在缩略图容器上；演示样本是不透明 PNG，图片本身把背景完全盖住，因此看不到黄色。后续应把黄色放到卡片可见区域（或加边框 / 内描边）。

## Verification Evidence

| 命令 | 结果 |
|------|------|
| UAT 结构检查（Tests 4/5 且 `total: 5`） | 通过 |
| UAT 历史检查（`G-03-13` 1 处，新增缺口不重复） | 通过 |
| 人工验收 | Tests 4 / 5 均为 fail（用户实机确认） |

## Next Phase Readiness

- 需要一份后续修复计划，处理：新增素材真实浏览器路径、常见后缀白名单、未登记黄卡的可见性。
- 「注册后配置不符合字段定义」暂不进入修复范围，等用户确定方案。
