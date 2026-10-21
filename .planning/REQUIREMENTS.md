# Requirements: motajs-monorepo

**Milestone:** v1.0 — editor-core 空壳 + editor-impl 重做
**Defined:** 2026-10-09

## v1.0 Requirements

按「先做外壳，再按顺序补齐 editor-impl 各能力」组织。每条都是可观察、可验收的用户能力。

### SHELL（编辑器外壳）

- [x] **SHELL-01**: 编辑器以固定外壳呈现（固定布局 + 命名插槽），完成后画面与现状一致（用户可看到并操作外壳）

### CORE（通用接口）

- [x] **CORE-01**: `editor-core` 定义通用文件系统接口（读 / 写 / 列目录 / 建目录 / 移动 / 删除 / 二进制读写），由外部注入实现；core 的资源系统是该接口的唯一调用方（驱动文件系统、维护项目文件索引与内容缓存）

### DEVHOST（开发宿主，INSERTED）

- [x] **DEVHOST-01**: 提供一个最小可运行的开发宿主（dev-only），可打开并操作 `editor-core` 外壳（及后续 `editor-impl` 能力），用于人工 / 目视验收与手动测试；不随产品发布

### TABLE（表格）

- [x] **TABLE-01**: 用户可编辑 schema 驱动的表格数据；并可在编辑器内**打开**（预设表 + 目录树）/ **新建** / **删除**表格文件（数据 + schema 一对，按文件名约定推导 schema），表格目标为单一数据文件路径

### ASSET（素材）

- [x] **ASSET-01**: 用户可管理素材（图片 / 动画 / 材质）

### MAP（地图）

- [x] **MAP-01**: 用户可编辑地图（层 / 块）；通行性以**只读**叠加层显示（新引擎由图块属性决定，地图上不可单独编辑；2026-10-20 按用户决定修订，见 `04-CONTEXT.md` D-13 / D-23）

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

| Requirement | Phase | Status | Notes |
|-------------|-------|--------|-------|
| SHELL-01 | Phase 1 | Complete | |
| CORE-01 | Phase 1 | Complete | Phase 2.1 修订：已废止原文「接口只声明、不落地实现」的表述；现为 core 的资源系统驱动注入的文件系统 |
| DEVHOST-01 | Phase 1.1 | Complete | |
| TABLE-01 | Phase 2 | Complete | Phase 2.1 扩展：新增「打开（预设表 + 目录树）/ 新建 / 删除」表格文件 |
| ASSET-01 | Phase 3 | Complete | |
| MAP-01 | Phase 4 | Complete | 通行性按用户决定改为只读显示（`04-CONTEXT.md` D-13 / D-23） |
| CODE-01 | Phase 5 | Pending | |
| EVENT-01 | Phase 6 | Pending | |
