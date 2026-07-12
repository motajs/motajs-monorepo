# 库开发指南

## 库设计原则

### API 设计

- 暴露单一的主入口函数
- 提供纯函数式的 API
- 避免副作用和全局状态

### 文件组织

- 使用 ESM 模块格式
- 每个模块职责单一
- 类型定义集中在 `types.ts`

### 日志和调试

提供可选的 logger 回调：

```typescript
interface Options {
  logger?: (message: string) => void;
}
```

## 推荐依赖

### 通用工具

- 工具函数：`es-toolkit`
- 文件操作：Node.js 内置 `fs/promises`

### 特定用途

- 压缩包：`archiver` 或 `jszip`
- JS 压缩：`terser`
- 图片处理：`sharp`

## 测试策略

- 使用 Vitest
- 单元测试覆盖核心逻辑
- 集成测试使用真实样例数据
- 遵循项目测试指南（testing.md）