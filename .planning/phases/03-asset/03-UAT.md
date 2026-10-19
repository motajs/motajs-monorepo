---
status: testing
phase: 03-asset
source: [03-17-SUMMARY.md, 03-11-SUMMARY.md, 03-16-SUMMARY.md, 03-15-SUMMARY.md, 03-09-SUMMARY.md]
started: "2026-10-18T00:00:00Z"
updated: "2026-10-18T01:00:00Z"
---

## Current Test

number: 2
name: 音频 → WebM/Opus（真实浏览器）
expected: |
  音频分类里转码生成 .webm（容器内 Opus），能播放；不支持 WebCodecs 的浏览器里入口禁用并给出提示（不静默失败）
awaiting: user response

## Tests

### 1. 图片 → WebP（真实浏览器）
expected: 图片分类里转码生成 .webp，体积下降、能显示；覆盖时替换原文件、不覆盖时旧文件改名 -origin
result: issue
reported: "素材管理页面中，所有素材都无法预览（是否为预期？）。选中素材后右侧正常出现工具栏；点击「配置」后表格页面占满整个面板，但仍能看见背后的素材管理页面，且提示「配置校验未通过」，无法返回上一级，无法点击瘦身转码，除输入框外所有按钮等可交互组件都无法交互。期望：点击配置后，中间的素材列表栏被替换为表格组件并保存；左侧的素材类型切换可读取该保存状态来决定打开素材界面还是某个素材的配置界面。"
severity: blocker

### 2. 音频 → WebM/Opus（真实浏览器）
expected: 音频分类里转码生成 .webm（容器内 Opus），能播放；不支持 WebCodecs 的浏览器里入口禁用并给出提示（不静默失败）
result: [pending]

### 3. 素材面板与现状的视觉 / 行为对齐
expected: 布局 / 配色 / 文案 / 交互观感与现有 @motajs/editor 的素材界面一致；浏览 / 上传新增 / 替换 / 删除 / 配置 / 保存 流程顺畅
result: [pending]

## Summary

total: 3
passed: 0
issues: 1
pending: 2
skipped: 0

## Gaps

- gap_id: G-03-1
  truth: "点击某个素材的「配置」后，应在【中间素材列表栏的位置】用表格组件替换该栏（左侧分类导航仍可用），并能「← 返回素材列表」；不应整面板覆盖、不应残留背后面板、不应出现无法返回/无法操作的状态"
  status: resolved
  resolved_by: 03-18-PLAN.md
  resolved_at: 2026-10-18
  reason: "User reported: 点击配置后表格占满整个面板、背后仍见素材管理页面、提示「配置校验未通过」、无法返回上一级、除输入框外所有可交互组件都点不动"
  severity: blocker
  test: 1
  artifacts: []
  missing: []
- gap_id: G-03-2
  truth: "素材网格卡片的『预览图』按分类呈现——图片：图片本身；音频：固定波形图标；动画：暂不做（占位）；字体：用该字体渲染『ABC』。音频在右侧详情/配置栏点击后预览播放（<audio controls>）。演示数据须为可见样例（可看见的小图 / 可播放的 WAV / 真字体）"
  status: resolved
  resolved_by: 03-19-PLAN.md
  resolved_at: 2026-10-18
  reason: "User reported: 所有素材都无法预览；随后给出设计方向：图片用图片本身、音频用固定波形图标、动画暂不做、字体用该字体写 ABC 作为卡片预览图；音频点击后在右侧配置栏预览播放"
  severity: major
  test: 1
  artifacts: []
  missing: []
