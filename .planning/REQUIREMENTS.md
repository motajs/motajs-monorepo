# Requirements: motajs-monorepo

**Milestone:** v1.0 — editor-core 空壳 + editor-impl 重做
**Defined:** 2026-10-09

## v1.0 Requirements

按「先做外壳，再按顺序补齐 editor-impl 各能力」组织。每条都是可观察、可验收的用户能力。

### SHELL（编辑器外壳）

- [ ] **SHELL-01**: 编辑器以固定外壳呈现（固定布局 + 命名插槽），完成后画面与现状一致（用户可看到并操作外壳）

### CORE（通用接口）

- [ ] **CORE-01**: `editor-core` 暴露通用 fs 接口（**只定义接口、不提供实现**），由外部注入真正的实现

### TABLE（表格）

- [ ] **TABLE-01**: 用户可编辑 schema 驱动的表格数据

### ASSET（素材）

- [ ] **ASSET-01**: 用户可管理素材（图片 / 动画 / 材质）

### MAP（地图）

- [ ] **MAP-01**: 用户可编辑地图（层 / 块 / 通行性）

### CODE（代码）

- [ ] **CODE-01**: 用户可编辑代码（Monaco）

### EVENT（事件编辑器）

- [ ] **EVENT-01**: 用户可编辑事件脚本（Blockly）

## Future Requirements

- 剩余全局能力（命令 / 快捷键 / 通知 / 设置 / 主题等）——后续再排
- 插件加载 / 注册 / 生命周期机制——本期只留扩展点

## Out of Scope

- 旧的「能力抽取 / 引擎适配器（EngineAdapter）/ 预览服务 / shim 删除」那一套——**已作废**（用户 2026-10-09 决定）
- 布局自定义——实现难度大、收益低
- 旧的 Phase 1–5（除已完成的 `editor-core` 重做外）——视为过时

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SHELL-01 | — | Pending |
| CORE-01 | — | Pending |
| TABLE-01 | — | Pending |
| ASSET-01 | — | Pending |
| MAP-01 | — | Pending |
| CODE-01 | — | Pending |
| EVENT-01 | — | Pending |
