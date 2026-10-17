# Phase 2.1 — 命名提案（INTERFACE-NAME）

**状态：已定稿（随 Plan 01–11 实现落地）。** 本文件条目原为逐条提案；各条目随其所属计划经执行门禁（「可以执行」）批准后写入代码，实际落地的名字与所在文件见文末「最终定稿」一节。如用户对个别命名另有异议，以用户后续指示为准（届时回改代码与本文）。

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

---

## 最终定稿

> Phase 2.1 收口（Plan 12）——下列名字已随 Plan 01–11 写入代码，实际落点以仓库为准。与「提案」的偏差逐条注明。

### editor-core（资源层 / 文件系统 / 测试装配）

| 名字 | 归属 | 实现文件 |
|------|------|----------|
| `IResourceIdentifier`（= `string`） | 资源标识 = 纯文件路径 | `packages/libs/editor-core/src/resource/types.ts` |
| `ResourceContent`（= `string \| Uint8Array`） | 资源内容 | `packages/libs/editor-core/src/resource/types.ts` |
| `IFileEntry` | 索引条目 | `packages/libs/editor-core/src/resource/types.ts` |
| `IFileIndex` / `FileIndex` | 项目文件索引 | `packages/libs/editor-core/src/resource/types.ts` / `resource/fileIndex.ts` |
| `IContentCache` / `ContentCache` | 内容缓存池 | `packages/libs/editor-core/src/resource/types.ts` / `resource/contentCache.ts` |
| `CONTENT_CACHE_MAX_BYTES`（= 8 MiB） | 缓存上限默认值 | `packages/libs/editor-core/src/resource/types.ts` |
| `IResourceSystemOptions` | 初始化选项（`ignore?`） | `packages/libs/editor-core/src/resource/types.ts` |
| `EditorEntryKind`（`const enum`：`File` / `Directory`） | 目录条目种类 | `packages/libs/editor-core/src/fs/types.ts` |
| `IEditorDirectoryEntry` | `listDirectory` 条目 | `packages/libs/editor-core/src/fs/types.ts` |
| `FakeFileSystem` | 共享测试替身 | `packages/libs/editor-core/src/__tests__/fixtures.ts` |
| `createCoreHarness(fs, ignore?)` | 测试装配工厂 | `packages/libs/editor-core/src/__tests__/fixtures.ts` |

### editor-impl（表格 / 接缝 / 测试装配）

| 名字 | 归属 | 实现文件 |
|------|------|----------|
| `ITablePanelTarget`（成员 `dataPath`） | 表格目标 = 单一数据文件路径 | `packages/libs/editor-impl/src/table/types.ts` |
| `ITablePreset`（成员 `name` / `path`） | 预设表条目（唯一声明处） | `packages/libs/editor-impl/src/react/types.ts` |
| `ITableEditorCapabilities.tablePresets?` | 预设表注入接缝 | `packages/libs/editor-impl/src/react/capabilities.ts` |
| `isSchemaPath` / `deriveSchemaPath` / `isTableDataPath` | 路径约定判定 / 推导 | `packages/libs/editor-impl/src/table/resourceType.ts` |
| `SYSTEM_PREFIX_END_MARKER` | `.jsonc` 系统前缀结束标记 | `packages/libs/editor-impl/src/table/model/tableText.ts` |
| `TableTextParseStatus`（`const enum`：`Conforming` / `NeedsCommentStrip` / `Invalid`） | 解析结论 | `packages/libs/editor-impl/src/table/model/tableText.ts` |
| `ITableTextParseResult`（成员 `status` / `prefix` / `value?`） | 解析结果 | `packages/libs/editor-impl/src/table/model/tableText.ts` |
| `parseTableText(text)` / `serializeTableText(value, prefix)` | 解析 / 序列化（取代原 `(…, path)` 形态） | `packages/libs/editor-impl/src/table/model/tableText.ts` |
| `ITablePanelViewState.commentStripPending` | 注释剥离确认状态 | `packages/libs/editor-impl/src/table/tablePanel.ts` |
| `ITablePanelViewProps.onConfirmCommentStrip` / `onCancelCommentStrip` | 确认 / 取消回调 | `packages/libs/editor-impl/src/table/tablePanel.ts` |
| `TablePanel.confirmCommentStrip(columnIndex)` / `TablePanel.cancelCommentStrip(columnIndex)` | 面板方法 | `packages/libs/editor-impl/src/table/tablePanel.ts` |
| `tableListPanelType`（`IEditorPanelType`） | 「打开表格」列表面板类型 | `packages/libs/editor-impl/src/table/tableListPanelType.ts` |
| `TableListPanel`（`implements IEditorPanel`） | 列表面板实例 | `packages/libs/editor-impl/src/table/tableListPanel.ts` |
| `TableListPanel.selectDirectory(path)` / `TableListPanel.createTable(directoryPath, name)` / `TableListPanel.deleteTable(dataPath)` / `TableListPanel.openTable(dataPath, opener)` | 面板方法 | `packages/libs/editor-impl/src/table/tableListPanel.ts` |
| `INITIAL_TABLE_DATA_TEXT` / `INITIAL_TABLE_SCHEMA_TEXT` | 新建表格初始文本 | `packages/libs/editor-impl/src/table/tableListPanel.ts` |
| `ITableListPanelViewState` / `ITableListPanelViewProps` | 列表面板视图类型 | `packages/libs/editor-impl/src/table/components/TableListPanelView.tsx` |
| `FakeFileSystem`（impl 侧自持） / `createTableHarness(...)` | 表格测试替身与装配工厂 | `packages/libs/editor-impl/src/table/__tests__/fixtures.ts` |

### editor-dev（开发宿主）

| 名字 | 归属 | 实现文件 |
|------|------|----------|
| `DEMO_PANEL_TYPE`（既有，未改名） | 演示面板类型 | `packages/apps/editor-dev/src/demo/demoPanel.ts` |
| `DEMO_SAMPLE_PATH`（`demo/sample.txt`） | 示例文件路径 | `packages/apps/editor-dev/src/demo/demoPanel.ts` |
| `IMemoryBackend`（`extends IEditorFileSystem`） | 内存后端契约 | `packages/apps/editor-dev/src/backend/types.ts` |
| `MemoryBackend`（`implements IMemoryBackend`） | 内存文件系统实现 | `packages/apps/editor-dev/src/backend/memoryBackend.ts` |
| `TABLE_DEMO_DATA_PATH` / `TABLE_DEMO_SCHEMA_PATH` | 演示表文件路径 | `packages/apps/editor-dev/src/demo/tableDemo.ts` |
| `TABLE_PRESETS`（`readonly ITablePreset[]`） | 预设表清单 | `packages/apps/editor-dev/src/demo/tableDemo.ts` |

### 与提案的偏差

- 无实质偏差：提案名字均按原样落地。形态上的两处收窄已在 Plan 06 记录——`parseTableText` / `serializeTableText` 的签名由原提案的 `(…, path)` 改为按内容判定的 `(text)` / `(value, prefix)`；`EditorEntryKind` 落在 `fs/types.ts`（提案未指定承载文件）。
- 本阶段未新增除上表以外的对外命名。

---

# 缺口收口轮（UAT `G-02.1-1`） — 命名提案（Plan 13–16）

**状态：待用户确认。** 依据 `02.1-UAT.md` 的缺口 `G-02.1-1`：用户实测发现 Plan 09 把「打开表格」做成了**覆盖整个外壳的独立面板**，要求改为**表格面板空栏内的内联状态**——空栏显示「打开表格 / 新建表格 / 删除表格」三个按钮，点按钮在同一栏内展示对应组件；打开 / 删除两个组件可复用，差异仅在于是否注入预设表；不再新开独立面板；`editor-dev` 工具栏的「打开表格」入口随之删除；表格面板标签名支持多表（`表格{table0}` 等）。

**为什么要有这一轮**：Plan 09/10 交付的 `tableListPanelType`（独立面板类型）+ `TableListPanel` + `TableListPanelView` 是「独立面板」形态，方向与用户要求相左，须拆成「可复用组件 + 表格面板空栏内联承载」。按项目规则「先接口、后实现」，本轮先做接口（Plan 13），再做实现（Plan 14 两个可复用组件 / Plan 15 空栏内联承载 + 移除独立面板 + `TablePanel.closeColumn` 复位空栏态 / Plan 17 迁移 editor-impl 测试 / Plan 16 开发宿主收口）。为把每计划文件数与上下文预算压回阈值内，把测试迁移从 Plan 15 拆到 Plan 17。

---

## Plan 13 — `02.1-13-PLAN.md`（空栏内联控件接口，仅类型）

### `TableEmptyMode`（`const enum` 落在 `src/table/types.ts`，成员 `Buttons` / `Open` / `Create` / `Delete`）
- **用途**：表格面板**某一栏尚未设置表格**时，该栏当前展示的内联视图——`Buttons` 为初始的三个按钮态，`Open` 为打开表格组件，`Create` 为新建表格组件，`Delete` 为删除表格组件。它与 `TablePanelStatus.NoTarget` 搭配使用（NoTarget + 具体 mode）。
- **为什么落在 `types.ts`**：`types.ts` 是叶子模块（不 import 面板与组件），可被 `tablePanel.ts`、`TableGrid.tsx`、`TableEmptyColumn.tsx` 同时引用而不引入环依赖。

### `ITablePanelViewState` 的空栏字段（`src/table/tablePanel.ts`，均为可选成员）
- `emptyMode?: TableEmptyMode` —— 该栏当前的内联视图，缺省视作 `Buttons`。
- `pickerDirectory?: string` —— 内联浏览器当前所在目录路径（根目录为空串）。
- `pickerEntries?: readonly IFileEntry[]` —— 该目录的直接子条目（取自 `IEditorPanelContext.listDirectory`）。
- `pickerError?: string` —— 目录读取失败时的提示文案，缺省表示无错误。
- **用途**：让「某一栏」的视图（`TableEmptyColumn`）从该栏自己的订阅源里读到「展示哪个内联视图 + 目录树数据」，无需另开面板。

### `ITablePickerProps`（interface，`src/table/components/TablePicker.tsx`）
- **用途**：**可复用的表格浏览器**组件的 props——可选预设表 + 项目目录树。打开表格（注入预设）与删除表格（不注入预设）共用它，**唯一差异就是 `presets` 是否传入**，对应用户「这些组件应该是可以复用的，差距只是有没有预设表」。
- **成员**：`presets?`（`readonly ITablePreset[]`，缺省或无项时不渲染预设区）、`directory`（`string`，根目录为空串）、`entries`（`readonly IFileEntry[]`，该目录直接子条目）、`error?`（`string`，目录读取失败提示）、`deletable?`（`boolean`，为真时每个数据文件行渲染「删除」入口——删除态用）、`onNavigate(path: string)`（进入某目录）、`onSelect(dataPath: string)`（打开某数据表——打开态的行点击）、`onRequestDelete?`（`(dataPath: string) => void`，请求删除某数据表——删除态用）。
- **`onSelect` 保持 required（不是可选）**：删除态下点表项的动作不被使用，但契约不因调用态而变——`TableEmptyColumn` 在 `Delete` 态给 `TablePicker` 传一个**空操作函数**满足该 required 成员，而不是省略它（Plan 15 据此实现）。

### `TablePicker`（组件，`src/table/components/TablePicker.tsx`）
- **用途**：`ITablePickerProps` 的渲染实现（Plan 14）。无自身状态，纯粹由 props 驱动。

### `ITableCreateFormProps`（interface，`src/table/components/TableCreateForm.tsx`）
- **用途**：**可复用的新建表格表单**组件的 props——收集一个表格名并在当前选中目录下建一对文件。
- **成员**：`directory`（`string`，新建所在目录，根目录为空串）、`error?`（`string`，名称校验 / 写入失败提示）、`onCreate(directory: string, name: string)`（确认新建回调）。

### `TableCreateForm`（组件，`src/table/components/TableCreateForm.tsx`）
- **用途**：`ITableCreateFormProps` 的渲染实现（Plan 14）。名称输入用 antd `Input`（回车确认 / Escape 取消），不使用浏览器原生对话框。

### `ITableEmptyStateProps`（interface，`src/table/components/TableEmptyColumn.tsx`）
- **用途**：**空栏控件**组件的 props——把「当前内联视图 + 目录数据 + 预设表 + 各回调」聚到一处，供表格面板某一栏在 `NoTarget` 时渲染。
- **成员**：`mode`（`TableEmptyMode`）、`presets?`（`readonly ITablePreset[]`）、`directory`（`string`）、`entries`（`readonly IFileEntry[]`）、`error?`（`string`）、`onModeChange(mode: TableEmptyMode)`（切换内联视图，含「返回」到 `Buttons`）、`onNavigate(path: string)`（进入目录）、`onOpen(dataPath: string)`（打开某表——在该栏内）、`onCreate(directory: string, name: string)`（新建该表——在该栏内）、`onDelete(dataPath: string)`（删除某表，删除前已由本组件二次确认）。

### `TableEmptyColumn`（组件，`src/table/components/TableEmptyColumn.tsx`）
- **用途**：`ITableEmptyStateProps` 的渲染实现（Plan 15）——`Buttons` 态渲染「打开表格 / 新建表格 / 删除表格」三个按钮；`Open` / `Delete` 态内联渲染 `TablePicker`（`Open` 传预设、`Delete` 不传且 `onSelect` 传空操作）；`Create` 态内联渲染 `TableCreateForm`；删除的 antd 二次确认弹窗在本组件内（受控 `Modal`，同 Plan 06 / 09 既有写法）。

### 命名沿用（不新增、仅换落点）
- `INITIAL_TABLE_DATA_TEXT` / `INITIAL_TABLE_SCHEMA_TEXT`（`string` 常量）——新建表格一对文件的初始文本，由 `tableListPanel.ts` 迁到 `tablePanel.ts`，**名字不变**。

### 对既有命名的删除（逐条确认）
- **删除** `TableListPanel`（class）、`tableListPanelType`（`IEditorPanelType` 常量）、`ITableListPanelViewProps` / `ITableListPanelViewState`（interface）、视图文件 `components/TableListPanelView.tsx`——`G-02.1-1` 判定「独立面板」形态不再需要。
- **删除**（开发宿主）`openTableDemoPanel`（函数）、`TABLE_DEMO_MENU_ID` / `TABLE_DEMO_MENU_TITLE`（常量）——「打开表格」工具栏入口随之移除。
- **移除注册**：`editor-dev/src/main.tsx` 中 `tableListPanelType` 的注册与「打开表格」菜单项。

### 表格面板标签名（多表）约定
- `TablePanel.getTitle`（既有方法，签名不变）：**未设任何表**→ `undefined`（外壳回退类型名）；**仅一张表** → `表格 <数据路径>`（与现状一字不变，既有断言 `表格 demo.json` 保留）；**两张及以上的表** → `表格 {<数据路径0>} {<数据路径1>} …`（按栏序号排列，形如 `表格 {a.json} {b.json}`，对应用户「显示为 表格{table0}等」）。

### 新增内部 CSS 钩子（非对外命名，登记备查）
- `.etable-empty`（空栏控件根）、`.etable-empty-actions`（三个按钮行）、`.etable-empty-mode`（按钮 / 组件容器）。表格浏览器沿用既有 `.etable-list*` 类名，不另起。

### 面板内部方法（`TablePanel` 的私有方法，供 Plan 15 视图回调）
- `TablePanel.setEmptyMode(columnIndex, mode)` —— 切换某栏空栏内联视图（进入 `Open` / `Delete` 时顺带取该目录子条目）。
- `TablePanel.navigatePicker(columnIndex, path)` —— 内联浏览器切换目录并重取子条目。
- `TablePanel.refreshPicker(columnIndex)` —— 取该栏当前目录的直接子条目写入该栏 `entries` 并发布；用请求序号 `pickerToken` 丢弃过期结果，读失败把该栏 `pickerError` 置为「目录读取失败，请重试。」（`TablePanel.setEmptyMode` / `TablePanel.navigatePicker` / `TablePanel.createIntoColumn` / `TablePanel.deleteFromColumn` 均复用它）。
- `TablePanel.openIntoColumn(columnIndex, dataPath)` —— 把选中的数据表**在本栏**打开（`TablePanel.setTable` + 该栏序号），不新开面板。
- `TablePanel.createIntoColumn(columnIndex, directory, name)` —— 在当前目录建一对文件并把新表**在本栏**打开。
- `TablePanel.deleteFromColumn(columnIndex, dataPath)` —— 删数据 + schema 一对文件后重取该栏浏览器目录（不可撤销，D-13）。

---

## Plan 14 — `02.1-14-PLAN.md`（两个可复用组件，实现）

**无新增对外命名**（Plan 13 已定义 `ITablePickerProps` / `ITableCreateFormProps`；本计划只把 `TablePicker` / `TableCreateForm` 两个组件实现出来并登记进 `components/index.ts`）。

## Plan 15 — `02.1-15-PLAN.md`（表格面板空栏内联承载 + 移除独立面板，实现）

**无新增对外命名**（Plan 13 已定义 `TableEmptyMode` / `ITableEmptyStateProps` 与六个 `TablePanel` 私有方法；本计划实现 `TableEmptyColumn`、把空栏接入 `TablePanel`、`TablePanel.closeColumn` 关栏时复位该栏 `emptyMode` 为 `Buttons`（`directory` / `entries` / `pickerError` 一并复位）、移除独立列表面板、多表标题）。删除 `tableListPanel.ts` / `tableListPanelType.ts` / `components/TableListPanelView.tsx`。本计划**不含测试迁移**（既有测试此时预期为红，由 Plan 17 收口）。

## Plan 17 — `02.1-17-PLAN.md`（迁移 editor-impl 表格测试到空栏内联，测试）

**无新增对外命名**（纯测试迁移：新建 `tableEmptyColumn.test.tsx`——小驼峰文件名；迁移 `openNewDelete.uat.test.tsx` / `layout.uat.test.tsx` / `tracer.test.tsx` / `openParam.test.tsx` / `closeColumn.uat.test.tsx`；删除 `__tests__/tableList.test.tsx`）。本计划结束时 editor-impl 测试恢复全绿。

## Plan 16 — `02.1-16-PLAN.md`（开发宿主收口，实现）

**无新增对外命名**（仅删除 `openTableDemoPanel` / `TABLE_DEMO_MENU_ID` / `TABLE_DEMO_MENU_TITLE` 与 `tableListPanelType` 注册；迁移 `devHostTable.test.tsx`）。

---

# 缺口收口轮（UAT `G-02.1-2`） — 命名提案（Plan 18）

**状态：待用户确认。** 依据 `02.1-UAT.md` 的缺口 `G-02.1-2`：开发宿主里没有 `.jsonc` 文件、也不能打开本地文件，导致「`.jsonc` 系统前缀逐字往返」与「非合规文件删除注释确认」两条人工验收无从进行；且这两条行为此前**零自动化覆盖**。本计划往开发宿主 seed 两个 `.jsonc` 样本、接入「打开表格」列表，并补 `parseTableText` / `serializeTableText` 的自动化测试与宿主级用例。

## Plan 18 — `02.1-18-PLAN.md`（开发宿主 `.jsonc` 样本 + 自动化测试）

### `TABLE_DEMO_SYSTEM_PREFIX_DATA_PATH` / `TABLE_DEMO_SYSTEM_PREFIX_SCHEMA_PATH`（模块级常量，`string`，`packages/apps/editor-dev/src/demo/tableDemo.ts`）
- **用途**：开发宿主**合规** `.jsonc` 样本的两个文件路径——数据 `tables/system-prefix.jsonc`、schema `tables/system-prefix.schema.jsonc`（后者等于 `deriveSchemaPath` 的结果）。该数据文件带一段系统前缀注释块（由 `// --- SYSTEM PREFIX END --- //` 结束）与严格 JSON 正文；在浏览器里打开它改一个字段并保存后，前缀逐字保留。

### `TABLE_DEMO_SYSTEM_PREFIX_DATA`（模块级常量，`string`，同上）
- **用途**：上面数据文件的初始内容文本——注释行 + 由 `SYSTEM_PREFIX_END_MARKER` 拼出的标记行 + 换行 + `JSON.stringify` 出的严格 JSON 正文。逐字保留的验收即针对它。

### `TABLE_DEMO_COMMENTED_DATA_PATH` / `TABLE_DEMO_COMMENTED_SCHEMA_PATH`（模块级常量，`string`，同上）
- **用途**：开发宿主**非合规** `.jsonc` 样本的两个文件路径——数据 `tables/commented.jsonc`、schema `tables/commented.schema.jsonc`（等于 `deriveSchemaPath` 的结果）。数据文件含注释与尾逗号、且**不含**标记行，打开时必触发「删除全部注释」确认框。

### `TABLE_DEMO_COMMENTED_DATA`（模块级常量，`string`，同上）
- **用途**：上面非合规数据文件的初始内容文本——含注释与尾逗号、无标记行；严格 `JSON.parse` 失败而 json5 可解析，`parseTableText` 判 `NeedsCommentStrip`。

### `TABLE_DEMO_SAMPLE_SCHEMA`（模块级常量，`string`，同上）
- **用途**：上面两份样本共用的标准 JSON Schema 文本（严格 JSON、字段 `title` / `level`），让两个样本打开后都渲染出可编辑的行。

### `TABLE_PRESETS` 的取值变化（既有名字，不新增）
- **用途**：由「演示表」一项扩为三项——追加「系统前缀表」→ `TABLE_DEMO_SYSTEM_PREFIX_DATA_PATH`、「带注释表」→ `TABLE_DEMO_COMMENTED_DATA_PATH`，使两个样本在「打开表格」预设区一键可达。

### 新增测试文件（测试内部，登记备查）
- `packages/libs/editor-impl/src/table/__tests__/tableText.test.ts`——`parseTableText` / `serializeTableText` 纯函数单测（前缀逐字往返 + `Conforming` / `NeedsCommentStrip` / `Invalid` 三段分类）；小驼峰文件名。
- `packages/apps/editor-dev/src/__tests__/devHostJsonc.test.tsx`——开发宿主 `.jsonc` 端到端（合规前缀往返 / 非合规确认 / 非合规取消）；小驼峰文件名、`.test.tsx` 后缀。

### 对既有命名的删除
- 无。

---

# 缺口收口轮（UAT `G-02.1-3`） — 命名提案（Plan 19–24）

**状态：待用户确认。** 依据 `02.1-UAT.md` 缺口 `G-02.1-3`（severity blocker，来自 UAT 测试 1）：
① 多表标签名过长 → 限宽 ≤200px；② 空栏三个按钮更大且竖排；③ 新建表格只能建到根目录 → 让用户选目标目录；④「打开将删除全部注释」确认框每次切走再切回都重弹 → 同一栏同一文件只提示一次（内容变化除外）；⑤ **没有保存按钮（blocker）** → 改**手动保存**（编辑先留内存、点「保存」才落盘），并**在切出面板时自动保存已修改的表格**；⑥「编辑 Schema」与「在代码编辑器中打开」收进一个小下拉框；⑦「打开表格」列表实时同步（不再只在切出 / 切入时同步）。

**为什么要有这一轮**：现状是「每次编辑立即写盘 + 无保存按钮 + 工具栏两个低频按钮常驻 + 空栏三按钮小且横排 + 新建只能建到根目录 + 注释剥离确认框每次切回都重弹 + 打开列表只在进入模式时取一次」。按项目规则「先接口、后实现」，本轮先做接口（Plan 19），再排实现（Plan 20 手动保存 / 注释剥离记忆 / 列表实时同步；Plan 22 空栏按钮与新建选目录；Plan 23 工具栏下拉与标签限宽）与测试收口（Plan 21 迁移既有表格测试；Plan 24 开发宿主 e2e + 三包全绿 + 五门禁）。

---

## Plan 19 — `02.1-19-PLAN.md`（缺口收口接口，仅类型）

**本计划只声明类型 / 契约，不写任何行为。** 新增成员一律先声明为**可选**，避免接口计划本身让既有构造点 typecheck 失败（同 Plan 13 做法）。

### `ITablePanel.save?(columnIndex?: number): Promise<void>`（`src/table/types.ts`，`ITablePanel` 新增**可选**方法）
- **用途**：把**某一栏**内存中的未落盘改动写回资源——数据文件，以及需要写回的镜像 schema 文件；该栏无未落盘改动时不动盘。视图工具栏的「保存」按钮、以及切出 / 关栏 / 释放时的自动保存路径都经它。
- **为什么是可选（`?`）**：本计划**只声明类型**，实现（`TablePanel.save`）在 Plan 20 才落地；写成可选可让既有 `TablePanel`（尚未实现该方法）的 typecheck 仍通过（TS2420），Plan 20 补上实现后接口仍保持可选。
- **备选**：只做私有方法、不进 `ITablePanel` 接口。本提案进接口——「保存」是本面板对外应有的动作，且让测试与将来宿主可显式触发。

### `ITablePanelViewState.unsaved?: boolean`（`src/table/tablePanel.ts`）
- **用途**：该栏当前是否有**未落盘**的改动；视图据此显示「未保存」标记并启用「保存」按钮。

### `ITablePanelViewProps.onSave?` / `ITableColumnProps.onSave?`（`(columnIndex: number) => void`，`src/table/tablePanel.ts`）
- **用途**：视图根 / 单栏把某栏的「保存」动作转交给面板（Plan 20 接成必需）。

### `ITableGridProps.unsaved?: boolean` / `ITableGridProps.onSave?: () => void`（`src/table/components/TableGrid.tsx`）
- **用途**：表格组件接收「本栏是否未保存」与「保存」回调，并透传给工具栏。

### `ITableToolbarProps.unsaved?: boolean` / `ITableToolbarProps.onSave?: () => void`（`src/table/components/TableToolbar.tsx`）
- **用途**：工具栏渲染「保存」按钮（无改动时禁用）与「未保存」标记。

### `ITableCreateFormProps.entries?: readonly IFileEntry[]` / `ITableCreateFormProps.onNavigate?: (path: string) => void`（`src/table/components/TableCreateForm.tsx`）
- **用途**：新建表单可在**当前目录的子目录**间浏览并选定新建位置（不再只能建到根目录）；`entries` 为该目录直接子条目、`onNavigate` 进入某子目录（含 `..` 上行由面板侧目录态承担）。

### 对既有命名的删除
- 无。

---

## Plan 20 — `02.1-20-PLAN.md`（手动保存状态机 + 注释剥离记忆 + 列表实时同步，实现）

**新增对外命名**：`ITablePanel.save`（Plan 19 已声明，本计划实现）。

### `ITablePanelColumn.unsaved: boolean`（`src/table/tablePanel.ts`，内部字段）
- **用途**：该栏是否有**未落盘的数据改动**（`commitValue` / `addItem` / `deleteItem` / 代码编辑器写回 / 撤销重做 / 确认剥离注释时置真；`save` 成功后清假）。

### `ITablePanelColumn.unsavedSchema: boolean`（内部字段）
- **用途**：该栏是否有**未落盘的镜像 schema 改动**（数据视图新增字段会同步改镜像 schema；schema 视图不涉及）。

### `ITablePanelColumn.stripConfirmed: Map<string, string>`（内部字段）
- **用途**：本栏已确认「剥离注释后打开」的路径 → **确认时的原文**。再次打开同一路径且原文**未变**时不弹框直接按剥离态打开；原文变化（含被外部改写）则重新提示——落实「同一栏同一文件只提示一次，除非内容变化」。

### `ITablePanelColumn.pendingStripText: string`（内部字段）
- **用途**：待确认剥离时暂存的**原文**，供 `TablePanel.confirmCommentStrip` 登记进 `stripConfirmed`。

### `TablePanel.saveDirtyColumns()`（`TablePanel` 的私有方法）
- **用途**：写回本面板**所有**有未落盘改动的栏（逐栏调 `itSelf.save`）；供 `TablePanel.onSwitchOut` 与 `TablePanel.dispose` 复用，落实「切出面板时自动保存已修改的表格」。

### `TablePanel.flushColumn(columnIndex)`（`TablePanel` 的私有方法）
- **用途**：**同步快照**某栏当前目标与内存内容后异步写回并清该栏未落盘标记；供 `TablePanel.setTable`（换目标前）与 `TablePanel.closeColumn`（关栏前）在目标被替换 / 清空前保存用——快照先于切换发生，故换目标 / 关栏不会丢改动。

### `TablePanel.refreshAwaitingPickers()`（`TablePanel` 的私有方法）
- **用途**：重取本面板**所有处于打开 / 删除态栏**的目录（列表实时同步）；供面板内建 / 删表格后、`TablePanel.onSwitchIn`、`TablePanel.onUpdateResource` 复用。

### 对既有行为的调整（不新增名字，逐条确认语义）
- `TablePanel.commitValue` / `TablePanel.addItem` / `TablePanel.deleteItem` / `TablePanel.openCurrentViewInCodeEditor` / `TablePanel.applyUndoRedo`：**不再直接写盘**，改为改内存（`column.data` / 必要时 `column.schema`）+ 置 `unsaved`（必要时 `unsavedSchema`）+ 登记撤销 + `applyData`；`refreshDependents` 移到 `save` 成功后。
- `TablePanel.refresh`：该栏有未落盘改动时**不重读覆盖**（保住内存改动）。
- `TablePanel.onUpdateResource`：由空实现改为「重取处于打开 / 删除态栏的目录」（复用 `refreshAwaitingPickers`）。
- `TablePanel.confirmCommentStrip`：登记 `stripConfirmed` 并置 `unsaved`（确认即接受「保存后删注释」）；`TablePanel.refresh` 命中已确认且原文未变时**直接按剥离态打开**。

---

## Plan 21 — `02.1-21-PLAN.md`（迁移既有表格测试到手动保存，测试）

**无新增对外命名**（纯测试迁移：把 Plan 20 手动保存改变写盘时机后预期变红的既有表格测试，按同一「读回资源前补一次保存 / 切出」规则迁移）。下列项属**测试内部装配**（非对外命名），登记备查。

### `savePanel(panel)`（测试文件内本地辅助，非导出）
- **用途**：某表格测试里「把某栏未落盘改动写回资源」的一步——内部 `await panel.save()`，供该用例在「编辑之后、读回资源之前」补齐落盘步骤。各测试文件各自定义，不进任何 `export` 面。

### 无新外部命名
- 除上述测试内局部辅助外，本计划不新增任何导出命名、不改任何 `ITablePanel*` / `ITableGridProps` / `ITableToolbarProps` / `ITableCreateFormProps` 契约。

---

## Plan 22 — `02.1-22-PLAN.md`（空栏按钮与新建选目录，实现）

**无新增对外命名**（Plan 19 已定义 `ITableCreateFormProps.entries` / `onNavigate`；Plan 20 已定义 `refreshAwaitingPickers`）。本计划只把 `TableCreateForm` 落成「可浏览子目录并选定新建位置」、把空栏三按钮改成更大且竖排、并让 `TablePanel.setEmptyMode` 在进入**新建**态时也取目录。

### 内部辅助（`TableCreateForm.tsx` 内，登记备查）
- `renderDirectoryRow` / `renderCurrentDirectory`（组件内渲染当前目录与子目录行的内部函数）——沿用 `TablePicker` 的 `.etable-list-*` 类名与 `table-list-entry-*` / `table-list-up` 惯例。

### 对既有自由函数的修改（不新增名字，登记备查）
- `renderButtons`（`components/TableEmptyColumn.tsx` 里的**模块级自由函数**，不是类 / 组件的方法）——Plan 22 只把它的三个按钮由 `size="small"` 改为 `size="middle"`；引用时按自由函数**裸名**书写（非 `TableEmptyColumn.renderButtons`）。

### 对既有行为的调整
- `TablePanel.setEmptyMode`：进入 `Create` 态时也 `refreshPicker`（当前只对 `Open` / `Delete` 取目录），使新建表单能列出子目录。

---

## Plan 23 — `02.1-23-PLAN.md`（工具栏下拉 + 标签限宽，实现）

**无新增对外命名**（`ITableToolbarProps` 沿用 `showSchemaButton` / `onOpenSchema` / `codeButtonEnabled` / `onOpenInCodeEditor`；本计划只改渲染为一个小下拉框）。

### 内部 CSS 钩子（`src/table/table.css`，登记备查）
- `.etable-toolbar-more`（下拉触发按钮）——「编辑 Schema / 在代码编辑器中打开」收进 antd `Dropdown` 后的触发按钮样式；两个菜单项沿用既有 `data-test-id`（`table-edit-schema` / `table-open-code`）。

### `editor-core`（无新名字）
- `packages/libs/editor-core/src/shell/shell.css`：`.editor-shell-tab-label` 增加 `max-width: 200px`，令多表标签名超长时省略（`title` 属性仍悬浮显示全名）。
- `packages/libs/editor-core/src/global.d.ts`：补 `declare module '*.css?inline'`（供新增的 CSS 断言测试读取样式原文）。

---

## Plan 24 — `02.1-24-PLAN.md`（开发宿主 e2e + 三包全绿 + 五门禁收口）

**无新增对外命名**（仅迁移 `devHostJsonc.test.tsx`、更新 `02.1-UAT.md` 的 gap 状态）。

---

# 缺口收口轮（UAT `G-02.1-4`） — 命名提案（Plan 25）

**状态：待用户确认。** 依据 `02.1-UAT.md` 的缺口 `G-02.1-4`（severity major，来自 UAT 测试 2）：开发宿主 `packages/apps/editor-dev/src/main.tsx` 只向 `CapabilityProvider` 注入了 `tablePanel` 打开器（与 `tablePresets`），**没有**注入 `ITableEditorCapabilities.codeEditor`；表格工具栏「更多 → 在代码编辑器中打开」（Plan 23 已收进下拉）在开发宿主里点了无用，用户没有查看文件原文的入口，无法核对「合规 `.jsonc` 保存后系统前缀注释块逐字保留」。本轮给开发宿主补一个**真正可用的代码编辑器打开器**（antd `Modal` + 多行文本域），并把它注入能力包。

**本缺口不设「仅接口」计划、不新增 interface / type：** 所需的两个契约都已在既有代码中存在——接缝 `ICodeEditorOpener` 与 Provider props `ITableCapabilitiesProviderProps`（均在 `packages/libs/editor-impl/src/react/capabilities.ts`）。本轮只写宿主侧实现与注入，唯一新增的对外符号是开发宿主组件 `DevCodeEditorProvider`（下）。

---

## Plan 25 — `02.1-25-PLAN.md`（开发宿主代码编辑器打开器，实现 + 端到端 + 签核）

### `DevCodeEditorProvider`（React 函数组件，`packages/apps/editor-dev/src/demo/devCodeEditor.tsx`）
- **用途**：开发宿主专用的能力 Provider 包装——把注入的 `tablePanel` / `tablePresets` 等能力**原样透传**给 `CapabilityProvider`，并额外注入一个由 antd `Modal` + 多行文本域实现的**代码编辑器打开器**，使表格工具栏「在代码编辑器中打开」在开发宿主中真正可用：点开可查看该栏当前视图对应的文件原文（合规 `.jsonc` 即「系统前缀注释块 + JSON 正文」），编辑后确认按原样交给表格面板写回。
- **props 复用既有 `ITableCapabilitiesProviderProps`**（`capabilities?` + `children`，与 `CapabilityProvider` 同形），**不新声明 props 接口**——本缺口类型面零新增。
- 仅存在于开发宿主、不进入产品路径；`editor-core` / `editor-impl` 源码不改。

### 测试钩子（`data-test-id`，非对外命名，登记备查）
- `dev-code-editor`（Modal 根）、`dev-code-editor-text`（多行文本域）、`dev-code-editor-confirm`（确定）、`dev-code-editor-cancel`（取消）。

### 新增测试文件（测试内部，登记备查）
- `packages/apps/editor-dev/src/__tests__/devHostCodeEditor.test.tsx`——开发宿主代码编辑器端到端（菜单项可用 / 打开显示原文含系统前缀标记 / 编辑写回经保存后前缀逐字保留 / 取消不写回）。

### 对既有命名的修改（不新增名字，登记备查）
- `packages/apps/editor-dev/src/main.tsx`：渲染根由 `CapabilityProvider` 换成 `DevCodeEditorProvider`（`tablePanel` / `tablePresets` 注入不变）。

### 对既有命名的删除
- 无。
