# 代码风格指南

## 注释

请使用中文

## 导入路径

- 跨模块导入使用 `@` 绝对路径：`import { x } from '@/utils/xxx'`
- 同模块内可用相对路径：`./DataStore`、`../types`
- 工作区包导入：`import { x } from '@motajs/utils'`

## 类型声明

- 全局变量类型集中在 `src/vite-env.d.ts`（应用）或 `lib/types.ts`（库）
- 优先使用 `@types/xxx` 包
- 类型从源模块导入：`import type { Xxx } from "@/path/to/module"`

## React 组件

- 使用 `const XX: FC<Props> = (props) => {}` 声明组件
- props 在函数体内解构：`const { ... } = props;`
- 样式使用 CSS Modules（`.module.less`）

## ESLint 规则要点

- 使用双引号
- 缩进 2 空格
- 必须分号结尾
- 箭头函数参数必须加括号
- React Hooks 依赖检查启用（含自定义稳定 hooks）
