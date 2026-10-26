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

## 3. `packages/libs/editor-impl/src/map/map.css` 里的 `.emap-viewport-button` 已成为死样式

- **发现于：** Plan 09 / Task 1（删除工具栏四向按钮）
- **现象：** `map.css:151` 仍保留 `.emap-viewport-button`，但 `MapToolbar.tsx` 里的 `MapViewportButtons` 与全部 `map-viewport-*` 标识已在本计划删除，没有任何元素再用这个类。
- **判定为范围外：** Plan 09 的约束明确「不得修改 `map.css`」；删除一条不再命中的 CSS 类不影响行为，也不会让任何 verify 变红。
- **影响：** 仅多出约 3 行无用样式；不影响布局、命中与测试。
- **建议：** 在 Plan 11（工具栏挂缩放滑块）或本阶段收尾的纯样式提交里一起清掉。

## 4. `editor-impl` 全量测试有 9 条既有失败（保存 / 切换 / 偏好），与 Plan 19 无关

- **发现于：** Plan 19 / Task 3（跑两个包全量）
- **现象：** `pnpm --filter @motajs/editor-impl test` 退出码 1：84 个文件里 3 个失败，934 个用例里 9 个失败 —— `mapSave.test.tsx` 4 条（保存后 `unsaved` 仍为 true、失败保存的脏标记反向、宿主收到的图层与当前文档不一致、撤销回基线后 `isDirty()` 仍为 true）、`mapDialogs.test.tsx` 4 条（未保存确认、最近使用去重 / 擦除 / 写盘失败）、`mapPanel.test.tsx` 1 条（有未保存改动时切换不重读当前数据）。
- **判定为既有问题（已用基线复现）：** 在 Plan 19 开始前的 `b8139d1`（Plan 18 完成提交）上，用同一份工作区的 `node_modules`（临时 `git worktree` + 目录联接）单跑这三个文件，得到**完全相同的 9 条失败**。这 9 个用例都只走面板数据层（`MapPanel.commitCells` / `save` / 偏好写盘），`mapPanel.ts` 自 `04.1-13` 后未被改动，Plan 19 的 14 个文件不参与这条链路。
- **影响：** 不影响 Plan 19 的任何 `<automated>` verify：Task 1（50 条）与 Task 2（101 条）点名用例全绿，`editor-dev` 全量 79 条全绿，两个 typecheck 与三条结构门禁全绿。仅 Plan 19 的 `verification` 里「两个包全量全绿」这一条无法达成。
- **建议：** 由负责保存 / 切换语义的后续计划（Plan 20 之后的面板收尾）单独接手；不要在纯渲染计划里顺手改面板数据层。


## 5. `editor-dev` 的 `devHostMap.test.tsx` 有 1 条既有失败（Plan 36 打开帧数角标后暴露，与 Plan 37 无关）

- **发现于：** Plan 37 收口跑 `pnpm --filter @motajs/editor-dev test`。
- **现象：** `src/__tests__/devHostMap.test.tsx` 里「就绪后素材区出现演示地图…属于目录的图块」失败（`expected false to be true`，第 480 行）。它用 `querySelectorAll('[data-test-id^="map-tile-"]')` 收集图块，而 `MapMaterialPanel` 的帧数角标 id 是 `map-tile-frames-{number}`（`MapMaterialPanel.tsx:246`），前缀同样命中，`Number('frames-1')` 得到 `NaN`，于是断言「编号都在目录里」失败。
- **判定为既有问题：** Plan 36 的 `b259b88` 把 `MAP_SHOW_FRAME_COUNT_DEFAULT` 改为 `true`，角标从此默认渲染；Plan 37 只改大地图缩略逐格数据，不碰帧数角标。基线（`bb63e75`）上该角标默认不渲染，所以这条失败是在 Plan 36 之后才出现的。
- **影响：** `editor-dev` 全量 98 条里 1 条红；`editor-impl` 全量 1026 条全绿，Plan 37 的两个 `<automated>` verify 与 `typecheck` 全绿。不阻塞 Plan 37 的验收。
- **建议：** 由 `04.1-31` 收口时修测试选择器（改为排除 `map-tile-frames-` 前缀），或让角标 id 换一个不以 `map-tile-` 开头的前缀；本计划按 scope boundary 与「不碰 Plan 36 帧数」的约束不动它。
