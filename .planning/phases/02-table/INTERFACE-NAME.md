# Phase 2 — 命名提案（INTERFACE-NAME）

**状态：全部为提案，待用户确认后方可落代码 / 计划 / 配置。**
依据 `AGENTS.md` §Project Rules「重要命名先确认」与 §Code style（方法引用一律写作 `类名.方法名`；类 / 接口 / 枚举不写 jsDoc，`type` 别名要写；接口成员默认 readonly；数值枚举 + 大驼峰成员）。**每个条目说明「它是干什么的」，只给名字不算报告。**

确认方式建议：逐条回复「同意 / 改成 X」。任意条目未确认前，执行阶段不得将其写成代码。

**本文件覆盖的跨 Plan 共同结论（请一并确认）：**
- 本阶段的「schema」= 旧 `components/Table` 的**字段配置/注释对象**（`CommentObject`/`FieldConfig`，带 `_type`/`_range` 等），**不是** JSON Schema（RESEARCH A2；已在 Plan 01 的 checkpoint 确认）。
- 共享弹窗与外部编辑器接缝放 `src/react/`（已是声明 subpath，且被依赖边界规则命名）。
- 表格资源类型号由 `editor-impl` 定义；数据表与 schema 表**共用一个**类型号，靠 `id` 区分（`table.<name>` / `table#schema.<name>`）。
- 被注入的表达式求值器（引擎侧）类型为 `IValueEvaluator`，承载 `_range` 等求值；不落在 core/impl 的执行体内。

---

## Plan 01 — `02-01-PLAN.md`（`editor-core` 两条接缝的**类型**）

### `IEditorPanelContext.updateResource(id)`（接口成员，`packages/libs/editor-core/src/panel/types.ts`）
- **用途**：D-15 通知接缝。让「刚写完某个资源的面板」通知核心「这个资源变了」，核心据此广播，使正在看同一资源的其他面板立即重算 / 重渲染。参数是资源标识符。接口计划里先声明为可选，Plan 04/05 实现时定为必需。

> **以下四个「打开参数」相关条目为「提前通用化」可选项，默认不引入。** `02-CONTEXT` 的 `<deferred>` 明确把「『打开参数』通用化到外壳」推迟；本阶段 **D-06 的默认机制是「注入式打开器 + `ITablePanel.setTable`」**，不改 `IShellSystem`。仅当用户在本阶段**明确选择**「提前通用化」时，才把下面四个名字写进代码（Plan 01 声明类型、Plan 05 实现透传）。请注意区分：这些是提案名，且是**被推迟能力**的提案名。

### `IEditorPanelOpenParam`（type 别名，`panel/types.ts`）— 仅「提前通用化」时引入
- **用途**：D-06「打开参数」的载荷类型（一个通用 `Record<string, unknown>`）。创建面板实例时顺带携带参数（例如「这个新表格面板一开始就编辑 `table#schema.x`」）。

### `IEditorPanelFactoryParam.openParam`（接口成员，`panel/types.ts`）— 仅「提前通用化」时引入
- **用途**：工厂接收到的可选打开参数，让工厂在构造时就知道实例的目标。

### `IShellSystem.openPanelInTab(tabId, typeId, openParam?)`（接口方法扩展，`shell/types.ts`）— 仅「提前通用化」时引入
- **用途**：打开面板时附带可选打开参数；参数透传进工厂。

### `IShellSystem.createPanelInstance(typeId, openParam?)`（接口方法扩展，`shell/types.ts`）— 仅「提前通用化」时引入
- **用途**：同上，直接创建实例时也可携带打开参数。

> 备选：新增 `IShellSystem.openPanelInNewTab(typeId, openParam?)` 便捷方法（一次完成「开空白标签 + 开面板」）。请确认是否需要。同样仅属「提前通用化」路径。

---

## Plan 02 — `02-02-PLAN.md`（`editor-impl/table` 的**类型**）

### `TableFieldKind`（数值 `const enum`，`src/table/types.ts`）
- **用途**：值单元格该用哪种输入控件的「字段种类」。成员：`Textarea` / `Select` / `Checkbox` / `CheckboxSet` / `PopCheckboxSet` / `Event` / `Material` / `Color` / `Point` / `Disable`。

### `TableEditMode`（数值 `const enum`，`types.ts`）
- **用途**：编辑模式。成员：`Change`（编辑）/ `Add`（添加）/ `Delete`（删除）。

### `FieldConfig`（interface，`types.ts`）
- **用途**：**单个字段的 schema 配置**（`_type`/`_leaf`/`_range`/`_select`/`_checkboxSet`/`_docs`/`_data`/`_hide`/`_string`/`_event`/`_directory`/`_transform`/`_onconfirm`/`_lint`/`_template`/`_preview`/`indent`），决定该字段怎么显示、怎么校验、用哪个外部编辑器。

### `CommentObject`（interface，`types.ts`）
- **用途**：**本阶段的「schema」根**——可嵌套的注释对象，描述每个字段的 `FieldConfig`；即 `table#schema.<name>` 的内容。

### `FieldArgs`（interface，`types.ts`）
- **用途**：传给 schema 里「动态配置函数」（如 `_leaf` 写成函数）的参数（字段路径、值、配置等）。

### `SelectConfig`（interface，`types.ts`） / `CheckboxSetConfig`（interface，`types.ts`）
- **用途**：`_select` 的选项集合 / `_checkboxSet` 的键与前缀标签。

### `TableNode`（interface，`types.ts`）
- **用途**：表格里的一行——叶子行（带值 + 配置）或可折叠的 gap 行（带 children）。

### `TableAction`（type 别名，`types.ts`）
- **用途**：一次变更的载荷元组（操作种类、字段路径、值）；**本模块自有的**数字/枚举语义，不再耦合旧 `@/utils/action`。

### `ITablePanel`（interface，`types.ts`）
- **用途**：**在 Phase 1 的 `IEditorPanel` 之外**为表格面板额外暴露的方法集合（D-02）。面板实现它 + `IEditorPanel`。

### `ITablePanel.setTable(target)`（接口方法，`types.ts`）
- **用途**：从外部设置「这个面板实例要编辑的表」。方法最终名 / 形状待确认（UI-SPEC F3）。**不**存在全局「当前表格」。

### `ITablePanelTarget`（interface，`types.ts`）
- **用途**：目标表的两个资源标识——数据 `table.<name>` 与 schema `table#schema.<name>`；schema 目标是「没有 schema 的」

### `TableResourceType`（数值 `const enum`，`src/table/resourceType.ts`）
- **用途**：表格资源的**数字类型号**（`IResourceIdentifier.type`，注释写明「由外部枚举定义」）。数据表与 schema 表共用一个号。

### 资源标识约定（声明性约定，`resourceType.ts`；**不是函数**）
- **用途**：本阶段约定——常规表资源 id = `table.<name>`，其 schema 资源 id = `table#schema.<name>`；数据表与 schema 表**共用一个**资源类型号。**生成 id 的函数体不在 Plan 02 写**（Plan 02 仅声明枚举与约定，Wave 1「仅类型，无实现」）；函数 `tableDataResourceId` / `tableSchemaResourceId` 在 **Plan 04** 实现（见下）。

### `ISchemaPresentationRule` / `IPairedFieldGroup`（interface，`types.ts`）
- **用途**：schema 专用呈现规则（把 `min`/`max` 合成一行两个小 `InputNumber`、标记紧凑标量）。规则**内建 / 可注入**，不由 schema 描述。

---

## Plan 03 — `02-03-PLAN.md`（`editor-impl/react` 的**接缝类型**）

### `ITableEditorCapabilities`（interface，`src/react/capabilities.ts`）
- **用途**：注入给表格的「外部编辑器能力包」；**每个能力都可缺省**，缺省时表格优雅降级而非崩溃。成员除各打开器外，另含可选成员 `valueEvaluator`（引擎侧注入的表达式求值器，见下）。

### `ICodeEditorOpenRequest` / `ICodeEditorOpener`（interface，`src/react/types.ts` / `capabilities.ts`）
- **用途**：打开**代码编辑面板**（独立面板，切走即关，D-11）；请求携带字段标识与当前值。

### `IEventEditorOpenRequest` / `IEventEditorOpener`（interface，`types.ts` / `capabilities.ts`）
- **用途**：打开**事件编辑面板**（D-11）。

### `IMultiSelectItem` / `IMultiSelectOpenRequest` / `IMultiSelectOpener`（interface，`types.ts` / `capabilities.ts`）
- **用途**：**通用多选弹窗**（D-13/D-14）——`popCheckboxSet` 与「素材选择」合并为同一个；素材以缩略图多选呈现。

### `IPointSelectOpenRequest` / `IPointSelectOpener`（interface，`types.ts` / `capabilities.ts`）
- **用途**：**坐标选择弹窗**（D-12）。

### `ITablePanelOpenRequest` / `ITablePanelOpener`（interface，`types.ts` / `capabilities.ts`）
- **用途**：D-06——打开一个「已经设好目标」的表格面板（由组合根实现，面板不直接碰外壳）。

### `ICopyCapability`（interface，`capabilities.ts`）
- **用途**：注入的**剪贴板能力**（`copyText`）——替代被门禁禁止的 `navigator.clipboard`。

### `IValueEvaluator`（interface，`src/react/types.ts`）
- **用途**：引擎侧注入的**表达式求值器**契约（承载 `_range` 等表达式的求值结果）；在能力接缝 `src/react/` 声明，供 `src/table` 的 `checkRange` 以参数类型引用（`src/table` 可以 import `src/react`；反向被 `react-and-shell-must-not-import-capabilities` 禁止，故此类型不能落在 `src/table`）。core/impl 永不自行 `eval` / `new Function`。能力包 `ITableEditorCapabilities` 以可选成员 `valueEvaluator` 承载它。

### `ITableCapabilitiesProviderProps`（interface，`types.ts`）
- **用途**：承载能力包与 `children` 的 React Provider 的 props。

---

## Plan 04 — `02-04-PLAN.md`（tracer + 工程脚手）

### `tableDataResourceId(name)` / `tableSchemaResourceId(name)`（函数，`src/table/resourceType.ts`）
- **用途**：生成 `table.<name>` / `table#schema.<name>` 资源标识（枚举与约定在 Plan 02 声明）；`name` 只是不透明 id 串，不做任何路径拼接。

### `TablePanel`（class，`src/table/tablePanel.ts`）
- **用途**：表格面板实例，`implements IEditorPanel` + `ITablePanel`；持有目标表与已加载内容，经资源层读写，实现 `undo`/`redo`。

### `tablePanelType`（导出常量，`src/table/tablePanelType.ts`）
- **用途**：可经 `ShellSystem.registerPanelType` 注册进外壳的**表格面板类型**（id / name / 内联 SVG 图标 / 同步工厂）。

### `buildTableTree(...)`（函数，`src/table/model/traversal.ts`）
- **用途**：把「数据 + schema」组成行树（注释键定序、叶子/gap 判定），复刻旧表格的可见行为。

### `TableGrid`（组件，`src/table/components/TableGrid.tsx`）
- **用途**：四栏（条目 / 注释 / 值 / 操作）表格；tracer 阶段只读，后续接入输入控件。

### 工程脚手（非对外命名）
- `src/global.d.ts`（`declare module '*.css';`）、`src/__tests__/mapPolyfill.ts`（Map 垫片）、`src/index.ts`（根桶，只 `export *` `./table`）、`vitest.config.ts` 的 `setupFiles`、`package.json` 的 `sideEffects: ["./src/**/*.css"]`。
- parity `data-test-id`（非 API，仅为稳定断言）：`data-table` / `data-table-grid` / `table-row-<field>` / `table-input-<field>` / `table-edit-<field>` / `table-edit-mode`。

---

## Plan 05 — `02-05-PLAN.md`（`editor-core` 两条接缝的**实现**）

### `PanelContext.updateResource`（方法，`packages/libs/editor-core/src/panel/panelContext.ts`）
- **用途**：把面板上下文的「通知资源变更」转发给资源系统现有的 `updateResource`，从而触发对面板钩子的广播（D-15）。无新对外名字。

### `ShellSystem`（内部）
- **用途**：把可选打开参数从 `openPanelInTab` / `createPanelInstance` 透传进 `createInstance` 的工厂调用（D-06）。无新对外名字。

---

## Plan 06 — `02-06-PLAN.md`（校验 + 行内输入控件）

### `validateId`（函数，`src/table/model/validation.ts`）
- **用途**：校验「新字段名」：非空、字符集（字母数字下划线）、不重名；返回带中文错误信息的结果。

### `checkRange`（函数，`validation.ts`）
- **用途**：校验「字段值」是否满足 `_range`（交给注入的 `IValueEvaluator`）或属于 `_select` 选项；删除许可 = `checkRange(config, null)`。

### `IValueEvaluator`（interface，**由 Plan 03 声明于 `src/react/types.ts`**；本 Plan 的 `validation.ts` 以参数类型引用它）
- **用途**：引擎侧注入的**表达式求值器**；core/impl 永不自行 `eval` / `new Function`。**所有权归 Plan 03**（它不能在 `src/table` 声明，否则 `src/react` 的能力包携带它时会触发 `react-and-shell-must-not-import-capabilities`）；本条目只说明 Plan 06 引用它。

### `TextareaInput` / `SelectInput` / `CheckboxInput` / `CheckboxSet` / `ColorInput`（组件，`src/table/components/inputs/*.tsx`）
- **用途**：五种行内输入控件；按 `TableFieldKind` 映射（文本域 / 下拉 / 复选框 / 多选框 / 颜色）。

---

## Plan 07 — `02-07-PLAN.md`（编辑模式 + 增删 + 撤销）

### `TableUndoType`（数值 `const enum`，`src/table/tablePanel.ts`）
- **用途**：表格撤销操作的**数字类型号**（放进 `IUndoContext.type`），区分改值 / 添加 / 删除。

### `TableRow`（组件，`src/table/components/TableRow.tsx`）
- **用途**：叶子行——按字段种类选控件、提交前校验、双击（500ms 两次点击）按模式分发。

### `GapRow`（组件，`src/table/components/GapRow.tsx`）
- **用途**：可折叠 gap 行（`---- | ---- | ['field'] | [折叠/展开]`）。

### `EditModeSegmented`（组件，`src/table/components/EditModeSegmented.tsx`）
- **用途**：编辑 / 添加 / 删除 的 antd `Segmented` 控件。

### `parseFieldPath` / `getParentFieldPath` / `setByFieldPath` / `deleteByFieldPath` / `getShortField`（函数，`src/table/model/fieldPath.ts`）
- **用途**：字段路径的解析 / 取父路径 / 按路径改值 / 按路径删值 / 取短字段名。

---

## Plan 08 — `02-08-PLAN.md`（D-15 + D-06 + schema 呈现）

### `buildSchemaPresentation(...)`（函数，`src/table/model/schemaPresentation.ts`）
- **用途**：按内建规则集把 schema 字段排成行布局（`min`/`max` 合成一行、紧凑标量）。

### `SchemaBanner`（组件，`src/table/components/SchemaBanner.tsx`）
- **用途**：schema 模式下表格上方的一行 muted 提示（「正在编辑表格结构（Schema）」）。

### `TableToolbar`（组件，`src/table/components/TableToolbar.tsx`）
- **用途**：工具栏——编辑模式控件 + 「编辑 Schema」主按钮 + 可选 muted 资源名标题。

---

## Plan 09 — `02-09-PLAN.md`（外部编辑器 + 通用弹窗）

### `MultiSelectModal`（组件，`src/react/components/MultiSelectModal.tsx`）
- **用途**：通用多选弹窗（素材缩略图多选 + `popCheckboxSet` 共用，D-14）。

### `PointPickerModal`（组件，`src/react/components/PointPickerModal.tsx`）
- **用途**：坐标选择弹窗（D-12）。

### `CapabilityProvider`（组件，`src/react/components/CapabilityProvider.tsx`）
- **用途**：把能力包经 React Context 提供给表格，并挂载弹窗 holder。

### `ActionButtons`（组件，`src/table/components/ActionButtons.tsx`）
- **用途**：操作列按钮（注释 / 编辑 / 多选框编辑 / 复制）与外部编辑器分发。

---

## Plan 10 — `02-10-PLAN.md`（验证）

无新对外命名（仅集成测试与 `02-VALIDATION.md` 记账）。

---

## 待确认的规划假设

- A2：本阶段「schema」= 旧 `CommentObject`（已在 Plan 01 checkpoint 确认）。
- A3：schema 呈现规则集（`min`/`max` 成对行）为内建规则；请在 Plan 01 checkpoint 确认。
- A4：资源类型号由 `editor-impl` 定义、数据/schema 共用一个号。
- A8：共享弹窗与外部编辑器接缝落在 `src/react/`。
- A9：D-15 通知接缝用「面板上下文新增通知方法」（核心改动；锁定决策 D-15，非 deferred）。D-06 **默认**用「注入式打开器 + `ITablePanel.setTable`」，**不改 `IShellSystem`**（尊重 `02-CONTEXT` 的 `<deferred>`：「『打开参数』通用化到外壳」本阶段推迟）；仅当用户明确选择「提前通用化」时才追加「打开参数 + 核心透传」。若用户选择不动 core（`impl-fallback`），则两个接缝都改走各自的 impl 侧降级方案。
