# Phase 1: Baseline & Verification Net - Context

**Gathered:** 2026-09-20
**Status:** Ready for planning

<domain>
## Phase Boundary

本阶段交付一个**可运行、可量化的验证基线**：在任何文件移动之前，让「行为完全不变」成为可衡量的东西。具体包含四件事：

1. 让 editor 的单测在无 `mota-js` submodule 时也能启动，并记录全量基线（单测/e2e/构建/体积/manifest/协议常量/截图）。
2. 新增 PR CI（`lint + typecheck + unit + build`，覆盖所有 workspace 包，阻塞合并）。
3. 为 `PersistExecutor`/`PersistenceMonitor` 与 `operationHistory` 写「冻结现有语义」的特性化测试。
4. 消除 e2e 的静默 skip。

**不在本阶段范围**：抽取 `editor-core`、任何生产代码语义变更、布局/功能改动、自动 diff 工具或 CI 视觉告警（见 Deferred）。

</domain>

<decisions>
## Implementation Decisions

### CI 门禁范围
- **D-01:** PR 门禁为 `lint + typecheck + unit + build` 四层，**不含 e2e**（e2e 不在本阶段 CI 门禁内）。
- **D-02:** 门禁覆盖**所有 workspace 包**，不做 affected-only 子集 —— 本重构会移动 libs 与 apps 之间的代码，全包门禁才能捕获跨包回归。
- **D-03:** 新增**独立** `.github/workflows/ci.yml`，触发 `pull_request` + push 到 main；与现有手动部署 workflow（`deploy-editor-h5test.yml`）职责分离。 — **Reversibility:** costly — 一旦在仓库设置里把四项设为 required checks，后续任何改动都要先让四层门禁通过；撤销需要改仓库分支保护设置。
- **D-04:** 初期即**阻塞合并**（required checks），不做 advisory 过渡期。

### 基线产物形态
- **D-05:** 量化基线**全量记录**：各包单测计数、e2e 运行结果、生产构建产物、产物体积（对 20 MiB 上限）、`editor-manifest.json`、协议常量、四编辑器 + shell 截图。
- **D-06:** 基线存于 **`.planning/baseline/`**，包含人类可读的 `BASELINE.md` 与机器可读的快照 JSON；随代码版本化，后续阶段可 diff。
- **D-07:** 四编辑器 + shell 的基线**截图提交入库**（`.planning/baseline/screenshots/`），作为后续阶段的视觉比对基线（约 5 张）。
- **D-08:** 后续阶段对本基线采用**人工对照**判定「没变」；本阶段不写自动 JSON/图像 diff 工具，也不做 CI 视觉告警。

### 特性化测试
- **D-09:** **新增独立特性化套件**；现有测试（如 `packages/apps/editor/src/fs/__tests__/PersistExecutor.test.ts`）保持不动，避免重构时把断言一起改掉而失去安全网。 — **Reversibility:** costly — 套件一旦分散在多处，日后合并回现有测试文件需要逐文件搬迁与重命名。
- **D-10:** 套件 **co-located 在 `__tests__/`**（沿用 editor 现有惯例，如 `src/fs/__tests__/`、`src/project/history/__tests__/`）；模块在后续阶段迁移时测试随之移动，**仅改 import 路径、断言不动**。
- **D-11:** 只冻结 **REQ 列出的不变量**：
  - `PersistExecutor`/`PersistenceMonitor`：error→retry→idle、并发 latest-wins、持久化失败不回滚 UI
  - `operationHistory`：容量 100、逆操作、多目标 checkpoint rollback、`set`/`patch` 后资源响应性
  不录制完整状态转移快照（避免过拟合实现细节）。
- **D-12:** 重构中特性化测试变红 = **回归**，必须修改实现而非调整断言。

### 单测与 submodule
- **D-13:** **unit 测试脱离 submodule 依赖**（用 `MemoryFileSystem`/`sampleProject` fixtures，不依赖真 mota-js）；**e2e 仍要求 submodule**。
- **D-14:** 解耦方式为**拆分编辑器独立的 `vitest.config.ts`**，不导入 `MOTA_JS_ROOT`（对齐 `packages/apps/service-worker/vitest.config.ts` 等包惯例）；`vite.config.ts` 继续服务 dev/build。 — **Reversibility:** costly — editor 目前 test block 与 dev/build 共用 `vite.config.ts`，拆分会触及测试基础设施与包脚本，回退需要重新合并配置。
- **D-15:** CI 按 job 区分 submodule：`lint`/`typecheck`/`unit` **不** checkout submodule；`build`（与 e2e 若运行）用 `submodules: recursive` —— 因为 editor 的 `publicDir` 指向 mota-js root，只有构建期才真正需要。
- **D-16:** e2e 静默 skip（如 `packages/apps/service-worker/e2e/project-host.spec.ts` 的 `test.skip(!withEditor, …)`）**改为必需 fixture**，缺前置则 fail，而非静默通过。

### the agent's Discretion
- 截图基线的**生成方式**（Playwright 脚本录制 vs 手动截图）—— 未讨论；倾向可复现的 Playwright 脚本，但由实现者定。
- `BASELINE.md` 的字段清单与快照 JSON 的具体 schema。
- `ci.yml` 的 job 划分、依赖缓存与并发策略细节。
- `VERIFY-07` 协议不一致「生成式断言记录」的**具体写法**（测试 vs 提交快照 JSON）；硬约束是不可修改 `3`/`4` 两个既有值。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 项目与阶段上下文
- `.planning/PROJECT.md` — 约束（纯重构、行为不变）与验证判据（现有测试全绿 + 手动验收）
- `.planning/REQUIREMENTS.md` — 本期 v1 需求（本阶段覆盖 VERIFY-01/02/03/04/06/07）
- `.planning/ROADMAP.md` §Phase 1 — 目标与 5 条成功标准
- `.planning/research/SUMMARY.md` — Phase 1 的成立依据（验证先于改动）与已知开放项
- `.planning/codebase/TESTING.md` — 测试框架、运行命令、夹具、mock 惯例
- `.planning/codebase/CONCERNS.md` — 无 PR CI、editor 无 `typecheck`、e2e 静默 skip、submodule 加载期抛错、`runtimeProtocolVersion` 漂移

### 受影响的现有文件
- `.github/workflows/deploy-editor-h5test.yml` — 现有唯一 workflow（手动部署；新 CI 与其分离）
- `packages/apps/editor/vite.config.ts` — 当前 test block 与 dev/build 共用（待拆出 `vitest.config.ts`）
- `packages/apps/editor/mota-root.ts` — `resolveMotaJsRoot()` 加载期抛错源
- `packages/apps/editor/playwright.config.ts` — e2e 配置（`testDir: "./e2e"`、`data-test-id`、`webServer`）
- `packages/apps/service-worker/e2e/project-host.spec.ts` — 静默 skip 所在（第 102 行）
- `packages/apps/editor/src/fs/__tests__/` — 现有持久化测试（`PersistExecutor.test.ts`、`PersistenceMonitor.test.ts`、`persistStatus.integration.test.ts`）
- `packages/apps/editor/src/project/history/` — `operationHistory` 与逆操作实现
- `packages/apps/editor/editor-artifact-plugin.ts` — manifest `runtimeProtocolVersion: 3`（第 25/166 行）
- `packages/apps/editor/src/runtime/protocol.ts` — `RUNTIME_PROTOCOL_VERSION = 4`（第 4 行）
- `package.json` — 需补 root `test`/`typecheck`/`build` fan-out 脚本
- `packages/apps/editor/package.json` — 需补独立 `typecheck` 脚本

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/apps/editor/test/utils/MemoryFileSystem.ts` — 内存文件系统 + 故障注入（`setWriteDelay`、`setWriteError`、`setWriteErrorForPath`、`getWriteCount`）：特性化 persistence 测试的主力夹具
- `packages/apps/editor/test/utils/sampleProject.ts` / `testHelpers.ts` — 完整项目 fixture 与 `createTestFileHandler`/`wait`/`waitFor`
- `packages/apps/editor/test/arbitraries.ts` — fast-check 生成器（`jsIdentifierArb`、`safeJsonValueArb`）
- `packages/apps/service-worker/vitest.config.ts` — 独立 vitest 配置的现成范例
- `.planning/codebase/TESTING.md` — 各包运行命令与 mock 惯例

### Established Patterns
- **Per-package vitest config**（无 root 配置）；editor 是唯一把 `test` block 塞进 `vite.config.ts` 的包
- 服务端单测用 `vi.hoisted` + `vi.mock`；集成测试用 `vi.spyOn(browserFs.promises, …)` 接内存 FS
- e2e 用 `data-test-id` 选择器、`ProjectSandbox` 路由拦截、断言无 `pageerror`
- CI 现有 job 结构：`pnpm --filter @motajs/service-worker typecheck` + `test`
- React 测试 `afterEach(cleanup)`；`@vitest-environment jsdom` docblock 选择 DOM

### Integration Points
- 根 `package.json` scripts（新增 fan-out）
- `.github/workflows/`（新增 `ci.yml`）
- `packages/apps/editor/` 的 Vite/Vitest 配置拆分
- `packages/apps/editor/mota-root.ts` 的加载期行为
- `editor-artifact-plugin.ts` ↔ `runtime/protocol.ts` 的协议常量一致性（本阶段只记录、不修）

</code_context>

<specifics>
## Specific Ideas

- **必须保留** manifest 的 `runtimeProtocolVersion: 3` 与 `RUNTIME_PROTOCOL_VERSION = 4` 的不一致，本阶段不得「修复」它（修复属于行为变更）；只加生成式断言把两个值记录下来。
- 产物体积基线必须以 **20 MiB raw** 上限为参照（`editor-artifact-plugin.ts`）。
- 单测脱离 submodule 后，`MOTA_JS_ROOT` 对 **dev/build 仍然必需**，只是不再是 unit 测试的前置。
- `mota-js` submodule 由用户后续补上；plan 需把「初始化 submodule + 记录基线」写成可跳过前提即可重跑的形式。

</specifics>

<deferred>
## Deferred Ideas

- 自动 JSON/图像 diff 与 CI 视觉回归告警 —— 超出本阶段，后续阶段再评估；本阶段用人工对照。
- 覆盖率阈值与覆盖率上报 —— `CONCERNS.md` 列为缺失项，但不在 Phase 1 需求内。
- 将 e2e 纳入 PR CI —— 本阶段只修复静默 skip 语义，不把 e2e 提升为 PR 门禁。
- 修复 `fs.postData` 错误吞没、`runtimeProtocolVersion` 漂移等既有缺陷 —— 属于行为变更，归后续阶段。

None — discussion stayed within phase scope for delivery; the above are explicitly out-of-scope items, not new capabilities.

</deferred>

---

*Phase: 1-Baseline & Verification Net*
*Context gathered: 2026-09-20*
