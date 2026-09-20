# Editor 包技术报告：功能、外部文件通信与可定制接口

> 适用对象：需要集成、托管或扩展 `@motajs/editor` 的开发者。
> 代码位置：`packages/apps/editor`。文中引用均相对该目录，格式为 `文件:行号`。

## 1. 定位与功能总览

`@motajs/editor` 是一个现代 mota-js 工程编辑器前端应用（Vite + React 19 + TypeScript）。它**不内置游戏引擎或样板工程**，而是把编辑器作为纯静态产物部署，由宿主（本地开发服务器、平台服务或 IDE 插件）通过运行时注入的方式提供工程文件与游戏预览能力。

编辑器提供的能力：

- **地图编辑**：基于 Pixi 渲染的楼层地图、图块（loc）、图层与通行性编辑。
- **数据表编辑**：全塔属性（tower）、物品（items）、敌人（enemys）、图块属性（maps）、图标（icons）等 `project/*.js` 数据，使用声明式 Table Schema 投影 UI。
- **脚本编辑**：函数（`project/functions.js`）与插件（`project/plugins.js`），基于 Monaco。
- **事件编辑**：Blockly 声明式 schema + 双向 codec，生成/解析事件脚本。
- **公共事件**：`project/events.js` 的 `commonEvent` 子结构。
- **素材管理**：图片素材、动画（animates）、自动元件（autotile）等二进制资源。
- **运行时预览**：在隔离 iframe 内启动真实 mota-js runtime，预览 UI 事件、状态栏、语言快照。
- **编辑历史**：全局 operation history，支持 undo/redo 与多文件回滚。
- **异步持久化**：内存优先、去重合并、失败可重试的文件写入。

架构分层（见根 `README.md:9-18`）：

```text
ProjectData / ProjectAssets -> ProjectModel -> Commands -> PanelModel / UI
```

- Resource 层：工程数据、二进制素材、缓存、恢复与异步持久化。
- Model 层：把 mota-js 磁盘格式转换为编辑器语义，并产出诊断。
- Commands 层：表达所有编辑意图，接入 operation history。
- UI 层：不直接依赖文件 handler，也不访问宿主的 `core/main/editor`。

---

## 2. 与外部世界的通信：三类通道

编辑器与外部文件/宿主之间的通信归纳为三条独立通道：

| 通道 | 传输方式 | 方向 | 负责内容 |
| --- | --- | --- | --- |
| 宿主配置注入 | 页面内 `script#mota-editor-environment`（JSON） | 宿主 → 编辑器 | 告知编辑器各类端点 URL（fs/runtime/preview/docs/project/update） |
| 文件系统 fs 通道 | HTTP POST 表单（`form-urlencoded`） | 编辑器 ↔ 宿主后端 | 工程文本/二进制文件的读写、目录、移动、删除、热重载 |
| Runtime 通道 | `MessageChannel`（iframe + 结构化克隆） | 编辑器 ↔ runtime iframe | 资源按需拉取、UI/状态栏预览、语言快照、热更新通知 |

三者解耦：runtime 不可用不会阻止核心面板、地图和代码编辑器启动（`README.md:18`）。

---

## 3. 宿主配置注入（Environment Protocol v1）

### 3.1 唯一入口

宿主配置的唯一入口是 `index.html` 中的：

```html
<script id="mota-editor-environment" type="application/json">
  { "protocolVersion": 1, "endpoints": { ... } }
</script>
```

默认开发配置见 `index.html:11-22`。编辑器在启动时于 `src/main.tsx:14` 调用 `initializeEditorEnvironment()` 解析；失败时渲染启动错误页（`src/main.tsx:24-26`）。

### 3.2 数据结构

`src/environment.ts:9-20` 定义：

```ts
export interface EditorEnvironment {
  protocolVersion: 1;
  release?: EditorReleaseIdentity;   // { buildId, version }
  endpoints: {
    fs: string;
    runtime: string;
    preview: string;
    docs?: string;
    project: string;
    update?: string;
  };
}
```

- 必填端点：`fs`、`runtime`、`preview`、`project`。
- 可选端点：`docs`（帮助文档）、`update`（编辑器自更新能力）。
- 所有端点 URL 以注入文档的 `baseURI` 为基准解析（`src/environment.ts:71,82`），支持相对路径，便于宿主把编辑器挂载在任意子路径下。

### 3.3 各端点职责

| 端点 | 用途 | 代码入口 |
| --- | --- | --- |
| `fs` | 文件系统 API 基址，所有读写请求都 POST 到该基址下的 `readFile`/`writeFile` 等子路径 | `src/services/fs/fs.ts:116` |
| `runtime` | `runtime.html`（隔离 bridge）地址 | `src/runtime/RuntimeProvider.tsx:80-83` |
| `preview` | 游戏入口 `game.html`，既用于“前往游戏”按钮，也作为握手时传给 runtime 的 `previewUrl` | `src/Workbench/AppTopBar.tsx:305`、`src/runtime/RuntimeProvider.tsx:151` |
| `docs` | 帮助文档基址；Blockly 帮助链接、API 文档链接 | `src/blockly/registry/index.ts:755`、`src/Workbench/CodeEditor/index.tsx:242` |
| `project` | 返回工程管理页/宿主首页的地址 | `src/Workbench/AppTopBar.tsx:253` |
| `update` | 编辑器发行版更新检查/激活接口 | `src/Workbench/editorUpdate.ts:81` |

辅助函数：`editorEndpoint(name, path)`（`src/environment.ts:104`）与 `editorDocsEndpoint(path)`（`src/environment.ts:108`）。

### 3.4 校验与兼容策略

`parseEditorEnvironment`（`src/environment.ts:42-93`）严格校验：

- 必须**恰好存在一个** `#mota-editor-environment` 节点（`src/environment.ts:43-46`）。
- JSON 必须可解析且为对象，`protocolVersion` 必须为 `1`（`src/environment.ts:56-58`）。
- 必填端点必须为非空 URL；可选端点在出现时同样必须为非空 URL（`src/environment.ts:65-86`）。
- `release` 出现时 `buildId`/`version` 均须非空（`src/environment.ts:27-40`）。

校验用例见 `src/environment.test.ts`。宿主不需要向编辑器暴露宿主类型或工程 ID——编辑器只认识 URL。

---

## 4. 文件系统通道（fs）

这是编辑器与“外部文件”沟通的**核心**。所有工程文件访问都经过 `Fs` 接口，默认实现将操作转换为 HTTP 请求发往宿主。

### 4.1 客户端 API

`src/services/fs/fs.ts:23-44` 定义两种风格：

```ts
export interface FsPromiseApi {
  readFile(filename, encoding): Promise<string>;
  readFileBinary(filename): Promise<ArrayBuffer>;
  writeFile(filename, data, encoding): Promise<void>;
  writeMultiFiles(filenames, dataList): Promise<void>;
  readdir(path): Promise<string[]>;
  mkdir(path): Promise<void>;
  moveFile(src, dest): Promise<void>;
  deleteFile(path): Promise<void>;
}

export interface Fs {
  readFile(filename, encoding, callback): void;
  writeFile(filename, data, encoding, callback): void;
  writeMultiFiles(filenames, dataList, callback): void;
  readdir(path, callback): void;
  mkdir(path, callback): void;
  moveFile(src, dest, callback): void;
  deleteFile(path, callback): void;
  promises: FsPromiseApi;
}
```

- 回调风格保留旧编辑器兼容性；`fs.promises` 为推荐用法（`src/services/fs/fs.ts:153-201`）。
- 编码支持 `"utf-8"` 与 `"base64"`；`readFileBinary` 内部经 base64 解码为 `ArrayBuffer`（`src/services/fs/fs.ts:51-68,160-163`）。

### 4.2 线上协议

客户端把参数编码为 `application/x-www-form-urlencoded`，POST 到 `${fs}/<endpoint>`（`src/services/fs/fs.ts:73-132`）。子端点：

| 子端点 | 参数 | 服务端行为 |
| --- | --- | --- |
| `readFile` | `type=utf8\|base64`, `name` | 读取文件，返回文本 |
| `writeFile` | `type`, `name`, `value` | 写入文件 |
| `writeMultiFiles` | `name`（`;` 连接）, `value`（`;` 连接） | 批量写入（base64） |
| `listFile` | `name` | 返回目录项的 JSON 数组 |
| `makeDir` | `name` | 递归创建目录 |
| `moveFile` | `src`, `dest` | 读 + 写 + 删 |
| `deleteFile` | `name` | 删除文件 |

服务端参考实现见 `vite-plugin-mota-server.ts:214-463`。除文件 CRUD 外，开发服务器还额外提供：

- `GET /game.html`：返回真实游戏入口，供 `preview` 端点使用（`vite-plugin-mota-server.ts:179-183`）。
- `GET /__all_floors__.js?id=...`：批量楼层脚本拼接（`vite-plugin-mota-server.ts:185-197`）。
- `GET /__all_animates__?id=...`：批量动画拼接（`vite-plugin-mota-server.ts:200-211`）。
- `POST /reload`、`/hotReload`：热重载状态与变更队列（`vite-plugin-mota-server.ts:330-353`）。
- `POST /replay*`：录像调试相关端点（`vite-plugin-mota-server.ts:356-462`）。

错误约定：服务端以 `error:` 前缀返回业务错误（`vite-plugin-mota-server.ts:226,259`），客户端在 `postData` 中据此判定失败（`src/services/fs/fs.ts:118`）。

### 4.3 安全边界（参考实现）

`vite-plugin-mota-server.ts:14-28` 的 `resolveFsPath` 做了路径穿越防护：

- 拒绝含 `\0`、`\`、绝对路径的 `name`；
- 拒绝 `.`/`..` 路径段；
- 通过 `path.relative` 确认解析结果仍位于 `motaRoot` 之内。

**这是参考实现，不是编辑器强制约束。** 宿主替换 `fs` 端点时必须自行实现等效的路径与权限校验（参见第 7.5 节）。

### 4.4 服务端配置来源

开发环境下 `MOTA_JS_ROOT` 指向 monorepo 的 `packages/external/mota-js` submodule，可用环境变量覆盖。`mota-root.ts:4-9` 要求该目录至少包含 `index.html`、`main.js`、`project/data.js`、`_server/table/data.comment.js`，否则启动即报错（`mota-root.ts:11-23`）。

---

## 5. 工程资源抽象：从文件到语义

fs 通道之上，编辑器用一套统一的响应式资源模型把文件包装成可订阅、可恢复、可持久化的对象。

### 5.1 统一状态 `Content<T>`

`src/fs/types.ts:8-13` 定义五态 Tagged Union：`idle | loading | loaded | not-found | error`。所有资源（文本、二进制、解析后的数据）都暴露 `ReadonlySignal<Content<T>>`。配套函数工具 `ContentUtils`（`src/fs/ContentUtils.ts`）提供 `map`/`andThen`/`unwrap` 等类 Rust 操作。

### 5.2 三个处理器层次

| 层次 | 类/接口 | 职责 | 位置 |
| --- | --- | --- | --- |
| 文本文件层 | `FileHandler` / `IContentHandler<string>` | 内存优先，按路径调度持久化 | `src/fs/FileHandler.ts` |
| 数据解析层 | `DataHandler<T>` / `IDataHandler<T>` | 在文本之上 parse/stringify，写入自动回归文本 | `src/fs/DataHandler.ts` |
| 二进制层 | `BinaryFileHandler` | 读取图片为 `HTMLImageElement`，只读 | `src/fs/BinaryFileHandler.ts` |

- `DataHandler` 使用 `computed` 自动追踪底层 `FileHandler`，parse 错误不会污染文件层（`src/fs/DataHandler.ts:36-47`）。
- 两种内置数据格式：`JsonDataHandler`（纯 JSON）与 `Json2xDataHandler`（`var <uuid> = {json}` 风格，依赖 `@motajs/file2x` 的 `decodeGameData2x`/`encodeGameData2x`，见 `src/fs/Json2xDataHandler.ts:39-60`）。
- `DataHandler.getFileHandler()` 允许解析失败时打开原始文本编辑（`src/fs/DataHandler.ts:148-150`），配合 `ContentBoundary` 的恢复 UI。
- 可恢复协议 `RecoverableResource` 规定 `raw()`（拿原始文本）与 `recoverable()`（`src/fs/interfaces.ts:73-78`）。

### 5.3 实例管理与并发

`FileHandlerManager`（`src/fs/FileHandlerManager.ts`）保证**同一路径只有一个 handler 实例**，并提供带加载锁的 `load`/`loadAll`，避免并发重复读取（`src/fs/FileHandlerManager.ts:48-88`）。`exists`/`delete`/`reload`/`clear` 等辅助方法齐备。

### 5.4 异步持久化

`FileHandler.update()` 只更新内存 signal，然后向 `PersistenceMonitor` 提交意图（`src/fs/FileHandler.ts:69-78`）：

```ts
persistenceMonitor.schedule(path, {
  kind: "write",
  execute: () => fs.promises.writeFile(path, value, "utf-8"),
});
```

- `PersistExecutor`（`src/fs/PersistExecutor.ts`）按路径串行：同一时刻一个执行中意图 + 最多一个待处理意图（后续写入覆盖前者），天然实现“去重 + 顺序”的写合并。
- 写入失败**不会回滚编辑器状态**，只记录为 `error` 并保留 `failedIntent` 供重试（`src/fs/PersistExecutor.ts:60-86`）。
- `PersistenceMonitor`（`src/fs/PersistenceMonitor.ts`）聚合全工程持久化状态，暴露 `persistingFiles` / `failedFiles` / `retrying` signal，并提供 `retryFailed`、`flush`、`hasUnsavedChanges`、`hasPersistErrors` 等边界 API。
- UI 侧由 `PersistenceNotification`（`src/components/PersistenceNotification.tsx`）展示，更新前会检查未保存/失败写入（`src/Workbench/AppTopBar.tsx:211-218`）。

### 5.5 DataResource：语义化工程数据

`DataResource<T>`（`src/project/data/DataResource.ts:22-34`）在 `IContentHandler` 之上增加 `raw`、`set`、`mutate`（Immer）、`patch`（Action 列表）、`persistStatus`。两种实现：

- `HandlerDataResource`：直接包裹某个 `IDataHandler`（`src/project/data/DataResource.ts:36-141`）。
- `MappedDataResource`：从父资源的子字段映射而来，写入时写回父资源；可对 action 路径加前缀（`src/project/data/DataResource.ts:143-267`）。典型例子是 `events.commonEvent`，路径前缀 `['commonEvent']`（`src/project/data/projectData.ts:211-223`）。

`ProjectDataImpl`（`src/project/data/projectData.ts:91-330`）注册全部核心数据资源（tower/items/enemys/maps/icons/functions/plugins/events、按需楼层、table meta），并提供带并发上限（6）的 `preloadAll()` 批量预加载与失败报告（`src/project/data/projectData.ts:50,247-314`）。

### 5.6 ProjectAssets：二进制素材

`ProjectAssets`（`src/project/assets/projectAssets.ts`）管理图片、目录、动画、素材集合，并通过可替换的 `RasterCodec`（`src/project/assets/types.ts:25-29`）做像素级编解码。`ImageAssetResourceLike` 支持 `setBytes`/`delete`（`src/project/assets/types.ts:31-37`），`MaterialCollectionResource` 支持 append/insert/replace/remove（`src/project/assets/types.ts:69-79`）。

### 5.7 ProjectModel：只读派生模型

`ProjectModel`（`src/project/model/projectModel.ts`）把原始数据派生成编辑语义：图块注册表 `BlockRegistry`、素材目录 `MaterialCatalog`、通行性、图块集目录、Blockly 补全目录、旗帜使用索引、状态栏图标等。派生层由 `computedResource` / `aggregateResource` / `optional` 组合（`src/project/resources.ts:122-155`），上层 UI 通过 `ModelResource<T>` 读取（`src/project/model/projectModel.ts:119`）。

---

## 6. Runtime 通道（iframe 预览）

Runtime 是唯一在隔离环境中执行真实 `core/main/editor` 的地方，通过 `MessageChannel` 与编辑器主应用通信，而非直接 DOM 访问。

### 6.1 握手与协议（Runtime Protocol v4）

`src/runtime/protocol.ts:4` 定义 `RUNTIME_PROTOCOL_VERSION = 4`。

握手流程（`src/runtime/RuntimeProvider.tsx:84-153`）：

1. 编辑器把 `runtime` 端点作为 iframe `src` 加载（附加 `?instance=<timestamp>` 防缓存）。
2. iframe `onload` 后创建 `MessageChannel`，通过 `postMessage` 发送 `RuntimeConnectMessage { type: "mota-runtime-connect", version: 4, previewUrl }`，并转移 port2。
3. `runtime.html`（`src/runtime/iframeEntry.ts:676-729`）收到连接后 `fetch(previewUrl)` 拉取游戏入口模板，注入 DOM，加载引擎脚本，初始化 runtime，然后回发 `{ type: "ready", version, instanceId }`。
4. 版本不匹配则拒绝（`src/runtime/RuntimeProvider.tsx:97-100`）。

运行时消息（`src/runtime/protocol.ts:84-99`）：

- iframe → 编辑器：`ready`、`fatal`、`diagnostic`、`response`、`resource`（资源请求）。
- 编辑器 → iframe：`render-ui`、`render-status-bar`、`language-snapshot`、`close-preview`、`resources-changed`、`resource-response`。

### 6.2 资源网关（按需、带版本）

`RuntimeResourceGateway`（`src/runtime/RuntimeResourceGateway.ts`）是编辑器侧的资源响应器：

- 仅允许 `project/` 前缀路径，否则拒绝（`src/runtime/RuntimeResourceGateway.ts:78,92`）。
- 文本资源优先经 `DataResource.raw()` 取原始文本并解析；二进制资源经 `ProjectAssets.image()` 取 `Uint8Array`（`src/runtime/RuntimeResourceGateway.ts:77-99`）。
- 每个响应携带单调递增 `revision`；订阅底层资源变化后，通过 `resources-changed` 通知 iframe 增量热更新（`src/runtime/RuntimeResourceGateway.ts:61-75`、`RuntimeProvider.tsx:27-36`，300ms 防抖）。
- iframe 侧 `hotReload`（`src/runtime/iframeEntry.ts:128-172`）按资源类型更新 runtime 的 `material`/`animates`/`bgms` 等，实现素材热替换。

这种设计意味着 **runtime iframe 从不直接请求 `/project/**`**（e2e 用此断言，见 `e2e/runtime-preview.spec.ts:10-13,50`），所有工程数据都经编辑器内存与 fs 通道中转。

### 6.3 对 runtime 的 hook 注入

iframeEntry 覆盖了若干引擎函数以重定向资源加载：

- `main.loadMod` / `main.loadFloors`：改为经资源通道拉取并 `eval`（`src/runtime/iframeEntry.ts:198-222`）。
- `loader.prototype.loadImage` / `_loadAnimates_sync` / `loadOneMusic` / `loadOneSound`：改为从资源通道取二进制并创建 Blob URL（`src/runtime/iframeEntry.ts:233-282`）。
- `main.importFonts`：用 `FontFace` + Blob URL 注入工程字体（`src/runtime/iframeEntry.ts:223-230`）。

### 6.4 编辑器侧能力接口

UI 通过 `useRuntimePreview()` 获取 `RuntimePreviewCapability`（`src/runtime/RuntimeContext.tsx:14-28`）：

- `state`：`starting | ready | updating | error`。
- `previewUI(request)`：渲染 UI 事件并返回可挂载的 `RuntimeSurfaceLease`（尺寸、`attach(container)`、`close()`）。
- `previewStatusBar(request)`：渲染状态栏预览。
- `languageSnapshot()`：从运行中的 runtime 反射出可用的函数/变量目录（供 Blockly/代码提示）。
- `retry()`：手动重试崩溃的 runtime。

崩溃策略：首次 `fatal` 自动重试一次，再次失败进入 `error`，UI 显示 fallback 与手动重试按钮（`RuntimeProvider.tsx:106-117,256-259`；e2e 见 `e2e/runtime-preview.spec.ts:91-131`）。

---

## 7. 可定制/可扩展的接口

编辑器把“可变部分”收敛为若干接口，宿主或二次开发者可在不修改 UI 的前提下替换实现。

### 7.1 文件系统实现 `Fs`（最高价值扩展点）

`FileHandler`、`BinaryFileHandler`、`ProjectAssets` 均接受可注入的 `Fs`（默认 `@/services/fs` 单例）：

- `FileHandler` 构造函数：`constructor(path, fs: Fs = defaultFs)`（`src/fs/FileHandler.ts:18`）。
- `BinaryFileHandler`：`constructor(path, fs?)`（`src/fs/BinaryFileHandler.ts:21`）。
- `ProjectAssets`：`constructor(fs = defaultFs, codec = new CanvasRasterCodec())`（`src/project/assets/projectAssets.ts:17`）。

通过注入自定义 `Fs`，可以把工程文件改成来自 IndexedDB、Service Worker、Zip、内存副本或云后端，而完全复用上层的缓存、解析、持久化与撤销逻辑。测试中即通过内存副本实现“不修改 submodule”（根 `README.md:34`）。

替换实现时的契约要点：

- 读：`readFile` 在文件不存在时应产生可被 `isFileNotFoundError` 识别的错误（`src/fs/errors.ts:10-18`），以便映射为 `not-found` 状态而非 `error`。
- 写：`writeFile` 失败应 reject，交由 `PersistExecutor` 记录并重试，而不是静默吞掉。
- 路径：实现方负责路径规范化与越界防护（编辑器内部只做字符串拼接，见 `FileHandler.commit`/`load`）。

### 7.2 数据格式处理器 `IDataHandler<T>`

新增一种工程数据格式（例如自定义 JSON5、二进制结构）只需：

1. 继承 `DataHandler<T>` 并实现 `parse`/`stringify`（`src/fs/DataHandler.ts:23,59,66`）。
2. 在 `ProjectDataImpl` 中注册为 `HandlerDataResource`（参考 `projectData.ts:105-209`）。
3. 若字段需要独立暴露，使用 `MappedDataResource` 做映射（`projectData.ts:211-223`）。

内置示例：`JsonDataHandler`（纯 JSON）、`Json2xDataHandler`（`var` 包裹）、各 service 的特化 handler（如 `TowerDataHandler`，`src/services/tower/TowerDataHandler.ts`）。

### 7.3 资源与派生模型

- `computedResource(id, deps, computeContent, reloadDeps?)`：声明式派生资源（`src/project/resources.ts:122`）。
- `aggregateResource(id, deps, combine)`：多依赖聚合，任一未就绪则整体未就绪（`src/project/resources.ts:131`）。
- `optional(source, fallback)`：把 `not-found` 提升为默认值（`src/project/resources.ts:146`）。

新增只读模型/校验视图可挂在这一层，不触碰文件层。

### 7.4 编辑命令与历史

- `CommandResult` 统一结果（`src/project/commands/types.ts`）。
- `EditorOperation<T>`：`meta` + `targets` + `apply()`，`apply` 返回 `AppliedOperation`（含 `inverse` 逆操作）（`src/project/history/operations.ts:21-31`）。
- 组合与回滚：`compositeOperation`、`patchResourceOperation`、`operationPathTarget`（`src/project/history/operations.ts:143-165`）。
- `operationHistory.execute/undo/redo` 在执行前后捕获 `OperationTarget` 的 checkpoint，失败时自动回滚（`src/project/history/operationHistory.ts:100-188`），容量 100。

新增编辑功能应实现为一个 `EditorOperation` 并交给 `operationHistory.execute()`，从而自动获得撤销/重做与多文件一致性。

### 7.5 UI 声明式定制（Table Schema）

工程数据的表单 UI 由 JSON-compatible 的 Field/UI Schema 描述，可引用项目 model 但不拥有它们，且明确“不执行任意 JavaScript 字符串”（详见 `docs/table-schema-design.md:7-28`）。这是面向数据驱动定制的接口，与源码级扩展互补。

### 7.6 Runtime 能力

`RuntimePreviewCapability`（`src/runtime/RuntimeContext.tsx:14-20`）及其消息协议（`src/runtime/protocol.ts`）是宿主/插件驱动预览的稳定接口。若宿主自行实现 `runtime` 端点，必须遵守同一握手与消息格式，否则会被版本校验拒绝。

### 7.7 编辑器发行版与更新协议

- 构建产物为 `dist/`，包含 `index.html`、`runtime.html`、`editor-manifest.json` 与 `assets/`（`README.md:47-55`、`vite.config.ts:40-50`）。
- `editor-artifact-plugin.ts` 生成 manifest schema v2：列出文件、大小、SHA-256、`buildId`（内容哈希）、入口点与协议版本（`editor-artifact-plugin.ts:22-30,148-175`）。
- 更新接口协议 v2（`src/Workbench/editorUpdate.ts:17-75`）：GET 查询状态，POST `{ action: "check" | "activate" }`；编辑器检测到候选版本后**只提示刷新**，不直接执行平台更新（根 `README.md:57`；`AppTopBar.tsx:206-227`）。Service Worker 也可通过 `motajs-editor-release-state` 消息广播状态（`AppTopBar.tsx:94-101`）。

---

## 8. 扩展点速查表

| 想做什么 | 扩展点 | 位置 |
| --- | --- | --- |
| 换存储后端（云盘/内存/Zip） | 注入自定义 `Fs` | `src/fs/FileHandler.ts:18`、`src/project/assets/projectAssets.ts:17` |
| 新增工程数据文件格式 | 继承 `DataHandler<T>` + 注册 `HandlerDataResource` | `src/fs/DataHandler.ts`、`src/project/data/projectData.ts` |
| 暴露父文件的子字段为独立资源 | `MappedDataResource` | `src/project/data/DataResource.ts:143` |
| 增加只读派生/校验视图 | `computedResource`/`aggregateResource`/`optional` | `src/project/resources.ts:122-155` |
| 增加编辑动作（含撤销/重做） | 实现 `EditorOperation`，走 `operationHistory.execute` | `src/project/history/operations.ts`、`operationHistory.ts` |
| 替换像素编解码 | 实现 `RasterCodec` 并注入 `ProjectAssets` | `src/project/assets/types.ts:25` |
| 定制数据表 UI | Field/UI Schema（JSON） | `docs/table-schema-design.md` |
| 驱动运行时预览 | `useRuntimePreview()` / Runtime Protocol v4 | `src/runtime/RuntimeContext.tsx`、`protocol.ts` |
| 宿主接入编辑器 | `script#mota-editor-environment` Environment Protocol v1 | `src/environment.ts` |
| 编辑器版本更新 | `update` 端点 + Update Protocol v2 | `src/Workbench/editorUpdate.ts` |

---

## 9. 观察、边界与风险提示

1. **协议版本需三处一致**：Environment Protocol v1、Runtime Protocol v4、Editor Update Protocol v2 各自独立演进，宿主需分别对齐。注意 `editor-artifact-plugin.ts:26` 的 manifest 常量 `runtimeProtocolVersion: 3` 与 `src/runtime/protocol.ts:4` 的 `RUNTIME_PROTOCOL_VERSION = 4` **不一致**，建议核对并统一，否则宿主按 manifest 做校验时可能误判。
2. **安全责任在宿主**：`fs` 服务端的路径穿越防护仅存在于参考实现 `vite-plugin-mota-server.ts:14-28`。编辑器本身只负责拼接 `project/...` 之类相对路径，不提供沙箱或鉴权。生产宿主必须在服务端实现等价或更严格的白名单/权限校验。
3. **持久化是内存优先、最终一致**：`FileHandler.update` 立即更新 UI 状态但异步落盘；宿主在卸载/刷新/更新前应调用 `persistenceMonitor.flush()` 或检查 `hasUnsavedChanges()`（`src/project/PersistenceMonitor.ts:80-94`）。写入失败不回滚编辑状态，需要显式重试。
4. **Runtime 为可选能力**：核心编辑（面板、地图、代码）不依赖 runtime。宿主可以不提供可用的 runtime 端点，编辑器会进入 `error` 状态并展示 fallback，而不是整体不可用。
5. **`fs` Base64 约定**：二进制读写经 base64 字符串传输，大素材（图片/音频）会产生约 33% 体积膨胀与编码开销；对超大工程可考虑在自定义 `Fs` 中绕过该约定。
6. **开发/生产差异**：开发服务器（`vite-plugin-mota-server.ts`）额外提供 `game.html`、批量楼层/动画、热重载、录像等端点；生产宿主需要自行提供对应能力或禁用相关功能。

---

## 10. 相关文档

- 根包说明：`README.md`
- Table Schema 设计草案：`docs/table-schema-design.md`
- Table Schema 现有场景审计：`docs/table-schema-audit.md`
