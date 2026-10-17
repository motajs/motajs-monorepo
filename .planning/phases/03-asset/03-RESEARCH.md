# Phase 3: 素材管理 (Asset Management) - Research

**Researched:** 2026-10-17
**Domain:** `@motajs/editor-impl/asset` — a single 素材管理器 panel (image/audio/animation/font), per-asset config form reusing the Phase-2 JSON-Schema table engine, a default asset picker, and 瘦身转码 (image→WebP, audio→WebM/Opus via Mediabunny), all over the Phase-2.1 path-based `editor-core` resource layer.
**Confidence:** MEDIUM-HIGH (repo contracts HIGH — read directly this session; transcoding + capability-isolation architecture MEDIUM — needs interface-phase ratification).

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### A. 范围与面板结构

- **D-01:** 素材能力交付**一个「素材管理器」面板**，内部按**大分类**组织；不做现状那种细分，**每个素材单独配置**。 — **Reversibility:** costly — 面板拆分与对外导出面一旦被第三方依赖，重组需要迁移调用方与交互。
- **D-02:** 大分类为**图片（texture）/ 音频（audio）/ 动画（animation）/ 字体（font）**；以新版引擎内容模型为准（另有 `maps` 分类，属地图能力，**不算素材**）。
- **D-03:** 素材操作集合 = **浏览 / 新增（本地上传文件）/ 替换 / 删除 / 配置**。

### B. 数据来源（`editor-core` 资源层）

- **D-04:** 素材的**列表与字节都经 `editor-core` 资源层**获取与写入；**不**直接触达真实文件系统，一律经注入的 `IEditorFileSystem` 与资源系统（core 的资源系统是文件系统的唯一调用方）。 — **Reversibility:** costly — 数据访问一旦铺开，换抽象要改面板与所有写入点。
- **D-05:** **资源粒度按文件路径**：每个分类的 **`.list.jsonc` 列表文件是一个路径资源**（内容 = 该分类的条目数组）；每个**素材字节文件各自是一个路径资源**；面板把「列表文件 + 字节文件」二者结合。
- **D-06:** `IResourceIdentifier` = **纯文件路径**（相对项目根、以 `/` 分隔、不带前导斜线）；路径即标识，core 以它读写、建索引。

### C. 配置表单与 Schema（复用表格引擎）

- **D-07:** **每素材配置表单复用 Phase 2 的 JSON Schema 表格/表单引擎**（`ITableSchemaNode` 及其控件/校验/撤销）。
- **D-08:** `editor-impl/asset` **内置两套分类 Schema**：**legacy**（= 现有 `@motajs/editor` 的旧素材模型，`tower.main.images` / `icons.js` / `maps.js` 那套）与**新引擎**（按新内容模型）；**由装配方按引擎选择注入**。
- **D-09:** **Schema 解析顺序**——**引擎自带的分类 Schema 优先**（约定**固定文件名**，如每个分类目录下一个约定文件 `.schema.jsonc`）；读不到则**回退到内置 Schema**。
- **D-10:** **新增素材的默认值取自 `defaults`**（`defaults/*.jsonc`）；其中 `@required` 作为**字段必需性**参与校验，对象按「逐属性比较」语义合并。
- **D-11:** **注入 + 内置默认**：`editor-impl/asset` 内置「图片 / 音频 / 动画 / 字体」四种**预览**与通用框架作为默认；引擎在顶层**注入分类清单与「分类 → 目录 / 列表文件路径」的映射、配置表单描述**，可增删改——资源不再有类型号，按文件路径（含目录约定）组织。

### D. 素材选择器

- **D-12:** **`editor-impl/asset` 提供默认素材选择器**（自行按分类列素材、缩略图 / 播放预览、返回选中项），作为 asset 能力注入；表格、Blockly 等经接缝调用它。

### E. 编辑 / 撤销 / 持久化

- **D-13（Phase 2.1 修订）:** 素材编辑走 `editor-core` **统一撤销**路径；保存模型 = **手动保存**，与表格一致——列表与配置改动先记在内存，需**显式保存**才落盘（沿用 Phase 2.1 表格的手动保存模型，目的是**逐字保留 `.jsonc` 系统前缀注释块**、避免自动保存反复写盘）。
- **D-14:** **字节改动（新增 / 替换 / 删除）不可撤销**——记进历史但作为**屏障**：撤销碰到它就**停住**、返回 `false` 并提示「无法撤销」；**不**跳过它去撤销更早的配置改动。配置改动正常可撤销。
- **D-15:** 给 `editor-core` 的 **undo / redo 增加布尔返回值**：`false` = 无法执行，`true` = 成功。 — **Reversibility:** one-way — 这会改动撤销系统的对外契约，一旦有调用方依赖旧签名，回退需迁移它们。
- **D-16:** **「新增素材」= 本地上传一个文件**（经资源层写入新字节资源 + 往列表资源追加条目）。

### F. 素材整合（新版引擎方向）

- **D-17:** **不再合并成一张图**：图片直接放分类目录、注册后按配置读取。一张图有不同**读取方式**（`TextureReadType`：`Full` / `Grid` / `RowAnimate` / `ColumnAnimate` / `ScanAnimate`），可对应**一个或多个图块**（`TextureUsage`：`CommonImage` / `Tile` / `Tileset`，配合 `grid` / `tiles`）；**帧率不再按类型强制限制，最大 255 帧**。
- **D-18:** **BGM 与音效合并到「音频」分类**，靠配置区分（`ClientAudioType`：`BGM` / `Sound`）。

### G. 瘦身转码

- **D-19:** 面板提供两个转码动作：**图片 → WebP（可选 quality）**、**音频 → WebM 容器中的 Opus**，以降低存储与加载压力。
- **D-20:** 音频转码使用 **Mediabunny**（`mediabunny` 库：纯浏览器、TypeScript、零依赖、基于 WebCodecs、支持 WebM 输出 + Opus、可 tree-shake）。需新增 workspace 依赖并进 catalog。 — **Reversibility:** costly — 引入运行时依赖；更换转码链需改整条转码路径。
- **D-21:** **允许批量转换**；加一个**「覆盖旧文件」勾选框，默认勾选**。不勾 → 旧文件改名为 **`{file}-origin.{ext}`** 保留；勾 → 二次确认弹窗，**明确说明原文件会被替换、无法找回**。
- **D-22:** **转码参数允许用户配置**（WebP 的 quality、音频码率 / 采样率等基础项）。

### H. Phase 2.1 落地契约（本轮并入）

- **D-23:** **资源 API 以 Phase 2.1 落地为准**：`IResourceIdentifier` = 纯文件路径；`IResourceSystem` 提供 `requestResource` / `createResource` / `deleteResource` / `moveResource` / `listDirectory`，以及 `readContent` / `writeContent`；`editor-core` 只注入 **`IEditorFileSystem`**（含 `readBinary` / `writeBinary`），并维护**项目文件索引**（初始化全扫 + 增删移增量 + 忽略模式）与带 **8 MiB** 上限的 LRU **内容缓存**。**无「按类型列资源」**——**列某分类的素材 = `listDirectory(分类目录)` / 读索引**。 — **Reversibility:** costly — 这是 Phase 2.1 已发布并落地的资源契约。
- **D-24:** **保存模型 = 手动保存（与表格一致）**：列表与配置改动先记在内存，需**显式保存**才写盘；`.list.jsonc`（及分类 schema 文件）写回**逐字保留 `.jsonc` 系统前缀注释块**（`// --- SYSTEM PREFIX END --- //` 及其之前文本），复用表格的 `parseTableText` / `serializeTableText` 约定（文件名/前缀约定由规划阶段提出并经 `INTERFACE-NAME.md` 确认）。
- **D-25:** **素材字节改动（新增 / 替换 / 删除 / 转码）不可撤销**，作为撤销屏障（与 D-14 一致）；其**何时落盘**（随手动保存一并落盘，还是上传时即写）由规划阶段定，但「不可撤销 / 屏障」语义不变。
- **D-26:** 素材面板**空态借鉴 Phase 2.1 的空栏内联模式**（空分类时内联呈现「新增 / 选择」入口，而非仅一句空文案）；是否复用 `TablePicker` / `TableCreateForm` 的组件思路由规划阶段定。
- **D-27:** **schema 文件身份沿用 Phase 2.1 的文件名约定**（数据 `xxx.json` / `xxx.jsonc`，schema `xxx.schema.json` / `xxx.schema.jsonc`）；各分类「引擎自带 Schema」的约定文件名由规划阶段提出并经 `INTERFACE-NAME.md` 确认。

### the agent's Discretion

- 面板与底层组件的具体接口形状、方法名、字段名、预览实现细节、各分类 Schema 的具体字段表达（`x-editor` / `x-control` 等扩展键用法）、转码配置界面的呈现——由研究 / 规划阶段提出；**命名按项目规则先经用户确认（`INTERFACE-NAME.md`，每 Plan 一节）**。
- 目录约定文件名（如 `.schema.jsonc`）的确切命名、分类清单的注入形状，由规划阶段提出并确认。

### Deferred Ideas (OUT OF SCOPE)

- **资源层接口修订已由 Phase 2.1 完成**：`IResourceIdentifier` = 纯文件路径；资源按路径读写、core 驱动注入的文件系统并维护项目索引（其资源 API / 手动保存 / `.jsonc` 前缀逐字保留 / 空栏内联约束已并入 **§H**）。
- **转码配置界面 / 新增素材输入体验等交互细节**：待后续继续讨论。
- **引擎为各 `.list.jsonc` 自带 Schema**：格式与存放细节后续定（本阶段先按「约定固定文件名 + 回退内置」实现）。
- **地图 / 代码 / 事件编辑器**：Phase 4/5/6。
- **插件加载 / 注册机制**：后续里程碑。
- **dev 宿主接入**：本阶段收尾工作之一（ROADMAP §Cross-cutting Constraints），具体演示数据由规划阶段定。
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ASSET-01 | 用户可管理素材（图片 / 动画 / 材质） | Delivered by the `素材管理器` panel (browse/add/replace/delete/config across 图片/音频/动画/字体) over the path-based resource layer; persistence via manual save; parity with current editor. See §Standard Stack, §Architecture Patterns, §Code Examples. |

> ROADMAP §Phase 3 acceptance (verified this session): (1) browse assets; (2) add/replace/delete with immediate effect; (3) changes persist across reload via the unified persistence path; (4) visuals/behavior match the current editor. [VERIFIED: .planning/ROADMAP.md:259-269] Note ROADMAP still says "材质"; CONTEXT §A/§F and UI-SPEC supersede it with 图片/音频/动画/字体.
</phase_requirements>

---

## Summary

Phase 3 adds the `@motajs/editor-impl/asset` capability: one 素材管理器 panel that browses/adds/replaces/deletes/configures assets across four big categories (图片 texture / 音频 audio / 动画 animation / 字体 font), a default asset picker, and two 瘦身转码 actions (image→WebP, audio→WebM/Opus). It is the second capability to sit on the Phase-2.1 resource layer, so nearly all of its data access is already prescribed: list a category = `IEditorPanelContext.listDirectory(dir)`; read bytes = `requestResource(path).request()`; add/replace/delete = `createResource`/`deleteResource` (+ `moveFile` for `{file}-origin.{ext}`); persist lists/config with `parseTableText`/`serializeTableText` so the `.jsonc` system-prefix block round-trips byte-for-byte; and manual save.

The two genuinely novel pieces are (a) **capability boundaries** and (b) **browser-only media work**. Three machine-enforced gates bear directly on this phase and were read this session: `coreEngineNeutral.js` bans the literal terms `tower/floor/loc/autopass/autotile/idnum/airwall/commonEvent/prefab/mota` in **both** `editor-core/src` and `editor-impl/src` source (comments included); `coreModuleState.js` runs ESLint over both `src` trees and forbids the bare globals `document/navigator/localStorage/XMLHttpRequest/fetch` at error level; and `.dependencyCruiser.cjs` rule `capabilities-must-not-import-each-other` forbids `asset → table` imports. D-07 wants asset to reuse the table engine, and the existing `CanvasRasterCodec`/`tableText` code lives inside banned or capability-scoped directories — so the interface phase must resolve **where the shared form engine lives** and **how canvas/WebCodecs work avoids `document`**. This is the single biggest planning decision in the phase.

**Primary recommendation:** In the interface-first plans, (1) extract the reusable schema-form engine + `.jsonc` text codec into a neutral, non-capability module (e.g. `editor-impl/src/shared/**`) that both `table` and `asset` import, rather than having `asset` import `table`; (2) implement all media codecs with `OffscreenCanvas` + `createImageBitmap` + Mediabunny (never `document`); (3) inject the per-engine Schema set and category→dir mapping through a capability seam (`IAssetEditorCapabilities`) rather than hard-coding engine knowledge into `asset`; and (4) isolate transcoding behind an interface so jsdom tests can fake it and Playwright/dev-host covers the real path.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Category/data browser (grid, detail, empty/loading/error states) | Browser/Client (React + antd, `editor-impl/asset`) | — | Pure view over injected resource reads; no host knowledge. |
| Asset list + config read/write (`.list.jsonc` + schema) | editor-impl `asset` panel (via `editor-core` resource layer) | editor-core `ResourceSystem` | D-04/D-05: panel never touches real FS; core drives the injected `IEditorFileSystem`. |
| `.jsonc` system-prefix round-trip | Shared text codec (extracted from `table/model/tableText.ts`) | editor-impl `asset` | D-24 requires verbatim prefix preservation; reusing `parseTableText`/`serializeTableText` is the canonical path (not re-implementing). |
| Per-asset config form | Shared schema-form engine (extracted) | editor-impl `asset` view | D-07 reuses the Phase-2 JSON-Schema engine; must not become `asset → table` (gate). |
| Asset byte upload/replace/delete | editor-impl `asset` panel (via resource layer) | — | D-16/D-25; bytes are non-undoable barrier entries. |
| 瘦身转码 (image→WebP) | editor-impl `asset` (browser-only codec) | — | Canvas/WebP is browser-specific; must use `OffscreenCanvas` (no `document`). |
| 瘦身转码 (audio→WebM/Opus) | editor-impl `asset` (Mediabunny, WebCodecs) | — | D-20; must gate on `canEncode('opus')` and disable when unavailable. |
| Undo/redo + barrier semantics | editor-core `UndoSystem` (boolean return, D-15) | editor-impl `asset` (registers barrier entries) | Unified undo path; barrier must stop undo and return `false`. |
| Default asset picker | editor-impl `asset` (exported capability) | `react` capability seam (`IMultiSelectOpener` / new `asset` field) | D-12; consumed by table/Blockly through injection. |
| Category list / dir mapping / Schema injection | Composition root (dev host / future `@motajs/editor`) | editor-impl `asset` (built-in defaults) | D-08/D-11 engine-neutrality: engine knowledge is injected, not imported. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `antd` | catalog `6.2.1` | All panel controls (Button/Modal/Upload/Checkbox/Input/InputNumber/Select/Segmented/Spin/Empty/Alert/Tooltip/Space/notification) | Already `@motajs/editor-impl` peerDependency; UI-SPEC locks it. [VERIFIED: packages/libs/editor-impl/package.json:26] |
| `react` | catalog `^19.2.3` | Panel + form rendering | peerDependency. [VERIFIED: packages/libs/editor-impl/package.json:31] |
| `@tanstack/store` + `@tanstack/react-store` | catalog `0.8.0` | Panel view-state subscription (same pattern as `TablePanel`) | Already dependencies; `TablePanel` uses `Store<ITablePanelViewState>`. [VERIFIED: packages/libs/editor-impl/package.json:41-42] |
| `mediabunny` | `1.61.6` (npm latest, 2026-10-16) | Audio → WebM/Opus transcoding (browser, WebCodecs) | CONTEXT D-20 locked choice; pure TS, zero deps, WebM+Opus. [VERIFIED: npm registry `mediabunny@1.61.6`] **New dependency; needs catalog entry + human-verify (see Package Legitimacy Audit).** |
| `json5` | catalog `2.2.3` | Lenient `.jsonc` fallback parse (via shared text codec) | Already an `editor-impl` dependency; used by `tableText.ts`. [VERIFIED: packages/libs/editor-impl/package.json:46] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `ajv` | catalog `8.20.0` | JSON-Schema validation for the reused config form | Only through the shared schema-form engine. [VERIFIED: packages/libs/editor-impl/package.json:43] |
| `json-schema-typed` | catalog `8.0.2` | `JSONSchema.Interface` for `ITableSchemaNode` | Through the shared engine. [VERIFIED: packages/libs/editor-impl/package.json:45] |
| `es-toolkit` | catalog `1.44.0` | `clamp`/`get` helpers (as table uses) | Utility. [VERIFIED: packages/libs/editor-impl/package.json:44] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Mediabunny | `webm-muxer` + hand-rolled WebCodecs `AudioEncoder` | Mediabunny is the author's successor to `webm-muxer`; hand-rolling means re-implementing decode/mux/backpressure. D-20 already picks Mediabunny. |
| Mediabunny | `ffmpeg.wasm` | Huge bundle, non-tree-shakable, slow; rejected by D-19/D-20 intent. |
| `OffscreenCanvas` WebP | `HTMLCanvasElement.toBlob` | `document` is **banned** in `editor-impl/src` (gate); `OffscreenCanvas.convertToBlob` avoids it. |
| New `asset` picker capability | Extend `IMultiSelectOpener` | UI-SPEC F8 open; see Open Questions. |

**Installation (after human-verify checkpoint):**
```bash
# add to pnpm-workspace.yaml catalog, then to @motajs/editor-impl dependencies
# catalog: mediabunny: 1.61.6
pnpm add mediabunny@1.61.6 --filter @motajs/editor-impl
```
Per AGENTS.md, run networked installs through the proxy: `set HTTP_PROXY=http://127.0.0.1:7890 && set HTTPS_PROXY=http://127.0.0.1:7890`.

**Version verification:** `npm view mediabunny version` → `1.61.6`; `time.modified` → `2026-10-16T22:05:16.058Z`; `license` → `MPL-2.0`. [VERIFIED: npm registry]

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `mediabunny` | npm | latest **1.61.6** published 2026-10-16 (very active, daily releases); package has multi-year history via author's `mp4-muxer`/`webm-muxer` lineage | ~4.0M/wk | github.com/Vanilagy/mediabunny | **SUS** (seam reason: `too-new`) | **Flagged — planner MUST add a `checkpoint:human-verify` before install.** |

**Packages removed due to SLOP verdict:** none
**Packages flagged as suspicious [SUS]:** `mediabunny` [WARNING: flagged as suspicious — verify before using.]

**Assessment of the SUS flag (for the human-verify checkpoint):** The seam's only reason is `too-new`, which fires because the *latest version* was published within the recency window — a false positive for a library that ships daily and has ~4M weekly downloads, a public source repo (`github.com/Vanilagy/mediabunny`), no `postinstall` script, and is not deprecated. It is the well-known successor to `mp4-muxer`/`webm-muxer`. **License note:** Mediabunny is **MPL-2.0** (file-level copyleft); this repo is BSD-3-Clause. MPL-2.0 permits use as a library dependency without relicensing the consuming project, but the planner should record this and the checkpoint should confirm the license is acceptable. Because the name entered this research from the user decision + web sources, it is tagged `[ASSUMED]` for provenance purposes regardless of registry existence — hence the mandatory checkpoint.

*No other external package is introduced by this phase; all other libraries are already declared.*

---

## Architecture Patterns

### System Architecture Diagram

The panel is a pure view over injected capabilities and the `editor-core` resource layer; the composition root (dev host / future `@motajs/editor`) owns all engine knowledge.

```
                 ┌─────────────────────────── Composition root (dev host / @motajs/editor) ───────────────────────────┐
                 │  registerPanelType(assetPanelType)        inject IAssetEditorCapabilities                          │
                 │  provide IEditorFileSystem (backend)      { categories[], dir/listPath map, schemaSets(legacy|new),  │
                 │  inject asset picker                       defaults resolution, file-upload opener }                │
                 └───────────────┬───────────────────────────────────────────────────────────┬──────────────────────────┘
                                 │                                                           │
                 props / caps ───▼───────────────────────────────────────────────────────────▼─────── capability seam
                 ┌──────────────────────────────────────────────────────────────────────────────────────────┐
   user click ──▶│  AssetPanel (implements IEditorPanel + IAssetPanel)                                        │
                 │   onSwitchIn → re-request current category list & bytes                                   │
                 │   state: currentCategory, selectedPath, list entries, unsaved flags, per-asset config      │
                 └───┬───────────────┬──────────────────────────┬───────────────────────┬──────────────────┘
                     │               │                          │                       │
        list/config  │               │ bytes                    │ config field edit     │ 瘦身转码
                     ▼               ▼                          ▼                       ▼
        ┌──────────────────┐ ┌──────────────────┐    ┌───────────────────────┐  ┌───────────────────────────┐
        │ shared .jsonc    │ │ resource layer   │    │ shared schema-form    │  │ TranscodeService          │
        │ text codec       │ │ (request/create/ │    │ engine (grid/controls/│  │  image → OffscreenCanvas  │
        │ parseTableText / │ │  delete/move/    │    │ validation/undo)      │  │          convertToBlob    │
        │ serializeTableText│ │  listDirectory) │    │  (imported by BOTH    │  │  audio → Mediabunny       │
        └────────┬─────────┘ └────────┬─────────┘    │   table & asset)      │  │   Conversion + WebM/Opus  │
                 │                    │              └───────────┬───────────┘  └─────────────┬─────────────┘
                 │                    │                          │                        │
                 └──────────┬─────────┴──────────────────────────┴────────────────────────┘
                            ▼
            ┌──────────────────────────────── editor-core ────────────────────────────────┐
            │ ResourceSystem (sole caller of fs)  •  FileIndex (project scan)              │
            │ ContentCache (8 MiB LRU)  •  UndoSystem (boolean return + barrier)           │
            │ ShellSystem (registerPanelType / onSwitchIn/out / undo-redo shortcuts)       │
            └──────────────────────────────────┬───────────────────────────────────────────┘
                                               ▼
                                   IEditorFileSystem (injected): readFile/writeFile/
                                   readBinary/writeBinary/listDirectory/makeDirectory/
                                   moveFile/deleteFile
                                               ▼
                            MemoryBackend (dev) / host FS (prod)

Legend: ─► data/control flow.  The panel NEVER imports table/, engine code, or real fs.
```

### Recommended Project Structure

```
packages/libs/editor-impl/src/
├── shared/                       # NEW: neutral, non-capability module (importable by table AND asset)
│   ├── schemaForm/               # extracted from table/ (TableGrid, controls, model/validation, fieldPath …)
│   │   └── index.ts              # export * (barrel)
│   ├── jsonc/                    # extracted from table/model/tableText.ts (parseTableText/serializeTableText)
│   │   └── index.ts
│   └── index.ts
├── table/                        # re-exports / imports shared/; keeps its public ./table surface
├── asset/                        # NEW capability
│   ├── index.ts                  # barrel: assetPanelType + components + picker + built-in schema sets
│   ├── assetPanel.ts             # AssetPanel class (IEditorPanel + IAssetPanel)
│   ├── assetPanelType.ts         # assetPanelType: IEditorPanelType
│   ├── types.ts                  # IAssetPanelTarget? / IAssetCategory / IAssetEntry / …
│   ├── model/                    # list decode/encode, schema resolution, defaults merge
│   ├── transcode/                # TranscodeService (image webp / audio webm-opus) + capability detection
│   ├── components/               # AssetToolbar / CategoryNav / AssetGrid / AssetDetail / TranscodeModal
│   ├── picker/                   # default asset picker (modal)
│   ├── schemas/                  # built-in legacy + new-engine schema sets
│   └── asset.css
├── react/                        # capability seam: add IAssetEditorCapabilities (or extend existing)
└── index.ts                      # root barrel (must NOT import asset/ — gate)
```

`src/asset/index.ts` currently does not exist although `package.json` already maps `./asset` → `./src/asset/index.ts`; this phase creates it. [VERIFIED: packages/libs/editor-impl/package.json:15; directory listing of `src/` shows only `react/`, `table/`, `__tests__/`]

### Pattern 1: Read a category through the resource layer (list + bytes)
**What:** List a category's `.list.jsonc`, parse it (prefix-preserving), then resolve each entry's byte file via `listDirectory` / `requestResource`.
**When to use:** Panel `onSwitchIn`, category switch, post-save, post-delete.
**Example:**
```typescript
// Source: derived from packages/libs/editor-impl/src/table/tablePanel.ts:1168-1208, 786-806
// readCategoryList: list directory entries + read the list resource, decode via shared .jsonc codec
const entries = await context.listDirectory(category.dir);          // readonly IFileEntry[]
const listResource = await context.requestResource(category.listPath); // IResource | null
const text = listResource === null ? undefined : await listResource.request();
// text is ResourceContent (string | Uint8Array); decode then parseTableText(text).value
```

### Pattern 2: Manual save with verbatim `.jsonc` prefix
**What:** Keep edits in memory; write only on the panel's 保存; write using `serializeTableText(value, rememberedPrefix)`.
**When to use:** Every list/config mutation.
**Example:**
```typescript
// Source: packages/libs/editor-impl/src/table/model/tableText.ts:83-113 (signatures verbatim)
// parseTableText(text): ITableTextParseResult   → { status, prefix, value? }
// serializeTableText(value, prefix): string     → prefix + JSON.stringify(value, null, 2)
```

### Pattern 3: Inject engine knowledge via a capability seam
**What:** The panel receives `IAssetEditorCapabilities` (categories, dir/listPath mapping, schema sets, defaults loader, upload opener) and never imports host/engine code.
**When to use:** Composition-root wiring. Mirrors `ITableEditorCapabilities` exactly.
**Example:**
```typescript
// Source: packages/libs/editor-impl/src/react/capabilities.ts:67-82 (shape follows ITableEditorCapabilities)
// readonly tablePresets?: readonly ITablePreset[];  ← precedent for injecting static config
```

### Pattern 4: Browser-only media behind an injectable interface
**What:** `TranscodeService` exposes `imageToWebp(bytes, quality)` / `audioToWebmOpus(bytes, { bitrate, sampleRate })` plus `canTranscode(kind)`. Implemented with `OffscreenCanvas` + Mediabunny; faked in jsdom tests.
**When to use:** 瘦身转码 UI. Disable the entry when `canEncode('opus')` is false or `OffscreenCanvas` is missing.

### Anti-Patterns to Avoid

- **`asset → table` imports.** `.dependencyCruiser.cjs` `capabilities-must-not-import-each-other` errors on it. Extract shared code to `src/shared/**` instead. [VERIFIED: .dependencyCruiser.cjs]
- **`document.*` in `editor-impl/src`.** Error-level `no-restricted-globals` (`document/navigator/localStorage/XMLHttpRequest/fetch`). Use `OffscreenCanvas`/`createImageBitmap`. [VERIFIED: eslint.config.js Block A; scripts/verify/coreModuleState.js BANNED_GLOBALS]
- **Engine terms in source/comments.** `coreEngineNeutral.js` bans `tower/floor/loc/autopass/autotile/idnum/airwall/commonEvent/prefab/mota` (word-boundary, case-sensitive, comments included) in both libs' `src`. Do not embed legacy field names like `tower.main.images` as literals in `editor-impl/src`. [VERIFIED: scripts/verify/coreEngineNeutral.js:47-52,211]
- **Writing bytes straight to fs / `fetch`.** Not the panel's job. [VERIFIED: coreBoundaries.js BOTTOM_LAYER_IO_TOKENS]
- **Auto-save.** D-13/D-24 mandate manual save (matches the table's `ITablePanel.save` model).
- **Skipping the barrier.** Byte changes must not silently chain-undo earlier config edits (D-14).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| `.jsonc` parsing with a preserved comment header | A new JSON-stripping parser | `parseTableText` / `serializeTableText` (shared codec) | Exact system-prefix round-trip + `json5` fallback + three-way status already implemented & tested. [VERIFIED: tableText.ts:83-113] |
| JSON-Schema-driven config form | A fresh form renderer | The Phase-2 engine (`TableGrid` + control inference + `validateValue` + undo path) | Schema→control inference, ajv validation, x-order, undo all exist. |
| Listing a category / existence checks | Directory walking of your own | `context.listDirectory` / `IEditorFileSystem` via core | Core owns index + cache; core is the sole fs caller (D-04). |
| LRU content caching | A panel-level cache | `editor-core` `ContentCache` (8 MiB) | Already implemented. [VERIFIED: resource/types.ts:200] |
| Audio decode/mux/encode | WebCodecs `AudioDecoder`+`AudioEncoder`+muxer glue | Mediabunny `Conversion` | Handles decode, resample, remix, Opus encode, WebM mux, backpressure, cancel, progress. |
| Image encode to WebP | A wasm encoder | `OffscreenCanvas.convertToBlob({ type: 'image/webp', quality })` | Native, zero-dep; avoids banned `document`. |
| Category→dir/schema knowledge | Hard-coding mota-js layout into `asset` | Injection via capability seam (D-08/D-11) | Engine-neutrality is the milestone's core value; and the engine-term gate forbids the literals anyway. |

**Key insight:** Almost nothing in this phase should be built from scratch — the resource layer, the schema form, the `.jsonc` codec, the picker modal shell (`MultiSelectModal`), the empty-state inline pattern (`TablePicker`/`TableCreateForm`), and the manual-save/undo patterns all already exist in Phase 2. The phase's real work is **extraction, injection, and the two browser media paths**.

## Common Pitfalls

### Pitfall 1: Capability isolation vs. D-07 "reuse the table engine"
**What goes wrong:** `asset` imports `../table/...` and CI's `coreBoundaries.js` fails with `capabilities-must-not-import-each-other`.
**Why it happens:** The rule uses `from: src/(code|table|map|asset)/…` and `to: …(code|table|map|asset)…` with `pathNot: …/src/$1/…`, so `$1` resolves to the source capability — cross-capability imports are errors. [VERIFIED: .dependencyCruiser.cjs]
**How to avoid:** Extract the shared engine (grid, controls, model, `tableText`, `validation`, `fieldPath`) into a neutral module not named among the capabilities (e.g. `src/shared/**`), and have both `table` and `asset` import it. Note `react`/`shell` also must not import capabilities; `resources`/`edit` may be imported *by* capabilities but must not import them. **This relocation is an architecture-direction decision — needs user ratification in the interface phase.**
**Warning signs:** Any `import ... from '../table'` inside `src/asset/**`.

### Pitfall 2: `document` is banned in `editor-impl/src`
**What goes wrong:** Porting `CanvasRasterCodec` (which uses `document.createElement('canvas')` and `new Image()`) into `editor-impl/src` fails `coreModuleState.js` (and `pnpm lint`) at error level. [VERIFIED: eslint.config.js Block A; packages/apps/editor/src/project/assets/CanvasRasterCodec.ts:3-4,26-31]
**Why it happens:** PORT-02 extends to `editor-impl`, not just `editor-core`. `window` is allowed; `document` is not.
**How to avoid:** Use `new OffscreenCanvas(w, h)` + `getContext('2d')` + `convertToBlob({ type: 'image/webp', quality })`, and `createImageBitmap(blob)` for decode. Provide a fallback ($-$$ and a clear disabled state) where `OffscreenCanvas` is unavailable. Keep all canvas code inside `asset` (not `editor-core`).
**Warning signs:** `document.` anywhere under `packages/libs/editor-impl/src`.

### Pitfall 3: Engine-term literals fail `coreEngineNeutral.js`
**What goes wrong:** A built-in legacy Schema expressed in `editor-impl/src` that references legacy paths (`tower.main.images`, `prefab`, `commonEvent`) trips the banned-term scan; comments count too.
**Why it happens:** The gate matches `\b(term)\b` case-sensitively on raw source (excluding member-access `.floor` only). `mota` is safe inside `@motajs/...` because `\bmota\b` needs a boundary after `mota` (a `j` follows), but `tower`/`prefab` as standalone words are hit.
**How to avoid:** Keep the **legacy** engine-specific Schema **host-injected** (D-08 says assembly chooses the set) rather than literalized in `editor-impl/src`; or express legacy field names without the banned tokens. Re-run `node scripts/verify/coreEngineNeutral.js`.
**Warning signs:** new `tower`/`prefab`/`commonEvent` token in `src/asset/**` or its comments.

### Pitfall 4: WebCodecs availability varies; jsdom has no canvas/WebCodecs
**What goes wrong:** Audio transcode silently fails in Safari/Firefox variants; unit tests crash because `OffscreenCanvas`/`AudioEncoder` are undefined in jsdom.
**Why it happens:** `canEncode('opus')`/`OffscreenCanvas` are environment-dependent; jsdom 26 implements neither rendering nor WebCodecs.
**How to avoid:** Gate the UI on async capability detection (`canEncode('opus')`, `typeof OffscreenCanvas !== 'undefined'`); disable the 转码 entry with a message when unavailable (UI-SPEC: never a silent failure). Unit-test the transcode *orchestration* with a fake `ITranscodeService`; test the real path manually in the dev host / Playwright (Chromium).
**Warning signs:** unguarded `new OffscreenCanvas(...)` in a vitest file.

### Pitfall 5: Manual-save + prefix round-trip regressions
**What goes wrong:** Saving rewrites the `.list.jsonc` and drops the header comment block; or an edit is lost because `refresh` re-read overwrote in-memory changes.
**Why it happens:** Using `JSON.stringify` directly instead of `serializeTableText`; or re-reading on `onSwitchIn` while `unsaved` is true.
**How to avoid:** Always write via `serializeTableText(value, rememberedPrefix)`; follow the table's rule "有未落盘改动时不重读覆盖" (`TablePanel.refresh` guard). [VERIFIED: tablePanel.ts:1677-1682]
**Warning signs:** `writeContent(path, JSON.stringify(...))` for a `.jsonc`.

### Pitfall 6: Two export gates are currently red (stale registry path)
**What goes wrong:** `node scripts/verify/coreExports.js` and `implExports.js` fail now because both hard-code `.planning/phases/02-package-boundary-build-scaffolding/subpathStatus.json`, which was archived to `.planning/milestones/archived-20261009-phases/…`. `implExports` additionally asserts `sideEffects: false` and single-realpath peers that no longer hold, and expects `./asset` to be an `empty-barrel`. [VERIFIED: ran `node scripts/verify/implExports.js` → exit 1]
**Why it happens:** Registry/doc drift after the archive; these two scripts are **not** wired into `.github/workflows/ci.yml` (CI runs `coreBoundaries`, `coreModuleState`, `editorShims`, `coreEngineNeutral`, `coreImportType`, `coreExports` is in the typecheck job, plus `corePandaClass`/`coreReactCompiler`/`editorArtifactAssets`). Note `coreExports` **is** in CI but is currently red for the same stale path.
**How to avoid:** Do not rely on `implExports`/`coreExports` as green gates this phase; if the phase touches the `./asset` export surface, either fix the registry path (point at the archived file or current location) or explicitly scope it out and record the deviation. Keep `./asset` exports additive and mirror the `./table` barrel conventions.

### Pitfall 7: `ITablePanel`/form engine column layout assumes full width
**What goes wrong:** Embedding the table panel's `window.innerWidth`-driven multi-column layout inside the 320px detail column yields cramped/overflowing layout.
**Why it happens:** `TablePanelView` computes `count = max(1, floor(window.innerWidth / columnWidth))`. [VERIFIED: tablePanel.ts:304-306,514]
**How to avoid:** Adopt UI-SPEC F1 default — the config form takes over the **main area** (full width between grid and detail), with a「← 返回素材列表」breadcrumb, not the narrow detail column. Reuse the grid/model, not the whole multi-column panel shell.

---

## Code Examples

### New-engine content model (scope basis)

```typescript
// Source: E:/github/template/packages-user/client-modules/src/common.ts:50-97 (read this session)
export const enum TextureReadType { Full, Grid, RowAnimate, ColumnAnimate, ScanAnimate }
export const enum TextureUsage { CommonImage, Tile, Tileset }
export interface IClientTextureListConfig {
  readonly source: string;
  readonly read: TextureReadType;
  readonly usage: TextureUsage;
  readonly grid?: [width: number, height: number];
  readonly tiles?: number[];
}
export const enum ClientAudioType { BGM, Sound }
export interface IClientAudioListConfig { readonly type: ClientAudioType; readonly source: string; }
```

```typescript
// Source: E:/github/template/packages-user/client-modules/src/common.ts:3-33 (IClientContentDefaultConfig / IClientContentConfig)
// defaults paths + per-category dir + list-dir paths are ALL strings in the engine config —
// a natural shape for the injected category→dir/listPath mapping (D-11).
```

> ⚠️ The template's actual `content/*/.list.jsonc` bodies are **not yet aligned** to these types (e.g. `texture/.list.jsonc` still uses a legacy `{ type, source, map, width, height }` shape; `audio/.list.jsonc` is `{}`; `animation`/`font` are `string[]`). CONTEXT instructs: **trust the types, not the unaligned file bodies**. [VERIFIED: read of `E:/github/template/src/content/{texture,audio,animation,font}/.list.jsonc`]

### Category list file shape (prefix + JSON body)

```jsonc
// Source: E:/github/template/src/content/texture/.list.jsonc (first lines, read this session)
// Type: packages-user/client-modules/src/common.ts IClientTextureListConfig
// --- SYSTEM PREFIX END --- //
{ "textures": [ /* … */ ] }
```
The marker line is exactly `// --- SYSTEM PREFIX END --- //`, matching `SYSTEM_PREFIX_END_MARKER`. [VERIFIED: packages/libs/editor-impl/src/table/model/tableText.ts:8]

### Image → WebP (browser, no `document`)

```typescript
// Pattern: OffscreenCanvas is not in the banned-globals list; document is. (eslint.config.js Block A)
async function imageToWebp(bytes: Uint8Array, quality01: number): Promise<Uint8Array> {
  const bitmap = await createImageBitmap(new Blob([bytes]));
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('OffscreenCanvas 2D unavailable');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const blob = await canvas.convertToBlob({ type: 'image/webp', quality: quality01 });
  return new Uint8Array(await blob.arrayBuffer());
}
```

### Audio → WebM/Opus (Mediabunny)

```typescript
// Source: https://mediabunny.dev/guide/converting-media-files + /guide/supported-formats-and-codecs (fetched this session)
import { Input, Output, Conversion, ALL_FORMATS, BlobSource, BufferTarget, WebMOutputFormat, Quality, canEncode } from 'mediabunny';

// Capability gate — disable the entry when false (UI-SPEC: never silent failure).
const canOpus = await canEncode('opus'); // => Promise<boolean>

async function audioToWebmOpus(
  bytes: Uint8Array,
  opts: { bitrate: number; sampleRate: number },
): Promise<Uint8Array> {
  const input = new Input({ source: new BlobSource(new Blob([bytes])), formats: ALL_FORMATS });
  const output = new Output({ format: new WebMOutputFormat(), target: new BufferTarget() });
  const conversion = await Conversion.init({
    input,
    output,
    audio: { codec: 'opus', quality: new Quality({ bitrate: opts.bitrate }), sampleRate: opts.sampleRate },
  });
  if (!conversion.isValid) throw new Error('无法转码：环境不支持 Opus');
  conversion.onProgress = (p) => { /* 0..1 for batch progress UI */ };
  await conversion.execute();
  return new Uint8Array(output.target.buffer!);
}
```
Key API facts confirmed from official docs: `WebMOutputFormat`, `BufferTarget.buffer`, `BlobSource`, `Conversion.init({ input, output, audio })`, audio options `{ codec, quality, numberOfChannels, sampleRate, forceTranscode }`, `Quality({ bitrate })` / `new Quality('medium')` / `new Quality(0..1)`, `canEncode('opus')`, `conversion.isValid`/`discardedTracks`/`onProgress`/`execute`/`cancel`. Opus is containable in `.webm`. [CITED: https://mediabunny.dev/guide/converting-media-files, /guide/supported-formats-and-codecs, /guide/media-sources]

### Capability seam (injection, engine-neutral)

```typescript
// Pattern mirrors packages/libs/editor-impl/src/react/capabilities.ts:33-82 (IMultiSelectOpener + ITableEditorCapabilities)
export interface IAssetCategory {
  readonly id: string;          // e.g. 'texture'
  readonly label: string;       // e.g. '图片'
  readonly dir: string;         // list/byte directory, e.g. 'content/texture'
  readonly listPath: string;    // e.g. 'content/texture/.list.jsonc'
  readonly kind: AssetCategoryKind; // Image | Audio | Animation | Font
}
export interface IAssetSchemaSet { readonly legacy: ITableSchemaNode; readonly engine: ITableSchemaNode; }
export interface IAssetEditorCapabilities {
  readonly categories?: readonly IAssetCategory[];
  readonly schemas?: IAssetSchemaSet;                 // D-08; assembly picks legacy vs new-engine
  readonly defaultsPathResolver?: (categoryId: string) => string; // D-10
}
```

### Dev-host wiring (seed + register + capabilities)

```typescript
// Pattern: packages/apps/editor-dev/src/main.tsx:25-45 (read this session)
const core = new EditorCore();
const backend = new MemoryBackend();
backend.seed('content/texture/.list.jsonc', '// --- SYSTEM PREFIX END --- //\n{ "textures": [] }');
backend.seed('content/texture/sample.png', pngBytes); // Uint8Array
core.shellSystem.registerPanelType(assetPanelType);
await core.initialize({ fs: backend, maxUndoStep: backend.maxUndoStep, ignore: ['node_modules', '.git'] });
createRoot(root).render(
  createElement(CapabilityProvider, {
    capabilities: { tablePanel: createTablePanelOpener(core), tablePresets: TABLE_PRESETS, /* asset: … */ },
    children: createElement(core.shellSystem.render()),
  }),
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Resource id = (type number, id string); `requestResourceList(type)` | Resource id = pure file path; `listDirectory` / index | Phase 2.1 (completed 2026-10-17) | Asset listing must use `listDirectory`; no type registry. |
| Auto-save on every edit | Manual save (`save()`), `.jsonc` prefix preserved verbatim | Phase 2.1 (D-24) | Panel needs a 保存 button + unsaved state; config edits held in memory. |
| Old editor: merge images into one sheet, split by row; material/resource split | New engine: big categories, per-asset config, `TextureReadType`/`Usage` | Phase 3 direction revision (CONTEXT §F) | Split-image / logical-split / tileset-order UIs are **out of scope** (UI-SPEC §范围外). |
| Old editor BGM vs sound-effect as separate material types | Unified 音频 category, `ClientAudioType` config distinguishes | CONTEXT D-18 | One category, one schema with a `type` field. |
| `webm-muxer`/`mp4-muxer` (author's earlier libs) | Mediabunny (unified toolkit) | Library evolution | Single API for decode+encode+mux; supports conversion API. [CITED: mediabunny.dev/guide/introduction] |

**Deprecated/outdated:**
- "合并成一张图 / 按行拆分 / 图块顺序拖拽 / 注册复选框" — explicitly excluded for Phase 3 (UI-SPEC §范围外).
- `IResourceIdentifier` as `{ path: string }` or `(type, id)` — replaced by `type IResourceIdentifier = string`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The shared schema-form engine can be relocated to a neutral `src/shared/**` module without breaking the `./table` public surface or existing table tests. | Pitfall 1 / Recommended Structure | If not, the interface phase must instead amend `.dependencyCruiser.cjs` (weakens a hard boundary) or keep a thin duplicated codec. Medium impact. |
| A2 | `OffscreenCanvas.convertToBlob({ type: 'image/webp' })` is available in the project's target browsers (Chromium primarily) and acceptable for the dev-host/Playwright acceptance path. | Pitfall 2/4, Code Examples | If a target browser lacks it, need a fallback encoder or a scoped exemption from the `document` gate. |
| A3 | Mediabunny (`mediabunny@1.61.6`, MPL-2.0) is acceptable as a new runtime dependency. | Standard Stack / Legitimacy Audit | If license/dependency is rejected, D-20's audio-transcode path must change (costly per D-20). |
| A4 | `canEncode('opus')` is the correct gate for enabling audio transcode (vs. feature-detecting `AudioEncoder` directly). | Pitfall 4 | Wrong gate → entry enabled where transcode fails. Low impact (both are checks). |
| A5 | The barrier for non-undoable byte changes can be represented by extending the undo contract (e.g. a barrier flag on the undo entry, or a panel `canUndo` signal) — exact shape TBD in the interface phase. | Pitfall 6 / Open Questions | Wrong shape → rework of the undo契约 (one-way per D-15). Medium. |
| A6 | The legacy schema set is injected by the host (not literalized in `editor-impl/src`) so it doesn't trip `coreEngineNeutral`. | Pitfall 3 | If the legacy set must be built-in, its field names must avoid the banned tokens. Medium. |
| A7 | "与现状一致" is satisfied by the UI-SPEC token/structure re-expression, not pixel 1:1 (UI-SPEC §对齐说明 + F5). | Scope | If exact pixel parity is required, adopt UI-SPEC F5 legacy variables. Low. |

## Open Questions

1. **Where does the shared schema-form engine live? (BLOCKING)**
   - What we know: D-07 requires reuse; `.dependencyCruiser.cjs` forbids `asset → table`; the engine is currently under `src/table/**` (`TableGrid`, `model/*`, `tableText.ts`, controls, `validation`).
   - What's unclear: whether to (a) extract to a neutral `src/shared/**`, (b) amend the boundary rule for a whitelisted shared subpath, or (c) keep the form inside the host.
   - Recommendation: (a) — extract to `src/shared/**`; ratify as an architecture decision in the interface phase. This touches "direction is the user's call".

2. **How is the undo barrier modelled? (BLOCKING for D-14/D-15)**
   - What we know: `IUndoSystem.undo(): Promise<void>` today; D-15 wants `Promise<boolean>`; byte changes must stop undo at a barrier and report「无法撤销」.
   - What's unclear: how the `UndoSystem` learns an entry is a barrier (flag on `IUndoContext`? a new `IUndoable.canUndo(context)`? an `IUndoContext.barrier`?).
   - Recommendation: decide the exact shape in the interface plan and record it in `INTERFACE-NAME.md`; keep `undo`/`redo` signature change minimal (add boolean return; existing `void` callers unaffected).

3. **Picker capability: new field or extend `IMultiSelectOpener`? (UI-SPEC F8)**
   - What we know: `IMultiSelectOpener` already powers the table's `Material`/`MultiSelect` external editors via `CapabilityProvider` + `MultiSelectModal`. [VERIFIED: TableRow.tsx:45,166-172; capabilities.ts:33-40]
   - What's unclear: whether asset thumbnails/audio-preview warrant a separate `asset` capability or an enriched `IMultiSelectItem`.
   - Recommendation: add an `asset` capability field that reuses the modal shell, matching F8's leaning.

4. **Exact convention filenames for per-category schema + list.**
   - What we know: lists are `.list.jsonc`; schema convention is `xxx.schema.json(c)`; D-09 wants a fixed per-category filename like `.schema.jsonc`.
   - Recommendation: propose names in `INTERFACE-NAME.md` (e.g. list `.list.jsonc`, category schema `.schema.jsonc`, defaults `<category>.jsonc`) and confirm.

5. **Transcode parameter defaults (UI-SPEC F6).**
   - What we know: WebP quality; audio bitrate/sample rate configurable.
   - Recommendation: propose defaults (e.g. WebP 80; Opus 96 kbps @ 48000 Hz — Opus prefers 48 kHz; Mediabunny examples use e.g. `128e3`).

6. **Byte-write timing (D-25).**
   - What we know: byte changes are non-undoable barriers; timing (write-on-upload vs. write-on-save) is deferred to planning.
   - Recommendation: write bytes immediately on upload/replace/delete (bytes are not part of the in-memory manual-save buffer), keeping only list/config edits in the manual-save buffer; document the choice.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build/test | ✓ (CI pins 24) | 24 | — |
| pnpm | Workspace | ✓ | ≥12.5.1 | — |
| TypeScript | Typecheck | ✓ | catalog `^6.0.3` (declared) / repo `5.9.x` toolchain | Mediabunny types require TS ≥5.7 — satisfied. |
| jsdom | Unit tests | ✓ | 26.1.0 | — |
| `mediabunny` | Audio transcode | ✗ (not yet installed) | — | Must add + catalog + human-verify; until then audio transcode unavailable. |
| `OffscreenCanvas` | Image→WebP | Runtime/browser-dependent | — | Disable 图片转码 entry + message where unsupported. |
| WebCodecs `AudioEncoder`/Opus | Audio transcode | Runtime/browser-dependent (Chromium: yes) | — | Gate on `canEncode('opus')`; disable + message. |

**Missing dependencies with no fallback:**
- `mediabunny` (install-gated behind human-verify). Until accepted, the audio 瘦身转码 feature is not deliverable.

**Missing dependencies with fallback:**
- `OffscreenCanvas` / WebCodecs — runtime feature detection with graceful disable (no silent failure).

---

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json` → this section is required.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x + jsdom 26.1.0 + `@testing-library/react` 16.3.2 (React Compiler via `babel-plugin-react-compiler`) |
| Config file | `packages/libs/editor-impl/vitest.config.ts` [VERIFIED: read this session — `environment: 'jsdom'`, `include: ['src/**/*.test.{ts,tsx}']`, `setupFiles: ['src/__tests__/mapPolyfill.ts']`, `css: true`] |
| Quick run command | `pnpm --filter @motajs/editor-impl test -- src/asset` (or `vitest run src/asset/<file>.test.tsx`) |
| Full suite command | `pnpm test` (root, `pnpm -r run test`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ASSET-01 | List a category (list file + directory scan) renders grid populated/empty/loading/error/partial | integration (jsdom, FakeFileSystem) | `vitest run src/asset/__tests__/assetPanel.test.tsx` | ❌ Wave 0 |
| ASSET-01 | Add (upload) a file → new byte resource + list entry appended; unsaved until 保存 | integration | `vitest run src/asset/__tests__/assetLifecycle.uat.test.tsx` | ❌ Wave 0 |
| ASSET-01 | Replace bytes / delete (byte + list entry) with confirm | integration | same file | ❌ Wave 0 |
| ASSET-01 | Save writes list with verbatim `.jsonc` prefix; reload still shows changes | unit + integration | `vitest run src/shared/jsonc/__tests__` + lifecycle | ❌ Wave 0 |
| ASSET-01 | Config form edits are undoable; byte changes are a barrier (undo returns false, no chain-skip) | integration | `vitest run src/asset/__tests__/assetUndo.uat.test.tsx` | ❌ Wave 0 |
| ASSET-01 | Schema resolution: engine-supplied `.schema.jsonc` wins, else built-in fallback | unit | `vitest run src/asset/model/__tests__` | ❌ Wave 0 |
| ASSET-01 | Transcode orchestration (batch, cover-old rename `{file}-origin.{ext}`, override confirm) with a fake `ITranscodeService` | integration | `vitest run src/asset/__tests__/transcode.uat.test.tsx` | ❌ Wave 0 |
| ASSET-01 | Picker returns selected ids; empty/loading/error states | integration | `vitest run src/asset/__tests__/assetPicker.test.tsx` | ❌ Wave 0 |
| ASSET-01 | Real WebP/Opus output (browser) | manual / dev-host + Playwright (editor app) | dev host browser; `vitest run src/asset/__tests__` cannot cover | ❌ manual |
| D-15 | `UndoSystem.undo()/redo()` return boolean; barrier stops undo | unit (editor-core) | `pnpm --filter @motajs/editor-core test` | ❌ Wave 0 (extend `undo/__tests__/undoSystem.test.ts`) |

### Sampling Rate
- **Per task commit:** targeted `vitest run <changed file>`
- **Per wave merge:** `pnpm --filter @motajs/editor-impl test` (+ `@motajs/editor-core test` when touching undo/shared)
- **Phase gate:** full `pnpm test` + `pnpm typecheck` + `pnpm lint` + live gates (`coreBoundaries`, `coreModuleState`, `coreEngineNeutral`, `coreImportType`, `editorShims`) green; manual dev-host UAT for browser-only transcode.

### Wave 0 Gaps
- [ ] `src/asset/__tests__/fixtures.ts` — reuse `FakeFileSystem` pattern (per `editor-impl/src/table/__tests__/fixtures.ts`) with `seed()` for list + bytes.
- [ ] `src/asset/__tests__/assetPanel.test.tsx` — list states + category switch + save.
- [ ] `src/asset/__tests__/assetLifecycle.uat.test.tsx` — add/replace/delete/persist.
- [ ] `src/asset/__tests__/assetUndo.uat.test.tsx` — config undo + byte barrier.
- [ ] `src/asset/__tests__/transcode.uat.test.tsx` — fake transcoder orchestration.
- [ ] `src/asset/__tests__/assetPicker.test.tsx`.
- [ ] `src/asset/model/__tests__` — schema resolution + defaults (`@required`) merge.
- [ ] `src/shared/jsonc/__tests__` — moved/added `.jsonc` codec tests (mirror `tableText.test.ts`).
- [ ] extend `packages/libs/editor-core/src/undo/__tests__/undoSystem.test.ts` for boolean return + barrier.
- [ ] A jsdom-safe canvas/WebCodecs guard test (assert entry disables gracefully when APIs absent).
- [ ] Dev-host manual UAT checklist (image→WebP, audio→WebM/Opus in Chromium).

## Security Domain

> `workflow.security_enforcement` is `true`; ASVS level 1.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface in this phase. |
| V3 Session Management | no | — |
| V4 Access Control | no | Single-user local editor. |
| V5 Input Validation | **yes** | `ajv` via the shared schema-form engine; asset entry values validated against category schema; reject `__proto__`/`constructor`/`prototype` field paths (already enforced in `fieldPath` writes — Phase 2 T-02-17). |
| V6 Cryptography | no | No hand-rolled crypto; transcoding is not a security boundary. |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|--------------------|
| Stored XSS via asset names/paths | Tampering | Render all names/paths as React text nodes; **never** `dangerouslySetInnerHTML` (UI-SPEC §无障碍与内容安全). |
| Path traversal on upload filename (`../../…`) | Tampering | Sanitize the uploaded filename before `createResource`; the injected `IEditorFileSystem`/`MemoryBackend` rejects any `..` segment (defense-in-depth). [VERIFIED: memoryBackend.ts:253-257] |
| Prototype pollution via config field paths | Tampering | Reuse `fieldPath` write guards (`__proto__`/`constructor`/`prototype`). |
| Malicious oversized upload / decompression bomb | DoS | Validate size/type before reading bytes; content cache is bounded (8 MiB LRU). |
| Transcode producing unusable/empty output | — | Check `conversion.isValid` + report per-item failures; do not overwrite originals without the explicit二次确认 (D-21). |
| Revealing host paths / engine internals | Info disclosure | Panel only knows injected `IAssetEditorCapabilities` + resource paths. |

## Sources

### Primary (HIGH confidence)
- Direct reads this session (repo source of truth):
  - `packages/libs/editor-core/src/resource/types.ts`, `fs/types.ts`, `panel/types.ts`, `undo/types.ts`, `undo/undoSystem.ts`, `index.ts`
  - `packages/libs/editor-impl/src/table/types.ts`, `tablePanel.ts`, `tablePanelType.ts`, `resourceType.ts`, `model/tableText.ts`, `react/types.ts`, `react/capabilities.ts`, `react/components/{CapabilityProvider,MultiSelectModal}.tsx`, `package.json`, `vitest.config.ts`
  - `packages/apps/editor-dev/src/{main.tsx,backend/types.ts,backend/memoryBackend.ts,demo/devMenu.ts,demo/devCodeEditor.tsx,package.json}`
  - `.github/workflows/ci.yml`; `eslint.config.js`; `.dependencyCruiser.cjs`; `scripts/verify/{coreModuleState,coreBoundaries,coreEngineNeutral,implExports,coreExports}.js`; `pnpm-workspace.yaml`
  - `E:/github/template/packages-user/client-modules/src/common.ts`; `E:/github/template/src/content/{texture,audio,animation,font}/.list.jsonc`; `E:/github/template/src/content/defaults/*.jsonc`
  - `.planning/{REQUIREMENTS.md,ROADMAP.md,STATE.md,config.json}`; `.planning/phases/03-asset/{03-CONTEXT.md,03-UI-SPEC.md}`; `.planning/phases/02.1-resource-layer/{02.1-CONTEXT.md,INTERFACE-NAME.md}`
- npm registry (`npm view mediabunny`): version `1.61.6`, license `MPL-2.0`, `time.modified 2026-10-16`. [VERIFIED: npm registry]

### Secondary (MEDIUM confidence)
- Mediabunny official docs (fetched this session): `/guide/converting-media-files`, `/guide/supported-formats-and-codecs`, `/guide/media-sources`, `/guide/introduction` — API shapes, Opus-in-WebM compatibility, `canEncode`, `Quality`. [CITED: mediabunny.dev]
- Package-legitimacy seam verdict: `mediabunny` = `SUS` (reason `too-new`), ~4.0M weekly downloads, repo present, no postinstall.

### Tertiary (LOW confidence)
- Prevalence of `OffscreenCanvas` WebP encode across all target browsers (Chromium assumed primary; verify during dev-host UAT).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library is already declared except Mediabunny, whose version/license were verified on the registry and whose API is documented by the vendor. Residual risk is dependency acceptance (human-verify).
- Architecture: MEDIUM — the resource-layer, manual-save, and undo contracts are HIGH (read directly), but the capability-isolation vs. D-07 reuse tension and the undo-barrier shape need interface-phase decisions; `stable` only after those are locked.
- Pitfalls: HIGH — the gates (`coreModuleState`, `coreEngineNeutral`, `.dependencyCruiser.cjs`, CI workflow) and the stale-gate condition were read and, for `implExports`, executed this session.
- Scope/new-engine model: MEDIUM — the type contract in `common.ts` is verified, but the template's `.list.jsonc` bodies are explicitly unaligned; trust the types.

**Research date:** 2026-10-17
**Valid until:** ~30 days for repo contracts; ~7 days for Mediabunny / WebCodecs availability (fast-moving).

