# @motajs/editor

现代 mota-js 工程编辑器。编辑器自身不包含游戏引擎或样板工程；本地开发与测试使用 monorepo 根目录的 `packages/external/mota-js` submodule。

## Architecture

核心数据流为：

```text
ProjectData / ProjectAssets -> ProjectModel -> Commands -> PanelModel / UI
```

- Resource 层管理工程数据、二进制素材、缓存、恢复和异步持久化。
- Model 层将 mota-js 磁盘格式转换为编辑器语义，并提供诊断。
- Commands 表达所有编辑意图，并接入全局 operation history。
- UI 不直接依赖文件 handler 或父窗口中的 `core/main/editor`。

与旧编辑器相比，地图使用 Pixi 渲染，Blockly 使用声明式 schema 和双向 codec，Tern 定义由静态工程模型生成。mota-js runtime 运行在可选 iframe capability 中；runtime 不可用不会阻止核心面板、地图和代码编辑器启动。

`_server/table/*.comment.js` 与当前 `_server/config.json` 仍视为 mota-js 工程兼容文件。现代 schema 将作为独立协议设计，本应用不为旧 schema 引入额外 override 层。

## Development

首次拉取仓库后初始化 mota-js：

```bash
git submodule update --init packages/external/mota-js
pnpm install
pnpm --filter @motajs/editor dev
```

可用 `MOTA_JS_ROOT=/absolute/path/to/mota-js` 覆盖默认 submodule。该目录必须包含游戏入口、引擎、工程和旧 schema。开发服务器提供本地文件 API、`/game.html`、文档及 runtime 所需引擎资源。

测试写入均发生在内存工程副本中，不修改 submodule：

```bash
pnpm --filter @motajs/editor test
pnpm --filter @motajs/editor test:e2e
```

## Editor Artifact

```bash
pnpm --filter @motajs/editor build
```

标准构建只输出编辑器：

```text
dist/
  editor-manifest.json
  index.html
  runtime.html
  assets/
```

`index.html` 中的 `script#mota-editor-environment` 是唯一宿主配置入口。宿主通过该节点注入 FS、runtime、preview、docs 和 project URL；编辑器不识别宿主类型或工程 ID。

`runtime.html` 只包含隔离 bridge。引擎由 Runtime v2 握手中的 `previewUrl` 提供，工程数据和素材通过 ResourceGateway 传输。`editor-manifest.json` schema v2 列出全部 artifact 文件及 SHA-256，供宿主验证和独立版本发布。
