# Phase 1.1 — 命名提案（INTERFACE-NAME）

**状态：全部为提案，待用户确认后方可落代码 / 计划 / 配置。**
依据 `AGENTS.md` §Project Rules「重要命名先确认」与 §Code style（方法引用一律写作 `类名.方法名`；类 / 接口 / 枚举不写 jsDoc，`type` 别名要写；不写文件头注释）。每个条目说明「它是干什么的」。

确认方式建议：逐条回复「同意 / 改成 X」。任意条目未确认前，执行阶段不得将其写成代码。

---

## Plan 01 — dev 包骨架与两条契约（`01.1-01-PLAN.md`）

### 包名 `@motajs/editor-dev`（工作区包，`packages/apps/editor-dev`）
- **用途**：本阶段的交付物——一个**开发专用**的 Vite 应用包，用来把 `editor-core` 的外壳真正跑起来供人工 / 目视验收。它是 `private: true`、没有 `build` 脚本、不接入任何产品构建 / 发布链路（D-06）。放在 `packages/apps/` 下会被现有 workspace glob（`packages/apps/*`）自动收纳，无需改工作区配置。

### 脚本 `dev` / `typecheck` / `test`（`package.json` 的 `scripts`）
- **用途**：`dev`（`vite`，端口 `1056`）本地启动开发宿主；`typecheck`（`tsc -b`）做类型检查；`test`（`vitest run`）跑冒烟测试。**刻意不提供 `build`**——根 `pnpm -r run build` 会跳过没有该脚本的包，这是 dev-only 边界的关键（D-06）。

### `EditorCapabilityInstaller`（`type` 别名，`packages/apps/editor-dev/src/installers/types.ts`）
- **用途**：**安装函数约定**（D-05，跨阶段契约）——每个能力 subpath 导出一个此形状的纯函数，宿主集中调用它们完成注册，而不是逐条手工注册面板 / 菜单项。入参是整个 `IEditorCore`，好让安装函数能触达 `core.shellSystem`（`registerPanelType` / `registerMenuItem`）与（必要时）`core.resourceSystem` / `core.undoSystem`。签名 `(core: IEditorCore) => void`。
- **跨阶段说明**：Phase 2 的 `editor-impl/table` 可同时导出同形状的 `installTable(core)` 与面板类型，二者不冲突（与 Phase 2 已锁定的 D-01 一致）。

### `IMemoryBackend`（`interface`，`packages/apps/editor-dev/src/backend/types.ts`）
- **用途**：**内存后端契约**（D-02）——定义「宿主向 core 注入的内存假数据后端」的形状。`extends IEditorCoreInjection`（即同时满足撤销注入 `maxUndoStep`、资源注入五方法、空的外壳注入），并额外提供一个 `seed` 方法用于预置示例数据。
- **成员**：`seed(id: IResourceIdentifier, value: unknown): void` —— 向内存后端预置一个资源的初始内容，并**同时**登记其所属资源列表（否则 `ResourceSystem.requestResource` 会因列表缺失直接返回 `null`）。

### 文件路径（提案）
- `packages/apps/editor-dev/package.json`、`tsconfig.json`、`vite.config.ts`、`index.html` —— 包骨架。
- `packages/apps/editor-dev/src/installers/types.ts` —— 安装函数类型。
- `packages/apps/editor-dev/src/backend/types.ts` —— 内存后端接口。

---

## Plan 02 — 端到端实现（`01.1-02-PLAN.md`）

### `MemoryBackend`（`class`，`packages/apps/editor-dev/src/backend/memoryBackend.ts`）
- **用途**：`IMemoryBackend` 的唯一实现——一个「按 `type` 分桶的两个 Map」内存假数据后端（`content` 存内容、`list` 存各类型的资源标识符列表）。宿主用它给 core 注入数据，使依赖数据的面板能读到内容（D-02）。形状照抄现有测试里的 `FakeEditorInjection`。
- **方法**：`MemoryBackend.seed`、`MemoryBackend.requestResource`、`MemoryBackend.requestResourceList`、`MemoryBackend.writeResource`、`MemoryBackend.createResource`、`MemoryBackend.deleteResource`。

### `DemoPanel`（`class`，`packages/apps/editor-dev/src/demo/demoPanel.ts`）
- **用途**：起步注册的**演示 / 占位面板**（D-04）——证明外壳可注册面板类型、可开实例、可操作、可关闭；它从内存后端读一段示例内容并显示，另有一个按钮写回内容以体现「可操作」。实现 `IEditorPanel` 的全部 12 个成员。

### `DemoPanelView`（模块层函数组件，同文件）与 `IDemoPanelViewProps`（同文件的 props 接口）
- **用途**：演示面板真正的渲染组件（模块层 PascalCase 函数组件，满足 hooks 规则）；`IDemoPanelViewProps` 是其具名 props 类型（项目规则禁止内联对象类型）。它经 `IEditorPanelContext.requestResource` 异步读示例资源并显示。

### `DEMO_PANEL_TYPE`（`const`，同文件）
- **用途**：演示面板的 **`IEditorPanelType` 元信息**——`id`（`'demo'`）、`name`（`'演示面板'`）、`icon`（`null`）、`create`（同步工厂，返回 `new DemoPanel(instanceId, context)`）。安装函数注册的就是它。

### `DemoResourceType`（`const enum`，同文件）
- **用途**：演示示例资源的**类型编号**（`Sample = 1`）。资源标识符的 `type` 是数字，由外层定义；本包用一个枚举代替裸数字。

### `DEMO_RESOURCE_ID` / `DEMO_SAMPLE_CONTENT`（`const`，同文件）
- **用途**：`DEMO_RESOURCE_ID` 是演示资源的标识符（`{ type: DemoResourceType.Sample, id: 'sample' }`），主入口用它给内存后端预置数据，面板用它读数据；`DEMO_SAMPLE_CONTENT` 是预置的示例内容文本（演示假数据，非真实项目数据，D-03）。

### 演示面板类型 id `'demo'` 与显示名 `'演示面板'`（字符串 id / 文案）
- **用途**：面板类型的唯一字符串 id 与展示名称（`IEditorPanelType.id` / `.name` 本身即字符串，属「明确表示字符串本身」的例外）。

### `installDemoPanel`（`const`，`packages/apps/editor-dev/src/installers/installDemoPanel.ts`）
- **用途**：演示面板的**安装函数**（D-05）——形状为 `EditorCapabilityInstaller`；内部调用 `core.shellSystem.registerPanelType(DEMO_PANEL_TYPE)`。宿主在装配处集中调用它，先把「宿主集中调用安装函数」的机制立起来，Phase 2–6 各能力按同一形状接入。

### `main.tsx` 组合根（`packages/apps/editor-dev/src/main.tsx`）
- **用途**：开发宿主的**装配 / 组合根**——`new EditorCore()` → `new MemoryBackend()` + `seed` → `installDemoPanel(core)` → `await core.initialize(backend)` → `createRoot(document.getElementById('root')!).render(createElement(core.shellSystem.render()))`。宿主不自维护状态（外壳自订阅）。

### 测试与测试配置（`packages/apps/editor-dev/vitest.config.ts`、`packages/apps/editor-dev/src/__tests__/devHost.test.tsx`）
- **用途**：端到端冒烟测试（jsdom + `@testing-library/react`），覆盖 DEVHOST-01 的 ①②③：启动后有空标签、演示面板可注册 / 开 / 关、面板经外壳渲染后显示内存后端内容。

---

## 待确认的规划假设（见各 PLAN.md 的 Flagged Assumptions）

- **A-react-pin**：`react` / `react-dom` 精确 pin `19.3.0`（与 editor-core 一致）以避免双 React；执行后以 `pnpm why react` 收口。
- **A-demo-panel-location**：演示面板放开发宿主本地（`@motajs/editor-impl` 当前为空壳）。
- **A-installer-vs-Phase2**：安装函数约定与 Phase 2 D-01 并存、不冲突。
- **A-smoke-test**：采纳「加一个最小自动化冒烟测试」的建议。
- **A-close-tab**：关闭最后一个标签时外壳自动补空白标签（既有行为）。
- **[flagged — DEVHOST-01 spec-less 边探针 `unclassified` → `unresolved`]**：无 SPEC，探针归类未决，已手工推导边界落入 `must_haves.truths`，须用户知悉。
