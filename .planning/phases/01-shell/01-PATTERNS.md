# Phase 1: 编辑器外壳与通用 fs 接口 - Pattern Map

**Mapped:** 2026-10-09
**Files analyzed:** 18（7 新增 / 11 修改或重写；名称均为提案，须先经 `INTERFACE-NAME.md` 确认）
**Analogs found:** 16 / 18 have a usable analog（2 个「仅类型 / 门禁脚本」按角色类比，见下）

> **读法（重要）**：本文件给的是**本仓库的写法范式**（接口+implements、jsDoc 规则、桶导出、`useSyncExternalStore`、测试结构），不是要照抄的实现。用户原话：「旧代码仅做参考，不代表新的代码也要这么写」。旧 `panelSystem.ts` 的实现体是把「对象注册」改成「类型注册」时的**改动对象**，只作为「同一位置原来怎么写」的参照。
>
> **命名门禁**：下表所有文件名 / 接口名 / 类名 / 方法名 / 日志 id 全是 RESEARCH.md 的**未确认提案**。按 AGENTS.md「重要命名先确认」，落代码前必须先写 `INTERFACE-NAME.md`（一 Plan 一节，说明每个名字是干什么的）并经用户确认。

---

## File Classification

| 新/改文件（提案路径，未确认） | Role | Data Flow | Closest Analog | Match Quality |
|-------------------------------|------|-----------|----------------|---------------|
| `packages/libs/editor-core/src/panel/types.ts`（改） | types/contract | registry / event-driven | 自身（现契约）+ `src/undo/types.ts`（injection+系统接口范式） | exact（自我演进） |
| `packages/libs/editor-core/src/fs/types.ts`（新增） | types（仅定义） | file-I/O（只声明，不调用） | `src/resource/types.ts`（带 jsDoc 的接口族）+ `apps/editor/src/services/fs/fs.ts:23-32`（方法集） | role-match |
| `packages/libs/editor-core/src/fs/index.ts`（新增） | barrel | n/a | `src/resource/index.ts` | exact |
| `packages/libs/editor-core/src/types.ts`（改） | types/contract | n/a | 自身（`IEditorCoreInjection` 组合注入） | exact |
| `packages/libs/editor-core/src/log/messages.ts`（改） | config（常量表） | n/a | 自身（`Object.freeze({...})` 表） | exact |
| `packages/libs/editor-core/src/index.ts`（改） | barrel（包根） | n/a | 自身 | exact |
| `packages/libs/editor-core/src/panel/panelSystem.ts`（改） | service（有状态系统） | registry / event-driven | 自身（注册表+钩子）+ `src/hook/hook.ts`（实例字段 Set/Map） | exact |
| `packages/libs/editor-core/src/panel/shellSystem.ts`（新增） | service + React 组件 | event-driven / pub-sub | `src/panel/panelSystem.ts:28-36,56-73,168-170`（`useSyncExternalStore` 根） | role-match |
| `packages/libs/editor-core/src/panel/shell.css`（新增） | config（样式） | n/a | `apps/editor/src/css/editor.css:3-24`（变量集）+ 项目 kebab 就近 CSS 约定 | partial |
| `packages/libs/editor-core/src/panel/index.ts`（改） | barrel | n/a | 自身 | exact |
| `packages/libs/editor-core/src/core.ts`（改） | composition root | n/a | 自身（`initialize`/`dispose` 逆序） | exact |
| `packages/libs/editor-core/src/global.d.ts`（新增） | config（环境声明） | n/a | `apps/editor/src/vite-env.d.ts`（环境 `.d.ts`） | role-match |
| `packages/libs/editor-core/package.json`（改） | config（清单） | n/a | 自身（改 `sideEffects`） | exact |
| `packages/libs/editor-core/src/panel/__tests__/panelSystem.test.ts`（重写） | test | event-driven | 自身（`FakePanel`/`createSystem` 夹具）+ `src/__tests__/core.test.ts` | exact |
| `packages/libs/editor-core/src/__tests__/core.test.ts`（改） | test | event-driven | 自身 | exact |
| `packages/libs/editor-core/src/panel/__tests__/shellSystem.test.ts`（新增） | test | component | `src/panel/__tests__/panelSystem.test.ts:204-225`（RTL `render`/`act`）+ `src/__tests__/infrastructure.test.ts` | role-match |
| `scripts/verify/coreFsSurface.js`（新增） | config（门禁脚本） | n/a | `scripts/verify/coreImportType.js`（真实树+两极性）+ `scripts/verify/coreBoundaries.js:335-367`（IO token 扫描） | role-match |

---

## Pattern Assignments

### 接口定义组（先接口、后实现——第一批计划）

---

### `src/panel/types.ts`（types/contract，改）

**Analog:** 自身（`packages/libs/editor-core/src/panel/types.ts`）+ `src/undo/types.ts`

**接口族 + jsDoc 范式**（现文件，lines 39-95）——注意：接口不写 jsDoc，**成员逐条写**；方法 jsDoc 换行式并逐个 `@param`：

```typescript
// Source: packages/libs/editor-core/src/panel/types.ts:39-58
export interface IEditorPanel extends IUndoable {
  /** 编辑器功能的标识符 */
  readonly id: string;

  /**
   * 初始化此编辑器面板
   */
  initialize(): Promise<void>;

  /**
   * 释放此编辑器面板
   */
  dispose(): Promise<void>;

  /**
   * 获取此编辑器面板的渲染组件
   */
  render(): FC;
}
```

**函数类型别名 + jsDoc**（现文件 line 95）——既是「工厂签名」的现写法，也是本阶段要演进为「类型工厂」的对象：

```typescript
// Source: packages/libs/editor-core/src/panel/types.ts:94-95
/** 创建编辑器面板的工厂函数，接收面板上下文并返回解析出面板的 Promise */
export type EditorPanelCreator = (context: IEditorPanelContext) => Promise<IEditorPanel>;
```

**injection 空接口 + 系统接口范式**（现文件 lines 97-143）——新外壳/菜单系统契约照此「`I...Injection` 空接口 + `I...System` 方法族」组织：

```typescript
// Source: packages/libs/editor-core/src/panel/types.ts:97-113
export interface IPanelInjection {}

export interface IPanelSystem extends IUndoable {
  /** 当前正在前台的编辑器面板 */
  readonly currentPanel: IEditorPanel | null;

  /**
   * 初始化编辑器面板系统并注入
   * @param injection 面板系统注入
   */
  initialize(injection: IPanelInjection): Promise<void>;

  /**
   * 注册编辑器面板
   * @param panel 面板对象的工厂函数
   */
  registerPanel(panel: EditorPanelCreator): Promise<IEditorPanel | null>;
}
```

**配套参照**：`src/undo/types.ts:22-25` 是「注入接口只有 readonly 数据」的极简范式（`IUndoInjection { readonly maxUndoStep: number; }`）；`src/resource/types.ts:68-100` 是「注入接口是一组 Promise 方法」的范式——fs 接口类型照后者写。

> **门禁约束**：`import type` 禁用（`coreImportType.js`），所以本文件继续用普通 `import { FC } from 'react'`；成员接口默认 `readonly`（AGENTS.md 代码风格「接口成员默认 readonly」）。接口本身**不写** jsDoc，类型别名**要写**（本项目覆盖 `dev.md` 的注释规范）。

---

### `src/fs/types.ts`（types，新增；仅定义，不实现、不引用）

**Analog:** `packages/libs/editor-core/src/resource/types.ts`（接口族写法）+ `packages/apps/editor/src/services/fs/fs.ts:23-32`（方法集）+ `packages/apps/service-worker/src/server/fsApi.ts:53-100`（操作集）

**接口族 jsDoc 范式**（照 `IResourceInjection` 写一个只读的方法接口）：

```typescript
// Source: packages/libs/editor-core/src/resource/types.ts:68-100
export interface IResourceInjection {
  /**
   * 请求指定资源的资源内容
   * @param id 资源标识符
   */
  requestResource<T>(id: IResourceIdentifier): Promise<T>;

  /**
   * 请求指定资源类型的资源标识符列表
   * @param type 资源类型
   */
  requestResourceList(type: number): Promise<readonly IResourceIdentifier[]>;

  /**
   * 向指定资源写入资源内容
   * @param id 资源标识符
   * @param content 要写入的资源内容
   */
  writeResource(id: IResourceIdentifier, content: unknown): Promise<void>;
}
```

**方法集对齐（读/写/列目录/建目录/移动/删除）**：

```typescript
// Source: packages/apps/editor/src/services/fs/fs.ts:23-32 —— 方法集参照（旧实现，仅对齐形状，不照抄）
export interface FsPromiseApi {
  readFile(filename: string, encoding: FileEncoding): Promise<string>;
  readFileBinary(filename: string): Promise<ArrayBuffer>;
  writeFile(filename: string, data: string, encoding: FileEncoding): Promise<void>;
  writeMultiFiles(filenames: string[], dataList: string[]): Promise<void>;
  readdir(path: string): Promise<string[]>;
  mkdir(path: string): Promise<void>;
  moveFile(src: string, dest: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
}
```

宿主侧操作名（`readFile`/`writeFile`/`writeMultiFiles`/`listFile`/`makeDir`/`moveFile`/`deleteFile`，见 `fsApi.ts:53-100`）说明「列目录」在两侧叫法不同（`readdir` vs `listFile`），最终名以 `INTERFACE-NAME.md` 确认为准。

> **门禁约束（关键，实测会红）**：
> 1. `coreBoundaries.js:75-84` 禁的是**带前导点的调用形态**（`this.fs`、`.readFile(`、`.writeFile(`…），且**不剥离注释**。fs 接口用**方法签名**（`readFile(path: string): Promise<string>;`，无前导点）即安全；**JSDoc 里绝不能写 `fs.readFile(...)` 这种带点示例**。
> 2. 该文件只能是**类型声明**，仓库内不得有任何 `implements`/调用（D-13）。
> 3. `coreImportType.js` 禁 `import type`；`coreEngineNeutral.js` 禁引擎术语（含注释）。

---

### `src/fs/index.ts`（barrel，新增）

**Analog:** `packages/libs/editor-core/src/resource/index.ts`

```typescript
// Source: packages/libs/editor-core/src/resource/index.ts:1-3
export * from './types';
export * from './resource';
export * from './resourceSystem';
```

> **项目约定**：桶文件一律 `export *`，不逐个列名、**不写注释**、不跨目录深路径转发（AGENTS.md）。fs 目录本阶段只有 `types.ts`，故桶只写 `export * from './types';`。

---

### `src/types.ts`（types/contract，改）

**Analog:** 自身

**组合注入 + 导出接口范式**（现文件 lines 5-16）：

```typescript
// Source: packages/libs/editor-core/src/types.ts:5-16
export interface IEditorCoreInjection extends IUndoInjection, IResourceInjection, IPanelInjection {}

export interface IEditorCore {
  /** 编辑器版本 */
  readonly version: string;

  /** 撤回系统 */
  readonly undoSystem: IUndoSystem;
  /** 面板管理系统 */
  readonly panelSystem: IPanelSystem;
  /** 资源系统 */
  readonly resourceSystem: IResourceSystem;
}
```

若新增独立的 shell/菜单系统接口，注入接口用**多重 extends**组合（如再加 `IShellInjection`），`IEditorCore` 增加对应 `readonly` 字段。

---

### `src/log/messages.ts`（config，改）

**Analog:** 自身

**常量表 + 结构性豁免范式**（现文件 lines 4-13）——注意 `Object.freeze({...})` 是 `coreModuleState.js` 门禁唯一豁免的模块级容器写法：

```typescript
// Source: packages/libs/editor-core/src/log/messages.ts:3-13
/** editor-core 的集中日志消息表：日志 id 到带 $1、$2 … 占位符的英文模板 */
export const messages: LogMessages = Object.freeze({
  'panel.duplicateId': 'Duplicate panel identifier: $1',
  'panel.notRegistered': 'Panel not registered: $1',
  'panel.callbackFailed': 'Panel callback failed: $1',
  'core.duplicateInitialize': 'EditorCore is already initialized',
  'core.initializeAfterDispose': 'EditorCore cannot be initialized after dispose',
  'system.notInitialized': '$1 system is not initialized',
  'resource.hookFailed': 'Resource update hook failed: $1',
  'log.unknownId': 'Unknown log id: $1',
});
```

新增 id（提案，待确认）如重复类型 id、注销后残留、实例 id 等；模板英文、`$N` 占位符。`logger.error(id, ...params)` 见 `src/log/logger.ts:12-14`，`logger` 是模块级单例（`logger.ts:45`）。

---

### `src/index.ts`（barrel，改）

**Analog:** 自身

```typescript
// Source: packages/libs/editor-core/src/index.ts:1-7
export * from './types';
export * from './core';
export * from './undo';
export * from './resource';
export * from './panel';
export * from './hook';
export * from './log';
```

新增行形如 `export * from './fs';`（只增不改顺序约定）。

---

### 实现组（接口确认后的第二批计划）

---

### `src/panel/panelSystem.ts`（service，改）

**Analog:** 自身（`packages/libs/editor-core/src/panel/panelSystem.ts`）+ `src/hook/hook.ts`

**`useSyncExternalStore` + 版本号发布订阅 + 一次性缓存根组件**（现文件 lines 21-36, 55-73, 168-170）——这是外壳渲染机制的核心范式，外壳直接复用：

```typescript
// Source: packages/libs/editor-core/src/panel/panelSystem.ts:21-36
interface IPanelRootProps {
  /** 订阅面板变更 */
  readonly subscribe: (listener: () => void) => () => void;
  /** 读取当前面板 */
  readonly getSnapshot: () => IEditorPanel | null;
}

/**
 * 订阅当前面板并渲染其组件；组件定义在模块层以保证 hooks 规则可识别
 * @param props 面板根组件的订阅与取快照回调
 * @returns 当前面板的渲染结果，无当前面板时为 null
 */
function PanelRoot(props: IPanelRootProps): ReactElement | null {
  const current = useSyncExternalStore(props.subscribe, props.getSnapshot);
  return current ? createElement(current.render()) : null;
}
```

```typescript
// Source: packages/libs/editor-core/src/panel/panelSystem.ts:56-73（关键：快照返回稳定引用）
/** 面板版本号，仅用于通知订阅者重渲染 */
private readonly panelStore = new Store<number>(0);
/** 订阅面板变更，供 useSyncExternalStore 使用 */
private readonly subscribe: (listener: () => void) => () => void;
/** 读取当前面板，供 useSyncExternalStore 使用 */
private readonly getSnapshot: () => IEditorPanel | null;
/** 缓存一次的渲染根组件，避免每次 render() 返回新组件导致反复重挂 */
private readonly RootComponent: FC;

constructor(undoSystem: IUndoSystem, resourceSystem: IResourceSystemAccess) {
  this.undoSystem = undoSystem;
  this.resourceSystem = resourceSystem;
  this.subscribe = (listener) => this.panelStore.subscribe(listener);
  this.getSnapshot = () => this.currentPanel;
  this.RootComponent = () => createElement(PanelRoot, { subscribe: this.subscribe, getSnapshot: this.getSnapshot });
}
```

```typescript
// Source: packages/libs/editor-core/src/panel/panelSystem.ts:168-170
render(): FC {
  return this.RootComponent;
}
```

> **Pitfall 2（RESEARCH）**：`getSnapshot` 必须返回**引用稳定**值。改成「标签数组」快照时**不能**每次 `map()` 出新数组；沿用「版本号 + 组件内读可变状态」或缓存不可变快照。

**有状态系统的实例字段范式**（`src/hook/hook.ts:8-15`）——注册表/标签状态全部放类实例字段，禁止模块级容器：

```typescript
// Source: packages/libs/editor-core/src/hook/hook.ts:7-15
/** 加载完成的钩子列表 */
protected readonly loadedList: Set<IHookObject<H, C>> = new Set();

/** 钩子列表 */
private readonly hookList: Set<IHookObject<H, C>> = new Set();
/** 钩子对象到钩子存储对象的映射 */
private readonly hookMap: Map<Partial<H>, IHookObject<H, C>> = new Map();
/** 钩子控制器到钩子存储对象的映射 */
private readonly controllerMap: Map<C, IHookObject<H, C>> = new Map();
```

**类 + 接口 + 生命周期**（现文件 lines 38-52, 90-136）：`class PanelSystem implements IPanelSystem`；`initialize()` 幂等（`if (this.initialized) return;` + `initialized` 标志）；注册时重复 id → `dispose()` 重复对象 + `logger.error('panel.duplicateId', id)` + 返回 `null`（lines 104-124）；`disposeExcel` 逆序释放并 `unload()` 钩子（lines 172-189）。**新模型的 `unregisterPanelType` / `closeTab` 按此「单一出口：先 dispose 实例 + unload 钩子，再改注册表/标签」范式**（RESEARCH Pitfall 7）。

> **门禁约束**：`coreModuleState.js` 实测禁止 core/impl 生产源码出现模块级 `let`/`var`、模块级 `const` 用 `new Map()/Set`、数组/对象字面量初始化（`Object.freeze({...})` 与 `{...} as const` 豁免）；`src/core.ts` 与测试目录豁免。新代码必须全用实例字段。

---

### `src/panel/shellSystem.ts`（service + React 组件，新增）

**Analog:** `packages/libs/editor-core/src/panel/panelSystem.ts`（渲染根机制）+ `packages/apps/editor/src/css/editor.css`（CSS 变量来源；**视觉仅参照，非模板**）

外壳 = 「模块层定义根组件（保证 hooks 规则可识别）+ 类实例持有订阅/快照 + 每状态变更 `store.setState(v => v + 1)`」。结构照 `panelSystem.ts:28-36,56-73` 复制范式。菜单行/标签行/内容区为**模块层函数组件**（`PanelRoot` 同款：`function Xxx(props): ReactElement {...}`）。

交互契约（D-02..D-05）在 UI-SPEC 已定：加载后自动一个空白标签、`+` 追加空白标签并激活、点击类型项**原位替换**空白标签、关闭 `×` → `dispose()` → 移除 → 自动激活相邻（优先左邻）→ 无标签时新建空白标签、标签导航不进撤销历史。文案见 `01-UI-SPEC.md` Copywriting 表。

> **门禁约束**：`coreEngineNeutral.js` 扫描**原始文本（注释也算）**，禁 `tower/floor/loc/autopass/autotile/idnum/airwall/commonEvent/prefab/mota`（大小写敏感，`Math.floor` 成员访问豁免）。新外壳与注释里**绝不能**出现这些词。`coreModuleState.js` 禁 `fetch/document/navigator/localStorage/XMLHttpRequest` 与 `process.env/import.meta.env`（`window` 已豁免，焦点监听可用）。一切数据经注册注入，不读文档/存储/网络。

---

### `src/panel/shell.css`（config，新增）

**Analog:** `packages/apps/editor/src/css/editor.css:3-24`（变量集）+ 项目 kebab-case 就近 CSS 约定

**CSS 变量来源（UI-SPEC 明确复用同名变量，core 以字面量兜底）**：

```css
/* Source: packages/apps/editor/src/css/editor.css:3-24 */
:root {
  --editor-bg: #f5f6f8;
  --editor-surface: #fff;
  --editor-toolbar-bg: #fff;
  --editor-fg: #202124;
  --editor-muted: #656d76;
  --editor-border: #d0d7de;
  --editor-selected: #dbeafe;
}

:root[data-editor-theme='dark'] {
  --editor-bg: #242424;
  --editor-surface: #303035;
  --editor-toolbar-bg: #2b2b30;
  --editor-fg: #d4d4d4;
  --editor-muted: #9da5b4;
  --editor-border: #4b4b52;
  --editor-selected: #163a5f;
}
```

UI-SPEC 另定义了 `--editor-accent`（默认 `#1677ff`，host 可覆盖）、间距（4/8/16/24/32/48/64）、字号（Body 14 / Label 13 / Heading 16）、行高（菜单 32px、标签 36px）。文件名 kebab-case、就近 co-located（项目约定）。

> **两处必须的配套改动（UI-SPEC「Styling Approach」明确）**：
> 1. `packages/libs/editor-core/package.json` 的 `"sideEffects": false` → `"sideEffects": ["./src/**/*.css"]`。
> 2. 新增 `src/global.d.ts` 一行 `declare module '*.css';`，否则 `tsc -b` 不认 `import './shell.css'`。
> 门禁扫描面不含 `.d.ts` 与 `package.json` 字段，故这两项**不触** core 门禁（UI-SPEC 已确认）。

---

### `src/panel/index.ts`（barrel，改）

**Analog:** 自身

```typescript
// Source: packages/libs/editor-core/src/panel/index.ts:1-3
export * from './types';
export * from './panelSystem';
export * from './panelContext';
```

新增行形如 `export * from './shellSystem';`（`export *`，无注释，不跨目录深路径）。

---

### `src/core.ts`（composition root，改）

**Analog:** 自身

**组合根生命周期（initialize 并行 + dispose 逆序）**（现文件 lines 25-48）：

```typescript
// Source: packages/libs/editor-core/src/core.ts:36-48
this.initialized = true;

const arr = [this.undoSystem.initialize(injection), this.resourceSystem.initialize(injection)];
await Promise.all(arr);
await this.panelSystem.initialize(injection);
// ...
async dispose(): Promise<void> {
  await this.panelSystem.dispose();
  await this.resourceSystem.dispose();
  await this.undoSystem.dispose();
  this.disposed = true;
}
```

外壳接线落在此处：`initialize` 末尾（D-15 加载完成后系统已就绪、D-02 默认一个空白标签）；`dispose` 按逆序释放。`src/core.ts` 被 `coreModuleState.js:48-49` **豁免** module-state 规则（但仍吃 PORT-02 规则）。

---

### `src/global.d.ts`（config，新增）

**Analog:** `packages/apps/editor/src/vite-env.d.ts`

```typescript
// Source: packages/apps/editor/src/vite-env.d.ts:1
/// <reference types="vite/client" />
```

环境声明 `.d.ts` 的写法范式；本阶段内容为 `declare module '*.css';`（UI-SPEC 已定，无依赖新增）。注意 `tsconfig.json:9` 的 `include` 是 `${configDir}/src`，`src/global.d.ts` 会被纳入。

---

### `package.json`（config，改）

**Analog:** 自身

```json
// Source: packages/libs/editor-core/package.json:6（当前值，需改）
"sideEffects": false,
```

改为 `"sideEffects": ["./src/**/*.css"]`（UI-SPEC 明确定义），避免打包器摇掉样式表。运行脚本保持 `"typecheck": "tsc -b"`、`"test": "vitest run"`（`package.json:12-13`）。

---

### 测试组

---

### `src/panel/__tests__/panelSystem.test.ts`（test，重写）

**Analog:** 自身（`FakePanel` / `createSystem` 夹具 / `logger` 间谍范式）

**测试系统夹具范式**（现文件 lines 141-158）——新契约重写时保留夹具骨架：

```typescript
// Source: packages/libs/editor-core/src/panel/__tests__/panelSystem.test.ts:141-158
interface TestSystem {
  readonly panelSystem: PanelSystem;
  readonly undoSystem: UndoSystem;
  readonly resourceSystem: ResourceSystem;
  readonly injection: FakeResourceInjection;
}

// 组装一套已初始化的面板/资源/撤回系统与内存后端
async function createSystem(maxUndoStep = 100): Promise<TestSystem> {
  const injection = new FakeResourceInjection();
  const resourceSystem = new ResourceSystem();
  await resourceSystem.initialize(injection);
  const undoSystem = new UndoSystem();
  await undoSystem.initialize({ maxUndoStep });
  const panelSystem = new PanelSystem(undoSystem, resourceSystem);
  await panelSystem.initialize();
  return { panelSystem, undoSystem, resourceSystem, injection };
}
```

**RTL 真实挂载 + `act` 范式**（现文件 lines 204-225）——标签切换/多实例/关闭后自动切换的断言都照此：

```typescript
// Source: packages/libs/editor-core/src/panel/__tests__/panelSystem.test.ts:211-224
render(createElement(system.panelSystem.render()));

await act(async () => {
  await system.panelSystem.switchTo(a);
});

expect(screen.getByText('panel-a')).not.toBeNull();
```

**每个 `it` 前单行 `//` 说明覆盖内容**（项目测试注释约定，见全文件）；`logger` 用 `vi.spyOn` 断言 id + 参数（lines 272-284, 442-481）。

> RESEARCH Pitfall 1：本文件依赖旧契约的用例（注册/切换面板等）属**有意 one-way 变更**，规划中显式列为「按新契约重写」任务，不是回归。

---

### `src/__tests__/core.test.ts`（test，改）

**Analog:** 自身（`FakeEditorInjection` / `FakePanel` / 包根公开面断言）

```typescript
// Source: packages/libs/editor-core/src/__tests__/core.test.ts:270-279（包根公开面断言范式）
describe('包根公开面', () => {
  // 包根导出 EditorCore、三系统类与 Hook 基类，均可从 '.' 导入
  it('从包根可导入 EditorCore、三系统类与 Hook 基类', () => {
    expect(EditorCore).toBeDefined();
    expect(UndoSystem).toBeDefined();
    expect(ResourceSystem).toBeDefined();
    expect(PanelSystem).toBeDefined();
  });
});
```

`FakePanel`（lines 71-134）需按新实例契约（`(context, instanceId) => Promise<IEditorPanel>`）更新；旧 API 用例（如 lines 171-181, 240-252）同步改写。

---

### `src/panel/__tests__/shellSystem.test.ts`（test，新增）

**Analog:** `panelSystem.test.ts`（RTL 装配与交互断言）+ `src/__tests__/infrastructure.test.ts`

```typescript
// Source: packages/libs/editor-core/src/__tests__/infrastructure.test.ts:1-11（jsdom + RTL 端到端可用性）
import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';

describe('渲染测试基础设施', () => {
  it('renders a text node into jsdom and finds it via screen', () => {
    render(createElement('div', null, 'editor-core smoke'));
    expect(screen.getByText('editor-core smoke')).not.toBeNull();
  });
});
```

覆盖 SHELL-01 的验收项（RESEARCH Phase Requirements → Test Map）：加载后外壳（菜单行+标签行+默认空白标签）、类型注册→空白页列出并可开实例、同类型多实例独立、关闭销毁并自动切换、注销不残留、空壳（零类型）仍渲染。测试配置：`vitest.config.ts:20-24`（`environment: 'jsdom'`、`include: ['src/**/*.test.{ts,tsx}']`、`setupFiles: ['src/__tests__/mapPolyfill.ts']`）——新测试文件自动被纳入。

---

### `scripts/verify/coreFsSurface.js`（config/门禁，新增）

**Analog:** `scripts/verify/coreImportType.js`（真实树 + 两极性 fixture）+ `scripts/verify/coreBoundaries.js:306-367`（IO token 逐文件扫描 + 非空转下界）

**门禁骨架范式**（`coreImportType.js:139-162`）：真实树扫描 + `MIN_EXPECTED_SOURCES` 非空转下界 + 两极性 fixture（脚本创建/删除，`finally` 中断言已删）：

```javascript
// Source: scripts/verify/coreImportType.js:143-162
function checkRealTree() {
  const sources = collectAllSources();
  scannedFileCount = sources.length;
  check(sources.length > 0, `没有扫描到任何 ... —— 门禁无从生效`);
  check(
    sources.length >= MIN_EXPECTED_SOURCES,
    `真实树只扫描到 ${sources.length} 个源码文件，低于非空转下界 ${MIN_EXPECTED_SOURCES} —— 扫描范围可能被削弱`,
  );
  const violations = findViolations(sources);
  check(violations.length === 0, `真实树出现 ${violations.length} 条 ...（期望 0）：` + formatViolations(violations));
}
```

**IO token 扫描范式**（`coreBoundaries.js:323-367`）——用于断言「仓库中不存在 fs 默认实现 / core·impl 不引用」：

```javascript
// Source: scripts/verify/coreBoundaries.js:323-333
function findIoHits(fileList) {
  const hits = [];
  for (const relPath of fileList) {
    const source = fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
    for (const token of BOTTOM_LAYER_IO_TOKENS) {
      if (source.includes(token)) hits.push({ file: relPath, token });
    }
  }
  return hits;
}
```

```javascript
// Source: scripts/verify/coreBoundaries.js:351-363（两极性：合成 fixture 必须被同一条断言拦下）
fs.writeFileSync(IO_FIXTURE, IO_FIXTURE_SOURCE, 'utf8');
let fixtureHits = [];
try {
  fixtureHits = findIoHits(collectTsFiles(coreAbs));
} finally {
  fs.rmSync(IO_FIXTURE, { force: true });
}
const fixtureRel = relative(IO_FIXTURE);
check(fixtureHits.some((hit) => hit.file === fixtureRel), '...两极性失败：合成 fixture 未被同一条断言拦下');
```

> 写法要点（照既有三脚本）：脚本头注释说明「断言的是什么」；`import` 在前；常量 `UPPER_SNAKE_CASE`；`/ ==================== X ====================/` 分段；`check(cond, message)` 收集 failures；`main()` 汇总后非零退出。禁止写「无法失败的门禁」（Phase 2 教训）。

---

## Shared Patterns

### 依赖边界与门禁（新代码必须全部满足）
**Source:** `scripts/verify/{coreImportType,coreModuleState,coreEngineNeutral,coreBoundaries}.js`（`packages/libs/editor-core/src` 与 `editor-impl/src` 均适用）
**Apply to:** 所有新增/修改的 `editor-core` 源码

| 门禁 | 规则 | 对新代码的实际约束 |
|------|------|-------------------|
| `coreImportType.js:34` | 禁行首 `import type`（含测试树，`MIN_EXPECTED_SOURCES=18`） | 一律普通 `import`；类型再导出用 `export type` |
| `coreModuleState.js:55-59` | 禁模块级 `let`/`var`、模块级 `const` 容器字面量；`Object.freeze({...})`/`as const` 豁免；`core.ts` 与测试树豁免 | 注册表/标签状态全放类实例字段；常量表用 `Object.freeze` |
| `coreModuleState.js:52` | 禁 `fetch/document/navigator/localStorage/XMLHttpRequest`；禁 `process.env`/`import.meta.env`（`window` 豁免） | 外壳不读文档/存储/网络，数据经注册注入 |
| `coreEngineNeutral.js:47-58` | 禁 `tower/floor/loc/autopass/autotile/idnum/airwall/commonEvent/prefab/mota`，**注释也算**，大小写敏感 | 外壳/类型/注释用中性「面板/标签/类型」词，**绝不**出现引擎术语 |
| `coreBoundaries.js:75-84` | 禁底层 IO **调用形态** `this.fs`/`.readFile(`…，**不剥注释** | fs 接口只有方法签名（无前导点）；JSDoc 禁写 `xxx.readFile(` |

### 类 + 接口 + jsDoc（项目代码风格，覆盖 `dev.md`）
**Source:** `src/hook/hook.ts`（`class ... implements`）、`src/panel/panelSystem.ts`、`src/resource/types.ts`
**Apply to:** `panelSystem.ts`、`shellSystem.ts`、`panel/types.ts`、`fs/types.ts`

- 每个 class 先有 `interface`，再 `implements`；成员声明在方法前；私有方法放其调用者前。
- 方法 JSDoc 写在**接口源头**，实现类不重复；类/接口/枚举本身**不写** jsDoc；`type` 别名**要写**。
- 全部方法与成员（含模块顶层 `const`）都要 jsDoc；单行 `//` 仅限三种情形（文件级说明、函数内注释、`// TODO:`/`//region`）。
- **不写文件头注释**；有 import 时第一行必须是 import。
- 接口成员默认 `readonly`；`I` 前缀留给「要被 implements 的接口」。
- 枚举用 `const enum` + 数字，成员大驼峰（现 `PanelUndoType` 即此，见 `panel/types.ts:145-148`）；**不要**用字符串做键/状态标识。
- 不用 `import type`（与门禁一致）；不用连续 `as`。

### `useSyncExternalStore` 变更→重渲染
**Source:** `src/panel/panelSystem.ts:33-36,56-73,168-170`
**Apply to:** 菜单行、标签行、内容区、空白标签列表（外壳任一状态变化）

### 测试（Vitest + RTL + jsdom）
**Source:** `src/panel/__tests__/panelSystem.test.ts`、`src/__tests__/infrastructure.test.ts`
**Apply to:** 所有新增/重写测试
- 夹具类（`FakePanel` 等）显式 `implements` 契约；内存后端 seed 辅助；`createSystem()` 装配。
- RTL：`render(createElement(root))` + `await act(async () => ...)`；`vi.spyOn(logger, 'error')` 断言 id+参数。
- 每个 `it` 前用单行 `//` 写明覆盖内容。
- 运行：`pnpm --filter @motajs/editor-core test`（当前基线 45/45 绿；`vitest.config.ts` 自动纳入 `src/**/*.test.{ts,tsx}`）。

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| （无） | — | — | 外壳实现与 fs 类型均有角色级类比；仅 `shell.css` 无「core 自带 plain CSS」先例（core 现无任何 CSS），但变量集与就近 CSS 约定可参照 `apps/editor/src/css/editor.css`。**

> 说明：`ShellSystem` 的「浏览器外壳 + 标签状态机」在仓库内**无完全相同**的先例——现有 `Workbench/index.tsx`、`AppTopBar.tsx`、`stores/PanelStore.ts` 是**工作区导航**（parity reference，非模板），仅用于视觉/机制参照；实现范式从 `panelSystem.ts` 的 `useSyncExternalStore` 机制派生。

---

## Metadata

**Analog search scope:** `packages/libs/editor-core/**`、`packages/apps/editor/src/{services/fs,Workbench,stores,css}`、`packages/apps/service-worker/src/server/fsApi.ts`、`scripts/verify/*`
**Files scanned:** editor-core `src` 全部（20 源文件 + 测试）、4 个 core 门禁脚本、`fs.ts`/`fsApi.ts` 方法集、`editor.css` 变量集、`package.json`/`tsconfig.json`/`vitest.config.ts`
**Tracked-source check:** 所有引用路径均经 `git ls-files` 确认为已跟踪源码（非 `.gsd/` 安装镜像）
**Pattern extraction date:** 2026-10-09

### 待用户确认（先于落代码）
1. **命名**（全部提案）→ 写入 `.planning/phases/01-shell/INTERFACE-NAME.md`，一 Plan 一节，说明每个名字的用途。
2. **验收基线**：本阶段限定在 `editor-core`（`tsc -b` + `vitest` + 三个仍生效门禁）；`coreExports.js`/`coreBoundaries.js` 当前因引用已归档里程碑路径为红（RESEARCH Pitfall 8 / Open Q1）——是否修复为独立范围决策。
3. **标签切换是否进撤销历史**（RESEARCH A2 / Open Q2）：UI-SPEC 已定「不进」，但需用户确认。
4. **接口拆分粒度**（`IPanelSystem` 兼管 vs 拆 `IShellSystem`，RESEARCH Open Q3）。
5. **fs 接口最终方法名**（`readdir` vs `listFile` 等）。
