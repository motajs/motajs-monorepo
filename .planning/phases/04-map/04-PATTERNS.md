# Phase 4: 地图编辑 - Pattern Map

**Mapped:** 2026-10-20
**Files analyzed:** 40 行（新建 36 / 修改 4；弹窗与测试按组归并，按 RESEARCH 提议结构）
**Analogs found:** 36 / 40（25 exact + 11 role-match；其余 4 行为 partial / none，见 §No Analog Found）

> **命名状态：全部为提案。** 本文件出现的所有新文件路径、接口名、方法名、字段名、CSS 类名与 `data-test-id`
> 都来自 `04-RESEARCH.md` §Recommended Project Structure / §Naming Proposals，**尚未写入
> `.planning/phases/04-map/INTERFACE-NAME.md`，也未经用户确认**。本文件只回答「新文件应该照哪个既有文件写、
> 抄哪几段」，不构成命名承诺。正式落盘前以 `INTERFACE-NAME.md` 的确认结果为准。
>
> **方法引用格式**：涉及类的方法一律写 `类名.方法名`（如 `MapPanel.save`），自由函数裸名。提案类名同样按此格式书写。
>
> **门禁前提（所有 editor-impl/map 文件都适用）**：`coreEngineNeutral` 扫描源码 **与注释**；
> `coreModuleState` 禁止模块级可变绑定、模块级 `Map/Set/Array/Object` 常量容器，以及
> `fetch/document/navigator/localStorage/XMLHttpRequest`；`.dependencyCruiser.cjs` 禁止 `map` import
> `table` / `asset` / `code`。所有 analog 代码在抄写时必须换掉引擎专有词。

---

## File Classification

### A. `@motajs/editor-core`（修改 / 新增测试）

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/libs/editor-core/src/panel/types.ts`（改：加可选关闭前钩子） | 契约 / 接口 | request-response（异步布尔裁决） | 同文件既有 `IEditorPanel.getTitle?()` 的可选成员写法 | exact（就地改） |
| `packages/libs/editor-core/src/shell/shellSystem.ts`（改：`ShellSystem.closeTab`） | shell 系统 / 命令分派 | 命令 + 生命周期事件 | 同文件 `ShellSystem.openPanelInTab` 的时序与 `closePanelInstance` 的释放顺序 | exact（就地改） |
| `packages/libs/editor-core/src/shell/__tests__/shellClose.test.ts`（新） | test | 集成（jsdom） | `packages/libs/editor-core/src/shell/__tests__/shellSwitch.test.ts` | exact |
| `packages/libs/editor-impl/src/shared/schemaForm/components/TableGrid.tsx`（改：加表单模式可选开关） | component（表单宿主） | request-response（渲染） | 同文件既有 `schemaMode?: boolean` 可选成员 + `TableToolbar` 构造段 | exact（就地改） |
| `packages/libs/editor-impl/src/shared/schemaForm/__tests__/formMode.test.tsx`（新，提案名） | test | 组件渲染 | `packages/libs/editor-impl/src/table/__tests__/schemaMode.test.tsx` | role-match |

### B. `@motajs/editor-impl/map` — 数据层 / 类型 / 入口

| New/Modified File（提案） | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/map/index.ts` | barrel | — | `packages/libs/editor-impl/src/asset/index.ts` | exact |
| `src/map/types.ts` | 类型中心（接口 / `const enum`） | — | `packages/libs/editor-impl/src/asset/types.ts`（+ `table/types.ts` 的多数值枚举） | exact |
| `src/map/constants.ts` | config | — | `packages/libs/editor-impl/src/asset/constants.ts` | exact |
| `src/map/mapPanel.ts` | 面板数据层（service / controller） | CRUD + 异步资源 + 事件驱动状态 | `packages/libs/editor-impl/src/asset/assetPanel.ts`（主）+ `src/table/tablePanel.ts`（次） | exact |
| `src/map/mapPanelType.ts` | 工厂 / 面板类型对象 | request-response（创建实例） | `packages/libs/editor-impl/src/asset/assetPanelType.ts` | exact |
| `src/map/map.css` | config（样式） | — | `packages/libs/editor-impl/src/asset/asset.css` | exact |

### C. `editor-impl/map/model` — 纯函数

| New/Modified File（提案） | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/map/model/document.ts` | model（纯函数） | transform（不可变文档） | `packages/libs/editor-impl/src/asset/model/assetList.ts`（纯解析 / 防御） | role-match（无不可变 diff 先例） |
| `src/map/model/geometry.ts` | utility（纯几何） | transform | `packages/apps/editor/src/MapEditor/utils/brushGeometry.ts` | exact（角色与语义一致） |
| `src/map/model/brush.ts` | model（纯函数） | transform（笔刷目标格） | `packages/apps/editor/src/MapEditor/utils/brushGeometry.ts` + `src/project/commands/mapCommands.ts:133-137` | role-match |
| `src/map/model/fill.ts` | model（纯函数） | batch（四邻域 BFS） | `packages/apps/editor/src/MapEditor/utils/fillBfs.ts` | exact |
| `src/map/model/clipboard.ts` | model（纯函数） | transform（区域复制 / 裁剪粘贴） | `packages/apps/editor/src/project/commands/mapCommands.ts:245-263,438-485` | role-match |
| `src/map/model/passability.ts` | model（纯函数，只读） | transform | `packages/apps/editor/src/project/model/passability.ts` | role-match（旧数据模型不同） |
| `src/map/model/renderModel.ts` | model（纯函数，渲染模型） | transform | `packages/apps/editor/src/MapEditor/rendering/MapPixiRenderer.tsx:398-438` | role-match |
| `src/map/model/recentTiles.ts` | model（纯函数） | transform（过滤 / 上限 / 去重） | `packages/libs/editor-impl/src/asset/model/assetList.ts` | role-match |
| `src/map/model/dirty.ts` | model（纯函数） | transform（基线比较） | **无同形先例**（最接近：`assetPanel.ts` 的布尔 `unsaved`；比较用 `es-toolkit` 的 `isEqual`，见 `apps/editor/src/project/commands/prefabCommands.ts:7,114`） | partial |
| `src/map/model/validation.ts` | model（纯函数） | transform（输入校验） | `packages/libs/editor-impl/src/asset/model/assetPaths.ts`（+ `shared/schemaForm/model/validation.ts`） | exact |

### D. `editor-impl/map/components` — 视图

| New/Modified File（提案） | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/map/components/MapPanelView.tsx` | component（装配） | request-response（状态分发） | `packages/libs/editor-impl/src/asset/components/AssetPanelView.tsx` | exact |
| `src/map/components/MapToolbar.tsx` | component（工具栏） | request-response（回调） | `packages/libs/editor-impl/src/asset/components/AssetToolbar.tsx`（+ 旧 `apps/editor/src/MapEditor/ToolBar.tsx`） | exact |
| `src/map/components/MapCanvas.tsx` | component（手势容器） | event-driven（pointer / keyboard） | `packages/apps/editor/src/MapEditor/MapCanvas.tsx` | role-match（旧为原生 DOM 监听） |
| `src/map/components/MapSurface.tsx` | component（Pixi 生命周期） | streaming（帧绘制） | `packages/apps/editor/src/MapEditor/rendering/MapPixiRenderer.tsx` | exact |
| `src/map/components/MapPalette.tsx` | component（按钮网格） | request-response（选中） | `packages/libs/editor-impl/src/asset/components/AssetGrid.tsx`（+ 旧 `RecentlyUsedPanel.tsx`、`MaterialPanel/`） | role-match |
| `src/map/components/MapStatusBar.tsx` | component（只读状态条） | request-response | **无同形先例**（可复用 `asset.css` 的 label / muted 写法） | partial |
| `src/map/components/MapContextMenu.tsx` | component（菜单） | event-driven | `packages/apps/editor/src/MapEditor/ContextMenu.tsx` | role-match（新需 `role="menu"` 键盘语义） |
| `src/map/components/MapPropertiesDrawer.tsx` | component（抽屉 + 表单宿主） | request-response（字段提交） | `packages/libs/editor-impl/src/asset/components/AssetConfigView.tsx`（`TableGrid` 复用）+ `TranscodeModal.tsx`（antd 覆盖层） | role-match |
| `src/map/components/MapEmptyState.tsx` | component（加载 / 空 / 错） | request-response | `AssetPanelView.tsx:153-221`（状态分支）+ `table/components/TableEmptyColumn.tsx`（内联列表） | exact |
| `src/map/components/dialogs/`（新建地图 / 新增图层 / 未保存 / 清除最近） | component（弹窗） | request-response（受控表单） | `packages/libs/editor-impl/src/asset/components/TranscodeModal.tsx` + `TableEmptyColumn.tsx:68-102` | exact |

### E. `editor-impl/map/__tests__` — 测试

| New/Modified File（提案） | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/map/__tests__/fixtures.ts` | test（harness） | — | `packages/libs/editor-impl/src/asset/__tests__/fixtures.ts` | exact |
| `src/map/__tests__/pixiMock.ts` | test（替身） | — | **无同形先例**（旧编辑器只测纯函数，见 `apps/editor/src/MapEditor/rendering/__tests__/defaultGround.test.ts`） | none |
| `src/map/__tests__/model.*.test.ts`（document / geometry / brush / fill / clipboard / passability / renderModel / recentTiles / dirty / validation） | test（纯函数） | unit | `packages/libs/editor-impl/src/asset/model/__tests__/assetPaths.test.ts` + `src/table/__tests__/validation.test.ts` | exact |
| `src/map/__tests__/mapPanel.test.tsx` / `mapSave.test.tsx` / `mapProperties.test.tsx` / `mapDialogs.test.tsx` | test（面板集成） | integration | `src/table/__tests__/manualSave.uat.test.tsx` + `src/asset/__tests__/assetPanel.test.tsx` | exact |
| `src/map/__tests__/mapView.*.test.tsx` | test（视图） | 组件渲染 | `src/asset/__tests__/assetView.test.tsx` | exact |

### F. `packages/apps/editor-dev` — 组合根

| New/Modified File（提案） | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/apps/editor-dev/src/demo/mapDemo.ts` | config / demo 装配 | — | `packages/apps/editor-dev/src/demo/assetDemo.ts:617-645` | exact |
| `packages/apps/editor-dev/src/backend/mapFiles.ts` | 宿主适配器（service） | transform（引擎形状 ↔ 中立文档）+ 内存写回 | **无同形先例**；可借 `memoryBackend.ts` 的路径处理与 `assetDemo.ts` 的数据构造 | partial |
| `packages/apps/editor-dev/src/main.tsx`（改：seed + 注册） | 组合根 | — | 同文件现有 `seed*` / `register*` 顺序 | exact（就地改） |
| `packages/apps/editor-dev/src/__tests__/devHostMap.test.tsx` | test | integration（jsdom，mock Pixi） | `packages/apps/editor-dev/src/__tests__/devHostAsset.test.tsx` | exact |

---

## Pattern Assignments

### 1. `mapPanelType.ts`（工厂 / 面板类型）— analog `asset/assetPanelType.ts`

**Analog:** `packages/libs/editor-impl/src/asset/assetPanelType.ts`

**Imports 与类型面**（lines 1-5）：

```ts
import { IEditorPanelFactoryParam, IEditorPanelType } from '@motajs/editor-core';
import { createElement, ReactNode } from 'react';
import { IAssetEditorCapabilities } from '../react';
import { AssetPanel } from './assetPanel';
import { IAssetPanelTarget } from './types';
```

**目标收窄 + 工厂闭包**（lines 46-77）：

```ts
function isAssetPanelTarget(value: unknown): value is IAssetPanelTarget {
  if (typeof value !== 'object' || value === null) return false;
  if ('categoryId' in value && typeof value.categoryId !== 'string') return false;
  if ('assetName' in value && typeof value.assetName !== 'string') return false;

  return true;
}

export function createAssetPanelType(capabilities: IAssetEditorCapabilities): IEditorPanelType {
  return Object.freeze({
    id: 'asset',
    name: '素材管理器',
    icon: createAssetIcon(),
    create: (param: IEditorPanelFactoryParam): AssetPanel => {
      const panel = new AssetPanel(param, capabilities);
      const openParam = param.openParam;

      if (openParam !== undefined) {
        const target = openParam.target;

        if (isAssetPanelTarget(target)) panel.setTarget(target);
      }

      return panel;
    },
  });
}
```

**照抄要点：**
- 能力经**工厂闭包**进入面板构造器，不导出 `install(core)`，不把能力放 React Context。
- `id` 常量与 `Object.freeze` 一起导出；图标用 `createElement('svg', …)` 内联（`assetPanelType.ts:17-39` / `tablePanelType.ts:10-31`），不引入图标库。
- `openParam.target` 只做形状收窄，不做业务解释；面板类内部再决定怎么用。
- 无能力注入需求的同类先例是 `tablePanelType.ts:45-61`（直接导出冻结对象，不包工厂）；地图**需要**能力，所以选 asset 形态。

---

### 2. `mapPanel.ts`（面板数据层）— analog `asset/assetPanel.ts`（主）

**Analog:** `packages/libs/editor-impl/src/asset/assetPanel.ts`
**Secondary:** `packages/libs/editor-impl/src/table/tablePanel.ts`（`onSwitchIn` / 保存 / 撤销 / 请求序号）

**模块导入与副作用样式**（assetPanel lines 1-19）：

```ts
import './asset.css';
import { message as antdMessage } from 'antd';
import { Store } from '@tanstack/store';
import { useStore } from '@tanstack/react-store';
import { get } from 'es-toolkit/compat';
import { createElement, FC, ReactElement } from 'react';
import {
  IEditorPanel,
  IEditorPanelContext,
  IEditorPanelFactoryParam,
  IResource,
  IUndoContext,
} from '@motajs/editor-core';
import { AssetPanelView } from './components';
```

> 注意：本项目代码风格**不用 `import type`**；样式表在面板入口 `import './map.css'`；`package.json` 的
> `sideEffects` 已含 `./src/**/*.css`（UI-SPEC `Styling Approach`），无需改包配置。

**类字段布局：上下文 / 能力 / Store / 组件缓存 / 每域状态**（lines 210-227）：

```ts
export class AssetPanel implements IEditorPanel, IAssetPanel {
  readonly id: string;

  /** 面板侧上下文，提供资源层读写与撤销能力 */
  private readonly context: IEditorPanelContext;

  /** 装配方注入的素材能力（分类清单 + 选择器） */
  private readonly capabilities: IAssetEditorCapabilities;

  /** 面板视图状态的订阅源 */
  private readonly store: Store<IAssetPanelViewState>;

  /** 缓存的渲染根组件 */
  private readonly component: FC;

  /** 各分类的内部状态，按分类标识惰性补建 */
  private readonly states: Map<string, IAssetPanelState> = new Map<string, IAssetPanelState>();
```

**构造器：一次建 Store，组件闭包把数据层方法接到视图 props**（lines 268-300，节选）：

```ts
constructor(param: IEditorPanelFactoryParam, capabilities: IAssetEditorCapabilities /* … */) {
  this.id = param.instanceId;
  this.context = param.context;
  this.capabilities = capabilities;
  // …
  this.store = new Store<IAssetPanelViewState>({
    status: categories.length === 0 ? AssetPanelStatus.NoCategory : AssetPanelStatus.Loading,
    // …所有业务状态一次给齐
  });

  this.component = (): ReactElement =>
    createElement(AssetPanelContainer, {
      store: this.store,
      loadBytes: async (path: string): Promise<Uint8Array | undefined> => {
        const resource = await this.context.requestResource(path);

        if (resource === null) return undefined;

        try {
          return await resource.requestBinary();
        } catch {
          return undefined;
        }
      },
      onSelectCategory: (categoryId: string): void => {
        void this.selectCategory(categoryId);
      },
      // …每个视图回调都转成 `void this.xxx()`
    });
}
```

**加载：未保存时不重读、请求序号防过期、失败隔离成错误态**（lines 423-487，节选）：

```ts
async loadCategory(categoryId: string): Promise<void> {
  // …
  const state = this.stateAt(categoryId);

  // 该分类有未落盘改动时不重读覆盖内存，保住手动保存下的内存改动（D-24）
  if (state.unsaved) return;

  this.currentCategoryId = categoryId;
  const token = state.token + 1;
  state.token = token;
  this.publish(AssetPanelStatus.Loading);

  try {
    const directoryEntries = await this.context.listDirectory(category.dir);
    if (state.token !== token) return;
    // …
    const text = await this.readListText(await this.context.requestResource(category.listPath));
    if (state.token !== token) return;
    // …
  } catch {
    if (state.token !== token) return;
    this.setError(categoryId, '列表读取失败，请重试。');
  }
}
```

**手动保存：只处理有改动的域**（lines 489-503）：

```ts
async save(): Promise<void> {
  const ids = [...this.states.keys()];

  for (const categoryId of ids) {
    const state = this.states.get(categoryId);

    if (state === undefined || !state.unsaved) continue;

    const category = this.findCategory(categoryId);

    if (category === undefined) continue;

    await this.writeCategory(categoryId, category, state);
  }
}
```

**撤销登记：普通条目 vs 屏障条目**（lines 505-519）：

```ts
registerBarrier(data: unknown): void {
  this.context.addUndoContext(this, { type: AssetUndoType.Barrier, data, barrier: true });
}

registerConfigUndo(data: unknown): void {
  this.context.addUndoContext(this, { type: AssetUndoType.Config, data });
}
```

**单字段提交 → 一条可逆记录 + 重算行树 + 置脏**（lines 800-820）：

```ts
applyConfigEdit(path: string, value: unknown): void {
  const category = this.currentCategory();
  const name = this.configName;
  const document = this.configDocument;

  if (category === undefined || name === undefined || document === undefined) return;

  const previous = get(document, path);
  const next = setByFieldPath(document, path, value);

  this.configDocument = next;
  this.storeEntryConfig(category.id, name, next);
  this.registerConfigUndo({ categoryId: category.id, name, path, previous, next: value });
  this.refreshConfigView();
  this.publish(AssetPanelStatus.Ready);
}
```

**撤销 / 重做只认自己的类型，类型不符直接返回**（lines 407-417）：

```ts
async undo(context: IUndoContext<unknown>): Promise<void> {
  if (context.type !== AssetUndoType.Config) return;

  this.replayConfigUndo(context.data, true);
}

async redo(context: IUndoContext<unknown>): Promise<void> {
  if (context.type !== AssetUndoType.Config) return;

  this.replayConfigUndo(context.data, false);
}
```

**发布视图状态：整体替换、提示走 antd message 不走 Store**（lines 1148-1170，节选）：

```ts
private publish(status: AssetPanelStatus, notice?: string, error?: string): void {
  if (notice !== undefined) antdMessage.info(notice);

  const state = this.currentCategoryId === undefined ? undefined : this.states.get(this.currentCategoryId);
  const previous = this.store.state;

  this.store.setState({
    status,
    // …把所有业务字段一次性铺开
    selectedName: previous.selectedName,
    error,
    unsaved: state === undefined ? false : state.unsaved,
  });
}
```

**TablePanel 补充（切换 / 保存 / 撤销）**（`tablePanel.ts` lines 638-703）：

```ts
async onSwitchIn(): Promise<void> {
  const count = this.columns.length;

  for (let index = 0; index < count; index += 1) await this.refresh(index);

  this.refreshAwaitingPickers();
}

async undo(context: IUndoContext<unknown>): Promise<void> {
  await this.applyUndoRedo(context, true);
}

async redo(context: IUndoContext<unknown>): Promise<void> {
  await this.applyUndoRedo(context, false);
}

async save(columnIndex: number = 0): Promise<void> {
  const column = this.columnAt(columnIndex);
  const target = column.target;

  if (target === null) return;
  if (!column.unsaved && !column.unsavedSchema) return;

  const wroteData = column.unsaved;
  const wroteSchema = column.unsavedSchema;

  if (wroteData && !(await this.persist(columnIndex, column.data))) return;
  if (wroteSchema && !(await this.persistSchema(columnIndex, column.schema))) return;

  column.unsaved = false;
  column.unsavedSchema = false;
  // …
  this.publish(columnIndex, column.store.state.status, column.store.state.rows, '已保存');
}
```

**地图必须偏离旧做法的地方（RESEARCH Pattern 3 / Pitfall 8-9）：**
- `AssetPanel.save` 用布尔 `unsaved`；地图要求 **基线快照比较**（`save` 成功只把「发出去的快照」设为基线，
  撤销 / 重做后重算脏状态）。布尔字段的写法照抄，判定来源换成 `model/dirty.ts`。
- `TablePanel.dispose` / `TablePanel.onSwitchOut` 会**自动**保存未落盘改动（`tablePanel.ts:608-610,646-648`）。
  地图 D-18 是**手动保存 + 未保存询问**，**不要**照抄自动 flush；关闭前拦截走 `onBeforeClose`（见 §9）。
- `AssetPanel.getTitle` 返回会随分类变化的标题（`assetPanel.ts:364-372`）。地图按 RESEARCH A12 建议
  **不实现动态标题**，避免外壳标签名不刷新（Pitfall 20）。

---

### 3. `types.ts` / `constants.ts` / `index.ts` — analog `asset/types.ts`、`asset/constants.ts`、`asset/index.ts`

**View state 一律 `readonly`，可选字段用 `?`，枚举用 `const enum`**（`asset/types.ts:110-139`，节选）：

```ts
export interface IAssetPanelViewState {
  /** 面板数据状态 */
  readonly status: AssetPanelStatus;
  /** 当前处于浏览还是配置模式 */
  readonly mode: AssetPanelMode;
  /** 当前分类下的素材条目 */
  readonly entries: readonly IAssetEntry[];
  /** 当前选中的素材名；未选中时为 undefined */
  readonly selectedName?: string;
  /** 是否存在尚未落盘的改动 */
  readonly unsaved: boolean;
  /** 是否打开瘦身转码弹窗 */
  readonly transcodeOpen: boolean;
}
```

**对外动作接口与类的分工**（`asset/types.ts:96-108`）：`IAssetPanel` 只写 `setTarget` / `save`，类
`AssetPanel implements IEditorPanel, IAssetPanel`。地图同样先声明 `IMapPanel` 再 `implements`（项目规则）。

**常量只放裸常量，不放容器**（`asset/constants.ts:1-17` 全文）：

```ts
/** 单个上传文件的字节上限 */
export const ASSET_MAX_UPLOAD_BYTES = 32 * 1024 * 1024;

/** 撤销命中屏障时对用户显示的文案 */
export const UNDO_BLOCKED_MESSAGE = '无法撤销';

/** 卡片框宽度滑块的默认值（px） */
export const DEFAULT_ASSET_CARD_WIDTH = 116;
```

> 地图的默认尺寸 / 格子边长 / 最近使用上限 / 路径 / 文案照此逐条 `export const`，**不要**写
> `const DEFAULTS = {…}` 或 `const LIST = []`（`coreModuleState` 会拦模块级对象 / 数组容器）；
> 需要成组常量时用 `Object.freeze({...})` 或 `as const`（`scripts/verify/coreModuleState.js:55-59,70-112`）。

**桶文件只 `export *`、按目录顺序**（`asset/index.ts` 全文）：

```ts
export * from './types';
export * from './constants';
export * from './model';
export * from './schemas';
export * from './transcode';
export * from './components';
export * from './assetPanel';
export * from './assetPanelType';
export * from './picker';
export * from './assetCapabilityProvider';
```

> `src/map/index.ts` 同理：`types → constants → model → components → mapPanel → mapPanelType`。
> 不要从根 `src/index.ts` 再导出 `map`（`.dependencyCruiser.cjs:36-45` 的
> `editor-impl-root-barrel-must-not-import-capabilities` 会拦）。

---

### 4. `map.css` — analog `asset/asset.css`

**Analog:** `packages/libs/editor-impl/src/asset/asset.css`（1-60）

```css
.asset-panel {
  --easset-missing-bg: #fff2e8;
  --easset-missing-fg: #d4380d;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
  color: var(--editor-fg, #202124);
  background: var(--editor-surface, #ffffff);
  font-size: 13px;
  line-height: 1.5;
}

.asset-toolbar {
  display: flex;
  flex: 0 0 32px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  height: 32px;
  padding: 0 8px;
  border-bottom: 1px solid var(--editor-border, #d0d7de);
  background: var(--editor-toolbar-bg, #ffffff);
}
```

**照抄要点：**
- 面板根类定义**面板作用域变量**（地图对应 UI-SPEC 的 `--emap-*`），其余规则消费 `--editor-*` 并带字面量 fallback。
- 面板根 `width/height: 100%`、`overflow: hidden`、列 flex；只有调色板是纵向滚动区（UI-SPEC §溢出）。
- 类名统一前缀（素材 `asset-`、表格 `etable-`、地图 `emap-`）；**不得**出现引擎词。

---

### 5. `MapPanelView.tsx` — analog `asset/components/AssetPanelView.tsx`

**Analog:** `packages/libs/editor-impl/src/asset/components/AssetPanelView.tsx`

**状态分支 + 空 / 错态 + 重试**（lines 153-194）：

```tsx
if (view.status === AssetPanelStatus.Loading) {
  return (
    <div className="asset-content">
      <div className="asset-state" data-test-id="asset-state-loading">
        <Spin size="small" />
        <span className="asset-state-body">正在加载素材…</span>
      </div>
    </div>
  );
}

if (view.status === AssetPanelStatus.Error) {
  return (
    <div className="asset-content">
      <div className="asset-state asset-state-error" data-test-id="asset-state-error">
        <div className="asset-state-title">素材加载失败</div>
        <div className="asset-state-body">请检查该分类的资源是否存在，或稍后重试。</div>
        <Button size="small" autoInsertSpace={false} data-test-id="asset-state-retry" onClick={props.onRetry}>
          重试
        </Button>
      </div>
    </div>
  );
}
```

**根节点带稳定状态标记，供测试观察**（lines 237-264，节选）：

```tsx
export function AssetPanelView(props: IAssetPanelViewProps): ReactElement {
  const state = props.view;
  // …
  return (
    <div className="asset-panel" data-test-id="asset-panel" data-status={statusToken(state.status)}>
      <AssetToolbar … />
      {panelError === undefined ? null : (
        <div className="asset-panel-error" data-test-id="asset-panel-error" role="alert">
          {panelError}
        </div>
      )}
      <div className="asset-body">…</div>
    </div>
  );
}
```

**照抄要点：**
- 视图组件**只接 props**（`view` + 回调），不 import 面板类、不 import `editor-core`。
- 道具回调可选时在文件底部给 `noopXxx` 缺省实现（`AssetPanelView.tsx:128-144`），避免视图里到处 `?.()`。
- 地图的 `data-test-id` 前缀用 `map-`（UI-SPEC §测试标识），并在根上暴露状态标记。

---

### 6. `MapToolbar.tsx` — analog `asset/components/AssetToolbar.tsx`

**Analog:** `packages/libs/editor-impl/src/asset/components/AssetToolbar.tsx`（46-95）

```tsx
export function AssetToolbar(props: IAssetToolbarProps): ReactElement {
  return (
    <div className="asset-toolbar" data-test-id="asset-toolbar">
      <span className="asset-toolbar-title" title={props.title}>
        {props.title}
      </span>
      <Space size={8}>
        <Button size="small" autoInsertSpace={false} disabled={!props.transcodeEnabled} …>
          瘦身转码
        </Button>
        <Button
          size="small"
          autoInsertSpace={false}
          disabled={!props.unsaved || props.disabled}
          data-test-id="asset-toolbar-save"
          onClick={props.onSave}
        >
          保存
        </Button>
      </Space>
    </div>
  );
}
```

**旧编辑器的控件语义参照**（`packages/apps/editor/src/MapEditor/ToolBar.tsx:49-81`）：

```tsx
const handleBrushModChange = useCallback(
  (mod: string | number) => {
    const next = mod as BrushMod;
    store.setBrushMod(next);
    // …
  },
  [store],
);

const handleLayerModChange = useCallback(
  (layer: string | number) => {
    store.setLayerMod(layer as LayerMod);
  },
  [store],
);
```

**照抄要点：**
- 工具栏是纯 DOM + antd；地图两级工具栏、`Segmented`（图层 / 画笔）、`Switch`（通行度）、`Button`（大地图 /
  保存）都按 UI-SPEC。旧文件只能参照**控件语义**，不要照抄 `lucide-react` 图标（`ToolBar.tsx:9`，
  editor-impl 无图标库）与 `notifySuccess`（新面板用 `antd message`）。
- 保存按钮的禁用条件 = `!unsaved || disabled`；地图保存按钮文案是 **「保存地图」**（可见文字 / `title` /
  `aria-label` 三处一致，UI-SPEC §Copywriting）。

---

### 7. `MapPalette.tsx` — analog `asset/components/AssetGrid.tsx` + 旧素材面板

**Analog（网格与按钮语义）：** `packages/libs/editor-impl/src/asset/components/AssetGrid.tsx`（59-102）

```tsx
export function AssetGrid(props: IAssetGridProps): ReactElement {
  return (
    <div
      className="asset-grid"
      data-test-id="asset-grid"
      style={{ gridTemplateColumns: `repeat(auto-fill, ${props.cardWidth}px)` }}
    >
      {props.entries.map((entry) => (
        <button
          key={entry.name}
          type="button"
          className={cardClassName(entry, props.selectedName)}
          title={entry.name}
          data-test-id={`asset-card-${entry.name}`}
          data-exists={String(entry.exists)}
          onClick={(): void => props.onSelect(entry.name)}
        >
          …
          {entry.exists ? null : (
            <span className="asset-card-missing" data-test-id={`asset-card-missing-${entry.name}`}>
              缺失
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
```

**旧「最近使用」的按钮语义（右键置顶 / 防浏览器菜单）**（`RecentlyUsedPanel.tsx:70-82`）：

```tsx
const handleMouseUp = (event: MouseEvent<HTMLButtonElement>) => {
  event.preventDefault();
  if (event.button === 2) onToggleTop?.(item, !item.istop);
  else onSelect?.(item);
};

return (
  <button
    type="button"
    data-test-id={`recent-material-${item.idnum}`}
    title={`${item.id || item.idnum} (${item.idnum})`}
    onMouseUp={handleMouseUp}
    onContextMenu={(event) => event.preventDefault()}
  >
```

**照抄要点：**
- 每个图块是真实 `<button type="button">`，`title` 给全名，缺图给角标 + `data-exists`；选中态用类名
  `is-selected`，不靠内联颜色。
- 多格框选要在**同一组内**做矩形夹取（UI-SPEC D-09；旧 MaterialPanel 的布局算法**不要**照抄，
  RESEARCH `State of the Art` 已声明）。
- 图片缺口的占位只影响该图块，不影响整面板（Pitfall 13）。

---

### 8. `MapCanvas.tsx` / `MapSurface.tsx` — analog 旧 `MapCanvas.tsx` + `MapPixiRenderer.tsx`

**手势（旧实现，原生鼠标事件）**（`packages/apps/editor/src/MapEditor/MapCanvas.tsx:297-388`，节选）：

```ts
const handleMouseDown = useCallback(async (e: MouseEvent) => {
  store.setSelectedArea(null);
  if (isStale) return;

  if (e.button === 2 && (gestureStart.current !== null || holdingPath)) {
    suppressContextMenu.current = true;
    clearPaintGesture();
    return;
  }
  // …
  if (e.button !== 0) return;
  gestureStart.current = currentPos;
  gesturePath.current = [currentPos];
  store.clearStepPostfix();
  store.setHoldingPath(true);
  // …
}, [/* … */]);
```

**正交补点（旧几何，逐字）**（`utils/brushGeometry.ts:3-14`）：

```ts
export function walkOrthogonalPath(from: LocPOD, to: LocPOD): LocPOD[] {
  const result: LocPOD[] = [];
  let cursor = from;
  while (cursor[0] !== to[0] || cursor[1] !== to[1]) {
    const dx = to[0] - cursor[0];
    const dy = to[1] - cursor[1];
    cursor =
      Math.abs(dx) >= Math.abs(dy) ? [cursor[0] + Math.sign(dx), cursor[1]] : [cursor[0], cursor[1] + Math.sign(dy)];
    result.push(cursor);
  }
  return result;
}
```

**拖拽时按正交路径逐格累计**（`MapCanvas.tsx:474-487`）：

```ts
const lastPos = gesturePath.current[gesturePath.current.length - 1];
if (!lastPos) return;

const dx = currentPos[0] - lastPos[0];
const dy = currentPos[1] - lastPos[1];

if (dx === 0 && dy === 0) return;
for (const nextPos of walkOrthogonalPath(lastPos, currentPos)) {
  gesturePath.current.push(nextPos);
  store.pushStepPostfix(nextPos);
}
```

**Pixi v8 生命周期（旧实现已验证的 API 形态）**（`MapPixiRenderer.tsx:889-923`）：

```ts
void app
  .init({
    width: viewportWidth,
    height: viewportHeight,
    backgroundAlpha: 0,
    antialias: false,
    autoDensity: false,
    preference: 'webgl',
    preserveDrawingBuffer: true,
    autoStart: false,
  })
  .then(() => {
    const scene = new Container();
    app.stage.addChild(scene);
    activate(scene);
  })
  .catch((error: unknown) => {
    // 初始化失败 → 面板内错误态
  });
```

**每次数据变化重建场景子节点**（`MapPixiRenderer.tsx:925-939`，节选）：

```ts
useEffect(() => {
  if (!renderReady) return;
  // …
  const previousChildren = scene.removeChildren();
  // …按 renderCells 建 Sprite / Graphics
}, [/* … */]);
```

**可见格与层透明度（渲染模型的语义来源）**（`MapPixiRenderer.tsx:398-438`，节选）：

```ts
if (bigmap) {
  const size = Math.min(viewportSize[0] / Math.max(floorWidth, 1), viewportSize[1] / Math.max(floorHeight, 1));
  const left = Math.max(0, (viewportSize[0] - floorWidth * size) / 2);
  const top = Math.max(0, (viewportSize[1] - floorHeight * size) / 2);
  // …全图逐格
}

function layerAlpha(layer: MapLayerName, activeLayer: MapLayerName): number {
  if (activeLayer === 'map') return 1;
  return layer === activeLayer ? 1 : 0.3;
}
```

**必须偏离旧实现的地方：**
- 旧渲染器用**模块级** `frameTextureCache` / `pixiApplicationPool`（`MapPixiRenderer.tsx:44,90-106`）。
  `coreModuleState` 会拦模块级 `new Map()` / 数组 / 对象（`scripts/verify/coreModuleState.js:55-59`）。
  新的缓存只能放 `MapSurface` 的 `useRef` 或渲染器实例字段。
- 旧画布用 `document.createElement('canvas')` 做 2D 叠加层；`document` 在 `editor-impl/src` 是
  error 级禁用全局（`coreModuleState.js:52`）。UI-SPEC 的框选 / 预览 / 网格全部走 Pixi `Graphics` 或 JSX `<canvas>`。
- 旧手势把监听挂在 window/document 上；新实现按 UI-SPEC 挂在画布容器（快捷键 `Ctrl+C/V` 仅画布聚焦）。
- 纯渲染模型与 Pixi 组件必须分离，否则 jsdom 无法测（Pitfall 4）。

---

### 9. `editor-core` 关闭前拦截 + 撤销 — 就地改 `panel/types.ts` / `shellSystem.ts`

**当前关闭路径（无询问、无取消）**（`packages/libs/editor-core/src/shell/shellSystem.ts:590-623`，节选）：

```ts
async closeTab(tabId: string): Promise<void> {
  const index = this.tabs.findIndex((tab) => tab.id === tabId);

  if (index === -1) {
    logger.error('shell.tabNotFound', tabId);
    return;
  }

  const tab = this.tabs[index];
  const wasActive = this.activeTabId === tabId;

  if (tab.instanceId !== null) {
    if (wasActive) this.leaveActiveInstance(tab.instanceId);
    await this.closePanelInstance(tab.instanceId);
  }

  this.tabs.splice(index, 1);
  // …切邻
}
```

**内部释放路径（必须保持不询问）**（`shellSystem.ts:512-525`）：

```ts
async closePanelInstance(instanceId: string): Promise<void> {
  const instance = this.instances.get(instanceId);

  if (instance === undefined) return;

  this.hooks.get(instanceId)?.unload();
  this.hooks.delete(instanceId);
  this.instances.delete(instanceId);
  this.instanceTypes.delete(instanceId);
  this.instanceStatuses.delete(instanceId);

  await instance.dispose();
  this.notify();
}
```

**可选成员先例**（`panel/types.ts:49-57`）：

```ts
export interface IEditorPanel extends IUndoable {
  /** 编辑器功能的标识符 */
  readonly id: string;

  /**
   * 获取此面板实例的显示标题，供外壳渲染标签时使用
   * @returns 面板实例的显示标题；返回 undefined（或未实现）时，外壳回退到面板类型名
   */
  getTitle?(): string | undefined;
```

**撤销系统的屏障语义（已实现，照用不重写）**（`packages/libs/editor-core/src/undo/undoSystem.ts:40-55`）：

```ts
async undo(): Promise<boolean> {
  const entry = this.undoStack[this.undoStack.length - 1];

  if (!entry) return false;

  if (entry.context.barrier === true) {
    this.forEachHook((hook) => hook.onUndoBlocked?.());
    return false;
  }

  await entry.undo.undo(entry.context);

  this.undoStack.pop();
  this.redoStack.push(entry);
  return true;
}
```

**落地要点（RESEARCH Pattern 7 / OQ 1 / A9）：**
- 钩子名与返回语义是**提案**；只能加在 `IEditorPanel` 上作为**可选**成员（照 `getTitle?()` 的写法与 JSDoc 风格）。
- `ShellSystem.closeTab` 调用前：若目标不是活动标签，先 `activateTab`（否则未保存对话框没有 DOM 可挂，
  Pitfall 11）；返回 `false` 立即返回、不 splice。
- `ShellSystem.closePanelInstance` / `dispose` / `unregisterPanelType` **不得**调用该钩子；
  `dispose` 里 `closePanelInstance` 循环（`shellSystem.ts:646-649`）尤其不能被用户对话框卡住。
- 钩子抛错时外壳记录日志并按「取消关闭」处理（数据安全优先）；面板实现内部自己 catch，不真的抛。
- 「无法撤销」提示**不在面板里弹**；由组合根订阅 `onUndoBlocked`（见 §14）。

**测试 analog**：`packages/libs/editor-core/src/shell/__tests__/shellSwitch.test.ts`（1-130）——手写
`SwitchPanel implements IEditorPanel` 记录调用次数；`createSystem()` 组装 `ResourceSystem` + `UndoSystem` +
`ShellSystem`；断言用 `await act(async () => …)`，`afterEach(cleanup)`。新的 `shellClose.test.ts` 照此结构，
再补一个 `onBeforeClose` 返回 `false` / `true` / 抛错的被测面板。

---

### 10. `TableGrid` 表单模式 — 就地改 `shared/schemaForm/components/TableGrid.tsx`

**当前 props（无表单模式开关）**（lines 50-83，节选）：

```ts
export interface ITableGridProps {
  /** 当前数据加载状态 */
  readonly status: TablePanelStatus;
  /** 要渲染的行树 */
  readonly rows: readonly ITableRowNode[];
  /** 错误态下「重试」控件的回调 */
  readonly onRetry?: () => void;
  /** 一次字段提交的回调 */
  readonly onChange?: TableGridChangeHandler;
  /** 当前目标是否为 schema（启用 schema 专用呈现模式与提示条） */
  readonly schemaMode?: boolean;
  /** 本栏是否有未落盘的改动；透传给工具栏显示「未保存」标记并启用「保存」 */
  readonly unsaved?: boolean;
  /** 保存本栏未落盘改动的回调 */
  readonly onSave?: () => void;
}
```

**工具栏是无条件构造的（改动点）**（lines 557-601，节选）：

```tsx
const toolbar = createElement(TableToolbar, {
  mode,
  onModeChange: setMode,
  title: props.title,
  showSchemaButton: !schemaMode && !failed,
  schemaButtonEnabled: capabilities.tablePanel !== undefined && !loading,
  // …
  onCloseColumn: props.onCloseColumn,
  closeButtonEnabled: props.onCloseColumn !== undefined && props.status !== TablePanelStatus.NoTarget,
  unsaved: props.unsaved,
  onSave: props.onSave,
});
const banner = schemaMode ? createElement(SchemaBanner, {}) : null;
const notice = renderNotice(props);

if (props.status !== TablePanelStatus.Ready) {
  return createElement('div', { className: 'etable', 'data-test-id': 'data-table' }, toolbar, banner, notice, renderState(props));
}

return createElement(
  'div',
  { className: 'etable', 'data-test-id': 'data-table' },
  toolbar,
  banner,
  notice,
  renderHeader(),
  createElement('div', { className: 'etable-body', 'data-test-id': 'data-table-grid' }, rows),
);
```

**落地要点：**
- 只加一个**可选**布尔（提案 `formMode`，待确认），默认 `false`；为真时 `toolbar = null`、`banner = null`，
  `renderRows` / `renderHeader` / 输入控件**一行不改**（D-15 / UI-SPEC F11）。
- 抽屉**不传** `onSave` / `onCloseColumn` / `onOpenSchema`；只传 `status` / `rows` / `onChange` / `onRetry` / `error`。
- 现有调用点不受影响（可选成员）；表格回归测试 `src/table/__tests__/*` 必须原样全绿。

**表单宿主复用先例**（`asset/components/AssetConfigView.tsx:35-79`，节选）：

```tsx
export function AssetConfigView(props: IAssetConfigViewProps): ReactElement {
  // 没有任何字段时落回表格引擎既有的空态；否则按就绪渲染行树
  const status = props.rows.length === 0 ? TablePanelStatus.EmptySchema : TablePanelStatus.Ready;

  return (
    <div className="asset-config-view" data-test-id="asset-config-view">
      {/* …面包屑 / 校验错误… */}
      <div className="asset-config-body">
        <TableGrid
          status={status}
          rows={props.rows}
          onChange={props.onChange}
          unsaved={props.unsaved}
          onSave={props.onSave}
          title={props.title}
        />
      </div>
    </div>
  );
}
```

> 地图属性抽屉照抄「status 映射 + TableGrid」这一段，但按 UI-SPEC 去掉 `unsaved` / `onSave`
> （地图只有一个保存入口），并补 `formMode`。

**`.etable` 的定位前提**（`shared/schemaForm/schemaForm.css:1-13`）：`position: absolute; inset: 0`。
抽屉正文必须 `position: relative` + 确定高度，否则表格塌陷（Pitfall 19）。

---

### 11. `MapPropertiesDrawer.tsx` — analog `AssetConfigView` + `TranscodeModal`

**antd 覆盖层的受控状态与忙碌禁用**（`asset/components/TranscodeModal.tsx:49-68`，节选）：

```tsx
export function TranscodeModal(props: ITranscodeModalProps): ReactElement {
  const names = props.entries.map((entry) => entry.name);
  const selectedState = useState<readonly string[]>(() => [...names]);
  // …
  const coverState = useState(true);
  const confirmingState = useState(false);
  // …
  const covering = confirmingState[0];
```

**照抄要点：**
- 属性抽屉的 `open` 由面板 Store 持有（不是抽屉内部 state）；抽屉内的表单值来自面板内存，
  **关闭抽屉不丢改动**（UI-SPEC §地图属性）。
- 状态映射：读取中 → `Loading`；无字段 → `EmptySchema`；失败 → `Error`；就绪 → `Ready`；
  `NoTarget` 不用（与 `AssetConfigView.tsx:37` 同款映射）。
- 字段提交 → `MapPanel` 的一条 Property 撤销记录 + 置脏；保存统一走工具栏。

---

### 12. `MapEmptyState.tsx` + `components/dialogs/` — analog 状态分支 / 受控弹窗

**空态分支（asset）**：见 §5 的 `AssetPanelView.tsx:153-194`；地图按 UI-SPEC 分四态
（清单加载 / 清单失败 / 无地图 / 有地图但未打开），**空态内联地图清单**，不是空白画布。

**内联列表 / 选择器（表格）**（`table/components/TableEmptyColumn.tsx:109-147`，节选）：

```tsx
function renderButtons(onModeChange: (mode: TableEmptyMode) => void): ReactElement {
  return createElement(
    'div',
    { className: 'etable-empty', 'data-test-id': 'table-empty' },
    createElement(
      'div',
      { className: 'etable-empty-actions' },
      createElement(
        Button,
        { size: 'middle', autoInsertSpace: false, 'data-test-id': 'table-empty-open', onClick: () => onModeChange(TableEmptyMode.Open) },
        '打开表格',
      ),
      // …新建 / 删除
    ),
  );
}
```

**破坏性二次确认（受控 Modal + 明确后果）**（`TableEmptyColumn.tsx:68-102`）：

```tsx
function renderDeleteModal(dataPath: string, onConfirm: () => void, onCancel: () => void): ReactElement {
  return createElement(
    Modal,
    {
      open: true,
      title: '删除表格',
      closable: false,
      maskClosable: false,
      keyboard: false,
      onCancel,
      footer: createElement(
        'div',
        { className: 'etable-empty-delete-footer' },
        createElement(Button, { size: 'small', autoInsertSpace: false, 'data-test-id': 'table-list-delete-cancel', onClick: onCancel }, '取消'),
        createElement(
          Button,
          { size: 'small', type: 'primary', danger: true, autoInsertSpace: false, 'data-test-id': 'table-list-delete-confirm', onClick: onConfirm },
          '删除',
        ),
      ),
    },
    `将删除 ${dataPath} 的数据与 schema 一对文件，且无法找回、不可撤销。是否继续？`,
  );
}
```

**照抄要点：**
- 四个弹窗全部是受控 `Modal`：`open` 来自 Store；提交中按钮禁用 + `Spin` +「正在创建…」；失败**不关闭**、
  行内显示宿主原因（UI-SPEC §新建地图 / §新增图层 / §保存与未保存）。
- 未保存确认的「放弃改动」按钮用 `danger`（UI-SPEC Destructive 清单）；默认焦点在「取消」。
- 文案逐字取 UI-SPEC §Copywriting，不在实现时另造。

---

### 13. `model/*`（纯函数）— analog 既有纯模型 + 旧编辑器工具

> 这一层的共同要求：**无 React、无 Pixi、无 `editor-core` 依赖**，输入输出纯数据；每个导出函数写 JSDoc（含 `@param`）；
> 函数之间空行；常量 `UPPER_SNAKE_CASE`。测试只测这一层就能覆盖绝大部分编辑语义。

#### 13.1 `geometry.ts` — analog `apps/editor/src/MapEditor/utils/brushGeometry.ts`

逐字见 §8 的 `walkOrthogonalPath`；同文件 `rectanglePositions`（lines 16-26）：

```ts
export function rectanglePositions(from: LocPOD, to: LocPOD): LocPOD[] {
  const x0 = Math.min(from[0], to[0]);
  const y0 = Math.min(from[1], to[1]);
  const x1 = Math.max(from[0], to[0]);
  const y1 = Math.max(from[1], to[1]);
  const result: LocPOD[] = [];
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) result.push([x, y]);
  }
  return result;
}
```

新实现把 `LocPOD` 换成本地 `IMapCellPosition`（`{x, y}` 或 `readonly [number, number]`，命名待确认），
并补矩形夹取 / 越界裁剪。

#### 13.2 `fill.ts` — analog `apps/editor/src/MapEditor/utils/fillBfs.ts:35-80`

```ts
export function fillModeBfs(
  array: MapData,
  startX: number,
  startY: number,
  maxWidth: number,
  maxHeight: number,
): LocPOD[] {
  const getNumber = (x: number, y: number): number | null => {
    if (x < 0 || y < 0 || x >= maxWidth || y >= maxHeight) return null;
    return getCellNumber(array[y][x]);
  };

  const targetNumber = getNumber(startX, startY) ?? 0;
  const visited = new Set<string>();
  const result: LocPOD[] = [];
  const queue: LocPOD[] = [[startX, startY]];
  // …四邻域 BFS
  return result;
}
```

新实现：入参改为 `cells: readonly (readonly number[])` + 起点，返回目标格；**不**在函数内定义局部函数
（项目代码风格），把 `getNumber` 提成模块级私有函数。

#### 13.3 `clipboard.ts` — analog `mapCommands.ts:245-263` + `438-473`

**复制（只取当前层数字）**（245-263）：

```ts
export function readMapInfo(floor: Record<string, unknown>, layer: MapLayer, rect: MapRect): CopiedMapInfo {
  const normalized = normalizeRect(rect);
  const data: CopiedMapCell[] = [];
  for (let y = normalized.y0; y <= normalized.y1; y += 1) {
    for (let x = normalized.x0; x <= normalized.x1; x += 1) {
      const pos = { x, y };
      data.push({ map: cloneDeep(readLayerCell(floor, layer, pos)), events: /* … */ {} });
    }
  }
  return { w: normalized.x1 - normalized.x0 + 1, h: normalized.y1 - normalized.y0 + 1, layer, data };
}
```

**粘贴（左上角锚点 + 越界跳过）**（455-461）：

```ts
for (let y = options.pos.y; y < options.pos.y + height; y++) {
  for (let x = options.pos.x; x < options.pos.x + width; x++) {
    const one = data[index++];
    if (!one || !isInsideLayer(layerMap, { x, y })) continue;

    const targetPos = { x, y };
    actions.push([ActionType.Change, layerPath(targetLayer, targetPos), one.map]);
  }
}
```

新实现只保留 `number[][]` 数据（无事件、无 `Action`），返回「目标格 + 值 + 被裁剪计数」以便提示
（UI-SPEC 粘贴提示要报裁剪格数）。

#### 13.4 `passability.ts` — analog `apps/editor/src/project/model/passability.ts:49-88`

```ts
function blocksDirection(
  blocks: readonly number[],
  registry: ReadonlyMap<number, RegistryBlockInfo>,
  field: 'cannotOut' | 'cannotIn',
  direction: MapDirection,
): boolean {
  const checkedDirection = field === 'cannotIn' ? OPPOSITE_DIRECTION[direction] : direction;
  return blocks.some((idnum) => {
    const block = registry.get(idnum) as (RegistryBlockInfo & Record<string, unknown>) | undefined;
    return directionList(block?.[field]).includes(checkedDirection);
  });
}
```

新的只读通行度只需要「拿图块目录的四方向布尔值 → 输出每个格子的不可通行方向列表」，不需要旧实现的多层
叠加 / `cannotMove` / 注册表查询。**保留**旧实现的输出形状思路（每格一组方向），**丢掉**引擎字段名。

#### 13.5 `renderModel.ts` — analog `MapPixiRenderer.tsx:398-438`

见 §8 的 `visibleCells` / `layerAlpha`。新模型输出 UI-SPEC 需要的全部内容：可见格、层序与 alpha、
网格线、框选矩形、预览格、悬停格、通行度标记（含大地图 <16px 用红点）。**只算数据，不碰 Pixi**。

#### 13.6 `recentTiles.ts` — analog `asset/model/assetList.ts:44-90`

```ts
export function readAssetList(category: IAssetCategory, document: unknown): readonly IAssetListEntry[] {
  if (category.listFormat === AssetListFormat.StringList) return readStringList(document);

  return readObjectList(category, document);
}

function readStringList(document: unknown): readonly IAssetListEntry[] {
  if (!Array.isArray(document)) throw new Error(INVALID_ASSET_LIST_MESSAGE);

  const entries: IAssetListEntry[] = [];
  document.forEach((element, index) => {
    const name = toAssetName(element);

    if (name !== null) entries.push({ name, index });
  });

  return entries;
}
```

**照抄要点：**「未知输入 → 过滤非法项 → 保序输出」的结构；最近使用列表还要：去重、上限截断、
过滤目录中不存在的编号（UI-SPEC partial 态）。

#### 13.7 `validation.ts` — analog `asset/model/assetPaths.ts`（测试见 13.8）

**风格参照**（`assetPaths.ts` 的 `sanitizeAssetFileName`，测试 `assetPaths.test.ts:30-77`）：校验函数返回
`sanitized | null` 或 `{ valid, error }`，不做 UI；名字类校验先 `trim`，再判空 / 重名 / 字符集。

#### 13.8 纯函数测试 — analog `asset/model/__tests__/assetPaths.test.ts` + `table/__tests__/validation.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { sanitizeAssetFileName } from '../assetPaths';

describe('sanitizeAssetFileName', () => {
  // 含路径分隔符的名字被拒绝（防路径穿越）
  it('拒绝含分隔符的名字', () => {
    expect(sanitizeAssetFileName('a/b.png')).toBeNull();
    expect(sanitizeAssetFileName('a\\b.png')).toBeNull();
  });
});
```

**约定：** 每个 `it` 之前用**单行 `//` 注释**说明覆盖点（项目代码风格明确要求）；`describe` 按导出函数分组；
断言用 `toEqual` / `toBe` 直接比对返回值；不挂 React、不建 DOM。

---

### 14. 资源读取 / 写入 — analog `assetPanel.loadBytes` + `useAssetObjectUrl` + `jsonc`

**按路径取字节，失败一律折叠成 `undefined`**（`assetPanel.ts:301-311`）：

```ts
loadBytes: async (path: string): Promise<Uint8Array | undefined> => {
  const resource = await this.context.requestResource(path);

  if (resource === null) return undefined;

  try {
    return await resource.requestBinary();
  } catch {
    return undefined;
  }
},
```

**blob URL 生命周期（可整体照抄为地图自己的同形 hook）**（`useAssetObjectUrl.ts` 全文，节选）：

```ts
useEffect(() => {
  let cancelled = false;
  let created: string | undefined;

  setUrl(undefined);

  void latest
    .current()
    .then((bytes) => {
      if (cancelled || bytes === undefined) return;

      const next = URL.createObjectURL(new Blob([bytes.slice()], { type: mime }));

      if (cancelled) {
        URL.revokeObjectURL(next);
        return;
      }

      created = next;
      setUrl(next);
    })
    .catch(() => undefined);

  return (): void => {
    cancelled = true;

    if (created !== undefined) URL.revokeObjectURL(created);
  };
}, [mime, byteVersion, setUrl]);
```

**偏好文件读 / 写（`.jsonc` codec）**（`shared/jsonc/tableText.ts:83-114`）：

```ts
export function parseTableText(text: string): ITableTextParseResult {
  const whole = attemptStrict(text);

  if (whole.ok) return { status: TableTextParseStatus.Conforming, prefix: '', value: whole.value };

  const markerIndex = text.indexOf(SYSTEM_PREFIX_END_MARKER);
  // …标记行拆分 → 严格解析 → JSON5 宽松回退
}

export function serializeTableText(value: unknown, prefix: string): string {
  const body = JSON.stringify(value, null, 2) ?? '';

  return prefix.length === 0 ? body : `${prefix}${body}`;
}
```

**写回资源两种分支**（`assetPanel.ts:1216-1227`，节选）：

```ts
const resource = await this.context.requestResource(category.listPath);
if (resource === null) await this.context.createResource(category.listPath, text);
else await resource.write(text);
```

**路径安全（防御性，面板侧也要做）**（`memoryBackend.ts:249-257`）：

```ts
private assertInBounds(path: string): void {
  const segments = normalizeDirectory(path).split('/');

  if (segments.includes('..')) throw new Error(`memory backend: path escapes project root: ${path}`);
}
```

**照抄要点：**
- `asset` / `map` 能力**不能互相 import**（`.dependencyCruiser.cjs:53-62`）。`useAssetObjectUrl` 只能在
  `map/components` 自持一份同形 hook（或经用户同意后抽到 `shared/`），**不要**写
  `import { useAssetObjectUrl } from '../asset'`。
- 图块图片 / 最近使用文件都经 `IEditorPanelContext`；面板永不 import `editor-core/fs`，也不碰真实文件系统。
- 最近使用读取失败静默降级、不阻断绘制（RESEARCH Pattern 7）；图块图片失败只影响该图块 / 该分组。

---

### 15. `__tests__/fixtures.ts` — analog `asset/__tests__/fixtures.ts`

**Analog:** `packages/libs/editor-impl/src/asset/__tests__/fixtures.ts`（113-298）

```ts
export class FakeFileSystem implements IEditorFileSystem {
  /** 路径到文件内容的映射：文本为 string，二进制为 Uint8Array */
  private readonly content: Map<string, string | Uint8Array> = new Map();
  /** 显式创建的目录路径集合（空目录不在内容映射中体现） */
  private readonly directories: Set<string> = new Set();
  /** 读取 / 写入时应抛错的路径集合 */
  readonly failing: Set<string> = new Set();
  /** 读取 / 写入时应永久挂起的路径集合 */
  readonly hanging: Set<string> = new Set();

  seed(path: string, content: string | Uint8Array): void {
    this.assertInBounds(path);
    this.content.set(path, content);
    this.registerParents(path);
  }

  async readFile(path: string): Promise<string> {
    const value = await this.read(path);

    if (typeof value !== 'string') throw new Error(`fake fs: not a text file: ${path}`);

    return value;
  }
  // …
  private assertInBounds(path: string): void {
    const segments = normalizeDirectory(path).split('/');

    if (segments.includes('..')) throw new Error(`fake fs: path escapes project root: ${path}`);
  }
}

export async function createAssetHarness(fs: FakeFileSystem, maxUndoStep: number = 100): Promise<EditorCore> {
  const core = new EditorCore();

  await core.initialize({ fs, maxUndoStep });
  return core;
}
```

**照抄要点：**
- 注释头说明「与表格 / 素材的替身同形，但按能力互不依赖门禁**自持一份**」（facts 第 5-6 行）。
- `failing` / `hanging` 两个开关是现有测试表达「读取失败 / 请求挂起」的统一手段，地图的加载 / 保存失败
  用例直接复用这个设计。
- `createMapHarness` 改名，其余结构照抄；再补地图文档 / 图块目录 / 属性 Schema 夹具。

---

### 16. 面板 / 保存 / 撤销测试 — analog `table/__tests__/manualSave.uat.test.tsx`

**Analog:** `packages/libs/editor-impl/src/table/__tests__/manualSave.uat.test.tsx`（1-110）

```tsx
import { act, cleanup, configure, fireEvent, render, screen } from '@testing-library/react';
import { EditorCore, IEditorPanel, IEditorPanelFactoryParam } from '@motajs/editor-core';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deriveSchemaPath, TablePanel, tablePanelType } from '..';
import { createTableHarness, FakeFileSystem } from './fixtures';

configure({ testIdAttribute: 'data-test-id' });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function openTablePanel(system: EditorCore, created: TablePanel[]): Promise<TablePanel> {
  system.shellSystem.registerPanelType({ /* …包一层把实例收集到数组… */ });

  const tabId = system.shellSystem.listTabs()[0].id;

  await act(async () => {
    await system.shellSystem.openPanelInTab(tabId, tablePanelType.id);
  });

  return created[0];
}
```

**约定：**
- `configure({ testIdAttribute: 'data-test-id' })`；`afterEach(cleanup)` + `vi.restoreAllMocks()`。
- 注册面板类型时**包一层 `create`** 捕获实例，后续直接对实例断言 / 调方法（
  `manualSave.uat.test.tsx:28-47`）。
- 用 `EditorCore` + `FakeFileSystem` 跑集成；需要看宿主写回时直接 `system.resourceSystem.readContent(path)`。
- `URL.createObjectURL` 打桩先例（`editor-dev/src/__tests__/devHostAsset.test.tsx:24-27`）：

```ts
Object.defineProperty(URL, 'createObjectURL', { value: vi.fn((): string => 'blob:test'), configurable: true });
Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });
```

- Pixi 不在 jsdom 里挂：视图测试 `vi.mock('./MapSurface')`；渲染语义只测 `model/renderModel.ts`
  （对照旧编辑器只测纯函数的做法：`apps/editor/src/MapEditor/rendering/__tests__/defaultGround.test.ts`）。
- `ResizeObserver` / `Map.getOrInsert` 已由 `src/__tests__/mapPolyfill.ts`（1-61，`vitest.config.ts:23`
  的 `setupFiles`）全局补桩，不需要在 map 测试里重复装；地图若要可控宽度，自己注入尺寸而非依赖真实布局。

---

### 17. `editor-dev` 注册与演示数据 — analog `demo/assetDemo.ts`

**注册 + 撤销屏障提示（可整体照抄形态）**（`assetDemo.ts:631-645`）：

```ts
export function registerAssetDemo(core: EditorCore): IAssetEditorCapabilities {
  core.shellSystem.registerPanelType(createAssetPanelType({ categories: ASSET_DEMO_CATEGORIES }));
  core.undoSystem.addHook({
    onUndoBlocked: (): void => {
      message.error(UNDO_BLOCKED_MESSAGE);
    },
  });

  return { categories: ASSET_DEMO_CATEGORIES };
}
```

**演示文件表 + seed**（`assetDemo.ts:617-629`）：

```ts
export async function seedAssetDemo(backend: IMemoryBackend, largeSize?: IAssetDemoLargeSize): Promise<void> {
  const width = largeSize !== undefined ? largeSize.width : DEMO_LARGE_TEXTURE_WIDTH;
  const height = largeSize !== undefined ? largeSize.height : DEMO_LARGE_TEXTURE_HEIGHT;

  for (const file of ASSET_DEMO_FILES) backend.seed(file.path, file.content);

  for (const file of await createLargeAssetDemoFiles(width, height)) backend.seed(file.path, file.content);
}
```

**组合根装配顺序**（`packages/apps/editor-dev/src/main.tsx:27-54`）：

```tsx
const core = new EditorCore();
const backend = new MemoryBackend();

backend.seed(DEMO_SAMPLE_PATH, DEMO_SAMPLE_CONTENT);
// …逐个 seed
await seedAssetDemo(backend);
core.shellSystem.registerPanelType(DEMO_PANEL_TYPE);
core.shellSystem.registerPanelType(tablePanelType);
registerDevMenu(core);
registerAssetDemo(core);

await core.initialize({ fs: backend, maxUndoStep: backend.maxUndoStep, ignore: ['node_modules', '.git'] });

createRoot(document.getElementById('root')!).render(
  createElement(AssetCapabilityProvider, { /* … */ }),
);
```

**照抄要点：**
- 能力包**只导出**面板类型对象 / 工厂；`main.tsx` 负责 `registerPanelType`、seed、注入。
- 地图 demo 需要：2 张地图（一张小于视口、一张大于视口）、≥2 图块分组（含 1 个缺图图块）、
  属性 Schema ≥2 字段（string + number）、最近使用文件路径（UI-SPEC §开发宿主接入）。
- `registerMapDemo(core)` 也应顺带订阅 `onUndoBlocked`（若素材 demo 已订阅同一条，注意不要重复提示；
  规划时决定复用还是各自注册）。
- 宿主适配器（提案 `backend/mapFiles.ts`）无同形先例：照 `memoryBackend.ts` 的路径拒绝规则，以及
  `assetDemo.ts` 的「常量表 + 数据构造函数」组织方式；保存写回时必须保留事件与额外字段（RESEARCH A14）。

---

## Shared Patterns

### S1. 能力注入只经工厂闭包（不 import 宿主、不自装配）

- 来源：`packages/libs/editor-impl/src/asset/assetPanelType.ts:7-8,54-76`
- 适用于：`mapPanelType.ts`、`mapDemo.ts`、`main.tsx`
- 反例：`export function install(core: EditorCore)`；把能力塞进 React Context 给数据层读。

### S2. 手动保存 + 基线脏状态

- 来源：`assetPanel.ts:489-503`（只提交有改动的域）+ `tablePanel.ts:683-703`（保存后清脏 / 发「已保存」）
- 适用于：`mapPanel.ts`、`MapToolbar.tsx`、`MapPropertiesDrawer.tsx`、`mapSave.test.tsx`
- 地图差异：脏 = 「当前内存 vs 最近一次快照」比较（`model/dirty.ts`），保存成功只把**发出的快照**设为基线；
  撤销 / 重做后重算（Pitfall 8-9）。切换地图 / 新建 / 新增图层 / 关闭标签前按 UI-SPEC 询问。

### S3. 统一撤销：一条记录 + 屏障

- 来源：`packages/libs/editor-core/src/undo/types.ts:3-10`、`undoSystem.ts:28-67`
- 适用于：`mapPanel.ts`（`MapPanel.undo` / `MapPanel.redo`）、`model/document.ts`
- 规则：一笔 / 一次粘贴 / 一次清空 / 一个属性字段 = 一条；宿主侧新建 / 加层 / 切图 / 放弃 = `barrier: true`；
  撤销前校验载荷里的 `mapId` 与当前地图一致（Pitfall 10）；「无法撤销」由组合根 `onUndoBlocked` 提示。

### S4. 资源层是唯一 I/O 通道

- 来源：`panel/types.ts:5-47`、`resource/types.ts:19-40`、`assetPanel.ts:301-311`
- 适用于：`mapPanel.ts`、`MapPalette.tsx`、`useMapObjectUrl`（同形 hook）
- 规则：地图 / 图块字节 / 最近使用文件全部 `requestResource` → `request()` / `requestBinary()`；
  新建用 `createResource`；路径先拒绝绝对路径与 `..`。

### S5. 视图状态：一个 Store + `publish`

- 来源：`assetPanel.ts:220-221,268-300,1148-1170`
- 适用于：`mapPanel.ts`、`MapPanelView.tsx`
- 规则：业务状态（文档 / 图层 / 选区 / 剪贴板 / 脏 / 保存 / 对话框）进 Store；**hover / 拖动预览 / 菜单位置**
  不进 Store（Pitfall 7），放画布本地 state；操作结果用 `antd message`，不塞 Store。

### S6. 错误隔离 + 中文文案

- 来源：`assetPanel.ts:443-486`（加载失败落错误态）、`tablePanel.ts:1444-1458`（写入失败落 `publishError`）
- 适用于：`mapPanel.ts` 的 open / save / create / addLayer / properties；所有视图错误态
- 规则：只在行为关键路径写 `try/catch`（读 / 写 / 宿主回调）；失败保留脏标记与内存改动；
  文案逐字取 UI-SPEC；宿主错误按纯文本渲染，**禁止** `dangerouslySetInnerHTML`。

### S7. antd + 局部 CSS + 内联 SVG

- 来源：`asset/asset.css:1-60`、`AssetToolbar.tsx:46-95`、`assetPanelType.ts:17-39`
- 适用于：所有 `map/components/*` 与 `map.css`
- 规则：不引入 PandaCSS / Tailwind / 图标库；样式只消费 `--editor-*`（带 fallback）与 `--emap-*`；
  图形 16px `currentColor` 内联 SVG。

### S8. 引擎中立 + 模块状态门禁

- 来源：`scripts/verify/coreEngineNeutral.js:42-58`、`scripts/verify/coreModuleState.js:46-59`、`.dependencyCruiser.cjs:53-62`
- 适用于：`editor-impl/src/map/**` 全部文件（含注释、CSS 类名、测试标识）
- 规则：中立词表 `map / layer / cell / position / tileNumber / tileGroup / tileCatalog / passability / direction`；
  缓存放实例 / `useRef`；常量容器用 `Object.freeze` / `as const`；模块里不出现 `document` / `fetch` / `localStorage`。

### S9. 测试约定

- 来源：见 §15 / §16
- 适用于：`src/map/__tests__/**`
- 规则：`FakeFileSystem` 自持一份；`configure({ testIdAttribute: 'data-test-id' })`；`afterEach(cleanup)`；
  纯逻辑与视图分开；每个 `it` 前一行 `//` 说明；Pixi 用 mock 不进 jsdom；`URL.createObjectURL` 打桩。

### S10. 命名先确认

- 来源：`AGENTS.md` §Project Rules（重要命名先确认）+ `.planning/phases/04-map/04-RESEARCH.md` §Naming Proposals
- 适用于：本文件所有提案名、`INTERFACE-NAME.md`、PLAN.md、实现
- 规则：文件名 / 接口名 / 方法名 / 字段名 / 导出符号 / CSS 类名 / `data-test-id` 一律先写入
  `.planning/phases/04-map/INTERFACE-NAME.md`（每 Plan 一节、说明用途），经用户确认后才可落进代码。

---

## No Analog Found

| File（提案） | Role | Data Flow | Reason / 规划建议 |
|---|---|---|---|
| `src/map/model/dirty.ts` | model | transform | 现有能力用布尔 `unsaved`，没有「基线快照比较」的先例。可借 `es-toolkit` 的 `isEqual`（旧编辑器 `prefabCommands.ts:7,114` 已这样用）；按 RESEARCH Pattern 3 自行实现，并在测试里覆盖「保存期间编辑」「撤销回已保存态」两种情形。 |
| `src/map/components/MapStatusBar.tsx` | component | request-response | 旧编辑器没有独立状态条的等价物（坐标散在画布 / 提示里）。按 UI-SPEC §画布结构 + `asset.css` 的 muted label 写法新写；无逻辑，纯展示，测试只断言文本。 |
| `src/map/__tests__/pixiMock.ts` | test | — | 旧渲染器从不挂载进 jsdom（只测纯函数）。用 `vi.mock('./MapSurface')` 或一个 props 断言 stub；不要在 vitest 里初始化 WebGL。 |
| `packages/apps/editor-dev/src/backend/mapFiles.ts` | service | transform | 仓库内没有「引擎格式 ↔ 中立文档」的适配器先例（旧编辑器直接把引擎数据给 UI）。组织方式参照 `assetDemo.ts`（常量表 + 纯构造函数 + seed），路径安全参照 `memoryBackend.ts:249-257`；保存必须保留事件 / 额外字段（A14）。 |
| `src/map/model/document.ts` 的「不可变 diff 应用」部分 | model | transform | 没有同形的不可变格子更新先例。`isMapDocumentValid` / `applyCellChanges` 按 RESEARCH §Code Examples 1 的形状实现；只复制被触及的行 + 层数组，不整图复制。 |

> 另外三处**部分匹配、需明确偏离**的项已在正文标注：`MapSurface` 的模块级缓存必须改为实例字段；
> `MapCanvas` 的 window/document 监听必须改挂画布；`MapPropertiesDrawer` 复用 `TableGrid` 时必须先加
> `formMode`（否则工具栏会带出「保存 / 编辑 Schema / 代码」等无关动作）。

---

## Metadata

**Analog search scope:** `packages/libs/editor-impl/src`（asset / table / shared / `__tests__`）、
`packages/libs/editor-core/src`（panel / undo / resource / shell + 测试）、
`packages/apps/editor-dev/src`（backend / demo / tests）、
`packages/apps/editor/src/MapEditor/**` 与 `src/project/{commands,model}`（仅作行为参考）、
`scripts/verify/*`、`.dependencyCruiser.cjs`。

**Files scanned:** 约 45 个源文件 + 6 个门禁脚本（逐文件读取并引用行号）；所有被引用 analog 均已用
`git ls-files -- <path>` 验证为 **git 跟踪的源码**，无安装 / 运行时镜像路径。

**Pattern extraction date:** 2026-10-20
**Downstream:** 供 `gsd-planner` 写 `04-*-PLAN.md` 时按 §Pattern Assignments 指定 analog 与行号；
所有新名字仍须先过 `INTERFACE-NAME.md` 确认。
