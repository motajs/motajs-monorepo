# Phase 1 — 命名提案（INTERFACE-NAME）

**状态：全部为提案，待用户确认后方可落代码 / 计划 / 配置。**
依据 `AGENTS.md` §Project Rules「重要命名先确认」与 §Code style（方法引用一律写作 `类名.方法名`；类/接口/枚举不写 jsDoc，`type` 别名要写）。每个条目说明「它是干什么的」。

确认方式建议：逐条回复「同意 / 改成 X」。任意条目未确认前，执行阶段不得将其写成代码。

---

## Plan 01 — 接口定义（`01-01-PLAN.md`）

### `IEditorPanelType`（interface，`packages/libs/editor-core/src/panel/types.ts`）
- **用途**：描述一个可被注册的「面板类型」的元信息与创建实例的工厂。外部注册它，core 用它生成实例。承载 D-08（唯一 id、名称、图标）与 D-09（工厂）。
- **成员**：`id: string`（唯一标识符）、`name: string`（显示名称）、`icon: ReactNode`（外部提供的可渲染图标，core 不解析图标名）、`create: EditorPanelFactory`（创建实例的工厂）。

### `EditorPanelFactory`（type 别名，`packages/libs/editor-core/src/panel/types.ts`）
- **用途**：面板实例工厂的签名。core 创建一个实例时调用它，传入面板上下文与 core 生成的唯一实例 id，返回解析出实例的 Promise（D-09）。替代旧 `EditorPanelCreator`（旧签名只有 `context`）。

### `IShellSystem`（interface，`packages/libs/editor-core/src/shell/types.ts`）
- **用途**：浏览器式编辑器外壳的对外契约。统管「面板类型注册表、面板实例生命周期、标签状态机、菜单项注册、渲染根」；由 `EditorCore` 暴露为 `shellSystem`（D-14）。不 extends `IUndoable`（标签导航不进撤销历史）。
- **方法**（引用时写作 `IShellSystem.方法名`）：`initialize`、`registerPanelType`、`unregisterPanelType`、`listPanelTypes`、`createPanelInstance`、`closePanelInstance`、`registerMenuItem`、`unregisterMenuItem`、`listMenuItems`、`openBlankTab`、`openPanelInTab`、`closeTab`、`activateTab`、`listTabs`、`render`、`dispose`。

### `IShellInjection`（interface，`packages/libs/editor-core/src/shell/types.ts`）
- **用途**：外壳系统的注入对象（本阶段为空接口），供 `IEditorCoreInjection` 多重 `extends`，与 `IPanelInjection` / `IUndoInjection` / `IResourceInjection` 并列。

### `IEditorMenuItem`（interface，`packages/libs/editor-core/src/shell/types.ts`）
- **用途**：一个顶部菜单项（D-12）。外部注册「标题 + 点击回调」，core 负责把这行画出来。
- **成员**：`id: string`（唯一标识符）、`title: string`（显示标题）、`onClick: () => void`（点击回调）。

### `IEditorTab`（interface，`packages/libs/editor-core/src/shell/types.ts`）
- **用途**：外壳标签状态机里的一个标签记录（D-03/D-04）。`typeId` 与 `instanceId` 同时为 `null` 表示「空白新标签页」。
- **成员**：`id: string`（标签唯一 id）、`typeId: string | null`、`instanceId: string | null`。

### `IEditorFileSystem`（interface，`packages/libs/editor-core/src/fs/types.ts`）
- **用途**：engine-agnostic 的**通用文件系统接口**（CORE-01 / D-13）。**只定义、不实现、不引用**：core 与 impl 都不用，真正实现由宿主提供，供外部统一实现与使用（例如把不同宿主后端适配到同一套操作）。
- **方法**（六类操作，全部返回 `Promise`）：`readFile`（读）、`writeFile`（写）、`listDirectory`（列目录）、`makeDirectory`（建目录）、`moveFile`（移动）、`deleteFile`（删除）。
- **备选方法名**：`listDirectory` ↔ `readdir`（对齐旧 `FsPromiseApi.readdir`）；`makeDirectory` ↔ `mkdir`。请确认。

### 路径（提案）
- `packages/libs/editor-core/src/shell/`、`shell/types.ts`、`shell/index.ts` —— 外壳域目录与类型桶。
- `packages/libs/editor-core/src/fs/`、`fs/types.ts`、`fs/index.ts` —— 通用 fs 域目录与类型桶。

### 日志 id（提案，写入 `packages/libs/editor-core/src/log/messages.ts`）
- `shell.duplicatePanelType` —— 重复的面板类型 id 被拒绝时记录（不覆盖既有注册）。
- `shell.panelTypeNotRegistered` —— 操作/注销未注册的面板类型时记录。
- `shell.invalidPanelType` —— 面板类型注册缺项（id / name 为空或 create 非函数）时记录（原子拒绝）。
- `shell.instanceCreateFailed` —— 面板实例工厂失败（reject / 抛错）时记录。
- `shell.tabNotFound` —— 操作不存在的标签时记录。
- `shell.duplicateMenuItem` —— 重复的菜单项 id 被拒绝时记录。
- `shell.callbackFailed` —— 外壳回调（如焦点）失败时记录（承接原 `panel.callbackFailed`）。

---

## Plan 02 — 外壳系统实现（`01-02-PLAN.md`）

### `ShellSystem`（class，`packages/libs/editor-core/src/shell/shellSystem.ts`）
- **用途**：`IShellSystem` 的唯一实现。持有面板类型注册表、面板实例注册表、标签列表、活动标签、菜单项列表，并提供渲染根。替代被删除的 `PanelSystem`。
- **方法**：实现 `IShellSystem` 全部方法（见上）。

### `ShellPanelHooks`（class，`packages/libs/editor-core/src/shell/shellSystem.ts`）
- **用途**：把资源系统的更新桥接给单个面板实例（按实例 id 绑定），在关闭实例 / 注销类型时被 `unload`。承接原 `EditorPanelHooks`（后者随 `panelSystem.ts` 删除）。

### 模块层渲染组件（function，`packages/libs/editor-core/src/shell/shellSystem.ts`）
均为模块层函数组件（保证 hooks 规则可识别），core 内部使用、不对外导出：
- `ShellRoot` —— 外壳根：订阅状态变更并组织下面三块。
- `MenuRow` —— 顶部菜单行（第一行）。
- `TabRow` —— 标签行（第二行）：标签 + `×` + 末尾 `+`。
- `ContentArea` —— 内容区：按活动标签渲染空白列表或面板实例。
- `BlankTabList` —— 空白新标签页内的「选择面板类型」列表。
- `PanelHost` —— 承载单个面板实例渲染、处理工厂 pending / error 态。

### 内部 props 接口（interface，同文件，不导出）
`IShellRootProps`、`IMenuRowProps`、`ITabRowProps`、`IContentAreaProps`、`IBlankTabListProps`、`IPanelHostProps` —— 各组件 props 的具名类型（项目风格禁止内联对象类型）。

### 删除（提案）
- `packages/libs/editor-core/src/panel/panelSystem.ts`、`panel/__tests__/panelSystem.test.ts` —— 被 `ShellSystem` 替代，随 D-07 一起移除。
- `panel/types.ts` 中的 `EditorPanelCreator`、`IPanelSystem`、`PanelUndoType` —— 旧契约，随 D-07 移除。

---

## Plan 03 — 外壳样式与状态覆盖（`01-03-PLAN.md`）

### `shell.css`（新文件，`packages/libs/editor-core/src/shell/shell.css`）
- **用途**：core 自带的纯 CSS 外壳样式表（kebab-case、就近 co-located），经渲染根模块 `import`。只使用 UI-SPEC 的 `--editor-*` CSS 变量并以字面量兜底；不引入任何 UI 框架。

### `global.d.ts`（新文件，`packages/libs/editor-core/src/global.d.ts`）
- **用途**：环境声明，仅一行 `declare module '*.css';`，让 `tsc -b` 认识 `import './shell.css'`（不新增依赖）。

### `package.json` 字段改动（`packages/libs/editor-core/package.json`）
- `sideEffects`：`false` → `["./src/**/*.css"]` —— 声明 CSS 是必需的副作用，避免打包器把样式表摇掉。

### `data-test-id`（测试选择器约定，非 API）
- 为稳定组件测试断言，渲染元素可加 `data-test-id`；与仓库 Playwright `testIdAttribute: 'data-test-id'` 约定一致，不改变对外行为。

---

## Plan 04 — fs 面门禁（`01-04-PLAN.md`）

### `scripts/verify/coreFsSurface.js`（新文件）
- **用途**：CORE-01 的可失败门禁。断言「仓库中不存在通用 fs 接口的默认实现，且 core/impl 都不引用它」，并用两极性 fixture 证明该断言真的会响；另证明 `IEditorFileSystem` 经包根可被外部导入（typecheck 探针）。

### 脚本内符号（提案，均为脚本内部，不对外）
- `REPO_ROOT`、`CORE_LIBS`、`TARGET_IDENTIFIER`、`DECLARATION_FILE`、`MIN_EXPECTED_SOURCES` —— 常量。
- `check`、`collectSources`、`findReferences`、`checkRealTree`、`checkTwoPolarity`、`checkRootImportProbe`、`main` —— 函数。
- 备选落点名：扩展现有 `scripts/verify/coreBoundaries.js` 而非新文件（PATTERNS 建议新文件）。请确认。

---

## 待确认的规划假设（见各 PLAN.md 的 Flagged Assumptions）

- **A5**：用**单一** `IShellSystem` 统管面板类型 / 实例 / 标签 / 菜单（不拆独立 shell 系统 + 面板系统）。
- **A2**：fs 方法名 `listDirectory` / `makeDirectory`，且本阶段只含文本读写（不含二进制读写）。
- **A6**：实例 id 由 core 会话内递增、不复用。
- **A7**：标签导航不进撤销历史（旧 `PanelUndoType.Switch` 移除）。
- **A3**：`icon` 为 `ReactNode`，缺省渲染中性占位方块。
- **A1**：本阶段验收基线限定在 `editor-core`（`typecheck` + `test` + 三个仍生效门禁 + 新 `coreFsSurface.js`）。
