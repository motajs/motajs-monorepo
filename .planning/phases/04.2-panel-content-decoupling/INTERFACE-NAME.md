# Phase 04.2 — 接口与命名确认 / 面板内容解耦与文件资源管理器

**Status:** **待用户确认** —— 本文所有名称、类型形状与口径均为**提案**。用户确认前，只允许落「纯类型声明」「常量声明」与「本文件」，不得写任何实现（项目规则：重要命名先确认）。

**Scope:** 本阶段 Plan 02 / 02.1…17 新建 / 改动的全部对外名称：文件名、接口名、类型名、枚举名、方法名、字段名、CSS 类名前缀与 `data-test-id` 前缀，以及它们各自的用途。前序阶段已锁定的名称（`IEditorPanel` / `IEditorPanelType` / `IEditorFileSystem` / `IEditorPanelContext` / `IMapEditorCapabilities` / `IBrowser` 一族等）不重复登记，只登记它们的**新增**成员。

**约定:** 类上的方法写 `类名.方法名`，接口方法写 `接口名.方法名`，自由函数写裸名（如 `deriveSchemaPath`）。每个名字先说明「它是干什么的」，再给名字。

> 读法：一节一个计划。每节先一句话说明「这个计划要做什么」，再给一张「名称 / 种类 / 文件位置 / 用途」表。
> 若某个名字不合适，直接在对话里指出；改名时先改本文，再进入 Plan 02 / Plan 02.1 / Plan 03。

---

## 全局约定（先读这一节）

| # | 约定 | 具体口径 |
|---|------|----------|
| G1 | 方法引用 | 一律 `类名.方法名` 或 `接口名.方法名`（例如 `ShellSystem.closeTab`、`IEditorPanel.onRequestClose`）；只有**自由函数**写裸名（例如 `isTableOpenablePath`）。禁止出现裸方法名。 |
| G2 | 接口成员只读 | 接口成员**默认 `readonly`**；只有外部确实需要直接修改的才去掉 `readonly`（本阶段新增成员全部 `readonly`）。 |
| G3 | 枚举形态 | 一律 `const enum` + **数字**成员 + **大驼峰**成员名（照 `EditorEntryKind` / `PanelCloseChoice`）；不用字符串枚举、不用全大写成员。 |
| G4 | 类型导入 | **禁止 `import type`**；类型再导出用 `export type`。 |
| G5 | 文件头注释 | **不写文件头注释**。文件级说明写在 import 之后、正式代码之前；桶文件不写注释。 |
| G6 | 桶文件 | 一律 `export *`，**不跨目录深路径转发**（`shared/index.ts` 只能 `export * from './fileBrowser'`）。 |
| G7 | 打开参数 | `Record<string, unknown>` 作为面板打开参数是本仓库**既有例外**（`IEditorPanelFactoryParam.openParam` / 现在新增的 `IEditorPanelType.createOpenParam`），不视为「内联对象类型」。 |
| G8 | 接口波次边界 | Plan 02 / Plan 02.1 / Plan 03 只做**纯类型声明**，一行实现都不写（Plan 02.1 额外把 `ShellSystem.activateTab` 的方法签名对齐，方法体不改）；Plan 04…17 只引用这里的声音，不另造同义形状（Plan 03 一节有完整表述）。 |
| G9 | 路径口径 | 全部路径都是「相对项目根、以 `/` 分隔、无前导斜线、不含 `..` 段」的规范化相对路径；面板类型不再自己 normalize。 |

---

## Plan 02 — editor-core 的三组纯类型声明

**要做什么：** 在 `@motajs/editor-core` 里只加类型、不加实现：关闭三态、宿主文件变化流、面板类型的「能否打开 / 打开参数」。

| 名称 | 种类 | 文件位置 | 用途 |
|------|------|----------|------|
| `PanelCloseChoice` | `const enum`（成员 `Save` / `Discard` / `Cancel`） | `packages/libs/editor-core/src/panel/types.ts` | 用户点 ✕ 时面板给出的三种选择：保存并关闭、不保存关闭、取消关闭。 |
| `IEditorPanel.onRequestClose` | 可选接口方法，`(): Promise<PanelCloseChoice>` | 同上 | 外壳询问面板「这次关闭要怎么办」；外壳据此决定是否跳过普通切走落盘。 |
| `IEditorPanel.onDiscard` | 可选接口方法，`(): void` | 同上 | 用户选「不保存关闭」时由外壳投递，面板借此清掉内存里的脏标记，使 `IEditorPanel.dispose` 的兜底保存变成空操作。 |
| `IEditorPanel.onResourceChange` | 可选接口方法，`(id: IResourceIdentifier, kind: EditorFileChangeKind): Promise<void>` | 同上 | 面板收到「哪个路径、发生了什么变化」的新通道；与既有的 `IEditorPanel.onUpdateResource` **并存**。 |
| `EditorFileChangeKind` | `const enum`（成员 `Add` / `Change` / `Delete`） | `packages/libs/editor-core/src/fs/types.ts` | 一条宿主文件变化属于新增、内容变化还是删除。 |
| `IEditorFileChange` | interface（成员 `readonly path` / `readonly kind`） | 同上 | 一条宿主文件变化事件：变化文件的规范化相对路径 + 变化种类。 |
| `IEditorFileSystem.watch` | 可选接口方法，`(listener: (change: IEditorFileChange) => void) => () => void` | 同上 | 宿主注入的「文件变化流」订阅入口，返回退订函数；宿主不提供时整个方法省略，core 退化为「只在切入时重读」。 |
| `IResourceSystemHooks.onResourceChange` | 可选接口方法，`(identifier: IResourceIdentifier, kind: EditorFileChangeKind): Promise<void>` | `packages/libs/editor-core/src/resource/types.ts` | 资源层把宿主变化转给上层，**不预读内容**（删除事件才不会抛错）。 |
| `IEditorPanelType.canOpen` | 可选接口方法，`(path: string): boolean` | `packages/libs/editor-core/src/panel/types.ts` | 面板类型判断「这个完整路径我能不能打开」；判定依据是完整路径而不是后缀列表。 |
| `IEditorPanelType.createOpenParam` | 可选接口方法，`(path: string): Record<string, unknown>` | 同上 | 面板类型自己把完整路径转成本类型的打开参数；必须是纯函数、每次返回新对象，资源管理器不解释参数形状。 |

**不在此节的名字：** `IShellSystem.activateTab` 的返回类型改造（`void` → `Promise<void>`）改由 **§Plan 02.1** 落地——Plan 02 在执行后才发现需要这条 B1 接口变更，而已完成计划的追加任务不会被执行，故单独成节。

**两条保留约束（本计划明确不改旧签名）：**

- `IEditorPanel.onBeforeClose` **保留旧的布尔语义、签名不变**（`(): Promise<boolean>`）；外壳优先 `IEditorPanel.onRequestClose`，没有它时才退回旧路径。这样既有 7 条关闭测试与 `MapPanel.onBeforeClose` 都不用改。
- `IEditorPanel.onUpdateResource` **仍是必选成员、签名不变**；新通道只是并列的可选入口，第三方旧面板继续走它。

**未被采纳的提案：** 研究中曾出现的独立 `IEditorFileWatcher` 接口**不引入**——变化流直接挂在 `IEditorFileSystem.watch` 上，避免同时存在两条注入路径。

---

## Plan 02.1 — editor-core 的切标签签名（纯接口）

**要做什么：** 只把「切标签」声明成一个可等待的保存点：`IShellSystem.activateTab` 的返回类型从 `void` 改为 `Promise<void>`，实现类 `ShellSystem.activateTab` 加 `async` 与返回类型（**方法体一字不改**）。不含任何行为、不含测试。

| 名称 | 种类 | 文件位置 | 用途 |
|------|------|----------|------|
| `IShellSystem.activateTab` | 既有接口方法（返回类型改造），`(tabId: string): Promise<void>` | `packages/libs/editor-core/src/shell/types.ts` | 切换活动标签。外壳**先 `await` 即将离开面板的 `IEditorPanel.onSwitchOut` 结算完成**，再修改活动标签并通知 React 重渲染——因此保存期间旧面板的组件仍然挂载，面板可以在钩子里直接读取组件 ref。这是 B1 决议，**不新增**第二个保存钩子。 |
| `ShellSystem.activateTab` | 既有公开方法（签名对齐），`async (tabId: string): Promise<void>` | `packages/libs/editor-core/src/shell/shellSystem.ts` | 满足新接口；方法体仍是 Plan 04 的顺序，真正的「先等保存再切换」由 §Plan 04.1 落实。 |

**为什么单独一节：** 这条接口变更原本被追加为 Plan 02 的 Task 4，但 Plan 02 已 complete（执行器跳过有 SUMMARY 的计划），追加任务永远不会跑。因此拆成独立的接口计划 `04.2-02.1`（wave 3，`depends_on: 04.2-02`），`04.2-04.1` 的 `depends_on` 补上它。

---

## Plan 03 — editor-impl 的契约声明（可编辑组件 / 浏览器 / 弹窗 / 资源管理器 / 三面板状态）

**要做什么：** 在 `@motajs/editor-impl` 里只新建 `types.ts` 与桶文件、只追加类型，不写任何组件、弹窗或面板逻辑。

| 名称 | 种类 | 文件位置 | 用途 |
|------|------|----------|------|
| `IEditableContentHandle<T>` | interface（成员 `getData` / `setData` / `isDirty` / `markSaved`） | `packages/libs/editor-impl/src/shared/editable/types.ts`（新建） | 可编辑组件通过 ref 暴露给面板的四项能力：读取当前内容快照、用给定内容替换、判断是否脏、把当前内容标记为已保存。 |
| `IEditableContentProps<T>` | interface（成员 `content` / `contentVersion` / `ref` / `onSave` / `onDraftChange`） | 同上 | 面板传给可编辑组件的完整 props：分配的内容、控制草稿重置的版本号、ref 句柄、组件内部请求保存、以及把最新草稿交回面板的通道。 |
| `ContentSaveStatus` | `const enum`（成员 `Saved` / `Failed`） | 同上 | 组件内部保存请求的两种结果，组件据此显示保存中 / 成功 / 失败。 |
| `IFileBrowserProps` | interface（成员 `directory` / `loadChildren` / `filter` / `onOpen` / `testIdPrefix` / `errorText` / `emptyText` / `renderRowAction` / `reloadToken`） | `packages/libs/editor-impl/src/shared/fileBrowser/types.ts`（新建） | 共用文件浏览器的全部输入：起始目录、读目录回调、文件过滤谓词、打开回调、可换的 test id 前缀与三种文案槽。 |
| `IPanelCloseDialogProps` | interface（成员 `open` / `saving` / `error` / `onChoose`） | `packages/libs/editor-impl/src/shared/panelDialogs/types.ts`（新建） | 关闭三态确认框的展示态与选择回调；组件只渲染，不持有面板状态。 |
| `IExternalChangeDialogProps` | interface（成员 `open` / `onDiscard` / `onKeep`） | 同上 | 外部变化冲突提示框的两个选项回调：放弃本地改动并刷新、保留本地改动并下次覆盖。 |
| `IFileExplorerCapabilities` | interface（成员 `listPanelTypes` / `openPanel`） | `packages/libs/editor-impl/src/explorer/types.ts`（新建） | 宿主注入给资源管理器的两项外壳能力：列出已注册面板类型、新开标签并打开指定面板类型。 |
| `IFileExplorerPanel` | interface（成员 `id` / `openPath` / `loadChildren` / `filterPath` / `selectCandidate` / `cancelCandidate`） | 同上 | 资源管理器面板的对外契约：打开一个路径、读某目录的直接子条目、判断某路径是否显示、选中某个候选面板、取消候选选择；后两者都必须同时清空待打开路径与候选列表。 |
| `IFileExplorerViewState` | interface（成员 `directory` / `reloadToken` / `pendingPath` / `candidateTypeIds` / `error` 等） | 同上 | 资源管理器视图的只读快照：当前目录、外部刷新令牌、正在等用户选的路径、候选面板类型标识、读取失败文案。 |
| `IFileExplorerViewProps` | interface | 同上 | 资源管理器视图组件（`FileExplorerView`）的 props：视图快照 + 五个回调。 |
| `IPanelCandidateModalProps` | interface（成员 `open` / `path` / `candidates` / `onSelect` / `onCancel`） | 同上 | 候选面板弹窗的 props：要打开的文件路径、候选面板类型列表、选中与取消回调。 |
| `ITableDocument` | interface（成员 `readonly data` / `readonly schema` / `readonly schemaMode`） | `packages/libs/editor-impl/src/table/types.ts` | 表格组件的一栏内容：当前数据、schema 与「是不是 schema 视图」一并打包；这是**面板结构，不要求等于文件结构**（D-39）。 |
| `TableEditKind` | `const enum`（成员 `Change` / `Add` / `Delete`） | 同上 | 表格里一次编辑意图的种类：改值、新增字段、删除字段。 |
| `ITableEdit` | interface（成员 `readonly kind` / `readonly fieldPath` / `readonly value` / `readonly anchor` / `readonly name` / `readonly config`） | 同上 | 表格组件交给面板的一次编辑意图：种类 + 字段路径 + 新值 / 锚点 / 新名 + 行内配置。 |
| `ITableEditableProps` | interface，继承 `IEditableContentProps<ITableDocument>`（另加 `applyEdit` 与透传给 `TableGrid` 的展示回调） | 同上 | 表格可编辑组件的完整 props：通用可编辑契约 + 编辑落点 + 展示层回调。 |
| `ITablePendingConflict` | interface（成员 `readonly columnIndex` / `readonly path` / `readonly incomingText`） | 同上 | 表格某一栏出现了「有脏改动 + 外部内容真的变了」的冲突，等待用户选择。 |
| `ITableCloseDialogState` | interface（成员 `readonly open` / `readonly saving` / `readonly error`） | 同上 | 表格面板级的关闭三态弹窗状态（面板根上只挂一处，不按栏挂）。 |
| `IAssetPendingConflict` | interface（成员 `readonly categoryId` / `readonly path` / `readonly incomingText`） | `packages/libs/editor-impl/src/asset/types.ts` | 素材面板里一个分类出现了「有脏改动 + 外部内容真的变了」的冲突。 |
| `IAssetCloseDialogState` | interface（成员 `readonly open` / `readonly saving` / `readonly error`） | 同上 | 素材面板的关闭三态弹窗状态。 |
| `IMapPendingConflict` | interface（成员 `readonly path` / `readonly incomingText`） | `packages/libs/editor-impl/src/map/types.ts` | 地图面板出现了「有脏改动 + 外部内容真的变了」的冲突。 |
| `IMapCloseDialogState` | interface（成员 `readonly open` / `readonly saving` / `readonly error`） | 同上 | 地图面板的关闭三态弹窗状态。 |
| `IMapEditorCapabilities.resolveMapPath` | 可选接口方法，`(path: string): string \| null` | 同上 | 宿主把完整路径解析成地图标识；`editor-impl` 不内置任何目录约定，该路径不是本宿主的地图文件时返回 `null`。 |
| `IMapImageSources` | interface（成员 `urls` / `status`，**以图片路径为键**） | 同上 | 地图画布用的图源表：图片相对路径 → `blob:` 地址与读取状态（键是 `cell.imagePath`）。 |
| `IMapImageSourceStore` | interface（成员 `refresh` / `getSources` / `getGroupUrls` / `dispose`） | 同上 | 图块地址的生命周期契约：按路径创建 / 复用 / 回收地址，并产出两张各自键空间的只读快照。 |
| `MapImageBytesLoader` | type（`(path: string) => Promise<Uint8Array \| undefined>`） | 同上（**从 `components/useMapObjectUrl.ts` 上移**） | 按图片相对路径读字节的回调类型；上移后组件与面板共用一个声明，不再各写一份。 |
| `IMapTileGroupUrls` | interface（成员 `urls` / `status`，**以 `group.id` 为键**） | 同上（**从 `components/useMapObjectUrl.ts` 上移**） | 素材区 / 底栏 / 收藏栏用的图源表：分组标识 → `blob:` 地址与读取状态。与 `IMapImageSources` 键空间不同，**两张表不可混用**。 |

**接口波次的边界（写死，后续计划只引用）：**

Plan 03 定稿的是**新增**的文件级 props 与**新增**的具名状态形状（`IFileBrowserProps`、`IFileExplorerViewProps` / `IPanelCandidateModalProps`、`ITableDocument` / `ITableEdit` / `ITableEditableProps`、三个面板的 `*PendingConflict` / `*CloseDialogState`、图块地址三件契约）。Plan 10 / 11 / 12 / 17 只引用这些名字，**不得另造第二份同义形状**。

但**既有组件**的接口允许在各自的实现计划里随迁移一起修改——例如 `ITablePickerProps` / `ITableCreateFormProps` / `ITableEmptyColumnProps`（Plan 07）、`ITablePanelViewProps`（Plan 11）、`IMapSurfaceProps`（Plan 14）、`IAssetPreviewProps` / `ITranscodeModalProps` / 素材容器组件的 props（Plan 16）。这类修改属于「把既有组件接到新契约上」，不是新造形状；**每个被改到接口的组件文件必须列进那个计划的 `files_modified`**。不要把它理解成「实现计划永不改 props」。

**分组职责（D-39 / D-40 的分层取舍）：**

- **面板持有什么：** 文件路径、文件原文基线、权威内容、保存入口、撤销上下文。面板是「文件结构 → 组件内容结构」的**适配器**，按自己要的数据类型读取并转换（D-39）。
- **组件持有什么：** 只有渲染所需的内容与挂载期间的编辑状态；不接收路径、不主动读文件。
- **分层取舍：** 表格走字面契约——**表格组件持草稿**、卸载时把草稿与当时的脏标记交回面板，面板保留交回副本供撤销与保存；地图 / 素材走**面板持权威文档**、组件只接收内容 + 回调（D-40）。两者都遵守「组件接收内容、发出保存请求」，差别只在「谁持有权威内容」。

---

## Plan 04 — 外壳的关闭三态与切出顺序

**要做什么：** 让外壳在面板声明 `IEditorPanel.onRequestClose` 时按三态分流，并让 `ShellSystem.discardTab` 具备「跳过普通切走落盘」的能力；同时把切出投递提前到状态通知之前。

| 名称 | 种类 | 文件位置 | 用途 |
|------|------|----------|------|
| `ShellSystem.closeTab` | 既有公开方法（改造） | `packages/libs/editor-core/src/shell/shellSystem.ts` | 关闭标签的唯一用户入口；新增 Save / Discard / Cancel 三条分支，Discard 先调 `IEditorPanel.onDiscard` 再跳过落盘释放。 |
| `ShellSystem.discardTab` | 既有私有方法（改造） | 同上 | 真正移除标签的地方；新增 `skipFlush` 参数，为真时不投递 `onSwitchOut`，但**仍必须清掉 `lastActiveInstanceId`**。 |
| `ShellSystem.leaveActiveInstance` | 既有私有方法（拆分） | 同上 | 现在同时做「清记录」与「排切出」；拆开后 `skipFlush` 只跳过「排切出」，不跳过「清记录」，否则邻居拿不到 `onSwitchIn`。 |
| `ShellSystem.enqueueSwitchOut` / `ShellSystem.enqueueSwitchIn` | 既有私有方法（拆出） | 同上 | 把「先投递切出、再投递切入」拆成两步排进串行链，保证切入一定排在切出结算之后（B1 之后仍保留）。 |
| `ShellSystem.activateTab` | 既有公开方法（改造） | 同上 | **B1 修订后：**返回 `Promise<void>`，切换前先 `await` 旧面板的 `IEditorPanel.onSwitchOut`，保存完成后再改活动标签并通知 React。原「先排切出再通知」的写法已被 `04.2-04.1` 取代。 |
| `shellCloseChoice.test.ts` | 测试文件（新建） | `packages/libs/editor-core/src/shell/__tests__/` | 钉死四条语义：Save 跳落盘、Discard 调 `onDiscard` 且不落盘、Cancel 保持标签、注销类型 / 释放 core 不询问。 |
| `shellSwitchOrder.test.ts` | 测试文件（新建） | 同上 | 钉死「切出时组件已卸载也不丢最后一次编辑」与「`onSwitchOut` 同步前缀可读到最后一次输入」。 |

> **B1 修订（2026-10-28）：** 本节的「切出投递提前到状态通知之前」已被 `## Plan 04.1` 取代——用户否决了「先排队再通知」的补丁，也否决新增 `onBeforeSwitchOut`。关闭三态（`ShellSystem.closeTab` / `ShellSystem.discardTab` 的 `skipFlush`）**全部保留**。

---

## Plan 04.1 — B1：切标签先等保存、再通知卸载

**要做什么：** 把 Plan 04 的「先排队再通知」补丁改成 B1：外壳在改活动标签、通知 React、投递切入**之前**就 `await` 旧面板的 `IEditorPanel.onSwitchOut`；保存完成前旧组件仍挂载。删除 `ShellSystem.enqueueDeparture`，三条活动变化入口共用同一个可等待的保存前缀。**不新增任何接口名**（`onSwitchOut` 语义不变，`activateTab` 的返回类型在 §Plan 02.1 已改）。

| 名称 | 种类 | 文件位置 | 用途 |
|------|------|----------|------|
| `ShellSystem.activateTab` | 既有公开方法（B1 实现） | `packages/libs/editor-core/src/shell/shellSystem.ts` | 先 `await` 旧面板切出保存，再改 `activeTabId` → `notify()` → `syncActiveInstance()`。 |
| `ShellSystem.departActiveInstance` | 新增私有方法，`(nextInstanceId: string \| null) => Promise<void>` | 同上 | 三条入口共用的可等待保存前缀：整段「判定 + 切出」排在 `switchChain` 上串行执行，执行时才读 `lastActiveInstanceId`（目标实例未变直接返回），先清记录再 `await` 该实例的切出。 |
| `ShellSystem.openBlankTab` | 既有公开方法（B1 调整） | 同上 | 仍同步返回新标签 id；当确有面板挂载时，只先追加标签并通知列表，随后走同一条 `activateTab` 完成切换。 |
| `ShellSystem.openPanelInTab` | 既有公开方法（B1 调整） | 同上 | 在改 `activeTabId` 之前 `await` 旧面板的切出保存；标签内替换分支保持原样。 |
| `ShellSystem.closeTab` | 既有公开方法（B1 调整） | 同上 | 「先切到目标标签」改为 `await this.activateTab(tabId)`；三态分支与 `skipFlush` 一字不改。 |
| `ShellSystem.enqueueDeparture` | 删除 | 同上 | 「先排队再通知」的时序补丁退场。 |
| `shellSwitchOrder.test.ts` | 测试文件（重写） | `packages/libs/editor-core/src/shell/__tests__/` | 钉死「保存结算前组件不 unmount」「结算后才 unmount」「同一次切换只切出一次」「`onSwitchOut` 里能读到组件内容」。 |

**B1 的口径（写死，后续计划只引用）：**
1. `IEditorPanel.onSwitchOut` 是**唯一**的切出保存点；不新增 `onBeforeSwitchOut` 或第二个保存钩子。
2. 切标签的顺序固定为：`await` 旧面板 `onSwitchOut` → 改 `activeTabId` → `notify()`（React 此时才卸载）→ 投递切入。
3. `IShellSystem.activateTab` 返回 `Promise<void>`；`openBlankTab` 仍同步返回 `string`。
4. 关闭三态与 `skipFlush` 语义不变，只把「先激活目标标签」补成 `await`。

---

## Plan 05 — 宿主文件变化流接进 core

**要做什么：** 资源层在初始化时订阅宿主变化流、释放时退订，事件到达时更新文件索引与内容缓存，并把「路径 + 种类」转给面板。

| 名称 | 种类 | 文件位置 | 用途 |
|------|------|----------|------|
| `ResourceSystem.handleFileChange` | 新增私有方法，`(change: IEditorFileChange) => Promise<void>` | `packages/libs/editor-core/src/resource/resourceSystem.ts` | 一条宿主变化的处理入口：先校验路径（拒绝空 / 绝对 / 含 `..` 段），再按种类增删索引、失效缓存，最后通知钩子；**不做内容比较、不吞事件**。 |
| `ResourceSystem.initialize` | 既有方法（改造） | 同上 | 初始化时订阅 `IEditorFileSystem.watch` 并保存退订函数。 |
| `ResourceSystem.dispose` | 既有方法（改造） | 同上 | 释放时先退订再清索引与缓存。 |
| `ShellPanelHooks.onResourceChange` | 新增转发方法 | `packages/libs/editor-core/src/shell/shellSystem.ts` | 面板实现了 `IEditorPanel.onResourceChange` 就只转发 `(id, kind)`（不预读）；否则退回旧的预读路径。 |
| `FakeFileSystem.watch` / `FakeFileSystem.emit` | 测试替身成员（新增，**默认关闭**） | `packages/libs/editor-core/src/__tests__/fixtures.ts` | 让测试能显式发出一条宿主变化；默认关闭，避免既有 106 条用例凭空多出通知。 |
| `resourceWatch.test.ts` | 测试文件（新建） | `packages/libs/editor-core/src/resource/__tests__/` | 钉死七条语义：Add / Change / Delete 更新索引与缓存、退订生效、删除不抛、非法路径被拒。 |

---

## Plan 06 — 共用文件浏览器 `FileBrowser`

**要做什么：** 实现单目录列表 + 面包屑 + 四种状态（载入 / 空 / 错误 / 有内容）的共用浏览器，让表格空栏与资源管理器共用同一份实现。

| 名称 | 种类 | 文件位置 | 用途 |
|------|------|----------|------|
| `FileBrowser` | React 组件（新建） | `packages/libs/editor-impl/src/shared/fileBrowser/FileBrowser.tsx` | 单目录列表 + 面包屑的共用浏览器；只渲染、只调面板给的回调，自己不碰文件系统。 |
| `IFileBrowserProps` | interface（Plan 03 已声明） | `packages/libs/editor-impl/src/shared/fileBrowser/types.ts` | 浏览器的全部输入；本计划只消费，不再新增成员。 |
| `efb-` | CSS 类名前缀 | `packages/libs/editor-impl/src/shared/fileBrowser/file-browser.css`（新建） | 浏览器自身的类名前缀（`efb` / `efb-crumb` / `efb-row` / `efb-loading` 等）；表格的预设区继续用既有 `.etable-list-presets` 一族。 |
| `file-browser.css` | 样式文件（新建，连字符命名） | 同上 | 浏览器的工具栏、面包屑、行与四种状态的样式；外框用 1px `--editor-border`，不复用 `.etable-list` 的 2px 外框。 |
| `file-browser` | `data-test-id` 前缀（缺省值） | 同上 | 浏览器在不指定 `testIdPrefix` 时的测试标识前缀；表格传 `table-list`、资源管理器传 `explorer`。 |
| `table-list` | `data-test-id` 前缀（由表格传入） | `packages/libs/editor-impl/src/table/components/TablePicker.tsx` | 保住约 56 处既有 `table-list-*` 断言；必须在接入的第一条任务里就接上。 |
| `explorer` | `data-test-id` 前缀（由资源管理器传入） | `packages/libs/editor-impl/src/explorer/components/FileExplorerView.tsx` | 资源管理器传给浏览器的前缀，配合 `explorer-panel` / `explorer-title` 一族。 |

---

## Plan 07 — 表格空栏改用共用浏览器与新过滤口径

**要做什么：** 把表格空栏与新建表单的目录浏览从「面板喂条目」改成「浏览器自己读目录」，并把打开态的过滤口径改成「表格能打开的所有 JSON / JSONC（含 schema）」，删除态仍只列数据文件。

| 名称 | 种类 | 文件位置 | 用途 |
|------|------|----------|------|
| `isTableOpenablePath` | 自由函数，`(path: string) => boolean` | `packages/libs/editor-impl/src/table/resourceType.ts` | 表格「这个完整路径能不能打开」的唯一谓词：`.json` + `.jsonc`，含 schema 文件；资源管理器、表格空栏、表格面板类型三处共用它。 |
| `isTableDataPath` | 既有自由函数（保留） | 同上 | 删除态仍用它（不含 schema），避免用户直接删掉任意 schema 文件。 |
| `tablePanelType.canOpen` | 面板类型成员（新增实现） | `packages/libs/editor-impl/src/table/tablePanelType.ts` | 表格面板类型按完整路径判断能否打开，内部只调用 `isTableOpenablePath`。 |
| `tablePanelType.createOpenParam` | 面板类型成员（新增实现） | 同上 | 把路径转成 `{ target: { dataPath: path } }`；每次返回新对象，交给 `tablePanelType.create` 的 `setTable` 默认开在第 0 栏。 |
| `pickerReloadToken` | 栏状态字段（`ITablePanelColumn` 新增） | `packages/libs/editor-impl/src/table/tablePanel.ts` | 空栏浏览器的外部刷新令牌；外部变化或目录内容变化时递增，浏览器据此重读当前目录。 |
| `TablePanel.loadPickerChildren` | 面板方法，`(columnIndex, path) => Promise<readonly IFileEntry[]>` | 同上 | 空栏浏览器的读目录入口，内部走 `IEditorPanelContext.listDirectory`（索引驱动），不自己递归 fs。 |
| `TablePanel.navigatePicker` | 面板方法（改造） | 同上 | 记录某栏浏览器当前目录并触发重读；替代原先由面板预读条目再喂给组件的做法。 |
| `TableCreateForm.loadChildren` | 组件 props 成员（新增） | `packages/libs/editor-impl/src/table/components/TableCreateForm.tsx` | 新建表格表单自己读目录用的回调；新建的「可选目标目录」是既有能力，本计划只换数据来源。 |
| `ITablePickerProps` / `ITableCreateFormProps` / `ITableEmptyColumnProps` | 既有组件 props（随迁移修改） | `packages/libs/editor-impl/src/table/components/` | 改为传入 `loadChildren` / `filter` / `testIdPrefix` 等浏览器契约成员；这三个文件已列进本计划的 `files_modified`。 |

---

## Plan 08 — 表格每栏的可编辑组件契约

**要做什么：** 新建 `EditableTable` 包住现有 `TableGrid`，由组件持草稿、用 ref 暴露四项能力、用 `contentVersion` 控制草稿重置，并在卸载前把草稿与**当时的**脏标记交回面板。

| 名称 | 种类 | 文件位置 | 用途 |
|------|------|----------|------|
| `EditableTable` | React 组件（新建，实现 ref 契约） | `packages/libs/editor-impl/src/table/components/EditableTable.tsx` | 表格每栏的可编辑组件：持有草稿、自己算行树、实现 `IEditableContentHandle` 的四项能力。 |
| `ITableEditableProps` | interface（Plan 03 已声明） | `packages/libs/editor-impl/src/table/types.ts` | 该组件的完整 props；本计划只消费。 |
| `dirtyRef` | 组件内 `useRef<boolean>` | `packages/libs/editor-impl/src/table/components/EditableTable.tsx` | 把脏标记镜像进 ref，使空依赖的 ref 句柄与卸载 cleanup 都能读到**当前**值，而不是首帧闭包值。 |
| `contentVersion` | 栏状态字段 + 视图字段（`ITablePanelColumn.contentVersion` / `ITablePanelViewState.content`） | `packages/libs/editor-impl/src/table/tablePanel.ts` | 面板「换内容」的信号：只有载入、外部刷新、撤销重做、换表、保存回写五处递增；本地编辑也递增就是错误。 |
| `draft` | 栏状态字段（`ITablePanelColumn.draft`） | 同上 | 面板保存的「组件交回来的草稿副本」，撤销与保存都作用于它。 |
| `draftDirty` | 栏状态字段（`ITablePanelColumn.draftDirty`） | 同上 | 组件交回来的草稿是否脏；与 `draft` 成对写入，换表 / 载入 / 外部刷新 / 关栏时一起作废。 |
| `TablePanel.applyEdit` | 面板方法，`(columnIndex, edit: ITableEdit) => void` | 同上 | 本阶段**唯一的编辑实现**：接住组件的编辑意图、落成新文档、记撤销、刷新视图；组件不再直接调 `commitValue` 一族。 |
| `TablePanel.saveDocument` | 面板方法，`(columnIndex, document: ITableDocument) => Promise<ContentSaveStatus>` | 同上 | 保存入口：组件内部请求保存与面板切走保存都走它；成功后清脏并回写基线。 |
| `TablePanel.isColumnDirty` | 面板方法，`(columnIndex) => boolean` | 同上 | 面板侧唯一的脏判定：`draftDirty || unsaved || unsavedSchema`（或读组件 ref 的 `isDirty`），供切走 / 关闭 / 保存前跳过判断。 |
| `TablePanel.resetColumnDraft` | 面板方法，`(columnIndex) => void` | 同上 | 换表 / 载入 / 外部刷新 / 关栏时把该栏草稿与 `draftDirty` 一起作废，避免组件从上一张表的草稿重置。 |
| `TablePanel.bumpContentVersion` | 面板方法，`(columnIndex) => void` | 同上 | 版本号自增的唯一实现；必须与草稿作废成对调用，面板替换内容统一从这里发布。 |
| `saving` | 可选 props 成员（`ITableGridProps.saving` / `ITableToolbarProps.saving`） | `packages/libs/editor-impl/src/shared/schemaForm/components/TableGrid.tsx` / `TableToolbar.tsx` | 保存期间的禁用与「保存中…」状态（D-04），仅供组件显示，不改变既有调用点。 |

**版本号纪律（写死）：** 版本号只在**载入 / 外部刷新 / 撤销重做 / 换表 / 保存回写**五处递增；本地编辑不递增。把「本地编辑」与「面板换内容」混成同一个信号，会让「刚编辑过」被判成「不脏」，关闭时被静默跳过落盘。

---

## Plan 09 — 两个共享面板弹窗

**要做什么：** 把关闭三态确认框与外部变化冲突提示框做成纯展示组件，三个面板各自在自己的视图里挂载。

| 名称 | 种类 | 文件位置 | 用途 |
|------|------|----------|------|
| `PanelCloseDialog` | React 组件（新建） | `packages/libs/editor-impl/src/shared/panelDialogs/PanelCloseDialog.tsx` | 关闭三态确认框：取消 / 不保存关闭 / 保存并关闭，含保存中与保存失败两种展示态。 |
| `ExternalChangeDialog` | React 组件（新建） | `packages/libs/editor-impl/src/shared/panelDialogs/ExternalChangeDialog.tsx` | 外部变化冲突提示框：放弃我的改动并刷新 / 保留我的改动，下次保存覆盖。 |
| `IPanelCloseDialogProps` / `IExternalChangeDialogProps` | interface（Plan 03 已声明） | `packages/libs/editor-impl/src/shared/panelDialogs/types.ts` | 两个弹窗的 props；本计划只消费。 |
| `edlg-` | CSS 类名前缀 | `packages/libs/editor-impl/src/shared/panelDialogs/panel-dialogs.css`（新建） | 两个共享弹窗的正文段落、说明行与保存中样式的类名前缀；页脚复用 `.eimodal-footer`。 |
| `panel-dialogs.css` | 样式文件（新建，连字符命名） | 同上 | 共享弹窗样式表；`package.json` 的 `sideEffects` 已覆盖 `./src/**/*.css`，无需工程改动。 |

---

## Plan 10 — 表格面板的外部变化同步

**要做什么：** 逐栏匹配路径、按基线原文比较，不脏自动刷新、脏则弹冲突、自己写入的回声直接忽略。

| 名称 | 种类 | 文件位置 | 用途 |
|------|------|----------|------|
| `baselineText` | 栏状态字段（`ITablePanelColumn.baselineText`） | `packages/libs/editor-impl/src/table/tablePanel.ts` | 该栏数据文件「上一次载入 / 写盘的原文」；外部变化先与它比较，相同即视为自写回声并忽略。 |
| `baselineSchemaText` | 栏状态字段（`ITablePanelColumn.baselineSchemaText`） | 同上 | 该栏 schema 文件的上一次原文基线；与 `baselineText` 同口径。 |
| `pendingConflict` | 栏状态字段 + 视图字段（`ITablePanelViewState.pendingConflict`，类型 `ITablePendingConflict`） | 同上 | 「有脏改动 + 外部内容真的变了」时记下的待决冲突；不丢、不覆盖，等用户选。 |
| `ITablePendingConflict` | interface（Plan 03 已声明） | `packages/libs/editor-impl/src/table/types.ts` | 冲突载荷：哪一栏、哪个路径、外部原文是什么。 |
| `TablePanel.onResourceChange` | 面板方法（新增实现） | `packages/libs/editor-impl/src/table/tablePanel.ts` | 逐栏匹配 `dataPath` / 推导出的 schema 路径；按基线比较后分「忽略 / 自动刷新 / 弹冲突」三条分支。 |

---

## Plan 11 — 表格面板的关闭三态

**要做什么：** 无脏直接允许关闭；有脏时在面板根上弹一处共享确认框；保存失败保持打开；选丢弃时清脏以抵消 `dispose` 的兜底保存。

| 名称 | 种类 | 文件位置 | 用途 |
|------|------|----------|------|
| `closeDialog` | 面板级状态字段（类型 `ITableCloseDialogState`） | `packages/libs/editor-impl/src/table/tablePanel.ts` | 表格面板的关闭弹窗状态：是否打开、是否保存中、失败原因；**只一份，挂在面板根上，不按栏挂**。 |
| `TablePanel.closeDialogStore` | 面板成员（`Store<ITableCloseDialogState>`） | 同上 | 让面板根视图订阅关闭弹窗状态的唯一入口；避免三栏各弹一个框，或只有第 0 栏能弹。 |
| `ITableCloseDialogState` | interface（Plan 03 已声明） | `packages/libs/editor-impl/src/table/types.ts` | 关闭弹窗的具名状态形状；Plan 11 只引用。 |
| `ITablePanelViewProps.closeDialogStore` | 既有视图 props 新增成员 | `packages/libs/editor-impl/src/table/tablePanel.ts`（视图 props 定义处） | 把关闭弹窗状态交给面板根视图渲染；该文件已列进本计划的 `files_modified`。 |
| `TablePanel.onRequestClose` | 面板方法（新增实现） | 同上 | 无脏直接返回 `PanelCloseChoice.Save`（不弹框）；有脏时打开 `closeDialog` 并等用户选择；保存任一栏失败返回 `Cancel`。 |
| `TablePanel.onDiscard` | 面板方法（新增实现） | 同上 | 用户选「不保存关闭」时清空各栏 `unsaved` / `unsavedSchema` / `draftDirty`，使 `TablePanel.dispose` 的兜底保存成为空操作。 |

---

## Plan 12 — 文件资源管理器面板

**要做什么：** 新建「只浏览 + 打开」的资源管理器：面板、面板类型工厂、视图、候选弹窗，并作为新 subpath 接进包导出与依赖门禁。

| 名称 | 种类 | 文件位置 | 用途 |
|------|------|----------|------|
| `FileExplorerPanel` | 面板类（新建，`implements IFileExplorerPanel, IEditorPanel`） | `packages/libs/editor-impl/src/explorer/fileExplorerPanel.ts` | 资源管理器面板：持有当前目录、外部刷新令牌、待打开路径、候选列表与错误文案。 |
| `IFileExplorerPanel` | interface（Plan 03 已声明） | `packages/libs/editor-impl/src/explorer/types.ts` | 该面板的对外契约；本计划只实现。 |
| `createFileExplorerPanelType` | 工厂函数（新建） | `packages/libs/editor-impl/src/explorer/fileExplorerPanelType.ts` | 由宿主注入 `IFileExplorerCapabilities` 后产出 `IEditorPanelType`；形态照 `createMapPanelType`。 |
| `FileExplorerView` | React 组件（新建） | `packages/libs/editor-impl/src/explorer/components/FileExplorerView.tsx` | 资源管理器视图：头部标题 + 共用浏览器 + 候选弹窗挂载点；只接 props 与回调。 |
| `PanelCandidateModal` | React 组件（新建） | `packages/libs/editor-impl/src/explorer/components/PanelCandidateModal.tsx` | 多个面板都能打开时让用户选一个；每项一个全宽按钮，页脚只有「取消」。 |
| `IFileExplorerViewProps` / `IPanelCandidateModalProps` | interface（Plan 03 已声明） | `packages/libs/editor-impl/src/explorer/types.ts` | 视图与候选弹窗的 props；本计划只消费。 |
| `efx-` | CSS 类名前缀 | `packages/libs/editor-impl/src/explorer/explorer.css`（新建） | 资源管理器面板根、头部、正文与候选路径行的类名前缀。 |
| `explorer.css` | 样式文件（新建） | 同上 | 资源管理器样式表；候选列表复用 `.eimodal-list` 一族。 |
| `./explorer` | `package.json` 新 subpath | `packages/libs/editor-impl/package.json` | 让宿主按能力 subpath 引入资源管理器；**不进** `src/index.ts` 根桶。 |
| `FileExplorerPanel.openPath` | 面板方法，`(path: string) => void` | `packages/libs/editor-impl/src/explorer/fileExplorerPanel.ts` | 一次点击的完整流程：求候选（0 提示 / 1 直接开 / 多则弹窗）、打开失败时关掉刚开的空白标签。 |
| `FileExplorerPanel.loadChildren` | 面板方法，`(path) => Promise<readonly IFileEntry[]>` | 同上 | 浏览器的读目录入口，走 `IEditorPanelContext.listDirectory`，并剔除点开头的目录。 |
| `FileExplorerPanel.filterPath` | 面板方法，`(path) => boolean` | 同上 | 文件行是否显示：存在至少一个同时声明 `IEditorPanelType.canOpen` 与 `IEditorPanelType.createOpenParam`、且 `IEditorPanelType.canOpen(path) === true` 的面板类型；目录行不经过它。 |
| `FileExplorerPanel.selectCandidate` | 面板方法，`(typeId: string) => void` | 同上 | 用户在候选弹窗里选中一个面板类型后打开它；**同时清空 `pendingPath` 与 `candidateTypeIds`**，否则候选弹窗会在选中后复活。 |
| `FileExplorerPanel.cancelCandidate` | 面板方法，`() => void` | 同上 | 取消候选选择；同样同时清空 `pendingPath` 与 `candidateTypeIds`。 |
| `.dependencyCruiser.cjs` 的能力互斥正则 | 配置（修改） | `.dependencyCruiser.cjs` | 把 `explorer` 加进「能力之间互不依赖」的 `from` / `to`，让「资源管理器直接 import 表格谓词」当场变红。 |

---

## Plan 13 — 开发宿主接线

**要做什么：** 内存文件系统提供变化流、注册资源管理器并注入两项外壳回调、地图能力补路径解析，再用两条集成测试证明「三种文件各自打开正确面板」与「两个标签同步」。

| 名称 | 种类 | 文件位置 | 用途 |
|------|------|----------|------|
| `MemoryBackend.watch` | 新增公开方法 | `packages/apps/editor-dev/src/backend/memoryBackend.ts` | 开发宿主的文件变化流；在 `seed` / `writeFile` / `writeBinary` / `deleteFile` / `moveFile` 上向订阅者发事件。 |
| `MemoryBackend.emit` | 新增公开方法 | 同上 | 让测试与手动验收能显式发出一条变化事件，不必真的改文件。 |
| `IFileExplorerCapabilities.listPanelTypes` | 宿主注入实现 | `packages/apps/editor-dev/src/main.tsx` | 转给 `ShellSystem.listPanelTypes`，让资源管理器看到全部已注册面板类型。 |
| `IFileExplorerCapabilities.openPanel` | 宿主注入实现 | 同上 | 先 `ShellSystem.openBlankTab` 再 `ShellSystem.openPanelInTab`；失败时关掉刚开的空白标签。 |
| `IMapEditorCapabilities.resolveMapPath` | 宿主注入实现 | `packages/apps/editor-dev/src/backend/mapFiles.ts` / `demo/mapDemo.ts` | 由 `mapFilePath` 反解出 `mapId`，并校验标识形状（防 `..`）；演示宿主的真实约定是 `content/map/<id>.json`。 |
| `devHostExplorer.test.tsx` | 集成测试（新建） | `packages/apps/editor-dev/src/__tests__/` | 钉死「表格 / 地图 / 素材三种文件各自打开正确面板」与「`.editor` 不出现在列表里」。 |
| `devHostWatch.test.tsx` | 集成测试（新建） | 同上 | 钉死「两个标签打开同一文件，一边保存后另一边自动刷新且不弹框」与「有未保存改动时弹冲突框」。 |

---

## Plan 14 — 地图组件去路径与打开能力

**要做什么：** 让 `MapSurface` / `MapCanvas` 只接收面板预算好的、**以图片路径为键**的地址表与版本号，并让地图面板类型能按完整路径被资源管理器打开。

| 名称 | 种类 | 文件位置 | 用途 |
|------|------|----------|------|
| `IMapSurfaceProps.imageSources` | 既有组件 props 新增成员 | `packages/libs/editor-impl/src/map/components/MapSurface.tsx` | 画布要画的图源表（按图片路径为键）与读取状态；替代原先的 `loadBytes(path)` 与 `path`。 |
| `IMapCanvasProps.imageSources` | 既有组件 props 新增成员 | `packages/libs/editor-impl/src/map/components/MapCanvas.tsx` | 画布交互层透传同一张图源表；`MapCanvas` 不再接触路径。 |
| `MapSurface.collectImagePaths` | 组件内辅助函数 | `packages/libs/editor-impl/src/map/components/MapSurface.tsx` | 从渲染模型里收集本帧需要的图片路径集合（`cell.imagePath`），供面板据此准备地址表。 |
| `MapPanelView.toImageSources` | 视图内辅助函数 | `packages/libs/editor-impl/src/map/components/MapPanelView.tsx` | 把分组键的地址表映射成图片路径键的地址表，交给 `MapSurface` / `MapCanvas`。 |
| `createMapPanelType.canOpen` | 面板类型成员（新增实现） | `packages/libs/editor-impl/src/map/mapPanelType.ts` | 通过 `IMapEditorCapabilities.resolveMapPath` 判断路径归属，不写死 `content/map`。 |
| `createMapPanelType.createOpenParam` | 面板类型成员（新增实现） | 同上 | 把路径转成 `{ target: { mapId } }`；每次返回新对象。 |
| `IMapImageSources` / `IMapTileGroupUrls` 的键空间 | 契约口径（写入本文，Plan 03 已声明） | `packages/libs/editor-impl/src/map/types.ts` | `IMapImageSources` 用**图片路径**作键（画布用），`IMapTileGroupUrls` 用 **`group.id`** 作键（素材区 / 底栏 / 收藏栏用）；两张表**不可混用**。 |

---

## Plan 15 — 地图面板接新契约

**要做什么：** 把图块地址的组装从视图上移到面板，外部变化按三类路径处理，关闭走三态，同时保住 04.1 的保存 / 基线 / 撤销模型。

| 名称 | 种类 | 文件位置 | 用途 |
|------|------|----------|------|
| `MapImageSourceStore` | 有状态类（新建，`implements IMapImageSourceStore`） | `packages/libs/editor-impl/src/map/model/mapImageSources.ts` | 按图片路径创建 / 复用 / 回收 `blob:` 地址，并产出「图片路径键」与「分组标识键」两张只读快照。 |
| `IMapImageSourceStore` | interface（Plan 03 已声明） | `packages/libs/editor-impl/src/map/types.ts` | 地址生命周期契约；本计划只实现。 |
| `IMapImageSourceStore.refresh` | 接口方法（实现） | `packages/libs/editor-impl/src/map/model/mapImageSources.ts` | 用当前文档的分组集合与版本号重建地址表；这是面板侧唯一的重建入口。 |
| `MapPanel.refreshTileImageSources` | 面板方法，`(): void` | `packages/libs/editor-impl/src/map/mapPanel.ts` | 让面板把新的图源快照发布到视图；外部图片变化与「重试」都调它。 |
| `MapPanel.reloadTileImages` | 既有面板方法（改造） | 同上 | 保留原语义（重试计数递增），内部改为调用 `MapPanel.refreshTileImageSources`。 |
| `IMapPanelViewState.tileImageSources` / `.tileImageSourcesVersion` | 视图状态字段（新增） | `packages/libs/editor-impl/src/map/types.ts` | 视图只读消费的图源快照与版本号；视图不再自己算地址。 |
| `IMapPanelViewState.pendingConflict` | 视图状态字段（类型 `IMapPendingConflict`） | 同上 | 「有脏改动 + 外部内容真的变了」时记下的待决冲突。 |
| `IMapPanelViewState.closeDialog` | 视图状态字段（类型 `IMapCloseDialogState`） | 同上 | 地图面板的关闭三态弹窗状态。 |
| `MapPanel.onResourceChange` | 面板方法（新增实现） | `packages/libs/editor-impl/src/map/mapPanel.ts` | 按三类路径分支：地图偏好文件、当前地图文件、图块图片；图片变化走图源刷新。 |
| `MapPanel.onRequestClose` | 面板方法（新增实现） | 同上 | 未打开 / 不脏直接 `Save`；脏则弹三态；保存失败返回 `Cancel`。 |
| `MapPanel.onDiscard` | 面板方法（新增实现，可为空实现） | 同上 | 地图 `dispose` 本来不保存，此方法只用于对齐契约。 |

---

## Plan 16 — 素材组件去路径与打开能力

**要做什么：** 面板把 `mime` / `fontFamily` / 零参字节加载器算好后传给组件，并让素材面板类型能按完整路径被资源管理器打开。

| 名称 | 种类 | 文件位置 | 用途 |
|------|------|----------|------|
| `IAssetPreviewProps.mime` | 既有组件 props 新增成员 | `packages/libs/editor-impl/src/asset/components/AssetPreview.tsx` | 面板算好的真实 MIME，替代组件从 `path` 推断；组件不再接收 `path`。 |
| `IAssetFontSampleProps.fontFamily` | 既有组件 props 新增成员 | `packages/libs/editor-impl/src/asset/components/AssetFontSample.tsx` | 面板生成的稳定字体族名，替代组件用 `path` 哈希；族名不写进 `<style>`。 |
| `TranscodeModal.probeEntry` | 组件 props 新成员 | `packages/libs/editor-impl/src/asset/components/TranscodeModal.tsx` | 面板算好的字节探测入口（读字节 + 算大小），替代组件自己拿 `path` 再 `context.readBinary`。 |
| 素材组件的零参 `loadBytes` | 既有 props 成员改签名 | `AssetDetail.tsx` / `AssetGrid.tsx` / `AssetCardPreview.tsx` / `AssetPreview.tsx` | 从 `loadBytes(path)` 改为零参（或直接收面板预算好的 URL / 展示数据）；组件不再接收任何文件路径。 |
| `AssetCardPreview` 的 `assetMime` | 组件 props 新成员 | `packages/libs/editor-impl/src/asset/components/AssetCardPreview.tsx` | 卡片缩略图需要的 MIME，由面板预算；替代原先从 `entry.path` 推断。 |
| `AssetFileInfo` 的展示数据 | 既有 props 成员改造 | `packages/libs/editor-impl/src/asset/components/AssetFileInfo.tsx` | 文件名 / 大小 / 格式等由面板算好后传入；组件不再接收 `path`。 |
| `createAssetPanelType.canOpen` | 面板类型成员（新增实现） | `packages/libs/editor-impl/src/asset/assetPanelType.ts` | 命中任一分类的 `listPath`、`dir` 下路径、`schemaPath`、`defaultsPath` 时返回真。 |
| `createAssetPanelType.createOpenParam` | 面板类型成员（新增实现） | 同上 | 转成 `{ target: { categoryId, assetName? } }`，`assetName` 由 `resolveAssetName` 推导。 |
| `AssetPanel.saveAll` | 面板方法，`(): Promise<string \| null>` | `packages/libs/editor-impl/src/asset/assetPanel.ts` | 「全部保存成功才算成功」的保存入口；`AssetPanel.save` 继续只做提示，关闭三态用它判断能否关。 |

---

## Plan 17 — 素材面板接新契约

**要做什么：** 外部变化按「分类清单 / 条目字节」两类处理，脏则弹冲突；关闭走三态；自身写入的回声按基线忽略。

| 名称 | 种类 | 文件位置 | 用途 |
|------|------|----------|------|
| `IAssetPanelViewState.pendingConflict` | 视图状态字段（类型 `IAssetPendingConflict`） | `packages/libs/editor-impl/src/asset/types.ts` | 「有脏改动 + 外部内容真的变了」时记下的待决冲突。 |
| `IAssetPanelViewState.closeDialog` | 视图状态字段（类型 `IAssetCloseDialogState`） | 同上 | 素材面板的关闭三态弹窗状态。 |
| `IAssetPendingConflict` / `IAssetCloseDialogState` | interface（Plan 03 已声明） | 同上 | 两个具名状态形状；本计划只引用。 |
| `AssetPanel.onResourceChange` | 面板方法（新增实现） | `packages/libs/editor-impl/src/asset/assetPanel.ts` | 分类清单变化则重读该分类；条目字节变化则 `byteVersion++` 并刷新预览；删除事件只降级为提示。 |
| `AssetPanel.onRequestClose` | 面板方法（新增实现） | 同上 | 任一分类脏才弹三态；「保存并关闭」走 `AssetPanel.saveAll`，失败返回 `Cancel`。 |
| `AssetPanel.onDiscard` | 面板方法（新增实现，可为空实现） | 同上 | 素材 `dispose` 本来不保存，此方法只用于对齐契约。 |
| `baselineText` | 面板内部字段（按分类 / 路径保存） | 同上 | 自己写入的原文基线；外部事件先与它比较，相同即忽略，避免自写回声误判冲突。 |

---

## Plan 19 — 表格工具栏接住面板侧未保存

**要做什么：** 把「面板侧还有未落盘改动」这件事接进表格工具栏的脏状态：撤销、代码编辑器写回、确认剥离注释这类不经组件草稿的改动之后，「未保存」标记会出现、「保存」按钮可点。不改共享的 `IEditableContentProps`，也不改 `TableGrid` / `TableToolbar`。

| 名称 | 种类 | 文件位置 | 用途 |
|------|------|----------|------|
| `ITableEditableProps.unsaved` | interface 新增可选成员，`boolean` | `packages/libs/editor-impl/src/table/types.ts` | 面板侧是否还有未落盘的改动（撤销、代码编辑器写回、确认剥离注释会置真）；组件把它与自己的草稿脏取「或」，供工具栏显示「未保存」并启用「保存」。 |

---

## D-22 组件清单

> 用途：这是 Plan 14 / 16 / 17「去路径」的范围依据——漏一个组件就等于漏一处路径泄漏。三栏表、地图布局、素材三栏的**观感一律不重画**，只改组件边界与「谁持有什么」。

| 组件名 | 文件 | 是否可复用 | 接收什么 | 由谁提供 | 落在哪个计划 |
|--------|------|------------|----------|----------|--------------|
| `TableGrid` | `src/shared/schemaForm/components/TableGrid.tsx` | 可复用（schema 表单也在用） | 行树、状态、编辑回调，另加可选 `saving` | 由 `EditableTable` 提供 | Plan 08 |
| `EditableTable` | `src/table/components/EditableTable.tsx`（新建） | 表格专用 | `content` / `contentVersion` / `ref` / `onSave` / `onDraftChange` | 由 `TablePanel` 提供 | Plan 08 |
| `TablePicker` | `src/table/components/TablePicker.tsx` | 表格专用（内部包 `FileBrowser`） | 预设表 + `loadChildren` / `filter` / `onOpen` / `testIdPrefix='table-list'` | 由 `TableEmptyColumn` 提供 | Plan 07 |
| `TableEmptyColumn` | `src/table/components/TableEmptyColumn.tsx` | 表格专用 | 空栏模式、预设、`loadChildren`、五个空栏回调 | 由 `TablePanel` 提供 | Plan 07 |
| `FileBrowser` | `src/shared/fileBrowser/FileBrowser.tsx`（新建） | 可复用（表格空栏 + 资源管理器） | `directory` / `loadChildren` / `filter` / `onOpen` / `testIdPrefix` / `reloadToken` | 由调用的面板提供 | Plan 06 |
| `MapSurface` | `src/map/components/MapSurface.tsx` | 可复用（地图） | 渲染模型、`imageSources`、`imageVersion` | 由 `MapPanelView` 预算后提供 | Plan 14 |
| `MapCanvas` | `src/map/components/MapCanvas.tsx` | 可复用（地图） | 渲染模型、选区 / 手势回调、`imageSources` | 由 `MapPanelView` 提供 | Plan 14 |
| `MapMaterialPanel` | `src/map/components/MapMaterialPanel.tsx` | 可复用（地图素材区） | 分组列表、当前选中、切换回调 | 由 `MapPanelView` 提供 | Plan 14（登记边界，不改） |
| `MapBottomTabs` | `src/map/components/MapBottomTabs.tsx` | 可复用（地图） | 当前页签、计数、切换回调 | 由 `MapPanelView` 提供 | Plan 14（登记边界，不改） |
| `MapFavoriteBar` | `src/map/components/MapFavoriteBar.tsx` | 可复用（地图） | 收藏槽、图源状态、点击回调 | 由 `MapPanelView` 提供 | Plan 14（登记边界，不改） |
| `MapPropertiesDrawer` | `src/map/components/MapPropertiesDrawer.tsx` | 可复用（地图） | 属性行树、打开状态、保存回调 | 由 `MapPanelView` 提供 | Plan 14（登记边界，不改） |
| `AssetDetail` | `src/asset/components/AssetDetail.tsx` | 可复用（素材详情） | 条目 + 面板算好的展示数据 + 零参 `loadBytes` | 由 `AssetPanelView` 提供 | Plan 16 |
| `AssetGrid` | `src/asset/components/AssetGrid.tsx` | 可复用（素材网格） | 条目列表、零参 `loadBytes`、选中 / 双击回调 | 由 `AssetPanelView` 提供 | Plan 16 |
| `AssetCardPreview` | `src/asset/components/AssetCardPreview.tsx` | 可复用（卡片缩略图） | 条目、`assetMime`、零参 `loadBytes` | 由 `AssetPanelView` 提供 | Plan 16 |
| `AssetFileInfo` | `src/asset/components/AssetFileInfo.tsx` | 可复用（文件信息行） | 面板算好的展示数据（名称 / 大小 / 格式） | 由 `AssetPanelView` 提供 | Plan 16 |
| `AssetPreview` | `src/asset/components/AssetPreview.tsx` | 可复用（按大分类分流预览） | `kind`、`mime`、`byteVersion`、零参 `loadBytes` | 由 `AssetPanelView` 提供 | Plan 16 |
| `AssetFontSample` | `src/asset/components/AssetFontSample.tsx` | 可复用（字体样例） | `fontFamily`、零参 `loadBytes` | 由 `AssetPanelView` 提供 | Plan 16 |
| `AssetConfigView` | `src/asset/components/AssetConfigView.tsx` | 可复用（配置表单） | 行树、`onChange(fieldPath, value)`——**字段路径，不是文件路径** | 由 `AssetPanelView` 提供 | Plan 16（登记边界，不改） |
| `CategoryNav` | `src/asset/components/CategoryNav.tsx` | 可复用（分类导航） | 分类清单、当前分类、切换回调 | 由 `AssetPanelView` 提供 | Plan 16（登记边界，不改） |
| `AssetToolbar` | `src/asset/components/AssetToolbar.tsx` | 可复用（素材工具栏） | 状态、按钮可用性与回调 | 由 `AssetPanelView` 提供 | Plan 16（登记边界，不改） |
| `TranscodeModal` | `src/asset/components/TranscodeModal.tsx` | 可复用（转码弹窗） | `probeEntry`、条目列表、零参 `loadBytes` | 由 `AssetPanelView` 提供 | Plan 16 |

---

## 待用户确认的取舍

> 只剩一项未定。其余口径（过滤 `.json` + `.jsonc` 含 schema、删除态不含 schema、`.editor` 隐藏但索引照常收录、共享弹窗抽到 `shared/panelDialogs`、候选弹窗用面板类型图标、无搜索框、资源管理器恒从项目根开始）已在讨论与研究阶段定稿，不再逐条询问。

| # | 取舍 | 研究推荐值 | 替代方案与代价 |
|---|------|-----------|----------------|
| O1 | 组件草稿到底归谁：三个面板一律「组件持草稿」，还是分层？ | **分层**：表格走字面契约（组件持草稿 + 卸载交回 + 面板保留交回副本用于撤销），地图 / 素材走「面板持权威文档 + 功能块组件只收内容」 | 若要求三者一律「组件持草稿」：必须把地图的 `document` / `dataBaseline` 与素材的 `states` 一并搬进 React，并重做撤销载荷与按域保存；地图刚在 04.1 重做完，回归面显著扩大，建议另立阶段。 |

**O1 的影响面：** 该取舍约束 Plan 08（表格组件持草稿）、Plan 14 / 15（地图面板持文档）、Plan 16 / 17（素材面板持文档）。

---

## 确认状态

**已确认：2026-10-28** —— 用户以文字回复「确认」。

**改名记录：无。** 本阶段没有发生任何改名，下文列出的即为最终名称，全文只有最终名，不存在「原名 → 现名」条目。

**待确认：** Plan 19 新增 1 个成员名（`ITableEditableProps.unsaved`），待用户确认。

### 最终名称 · editor-core（Plan 02 / Plan 02.1）

| 名称 | 最终形态 |
|------|----------|
| `PanelCloseChoice` | `const enum`，成员 `Save` / `Discard` / `Cancel` |
| `IEditorPanel.onRequestClose` | 可选方法，`(): Promise<PanelCloseChoice>` |
| `IEditorPanel.onDiscard` | 可选方法，`(): void` |
| `IEditorPanel.onResourceChange` | 可选方法，`(id: IResourceIdentifier, kind: EditorFileChangeKind): Promise<void>` |
| `EditorFileChangeKind` | `const enum`，成员 `Add` / `Change` / `Delete` |
| `IEditorFileChange` | interface，成员 `readonly path` / `readonly kind` |
| `IEditorFileSystem.watch` | 可选方法，`(listener) => () => void` |
| `IResourceSystemHooks.onResourceChange` | 可选方法，`(identifier, kind): Promise<void>` |
| `IEditorPanelType.canOpen` | 可选方法，`(path: string): boolean` |
| `IEditorPanelType.createOpenParam` | 可选方法，`(path: string): Record<string, unknown>` |
| `IShellSystem.activateTab` | 既有方法，返回类型改为 `Promise<void>`：先 `await` 旧面板 `IEditorPanel.onSwitchOut`，再改活动标签并通知 React（B1；不新增 `onBeforeSwitchOut`）。**由 Plan 02.1 落地，不属于 Plan 02** |

保留不变：`IEditorPanel.onBeforeClose` 仍是布尔语义；`IEditorPanel.onUpdateResource` 仍是必选成员、签名不变。

### 最终名称 · editor-impl（Plan 03…17）

| 名称 | 最终形态 |
|------|----------|
| `IEditableContentHandle` | interface，成员 `getData` / `setData` / `isDirty` / `markSaved`（`shared/editable/types.ts`） |
| `IEditableContentProps` | interface，成员 `content` / `contentVersion` / `ref` / `onSave` / `onDraftChange`（同文件） |
| `ContentSaveStatus` | `const enum`，成员 `Saved` / `Failed`（同文件） |
| `IFileBrowserProps` | interface（`shared/fileBrowser/types.ts`） |
| `IPanelCloseDialogProps` / `IExternalChangeDialogProps` | interface（`shared/panelDialogs/types.ts`） |
| `IFileExplorerCapabilities` | interface，成员 `listPanelTypes` / `openPanel`（`explorer/types.ts`） |
| `IFileExplorerPanel` | interface，成员 `id` / `openPath` / `loadChildren` / `filterPath` / `selectCandidate` / `cancelCandidate`（同文件） |
| `IFileExplorerViewState` / `IFileExplorerViewProps` / `IPanelCandidateModalProps` | interface（同文件） |
| `ITableDocument` | interface，成员 `data` / `schema` / `schemaMode`（`table/types.ts`） |
| `TableEditKind` | `const enum`，成员 `Change` / `Add` / `Delete`（同文件） |
| `ITableEdit` | interface（同文件） |
| `ITableEditableProps` | interface，继承 `IEditableContentProps<ITableDocument>`（同文件） |
| `ITablePendingConflict` / `ITableCloseDialogState` | interface（同文件） |
| `IAssetPendingConflict` / `IAssetCloseDialogState` | interface（`asset/types.ts`） |
| `IMapPendingConflict` / `IMapCloseDialogState` | interface（`map/types.ts`） |
| `IMapEditorCapabilities.resolveMapPath` | 可选方法，`(path: string): string \| null`（同文件） |
| `IMapImageSources` / `IMapImageSourceStore` | interface（同文件） |
| `MapImageBytesLoader` / `IMapTileGroupUrls` | type / interface（同文件，从 `components/useMapObjectUrl.ts` 上移） |
| `FileBrowser` / `FileExplorerPanel` / `FileExplorerView` / `PanelCloseDialog` / `ExternalChangeDialog` / `PanelCandidateModal` / `EditableTable` / `MapImageSourceStore` | 组件 / 类 / 工厂的最终名，落点见各计划小节 |
| `createFileExplorerPanelType` | 工厂函数（`explorer/fileExplorerPanelType.ts`） |
| `isTableOpenablePath` | 自由函数（`table/resourceType.ts`） |
| `TablePanel.applyEdit` / `TablePanel.saveDocument` / `TablePanel.isColumnDirty` / `TablePanel.resetColumnDraft` / `TablePanel.bumpContentVersion` / `TablePanel.loadPickerChildren` / `TablePanel.navigatePicker` | 表格面板方法 |
| `FileExplorerPanel.openPath` / `FileExplorerPanel.loadChildren` / `FileExplorerPanel.filterPath` / `FileExplorerPanel.selectCandidate` / `FileExplorerPanel.cancelCandidate` | 资源管理器面板方法 |
| `MapPanel.refreshTileImageSources` / `MapPanel.onResourceChange` / `MapPanel.onRequestClose` / `MapPanel.onDiscard` | 地图面板方法 |
| `AssetPanel.saveAll` / `AssetPanel.onResourceChange` / `AssetPanel.onRequestClose` / `AssetPanel.onDiscard` | 素材面板方法 |
| `TranscodeModal.probeEntry` | 转码弹窗 props 成员 |

### 最终口径 · 样式与测试标识

| 名称 | 最终形态 |
|------|----------|
| `efb-` | 共用文件浏览器类名前缀，样式表 `file-browser.css` |
| `efx-` | 资源管理器类名前缀，样式表 `explorer.css` |
| `edlg-` | 共享面板弹窗类名前缀，样式表 `panel-dialogs.css` |
| `file-browser` | 浏览器缺省 `data-test-id` 前缀 |
| `table-list` | 表格空栏传入的 `data-test-id` 前缀（保住约 56 处既有断言） |
| `explorer` | 资源管理器传入的 `data-test-id` 前缀 |

### O1 分层取舍（最终口径）

**采纳研究推荐值：分层。**

- **表格**走字面契约：组件持草稿，卸载时把草稿与当时的脏标记交回面板，面板保留交回副本用于撤销与保存。
- **地图 / 素材**由面板持权威文档（含基线与按域保存），功能块组件只接收内容 + 回调，不自己保留第二份草稿。
- 三者都遵守「组件接收内容、发出保存请求」，差别只在「谁持有权威内容」。

**该口径约束 Plan 08（表格组件持草稿）、Plan 14 / 15（地图面板持文档）、Plan 16 / 17（素材面板持文档）。** 替代方案（三者一律组件持草稿）已否决：需要把地图的 `document` / `dataBaseline` 与素材的 `states` 一并搬进 React 并重做撤销载荷，回归面过大。

**`## D-22 组件清单` 的结论同时生效：** 地图侧 `MapSurface` / `MapCanvas` 去路径，素材侧 `AssetDetail` / `AssetGrid` / `AssetCardPreview` / `AssetFileInfo` / `AssetPreview` / `AssetFontSample` / `TranscodeModal` 去路径；`MapMaterialPanel` / `MapBottomTabs` / `MapFavoriteBar` / `MapPropertiesDrawer` / `CategoryNav` / `AssetToolbar` / `AssetConfigView` 本轮只登记边界、不改。
