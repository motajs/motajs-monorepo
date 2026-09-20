# motajs-monorepo

## What This Is

`motajs-monorepo` 是 mota-js（魔塔）游戏引擎的编辑器与宿主工具集合：一个 pnpm workspace，包含 `@motajs/editor`（React 19 的可视化编辑器）、`@motajs/service-worker`（生产宿主与项目编排）以及一组共享库。本期目标是把编辑器最底层、引擎无关的能力下沉为 `@motajs/editor-core`，让编辑器变成 core 的一个默认实现，从而同时服务现有引擎、未来新引擎和第三方定制/插件生态。

## Core Value

**把编辑器内核与引擎细节彻底解耦**——通过一层引擎无关的 `editor-core` 接口，让新旧引擎共用同一套编辑能力，并让第三方可以高自由度地定制编辑器，而不必反复维护多个版本。

## Requirements

### Validated

<!-- Shipped and confirmed valuable. Inferred from `.planning/codebase/`. -->

- ✓ 编辑器为 host-agnostic 静态产物，通过注入的 endpoint URL 获取项目数据 — existing
- ✓ 分层数据流 `ProjectData -> ProjectModel -> Commands -> UI` — existing
- ✓ Memory-first 响应式资源（`Content<T>` + alien-signals），异步最终一致持久化 — existing
- ✓ 命令 + 撤销/重做历史（inverse operations，容量 100）— existing
- ✓ 地图编辑（PixiJS，层/块/通行性绘制）— existing
- ✓ 代码编辑（Monaco）+ Blockly 事件脚本编辑 — existing
- ✓ 表格/数据配置编辑（schema 驱动表格）— existing
- ✓ 素材管理（图片/动画/材质）— existing
- ✓ Service Worker 宿主：FS API、项目注册表（Dexie + File System Access）、preview、editor release manager — existing
- ✓ 开发宿主插件 `vite-plugin-mota-server.ts`（本地 FS API、预览、热重载）— existing

### Active

<!-- Current scope. Building toward these. -->

- [ ] 从 `@motajs/editor` 抽取引擎无关的 `@motajs/editor-core`（`packages/libs/editor-core`，包名 `@motajs/editor-core`）
- [ ] `editor-core` 内置四大编辑能力：代码编辑、表格编辑、地图编辑、素材管理
- [ ] `editor-core` 内部持有固定布局与外壳，本期不支持布局自定义
- [ ] `editor-core` 不假设引擎文件结构、不擅自读取任何文件；地图等所需数据通过**注册的钩子接口**注入
- [ ] 四大块对定制者开放（具体定制方式后续讨论）
- [ ] `@motajs/editor` 改为调用 `editor-core`，自身承担 mota-js 引擎适配
- [ ] 重构期间 `@motajs/editor` 对外行为（功能 / UI / 宿主协议）完全不变
- [ ] 为未来插件生态预留扩展点（本期不实现插件加载/注册机制）
- [ ] Blockly 事件编辑器作为编辑器能力纳入 core（归入 code 能力：通用 Blockly host + schema→block 编译框架；`blockly/project/*`、领域 schema、事件字段绑定、诊断经适配器注入）

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- `@motajs/editor-next`（新引擎专用编辑器）— 本期不构建，待 `editor-core` 生态稳定后另开里程碑
- 插件加载 / 注册 / 生命周期机制 — 本期只留扩展点，避免范围膨胀
- 布局自定义 — 实现难度大、收益低，明确不做
- `editor` 的功能、UI、宿主协议改动 — 本期为纯重构
- 改动现有引擎侧文件格式 — core 不假设文件结构，适配留在 `editor` 侧

## Context

- 现有编辑器 `@motajs/editor` 的语义层（`project/data`、`project/model`、`project/commands`、`fs`、`runtime`）与 mota-js 文件格式深度耦合；抽 core 的核心工作是把这些语义抽象为**引擎无关的编辑原语 + 注册钩子**。
- 编辑器目前已是 host-agnostic 静态产物，宿主边界清晰（env JSON + HTTP fs + MessageChannel），这为下沉 core 提供了良好基础。
- 宿主有二：开发期为 `packages/apps/editor/vite-plugin-mota-server.ts`，生产期为 `packages/apps/service-worker/src/server/*`。core 不得导入任何宿主代码。
- 现有协议版本：Environment Protocol v1、Runtime Protocol v4、Editor Update Protocol v2、Editor Artifact Manifest schema v2。重构后这些对外契约保持不变。
- 驱动此次拆分的三个原因：① 方便后续新引擎开发（新引擎可无负担地新增功能与配置）；② 支持丰富的插件生态，方便作者使用；③ 用一层底层接口统一新旧编辑器，不再维护多个版本。
- UI 拷贝为简体中文；样式使用 antd + Semi UI + PandaCSS + CSS modules。

## Constraints

- **Tech stack**: TypeScript 5.9 / React 19 / Vite 7 / pnpm workspace catalog 固定依赖版本 — 不因拆分引入不必要的运行时依赖
- **Compatibility**: `@motajs/editor` 对外功能、UI、宿主协议必须保持现状 — 本期为纯重构，回归风险最小化
- **Architecture**: `editor-core` 不得导入宿主或引擎代码；不得擅自读取文件；引擎相关数据一律经注册钩子注入
- **Workspace**: `editor-core` 位于 `packages/libs/editor-core`，作为共享库被 `editor` 依赖；`@/` 别名与 tsconfig 基础沿用 `@motajs/config`
- **Verification**: 判定「行为完全不变」的依据是现有测试全绿 + 关键流程手动验收
- **Process**: 每个 plan 执行前，编排器必须先向用户简报（plan id/goal、大致内容、需要解决的问题、验证方式）并**等待批准**才可执行 — 该门禁覆盖 `--auto` 自动批准；详见 `AGENTS.md` 的 Project Rules

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 抽取 `editor-core` 而非为每个引擎 fork 编辑器 | 统一新旧编辑器，避免多版本重复维护 | — Pending |
| core 引擎无关、不读文件，数据经注册钩子注入 | 新引擎可无负担地新增功能与配置 | — Pending |
| core 内置固定布局，不支持布局自定义 | 布局自定义实现难度大、收益低 | — Pending |
| core 内置四大块（代码/表格/地图/素材）且对定制者开放，集合可能后续扩展 | 当前已敲定范围，保留后续新增与修改权利 | — Pending |
| `editor-core` 放在 `packages/libs/editor-core`（`@motajs/editor-core`） | 作为共享 UI 库被 `editor` 依赖 | — Pending |
| 本期为纯重构，对外行为完全不变 | 降低风险，以现有测试全绿 + 手动验收为准 | — Pending |
| 插件生态本期只留扩展点，不实现机制 | 保持里程碑聚焦 | — Pending |
| `editor-next` 推后到后续里程碑 | 本期只抽 core | — Pending |
| 每个 plan 执行前必须向用户简报并等待批准 | 用户明确要求的执行前门禁，覆盖 `--auto` 自动批准 | — Pending |
| Blockly 事件编辑器纳入 core 的 code 能力 | 现有编辑器已有 Blockly 事件编辑器，属既有能力下沉，非新增 | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-09-20 after initialization*
