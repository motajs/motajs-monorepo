# Phase 05.2 遗留问题（deferred items）

本文件记录执行过程中发现、但**不属于当前计划范围**的问题。按 executor 的 scope boundary 规则，
不在发现它的那个计划里修复；留待对应范围的计划处理。

## 05.2-02 执行期间发现

### D-05.2-02-01：`editor-core` 一处 Prettier 格式错误（Plan 01 遗留）

- **文件：** `packages/libs/editor-core/lib/__tests__/diagnostics.test.ts`
- **位置：** 第 32 行第 115 列
- **现象：** `prettier/prettier` 报错 —— `Replace \`TypeError\` with \`⏎······TypeError,⏎····\``。
  该行在 05.2-01 的提交 `ee9ef9a` 中被改写（把 `severity` 断言改成枚举成员）时留下。
- **为何不在本计划修：** 属 `editor-core`，超出 05.2-02（`editor-impl` 接口层）的 `<files>` 范围；
  按 scope boundary 规则不修无关文件。应由 `editor-core` 侧的实现层扫尾计划（05.2-05）或收尾回归（05.2-09）处理。
- **影响：** 根 `pnpm lint`（`eslint .`）因此报 1 个 error 并退出码 1；与本计划三个目标文件无关
  （三个文件经 `pnpm exec eslint` 与 `prettier --check` 均干净）。
