/**
 * `.` subpath —— 引擎无关内核的入口。
 *
 * Phase 2 只保证它作为真实文件存在（D-01）：`exports` 指向不存在的文件是长期潜伏的隐性 bug。
 * 根 barrel 刻意保持惰性，不 re-export 任何能力 subpath——顶层 barrel 把每个 subpath 都拉进来
 * 会反转 D-06 的单向依赖 DAG（PITFALLS §16 反模式）。
 */
export {};
