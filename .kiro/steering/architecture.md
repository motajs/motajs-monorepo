# 项目架构

## 概述

这是一个基于 pnpm workspace 的 monorepo 项目，包名前缀为 `@motajs`。

## 目录结构

```
packages/
├── apps/          # 应用程序
│   └── service-worker/  # Service Worker 应用（Vite + React）
├── libs/          # 共享库
│   ├── config/    # 共享的 TypeScript 和构建配置
│   ├── utils/     # 通用工具函数
│   ├── h5animate/ # H5 动画编解码器
│   ├── file2x/    # 文件处理库
│   ├── react-hooks/      # React Hooks 集合
│   ├── react-store/      # React 状态管理
│   ├── react-dark-mode/  # 深色模式支持
│   ├── react-monaco-editor/  # Monaco 编辑器封装
│   ├── theme/     # 主题样式
│   └── packer/    # 打包工具
└── external/      # 外部依赖（如有）
```

## 技术栈

- 包管理：pnpm workspace + catalog 依赖管理
- 构建工具：Vite
- 语言：TypeScript（ESNext）
- 前端框架：React 19
- UI 组件库：Semi Design (@douyinfe/semi-ui)
- 样式：Less + CSS Modules
- 测试：Vitest
- 代码规范：ESLint + @stylistic

## 包间依赖关系

- `@motajs/config`：被所有其他包引用，提供基础配置
- `@motajs/utils`：被多个包引用的工具库
- `@motajs/react-hooks`：依赖 `@motajs/utils`
- `@motajs/react-store`：可选依赖 `@motajs/utils` 和 `@motajs/react-hooks`

## 应用结构（以 service-worker 为例）

```
src/
├── idl/       # 接口定义
├── server/    # Service Worker 服务端逻辑
├── view/      # React 视图组件
└── vite-env.d.ts  # 全局类型声明
```

## 库结构

- 源码目录：`lib/`（不是 `src/`）
- 入口文件：`lib/index.ts`
- 支持子路径导出：如 `@motajs/utils/advance/*`
