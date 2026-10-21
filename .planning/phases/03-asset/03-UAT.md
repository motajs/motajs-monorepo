---
status: partial
phase: 03-asset
source: [03-17-SUMMARY.md, 03-11-SUMMARY.md, 03-16-SUMMARY.md, 03-15-SUMMARY.md, 03-09-SUMMARY.md]
started: "2026-10-18T00:00:00Z"
updated: "2026-10-21T00:00:00Z"
---

> 正式 UAT 的 3 项已由用户逐项确认通过（用户 2026-10-20 回复 pass）。
> 2026-10-21 追加的第 4、5 项人工验收未通过，已登记为两条新的 open 缺口；其中「注册后提示配置不符合字段定义」用户决定暂不解决。

## Current Test

[testing complete]

## Tests

### 1. 图片 → WebP（真实浏览器）
expected: 图片分类里转码生成 .webp，体积下降、能显示；覆盖时替换原文件、不覆盖时旧文件改名 -origin
result: pass

### 2. 音频 → WebM/Opus（真实浏览器）
expected: 音频分类里转码生成 .webm（容器内 Opus），能播放；不支持 WebCodecs 的浏览器里入口禁用并给出提示（不静默失败）
result: pass

### 3. 素材面板与现状的视觉 / 行为对齐
expected: 布局 / 配色 / 文案 / 交互观感与现有 @motajs/editor 的素材界面一致；浏览 / 上传新增 / 替换 / 删除 / 配置 / 保存 流程顺畅
result: pass

### 4. 新增素材链路（开发宿主）
expected: 经工具栏选本地文件后新卡片出现；保存后 `.list.jsonc` 含新名字；关闭并重新打开面板 / 切走分类再切回后卡片仍在（同一会话内，不要求刷新）
result: fail

### 5. 未登记素材的注册与注销
expected: 宿主预置的 `unregistered.png` 显示为黄色未登记卡片；注册后保存进清单；注销需两次确认、保存后配置消失且回到黄色、文件保留
result: fail

## Summary

total: 5
passed: 3
issues: 2
pending: 0
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
  status: resolved
  resolved_by: 03-22-PLAN.md
  resolved_at: 2026-10-18
  reason: "User reported: 转码弹窗素材列表横着排应竖排+滚动、Modal 太挤要加分割线、成功后顶部多出一行提示（顶下内容）要删、绿色背景提示无法关闭且常驻要删、转码中应在 Modal 上显示、完成用 antd message 全局提示、要说明转成什么格式"
  severity: major
  test: 2
  artifacts: []
  missing: []
- gap_id: G-03-4
  truth: "演示数据与网格：内置三四十个图片素材（含长方形等多样尺寸）以方便测试滚动等边界；提供一个 slider 调节预览图标大小（直接调整个素材卡片框的大小）"
  status: resolved
  resolved_by: 03-23-PLAN.md
  resolved_at: 2026-10-18
  reason: "User reported: 素材数量太少不好测滚动；建议加三四十个内置图片素材；图片不要只加正方形，加些长方形；加 slider 调节预览图标大小（调整个框）"
  severity: major
  test: 2
  artifacts: []
  missing: []
- gap_id: G-03-5
  truth: "转码默认参数：图片（WebP）默认品质 100；音频（Opus）默认使用源音频原本的采样率与码率（能读到时），读不到则回退 128 kbps + 48000Hz"
  status: resolved
  resolved_by: 03-24-PLAN.md, 03-25-PLAN.md
  resolved_at: 2026-10-18
  reason: "User reported: webp 默认品质设 100；opus 默认用音频原本采样率与码率，读不到再用 128k + 48000"
  severity: minor
  test: 2
  artifacts: []
  missing: []
- gap_id: G-03-6
  truth: "配置表单的枚举下拉显示【字符串标签】而非裸数字（如 read→整图/网格/…、usage→常规图/图块/图块集），但写回仍存数字；标签由 schema 携带、引擎按标签渲染选项"
  status: resolved
  resolved_by: 03-20-PLAN.md, 03-21-PLAN.md
  resolved_at: 2026-10-18
  reason: "User asked: 能不能把数字枚举显示为字符串的选择栏（下拉现在是 0 1 2 3），实际存储仍为数字——如果可以最好这么做"
  severity: major
  test: 1
  artifacts: []
  missing: []
- gap_id: G-03-7
  truth: "拖动「图标大小」滑块时，素材卡片框变大，卡片内的图片预览（缩略图）也要跟着变大（不只是框变大、图不变）"
  status: resolved
  resolved_by: 03-26-PLAN.md
  resolved_at: 2026-10-18
  reason: "User reported: 调整图标大小时，图片的预览图没有变大，预期变大"
  severity: major
  test: 1
  artifacts: []
  missing: []
- gap_id: G-03-8
  truth: "图片类素材在右侧详情/配置栏显示图片的尺寸（宽 × 高）"
  status: resolved
  resolved_by: 03-26-PLAN.md
  resolved_at: 2026-10-18
  reason: "User requested: 图片可以在右侧栏显示图片尺寸"
  severity: minor
  test: 1
  artifacts: []
  missing: []
- gap_id: G-03-9
  truth: "转码过程足够慢以至于能看见「正在转码」状态（可放两张超大图片，如 32768×32768，用于观察 busy 态）"
  status: resolved
  resolved_by: 03-27-PLAN.md
  resolved_at: 2026-10-18
  reason: "User reported: 转码太快无法判断有没有显示「正在转码」；影响不大，若要修可放两张超大图片"
  severity: minor
  test: 2
  artifacts: []
  missing: []
- gap_id: G-03-10
  truth: "替换某个素材的字节后，卡片预览、详情预览、图片尺寸都应、【立即】显示新内容（无需切走再切回）"
  status: resolved
  resolved_by: 03-28-PLAN.md
  resolved_at: 2026-10-18
  reason: "Verifier: `useAssetObjectUrl` 只在 `mime` 变化时重读字节；替换后路径与组件 key 未变，故仍是旧 blob。需要字节版本/刷新信号 + 回归测试"
  severity: major
  test: 1
  artifacts: []
  missing: []
- gap_id: G-03-11
  truth: "工程内 `.schema.jsonc` 非法时，配置入口应给出可见的错误态（而不是点了像没反应）；不得静默回退"
  status: resolved
  resolved_by: 03-29-PLAN.md
  resolved_at: 2026-10-18
  reason: "Verifier: `openConfig` 把错误写进 `view.error`，但 `AssetPanelView` 不读该字段；面板仍是 ready，用户看不到任何提示"
  severity: major
  test: 1
  artifacts: []
  missing: []
- gap_id: G-03-12
  truth: "不勾「覆盖旧文件」时，源文件绝不能被覆盖/替换：源应保留为 `{file}-origin.{ext}`；即使源已是目标扩展名，也必须先备份为 `{file}-origin.{ext}` 再写新文件"
  status: resolved
  resolved_by: 03-30-PLAN.md
  resolved_at: 2026-10-20
  reason: "User reported: 不勾替换源文件依然会替换掉源文件。代码缺陷：`targetPath === entry.path` 分支无视 `coverOrigin`，已就地覆盖"
  severity: blocker
  test: 1
  artifacts: []
  missing: []
- gap_id: G-03-13
  truth: "素材在右侧详情栏显示文件大小（人类可读，如 12.3 KB），以便确认转码后体积变小"
  status: resolved
  resolved_by: 03-31-PLAN.md
  resolved_at: 2026-10-20
  reason: "User requested: 现在没有显示大小的地方，不能确认大小变小；建议跟图片尺寸一样在右侧显示"
  severity: minor
  test: 1
  artifacts: []
  missing: []
- gap_id: G-03-14
  truth: "开发宿主里经工具栏「新增素材」选中本地图片或音频后，网格应出现新卡片；保存后 `.list.jsonc` 含新名字，并在关闭重开面板 / 切走分类再切回后仍在（同一会话内）"
  status: open
  resolved_by:
  resolved_at:
  reason: "User reported: 新增图片无效——新增后没有新增卡片，.jpg / .png 都无法新增；音频 .flac / .wav / .mp3 也无法新增。用户建议面板内置常见后缀白名单，不要什么文件都能选。"
  severity: blocker
  test: 4
  artifacts: []
  missing: []
- gap_id: G-03-15
  truth: "未登记素材的缩略图用明显黄色背景标出；注册后进入配置时应符合该分类的字段定义；注销需两次确认、只删登记与配置、保留文件"
  status: open
  resolved_by:
  resolved_at:
  reason: "User reported: 未登记内容选中后能正确显示「注册到游戏」，但卡片没有黄色背景；注册后进入时提示「配置不符合该分类的字段定义」。用户明确表示配置校验问题先不解决，后续再考虑方案；黄色背景未生效需要修。"
  severity: major
  test: 5
  artifacts: []
  missing: []
