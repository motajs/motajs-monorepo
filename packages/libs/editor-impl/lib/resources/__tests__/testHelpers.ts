// 测试辅助函数（core 本地版）
// 被搬入 core 的持久化测试原本从 editor 的 `@test` 测试夹具取 `wait`；core 不得引用该别名
// （`scripts/verify/coreBoundaries.js` 会因未解析说明符报错），故在此提供等价实现
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
