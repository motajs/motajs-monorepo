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

## 2. `packages/apps/editor` 的 typecheck 已大面积报错（既有，与本计划无关）

- **发现于：** Plan 01 / Task 3 收尾时顺手跑 `pnpm --filter @motajs/editor typecheck` 做交叉确认
- **现象：** 退出码 1，共 353 条 `error TS`，分布在 80 个文件里，集中在 `src/fs/*`、`src/components/*`、`src/MapEditor/*`、`src/Workbench/ResourcesWorkspace/*`；典型形态是 `content` / `blockRegistry` / `tilesetCatalog` 被推成 `unknown`，另有 `libs/editor-impl/src/table/tablePanel.ts` 三个未使用的类型导入。
- **判定为既有问题：** 本计划只改 `editor-impl/src/map/*` 与 `editor-dev/src/backend/*`；逐条过滤后，**被本计划触碰过的 9 个文件里 0 条报错**。这些错误来自另一个仍在进行中的重构（`DataResource` / `FileHandler` 的泛型收窄），与新增的可选接口成员无关；`tablePanel.ts` 的未使用导入错误来自 `editor` 的 tsconfig 与 `editor-impl` 自身 tsconfig 在 `noUnusedLocals` 上的差异。
- **影响：** 本计划要求的两个包（`@motajs/editor-impl`、`@motajs/editor-dev`）typecheck 全绿；`editor` 应用侧的报错不影响本阶段任何 verify 命令，但在修好之前不要把 `editor` 的 typecheck 当作回归门禁。
- **建议：** 由正在做那次重构的计划收口，本阶段不接手。
