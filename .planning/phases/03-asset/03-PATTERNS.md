# Phase 3: 素材管理 (asset) - Pattern Map

**Mapped:** 2026-10-17
**Files analyzed:** ~30 (new + modified, grouped by role)
**Analogs found:** 24 / 30 (6 have no codebase analog — see §No Analog Found)

> **How to read this file.** For each new/modified file this lists the closest **existing, git-tracked** source in the repo, plus concrete excerpts (path + line numbers) the planner can paste into plan actions. Every analog path below was checked with `git ls-files` (non-empty = tracked source). **No gitignored install/runtime mirror paths are named.**
>
> **Project code-style overrides apply** (AGENTS.md §Project Rules, which覆盖 the GSD defaults): **no `import type`** (enforced by `scripts/verify/coreImportType.js`), classes declare an `interface` and `implements` it, `type` aliases get jsDoc but classes/interfaces/enums do not, methods get逐参 jsDoc, barrels are `export *`, no file-header comments before imports. Read §Shared Patterns §Code-style contract before writing plan excerpts.

---

## File Classification

Grouped by role; each row is one file or one tight file-family with a shared analog.

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/libs/editor-impl/src/shared/jsonc/index.ts` (moved `tableText.ts`) | utility | transform | `packages/libs/editor-impl/src/table/model/tableText.ts` | exact (move) |
| `packages/libs/editor-impl/src/shared/schemaForm/**` (`TableGrid`, `TableRow`, `inputs/*`, `model/*`) | component + model | transform / request-response | `packages/libs/editor-impl/src/table/components/TableGrid.tsx`, `table/model/*` | exact (move) |
| `packages/libs/editor-impl/src/shared/index.ts` | barrel | — | `packages/libs/editor-impl/src/table/model/index.ts` | exact |
| `packages/libs/editor-impl/src/asset/index.ts` | barrel | — | `packages/libs/editor-impl/src/table/index.ts` | exact |
| `packages/libs/editor-impl/src/asset/assetPanelType.ts` | provider | request-response | `packages/libs/editor-impl/src/table/tablePanelType.ts` | exact |
| `packages/libs/editor-impl/src/asset/assetPanel.ts` | controller (panel) | CRUD / file-I/O | `packages/libs/editor-impl/src/table/tablePanel.ts` | role-match |
| `packages/libs/editor-impl/src/asset/types.ts` | types | — | `packages/libs/editor-impl/src/table/types.ts` | role-match |
| `packages/libs/editor-impl/src/asset/model/**` (list decode/encode, schema resolution, defaults merge) | model | transform | `packages/libs/editor-impl/src/table/model/tableText.ts`, `resourceType.ts` | role-match |
| `packages/libs/editor-impl/src/asset/components/AssetToolbar.tsx` | component | request-response | `packages/libs/editor-impl/src/table/components/TableToolbar.tsx`, `ActionButtons.tsx` | role-match |
| `packages/libs/editor-impl/src/asset/components/CategoryNav.tsx` | component | request-response | `packages/apps/editor/src/Workbench/ResourcesWorkspace/index.tsx` (`.resourceNavigation`) | role-match |
| `packages/libs/editor-impl/src/asset/components/AssetGrid.tsx` | component | list-collection | `packages/apps/editor/src/Workbench/ResourcesWorkspace/index.tsx` (`.resourceGrid`) | role-match |
| `packages/libs/editor-impl/src/asset/components/AssetDetail.tsx` | component | request-response | `packages/apps/editor/src/Workbench/ResourcesWorkspace/index.tsx` (`ResourceDetail`) | role-match |
| `packages/libs/editor-impl/src/asset/components/TranscodeModal.tsx` | component | batch / file-I-O | `packages/libs/editor-impl/src/table/components/TableEmptyColumn.tsx` (delete modal) + `react/components/MultiSelectModal.tsx` | role-match |
| `packages/libs/editor-impl/src/asset/picker/**` | component | request-response | `packages/libs/editor-impl/src/react/components/MultiSelectModal.tsx` | role-match |
| `packages/libs/editor-impl/src/asset/asset.css` | config/style | — | `packages/libs/editor-impl/src/table/table.css` | role-match |
| `packages/libs/editor-impl/src/react/capabilities.ts` (modify — add asset capability) | config/interface | — | itself (`ITableEditorCapabilities`) | exact |
| `packages/libs/editor-impl/src/react/types.ts` (modify) | types | — | itself (`IMultiSelectItem`) | exact |
| `packages/libs/editor-core/src/undo/types.ts` + `undoSystem.ts` (modify) | service/controller | event-driven | itself (existing `UndoEntry`/`undo()`) | exact |
| `packages/libs/editor-impl/src/table/**` (modify — re-point imports to `shared/**`) | refactor | — | itself | exact |
| `packages/apps/editor-dev/src/main.tsx` + `demo/assetDemo.ts` + `backend/**` (modify/add) | composition root | request-response | `packages/apps/editor-dev/src/main.tsx`, `demo/tableDemo.ts`, `backend/memoryBackend.ts` | exact |
| `packages/libs/editor-impl/package.json` + `pnpm-workspace.yaml` (modify — `mediabunny`) | config | — | existing `dependencies` block / catalog lines | exact |
| `packages/libs/editor-impl/src/shared/jsonc/__tests__/**` | test | — | `packages/libs/editor-impl/src/table/__tests__/tableText.test.ts` | exact |
| `packages/libs/editor-impl/src/asset/__tests__/**` (fixtures + panel/lifecycle/undo/transcode/picker/uat) | test | — | `packages/libs/editor-impl/src/table/__tests__/fixtures.ts`, `*.uat.test.tsx` | exact |
| `packages/libs/editor-core/src/undo/__tests__/undoSystem.test.ts` (extend) | test | — | itself | exact |
| `packages/libs/editor-impl/src/asset/schemas/**` (built-in schema sets) | config/data | — | **none** | no analog |
| `packages/libs/editor-impl/src/asset/transcode/**` (image→WebP, audio→Opus) | service | transform / file-I/O | **none** | no analog |

---

## Pattern Assignments

### `packages/libs/editor-impl/src/asset/assetPanelType.ts` (provider, request-response)

**Analog:** `packages/libs/editor-impl/src/table/tablePanelType.ts`

A panel type is a frozen object with `{ id, name, icon, create }`; the icon is an inline SVG `ReactNode` built with `createElement` (no icon library — `editor-impl` does not declare one). `create` constructs the panel and, if an open-param target is present, narrows it through a type guard before applying.

**Imports + frozen type object** (lines 1-5, 45-61):
```typescript
import { IEditorPanelFactoryParam, IEditorPanelType } from '@motajs/editor-core';
import { createElement, ReactNode } from 'react';

export const tablePanelType: IEditorPanelType = Object.freeze({
  id: 'table',
  name: '表格面板',
  icon: createTableIcon(),
  create: (param: IEditorPanelFactoryParam): TablePanel => {
    const panel = new TablePanel(param);
    const openParam = param.openParam;
    if (openParam !== undefined) {
      const target = openParam.target;
      if (isTablePanelTarget(target)) panel.setTable(target);
    }
    return panel;
  },
});
```

**Inline SVG icon** (lines 10-31): `createElement('svg', { width:16, height:16, viewBox:'0 0 16 16', 'aria-hidden':true }, ...)` with `stroke:'currentColor'`. New `assetPanelType` copies this shape (`id: 'asset'`, name「素材面板」, its own icon).

**Opaque open-param guard** (lines 34-43):
```typescript
function isTablePanelTarget(value: unknown): value is ITablePanelTarget {
  if (typeof value !== 'object' || value === null) return false;
  if (!('dataPath' in value)) return false;
  return typeof value.dataPath === 'string';
}
```

> Naming note: `assetPanelType` and the panel id/name are subject to `INTERFACE-NAME.md` confirmation (UI-SPEC F3).

---

### `packages/libs/editor-impl/src/asset/assetPanel.ts` (controller, CRUD / file-I/O)

**Analog:** `packages/libs/editor-impl/src/table/tablePanel.ts` (1753 lines — excerpts below are targeted, non-overlapping)

This is the highest-value analog: a capability panel class `implements IEditorPanel` (+ its own public interface). It holds per-view state in a TanStack `Store`, reads/writes through `IEditorPanelContext`, and re-requests resources in `onSwitchIn`.

**Imports** (lines 1-37): note the mixed pattern — `Store`/`useStore` from `@tanstack/store` / `@tanstack/react-store`, `Button, Modal` from `antd`, core types from `@motajs/editor-core`, helpers from `es-toolkit/compat`, React factory functions, and relative imports to its own `types`/`components`/`model`. **No `import type` anywhere** (coreImportType gate):
```typescript
import { Store } from '@tanstack/store';
import { useStore } from '@tanstack/react-store';
import { Button, Modal } from 'antd';
import {
  EditorEntryKind,
  IEditorPanel,
  IEditorPanelContext,
  IEditorPanelFactoryParam,
  IFileEntry,
  IUndoContext,
} from '@motajs/editor-core';
import { get } from 'es-toolkit/compat';
import { createElement, FC, ReactElement, useCallback, useEffect, useRef, useState } from 'react';
```

**Class declaration + lifecycle** (lines 555-662) — copy this panel skeleton (`id`, `context`, cached `component`, `initialize`/`dispose`/`render`/`getTitle`/`onFocus`/`onBlur`/`onSwitchIn`/`onSwitchOut`/`onUpdateResource`/`undo`/`redo`):
```typescript
export class TablePanel implements IEditorPanel, ITablePanel {
  readonly id: string;
  private readonly context: IEditorPanelContext;
  private readonly component: FC;

  constructor(param: IEditorPanelFactoryParam) {
    this.id = param.instanceId;
    this.context = param.context;
    this.component = () => createElement(TablePanelView, { /* callbacks → this.xxx */ });
  }

  async initialize(): Promise<void> {}
  async dispose(): Promise<void> { await this.saveDirtyColumns(); }
  render(): FC { return this.component; }

  async onSwitchIn(): Promise<void> {
    const count = this.columns.length;
    for (let index = 0; index < count; index += 1) await this.refresh(index);
    this.refreshAwaitingPickers();
  }

  async onSwitchOut(): Promise<void> { await this.saveDirtyColumns(); }
  async onUpdateResource(): Promise<void> { this.refreshAwaitingPickers(); }

  async undo(context: IUndoContext<unknown>): Promise<void> { await this.applyUndoRedo(context, true); }
  async redo(context: IUndoContext<unknown>): Promise<void> { await this.applyUndoRedo(context, false); }
}
```

**Title by state** (lines 616-632): `getTitle()` returns `undefined` when nothing is loaded (shell falls back to the type name), else a string. Asset panel uses this for「素材 <分类名>」.

**Read a resource's text (path-addressed)** (lines 1163-1179) — the canonical resource-layer read; AssetPanel reads `.list.jsonc` text the same way:
```typescript
private async readText(path: string): Promise<string | undefined> {
  const resource = await this.context.requestResource(path);
  if (resource === null) return undefined;
  const content = await resource.request();
  if (content === undefined) return undefined;
  if (typeof content === 'string') return content;
  return new TextDecoder().decode(content);
}
```

**Existence check via directory listing** (lines 1181-1196) — resource reads can't distinguish "missing" from "read failed"; asset's「文件已登记，但工程目录中不存在」uses the same technique over `listDirectory`:
```typescript
private async fileExists(path: string): Promise<boolean> {
  const slash = path.lastIndexOf('/');
  const directory = slash === -1 ? '' : path.slice(0, slash);
  const entries = await this.context.listDirectory(directory);
  return entries.some((entry) => entry.path === path);
}
```

**List a directory with stale-request tokens** (lines 824-851) — AssetPanel's category listing copies this `token` guard:
```typescript
private async refreshPicker(columnIndex: number): Promise<void> {
  const column = this.columnAt(columnIndex);
  const token = column.pickerToken + 1;
  column.pickerToken = token;
  try {
    const entries = await this.context.listDirectory(column.directory);
    if (column.pickerToken !== token) return;
    column.entries = entries;
    column.pickerError = undefined;
    this.publish(columnIndex, TablePanelStatus.NoTarget, []);
  } catch {
    if (column.pickerToken !== token) return;
    column.entries = [];
    column.pickerError = '目录读取失败，请重试。';
    this.publish(columnIndex, TablePanelStatus.NoTarget, []);
  }
}
```

**Create / delete resources** (lines 784-822) — AssetPanel's新增/删除 use the analogous core calls (bytes file + list entry, not data+schema):
```typescript
// create a pair, then open it
await this.context.createResource(dataPath, INITIAL_TABLE_DATA_TEXT);
await this.context.createResource(schemaPath, INITIAL_TABLE_SCHEMA_TEXT);
// delete a pair — not undoable (D-13); confirmation is done by the empty-state control
await this.context.deleteResource(dataPath);
await this.context.deleteResource(deriveSchemaPath(dataPath));
```

**Manual save (write only when dirty, prefix-preserving)** (lines 683-703, 1434-1446) — the asset「保存」button reuses this exact guard/serialize discipline:
```typescript
async save(columnIndex: number = 0): Promise<void> {
  const column = this.columnAt(columnIndex);
  const target = column.target;
  if (target === null) return;
  if (!column.unsaved && !column.unsavedSchema) return;   // no-op when clean

  if (wroteData && !(await this.persist(columnIndex, column.data))) return;
  ...
  this.publish(columnIndex, column.store.state.status, column.store.state.rows, '已保存');
}

private async writeData(columnIndex: number, data: unknown): Promise<void> {
  const resource = await this.context.requestResource(target.dataPath);
  if (resource === null) return;
  await resource.write(serializeTableText(data, prefix));   // never JSON.stringify directly
}
```

**Refresh guard — do not re-read over unsaved in-memory edits** (lines 1668-1684) — put this verbatim in AssetPanel's list refresh (Pitfall 5):
```typescript
// 该栏有未落盘改动时不重读覆盖内存，保住手动保存下的内存改动（T-02.1-20-01）
if (column.unsaved || column.unsavedSchema) return;
```

**Undo registration for a config edit** (lines 949-971) — asset per-material config edits go through this same `context.addUndoContext(this, { type, data })` path (`parseTableText`/`setByFieldPath` come from `shared/` after the extraction):
```typescript
const previousValue = this.readField(columnIndex, key);
const next = setByFieldPath(column.data, key, value);
column.unsaved = true;
this.context.addUndoContext(this, {
  type: TableUndoType.Change,
  data: { columnIndex, path: key, previousValue, nextValue: value },
});
this.applyData(columnIndex, next);
```

**Error isolation** (lines 1448-1462): reads/writes are wrapped so a failure becomes a per-panel error state, never throws through:
```typescript
private async persist(columnIndex: number, data: unknown): Promise<boolean> {
  try { await this.writeData(columnIndex, data); return true; }
  catch { this.publishError(columnIndex, '写入失败，请重试。'); return false; }
}
```

**View state** (lines ~1120-1148): each view holds `new Store<ITablePanelViewState>({ status, rows, ... })`; the React view subscribes with `useStore`. AssetPanel replaces `rows` with `{ status, entries, selectedPath, ... }`.

---

### `packages/libs/editor-impl/src/asset/types.ts` (types)

**Analog:** `packages/libs/editor-impl/src/table/types.ts`

Copy the file's shape: `const enum` for closed sets (UPPER_SNAKE members here because `editor-impl` is not `erasableSyntaxOnly` — unlike the editor app), a `type` alias with jsDoc for the action tuple, and `interface` contracts with per-member jsDoc.

**Enum + interface conventions** (lines 6-101):
```typescript
export const enum TableEmptyMode {
  /** 空栏初始态：显示「打开表格 / 新建表格 / 删除表格」三个按钮 */
  Buttons,
  /** 内联展示打开表格组件 */
  Open,
  ...
}

export interface ITablePanel {
  setTable(target: ITablePanelTarget, columnIndex?: number): void;
  save?(columnIndex?: number): Promise<void>;
}

export interface ITablePanelParam extends Record<string, unknown> {
  readonly columnWidth?: number;
}
```
Asset equivalents: `AssetCategoryKind` (Image/Audio/Animation/Font), `IAssetPanel` (`save?(): Promise<void>`), `IAssetPanelParam extends Record<string, unknown>`.

---

### `packages/libs/editor-impl/src/asset/model/**` (model, transform)

**Analogs:** `packages/libs/editor-impl/src/table/model/tableText.ts`, `packages/libs/editor-impl/src/table/resourceType.ts`

- `.jsonc` list decode/encode: after extraction, import `parseTableText` / `serializeTableText` from `../shared/jsonc` (see §Shared Patterns → JSONC codec).
- Path-convention helpers: mirror `resourceType.ts`'s pure-string derivation style (no fs access; out-of-bounds is the injected fs's job):

**Pure path derivation pattern** (`resourceType.ts` lines 1-35):
```typescript
// 表格的路径约定：数据文件为 `xxx.json` / `xxx.jsonc`，schema 文件为 `xxx.schema.json` / ...
// 本模块只做纯字符串推导，越界由注入的文件系统负责。
export function deriveSchemaPath(dataPath: string): string {
  if (isSchemaPath(dataPath)) return dataPath;
  if (dataPath.endsWith('.jsonc')) return `${dataPath.slice(0, -'.jsonc'.length)}.schema.jsonc`;
  if (dataPath.endsWith('.json')) return `${dataPath.slice(0, -'.json'.length)}.schema.json`;
  return `${dataPath}.schema.json`;
}
```
Asset's per-category schema resolution (D-09: engine `.schema.jsonc` first, else built-in) and `defaults` merge (D-10, `@required` field-necessity) are new model functions that follow this style. **Schema-resolution tests** belong in `asset/model/__tests__`.

---

### `packages/libs/editor-impl/src/asset/components/*.tsx` (components)

**Analogs:** `packages/libs/editor-impl/src/table/components/{TableToolbar,ActionButtons,TableGrid,TableEmptyColumn,TablePicker,TableCreateForm}.tsx`; visual/behavior ref `packages/apps/editor/src/Workbench/ResourcesWorkspace/index.tsx`.

Rule (shared by all of the table's components): **props-driven, no global state, no direct fs, no host/engine imports**; render via `createElement` or JSX (both appear); class names are kebab-case with a capability prefix (`etable-*` / new `easset-*`); every interactive element is a real `<button type="button">` / antd control; `data-test-id` is on every testable node.

**Props-driven contract + `createElement` render** (`TablePicker.tsx` lines 11-28, 154-198):
```typescript
export interface ITablePickerProps {
  readonly presets?: readonly ITablePreset[];
  readonly directory: string;
  readonly entries: readonly IFileEntry[];
  readonly error?: string;
  onSelect(dataPath: string): void;
}
export function TablePicker(props: ITablePickerProps): ReactElement { /* pure render */ }
```

**Toolbar buttons grouping** (`TableToolbar.tsx` / `ActionButtons.tsx`): antd `Button` with `size`, `autoInsertSpace={false}`, `type="primary"` for the main CTA, `className`/`data-test-id`. AssetToolbar maps「瘦身转码 / 保存 / 新增素材」onto this.

**Destructive confirm Modal** (`TableEmptyColumn.tsx` lines 61-102): controlled antd `Modal` with `footer` built from Buttons, `danger:true` confirm, explicit Chinese warning text — the exact pattern for asset's「删除」and「覆盖旧文件」二次确认:
```typescript
function renderDeleteModal(dataPath: string, onConfirm: () => void, onCancel: () => void): ReactElement {
  return createElement(Modal, {
    open: true, title: '删除表格', closable: false, maskClosable: false, keyboard: false, onCancel,
    footer: createElement('div', { className: 'etable-empty-delete-footer' },
      createElement(Button, { size:'small', autoInsertSpace:false, 'data-test-id':'table-list-delete-cancel', onClick:onCancel }, '取消'),
      createElement(Button, { size:'small', type:'primary', danger:true, autoInsertSpace:false, 'data-test-id':'table-list-delete-confirm', onClick:onConfirm }, '删除'),
    ),
  }, `将删除 ${dataPath} 的数据与 schema 一对文件，且无法找回、不可撤销。是否继续？`);
}
```

**Empty-state inline pattern** (`TableEmptyColumn.tsx` lines 14-35, 150-225; D-26): a single control whose `mode` prop switches between「buttons」and inline「open/create/delete」sub-views, with a「返回」button. The empty-asset category reuses this idea (inline「新增/选择」entry, not just a text line).

**Grid card + detail** (`ResourcesWorkspace/index.tsx`): `.resourceCard` (`role="button" tabIndex={0}`, Enter/Space handlers), `.is-selected` / `.is-missing` modifier classes, `<img title={size}>` preview with `pixelated`, `.resourceDetailEmpty` placeholder. **Re-express with UI-SPEC tokens/antd — do NOT copy the split-image / tileset-order / registry-checkbox parts** (UI-SPEC §范围外):
```tsx
<div
  className={`resourceCard${selected === name ? ' is-selected' : ''}${missing ? ' is-missing' : ''}`}
  data-test-id={`resource-${descriptor.id}-${name}`}
  key={name}
  onClick={() => onSelect({ descriptor, name, splitEntry })}
  role="button"
  tabIndex={0}
>
  <span className="resourceCardPreview">{/* image / audio / font preview */}</span>
  <span className="resourceCardName" title={name}>{name}</span>
</div>
```

**Image preview via object URL** (`ResourcesWorkspace/index.tsx` lines 132-170; `SelectMaterialContent.tsx` lines 40-59) — the shared `useAssetUrl` pattern (`URL.createObjectURL(new Blob([bytes], { type: mime }))` + `URL.revokeObjectURL` on cleanup). AssetDetail's image/audio preview reuses this. **The bytes come from `context.requestResource(path).request()` (returning `Uint8Array`) — not `projectAssets`**.

---

### `packages/libs/editor-impl/src/asset/picker/**` (component, request-response)

**Analog:** `packages/libs/editor-impl/src/react/components/MultiSelectModal.tsx`; behavior ref `packages/apps/editor/src/Workbench/modals/SelectMaterial/SelectMaterialContent.tsx`.

The UI-SPEC (D-12) says the asset picker reuses the Phase-2 generic multi-select shell and enriches it. Copy `MultiSelectModal`'s shell and its **render precedence** (error → loading → empty → list):

**Shell + precedence** (`MultiSelectModal.tsx` lines 32-118):
```tsx
function renderBody(props, selected, onToggle): ReactElement {
  if (props.error !== undefined) return <div className="eimodal-status eimodal-error" data-test-id="multiselect-error">{props.error}</div>;
  if (props.loading === true) return <div className="eimodal-status" data-test-id="multiselect-loading"><Spin size="small" /></div>;
  if (props.items.length === 0) return <div className="eimodal-status" data-test-id="multiselect-empty">暂无可选项</div>;
  return <div className="eimodal-list" data-test-id="multiselect-list">{/* checkbox + thumb + label per item */}</div>;
}
// footer: fixed 取消 / 确定 with data-test-id multiselect-cancel / multiselect-confirm
```
`IMultiSelectItem` (`react/types.ts` lines 15-22) is `{ id, label, thumbnail? }` — the asset picker's items fit this shape (thumbnail = object-URL preview).

---

### `packages/libs/editor-impl/src/react/capabilities.ts` + `types.ts` (modify — capability seam)

**Analog:** itself (`ITableEditorCapabilities`).

Add an `asset` capability following the existing optional-field pattern. Capability interfaces live in `react/` and are **injected by the composition root**; `react/` must not import `asset/` (`.dependencyCruiser.cjs` `react-and-shell-must-not-import-capabilities`, lines 47-52).

**Interface shape to mirror** (lines 15-89):
```typescript
export interface IMultiSelectOpener {
  open(request: IMultiSelectOpenRequest): Promise<IMultiSelectResult | null>;
}

export interface ITableEditorCapabilities {
  readonly codeEditor?: ICodeEditorOpener;
  readonly eventEditor?: IEventEditorOpener;
  readonly multiSelect?: IMultiSelectOpener;
  readonly pointSelect?: IPointSelectOpener;
  readonly tablePanel?: ITablePanelOpener;
  readonly tablePresets?: readonly ITablePreset[];
  readonly copy?: ICopyCapability;
}
```
New: `IAssetEditorCapabilities` (categories, dir/listPath map, schema sets, defaults resolver, upload opener — RESEARCH §Code Examples) and/or an `asset` opener field on the capabilities bag (UI-SPEC F8 leans a **new asset field reusing the modal shell**). Confirm the exact shape in `INTERFACE-NAME.md`.

**Provider defaulting** (`react/components/CapabilityProvider.tsx` lines 38-64): injected opener wins, otherwise a default modal opener is supplied — copy this `provided?.x ?? defaultX` pattern for the asset picker.

---

### `packages/libs/editor-core/src/undo/types.ts` + `undoSystem.ts` (modify — D-15 boolean return + D-29 barrier)

**Analog:** itself.

Today `undo()`/`redo()` return `Promise<void>` and `UndoEntry` has only `{ undo, context }` (types.ts lines 27-57; undoSystem.ts lines 3-60). D-15 adds a boolean return; D-29 models byte changes as **barrier entries** that stop undo and return `false`.

**Current core to extend** (undoSystem.ts lines 3-55):
```typescript
interface UndoEntry {
  readonly undo: IUndoable;
  readonly context: IUndoContext<unknown>;
}

async undo(): Promise<void> {
  const entry = this.undoStack[this.undoStack.length - 1];
  if (!entry) return;
  await entry.undo.undo(entry.context);
  this.undoStack.pop();
  this.redoStack.push(entry);
}
```
The barrier shape is an **interface-phase decision** (RESEARCH Open Q2); record it in `INTERFACE-NAME.md`. Suggested minimal delta: add `barrier?: boolean` (or a `barrier` flag on `IUndoContext`) + `Promise<boolean>` returns; existing `void` callers remain source-compatible. `addUndoContext(undo, context)` (lines 23-33) is where the panel registers entries — asset's byte operations register barrier entries here.

**Consumer of undo/redo shortcuts:** shell (`packages/libs/editor-core/src/shell/shellSystem.ts`) invokes undo/redo; the panel-level `IUndoable.undo(context)` (panel/types.ts lines 42, 1-19) is unchanged in shape.

---

### `packages/apps/editor-dev/src/main.tsx` + `demo/assetDemo.ts` + `backend/**` (composition root)

**Analogs:** `packages/apps/editor-dev/src/main.tsx`, `demo/tableDemo.ts`, `backend/memoryBackend.ts`, `backend/types.ts`.

The dev host is the composition root: create `EditorCore`, seed an in-memory fs, register panel types, `initialize({ fs, maxUndoStep, ignore })`, then render `CapabilityProvider` + `shellSystem.render()`.

**Wiring** (`main.tsx` lines 25-46):
```typescript
const core = new EditorCore();
const backend = new MemoryBackend();
backend.seed(TABLE_DEMO_DATA_PATH, TABLE_DEMO_DATA);
core.shellSystem.registerPanelType(DEMO_PANEL_TYPE);
core.shellSystem.registerPanelType(tablePanelType);
registerDevMenu(core);
await core.initialize({ fs: backend, maxUndoStep: backend.maxUndoStep, ignore: ['node_modules', '.git'] });
createRoot(document.getElementById('root')!).render(
  createElement(DevCodeEditorProvider, {
    capabilities: { tablePanel: createTablePanelOpener(core), tablePresets: TABLE_PRESETS },
    children: createElement(core.shellSystem.render()),
  }),
);
```
Asset demo: seed `content/texture/.list.jsonc` (with the `// --- SYSTEM PREFIX END --- //` header) + a sample `.png`/`.webm` bytes (`Uint8Array`), `registerPanelType(assetPanelType)`, and inject `IAssetEditorCapabilities` (categories, dir/listPath map, schema set) through the provider.

**Seed accepts text or bytes** (`backend/types.ts` lines 3-13; `memoryBackend.ts` lines 84-88): `seed(path, content: string | Uint8Array)`. `MemoryBackend` rejects `..` out-of-bounds (lines 249-257) — the defense-in-depth for uploaded filenames.

**Demo data factory style** (`tableDemo.ts` lines 5-133): exported path constants + a data factory + JSON text constants; `createTablePanelOpener(core)` (lines 135-147) shows how an opener calls `openBlankTab()` + `openPanelInTab(tabId, typeId, param)`. Asset demo reuses this for the asset picker opener if needed.

---

## Shared Patterns

### Code-style contract (applies to every new file — from AGENTS.md §Project Rules)
- **No `import type`** — plain `import { ... }`, re-export types with `export type`. Enforced at error level by `scripts/verify/coreImportType.js` over **both** `editor-core/src` and `editor-impl/src` (including tests). Existing `tablePanel.ts` / `capabilities.ts` comply.
- Classes: `interface IXxx` + `class Xxx implements IXxx`; the class carries NO jsDoc, the interface does.
- Enums: `const enum` (UPPER_SNAKE members in editor-impl, since it is NOT `erasableSyntaxOnly`). `type` aliases get jsDoc; classes/interfaces/enums do not.
- Methods & members get jsDoc (multi-line for public methods with `@param`; single-line for members). File-level notes go **after** imports, never a header before them.
- Barrels are `export *` only, no deep cross-directory re-exports (`table/index.ts`, `react/index.ts`, `model/index.ts`).

### JSONC codec — `.jsonc` system-prefix round-trip (D-24)
**Source:** `packages/libs/editor-impl/src/table/model/tableText.ts` (84 lines; moving to `shared/jsonc/`)
**Apply to:** AssetPanel list read/write, per-category schema files, all manual-save writes.
```typescript
export const SYSTEM_PREFIX_END_MARKER = '// --- SYSTEM PREFIX END --- //';

// parseTableText(text): ITableTextParseResult → { status: Conforming | NeedsCommentStrip | Invalid, prefix, value? }
// serializeTableText(value, prefix): string → prefix + JSON.stringify(value, null, 2)
```
Rules to preserve (Pitfall 5): remember `prefix` from parse; on write always `serializeTableText(value, prefix)`; never `writeContent(path, JSON.stringify(...))`. `.list.jsonc` files use the exact same marker as the table's `.jsonc`.

### Resource layer — the ONLY data access (D-04/D-05/D-23)
**Source:** `packages/libs/editor-core/src/resource/types.ts` (lines 1-200) + `panel/types.ts` (lines 5-40)
**Apply to:** every component/panel that touches asset data.
```typescript
export type IResourceIdentifier = string;              // pure path, '/'-separated, no leading slash
export type ResourceContent = string | Uint8Array;
interface IEditorPanelContext {
  requestResource(identifier): Promise<IResource | null>;
  createResource(identifier, content): Promise<IResource | null>;
  deleteResource(identifier): Promise<void>;
  listDirectory(path): Promise<readonly IFileEntry[]>;
  addUndoContext(panel: IEditorPanel, context: IUndoContext<unknown>): void;
}
```
List a category = `listDirectory(category.dir)` (or index); read a material's bytes = `requestResource(path).request()` → `Uint8Array`; add/replace = `createResource` / `resource.write(bytes)`; encode-original rename = `moveResource`. `IEditorFileSystem` (fs/types.ts lines 15-69) is injected into core, never called by the panel.

### Capability injection (engine-neutrality, D-08/D-11/D-12)
**Source:** `packages/libs/editor-impl/src/react/capabilities.ts` (lines 67-89) + `react/components/CapabilityProvider.tsx` (lines 38-64)
**Apply to:** all engine-specific knowledge (category list, dir/listPath mapping, schema sets, picker).
```typescript
export interface ITableEditorCapabilities {
  readonly codeEditor?: ICodeEditorOpener;   // every capability optional; absent → graceful degradation
  ...
}
```
The panel receives capabilities via the compose-root; it **must not** import host/engine code, and the **legacy engine schema set must be host-injected** (not literalized) — `coreEngineNeutral.js` bans the terms `tower/floor/loc/autopass/autotile/idnum/airwall/commonEvent/prefab/mota` (case-sensitive, word-boundary, **comments included**) in both libs' `src` (coreEngineNeutral.js lines 43-58).

### Manual save (D-24)
**Source:** `packages/libs/editor-impl/src/table/tablePanel.ts` (`save` 683-703, `flushColumn` 1399-1427, refresh guard 1677-1678)
**Apply to:** AssetPanel「保存」+ every list/config mutation.
Hold edits in memory (`unsaved` flag), disable「保存」when clean, and on refresh **early-return when unsaved** so a category switch/re-request never clobbers in-memory edits.

### Error isolation (never throw through a panel)
**Source:** `packages/libs/editor-impl/src/table/tablePanel.ts` (`persist` 1448-1462, `refreshPicker` 830-851, `refresh` 1686-1727)
**Apply to:** all resource reads/writes in AssetPanel.
Wrap in `try/catch`, set a fixed Chinese error message + error status, keep the panel open. Panel-level notification uses the editor's notification bus equivalent (in editor-impl the pattern is a status/message on the Store).

### Validation & prototype-pollution guard (Phase-2 T-02-17)
**Source:** `packages/libs/editor-impl/src/table/model/{validation,fieldPath}.ts`
**Apply to:** per-material config form (reused engine) + uploaded filenames.
Reuse `validateValue` / `validateId` and `fieldPath`'s `__proto__`/`constructor`/`prototype` write guards. Sanitize upload filenames before `createResource`; the injected fs also rejects `..` (memoryBackend.ts 249-257).

### Browser-only media — no `document` (Pitfall 2)
**Source (gate):** `scripts/verify/coreModuleState.js` `BANNED_GLOBALS` (line 52) + `eslint.config.js` Block A (`no-restricted-globals` at error level over `packages/libs/{editor-core,editor-impl}/**`).
**Apply to:** transcoding, image decode, preview URL creation.
`document` / `navigator` / `localStorage` / `XMLHttpRequest` / `fetch` are **banned** in both libs' source; `window` is allowed. Use `OffscreenCanvas` + `createImageBitmap` (+ `URL.createObjectURL` for object URLs). The old `CanvasRasterCodec` (`packages/apps/editor/src/project/assets/CanvasRasterCodec.ts` lines 3-11, 21-37) uses `document.createElement('canvas')` and `new Image()` — **do not port it verbatim**.

### Test harness (Wave 0)
**Source:** `packages/libs/editor-impl/src/table/__tests__/fixtures.ts` (246 lines)
**Apply to:** all new asset tests.
- `FakeFileSystem implements IEditorFileSystem` with `seed(path, string | Uint8Array)`, `failing`/`hanging` sets, out-of-bounds rejection — copy it into `asset/__tests__/fixtures.ts` (editor-impl holds its own copy; it is not exported from core).
- `createTableHarness(fs, maxUndoStep=100)` → `new EditorCore()` + `initialize({ fs, maxUndoStep })`; asset harness mirrors it and also seeds the `IAssetEditorCapabilities`.
- Vitest config: `packages/libs/editor-impl/vitest.config.ts` — `environment: 'jsdom'`, `include: ['src/**/*.test.{ts,tsx}']`, `css: true`. Run with `pnpm --filter @motajs/editor-impl test -- src/asset`.
- UAT test entry (integration through the shell) follows `table/__tests__/addFlow.uat.test.tsx` (lines 55-61: `panel.setTable(...)`, `await panel.onSwitchIn()`, `render(createElement(system.shellSystem.render()))`, read back via `system.resourceSystem.readContent(path)`).

---

## No Analog Found

Files with no close codebase match — planner must use RESEARCH.md / vendor docs, and these carry the phase's novel risk:

| File | Role | Data Flow | Reason / Source of truth |
|------|------|-----------|--------------------------|
| `packages/libs/editor-impl/src/asset/transcode/**` (image→WebP via `OffscreenCanvas.convertToBlob`; audio→WebM/Opus via `mediabunny`) | service | transform / file-I/O | No transcoding exists in the repo. Use RESEARCH §Code Examples (OffscreenCanvas + Mediabunny `Conversion`) and https://mediabunny.dev. Gate the UI on `canEncode('opus')` / `typeof OffscreenCanvas !== 'undefined'`; **never** silent failure. `packages/apps/editor/src/project/assets/CanvasRasterCodec.ts` is only a partial (decode/encode) reference and uses banned `document`. |
| `packages/libs/editor-impl/src/asset/schemas/**` (built-in legacy + new-engine schema sets) | config/data | — | The legacy set must be **host-injected** (D-08) and must avoid the engine-term literals banned by `coreEngineNeutral.js`; only the new-engine set (types from `E:/github/template/packages-user/client-modules/src/common.ts`) can live here. No in-repo analog for JSON-Schema category definitions. |
| `packages/libs/editor-impl/package.json` + `pnpm-workspace.yaml` (add `mediabunny`) | config | — | New runtime dependency; catalog entry style is shown by existing lines (`pnpm-workspace.yaml` lines 36-68). Install is **human-verify gated** (RESEARCH Package Legitimacy Audit: `mediabunny` flagged `SUS`/`too-new`, MPL-2.0). |
| `packages/libs/editor-impl/src/asset/asset.css` | config/style | — | No `easset-*` stylesheet exists; analog is `table/table.css` (import side-effect pattern) but the selectors/tokens are new (UI-SPEC §Color / §Spacing). |

---

## Verifier Gates to Respect (do not fight)

| Gate | File | Constraint it imposes on Phase 3 |
|------|------|----------------------------------|
| Imports must not use `import type` (both libs' `src`, incl. tests) | `scripts/verify/coreImportType.js` | Write plain imports; `export type` for re-exports. |
| `asset` must not import `table` (or `map`/`code`); root barrel must not import capabilities; `react`/`shell` must not import capabilities | `.dependencyCruiser.cjs` lines 37-62 (run by `scripts/verify/coreBoundaries.js`) | Extract shared engine to `src/shared/**` (D-28) and import `../shared` from both. |
| No module-level mutable `let`/`const` containers; `document`/`navigator`/`localStorage`/`XMLHttpRequest`/`fetch`/`process.env`/`import.meta.env` banned | `scripts/verify/coreModuleState.js` + `eslint.config.js` Block A | Use `OffscreenCanvas`; no module singletons (classes with instance fields are fine). |
| Engine terms banned in both libs' `src` (comments included) | `scripts/verify/coreEngineNeutral.js` lines 43-58 | Legacy schema/terms are host-injected, not literalized. |
| `sideEffects` already `["./src/**/*.css"]`; `src/global.d.ts` declares `*.css` | `packages/libs/editor-impl/package.json` line 6, `src/global.d.ts` | `import './asset.css'` works; no package.json change needed for styles. |

**CI runs** (`.github/workflows/ci.yml` lines 31-41, 61-63, 85): `pnpm lint`, `node scripts/verify/coreBoundaries.js`, `coreModuleState.js`, `editorShims.js`, `coreEngineNeutral.js`, `coreImportType.js`, `pnpm typecheck`, `node scripts/verify/coreExports.js`, `pnpm test`. Note `coreExports.js` is currently red from a stale registry path (RESEARCH Pitfall 6) — don't rely on it as a green gate; keep `./asset` exports additive and table-barrel-shaped.

---

## Metadata

**Analog search scope:** `packages/libs/editor-impl/src/**`, `packages/libs/editor-core/src/**`, `packages/apps/editor-dev/src/**`, `packages/apps/editor/src/project/assets/**`, `packages/apps/editor/src/Workbench/{ResourcesWorkspace,AppendPicPanel,PrefabPanel,modals/SelectMaterial}/**`, `scripts/verify/**`, `.dependencyCruiser.cjs`, `eslint.config.js`, `pnpm-workspace.yaml`, `.github/workflows/ci.yml`.
**Files scanned:** ~35 source files read in full or by targeted section; all named analog paths verified `git ls-files`-tracked (no gitignored mirrors).
**Pattern extraction date:** 2026-10-17
**Blocking open questions whose shape must be confirmed in `INTERFACE-NAME.md`:** (1) location/name of the neutral shared module (`src/shared/**` — D-28); (2) undo-barrier model + boolean return (D-15/D-29); (3) picker capability shape (new asset field vs extend `IMultiSelectOpener` — UI-SPEC F8); (4) per-category convention filenames (`.list.jsonc`, `.schema.jsonc`, `defaults/*.jsonc` — D-09/D-27); (5) transcode parameter defaults (UI-SPEC F6); (6) byte-write timing (D-25).
