---
status: testing
phase: 02-table
source: 02-02-SUMMARY.md, 02-03-SUMMARY.md, 02-04-SUMMARY.md, 02-05-SUMMARY.md, 02-06-SUMMARY.md, 02-07-SUMMARY.md, 02-08-SUMMARY.md, 02-09-SUMMARY.md, 02-10-SUMMARY.md
started: 2026-10-13T00:00:00Z
updated: 2026-10-13T00:00:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 1
name: 冷启动冒烟测试
expected: |
  从零启动应用（无残留状态）：服务无错启动、任何种子/迁移完成、一个主要查询返回真实数据。
awaiting: user response

## Tests

### 1. 冷启动冒烟测试
expected: 从零启动应用（清掉临时状态后）：应用无错启动，主要页面/接口返回真实数据。
result: [pending]

### 2. 类型面语义与命名一致（02-02 D2）
expected: `@motajs/editor-impl/table` 的类型形状与已确认命名/JSON Schema 方向一致（成员语义、枚举取值、`x-editor`/`x-control` 用法）。
result: [pending]

### 3. 能力接缝形状与命名一致（02-03 D2）
expected: `@motajs/editor-impl/react` 打开器签名、能力包成员全可选、无表达式求值器，符合已确认设计。
result: [pending]

### 4. 表格画面观感（02-04 D6）
expected: 约 400px 固定栏宽、栏间与行间分割线、窄于总宽时横向滚动、行悬停高亮。
result: [pending]

### 5. 长值文本域内部滚动（02-06 D5）
expected: 值高于一行时渲染为可滚动文本域，随内容增长到最大高度后内部滚动。
result: [pending]

### 6. 与旧表格视觉/交互对齐（02-07 D5）
expected: 工具栏位置、折叠交互、列布局与旧编辑器表格整体一致（可微调）。
result: [pending]

### 7. schema 模式观感（02-08 D5）
expected: schema 提示条为一行 muted 文本、窄面板省略号截断；工具栏与成对关键字行（两个小输入）外观合理。
result: [pending]

### 8. 弹窗外观与独立面板行为（02-09 D5）
expected: 弹窗列表滚动、页脚固定、长标签省略号 + title；代码/事件外部编辑为独立面板且切走即关。
result: [pending]

### 9. 表格画面/交互与旧表格视觉对齐（02-10 D4）
expected: 整体目视与旧表格对齐（列宽、分隔线、横向滚动、悬停）。
result: [pending]

<!-- Coverage auto-passed entries (#1602) — deterministically covered by passing tests; NOT presented -->
### 10. [D1/02-02] 类型面子路径可解析并导出完整类型面（typecheck 0）
expected: typecheck 退出 0
result: pass
source: automated
coverage_id: D1

### 11. [D1/02-03] react 子路径可解析并导出完整接缝类型面（typecheck 0）
expected: typecheck 退出 0
result: pass
source: automated
coverage_id: D1

### 12. [D1-D5/02-04] 注册/开面板/设目标/资源层读取/只读四栏渲染/状态文案/文本渲染/脚手全绿
expected: tracer 端到端 + 状态 + 文本渲染测试全绿
result: pass
source: automated
coverage_id: D1-D5

### 13. [D1/02-05] 外壳在活动面板变化时调用 onSwitchIn/onSwitchOut
expected: shellSwitch 测试全绿
result: pass
source: automated
coverage_id: D1

### 14. [D1-D4/02-06] 字段名校验 / ajv 值校验 / 控件推导 / 五个行内控件
expected: validation + inputs 测试全绿
result: pass
source: automated
coverage_id: D1-D4

### 15. [D1-D4/02-07] 字段路径助手 / 统一撤销 / 可编辑叶子行 / 增删
expected: undo + edit 测试全绿
result: pass
source: automated
coverage_id: D1-D4

### 16. [D1-D4/02-08] schema 呈现 / 编辑 Schema 按钮 / D-30 打开文件 / 切入刷新
expected: schemaMode + switchRefresh 测试全绿
result: pass
source: automated
coverage_id: D1-D4

### 17. [D1-D4/02-09] 共享弹窗 / 操作列分发 / 校验后重入 / 注入复制
expected: modals + externalEditor 测试全绿
result: pass
source: automated
coverage_id: D1-D4

### 18. [D1-D3/02-10] 阶段集成流程 / XSS 守卫 / 验证签核
expected: integration 测试全绿 + 门禁 0
result: pass
source: automated
coverage_id: D1-D3

## Summary

total: 18
passed: 9
issues: 0
pending: 9
skipped: 0
blocked: 0

## Gaps

<!-- 2026-10-13 布局核验记录（属“后续规划”，不在本轮 02-15..02-19 之列） -->
- P1 「编辑 Schema」：**有空栏则用当前面板的空栏显示 schema 表**，否则才新开面板（比总是新开更合理）。
- P2 默认列宽 400 → **500**。
- P3 层级缩进对齐：目前**子层级整行变窄且右对齐**，导致各栏纵向对不齐；预期**只有最左“条目”栏变窄/缩进，其余三栏宽度保持不变**。
- P4 条目列左侧加**树形缩进引导竖线**（如 `top` / ` | layer1` / `  |`）；**外边框加粗**。
- P5 列数/列宽公式改为：`N = Math.floor(window.innerWidth / COLUMN_WIDTH)`；每栏宽 = `window.innerWidth / N`；**所有栏等宽**（末栏不再偏宽）。
- P6 窗口变窄时**不出现横向滚动条**。
- P7 演示内容加到 **~100 条**，并测**纵向滚动**。
- P8 嵌套**展开行**（仅含展开能力的那一行，不含其子行）背景**逐级加深**；**缩进宽度缩到现在的 ~3/4**。
- P9 栏分割线目前跟随右侧表格高度 → 两侧高度不一致时**分割线覆盖不全**；应改为覆盖整列高度。
- P10 在 **editor-dev 顶部加撤回/重做按钮**（可放进「编辑」子菜单），方便测试撤销/重做。
- P11 表格内容**靠上对齐 → 改为上下居中对齐**。
- P12 **添加按钮无效（bug）**：现在点添加是把**当前点击那一行的「条目」变成输入框**，输入后**无事发生**（应：在锚点行之后插入新字段，并把新字段写进父对象 `x-order`）。
- P13 `textarea` 要改用 **antd 的 textarea**，否则多行编辑不便（排查是否仍有残留的原生 `textarea`）。
- P14 各栏应**各自独立滚动**；滚动只作用**内容区**，顶部「编辑/添加/删除」与提示行**固定不动**（现在整面板一起滚）。
- P15 每栏表格加**关闭按钮**（放在「在代码编辑器中查看」右侧的 ✕）；**未打开表时不可点**。
- P16 **折叠行的上下边框加粗**（现在太细）。
- P17 **未打开表的栏**，顶部按钮应**右对齐**（现在左对齐）。
- P18 **同一面板内**改 schema 后，其他 schema 编辑栏应**立即同步**（现在要触发 focus 才同步）。
- P19 **折叠行点击行内任意处都应触发折叠**（现在只有点箭头才行）。
