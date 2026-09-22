# Requirements: motajs-monorepo

**Defined:** 2026-09-20
**Core Value:** 把编辑器内核与引擎细节彻底解耦——通过一层引擎无关的 `editor-core` 接口，让新旧引擎共用同一套编辑能力，并让第三方可以高自由度地定制编辑器，而不必反复维护多个版本。

## v1 Requirements

本期里程碑的承诺范围：从 `@motajs/editor` 抽取引擎无关的 `@motajs/editor-core`，`editor` 改为调用之，对外行为完全不变。每条需求映射到 roadmap 的阶段。

### Kernel & Runtime

- [ ] **KERN-01**: `createEditorCore(config)` 返回 per-instance `EditorCore`，取代 6 个模块级 singleton（`projectData`/`projectModel`/`operationHistory`/`FileHandlerManager`/`persistenceMonitor`/`editorConfigService`）
- [ ] **KERN-02**: `EditorCore` 提供 `dispose()`，按创建逆序释放
- [ ] **KERN-03**: 公开 capability registry（`registerCapability(kind, id, value, {owner, replaceable})` 返回诊断 + rollback、`getCapability`、`getCapabilityOrThrow`、`snapshotCapabilities`），与私有 service wiring 分离
- [ ] **KERN-04**: `createEditorCore()` 聚合所有注册诊断，必需注册未解析则启动即失败（registration 可诊断、construction 原子）
- [ ] **KERN-05**: `EDITOR_CORE_API_VERSION` 常量 + `DiagnosticBus`
- [ ] **KERN-06**: 两个 `EditorCore` 实例可并存互不干扰（隔离测试）

### Ports & Adapter

- [ ] **PORT-01**: core 声明 `EngineAdapter`、`FsPort`、`HostPort`、`PreviewAdapter` 及各 capability port 接口
- [ ] **PORT-02**: core 无 default `Fs`、不解析 DOM/环境、不直接 fetch；由 composition root 注入
- [ ] **PORT-03**: `defineEngine({...})` 在适配器侧生成引擎描述；core 只认逻辑 id，不构造 `project/...` 路径、不检查扩展名
- [ ] **PORT-04**: 10 条硬编码路径变为 `ResourceDescriptor`（逻辑 id、opaque path key、format id、handler、preload 依赖）
- [ ] **PORT-05**: `Json2xDataHandler` 与各领域 `*DataHandler` 移入适配器；core 仅保留通用 `JsonDataHandler`
- [ ] **PORT-06**: 游戏词汇（tower/floor/loc/autopass/autotile/idnum/airwall/commonEvent 等）经 `LabelOverrides` 移出 core
- [ ] **PORT-07**: 引擎格式迁移经 `MigrationHook` 移出 core
- [ ] **PORT-08**: 建立非 mota 的 fake「engine B」适配器，端到端驱动 hook 契约

### Resource & Edit

- [ ] **RES-01**: `src/fs/*` 与 `src/project/resources.ts` 原样迁入 `lib/resources/*`（`Content<T>` 五态、`FileHandler`/`DataHandler`/`BinaryFileHandler`、combinators）
- [ ] **RES-02**: `ResourceRegistry` 支持通用逻辑 id 注册
- [ ] **RES-03**: `FileHandlerManager` 由模块 singleton 改为 per-instance service
- [ ] **RES-04**: `src/project/history/*` 迁入 `lib/edit/*`（`EditorOperation`、`compositeOperation`、`operationHistory` 容量 100、多目标 checkpoint + rollback）
- [ ] **RES-05**: 保持「内存优先 ≠ 已保存」、单一写路径、`not-found` ≠ `error`、每路径串行（一个执行中 + 一个待定）
- [ ] **RES-06**: hook 返回 `ReadonlySignal<Content<T>>`（保持五态响应式），不得用快照或 effect 伪造响应式

### Shell

- [ ] **SHELL-01**: `EditorShell`/`TopBar`/`PersistenceNotification`/错误边界迁入 `lib/shell/`
- [ ] **SHELL-02**: 命名 slot（`PanelSlot`/`WorkspaceSlot`/`ToolbarSlot`/`ModalHost`/`SettingsSlot`），位置编译期固定、内容按 registry 驱动
- [ ] **SHELL-03**: 硬编码的 panel-ID union 泛化为 registry 驱动
- [ ] **SHELL-04**: 布局与 Phase 1 截图基线视觉一致
- [ ] **SHELL-05**: draft guard 泛化为 core 的 per-document dirty registry
- [ ] **SHELL-06**: 内建四大块面板经**与将来扩展相同的 API** 注册（dogfooding）

### Table

- [ ] **TABLE-01**: `lib/capabilities/table-editor/` 抽取（schema 驱动渲染、action-path 编辑、校验 UI、meta 编辑、cell/edit-cell 分离）
- [ ] **TABLE-02**: `table.fieldEditor` + `table.schema` capability kind，分层覆盖优先级（core 默认 → 主题 → 表单级 → `ui:field`/`ui:widget`）
- [ ] **TABLE-03**: 最小 asset-catalog port 注入，使图片选择器不直接访问引擎
- [ ] **TABLE-04**: 引擎 schema、meta 文件映射、领域字段类型（`PassabilityField`、`FloorImagesField` 等）由适配器提供

### Code

- [ ] **CODE-01**: `lib/capabilities/code-editor/` 抽取（Monaco host、以引擎提供 id 为键的文档/模型 registry、文件页签、保存/撤销绑定、dirty 生命周期、诊断面、补全 registry、editor-action/keybinding 贡献接缝）
- [ ] **CODE-02**: `code.language` capability kind；语言配置、补全/输入源、文档 endpoint 由适配器注入
- [ ] **CODE-03**: Blockly 取舍落地：通用 Blockly host + schema→block 编译框架留在 `code-editor`（经同一 registry API 注入 schema pack）；`blockly/project/*`、领域 schema、事件字段绑定、诊断移入适配器
- [ ] **CODE-04**: 明确调和 core command registry 与 Monaco 自带 keybinding/context-key 系统，避免快捷键冲突

### Asset

- [ ] **ASSET-01**: `lib/capabilities/asset-manager/` 抽取（目录/集合资源、append/insert/replace/remove、grid/list + 类型筛选 + 搜索 + 缩略图 fallback + 拖拽赋值 + 引用查询、预览 UI、`RasterCodec` port）
- [ ] **ASSET-02**: `asset.kind` capability kind；素材根/素材种类、材质规格、动画格式处理、codec 由适配器注入
- [ ] **ASSET-03**: reference/diagnostics 服务作为 core service，可被后续插件贡献查询

### Map

- [ ] **MAP-01**: `lib/capabilities/map-editor/` 抽取（Pixi canvas/图层、坐标/网格工具、工具状态机、overlay host、最近使用面板、右键菜单、行列标记、楼层导航）
- [ ] **MAP-02**: `map.tool` + `map.overlay` capability kind（含 activate/deactivate/overlay-draw/input-interception 与 command commit 点）
- [ ] **MAP-03**: 五个语义钩子（block registry、sprite/tileset catalog、passability provider、floor list/organization、loc resolver）由适配器注入；tileset/passability/floor-transform 语义不进入 core
- [ ] **MAP-04**: Pixi 仅存在于 `./map` subpath，不进入 runtime entry

### Preview & Cutover

- [ ] **PREV-01**: `lib/services/preview/` 抽取，Runtime Protocol **v4 线上契约不变**（envelope、provider/context、gateway、`project/` 白名单、单调 revision、300 ms debounce、surface leases、重试策略）
- [ ] **PREV-02**: 引擎 boot hook（`iframeEntry.ts` 的 `loadMod`/`loadImage`/`importFonts` 覆盖）移入适配器的 `PreviewAdapter`
- [ ] **PREV-03**: 删除 6 个 singleton 与所有 re-export shim；`runtime.html` 入口留在 `@motajs/editor`（产物形态不变）

### Extension Surface & Packaging

- [ ] **EXT-01**: 冻结 `EditorExtension` descriptor + 窄 `EditorExtensionContext`（绝不传 `EditorCore` 本体；`apiVersion` 必填、`requires`/`optional`、`activate()` 返回 `Disposable`、两阶段 activate-then-resolve）
- [ ] **EXT-02**: `api-extractor` `.api.md` 报告提交并在 CI 强制
- [ ] **EXT-03**: 版本与弃用策略成文（major 内仅增量、能力门控后提升、minor 弃用 / 下个 major 移除、≥6 个月通知）
- [ ] **EXT-04**: 每个扩展点有 `extensionPointId@v1` 与一份 ADR
- [ ] **EXT-05**: 本期不实现插件加载/激活 loader（仅留描述符形状），生成 subpath exports `.` `./code` `./table` `./map` `./asset` `./shell` `./react`
- [x] **PKG-01**: 建立 `packages/libs/editor-core/`，使用 `lib/` 目录（非 `src/`）、`private: true`、`type: module`、`sideEffects: false`、完整 subpath exports
- [x] **PKG-02**: React/ReactDOM 及所有单例库（antd、Semi、alien-signals、immer、monaco-editor、pixi.js、blockly）声明为 `peerDependencies` + `catalog:default`
- [x] **PKG-03**: core tsconfig 与 `@/` 解析策略在 `tsc -b` 与 Vite 下行为一致（有验证）
- [x] **PKG-04**: PandaCSS `include` 覆盖 `../../libs/editor-core/lib/**/*.{ts,tsx}`，并断言生成 CSS 含已知 core class
- [x] **PKG-05**: React Compiler 覆盖 `packages/libs/editor-core/**` 验证通过

### Verification

- [x] **VERIFY-01**: 初始化 `packages/external/mota-js` submodule 并记录量化基线（各包单测、e2e、生产构建、产物体积对 20 MiB 上限、`editor-manifest.json`、协议常量、四大编辑器 + shell 截图）
- [x] **VERIFY-02**: 新增 PR CI：lint + per-package typecheck + 单测 + 生产构建
- [x] **VERIFY-03**: `PersistExecutor`/`PersistenceMonitor` 特性化测试（错误→重试→idle、并发 latest-wins、持久化失败不回滚 UI）
- [x] **VERIFY-04**: `operationHistory` 特性化测试（容量 100、逆操作、多目标 checkpoint rollback、`set`/`patch` 后资源响应性）
- [x] **VERIFY-05**: `dependency-cruiser` 规则接入 CI（禁止边、singleton 的 `requireZero`、no-cycles）

  > **注（2026-09-21 澄清）**：`requireZero` **不是** dependency-cruiser 或 ESLint 的选项，而是研究阶段提案里的示意简写，唯一出处为 `.planning/research/ARCHITECTURE.md:476`（一个虚构的 `tooling/boundaries.json`），后被抄进 `ROADMAP.md:91` 与本条。
  > 其真实含义是：**core 中的模块级 singleton 必须具有零个边界外依赖者**——只允许 composition root（`lib/kernel/core.ts`）导入它们，任何其他文件导入都算违规。它针对的是 core 自己的 6 个模块级 singleton（`projectData`/`projectModel`/`operationHistory`/`FileHandlerManager`/`persistenceMonitor`/`editorConfigService`），目的是在第一天就把 singleton 的引用面锁死在 composition root，避免四个能力迁完后才暴露 per-instance 障碍。
  > dependency-cruiser 只有 `forbidden`/`allowed`/`required` 三类规则，因此「零依赖者」需表达成普通规则，例如 `forbidden`（`from: { pathNot: '^lib/kernel/core\\.ts$' }`、`to: { path: '…singleton…' }`）或 `required`（`module: { path: '…singleton…', numberOfDependentsLessThan: 1 }`）。
  > **与 PKG-02 区分**：本条约束的是 **core 自身模块级 singleton 的引用面**；PKG-02 约束的是 **外部单例库（react/antd/…）的 peerDependencies 去重**，两者不是同一件事。
- [x] **VERIFY-06**: 静默跳过的 e2e 转为必需 fixture 或 CI 可见标记
- [x] **VERIFY-07**: 保留既有 `runtimeProtocolVersion: 3` vs `RUNTIME_PROTOCOL_VERSION = 4` 不一致（不做「修复」），并有生成式断言记录协议常量
- [ ] **VERIFY-08**: Phase 12 端到端执行「Looks Done But Isn't」清单（双 core 隔离、fake engine-B、dedupe 断言、体积预算、无 re-export-only 文件、无环、e2e 确实运行、视觉一致、生成 CSS 含 core class、单 React 实例 + 信号传播 smoke）

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### 插件生态

- **PLUG-01**: 插件加载 / 激活生命周期与激活事件
- **PLUG-02**: 对第二消费者强制扩展点版本
- **PLUG-03**: 额外 capability packs
- **PLUG-04**: 沙箱 / worker 插件隔离
- **PLUG-05**: marketplace / gallery

### 编辑器扩展

- **NEXT-01**: `@motajs/editor-next`（新引擎专用编辑器）
- **LAYOUT-01**: 布局自定义 / docking
- **COLLAB-01**: 实时协作 / CRDT

### 工程

- **TOOL-01**: 工具链协调升级（TS 7 / Vite 8 / ESLint 10 / Vitest 5 / Blockly 13）
- **PUB-01**: 发布到 npm（tsdown + publint + attw + changesets）

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| core 读取文件或假设引擎文件格式 | 违反本期核心约束（core 引擎无关、数据经注册钩子注入） |
| 布局自定义 / docking | 实现难度大、收益低，明确不做 |
| 从零写代码编辑器 | 复用 Monaco，不重复造轮子 |
| 通用 IDE 功能（终端 / 调试器 / LSP / 多根） | 超出编辑器定位 |
| 实时协作 | 非本期目标 |
| 沙箱化插件隔离 | 插件机制本身推后 |
| marketplace | 推后 |
| core 拥有引擎格式迁移 | 属适配器职责 |
| 运行时脚本执行 / 热重载 | 非本期目标 |
| 新主题 / token 系统 | 保持现有 PandaCSS + antd/Semi 样式系统 |
| 每击键同步向插件推送状态 | 性能与架构反模式 |
| 「修复」`runtimeProtocolVersion` 不一致 | 属于行为变更，本期必须保留 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| KERN-01 | 3 | Pending |
| KERN-02 | 3 | Pending |
| KERN-03 | 3 | Pending |
| KERN-04 | 3 | Pending |
| KERN-05 | 3 | Pending |
| KERN-06 | 3 | Pending |
| PORT-01 | 3 | Pending |
| PORT-02 | 3 | Pending |
| PORT-03 | 5 | Pending |
| PORT-04 | 5 | Pending |
| PORT-05 | 5 | Pending |
| PORT-06 | 5 | Pending |
| PORT-07 | 5 | Pending |
| PORT-08 | 5 | Pending |
| RES-01 | 4 | Pending |
| RES-02 | 4 | Pending |
| RES-03 | 4 | Pending |
| RES-04 | 4 | Pending |
| RES-05 | 4 | Pending |
| RES-06 | 4 | Pending |
| SHELL-01 | 6 | Pending |
| SHELL-02 | 6 | Pending |
| SHELL-03 | 6 | Pending |
| SHELL-04 | 6 | Pending |
| SHELL-05 | 6 | Pending |
| SHELL-06 | 6 | Pending |
| TABLE-01 | 7 | Pending |
| TABLE-02 | 7 | Pending |
| TABLE-03 | 7 | Pending |
| TABLE-04 | 7 | Pending |
| CODE-01 | 8 | Pending |
| CODE-02 | 8 | Pending |
| CODE-03 | 8 | Pending |
| CODE-04 | 8 | Pending |
| ASSET-01 | 9 | Pending |
| ASSET-02 | 9 | Pending |
| ASSET-03 | 9 | Pending |
| MAP-01 | 10 | Pending |
| MAP-02 | 10 | Pending |
| MAP-03 | 10 | Pending |
| MAP-04 | 10 | Pending |
| PREV-01 | 11 | Pending |
| PREV-02 | 11 | Pending |
| PREV-03 | 11 | Pending |
| EXT-01 | 12 | Pending |
| EXT-02 | 12 | Pending |
| EXT-03 | 12 | Pending |
| EXT-04 | 12 | Pending |
| EXT-05 | 12 | Pending |
| PKG-01 | 2 | Complete |
| PKG-02 | 2 | Complete |
| PKG-03 | 2 | Complete |
| PKG-04 | 2 | Complete |
| PKG-05 | 2 | Complete |
| VERIFY-01 | 1 | Complete |
| VERIFY-02 | 1 | Complete |
| VERIFY-03 | 1 | Complete |
| VERIFY-04 | 1 | Complete |
| VERIFY-05 | 2 | Complete |
| VERIFY-06 | 1 | Complete |
| VERIFY-07 | 1 | Complete |
| VERIFY-08 | 12 | Pending |

**Coverage:**

- v1 requirements: 62 total
- Mapped to phases: 62
- Unmapped: 0 ✓

---
*Requirements defined: 2026-09-20*
*Last updated: 2026-09-20 after roadmap creation (traceability mapped to 12 phases)*
