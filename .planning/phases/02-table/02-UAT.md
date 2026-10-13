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

[none yet]
