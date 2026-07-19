# Mota Service Worker

网页版的启动服务, 基于 [service worker](https://developer.mozilla.org/zh-CN/docs/Web/API/Service_Worker_API) 和 [file system access api](https://developer.mozilla.org/zh-CN/docs/Web/API/File_System_API) 实现启动服务, 包括静态文件服务和 mota-fs 接口.

## Build

Service Worker 构建只包含工程宿主、权限、文件 API 和预览路由，不包含 Editor：

```bash
pnpm build
```

构建 monorepo 中的 `@motajs/editor`，并将标准 artifact staged 到部署目录：

```bash
pnpm build:with-editor
```

该命令依次构建 Editor、Service Worker，再执行：

```bash
pnpm stage:editor
```

`stage:editor` 默认读取相邻的 `packages/apps/editor/dist`。只有需要验证其他 artifact 时，才使用 `MOTA_EDITOR_ARTIFACT=/absolute/path/to/dist` 覆盖。

线上独立发布应将输出指向不会被 Worker build 清空的持久化静态目录：

```bash
MOTA_EDITOR_OUTPUT=/var/www/server/static/editor \
pnpm stage:editor
```

staging 会校验 manifest v2、buildId、文件清单和 SHA-256，并生成：

```text
dist/static/editor/
  current.json
  releases/<buildId>/
    editor-manifest.json
    index.html
    runtime.html
    assets/**
```

Service Worker 运行时读取 `current.json`，向 release 的 `index.html` 注入当前工程的 FS、Runtime、preview、docs、project URL、运行中 release 身份和只读更新检测 URL。线上 buildId 已完整缓存在本地时直接复用该 release；缓存资源意外缺失时按 manifest 校验回源内容，修复失败则撤销该 build 的离线资格，避免继续把半成品视为完整版本。更新检测只比较当前 buildId 与可用 buildId；用户确认后由 Editor 刷新页面，仍由既有 release 解析流程加载新版本，不另设更新执行接口。指针同时记录上一 build 供回滚和保留策略使用。Editor 文件和 buildId 不进入 `service-worker.js`，因此后续可以只上传新 release 并原子替换 `current.json`，不重新构建或更新 Service Worker。

生产环境至少保留当前和上一份 release；更旧版本由 staging 在七天后清理，避免仍打开的旧标签页请求动态资源时出现 404。上传 release 必须使用追加式同步，不能对远端 `releases/` 使用 `--delete`。浏览器侧只保留最近两份完整且校验通过的离线缓存。

## Deploy

本机已配置 `h5test` SSH alias 时，可以从本 package 直接构建、原子部署并用真实浏览器验证：

```bash
pnpm deploy:h5test
```

默认目标是 `h5test:/var/www/doc/server`，公开地址是 `https://mota.press/server/`。部署过程先上传到同级临时目录，核对 Service Worker SHA-256 和 Editor manifest 后再原子切换；成功后只保留当前及上一份 Editor release，不保留整站备份。可用 `DEPLOY_HOST`、`DEPLOY_SSH_PORT`、`DEPLOY_ROOT` 和 `DEPLOY_URL` 覆盖目标。

仓库内的 `.github/workflows/deploy-editor-h5test.yml` 提供手动 `workflow_dispatch` 发布。GitHub `h5test` environment 需要配置：

- `H5TEST_SSH_HOST`
- `H5TEST_SSH_USER`
- `H5TEST_SSH_PRIVATE_KEY`
- `H5TEST_SSH_PORT`（可选，默认 22）

流水线会先执行 Service Worker typecheck 和 Vitest，再构建 Editor 集成包、原子部署，并校验线上 `current.json`、manifest、Service Worker controller 与 scope。
