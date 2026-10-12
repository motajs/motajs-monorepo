# Phase 2: 表格编辑 - Pattern Map

**Mapped:** 2026-10-12
**Files analyzed:** 20（名称/路径均为 RESEARCH 的**未确认提案**，须先经 `INTERFACE-NAME.md` 逐 Plan 确认）
**Analogs found:** 20 / 20（其中 3 项为「仅类型/接缝/脚手」按角色类比；旧表格一律作**行为/画面参照**，不是模板）

> **读法（重要）**：本文件给的是**本仓库的写法范式**（接口 + `implements`、jsDoc 规则、桶导出、`useSyncExternalStore`/`@tanstack/react-store`、测试结构），不是要照抄的实现。用户原话：「旧代码仅做参考，不代表新的代码也要这么写」。
>
> **旧表格是 parity 参照，不是模板（Pitfall 9）**：`packages/apps/editor/src/components/Table/**` 里充满了新架构**禁止或不需要**的写法——`import type`、`@motajs/react-store` 的 `createStore`、`navigator.clipboard`、`data-cobj` 塞 JSON、`TableMetaEvaluator` 的 `new Function`/`eval`、百分比列宽 `.etable`。照抄会把违规一起抄进来。只抄「用户可见行为」（树构建语义、输入映射、校验、双击/编辑模式语义、文案），实现全部按本阶段规则重写。下表凡涉及旧表格处，均标 **TRAP**。
>
> **命名门禁**：下表所有文件名 / 接口名 / 类名 / 方法名 / 资源类型号全是**未确认提案**。按 AGENTS.md「重要命名先确认」，落代码前必须先写 `.planning/phases/02-table/INTERFACE-NAME.md`（一 Plan 一节、说明每个名字是干什么的）并经用户确认。方法引用一律写作 `类名.方法名`。

---

## File Classification

| 新/改文件（提案路径，未确认） | Role | Data Flow | Closest Analog | Match Quality |
|-------------------------------|------|-----------|----------------|---------------|
| `packages/libs/editor-impl/src/table/types.ts`（新增） | types（数据模型） | transform（树） | 旧 `components/Table/types.ts`（行为参照，**TRAP**）+ `editor-core/src/resource/types.ts`（接口族写法） | role-match |
| `packages/libs/editor-impl/src/table/resourceType.ts`（新增） | config（数字枚举） | n/a | `editor-core/src/shell/shellSystem.ts:15-22`（`const enum` + 大驼峰）+ `resource/types.ts:3-8`（`type: number`） | role-match |
| `packages/libs/editor-impl/src/table/tablePanel.ts`（新增） | panel/service（有状态） | request-response + event-driven | `editor-core/src/panel/panelContext.ts` + `src/resource/resource.ts` + `src/shell/__tests__/shellSystem.test.ts:59-137`（`FakePanel implements IEditorPanel` 全集） | role-match |
| `packages/libs/editor-impl/src/table/tablePanelType.ts`（新增） | config/factory | request-response | `editor-core/src/panel/types.ts:94-118`（`IEditorPanelType` / `EditorPanelFactory`） | role-match |
| `packages/libs/editor-impl/src/table/components/TableGrid.tsx`（新增） | component | request-response | 旧 `components/Table.tsx`（parity，**TRAP**）+ `editor-core/src/shell/shellSystem.ts`（模块层 FC 约定） | role-match |
| `packages/libs/editor-impl/src/table/components/TableRow.tsx`（新增） | component | request-response | 旧 `components/TableRow.tsx`（parity，**TRAP**） | role-match |
| `packages/libs/editor-impl/src/table/components/GapRow.tsx`（新增） | component | event-driven（折叠） | 旧 `components/GapRow.tsx`（parity，**TRAP**） | role-match |
| `packages/libs/editor-impl/src/table/components/ActionButtons.tsx`（新增） | component | event-driven（点击分发） | 旧 `components/ActionButtons.tsx`（parity） | role-match |
| `packages/libs/editor-impl/src/table/components/EditModeSegmented.tsx`（新增） | component | request-response | 旧 `components/EditModeSegmented.tsx`（parity；antd `Segmented`） | role-match |
| `packages/libs/editor-impl/src/table/components/inputs/*.tsx`（新增一组） | component | transform | 旧 `components/inputs/{TextareaInput,ColorInput,SelectInput,CheckboxInput,CheckboxSet}.tsx`（parity，**TRAP**） | role-match |
| `packages/libs/editor-impl/src/table/model/traversal.ts`（新增） | utility | transform（树构建） | 旧 `utils/traversal.ts:143-257`（parity，**TRAP**：引 `TableMetaEvaluator`） | role-match |
| `packages/libs/editor-impl/src/table/model/validation.ts`（新增） | utility | transform（校验） | 旧 `utils/validation.ts:32-143`（parity，**TRAP**：`evaluateTableMetaExpression`） | role-match |
| `packages/libs/editor-impl/src/table/model/schemaPresentation.ts`（新增） | utility | transform（布局规则） | 旧 `components/SchemaTable/types.ts:40-49` `CombineInputDescriptor`（F2 规则来源）+ `SchemaTable.tsx:1224-1231`（成对 number 行） | partial |
| `packages/libs/editor-impl/src/table/table.css`（新增） | config（样式） | n/a | `editor-core/src/shell/shell.css`（kebab 就近、`--editor-*` 字面量兜底） | exact |
| `packages/libs/editor-impl/src/react/*.tsx`（新增：通用多选/坐标弹窗 + 外部编辑器接缝） | component + types（seam） | request-response（Promise 弹窗）/ event-driven | 旧 `Workbench/modals/CheckboxSet/useCheckboxSetModal.tsx` + `shared/ModalShell.tsx` + `components/Table/externalEditor.ts`（接缝形状参照，**TRAP**：`eval`） | role-match |
| `packages/libs/editor-impl/src/react/capabilities.ts`（新增） | types（注入接缝） | event-driven | `components/Table/externalEditor.ts:14-20`（capability 包）+ `editor-core/src/types.ts:5`（多重 extends 注入）+ `resource/types.ts:68-100`（注入接口族写法） | role-match |
| `packages/libs/editor-impl/src/index.ts`（改） | barrel（包根） | n/a | `editor-core/src/index.ts` | exact |
| `packages/libs/editor-impl/src/global.d.ts`（新增） | config（环境声明） | n/a | `editor-core/src/global.d.ts` | exact |
| `packages/libs/editor-impl/vitest.config.ts`（改） | config（测试配置） | n/a | `editor-core/vitest.config.ts:20-24`（`setupFiles`）+ `src/__tests__/mapPolyfill.ts` | exact |
| `packages/libs/editor-impl/src/table/**/__tests__/*.test.{ts,tsx}`（新增一组） | test | component / event-driven | `editor-core/src/shell/__tests__/shellSystem.test.ts`（夹具 + RTL）+ 旧 `inputs/__tests__/SelectInput.test.tsx`（RTL 控件断言） | role-match |
| `packages/libs/editor-impl/package.json`（改） | config（清单） | n/a | `editor-core/package.json:6-8`（`sideEffects: ["./src/**/*.css"]`） | exact |

> **可能追加到 `editor-core` 的契约改动（D-15 / D-06，见下）**：`editor-core/src/panel/types.ts`（`IEditorPanelContext` 增通知方法）与/或 `IEditorPanelFactoryParam`（可选「打开参数」）。这两项是**跨包契约扩展**，是否本阶段动 core 由 Open Q1/Q2 决定；类比见下。

---

## Pattern Assignments

### 接口定义组（先接口、后实现——本阶段第一批计划）

---

### `src/table/types.ts`（types，新增）

**Analog:** 旧 `packages/apps/editor/src/components/Table/types.ts`（行为/数据模型参照）**+** `packages/libs/editor-core/src/resource/types.ts`（本仓库接口族 jsDoc 范式）

**接口族 jsDoc 范式**——接口本身**不写** jsDoc；**成员逐条写单行 `/** */`**；类型别名**要写** jsDoc：

```typescript
// Source: packages/libs/editor-core/src/resource/types.ts:3-24
export interface IResourceIdentifier {
  /** 资源类型，由外部的枚举真正进行定义 */
  readonly type: number;
  /** 资源的标识符 */
  readonly id: string;
}

export interface IResource<T> {
  /** 资源标识符 */
  readonly identifier: IResourceIdentifier;

  /**
   * 请求资源内容
   */
  request(): Promise<T | undefined>;

  /**
   * 写入资源内容
   * @param data 要写入的资源内容
   */
  write(data: T): Promise<void>;
}
```

**数据模型（parity 参照，**重写**，注意 TRAP）**：`FieldType` / `FieldConfig` / `CommentObject` / `TableNode` / `EditMode` / `TableAction` 的**语义**照旧，但新代码必须去掉 `import type`、去掉 `ActionType`（旧 `@/utils/action`）耦合（用本模块自有的数字枚举），并把「可折叠 object」「`_leaf` 判叶」等语义完整保留。

```typescript
// Source: packages/apps/editor/src/components/Table/types.ts:9-20（parity：值控件映射的取值域，TRAP: import type）
export type FieldType =
  | 'textarea' | 'select' | 'checkbox' | 'checkboxSet' | 'popCheckboxSet'
  | 'event' | 'material' | 'color' | 'point' | 'disable';
```

```typescript
// Source: packages/apps/editor/src/components/Table/types.ts:49-84（parity：每个字段的 schema 配置节选）
export interface FieldConfig {
  /** 是否为叶节点（渲染为可编辑行） */
  _leaf?: boolean | ((args: FieldArgs) => boolean);
  /** 决定值单元格控件的字段类型 */
  _type?: FieldType;
  /** 完整注释 */
  _data?: string;
  /** 短注释（按钮工具提示） */
  _docs?: string;
  /** 是否隐藏该字段 */
  _hide?: boolean | ((args: FieldArgs) => boolean);
  /** 校验表达式（变量名 thiseval，经注入求值器执行） */
  _range?: string;
  /** 是否字符串类型 */
  _string?: boolean | ((args: FieldArgs) => boolean);
  /** 下拉选项配置 */
  _select?: SelectConfig;
  /** 多选框配置 */
  _checkboxSet?: CheckboxSetConfig | (() => CheckboxSetConfig);
  /** 事件类型标识（交给事件编辑器） */
  _event?: string;
  /** 素材目录（交给素材选择器） */
  _directory?: string;
  /** 素材值变换表达式（经注入求值器） */
  _transform?: string;
  /** 确认回调表达式（经注入求值器） */
  _onconfirm?: string;
  /** 是否开启代码 lint */
  _lint?: boolean;
  /** 文本域模板串 */
  _template?: string;
  /** 是否显示预览 */
  _preview?: boolean;
  /** JSON 缩进层数 */
  indent?: number;
}
```

> **门禁约束**：`import type` 禁用（`coreImportType.js` 扫 editor-impl 全树含测试）——`FieldType`、`TableAction`、`EditMode` 用普通 `export type`；`FieldArgs`/`FieldConfig`/`CommentObject` 用普通 `export interface`。引擎术语（`tower`/`floor`/`loc`/`commonEvent`/`prefab`/`mota`…）**注释也算**（`coreEngineNeutral.js`），注释里不能说「全塔属性」「楼层」的英文词。

---

### 资源标识与类型号 `src/table/resourceType.ts`（config，新增）

**Analog:** `editor-core/src/shell/shellSystem.ts:15-22`（`const enum` + 大驼峰成员格式）**+** `resource/types.ts:3-8`（`type: number`）

```typescript
// Source: packages/libs/editor-core/src/shell/shellSystem.ts:15-22（数字枚举写法范式）
/** 面板实例的初始化状态 */
const enum ShellInstanceStatus {
  /** 工厂已创建、IEditorPanel.initialize 尚未完成 */
  Loading,
  /** 初始化完成，可正常渲染 */
  Ready,
  /** 创建或初始化失败，标签内呈现错误态 */
  Error,
}
```

**关键（Pitfall 6 / Open Q8）**：`IResourceIdentifier` 是 `{ type: number; id: string }`；D-04 的 `table.<name>` / `table#schema.<name>` 必须放进 **`id`**，`type` 是本阶段定义的数字。`requestResource` 用 `item.type===id.type && item.id===id.id` 匹配，type 错则恒 `null`。是否「数据表 / schema 表两个 type」由 INTERFACE-NAME 定；若需跨包导出，用普通 `enum`（仿 `packages/libs/h5animate/lib/errors.ts:14`）而非 `const enum`（`isolatedModules` 边界）。

---

### 外部编辑器 / 通用弹窗注入接缝 `src/react/capabilities.ts`（types/seam，新增）

**Analog:** 旧 `components/Table/externalEditor.ts:14-20`（capability 包形状）**+** `editor-core/src/types.ts:5`（多重 extends 组合注入）**+** `resource/types.ts:68-100`（方法族注入接口写法）

旧代码用「capability 包」把各外部编辑器塞进一个对象——**形状可参照**，但**具体能力必须新定义**，且旧 `externalEditor.ts` 里的 `new Function`/`eval` 求值（lines 98-106）属**引擎侧**，**不得**搬进 impl：

```typescript
// Source: packages/apps/editor/src/components/Table/externalEditor.ts:14-20（接缝形状参照）
export interface ExternalEditorCapabilities {
  codeEditor?: CodeEditorCapability;
  eventEditor?: EventEditorCapability;
  selectPoint?: SelectPointOpen;
  selectMaterial?: SelectMaterialOpen;
  checkboxSet?: CheckboxSetOpen;
}
```

**注入接口的写法范式**（Promise 方法族，成员逐条 jsDoc）：

```typescript
// Source: packages/libs/editor-core/src/resource/types.ts:68-100（节选）
export interface IResourceInjection {
  /**
   * 请求指定资源的资源内容
   * @param id 资源标识符
   */
  requestResource<T>(id: IResourceIdentifier): Promise<T>;
  // …（writeResource / createResource / deleteResource 同形）
}
```

**要求**：接缝定义在**非能力目录**（`src/react/` 或 `src/shared/`），能力目录之间不得互相 import（`.dependencyCruiser.cjs` `capabilities-must-not-import-each-other`），`src/react/` 也不得 import `src/table/`。缺省（未注入）时**优雅降级**（禁用「编辑」+ 提示），不崩溃。本阶段代码/事件外部编辑器尚未实现（Open Q3），用 fake/占位写测试。

---

### `ITablePanel` 额外方法接缝（D-02，types，新增）

**Analog:** `editor-core/src/panel/types.ts:39-92`（`IEditorPanel` 全集，方法 jsDoc 写在接口源头）

面板实例要 `implements IEditorPanel + ITablePanel`。`ITablePanel` 的额外方法（示例名 `setTable`）**不在** `IEditorPanel` 上：

```typescript
// Source: packages/libs/editor-core/src/panel/types.ts:39-56（节选：接口方法 jsDoc 范式）
export interface IEditorPanel extends IUndoable {
  /** 编辑器功能的标识符 */
  readonly id: string;

  /**
   * 初始化此编辑器面板
   */
  initialize(): Promise<void>;
  // … dispose / render / onFocus / onBlur / onSwitchIn / onSwitchOut
  //    onUpdateResource / onUpdateResourceList / undo / redo
}
```

**要求**：方法 JSDoc 写在**接口的源头处**（多行块、逐参数 `@param`），实现类**不重复**。方法引用写作 `TablePanel.setTable`（类名.方法名）。方法的最终名字/形状经 INTERFACE-NAME 确认（F3）。

---

### D-15 通知接缝（Open Q1，可能改 `editor-core/src/panel/types.ts`）

**Analog:** `IEditorPanelContext`（`editor-core/src/panel/types.ts:5-37`，当前只有 5 个方法）**+** `ResourceSystem.updateResource`（`resource/resourceSystem.ts:116-127`）**+** `ShellPanelHooks.onUpdateResource`（`shell/shellSystem.ts:643-668`）

**关键事实**：`Resource.write` **不广播**（只写缓存，`resourceSystem.ts:78-88`）；广播要 `ResourceSystem.updateResource(id)`；而 `IEditorPanelContext` **没有**通知方法。**面板已有的 `IEditorPanel.onUpdateResource` 才是天然接收端**——`ShellPanelHooks` 已把资源系统的 `onUpdateResource` 转发给它：

```typescript
// Source: packages/libs/editor-core/src/shell/shellSystem.ts:643-668
export class ShellPanelHooks implements IResourceSystemHooks {
  async onUpdateResource(id: IResourceIdentifier): Promise<void> {
    const resource = await this.context.requestResource(id);
    if (!resource) return;
    const data = await resource.request();
    if (data === undefined) return;
    await this.panel.onUpdateResource(id, data);
  }
  // …
}
```

因此 D-15 的实现有两条候选路径（**必须由规划阶段定死一条**）：(a) 给 `IEditorPanelContext` 加「通知资源变更」（内部转发 `ResourceSystem.updateResource`）；(b) 由 impl 侧资源后端/共享订阅表在写后触发。**推荐 (a)**：契约自然、对后续能力通用。已存在接收端 `IEditorPanel.onUpdateResource`，D-15 的表格面板只需在其中重算列布局。

```typescript
// Source: packages/libs/editor-core/src/panel/types.ts:5-37（现有 5 方法；扩展示例）
export interface IEditorPanelContext {
  /**
   * 请求指定资源
   * @param id 资源标识符
   */
  requestResource<T>(id: IResourceIdentifier): Promise<IResource<T> | null>;
  requestResourceList(type: number): Promise<readonly IResourceIdentifier[]>;
  createResource<T>(id: IResourceIdentifier, content: T): Promise<IResource<T> | null>;
  deleteResource(id: IResourceIdentifier): Promise<void>;
  /**
   * 添加某个面板的撤回操作
   * @param panel 添加撤回操作的面板
   * @param context 撤回操作上下文
   */
  addUndoContext(panel: IEditorPanel, context: IUndoContext<unknown>): void;
  // 【提案】onUpdateResource?(id) / notifyResourceChanged?(id) —— 命名待确认
}
```

---

### D-06 打开参数接缝（Open Q2，可能改 `editor-core/src/panel/types.ts`）

**Analog:** `IEditorPanelFactoryParam` / `EditorPanelFactory`（`panel/types.ts:94-104`）**+** `ShellSystem` 的实例创建点（`shell/shellSystem.ts:562-588` `createInstance`、`476-497` `openPanelInTab`）

「编辑 Schema」要新开一个面板实例并让它编辑 `table#schema.x`，但当前工厂参数只有 `{ context, instanceId }`、`openPanelInTab` 无法放入预建实例。候选：(a) 给工厂参数补可选「打开参数」（透传到 `TablePanel.setTable`）；(b) 给面板注入「打开表格面板并设目标」的回调（组合根实现）。**必须在 INTERFACE-NAME 里确认命名/形状**。

```typescript
// Source: packages/libs/editor-core/src/panel/types.ts:94-104（当前形状；D-06 在此扩展）
/** 面板实例工厂的入参对象：打包面板上下文与 core 生成的实例 id */
export interface IEditorPanelFactoryParam {
  /** 面板侧上下文，提供资源读写与撤销能力 */
  readonly context: IEditorPanelContext;
  /** core 生成的唯一实例 id，用于区分同类型的多个实例 */
  readonly instanceId: string;
}
/** 面板实例工厂：接收入参对象并同步返回一个面板实例（无 Promise） */
export type EditorPanelFactory = (param: IEditorPanelFactoryParam) => IEditorPanel;
```

```typescript
// Source: packages/libs/editor-core/src/shell/shellSystem.ts:562-588（工厂调用点；「打开参数」要在此透传）
private createInstance(typeId: string): ICreatedPanel | null {
  const type = this.panelTypes.get(typeId);
  if (type === undefined) { logger.error('shell.panelTypeNotRegistered', typeId); return null; }
  this.instanceCounter += 1;
  const instanceId = `instance-${this.instanceCounter}`;
  const context = new PanelContext(this.resourceSystem, this.undoSystem);
  let instance: IEditorPanel;
  try {
    instance = type.create({ context, instanceId });
  } catch { logger.error('shell.instanceCreateFailed', typeId); return null; }
  // …
}
```

---

### 实现组（接口确认后的第二批计划）

---

### `src/table/tablePanel.ts`（panel/service，新增）

**Analog:** `editor-core/src/panel/panelContext.ts`（转发范式）**+** `resource/resource.ts`（`IResource` 实现）**+** `shell/__tests__/shellSystem.test.ts:59-137`（`FakePanel implements IEditorPanel` 全集，作为契约清单）

**资源读写（「拉」模式）**——`context.requestResource<T>(id)` 返回 `IResource<T> | null`，再 `resource.request()` / `resource.write()`：

```typescript
// Source: packages/libs/editor-core/src/resource/resource.ts:3-21
export class Resource<T> implements IResource<T> {
  readonly identifier: IResourceIdentifier;
  private readonly store: IResourceStore;
  constructor(identifier: IResourceIdentifier, store: IResourceStore) {
    this.identifier = identifier;
    this.store = store;
  }
  request(): Promise<T | undefined> { return this.store.readContent<T>(this.identifier); }
  write(data: T): Promise<void> { return this.store.writeContent(this.identifier, data); }
}
```

**编辑 → 撤销（D-09）**——面板自身是 `IUndoable`；每次编辑把「如何撤销/重做」装进 `IUndoContext`，交给 `context.addUndoContext(this, ctx)`（`PanelContext.addUndoContext` 直接转发给 `UndoSystem`）：

```typescript
// Source: packages/libs/editor-core/src/undo/types.ts:1-20
export interface IUndoContext<T> {
  /** 撤回操作类型 */
  readonly type: number;
  /** 撤回操作包含的数据 */
  readonly data: T;
}
export interface IUndoable {
  /**
   * 执行撤回操作
   * @param context 撤回操作上下文
   */
  undo<T>(context: IUndoContext<T>): Promise<void>;
  /**
   * 执行重做操作
   * @param context 重做操作上下文
   */
  redo<T>(context: IUndoContext<T>): Promise<void>;
}
```

```typescript
// Source: packages/libs/editor-core/src/panel/panelContext.ts:32-34
addUndoContext(panel: IEditorPanel, context: IUndoContext<unknown>): void {
  this.undoSystem.addUndoContext(panel, context);
}
```

**误入陷阱**：旧撤销是 `tableCommands` + `operationHistory` 的「捕获式」历史（不同 API 形状），**不要**照搬；新代码只用 `IUndoContext{type:number,data}` + `context.addUndoContext`。撤销类型号用数字枚举（仿 `ShellInstanceStatus`）。

---

### `src/table/tablePanelType.ts`（config/factory，新增）

**Analog:** `editor-core/src/panel/types.ts:106-118`

```typescript
// Source: packages/libs/editor-core/src/panel/types.ts:106-118
export interface IEditorPanelType {
  /** 面板类型的唯一标识符 */
  readonly id: string;
  /** 面板类型的显示名称 */
  readonly name: string;
  /** 外部提供的可渲染图标，core 不解析图标名 */
  readonly icon: ReactNode;
  /** 创建此类型面板实例的工厂 */
  readonly create: EditorPanelFactory;
}
```

**要求**：`icon` 是自包含 inline SVG `ReactNode`（UI-SPEC F1，不引图标库）；`create` 同步返回实例（无 Promise）；包对外导出 `{ panelType, Table }` 两样（D-01）。

---

### `src/table/components/*`（component，新增）

**Analog（parity，全部 `**TRAP**`）:** 旧 `components/Table.tsx` / `TableRow.tsx` / `GapRow.tsx` / `ActionButtons.tsx` / `EditModeSegmented.tsx`；**组件写法**参照 `editor-core/src/shell/shellSystem.ts` 的模块层函数组件（`function Xxx(props): ReactElement {...}`，保证 hooks 规则可识别）。

**值单元格控件映射（parity，逐字对齐）**：

```typescript
// Source: packages/apps/editor/src/components/Table/components/TableRow.tsx:25-57（parity，TRAP: import type）
switch (type) {
  case 'select':    return <SelectInput .../>;
  case 'checkbox':  return <CheckboxInput .../>;
  case 'checkboxSet': { /* 支持函数形式 _checkboxSet */ return <CheckboxSet .../>; }
  case 'color':     return <ColorInput .../>;
  case 'disable':   return <TextareaInput disabled readonly .../>;
  default:          return <TextareaInput .../>;   // textarea/event/material/point/popCheckboxSet
}
```

**提交前统一校验（parity）**：

```typescript
// Source: packages/apps/editor/src/components/Table/components/TableRow.tsx:128-138
const handleValueChange = (newValue: unknown) => {
  if (!checkRange(config, newValue)) {
    notifyError(field + ' : 输入的值不合要求,请鼠标放置在注释上查看说明');
    return; // 不触发 onChange
  }
  onValueChange(field, newValue);
};
```

**双击语义（parity，500ms 两次点击兼容触屏）**：

```typescript
// Source: packages/apps/editor/src/components/Table/components/TableRow.tsx:178-202
const handleDoubleClick = () => {
  if (editMode === 'change') handleOpenExternalEditor();
  else if (editMode === 'add') {
    const parentPath = getParentFieldPath(field);
    const name = prompt('请输入新项的名称');
    if (name) onAddItem(parentPath, name);
  } else if (editMode === 'delete') {
    if (!checkRange(config, null)) { notifyError(field + ' : 该值不允许为null，无法删除'); return; }
    if (confirm('确定要删除吗？')) onDeleteItem(field);
  }
};
```

**操作列显隐（parity）**：

```typescript
// Source: packages/apps/editor/src/components/Table/components/ActionButtons.tsx:12-22
const shouldShowEditButton = (type?: FieldType): boolean => {
  if (!type) return true;
  return type !== 'select' && type !== 'checkbox' && type !== 'checkboxSet' && type !== 'color' && type !== 'disable';
};
const getEditButtonText = (type?: FieldType): string => (type === 'popCheckboxSet' ? '多选框编辑' : '编辑');
```

**折叠行（parity）**：

```typescript
// Source: packages/apps/editor/src/components/Table/components/GapRow.tsx:41-57
<tr data-gap={dataGap} data-field={dataField}>
  <td>----</td><td>----</td><td>['{shortField}']</td>
  <td><button className="editorTableFoldBtn" data-fold={isFolded ? 'true' : 'false'} onClick={toggleFold}>
    {isFolded ? '展开' : '折叠'}
  </button></td>
</tr>
{!isFolded && children}
```

**`EditModeSegmented` 范式**（antd `Segmented`，可直接照写形状，**去掉 `import type`**）：

```typescript
// Source: packages/apps/editor/src/components/Table/components/EditModeSegmented.tsx:22-39
const MODE_OPTIONS = [
  { label: '编辑', value: 'change' as const },
  { label: '添加', value: 'add' as const },
  { label: '删除', value: 'delete' as const },
];
// …
<Segmented size={size} data-test-id={testId} value={value} onChange={(v) => onChange(v as EditMode)} options={MODE_OPTIONS} />
```

> **TRAP 清单（组件层）**：旧 `TableRow.tsx:205-220` 的 `navigator.clipboard.writeText` 被 `eslint.config.js:100-141`（`packages/libs/{editor-core,editor-impl}/**`，error 级）禁止 → 剪贴板经**注入**（`copyText` 回调/port）。旧 `data-cobj={cobjStr}` + `htmlEscape` 不需要（React 默认转义，UI-SPEC「内容安全」）。`prompt`/`confirm` 是浏览器全局（非门禁禁词），但 jsdom **默认不实现**——测试需 stub，或改为注入的宿主能力；`window` 已豁免门禁，但不要用 `document`。`import type` 全删。所有 cell 文本走 React 渲染，**禁** `dangerouslySetInnerHTML`。`data-test-id` 保留 parity：`data-table`、`data-table-grid`、`table-row-<field>`、`table-input-<field>`、`table-edit-<field>`、`table-edit-mode`。

---

### `src/table/components/inputs/*.tsx`（component，新增一组）

**Analog（parity，`**TRAP**`）:** 旧 `components/inputs/{TextareaInput,SelectInput,CheckboxInput,CheckboxSet,ColorInput}.tsx`；antd 用法**逐字参照**，`import type` 全部改普通 `import`。

**JSON 文本域：失焦解析，失败回退**（parity）：

```typescript
// Source: packages/apps/editor/src/components/Table/components/inputs/TextareaInput.tsx:26-35
const handleBlur = () => {
  try {
    const parsedValue = JSON.parse(displayValue);
    onChange(parsedValue);
  } catch {
    setDisplayValue(JSON.stringify(value, null, indent)); // 解析失败恢复原始值
  }
};
```

**颜色：`[r,g,b(,a)]` ↔ antd `ColorPicker`，仅在源有 4 通道时保留 alpha**（parity）：

```typescript
// Source: packages/apps/editor/src/components/Table/components/inputs/ColorInput.tsx:33-51
const rgb = color.toRgb();
const hasAlpha = Array.isArray(value) && (value as number[]).length === 4;
if (hasAlpha || rgb.a !== 1) onChange([rgb.r, rgb.g, rgb.b, rgb.a]);
else onChange([rgb.r, rgb.g, rgb.b]);
```

UI-SPEC 组件清单：`Input` / `InputNumber` / `Select` / `Checkbox` / `ColorPicker`（`size="small"` `showText` `format="rgb"` `disabledFormat`）/ `Input.TextArea`（或 styled 原生 textarea）/ `Spin` / `Empty` / `Alert` / `Space` / `Button` / `Tooltip` / `Segmented`——antd 6.2.1 已是 `editor-impl` 的 peerDependency（D-08）。

---

### `src/table/model/traversal.ts`（utility，新增）

**Analog（parity，`**TRAP**`）:** 旧 `utils/traversal.ts:143-257`

**树构建语义（parity 要点）**：① 键顺序=**先注释配置里的键**，再叠加数据键；注释有键而数据没有 → 补 `null`。② 叶子判定：`_leaf` 默认——`null`/`undefined`/字符串/空对象/空数组 → 叶；否则 gap（可折叠子区）。③ `_hide` 为真 → 跳过；`_action` 可改写值。④ 叶节点产出 `TableNode`，gap 节点带 `children`。

```typescript
// Source: packages/apps/editor/src/components/Table/utils/traversal.ts:160-181（键顺序范式）
const keysForOrder: Record<string, symbol | unknown> = {};
const voidMark = Symbol('void');
// 1. 先加注释配置里的键（决定顺序）
if (parentCobj?._data && typeof parentCobj._data !== 'function') {
  for (const key of Object.keys(parentCobj._data)) keysForOrder[key] = voidMark;
}
// 2. 再加数据里的键（覆盖 void 标记）
Object.assign(keysForOrder, parentVobj);
// 3. 注释有键而数据没有 → 补 null
for (const key of Object.keys(keysForOrder)) {
  if (keysForOrder[key] === voidMark) parentVobj[key] = null;
  // …
}
```

> **TRAP**：旧文件 import 了 `@/project/tableMeta/TableMetaEvaluator` 的 `resolveTableMetaFunction` / `bindTableMetaContext`（引擎侧 `new Function` 求值，`TableMetaEvaluator.ts`）。**impl 不能引用**——动态配置函数（`_leaf`/`_hide`/`_string`/`_action`）与表达式经**注入的求值器**解析（Open Q6）；表名 `xxx` 只是不透明 id。旧文件还 import `@/utils/fieldPath` 的 `getShortField`——新 impl 需要自带等价的纯函数，或把短字段名逻辑内聚。

---

### `src/table/model/validation.ts`（utility，新增）

**Analog（parity，`**TRAP**`）:** 旧 `utils/validation.ts:32-143`

**`validateId` 是纯函数，可安全重写**（ASVS V5：白名单字符集天然排除 `__proto__` 等原型污染）：

```typescript
// Source: packages/apps/editor/src/components/Table/utils/validation.ts:71-103
export function validateId(id, existingKeys, supportText = false): ValidateIdResult {
  if (id == null || id.length === 0) return { valid: false, error: 'ID不能为空' };
  if (!supportText && !/^[a-zA-Z0-9_]+$/.test(id))
    return { valid: false, error: 'id不符合规范, 请使用大小写字母数字下划线来构成' };
  if (existingKeys.includes(id)) return { valid: false, error: 'id已存在, 请直接修改该项的值' };
  return { valid: true };
}
```

**`checkRange` 语义（parity）**，但 `_range` 求值必须注入：

```typescript
// Source: packages/apps/editor/src/components/Table/utils/validation.ts:32-45
export function checkRange(cobj: FieldConfig, value: unknown): boolean {
  if (cobj._range) return evaluateTableMetaExpression(cobj._range, value, getTableMetaContext(cobj)).value ?? false;
  if (cobj._select) return cobj._select.values.includes(value);
  return true;
}
```

> **TRAP**：`evaluateTableMetaExpression` 是本仓 `@motajs/editor` 的引擎侧 `new Function` 实现（`project/tableMeta/TableMetaEvaluator.ts:68-91`）。impl **不能**直接引用——`_range` 字符串交给**注入的求值器**（Open Q6）。删除许可 = `checkRange(config, null)`。

---

### `src/table/model/schemaPresentation.ts`（utility，新增；D-10/F2）

**Analog:** 旧 `components/SchemaTable/types.ts:40-49`（`CombineInputDescriptor` 是 `min`/`max`/`step`/`integer` 的来源）**+** `SchemaTable.tsx:1224-1231`（成对 number 行的 `step`/`precision`）

```typescript
// Source: packages/apps/editor/src/components/SchemaTable/types.ts:40-49（min/max 概念来源，A3）
export type CombineInputDescriptor = {
  key: string;
  label: string;
  editor: { kind: 'number'; min?: number; max?: number; step?: number; integer?: boolean };
  // …
};
```

```typescript
// Source: packages/apps/editor/src/components/SchemaTable/SchemaTable.tsx:1226-1227（成对 number 控件）
step={input.editor.step}
precision={input.editor.integer ? 0 : undefined}
```

> **F2（待确认）**：schema 专用呈现规则集**不由 schema 描述**（内建/可注入）。UI-SPEC 已列规范规则：`min`+`max` 合成一行两个小 `InputNumber`（条目列标签如「数值范围」）；`step`/`integer` 单行小控件；schema 目标不显示「编辑 Schema」；顶部一行 muted 的 schema 横幅。规则集必须先在 INTERFACE-NAME 里显式列出并确认。

---

### `src/table/table.css`（config/style，新增）

**Analog:** `editor-core/src/shell/shell.css`（纯 CSS、kebab-case、就近 co-located、`--editor-*` 以字面量兜底、经渲染根模块 `import`）

```css
/* Source: packages/libs/editor-core/src/shell/shell.css:1-10（范式） */
.editor-shell {
  display: flex;
  width: 100%;
  height: 100%;
  background: var(--editor-bg, #f5f6f8);
  color: var(--editor-fg, #202124);
}
```

**要求**：文件名 kebab-case（D-08，工作名 `table.css`）、就近 co-located；只消费 Phase-1 的 `--editor-*`（字面量兜底）+ 面板作用域的 `--etable-*` parity 色（UI-SPEC「Color」表，引 `assets/theme/editor_color_light.css:180-220`）；固定约 400px 四栏 + 列间/行间/区域分割线（D-16/D-17）；不引 PandaCSS/Tailwind。配套改 `editor-impl/package.json` 的 `sideEffects`（见脚手组）。

---

### `src/react/*`（通用多选/坐标弹窗 + 外部编辑器接缝，新增）

**Analog（parity）:** 旧 `Workbench/modals/CheckboxSet/useCheckboxSetModal.tsx`（`[open, holder]` Promise 弹窗范式）**+** `Workbench/modals/shared/ModalShell.tsx`（弹窗外壳）**+** 各 `useXxxModal`

**Promise 弹窗范式（D-12/D-13）**：

```typescript
// Source: packages/apps/editor/src/Workbench/modals/CheckboxSet/useCheckboxSetModal.tsx:17-51
export function useCheckboxSetModal(): UseModalReturn<CheckboxSetOptions, Array<string | number>> {
  const [state, setState] = useState<CheckboxSetState | null>(null);
  const [selected, setSelected] = useState<Array<string | number>>([]);
  const open = useCallback((options: CheckboxSetOptions) => {
    return new Promise<Array<string | number> | null>((resolve) => {
      const resolvedComments = typeof options.comments === 'function' ? options.comments() : options.comments;
      setState({ ...options, resolvedComments, resolve });
      setSelected(normalizeInitialValue(options.value));
    });
  }, []);
  // handleConfirm / handleCancel 内 resolve；holder = <ModalShell …/> : null
  return [open, holder];
}
```

**要求（D-13/D-14）**：多选弹窗做成**通用、可复用**组件（含素材缩略图多选，与 `popCheckboxSet` 合并）；坐标弹窗同构。放在非能力目录 `src/react/` 或 `src/shared/`。**D-11**（代码/事件）走**独立面板**（Phase-5/6 能力），本阶段只定义接缝 + 优雅降级。

> **TRAP**：旧 `ModalShell.tsx:36-44` 用 `window.addEventListener`（`window` 已豁免门禁，可用）但带 `#uieventDiv` 等旧 id 与 `style={{display:'block'}}`；新代码优先用 antd `Modal`（D-08/D-12，antd 已是 peer）。`escape` 键处理若用 `document` 会被门禁拦，用 `window`。

---

### 脚手架组

---

### `src/index.ts`（barrel，改）

**Analog:** `editor-core/src/index.ts`（桶一律 `export *`、**不写注释**、不跨目录深路径转发）

```typescript
// Source: packages/libs/editor-core/src/index.ts:1-9
export * from './types';
export * from './core';
export * from './undo';
export * from './resource';
export * from './panel';
export * from './hook';
export * from './log';
export * from './shell';
export * from './fs';
```

D-06 说根 barrel 汇总 `resources`/`edit`/`table`；实际行按确认后的目录写 `export * from './table';` 等。子路径导出由 `package.json` 的 `exports`（已有 `"./table": "./src/table/index.ts"`）负责，**不要**在根 barrel 里深路径转发内容。

---

### `src/global.d.ts`（config，新增）

**Analog:** `editor-core/src/global.d.ts`

```typescript
// Source: packages/libs/editor-core/src/global.d.ts:1
declare module '*.css';
```

`editor-impl/tsconfig.json` 的 `include` 是 `${configDir}/src`，该文件会被纳入。若无此声明，`tsc -b` 不认 `import '../table/table.css'`。

---

### `vitest.config.ts`（config，改）

**Analog:** `editor-core/vitest.config.ts:20-24` + `src/__tests__/mapPolyfill.ts`

当前 `editor-impl/vitest.config.ts` **缺** `setupFiles`（Pitfall 7）；若测试走 `ResourceSystem.readContent`（用 `Map.prototype.getOrInsertComputed`），需补：

```typescript
// Source: packages/libs/editor-core/vitest.config.ts:20-24
test: {
  environment: 'jsdom',
  include: ['src/**/*.test.{ts,tsx}'],
  setupFiles: ['src/__tests__/mapPolyfill.ts'],
},
```

垫片内容（可复制/复用）：`packages/libs/editor-core/src/__tests__/mapPolyfill.ts:19-36`（`Map.prototype.getOrInsertComputed` 惰性取值）。同时（Pitfall 8）若首个 `.tsx` 测试无法解析 `@vitejs/plugin-react`/`babel-plugin-react-compiler`，把它们补进 `editor-impl` 的 `devDependencies`（仅补声明，不加运行时依赖）。

---

### `package.json`（config，改）

**Analog:** `editor-core/package.json:6-8`

```json
// Source: packages/libs/editor-core/package.json:6-8
"sideEffects": [
  "./src/**/*.css"
],
```

当前 `editor-impl/package.json:6` 是 `"sideEffects": false`，必须改成 `["./src/**/*.css"]`（UI-SPEC 明确定义），避免打包器摇掉 `table.css`。脚本保持 `"typecheck": "tsc -b"`、`"test": "vitest run"`。**备注**：该改动与当前为红的 stale `implExports.js`（断言 `sideEffects === false`）冲突，不作为本阶段门禁（Open Q7）。

---

### 测试组

---

### `src/table/**/__tests__/*.test.{ts,tsx}`（test，新增）

**Analog:** `editor-core/src/shell/__tests__/shellSystem.test.ts:1-137`（`FakeResourceInjection` + `FakePanel implements IEditorPanel` + `createSystem` 装配 + RTL `act`）**+** 旧 `components/inputs/__tests__/SelectInput.test.tsx`（RTL 控件断言）

**内存后端夹具（Wave 0 必须）**：

```typescript
// Source: packages/libs/editor-core/src/shell/__tests__/shellSystem.test.ts:17-57
class FakeResourceInjection implements IResourceInjection {
  readonly content: Map<number, Map<string, unknown>> = new Map();
  readonly list: Map<number, IResourceIdentifier[]> = new Map();
  // 向内存后端预置一个资源内容及其所属的资源列表
  seed(id: IResourceIdentifier, value: unknown): void { /* content.set + list.push */ }
  async requestResource<T>(id: IResourceIdentifier): Promise<T> { return this.content.get(id.type)?.get(id.id) as T; }
  async requestResourceList(type: number): Promise<readonly IResourceIdentifier[]> { return this.list.get(type) ?? []; }
  async writeResource(id: IResourceIdentifier, content: unknown): Promise<void> { this.content.get(id.type)?.set(id.id, content); }
  // createResource / deleteResource …
}
```

**契约清单夹具**：`shellSystem.test.ts:59-137` 的 `FakePanel` 是 `IEditorPanel` 的全量实现（`initialize/dispose/render/onFocus/onBlur/onSwitchIn/onSwitchOut/onUpdateResource/onUpdateResourceList/undo/redo`）——可直接作为「`TablePanel` 必须实现哪些方法」的对照表。

**RTL 范式**：

```typescript
// Source: packages/libs/editor-core/src/shell/__tests__/shellSystem.test.ts:13-15,1-3
import { act, cleanup, render, screen } from '@testing-library/react';
import { createElement, FC } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
afterEach(() => { cleanup(); });
```

**覆盖项（RESEARCH Phase Requirements → Test Map）**：面板类型注册→空白标签列出并可开；设目标→经资源层取 `table.<name>`、按 `table#schema.<name>` 渲染四栏 + 折叠/叶行；行内改值（`_type` 选控件 / `_range` 失败拒绝）；添加/删除（名称校验 / null 许可）；一次编辑=一次可逆（`undo`/`redo`）；D-15 schema 变化重算；D-05 schema 无 schema；D-06 开新面板指向 `table#schema.x`；加载/空/错误文案（逐字）。**布局/横向滚动/分割线/悬停高亮为 manual-only**（jsdom 不做 CSS 布局）。

> **测试约定**：`import type` 在测试里也禁（`coreImportType.js` 扫 `__tests__` 与 `*.test.*`）；每个 `it` 前用单行 `//` 写覆盖内容；`vi.spyOn(logger, 'error')` 断言 id+参数。配置：`editor-impl/vitest.config.ts`（`include: ['src/**/*.test.{ts,tsx}']`）。当前 `pnpm --filter @motajs/editor-impl test` 为红（「No test files found」），加测试后转绿。

---

## Shared Patterns

### 依赖边界与四条仍生效门禁（新代码必须全部满足）
**Source:** `scripts/verify/{coreImportType,coreModuleState,coreEngineNeutral,coreFsSurface}.js`（`editor-core/src` 与 `editor-impl/src` 均适用）
**Apply to:** 所有新增/修改的 `editor-impl` 源码（含测试）

| 门禁 | 规则 | 对新代码的实际约束 |
|------|------|-------------------|
| `coreImportType.js` | 禁行首 `import type`（扫**全部** `.ts/.tsx`，含 `__tests__`/`*.test.*`） | 一律普通 `import`；类型再导出用 `export type`。旧表格满屏 `import type`，**不得**带入 |
| `coreModuleState.js` | 禁模块级 `let`/`var`、模块级 `const` 容器字面量（`Object.freeze({...})`/`as const` 豁免）；`core.ts` 与测试树豁免 | 折叠态/编辑模式/目标表状态放类实例字段或 React 状态；常量表 `Object.freeze` |
| `coreModuleState.js` | 禁 `fetch/document/navigator/localStorage/XMLHttpRequest`；禁 `process.env`/`import.meta.env`（`window` 豁免） | 剪贴板/素材列表等宿主能力经**注入**；不用 `document` |
| `coreEngineNeutral.js` | 禁 `tower/floor/loc/autopass/autotile/idnum/airwall/commonEvent/prefab/mota`（**含注释**，大小写敏感；`Math.floor` 成员访问豁免） | 表格代码/注释用中性词；`table.<name>` 的 `xxx` 是不透明 id；**注释里也不能出现**这些词 |
| `coreFsSurface.js` | core/impl 不得引用 `IEditorFileSystem` | 数据/schema 只经资源层，不用通用 fs 接口（D-03/CORE-01） |

> **stale 门禁（本阶段不作为门禁，Open Q7）**：`coreExports.js`/`implExports.js`（引已归档 `subpathStatus.json` + 断言 `sideEffects === false`，与 UI-SPEC 冲突）、`coreBoundaries.js`（因 `src/table` 不存在而红；建出 `src/table/` 后「能力互斥」断言有机会自然转绿，值得验证时跑一次记录）。

### 类 + 接口 + jsDoc（项目代码风格，覆盖 `dev.md`）
**Source:** `editor-core/src/hook/hook.ts`（`abstract class ... implements`）、`src/resource/types.ts`、`src/shell/shellSystem.ts`
**Apply to:** `tablePanel.ts`、`tablePanelType.ts`、`types.ts`、`capabilities.ts`

- 每个 class **先有 `interface`**，再 `implements`（`I` 前缀留给「要被 implements 的接口」）。
- 方法 JSDoc 写在**接口源头**（多行块、逐参数 `@param`），实现类**不重复**；类/接口/枚举本身**不写** jsDoc，`type` 别名**要写**。
- 成员声明写在方法前；私有方法放其调用者前；方法之间空行。
- **不写文件头注释**；有 import 时第一行必须是 import；import 之间不空行/不注释；文件级说明写在 import 之后。
- 接口成员默认 `readonly`；方法引用写作 `类名.方法名`；不允许内联对象类型、不允许「对象联合类型」（拆具名接口）。
- 枚举用数字（`const enum` 或普通 `enum`），成员**大驼峰**、单行 `/** */` 注释；不用字符串做键/状态标识。
- 不用 `import type`、不用连续 `as`、不用 `?.`（除副作用调用/Required 化）、不在函数内定义局部函数。

### 反应式「变更 → 重渲染」
**Source:** `editor-core/src/shell/shellSystem.ts`（`Store` + `useSyncExternalStore` + 版本号发布订阅）+ `editor-core/src/shell/__tests__/shellSystem.test.ts:496-517`（`onUpdateResource` 经 `ShellPanelHooks` 转发）
**Apply to:** 表格面板的 schema 订阅（D-15）与本地折叠/编辑模式状态

- 面板实例实现 `IEditorPanel.onUpdateResource`（已有接收端）；schema 资源变化时在其中重算列布局并触发重渲染。
- 面板内本地 UI 状态（折叠/编辑模式）优先纯 React（`useState`/`useMemo`/`useCallback`）；需要跨组件共享时用 `@tanstack/react-store`——**不要**用旧 `@motajs/react-store` 的 `createStore`（非 `editor-impl` 依赖）。
- `getSnapshot` 必须引用稳定（旧 shell Pitfall 2）；避免每次 `map()` 出新数组。

### 测试（Vitest + RTL + jsdom）
**Source:** `editor-core/src/shell/__tests__/shellSystem.test.ts`、`editor-core/src/__tests__/infrastructure.test.ts`、旧 `components/inputs/__tests__/SelectInput.test.tsx`
**Apply to:** 所有新增测试
- 夹具类显式 `implements` 契约；`FakeResourceInjection` 提供内存后端 + `seed`；`createSystem()` 装配。
- RTL：`render(createElement(root))` + `await act(async () => …)`；`vi.spyOn(logger, 'error')` 断言 id+参数。
- 每个 `it` 前用单行 `//` 写明覆盖内容。
- 运行：`pnpm --filter @motajs/editor-impl test`（当前红→加测试转绿）+ `pnpm --filter @motajs/editor-impl typecheck`；回归跑 `pnpm --filter @motajs/editor-core test`。

### 输出/文案（UI-SPEC 逐字，parity）
**Source:** `02-UI-SPEC.md` §Copywriting
**Apply to:** 工具栏/行操作/空态/加载/错误/校验提示

「编辑 Schema」·「编辑/添加/删除」·「注释/编辑/多选框编辑/复制」·「折叠/展开」·「暂无表格数据」·「正在加载表格…」·「表格加载失败」·「确定要删除吗？」·「请输入新项的名称」·「添加成功，刷新后生效。」·「删除成功，刷新后生效。」·「{字段} : 输入的值不合要求，请鼠标放置在注释上查看说明」。

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/table/model/schemaPresentation.ts` | utility | transform | 仓库内没有「schema 专用呈现规则集」的现成实现——规则本体是 **F2 待确认**；类比只能取 `SchemaTable` 的 `CombineInputDescriptor`（`min/max/step/integer`）与成对 number 控件形状，非模板 |
| `src/react/*`（通用多选/坐标弹窗） | component/hook | request-response | impl 内**无**共享弹窗先例（旧弹窗都在 app 的 `Workbench/modals/`，且用旧 id/DOM 约定）；只能借其「Promise 弹窗 + holder」机制范式，实现需按 antd + 本阶段门禁重写 |
| D-15 通知接缝 / D-06 打开参数（可能改 `editor-core`） | types/contract | event-driven | core 当前**没有**通知方法、也没有打开参数——这是本阶段要**新增**的契约（Open Q1/Q2），只有「同位置原来怎么写」的类比（`IEditorPanelContext` / `IEditorPanelFactoryParam`），没有现成范式 |

---

## Metadata

**Analog search scope:** `packages/libs/editor-impl/**`、`packages/libs/editor-core/**`、`packages/apps/editor/src/components/{Table,SchemaTable}/**`、`packages/apps/editor/src/Workbench/modals/**`、`packages/apps/editor/src/css` + `assets/theme`、`scripts/verify/*`
**Files scanned:** editor-impl 全部（4 源文件 + 配置）、editor-core 关键契约（panel/resource/undo/shell/hook/core + 测试夹具）、旧表格 `Table/**` 主体 + 输入控件与测试、`SchemaTable` 的 `types/schema/SchemaTable` 相关段、`Workbench/modals/CheckboxSet` + `shared/ModalShell`、4 个 core 门禁脚本、`global.d.ts`/`vitest.config.ts`/`package.json`
**Tracked-source check:** 所有引用路径均经 `git ls-files` 确认为已跟踪源码（`editor-core` 36 文件、`editor-impl` 4 文件、旧表格/SchemaTable、`scripts/verify/*`）；**无** `.gsd/` 安装镜像路径
**Pattern extraction date:** 2026-10-12

### 待用户确认（先于落代码）
1. **命名**（全部提案：目录/文件/接口/方法/日志 id/资源类型号）→ 写入 `.planning/phases/02-table/INTERFACE-NAME.md`，一 Plan 一节、说明每个名字的用途。
2. **Open Q1**（D-15 通知接缝）与 **Open Q2**（D-06 打开参数）——是否本阶段动 `editor-core` 契约，以及形状。
3. **Open Q6 / F2**：本阶段「schema」身份（旧 `CommentObject`）+ schema 专用呈现规则集（`min/max` 成对行）。
4. **Open Q4**：通用多选/坐标弹窗的模块位置（`src/react/` vs `src/shared/`）。
5. **Open Q8**：资源类型号（table 数据 vs schema 是否同 type）。
6. **Open Q9/10**：`vitest` 补 `setupFiles`；「刷新后生效」文案是否逐字保留。

## PATTERN MAPPING COMPLETE
