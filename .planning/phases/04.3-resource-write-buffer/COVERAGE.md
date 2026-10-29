# Phase 04.3 — 覆盖记录（外部接口 / 依赖）

## api-coverage

No external API integration: 本阶段只在 editor-core 资源层内部增加写缓冲，不接触任何外部 API / SDK / 服务。

- 不新增任何运行时依赖（D-24）；缓冲、定时器、待写表全部使用平台能力（`setTimeout` / `clearTimeout` / `Map`）。
- 不新增任何宿主协议字段：`IEditorFileChange` 的载荷保持原样，不引入「写入来源」字段（D-25）。
- 唯一跨包接口变化是 `@motajs/editor-core` 内部的面板上下文与资源访问口，见 `INTERFACE-NAME.md` 的 `## Plan 02`。

## assumption-delta

已记录：资源层从「直写直读的转发者」变成「写入时机的拥有者」。

- 记录位置：`04.3-01-PLAN.md` 要求产出的 `INTERFACE-NAME.md` 的「七组契约的落实决策」① 与 `## 不缓冲的边界（写死）`。
- 影响：所有面板不再决定「何时写盘」，只决定「写什么」；磁盘写入时机统一由资源层的 5 秒防抖与外壳的生命周期事件决定。

## schema-gate

不适用：本阶段不涉及任何 ORM / 数据库 schema 文件。
