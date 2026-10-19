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
- gap_id: G-03-3
  truth: "瘦身转码弹窗：素材列表【竖向】排列、过长时自身滚动并加滚动条；区域之间加分割线，整体不挤；确认开始后在弹窗上显示「正在转码」，完成只用全局 antd message 提示；转码前说明输出格式（图片→webp、音频→webm 容器的 opus）；去掉会顶下内容的顶部提示行；去掉无法关闭、转码成功后一直存在的绿色背景提示"
  status: failed
  reason: "User reported: 转码弹窗素材列表横着排应竖排+滚动、Modal 太挤要加分割线、成功后顶部多出一行提示（顶下内容）要删、绿色背景提示无法关闭且常驻要删、转码中应在 Modal 上显示、完成用 antd message 全局提示、要说明转成什么格式"
  severity: major
  test: 2
  artifacts: []
  missing: []
- gap_id: G-03-4
  truth: "演示数据与网格：内置三四十个图片素材（含长方形等多样尺寸）以方便测试滚动等边界；提供一个 slider 调节预览图标大小（直接调整个素材卡片框的大小）"
  status: failed
  reason: "User reported: 素材数量太少不好测滚动；建议加三四十个内置图片素材；图片不要只加正方形，加些长方形；加 slider 调节预览图标大小（调整个框）"
  severity: major
  test: 2
  artifacts: []
  missing: []
- gap_id: G-03-5
  truth: "转码默认参数：图片（WebP）默认品质 100；音频（Opus）默认使用源音频原本的采样率与码率（能读到时），读不到则回退 128 kbps + 48000Hz"
  status: failed
  reason: "User reported: webp 默认品质设 100；opus 默认用音频原本采样率与码率，读不到再用 128k + 48000"
  severity: minor
  test: 2
  artifacts: []
  missing: []
- gap_id: G-03-6
  truth: "配置表单的枚举下拉显示【字符串标签】而非裸数字（如 read→整图/网格/…、usage→常规图/图块/图块集），但写回仍存数字；标签由 schema 携带、引擎按标签渲染选项"
  status: failed
  reason: "User asked: 能不能把数字枚举显示为字符串的选择栏（下拉现在是 0 1 2 3），实际存储仍为数字——如果可以最好这么做"
  severity: major
  test: 1
  artifacts: []
  missing: []
