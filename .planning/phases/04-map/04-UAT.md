---
status: complete
phase: 04-map
source: 04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md, 04-04-SUMMARY.md, 04-05-SUMMARY.md, 04-06-SUMMARY.md, 04-07-SUMMARY.md, 04-08-SUMMARY.md, 04-09-SUMMARY.md, 04-10-SUMMARY.md, 04-11-SUMMARY.md, 04-12-SUMMARY.md, 04-13-SUMMARY.md, 04-15-SUMMARY.md, 04-16-SUMMARY.md, 04-17-SUMMARY.md
started: 2026-10-22T15:06:05Z
updated: 2026-10-22T15:06:05Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Pixi 画布真实绘制
expected: 浏览器里打开地图后，画布按图层显示真实图块；高于当前层的图层受不透明度滑块影响，低层与当前层保持清晰。
result: issue
reported: "没有开启显示通行度。进入小营地地图时，地图会显示红色，不透明度会影响红色的不透明度，说明红色是地面层的颜色。"
severity: cosmetic

### 2. 真像素观感与真实指针手感
expected: 行列标尺字号清晰；通行度箭头在深浅图块上都可读；空格棋盘格可辨；按住左键拖拽连续落笔、右键拖拽框选的手感与预期一致。
result: issue
reported: "通行性显示看不懂，现在的显示效果是，打开后只展示一个红色十字，白色描边。素材区所有素材全部没有加载，无法判断画地图的时候表是否正确。建议使用不同颜色的色块实现。"
severity: major

### 3. 首次打开地图属性即看到字段行
expected: 点一次「地图属性」，抽屉里立即出现「名称」与「初始金币」两行字段及输入框；不需要再点第二次、不需要切标签或刷新外壳。改值后可撤销 / 重做并保存。
result: issue
reported: "依然是这样，抽屉里面只有一个粗的灰线"
severity: major

## Automated Coverage (pre-passed)

以下 65 项已由自动化测试或命令覆盖，按 `gsd-verify-work` 规则预先记为 pass，不再逐条询问。

| Plan | ID | 覆盖内容 |
|------|----|----------|
| 04-01 | D1 | 命名与接口报告（16 个计划节 + 12 项开放问题决议 + 范围修订记录 + 待确认清单） |
| 04-01 | D2 | 地图域类型与常量声明，整包可编译且通过两条结构门禁 |
| 04-02 | D1 | `IEditorPanel` 新增可选方法 `onBeforeClose?(): Promise<boolean>`，JSDoc 写清调用时机、返回值含义与不会询问的内部路径 |
| 04-02 | D2 | `ITableGridProps` 新增可选成员 `readonly formMode?: boolean`，JSDoc 说明 true 时只渲染字段行 / 值控件、缺省 false 且既有调用点不受影响 |
| 04-02 | D3 | 本计划没有任何行为变化：`shellSystem.ts` 与 `TableGrid` 渲染函数均未被改动 |
| 04-03 | D1 | 地图测试夹具：自持的 `FakeFileSystem`（八个文件系统方法 + seed / failing / hanging）、`createMapHarness`、文档与图块目录样例构造器 |
| 04-03 | D2 | 文档层纯函数：校验、净变化合并、按层不可变写入、图块目录空判定 |
| 04-03 | D3 | 纯渲染模型：可见格、zIndex 层序与透明度、网格线、大地图适配居中、通行度红点降级、框选 / 预览 / 悬停透传 |
| 04-03 | D4 | `@motajs/editor-impl/map` 子路径按 `types → constants → model` 顺序导出模型层 |
| 04-03 | D5 | 两条结构门禁保持为绿（引擎中立词、模块级可变状态） |
| 04-04 | D1 | 宿主注入地图后，外壳里出现地图面板，状态走到就绪，渲染模型送达画布 |
| 04-04 | D3 | 左键落笔后当前格变成调色板第一个图块，并出现未保存标记 |
| 04-04 | D4 | 保存把整份地图数据域（标识 / 宽 / 高 / 完整图层）交回宿主并清掉未保存标记 |
| 04-04 | D5 | 保存失败时宿主错误按纯文本显示，内存改动与未保存标记保留 |
| 04-04 | D6 | 图块目录为空时拒绝落笔：文档不变、不置脏、不登记撤销 |
| 04-04 | D7 | 图块图片路径 → 资源层字节 → blob 地址，可疑路径被拒绝且不请求资源层 |
| 04-05 | D1 | 格子几何：正交路径（先走差值大的轴）、矩形展开（含边界、行优先）、矩形归一化、按地图尺寸裁剪并统计被裁格数 |
| 04-05 | D2 | 多格笔刷：单点落笔写满图案、线覆盖后写覆盖先写、矩形内按图案平铺、填充位置平铺、全 0 擦除、缺格按 0 |
| 04-05 | D3 | 四邻域连通填充：只收集同值连通格，对角不算连通，越界不访问，200×200 全同值不爆栈 |
| 04-05 | D4 | 区域复制 / 粘贴 / 清空：复制只含当前层数字块、粘贴以给定格为左上角且越界逐格跳过并计数、清空等同写 0 |
| 04-05 | D5 | 模型层不依赖 DOM / Pixi / editor-core，且没有模块级可变状态 |
| 04-06 | D1 | 只读通行度：每格只输出不可通行方向，空格 / 未知编号 / 普通层的 onlyEventLayer 图块不输出；输出可直接喂给渲染模型得到箭头或红点 |
| 04-06 | D2 | 最近使用列表：过滤非正整数与未知编号、去重保序、按上限截断、置顶更新，坏输入不抛错 |
| 04-06 | D3 | 脏状态：文档几何 / 图层名 / 图层顺序 / 属性表与基线比较，撤销回基线后重新变干净 |
| 04-06 | D4 | 名字与尺寸校验：空名 / 重名 / 非整数 / 越界返回逐字文案或 null，超限不夹取 |
| 04-07 | D1 | Panel lists host maps, opens one map and switches to another, dropping late results |
| 04-07 | D2 | Manual save submits only dirty domains and rebases on the sent snapshot |
| 04-07 | D3 | One stroke is one undo record; cross-map payloads are ignored; barriers block undo |
| 04-08 | D1 | 新建地图弹窗：默认值、尺寸上限提示、行内校验、创建中禁用、宿主失败不关闭 |
| 04-08 | D2 | 新增图层弹窗：预填图层 N、聚焦全选、行内错误、创建中禁用 |
| 04-08 | D3 | 宿主执行的新建地图 / 新增图层：新文档打开、当前层正确、层名写入文档、不置脏、登记屏障 |
| 04-08 | D4 | 未保存确认：四个入口共用同一询问，保存失败不继续，放弃回基线并登记屏障，关闭标签接 onBeforeClose |
| 04-08 | D5 | 最近使用：从项目文件读出、落笔写回、坏文件忽略、清除写空、写失败不打断绘制 |
| 04-09 | D1 | TableGrid 表单模式：工具栏与 Schema 横幅不渲染，字段行与改值回调照旧；既有表格零回归 |
| 04-09 | D2 | 地图属性域：读整表、一字段一条撤销、保存整表、开/关抽屉不丢内存改动、危险路径被拒 |
| 04-09 | D3 | 地图属性抽屉：受控开合、表单模式、加载/失败/空/就绪四态、没有第二个保存入口 |
| 04-10 | D1 | Two-row toolbar with map identity, create/properties/save, layer segmented, layer add, brush mode, passability, big map, viewport buttons and above-layer opacity slider |
| 04-10 | D2 | First-open inline map list and its loading/list-error/no-map/unopened states |
| 04-10 | D3 | Status bar with coordinate/selection/map/layer/mode segments and narrow-width priority hiding |
| 04-10 | D4 | Panel view assembly of toolbar, body, save notice, three controlled dialogs and the properties drawer |
| 04-11 | D1 | Three fixed sections: erase cell, recent used, grouped collapsible 32px grids with sticky headers |
| 04-11 | D2 | Empty catalog shows 暂无可用的图块 and renders no tile buttons; loading and failure states keep group headers and offer retry |
| 04-11 | D3 | Missing tile images render a placeholder badge but stay focusable, selectable and paintable |
| 04-11 | D4 | Same-group drag select builds a W×H row-major pattern with missing cells as 0; releases show the W×H label |
| 04-11 | D5 | Recent used section: 6-column grid, order preserved, unknown numbers skipped, destructive clear behind a confirm dialog |
| 04-12 | D1 | 画布手势：线 / 矩形 / 填充 / 擦除，一笔只提交一次、只登记一条撤销 |
| 04-12 | D2 | 右键三态：拖拽框选、单击菜单、绘制中取消；Escape 三级优先级 |
| 04-12 | D3 | 复制 / 粘贴 / 清空选区：只在画布聚焦时响应，越界裁剪有提示，各一条撤销 |
| 04-12 | D4 | 视口与大地图：方向键 / 滚轮 / Shift+滚轮移动，进出大地图还原视口 |
| 04-12 | D5 | 叠加层：网格 / 悬停 / 预览 / 框选 / 通行度箭头与大地图红点都由渲染模型驱动 |
| 04-12 | D6 | 右键菜单四项文案、启用条件、键盘（焦点 / ↑↓ / Enter / Escape）与贴边翻转 |
| 04-13 | D1 | 演示宿主地图适配器：扁平文件转中立文档，保存数据域保留事件 / 属性 / 额外字段，保存属性域保留几何 |
| 04-13 | D2 | 两张演示地图 + 两组图块（含一组缺图）+ 两字段属性 Schema，经 tileGroups 注入并注册进开发宿主 |
| 04-13 | D3 | 开发宿主端到端：注册 → 打开 → 画/擦/切层 → 加层 → 改属性 → 保存 → 关闭重开，事件与额外字段不变 |
| 04-15 | D1 | 用户点 ✕ 时外壳询问 IEditorPanel.onBeforeClose：回答 true 才移除标签并释放实例，回答 false 全部保留 |
| 04-15 | D2 | 后台标签被关闭时先激活再询问（询问发生时已切入、原前台已切出），同意关闭后活动标签落到相邻标签 |
| 04-15 | D3 | 注销面板类型与释放外壳全程不询问，且注销后不留半截标签（类型、标签、实例一起消失） |
| 04-15 | D4 | 钩子抛错时保留标签并记录日志；未实现钩子的面板（表格/素材类）仍是点了 ✕ 立刻关闭，且关后台标签不动前台 |
| 04-16 | D1 | Real MapPalette mounted in MapPanelView, map-palette-slot removed, shared image paths read once |
| 04-16 | D2 | Tile / recent / erase selection written to IMapPanelViewState.paletteSelection through MapPanel.selectPalette |
| 04-16 | D3 | Empty tile catalog keeps the canvas visible and makes commitCells a no-op; failed images retry through MapPanel.reloadTileImages without touching the document |
| 04-16 | D4 | MapRecentClearDialog mounted with the palette; 04-10 toolbar capability flags and callbacks wired from MapPanel so toolbar actions reach the panel |
| 04-17 | D1 | 属性抽屉第一次打开即显示宿主 schema 的字段行，不需要切标签 / 重渲染外壳 / 任何额外用户动作 |
| 04-17 | D2 | 属性加载状态 / 行树 / 错误只有一个来源（视图状态），视图不再持有构造时的一次性副本 |
| 04-17 | D3 | 切图 / 关图 / 新建 / 字段提交 / 撤销重做之后，抽屉里的行与面板内存属性表一致（每次写入都伴随一次发布） |

## Summary

total: 68
passed: 65
issues: 3
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-04-1
  truth: "地图地面层应显示有区分度的图块，不应整片红色；图块图片缺失时才用橙色占位"
  status: failed
  reason: "User reported: 没有开启显示通行度。进入小营地地图时，地图会显示红色，不透明度会影响红色的不透明度，说明红色是地面层的颜色。"
  severity: cosmetic
  test: 1
  artifacts: []
  missing: []

- gap_id: G-04-2
  truth: "通行度显示应能看懂：不可通行方向要用可区分的颜色 / 色块表达，而不是只有一个红色十字"
  status: failed
  reason: "User reported: 通行性显示看不懂，现在的显示效果是，打开后只展示一个红色十字，白色描边。素材区所有素材全部没有加载，无法判断画地图的时候表是否正确。建议使用不同颜色的色块实现。"
  severity: major
  test: 2
  artifacts: []
  missing: []

- gap_id: G-04-3
  truth: "属性抽屉应显示字段行，不应塌成一条灰线"
  status: failed
  reason: "User reported: 依然是这样，抽屉里面只有一个粗的灰线"
  severity: major
  test: 3
  artifacts: []
  missing: []
