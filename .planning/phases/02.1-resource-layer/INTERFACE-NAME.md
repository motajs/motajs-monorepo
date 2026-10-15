# Phase 2.1 — 命名提案（INTERFACE-NAME）

**状态：全部为提案，待用户逐条确认后方可落代码 / 计划 / 配置。**

依据 `AGENTS.md` §Project Rules「重要命名先确认」与 §Code style（方法引用一律写作 `类名.方法名`；类 / 接口 / 枚举本身不写 jsDoc，`type` 别名要写 jsDoc；接口成员默认 `readonly`；数值枚举 + 大驼峰成员；桶文件 `export *`；禁 `import type`）。**每个条目说明「它是干什么的」，只给名字不算报告。**

确认方式：逐条回复「同意 / 改成 X」。任意条目未确认前，执行阶段不得把它写成代码。

**本文件覆盖的跨 Plan 共同结论（请一并确认）：**

- 资源「标识」= **纯文件路径**（D-01 / D-02）：相对项目根、以 `/` 分隔、不带前导斜线；越界（`..`）安全由注入的文件系统 / 宿主负责，core 只拼接不校验。
- schema 文件身份 = **纯文件名约定**（D-15）：数据 `xxx.json` / `xxx.jsonc`，schema `xxx.schema.json` / `xxx.schema.jsonc`（把 `.schema` 插在扩展名前）；表格与素材共用此约定。
- `editor-core` 只给接口、`editor-impl` 写实现；core 引擎无关、不解析文件格式、不读真实文件系统（只驱动注入的 `IEditorFileSystem`）。
- 「打开表格」列表面板做成**独立面板类型**（沿用 Phase 1 外壳 `registerPanelType`），预设表清单经能力接缝注入（D-10 / D-11）。

---

## Plan 01 — `02.1-01-PLAN.md`（editor-core 资源层接口，仅类型）

### `IResourceIdentifier`（type 别名 = `string`）
- **用途**：资源的唯一标识，即「相对项目根、`/` 分隔、无前导斜线的文件路径」。所有资源读写、面板目标、索引条目都以它寻址；资源相等即路径相等（D-01）。
- **备选（请择一）**：保留 interface 形态 `{ readonly path: string }`。本提案取「= `string`」以贴合 D-01 原文「`IResourceIdentifier` = 纯文件路径」，并让各调用点直接传路径字符串（减少一层包装对象与迁移量）。

### `EditorEntryKind`（`const enum`，成员 `File` / `Directory`）
- **用途**：目录条目是文件还是目录。递归建索引 / 打开列表过滤都需要区分二者（`listDirectory` 返回值要带类型，见下）。

### `IEditorDirectoryEntry`（interface，成员 `name` / `kind`）
- **用途**：`IEditorFileSystem.listDirectory` 返回的目录条目。核心递归建索引时一次拿到「名字 + 文件 / 目录」，避免对每个条目再试列目录。

### `ResourceContent`（type 别名 = `string | Uint8Array`）
- **用途**：资源内容的两种形态——「原文（text）」或「原始字节（binary）」。core 不解析格式，直接把它交给调用方（D-08）。

### `IFileEntry`（interface，成员 `path` / `name` / `kind`）
- **用途**：项目文件索引对外暴露的一个条目（供面板列目录 / 打开列表读目录树）。`path` 为全路径、`name` 为末段名、`kind` 为文件 / 目录。

### `IFileIndex`（interface；方法 `initialize` / `list` / `has` / `insert` / `remove` / `move` / `clear`）
- **用途**：项目文件索引契约——初始化时递归全扫建树，之后新建 / 删除 / 移动时增量更新；`list(path)` 返回某目录下的直接子条目（D-03）。

### `FileIndex`（class，`packages/libs/editor-core/src/resource/fileIndex.ts`，`implements IFileIndex`）
- **用途**：索引实现（内存文件树，只存结构、不预读文件内容）。core 实例字段，非模块级状态。

### `IContentCache`（interface；方法 `get` / `set` / `invalidate` / `clear`）
- **用途**：资源内容缓存池契约——按路径缓存已读内容，带总字节上限、LRU 淘汰；写入同步、增删移失效（D-09）。

### `ContentCache`（class，`packages/libs/editor-core/src/resource/contentCache.ts`，`implements IContentCache`）
- **用途**：缓存池实现（字节上限 + LRU）。

### `CONTENT_CACHE_MAX_BYTES`（模块级常量，`Object.freeze` 数值）
- **用途**：缓存池总字节上限的默认值（缺省注入时使用）。

### `IResourceSystemOptions`（interface，成员 `ignore?`）
- **用途**：资源系统初始化选项，承载 D-05 的忽略模式列表（字符串数组，可含通配；匹配的目录 / 文件建索引时跳过）。

### 对既有接口的成员调整（不新增名字，逐条确认语义）
- `IResourceAccess.requestResource(identifier)` / `createResource(identifier, content)` / `deleteResource(identifier)` / `moveResource(source, destination)` / `listDirectory(path)`；**删除** `requestResourceList`（D-04）。
- `IResourceStore.readContent(identifier)` / `writeContent(identifier, data)` —— `data` 改为 `ResourceContent`。
- `IResource.request()` / `write(data)` —— 泛型 `T` 收敛为 `ResourceContent`。
- `IResourceSystem.initialize(fs: IEditorFileSystem, options?: IResourceSystemOptions)`；**删除** `updateResourceList`（D-04）。
- `IResourceSystemHooks`：**删除** `onUpdateResourceList`。
- `IEditorPanelContext`：**删除** `requestResourceList`；`createResource` / `deleteResource` 改按路径与 `ResourceContent`；新增 `listDirectory(path): Promise<readonly IFileEntry[]>`。
- `IEditorPanel`：**删除** `onUpdateResourceList`（D-04）。
- `IEditorCoreInjection`：改为 `extends IUndoInjection, IShellInjection`，新增成员 `readonly fs: IEditorFileSystem` 与 `readonly ignore?: readonly string[]`；**删除** `IResourceInjection`（D-06）。
- `IEditorFileSystem`：**新增** `readBinary(path): Promise<Uint8Array>` 与 `writeBinary(path, data: Uint8Array): Promise<void>`；`listDirectory` 返回值由 `readonly string[]` 改为 `readonly IEditorDirectoryEntry[]`；契约 jsDoc 写明「条目名一律 `/` 分隔、无前导斜线；越界由实现负责」（D-02 / D-07）。

---

## Plan 02 — `02.1-02-PLAN.md`（editor-impl 表格与接缝接口，仅类型）

### `ITablePanelTarget`（interface，成员 `dataPath: string`）
- **用途**：表格面板要编辑的目标 = **单一数据文件路径**；schema 路径一律按文件名约定推导，不允许单独指定（D-14）。schema 视图也用同一个 `dataPath`（其值本身是一个 schema 文件路径），面板据 `isSchemaPath` 判定。

### 对既有类型的删除（逐条确认）
- **删除** `TableResourceType`、`tableDataResourceId`、`tableSchemaResourceId`、`isSchemaResourceId`、`SCHEMA_RESOURCE_PREFIX`（`table.<name>` / `table#schema.<name>` 命名迁移为路径约定，D-15 / D-16）。
- `ITablePanelParam` 保留（`extends Record<string, unknown>`，`columnWidth?` 不变）。

### `ITablePanel.setTable(target, columnIndex?)`（既有方法，签名语义调整）
- **用途**：从外部设置某一栏要编辑的表；`target` 改为 `ITablePanelTarget`（单一 `dataPath`）。方法体属实现计划（Plan 06）。

### `ITablePreset`（interface，成员 `name` / `path`；**唯一声明处** `src/react/types.ts`）
- **用途**：预设表条目——显示名 + 数据文件路径；由组合根注入（D-11）。声明在接缝层 `react/types.ts`（`react` 不得 import `table`），`table/types.ts` 从 `../react/types` 引入复用，保证**只有一个声明模块**。

### `ITableEditorCapabilities.tablePresets?`（`src/react/capabilities.ts` 新增可选成员）
- **用途**：组合根注入的预设表清单（D-11），供「打开表格」列表上半区渲染。
- **备选**：改为经列表面板的打开参数（`openParam`）携带。本提案取能力接缝（一次注入、静态清单更自然）。

---

## Plan 03 — `02.1-03-PLAN.md`（end-to-end tracer + 共享测试替身）

### `FakeFileSystem`（class，`packages/libs/editor-core/src/__tests__/fixtures.ts`，`implements IEditorFileSystem`）
- **用途**：共享的内存文件系统测试替身——按路径存 `Map<string, string | Uint8Array>`；`seed(path, content)` 预置；`listDirectory` 返回带类型条目；含 `failing` / `hanging` 开关；供 editor-core / editor-impl / editor-dev 测试复用，收敛迁移期的改动面（RESEARCH §Pitfalls 7）。

### `createCoreHarness(fs, ignore?)`（函数，测试装配工厂）
- **用途**：按注入的 `FakeFileSystem` 装配一个已 `initialize` 的 `EditorCore`，供各包集成测试复用（避免每个测试各自拼装）。
- **备选**：不抽工厂，各测试直接 `new EditorCore()` + `initialize`。本提案抽一个，以减少重复。

### 对既有测试装配的迁移（非新增命名）
- `editor-core` 的 `resource/__tests__/resourceSystem.test.ts`、`__tests__/core.test.ts`、`shell/__tests__/{shellSystem,shellSwitch,shellTitle,shellUndoShortcut,shellOpenParam}.test.ts` 里 `implements IResourceInjection` 的假实现，改为使用 `FakeFileSystem`。

---

## Plan 04 — `02.1-04-PLAN.md`（文件索引 + 内容缓存池）

本 Plan 不含新增对外命名——`IFileIndex` / `FileIndex` / `IContentCache` / `ContentCache` / `IFileEntry` / `CONTENT_CACHE_MAX_BYTES` 已在 Plan 01 定义；本 Plan 只写实现与测试。

---

## Plan 05 — `02.1-05-PLAN.md`（门禁反转）

无新增对外命名。改造 `scripts/verify/coreFsSurface.js` 与 `scripts/verify/coreBoundaries.js`（内部常量 / 提示语变化，非对外命名）。期望的新形态：
- `coreFsSurface`：由「`IEditorFileSystem` 只允许出现在 `fs/types.ts`」反转为「**core 的资源驱动文件确实引用 / 实现它**」；保留「包根可导入正 / 负极性」两段，并用一个可失败的合成 fixture 证明门禁能被区分（非空转）。
- `coreBoundaries`(e)：由「底层禁止任何文件读写调用形态」改写为「**底层禁止直接触达真实文件系统**」（禁 `node:fs` / `from 'fs'` / `require('fs')` / 全局 `fetch`），保留两极性 fixture 与非空转下界。

---

## Plan 06 — `02.1-06-PLAN.md`（表格迁移到路径约定 + `.jsonc` 系统前缀约定）

**`.jsonc` 项目级约定（用户已定）：** 可带一段**系统前缀注释块**，由精确这一行终止：`// --- SYSTEM PREFIX END --- //`；该行及其之前的全部文本 = 系统前缀，其后 = 严格 JSON 正文。**没有注释即合规**（标记行不是必需）。打开时三段检测：整段严格 JSON → 标记行拆分 + 正文严格解析（记住前缀）→ `json5` 宽松回退（非合规，需确认删注释）→ 无效。同一约定适用于数据 `.jsonc` 与 `.schema.jsonc`。

### `isSchemaPath(path: string): boolean`（函数，`src/table/resourceType.ts`）
- **用途**：判断一个路径是否为 schema 约定文件（以 `.schema.json` / `.schema.jsonc` 结尾，D-15）。

### `deriveSchemaPath(dataPath: string): string`（函数，`src/table/resourceType.ts`）
- **用途**：由数据文件路径推导其 schema 路径（把 `.schema` 插在扩展名前，D-15）。

### `isTableDataPath(path: string): boolean`（函数，`src/table/resourceType.ts`）
- **用途**：判断一个路径是否可作为表格打开的数据文件（扩展名为 `json` / `jsonc` 且**不是** schema 约定文件）——「打开表格」目录树过滤用（D-10）。

### `SYSTEM_PREFIX_END_MARKER`（模块级常量，`string`，`src/table/model/tableText.ts`）
- **用途**：项目级 `.jsonc` 系统前缀注释块的**结束标记行**，精确文本为 `// --- SYSTEM PREFIX END --- //`。该行及其之前的全部文本即「系统前缀」，其后是严格 JSON 正文；该行不是必需的（无注释即合规）。

### `TableTextParseStatus`（`const enum`，成员 `Conforming` / `NeedsCommentStrip` / `Invalid`，`src/table/model/tableText.ts`）
- **用途**：表格文本解析的三种结论——合规（可直接打开，可能带系统前缀）、只需宽松解析（含注释 / 尾逗号、需先确认删注释才可打开）、无效（严格与宽松解析都失败）。

### `ITableTextParseResult`（interface，成员 `status` / `prefix` / `value?`，`src/table/model/tableText.ts`）
- **用途**：解析结果——`status` 为结论；`prefix` 为**记住的系统前缀原文**（合规但无前缀时为 `''`；`NeedsCommentStrip` / `Invalid` 时亦为 `''`），供写回时逐字还原；`value` 为解析出的数据（`Invalid` 时缺省）。**这就是「能带回前缀」的最小形状**。

### `parseTableText(text: string): ITableTextParseResult`（函数，`src/table/model/tableText.ts`）
- **用途**：按项目约定解析表格 / schema 文本——先对整段严格 `JSON.parse`（成功 ⇒ `Conforming`、`prefix` 为 `''`）；失败则在**第一处**标记行处拆出系统前缀、对正文再严格解析（成功 ⇒ `Conforming` 并带回 `prefix`）；再失败才用既有 `json5` 宽松解析整段（成功 ⇒ `NeedsCommentStrip`、携带 `value`、`prefix` 为 `''`）；仍失败 ⇒ `Invalid`。**取代原提案 `parseTableText(text, path)`**——解析按内容判定、不需要扩展名，且结果必须能把系统前缀带回。
- **备选**：另开 `parseTableTextLeniently` 只做 json5 回退；本提案把回退合进同一结果，面板不必 import `json5`。

### `serializeTableText(value: unknown, prefix: string): string`（函数，`src/table/model/tableText.ts`）
- **用途**：把表格数据序列化为写回文本——`prefix` 非空时**逐字**写回系统前缀注释块、再 `JSON.stringify(value, null, 2)`；`prefix` 为空时只写 JSON 正文。**取代原提案 `serializeTableText(value, path)`**——写回需要记住的前缀而非扩展名。（**已知取舍**：无系统前缀的 `.jsonc` 注释不被保留——非合规文件经确认后本就以「删除注释」打开，属预期行为。）

### 面板内确认框相关命名（`src/table/tablePanel.ts`，**非注入接缝**）
- `ITablePanelViewState.commentStripPending`（视图状态成员，`boolean`）——该栏当前是否在等用户确认「剥离注释后打开」；React 视图据此渲染 antd `Modal`。
- `ITablePanelViewProps.onConfirmCommentStrip` / `onCancelCommentStrip`（视图根回调，`(columnIndex: number) => void`）——确认 / 取消后转交面板处理。
- `TablePanel.confirmCommentStrip(columnIndex)` / `TablePanel.cancelCommentStrip(columnIndex)`（`TablePanel` 的方法）——确认后以宽松解析值 + 空前缀打开该栏；取消则清空暂存、该栏不打开。
- **明确不做**：不新增 `IConfirmOpener` / `IConfirmRequest` 等注入式接缝，不改 `src/react/types.ts` / `src/react/capabilities.ts`；确认框直接在表格面板视图内用 antd `Modal` 渲染（antd 已是 `editor-impl` 的 peerDependency）。

### `json5`（新增 catalog 依赖；**必需**，用户已定）
- **用途**：在「非合规文件、打开前剥离注释」的回退路径里宽松解析 `.jsonc`（含注释 / 尾逗号）。它**已在本仓 lockfile 内**（`packages/libs/file2x` 直接依赖 `json5@2.2.3`），本阶段把它上收到 `pnpm-workspace.yaml` 的 `catalog:` 并加入 `@motajs/editor-impl` 依赖；**非**新引入到仓库。**系统前缀往返路径本身不需要 json5**——只有非合规回退路径需要。

### 对既有符号的删除（逐条确认）
- **删除** `SCHEMA_RESOURCE_PREFIX` 与 schema 前缀识别函数（`model/schemaPresentation.ts`）；schema 视图判定改由 `isSchemaPath(target.dataPath)`。
- **删除** `TableResourceType` / `tableDataResourceId` / `tableSchemaResourceId`（`resourceType.ts`）。

---

## Plan 07 — `02.1-07-PLAN.md`（表格测试装配迁移·上半；无新增对外命名）

本 Plan 不含新增对外命名——下列两项属**测试内部装配**（非对外命名），列出以备查；本 Plan 建立共享测试替身与装配工厂，并把 10 个既有表格测试的装配迁到 fs 注入（`tracer` / `edit` / `undo` / `validation` / `inputs` / `externalEditor` / `modals` / `openParam` / `schemaMode` / `switchRefresh`）。

---

## Plan 08 — `02.1-08-PLAN.md`（表格测试装配迁移·下半；无新增对外命名）

本 Plan 不含新增对外命名——复用 Plan 07 的 `FakeFileSystem` / `createTableHarness`，迁移剩余 11 个既有表格测试（`integration` + 10 个 `*.uat.test.tsx`）并使 editor-impl 整包测试与 typecheck 恢复全绿。

### `FakeFileSystem`（class，`packages/libs/editor-impl/src/table/__tests__/fixtures.ts`，测试内部）
- **用途**：editor-impl 侧**自持**的内存文件系统测试替身（`implements IEditorFileSystem`）——与 editor-core 的同名替身保持同形（按路径 `Map`、`seed(path, content)`、带类型 `listDirectory`、二进制读写、越界抛错）；供表格测试复用。

### `createTableHarness()`（函数，测试装配工厂）
- **用途**：按注入的 `FakeFileSystem` 装配一个已 `EditorCore.initialize`、已注册 `tablePanelType` 的 `EditorCore`，供表格测试复用。

---

## Plan 09 — `02.1-09-PLAN.md`（表格「打开列表 / 新建 / 删除」）

### `tableListPanelType`（导出常量，`IEditorPanelType`，`src/table/tableListPanelType.ts`）
- **用途**：可经 `ShellSystem.registerPanelType` 注册的「打开表格」**列表面板类型**（id / name / 图标 / 工厂）。上半显示预设表，下半显示项目目录树（D-10 / D-11）。

### `TableListPanel`（class，`src/table/tableListPanel.ts`，`implements IEditorPanel`）
- **用途**：列表面板实例——读 core 索引铺目录树、按「打开表格」注入器打开选中表、新建 / 删除表格。

### `TableListPanel.selectDirectory(path)`（`TableListPanel` 的方法）
- **用途**：设置列表面板当前选中的目录路径（目录树里点进 / 选中某目录时调用）；新建表格即在该目录下建一对文件。纯状态设置 + 触发目录树重取，不直接读写文件。

### `TableListPanel.createTable(directoryPath, name)`（`TableListPanel` 的方法）
- **用途**：在当前选中目录下一次性建一对文件 `name.json`（初值空对象）+ `name.schema.json`（初值 `{ "type": "object", "properties": {} }`，D-12）。

### `TableListPanel.deleteTable(dataPath)`（`TableListPanel` 的方法）
- **用途**：删除数据 + schema 一对文件，删前二次确认、**不可撤销**（D-13）。

### `TableListPanel.openTable(dataPath)`（`TableListPanel` 的方法）
- **用途**：经注入的 `ITablePanelOpener` 打开一个瞄准该路径的表格面板。

### `INITIAL_TABLE_DATA_TEXT` / `INITIAL_TABLE_SCHEMA_TEXT`（模块级常量，`string`）
- **用途**：新建表格一对文件的初始内容文本（`{}` 与 `{"type":"object","properties":{}}`）。

### `ITableListPanelViewProps`（interface，`src/table/components/TableListPanelView.tsx`）
- **用途**：列表面板视图组件的 props（预设表 / 目录树 / 选中目录 / 各回调）。

---

## Plan 10 — `02.1-10-PLAN.md`（开发宿主接入）

### `DEMO_PANEL_TYPE`（既有导出，**不改名**）
- **用途**：开发宿主演示面板类型（`packages/apps/editor-dev/src/demo/demoPanel.ts:147` 已导出，`main.tsx:25` 已注册）。本阶段只沿用，不重命名、不改形——仅在此登记为「已存在、未变更」，避免被当作新增命名遗漏。

### `IMemoryBackend`（interface，`packages/apps/editor-dev/src/backend/types.ts`，成员 `maxUndoStep` / `seed(path, content)`）
- **用途**：开发宿主内存文件系统契约——同时满足撤销注入（`maxUndoStep`）与文件系统（`implements IEditorFileSystem`），并提供 `seed` 预置。

### `MemoryBackend`（class，`implements IEditorFileSystem`）
- **用途**：开发宿主内存文件系统实现（按路径 `Map`、`listDirectory` 带类型条目、二进制读写）。既有同名类**原地改形**，非新名字。

### `DEMO_SAMPLE_PATH`（模块级常量，`string`）
- **用途**：开发宿主演示面板读取的示例文件路径（替代原 `DEMO_RESOURCE_ID` 的资源标识，如 `demo/sample.txt`）。

### `TABLE_DEMO_DATA_PATH` / `TABLE_DEMO_SCHEMA_PATH`（模块级常量，`string`）
- **用途**：开发宿主演示表的两个文件路径（替代原 `TABLE_DEMO_TARGET` 的两个资源标识）。

### `TABLE_PRESETS`（模块级常量，`readonly ITablePreset[]`）
- **用途**：开发宿主注入给「打开表格」列表的预设表清单（演示 `ITableEditorCapabilities.tablePresets`）。

---

## Plan 11 — `02.1-11-PLAN.md`（打开 / 新建 / 删除端到端集成验证）

无新增对外命名（仅新增测试文件 `openNewDelete.uat.test.tsx` 与 `02.1-VALIDATION.md` 记账）。

---

## Plan 12 — `02.1-12-PLAN.md`（旧契约收口）

无新增对外命名（修订 `REQUIREMENTS.md` 的 `CORE-01` / `TABLE-01`、回改 `.planning/phases/03-asset/03-CONTEXT.md` 受影响的 D-04 / D-05 / D-06 / D-11 及全部相关参考 / 结构说明、回改 `03-UI-SPEC.md` 的资源层前提）。
