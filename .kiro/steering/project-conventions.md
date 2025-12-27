# 项目约定

## 包命名

- 所有包使用 `@motajs/` 前缀
- 应用放在 `packages/apps/`
- 库放在 `packages/libs/`

## 依赖管理

- 使用 pnpm catalog 统一管理依赖版本
- 工作区内部依赖使用 `workspace:*`
- 在 `pnpm-workspace.yaml` 的 `catalog` 中定义版本

## TypeScript 配置

- 应用继承 `@motajs/config/tsconfig.app.base.json`
- 库继承 `@motajs/config/tsconfig.lib.base.json`
- 路径别名：应用用 `@/*` 映射到 `src/*`，库用 `@/*` 映射到 `lib/*`

## 模块系统

- 所有包使用 ESM（`"type": "module"`）
- 使用 `.ts` 扩展名导入（`allowImportingTsExtensions`）

## 常用命令

- `pnpm run lint`：全局代码检查
- `pnpm run test`：在具体包目录下运行测试
- `pnpm run dev`：在应用目录下启动开发服务器
