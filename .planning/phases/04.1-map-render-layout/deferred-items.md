# 04.1 阶段：范围外发现（未处理）

按 GSD 的 scope boundary：只修当前任务直接造成的问题，既有问题记录在此、不动。

## 1. `packages/apps/editor-dev/src/backend/mapFiles.ts` 存在既有格式偏差

- **发现于：** Plan 01 / Task 3（落地 `IMapFileRecord.cellWidth?` / `.cellHeight?`）
- **现象：** `npx prettier --check packages/apps/editor-dev/src/backend/mapFiles.ts` 非零退出；prettier 想把这行合成一行，而仓库里是拆开的：
  ```ts
  export function applyMapPropertiesSection(
    record: IMapFileRecord,
    properties: Record<string, unknown>,
  ): IMapFileRecord {
  ```
- **判定为既有问题：** 本计划在该文件的改动只落在第 43–48 行（`IMapFileRecord` 的两个可选字段），首处格式差异在更后面的函数签名上，与本次改动无关。
- **影响：** 若将来把 `pnpm lint` 作为门禁，该文件会先红；不影响本阶段任何 verify 命令（`typecheck` 与两条结构门禁均不看 Prettier）。
- **建议：** 在某个纯格式提交里跑 `pnpm format` 收掉，不混进功能提交。
