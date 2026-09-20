# Phase 1: Baseline & Verification Net - Research

**Researched:** 2026-09-20
**Domain:** Monorepo CI gating, test-infrastructure de-coupling, characterization testing, visual baseline capture
**Confidence:** HIGH for repo-derived findings (read directly from source this session); MEDIUM for external tooling mechanics

## Summary

Phase 1 is not a code-movement phase — it installs the instruments that make every later phase's
"behavior unchanged" claim checkable. The research below is therefore mostly about *what actually
happens today* when you try to run the repo's own verification, because that is the thing the phase
must fix before it can measure anything.

Three findings dominate and each changes the plan's shape:

1. **The editor's unit suite is coupled to the `mota-js` submodule far more deeply than the Vite
   config import.** Splitting `vitest.config.ts` (D-14) is necessary but **not sufficient** for
   D-13/D-15. Seven unit-test modules import `MOTA_JS_ROOT` — five via `test/utils/sampleProject.ts`,
   which walks the real `project/` tree on disk, and two `test/blockly/*` specs that `readFileSync`
   real submodule files. A CI `unit` job that does not check out the submodule will fail at
   collection on those seven files. This is the single largest planning decision in the phase.

2. **This working copy cannot execute any test or build at all.** Every pnpm workspace junction is
   dangling (31/31 sampled in `packages/apps/editor/node_modules` were broken) and
   `pnpm install --frozen-lockfile` aborts with `UNKNOWN: unknown error`. The local pnpm store
   (`E:\.pnpm-store\v10`) exists, so an offline repair is plausible, but the baseline numbers this
   phase promises cannot be produced until the environment is repaired — that repair is a Wave 0
   prerequisite, not a footnote.

3. **"Blocking PR CI" is only half a repo change.** Required status checks are branch-protection or
   ruleset configuration living in repository settings (or the REST API), not in any workflow file,
   and setting them needs admin permission. The plan needs an explicit human/API checkpoint, because
   `ci.yml` alone cannot block a merge.

Secondary but plan-shaping: the submodule root has **no `package.json`**, so initializing it does not
silently add a thirteenth workspace project or invalidate the lockfile; the workspace contains exactly
one silent `test.skip` (plus one polarity-consistent conditional assertion block beside it); the
editor's `tsconfig.app.json` excludes `test/**`, so the fixture code the new characterization tests
will lean on is not typechecked by any current `tsc -b`; and pinned protocol constants (`manifest 3`
vs `RUNTIME_PROTOCOL_VERSION 4`) are already asserted in exactly one place for one side only.

**Primary recommendation:** Sequence the phase as (1) repair the environment and initialize the
submodule, (2) record the quantified baseline from a known-good tree, (3) add root fan-out scripts and
`ci.yml` with the submodule decision made explicitly, (4) write the characterization suites, (5)
convert the silent skip. Do the baseline **before** the `vitest.config.ts` split, so the "before"
numbers come from the unmodified configuration.

## User Constraints (from CONTEXT.md)

<user_constraints>

### Locked Decisions

**CI 门禁范围**
- **D-01:** PR 门禁为 `lint + typecheck + unit + build` 四层，**不含 e2e**（e2e 不在本阶段 CI 门禁内）。
- **D-02:** 门禁覆盖**所有 workspace 包**，不做 affected-only 子集 —— 本重构会移动 libs 与 apps 之间的代码，全包门禁才能捕获跨包回归。
- **D-03:** 新增**独立** `.github/workflows/ci.yml`，触发 `pull_request` + push 到 main；与现有手动部署 workflow（`deploy-editor-h5test.yml`）职责分离。 — **Reversibility:** costly — 一旦在仓库设置里把四项设为 required checks，后续任何改动都要先让四层门禁通过；撤销需要改仓库分支保护设置。
- **D-04:** 初期即**阻塞合并**（required checks），不做 advisory 过渡期。

**基线产物形态**
- **D-05:** 量化基线**全量记录**：各包单测计数、e2e 运行结果、生产构建产物、产物体积（对 20 MiB 上限）、`editor-manifest.json`、协议常量、四编辑器 + shell 截图。
- **D-06:** 基线存于 **`.planning/baseline/`**，包含人类可读的 `BASELINE.md` 与机器可读的快照 JSON；随代码版本化，后续阶段可 diff。
- **D-07:** 四编辑器 + shell 的基线**截图提交入库**（`.planning/baseline/screenshots/`），作为后续阶段的视觉比对基线（约 5 张）。
- **D-08:** 后续阶段对本基线采用**人工对照**判定「没变」；本阶段不写自动 JSON/图像 diff 工具，也不做 CI 视觉告警。

**特性化测试**
- **D-09:** **新增独立特性化套件**；现有测试（如 `packages/apps/editor/src/fs/__tests__/PersistExecutor.test.ts`）保持不动，避免重构时把断言一起改掉而失去安全网。 — **Reversibility:** costly — 套件一旦分散在多处，日后合并回现有测试文件需要逐文件搬迁与重命名。
- **D-10:** 套件 **co-located 在 `__tests__/`**（沿用 editor 现有惯例，如 `src/fs/__tests__/`、`src/project/history/__tests__/`）；模块在后续阶段迁移时测试随之移动，**仅改 import 路径、断言不动**。
- **D-11:** 只冻结 **REQ 列出的不变量**：
  - `PersistExecutor`/`PersistenceMonitor`：error→retry→idle、并发 latest-wins、持久化失败不回滚 UI
  - `operationHistory`：容量 100、逆操作、多目标 checkpoint rollback、`set`/`patch` 后资源响应性
  不录制完整状态转移快照（避免过拟合实现细节）。
- **D-12:** 重构中特性化测试变红 = **回归**，必须修改实现而非调整断言。

**单测与 submodule**
- **D-13:** **unit 测试脱离 submodule 依赖**（用 `MemoryFileSystem`/`sampleProject` fixtures，不依赖真 mota-js）；**e2e 仍要求 submodule**。
- **D-14:** 解耦方式为**拆分编辑器独立的 `vitest.config.ts`**，不导入 `MOTA_JS_ROOT`（对齐 `packages/apps/service-worker/vitest.config.ts` 等包惯例）；`vite.config.ts` 继续服务 dev/build。 — **Reversibility:** costly — editor 目前 test block 与 dev/build 共用 `vite.config.ts`，拆分会触及测试基础设施与包脚本，回退需要重新合并配置。
- **D-15:** CI 按 job 区分 submodule：`lint`/`typecheck`/`unit` **不** checkout submodule；`build`（与 e2e 若运行）用 `submodules: recursive` —— 因为 editor 的 `publicDir` 指向 mota-js root，只有构建期才真正需要。
- **D-16:** e2e 静默 skip（如 `packages/apps/service-worker/e2e/project-host.spec.ts` 的 `test.skip(!withEditor, …)`）**改为必需 fixture**，缺前置则 fail，而非静默通过。

### the agent's Discretion
- 截图基线的**生成方式**（Playwright 脚本录制 vs 手动截图）—— 未讨论；倾向可复现的 Playwright 脚本，但由实现者定。
- `BASELINE.md` 的字段清单与快照 JSON 的具体 schema。
- `ci.yml` 的 job 划分、依赖缓存与并发策略细节。
- `VERIFY-07` 协议不一致「生成式断言记录」的**具体写法**（测试 vs 提交快照 JSON）；硬约束是不可修改 `3`/`4` 两个既有值。

### Deferred Ideas (OUT OF SCOPE)
- 自动 JSON/图像 diff 与 CI 视觉回归告警 —— 超出本阶段，后续阶段再评估；本阶段用人工对照。
- 覆盖率阈值与覆盖率上报 —— `CONCERNS.md` 列为缺失项，但不在 Phase 1 需求内。
- 将 e2e 纳入 PR CI —— 本阶段只修复静默 skip 语义，不把 e2e 提升为 PR 门禁。
- 修复 `fs.postData` 错误吞没、`runtimeProtocolVersion` 漂移等既有缺陷 —— 属于行为变更，归后续阶段。

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VERIFY-01 | 初始化 `packages/external/mota-js` submodule 并记录量化基线（各包单测、e2e、生产构建、产物体积对 20 MiB 上限、`editor-manifest.json`、协议常量、四大编辑器 + shell 截图） | Submodule is currently uninitialized (`git submodule status` → `-3efb548e…`); submodule root has no `package.json` so init does not alter workspace membership/lockfile; artifact ceiling + manifest fields located verbatim; per-package unit-file census taken (123 unit files / 10 e2e files); screenshot surfaces + Playwright determinism constraints documented |
| VERIFY-02 | 新增 PR CI：lint + per-package typecheck + 单测 + 生产构建 | Only `@motajs/service-worker` has `typecheck`; editor and 7 libs have none; root has only `lint: eslint --fix` (unsafe as a gate); `pnpm -r run <script>` skips packages lacking the script; `panda codegen` + submodule are build prerequisites; required-check mechanics are out-of-repo |
| VERIFY-03 | `PersistExecutor`/`PersistenceMonitor` 特性化测试（错误→重试→idle、并发 latest-wins、持久化失败不回滚 UI） | Exact state machine read from source: single pending slot, `pending: 0\|1`, failed-intent retention, error only on last failure, `flush()` rethrow, path normalization, `AggregateError` message, `effect()` mirroring with failure-visible-during-retry |
| VERIFY-04 | `operationHistory` 特性化测试（容量 100、逆操作、多目标 checkpoint rollback、`set`/`patch` 后资源响应性） | Exact invariants read from source: `capacity = 100` + `entries.shift()`, `slice(0, current)` redo-truncation, `changed === false` → no entry, inverse swap on undo/redo, `captureTargets`/`restoreTargets` reverse order, `commandStage` tagging on composite failure |
| VERIFY-06 | 静默跳过的 e2e 转为必需 fixture 或 CI 可见标记 | Exactly one `test.skip` exists in the workspace (`project-host.spec.ts:102`); a second conditional-assertion block at lines 55–59 has the same "silently weaker" character; editor e2e has no skips but all 8 specs depend on `ProjectSandbox` → `MOTA_JS_ROOT` |
| VERIFY-07 | 保留既有 `runtimeProtocolVersion: 3` vs `RUNTIME_PROTOCOL_VERSION = 4` 不一致（不做「修复」），并有生成式断言记录协议常量 | Both values located verbatim (`editor-artifact-plugin.ts:25,166`; `src/runtime/protocol.ts:4`); `protocol.test.ts:6` already pins the `4` side only; the manifest side is currently asserted nowhere |

</phase_requirements>

## Architectural Responsibility Map

Phase 1 delivers no application capability; its "capabilities" are verification instruments. Tier
ownership below is about **which layer owns each instrument**, which is what the planner needs to
avoid putting a gate in the wrong place (e.g. asserting visual parity inside the PR gate, or making
the baseline depend on host configuration).

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Submodule init + quantified baseline capture | Developer/operator machine (local checkout) | CI (reproducibility only) | The submodule is deliberately not vendored/committed; baseline numbers must come from a tree whose git state is recorded. A CI job cannot be the *source* of a committed baseline without a commit-back loop, which D-06/D-07 don't ask for. |
| `lint` gate | CI job | Root `package.json` script | ESLint 9 flat config resolves per-directory (`packages/apps/editor/eslint.config.js` differs from root), so a single root invocation is correct — but it must run **without** `--fix`. |
| `typecheck` gate | CI job | Per-package `tsc -b` | `tsc -b` is project-reference driven; it type-checks only files reachable from each package's includes. Ownership belongs to each package (its own tsconfig), not to a root program. |
| `unit` gate | CI job | Per-package `vitest run` | Per-package configs are the repo convention; environments genuinely differ (node vs jsdom). |
| `build` gate | CI job | Per-package build (editor → MPA, SW → worker + shell) | Only this tier needs the submodule (editor `publicDir`) and `panda codegen`. |
| Required-check enforcement (blocking) | **Repository settings / REST API (outside git)** | `ci.yml` job names | Rulesets/branch protection are not expressible in a workflow file; job names in `ci.yml` are merely the *contract* those settings reference. |
| Characterization suites | Unit-test tier, co-located `__tests__/` | — | D-10; they must run under the same per-package vitest config as the code they freeze, and must not depend on e2e infrastructure. |
| e2e prerequisite enforcement | Playwright config + fixture tier | CI visibility | The skip lives in the spec; the fix belongs in a required fixture (or config-level failure), so it fails at setup rather than being decided per-test. |
| Screenshot baseline capture | Playwright script (manual/local invocation) | `.planning/baseline/screenshots/` (committed artifact) | D-08 says manual comparison; D-01 excludes e2e from CI. Therefore screenshots are human-review artifacts, not machine-asserted snapshots — ownership is the capture script, not the CI gate. |
| Protocol-constant recording | Unit-test tier (generated assertion) + baseline JSON | — | The manifest value is produced by a Vite plugin; the runtime value is a source constant. A unit assertion plus a baseline record covers both without changing either value. |

## Standard Stack

**This phase adds zero runtime dependencies and should add zero new npm packages.** Everything it
needs is already present, or is supplied by GitHub's own actions.

### Core — already present, do not change versions

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vitest | `4.0.18` (editor/SW) / catalog `^4.0.16` | Unit + characterization suites | Already the repo runner; per-package configs already exist for 5 packages. |
| `@playwright/test` | `1.61.1` (editor) / `^1.61.1` (SW) | e2e + screenshot capture | Already configured with `data-test-id`, `webServer`, `ProjectSandbox`. |
| TypeScript | `5.9.3` | `tsc -b` typecheck gate | Catalog-pinned; root `overrides.vite` and `typescript-eslint@8.53.1` peer-cap the whole toolchain. |
| ESLint | `9.39.2` + `typescript-eslint@8.53.1` | lint gate | Flat config, per-directory config resolution. |
| pnpm | `11.10.0` (CI, `.github/workflows/deploy-editor-h5test.yml:23`) | Workspace install + recursive script fan-out | Lockfile + catalog authority. |
| Node.js | `24` (CI) | Runtime | `setup-node` pinned in the existing workflow. |

### Supporting — GitHub actions (no package install)

| Action | Version used by the existing workflow | Purpose |
|--------|--------------------------------------|---------|
| `actions/checkout` | `@v4` (`deploy-editor-h5test.yml:17`) | Repo + optional `submodules: recursive` |
| `pnpm/action-setup` | `@v4`, `version: 11.10.0` (`:21-23`) | pnpm 11 install |
| `actions/setup-node` | `@v4`, `node-version: 24`, `cache: pnpm` (`:25-28`) | Node + pnpm store cache |

New `ci.yml` should mirror these exact versions so the repo has one story about toolchain pinning.
`pnpm/setup@v2` (which folds pnpm + runtime into one step) exists and is documented, but it is a
different mechanism than the repo already uses — do not introduce it in this phase.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Per-package `vitest.config.ts` (D-14) | Root `vitest.config.ts` with `test.projects: ['packages/*']` | Officially supported, but root-only options (`coverage`, `reporters`, `resolveSnapshotPath`) can't live in project configs, and it would re-centralize exactly the coupling being removed. Per-package is the repo's existing convention. |
| Committed PNG screenshots as review artifacts | `expect(page).toHaveScreenshot()` machine snapshots | Docs warn rendering varies by OS/headless/fonts/hardware and snapshot filenames encode browser+platform, so a Windows-captured baseline cannot assert on the Linux CI runner. D-01 keeps e2e out of CI and D-08 mandates manual comparison, so machine snapshots would be dead weight plus an OS-keyed naming problem. |
| `setup-node`'s `cache: 'pnpm'` | Explicit `pnpm store path` + `actions/cache` | A widely-repeated claim is that `cache: 'pnpm'` caches `node_modules` rather than the content-addressable store, so monorepo symlinks dangle [LOW confidence, single source]. The existing deploy workflow already works with `cache: pnpm`; changing it is unverified churn in a phase meant to reduce uncertainty. Mirror it. |
| Adding `typecheck` scripts to every package | Root `pnpm -r --if-present exec tsc -b` | `pnpm -r run <script>` already skips packages lacking the script, so `--if-present` is unnecessary for `run`; but `exec` does not skip, so per-package scripts are the safer contract and match `service-worker`'s precedent. |

**Installation:** none — `pnpm install --frozen-lockfile` only.

**Version verification:** no new package is introduced, so no registry lookups were performed. The
versions above were read from the workspace manifests (`packages/apps/editor/package.json`,
`packages/apps/service-worker/package.json`, `pnpm-workspace.yaml`) and
`.github/workflows/deploy-editor-h5test.yml` this session.

## Package Legitimacy Audit

**Not applicable — this phase installs no external packages.**

The only new external artifacts are GitHub Actions referenced by tag from the first-party publishers
(`actions/*`, `pnpm/action-setup`) already used by the repo's existing workflow. No npm/PyPI/crates
dependency is added, so no `package-legitimacy check` run was performed, and `pnpm-lock.yaml` should
be **byte-identical after this phase** (see the assumption about the submodule manifest, which is the
one thing that could invalidate that statement).

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| *(none)* | — | — | — | — | — | No packages added |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*If the planner decides to add a coverage provider or a diff tool, that is out of scope (Deferred)
and would require running the legitimacy gate at that point.*

## Architecture Patterns

### System Architecture Diagram

```text
                          ┌──────────────────────────────────────────────┐
                          │  Developer machine (source of the baseline)  │
                          └──────────────────────────────────────────────┘
                                            │
   git submodule update --init packages/external/mota-js
                                            │
                                            ▼
                    ┌───────────────────────────────────────────┐
                    │ packages/external/mota-js  (pinned SHA)   │
                    │ index.html · main.js · project/ · libs/   │
                    │ _server/table/data.comment.js             │
                    │ (no package.json → NOT a workspace pkg)   │
                    └───────────────────────────────────────────┘
                       │                              │
        read at config load               read at unit-test runtime
                       │                              │
                       ▼                              ▼
        ┌──────────────────────────┐    ┌──────────────────────────────────┐
        │ vite.config.ts           │    │ 7 unit-test modules              │
        │  import MOTA_JS_ROOT     │    │  sampleProject.ts (walks project/)│
        │  motaServerPlugin(...)   │    │  blockly/uiRoundTrip.test.ts      │
        │  publicDir: MOTA_JS_ROOT │    │  blockly/projectEntries.test.ts   │
        │  test: { … }  ◄── SPLIT  │    │  sampleProjectCommands.test.ts    │
        └──────────────────────────┘    └──────────────────────────────────┘
                       │                              │
        split into ────┘                              │  ⚠ breaks a
                       ▼                              │  "unit job without
        ┌──────────────────────────┐                  │   submodule" (D-15)
        │ vitest.config.ts (new)   │◄─────────────────┘
        │  no MOTA_JS_ROOT import  │
        │  env jsdom · globals     │
        │  @ / @test / @styled     │
        └──────────────────────────┘
                       │
                       ▼
        ┌───────────────────────────────────────────────────────────────┐
        │  Root fan-out scripts (new): test · typecheck · build          │
        │  pnpm -r run typecheck  → skips packages with no script        │
        └───────────────────────────────────────────────────────────────┘
                       │
                       ▼
        ┌───────────────────────────────────────────────────────────────┐
        │ .github/workflows/ci.yml (new)   on: pull_request, push:main   │
        │                                                               │
        │  lint ────┐   no submodule, no build                          │
        │  typecheck├─── no submodule                                   │
        │  unit ────┘   ⚠ 7 files want the submodule                    │
        │  build ────── submodules: recursive + panda codegen           │
        │                └─► editor vite build → editor-manifest.json    │
        │                     rawBytes vs 20 MiB ceiling                 │
        └───────────────────────────────────────────────────────────────┘
                       │
                       │ job names become the contract for …
                       ▼
        ┌───────────────────────────────────────────────────────────────┐
        │  Repository settings / REST API  (OUTSIDE the repo)           │
        │  required_status_checks = [lint, typecheck, unit, build]      │
        │  ← cannot be committed; needs admin; blocks merge             │
        └───────────────────────────────────────────────────────────────┘

  Baseline capture (parallel, local/manual):
   unit --reporter=json ─┐
   playwright test (e2e) ─┼──► .planning/baseline/BASELINE.md + snapshot JSON
   vite build + manifest ─┤    .planning/baseline/screenshots/*.png (≈5)
   protocol constants ────┘
```

### Recommended Project Structure (new / changed files only)

```text
motajs-monorepo/
├── .github/workflows/
│   ├── deploy-editor-h5test.yml      # UNCHANGED (manual deploy)
│   └── ci.yml                        # NEW: lint | typecheck | unit | build
├── .planning/baseline/               # NEW (committed)
│   ├── BASELINE.md                   # human-readable
│   ├── baseline.json                 # machine-readable snapshot
│   ├── editor-manifest.json          # verbatim artifact manifest
│   └── screenshots/                  # ≈5 PNGs (4 editors + shell)
├── package.json                      # + test / typecheck / build fan-out
├── packages/apps/editor/
│   ├── package.json                  # + typecheck script
│   ├── vite.config.ts                # − test block
│   ├── vitest.config.ts              # NEW (no MOTA_JS_ROOT import)
│   ├── e2e/baseline-capture.spec.ts  # NEW (optional; screenshot capture)
│   └── src/fs/__tests__/
│       ├── PersistExecutor.test.ts           # UNCHANGED (D-09)
│       ├── PersistenceMonitor.test.ts        # UNCHANGED (D-09)
│       ├── persistExecutor.invariants.test.ts    # NEW characterization
│       └── persistenceMonitor.invariants.test.ts # NEW characterization
│   └── src/project/history/__tests__/
│       ├── operationHistory.test.ts              # UNCHANGED (D-09)
│       └── operationHistory.invariants.test.ts   # NEW characterization
└── packages/apps/service-worker/
    └── e2e/project-host.spec.ts      # silent skip → required fixture
```

### Pattern 1: Split the Vitest config out of the Vite config (D-14)

**What:** Move the `test` block from `vite.config.ts` into a standalone `vitest.config.ts`, modelled
exactly on `packages/apps/service-worker/vitest.config.ts`, so vitest never evaluates
`mota-root.ts`'s load-time throw.

**When to use:** Unconditionally for this phase — the editor is the only package in the workspace
that co-locates its test block with dev/build config, and that co-location is what makes unit tests
un-runnable without the submodule.

**Evidence the problem is real (verbatim):**

```ts
// packages/apps/editor/vite.config.ts:8,25,35
import { MOTA_JS_ROOT } from "./mota-root";
…
    motaServerPlugin({ motaRoot: MOTA_JS_ROOT }),
…
  publicDir: MOTA_JS_ROOT,
```

```ts
// packages/apps/editor/vite.config.ts:51-56
  test: {
    environment: "jsdom",
    globals: true,
    exclude: [...configDefaults.exclude, "e2e/**"],
    setupFiles: ["./test/setup.ts"],
  },
```

```ts
// packages/apps/editor/mota-root.ts:15-21
  const missing = REQUIRED_PATHS.filter((name) => !existsSync(path.join(root, name)));
  if (missing.length > 0) {
    throw new Error(
      `Invalid mota-js root ${root}; missing ${missing.join(", ")}. ` +
      "Run `git submodule update --init packages/external/mota-js` or set MOTA_JS_ROOT.",
    );
  }
```

```ts
// packages/apps/editor/mota-root.ts:25
export const MOTA_JS_ROOT = resolveMotaJsRoot();
```

**Model to copy (verbatim, the whole file):**

```ts
// Source: packages/apps/service-worker/vitest.config.ts:1-13
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    restoreMocks: true,
  },
});
```

The editor version must additionally alias `@test` → `test` and `@styled-system` → `styled-system`
(both are declared in `packages/apps/editor/tsconfig.app.json:9-13` and mirrored in
`vite.config.ts:28-34`), keep `environment: "jsdom"`, `globals: true`, and
`setupFiles: ["./test/setup.ts"]`, and keep `exclude: [...configDefaults.exclude, "e2e/**"]`
(`configDefaults` imported from `vitest/config`).

### Pattern 2: Root fan-out scripts via `pnpm -r run`

**What:** Add `test`/`typecheck`/`build` to the root `package.json` and let pnpm fan out.

**Why this shape:** pnpm's own docs state for `--recursive, -r`: *"This runs an arbitrary command from
each package's `scripts` object. If a package doesn't have the command, it is skipped. If none of the
packages have the command, the command fails."* [CITED: https://pnpm.io/cli/run] That means missing
scripts in `@motajs/config`, `@motajs/utils`, `@motajs/react-dark-mode` are harmless **provided at
least one package defines the script** — which is true for all three (`editor`/`service-worker`/libs
define `test`; `editor`/`service-worker` will define `typecheck`; three packages define `build`).

The current root script is verbatim:

```json
// package.json:7-9
  "scripts": {
    "lint": "eslint --fix"
  },
```

`--fix` makes this unusable as a gate. The CI lint job must run `eslint .` (no `--fix`), or the root
script must gain a non-fixing counterpart. Either way the editor's local config
(`packages/apps/editor/eslint.config.js`) is picked up automatically for files under that directory
because ESLint 9 flat config resolves the nearest config — so one root invocation is sufficient.

### Pattern 3: Characterization suites that pin invariants, not structure

**What:** New, separate `*.invariants.test.ts` files in the existing `__tests__/` directories, leaving
the existing suites untouched (D-09). Each file freezes only the invariants in D-11 and nothing about
internal structure (D-11's explicit "不录制完整状态转移快照").

**Procedure to follow** (Feathers' observation-first discipline, corroborated across sources
[CITED: https://en.wikipedia.org/wiki/Characterization_test]): call the unit with a specific input,
assert something deliberately wrong, run it, copy the real value out of the failure, rename the test to
describe the behaviour. Every expected value must come from observed execution — an expectation
derived from reading the source is a guess about intent, which is the opposite of what this suite is
for. Then confirm the suite can actually fail (deliberately break the implementation once and watch at
least one assertion go red) before declaring it a safety net.

**The invariants, as read from source this session** (these are the *claims to verify by execution*,
not the assertions to write blind):

`PersistExecutor` — `packages/apps/editor/src/fs/PersistExecutor.ts`:

- One executing intent plus at most one pending intent, latest-wins:
  `private pendingIntent: PersistenceIntent | null = null;` (`:25`) and
  `this.pendingIntent = intent;` (`:39`) — a second `schedule()` before dequeue overwrites the first.
- Status union is exactly three shapes:
  ```ts
  // :18-21
  export type ExecutorStatus =
    | { status: "idle" }
    | { status: "executing"; pending: number }
    | { status: "error"; error: Error; pending: 0 };
  ```
- A failure only becomes visible as `error` when nothing newer is pending:
  ```ts
  // :76-80
  if (!this.pendingIntent) {
    this.isExecuting = false;
    this._status({ status: "error", error: normalized, pending: 0 });
    return;
  }
  ```
  i.e. if a newer intent arrived during the failing one, the loop continues and the next outcome
  decides the status — this is the "a transient failure followed by a success ends `idle`" property.
- `failedIntent` is retained on failure (`:75`) and cleared on success (`:71`); `retry()` is a no-op
  unless the status is currently `error` (`:56`).
- `hasPending()` is `isExecuting || pendingIntent !== null` (`:104-106`).
- `flush()` rethrows the stored error (`:101`), while `whenQuiescent()` never rejects (`:90`).
- The module doc is the "no UI rollback" contract verbatim: *"The controller never owns editor state
  and persistence failures never roll editor state back."* (`:1-7`).

`PersistenceMonitor` — `packages/apps/editor/src/fs/PersistenceMonitor.ts`:

- Path normalization is `\\`→`/` then strip leading `./`:
  ```ts
  // :15-17
  function normalizePath(path: string): string {
    return path.replace(/\\/g, "/").replace(/^\.\/+/, "");
  }
  ```
  with one controller per normalized path (`:31-37`) — this is what makes the existing "recreated
  resource keeps one controller" behaviour work.
- A failure stays visible while its retry executes, by explicit comment:
  `// Keep an existing failure visible while its retry is in progress.` (`:42`)
- Throwing flush is verbatim:
  ```ts
  // :91-93
  if (failures.length > 0) {
    throw new AggregateError(failures.map((failure) => failure.error), "工程文件写入失败");
  }
  ```
- `whenQuiescent` is documented as *"Test/low-level ordering primitive. It intentionally does not
  reject failures."* (`:96`)
- `statusFor` precedence is error → persisting → idle (`:104-109`).
- `export const persistenceMonitor = new PersistenceMonitor();` (`:145`) — module singleton, which
  is exactly the shape KERN-01 will later replace; the characterization suite must keep passing when
  that happens, so it should observe through the instance (`new PersistenceMonitor()`) where possible
  and through the singleton only where the invariant is singleton-specific.

`operationHistory` — `packages/apps/editor/src/project/history/operationHistory.ts`:

- Capacity, verbatim: `private readonly capacity = 100;` (`:79`) enforced by
  `if (entries.length > this.capacity) entries.shift();` (`:143`).
- A new operation truncates the redo tail: `const entries = state.entries.slice(0, state.current);`
  (`:133`).
- `changed === false` short-circuits and records nothing: `if (!applied.changed) return applied.value;`
  (`:129`).
- Undo/redo *replace* the stored operation with the applied inverse:
  `entries[index] = { ...entry, operation: applied.inverse };` (`:164`, `:184`).
- Multi-target checkpoint: `captureTargets` de-duplicates by `key`, captures all, and
  `restoreTargets` replays in reverse order, aggregating failures into an
  `AggregateError("Failed to restore operation checkpoint")` (`:48-73`).
- `enqueue` serializes every mutation through a promise chain and toggles the `busy` flag between
  `pending === 1` and `pending === 0` (`:81-98`).

`CompositeOperation` — `packages/apps/editor/src/project/history/operations.ts`:

- On a mid-composite failure, completed children are undone by applying their inverses in reverse
  order, and the original error is tagged with the failing child's stage:
  ```ts
  // :87-89
  if (error && typeof error === "object" && !("commandStage" in error)) {
    Object.assign(error, { commandStage: currentOperation?.meta.stage ?? this.meta.stage });
  }
  ```

**"Reactivity after `set`/`patch`" (VERIFY-04, last clause):** this invariant is about the resource
layer, not the history class. The observable form is: after `resource.patch([…])` (routed through
`operationHistory.execute`) or after an undo, a reader of `resource.raw().value()` /
`resource.value()` observes the new value **within the same microtask chain**, without a re-read and
without an effect flushing a timer. The existing `operationHistory.test.ts:88-89` already asserts one
half (`floorResource.value().title` updates while the write is still delayed) — the characterization
version should assert it for both `set` and `patch` paths and after undo.

### Pattern 4: Turn the silent skip into a required fixture (VERIFY-06)

**What:** playwight fixtures that *fail with a message* when a prerequisite is absent, instead of
skipping.

**The one skip in the workspace**, verbatim:

```ts
// packages/apps/service-worker/e2e/project-host.spec.ts:3
const withEditor = process.env.MOTA_WITH_EDITOR !== "0";
…
// :102
  test.skip(!withEditor, "requires a staged Editor release");
```

Note the polarity: the config (`packages/apps/service-worker/playwright.config.ts:3`) computes the
same predicate and uses it to choose the `webServer` command
(`${withEditor ? "pnpm build:with-editor" : "pnpm build"}`), so the default is "editor staged". The
skip only fires when someone sets `MOTA_WITH_EDITOR=0` — which is precisely the escape hatch that
makes a large class of host behaviour silently untested.

Adjacent, same class of problem: `project-host.spec.ts:55-59` forks its assertions on `withEditor`,
so a run with the editor absent asserts *less* rather than failing. Whatever fixture replaces the
skip should also make that branch explicit.

**Recommended shape:** an extended `test` (Playwright's `test.extend`) that (a) asserts the editor
release is actually staged, (b) `throw`s a descriptive error naming the missing prerequisite and the
exact command that would satisfy it (`pnpm --filter @motajs/service-worker build:with-editor`), and
(c) treats `MOTA_WITH_EDITOR=0` as an explicit, *announced* opt-out (a CI-visible marker such as
`test.info().annotations.push(...)` plus a reasoned message) rather than a silent pass. `test.skip`
at runtime counts as success for GitHub required checks, so "skipped" is indistinguishable from
"passed" in the merge box [CITED: https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks].

### Pattern 5: Screenshot baseline as human-review artifacts, not machine assertions

**What:** a capture script (Playwright) that writes PNGs into `.planning/baseline/screenshots/`, with
no `toHaveScreenshot` reference images.

**Why not `toHaveScreenshot`:** the official docs state that browser rendering *"can vary based on the
host OS, version, settings, hardware, power source (battery vs. power adapter), headless mode, and
other factors"* and that reference names encode browser **and platform** (e.g. `…-chromium-darwin`),
with the explicit instruction to generate baselines in the same environment used for comparison
[CITED: https://playwright.dev/docs/test-snapshots]. Since D-01 keeps e2e out of the PR gate and D-08
mandates human comparison, machine snapshots would add an OS-keyed filename problem and a
platform-fragile assertion for zero gate value.

**Determinism guidance to apply during capture** (same source):
- Use `expect(page).toHaveScreenshot({ stylePath })`-style CSS injection only if you go the assertion
  route; for a capture script, inject the same masking CSS manually or hide volatile regions with
  `page.addStyleTag` before capturing.
- The two known volatile surfaces here are the **runtime preview iframe** (loaded under
  `sandbox="allow-scripts allow-same-origin"` and serving project-authored code) and the **Pixi
  canvas / Monaco editor** (GPU- and font-dependent). Freeze the viewport size, disable animations,
  and capture a named surface per target.
- Capture must run against a deterministic project fixture. `ProjectSandbox`
  (`packages/apps/editor/e2e/utils/projectSandbox.ts`) already intercepts all requests and serves
  files from `MOTA_JS_ROOT/project`, which is the same fixture the unit tests use — so the screenshot
  baseline and the test baseline describe the same input.

The five targets map onto existing e2e test IDs, which is the cheapest reliable way to freeze them:

| Baseline image | Surface | Anchor selector (from `editor-smoke.spec.ts`) |
|----------------|---------|-----------------------------------------------|
| `shell.png` | Workbench shell / top bar | `app-topbar`, `workbench`, `edit-mode-select` |
| `editor-map.png` | Map editor | `map-pixi-renderer`, `map-canvas-input`, `floor-management-list` |
| `editor-table.png` | Schema table (tower) | `panel-tower`, `schema-table` |
| `editor-code.png` | Scripts / Monaco workspace | `scripts-workspace`, `script-code-editor` |
| `editor-asset.png` | Resources workspace | `resources-workspace`, `.resourceCard` |

### Anti-Patterns to Avoid

- **Splitting `vitest.config.ts` and then declaring unit tests submodule-free.** The config split
  removes the *load-time* throw but leaves seven runtime-reachable submodule reads
  (`sampleProject.ts:3,27`; `blockly/uiRoundTrip.test.ts:11,17`; `blockly/projectEntries.test.ts:14,170`;
  `sampleProjectCommands.test.ts:26,56,84,119`). Verify the actual behaviour with
  `pnpm --filter @motajs/editor test` in a tree where the submodule is absent before claiming D-13.
- **Using `lint: eslint --fix` as the CI gate.** A fixing gate can never fail on formatting and will
  silently rewrite the checkout. Use `eslint .` (no `--fix`) in CI.
- **Running the `unit` job with `--if-present` semantics that hide a *broken* script.** `pnpm -r run`
  already skips absent scripts; a script that *exists* and fails must fail the job.
- **Path-filtering the required workflow.** Docs: a PR that touches only files outside the filter
  leaves the required check permanently "Waiting for status to be reported" and blocks the PR
  [CITED: https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks].
  D-02's "all packages, no affected-only subset" already avoids this — keep it that way.
- **Using `workflow_dispatch` for the gated workflow.** Only `push`, `pull_request`,
  `pull_request_review`, `pull_request_target`, `deployment`, `deployment_status` runs can satisfy a
  required check (same source). D-03's `pull_request` + `push: main` is correct.
- **Recording baseline numbers before repairing the environment or with an unrecorded git state.**
  D-06 says the baseline is diffable later; a baseline produced on a dirty or partially-installed tree
  is worse than no baseline because it looks authoritative. Record the commit SHA and submodule SHA
  in the snapshot JSON.
- **Asserting the protocol mismatch as `3 !== 4`.** That is a tautology that will pass for the wrong
  reason. Assert each value against its own literal, in its own test, with a comment stating the
  mismatch is intentional.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Running every package's unit suite from the root | A custom Node script walking `packages/**/package.json` | `pnpm -r run test` | pnpm already skips packages without the script and gives dependency-aware ordering; a hand-rolled walker must re-implement package selection, output prefixing and exit codes. |
| Per-package type checking | A root `tsc` over a generated `files` list | Existing `tsc -b` project references, one per package | Each package's `tsconfig.json` already declares its own `include`/`paths`; a root program would need to duplicate every `paths` mapping and would diverge from the Vite `@/` resolution (`packages/libs/config/resolvePlugin.js`). |
| Detecting that the submodule is missing | An `if exists` shell guard in CI that silently continues | `actions/checkout` with `submodules: recursive` on the jobs that need it; `mota-root.ts`'s own throw everywhere else | The existing throw is already a good error message (`mota-root.ts:17-21`) naming the exact remediation command. Don't duplicate or soften it. |
| Making the e2e prerequisite fail loudly | A wrapper script that greps Playwright output for "skipped" | A Playwright fixture (`test.extend`) that throws | Playwright has first-class fixtures and annotations; parsing its stdout is brittle across reporters and locales. |
| Counting tests for the baseline | Grepping for `it(`/`test(` occurrences | `vitest run --reporter=json` (and `--reporter=json` on Playwright) | Source-level counting is wrong for every table-driven or `for`-generated case, and it can't distinguish passing from skipped. |
| Producing the artifact-size number | Re-implementing compression guesses | The plugin already emits it | `createEditorArtifactReport` already computes `files`, `rawBytes`, `gzipBytes`, `brotliBytes` and logs them (`editor-artifact-plugin.ts:78-98,160-162`). Capture the printed line, or read `editor-manifest.json` + sizes rather than recomputing. |
| A screenshot diff / approval tool | Any new dev dependency | Committed PNGs + human eyes (D-08) | D-08 explicitly forbids automatic JSON/image diffing and CI visual alerting this phase. |
| A test-project aggregator (Vitest `projects`) | Root `vitest.config.ts` with `projects` | Per-package `vitest.config.ts` (D-14) | Root-only options (`coverage`, `reporters`, `resolveSnapshotPath`) cannot live in project configs, and the aggregation would re-create the coupling being removed [CITED: https://vitest.dev/guide/projects]. |

**Key insight:** almost every instrument this phase needs already exists in the repo, partially —
a per-package vitest config in `service-worker`, an artifact reporter in the editor build plugin, a
route-intercepting fixture in `e2e/utils/projectSandbox.ts`, a fault-injecting filesystem in
`test/utils/MemoryFileSystem.ts`. The phase's work is mostly *wiring and recording*, not construction.
The one genuinely new artifact class is the characterization suite, and even that has an existing
suite's worth of conventions to copy.

## Runtime State Inventory

This phase moves no production code, so the usual rename inventory (stored data / live service config
/ OS-registered state / secrets / build artifacts) is largely empty. It is **not** omitted, because
two of the five categories are genuinely load-bearing here: the submodule's on-disk state and the
repository's out-of-git merge protection.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | None — no database, datastore or persisted key is touched by this phase. Verified by scope: deliverables are CI config, package scripts, test files, and a new `.planning/baseline/` directory. The editor's IndexedDB/Dexie stores and the SW's Cache Storage are untouched. | None |
| **Live service config** | **Yes — and it is the phase's only out-of-git state.** The "blocking merge" half of D-04 is repository branch-protection/ruleset configuration. It is not in the repo, cannot be added by a workflow file, and needs admin permission. Also: the existing `h5test` environment and its SSH secrets (`.github/workflows/deploy-editor-h5test.yml:13,44-46`) are live service config that the new `ci.yml` must NOT touch. | Configure `required_status_checks = [lint, typecheck, unit, build]` via repo Settings → Rulesets/Branches or the REST API. Record the four job names as a contract in `.planning/baseline/BASELINE.md`. Verify the `pull_request` trigger (not `workflow_dispatch`) so the runs can satisfy the checks. |
| **OS-registered state** | None — no Task Scheduler task, launchd plist, systemd unit, pm2 process or service registration is created or renamed. Verified by reading the phase scope and the repo's `.github/workflows/` (one deploy workflow, no service registration). | None |
| **Secrets / env vars** | **Partially.** No secret name changes, but four env vars govern this phase's behaviour and must be understood: `MOTA_JS_ROOT` (overrides the submodule path; `mota-root.ts:11`), `MOTA_WITH_EDITOR` (the e2e skip's escape hatch; `packages/apps/service-worker/playwright.config.ts:3` and `project-host.spec.ts:3`), `MOTA_EDITOR_E2E_PORT` (`packages/apps/editor/playwright.config.ts:3`), `PLAYWRIGHT_USE_SYSTEM_CHROME` (`:5`). CI sets none of these today. | Do not add required secrets to `ci.yml`. Document the four env vars in `BASELINE.md` (they are part of the reproduction recipe). If `MOTA_WITH_EDITOR=0` is retained as an opt-out, ensure it is never set in CI. |
| **Build artifacts / installed packages** | **Yes, three items.** (1) `packages/apps/editor/styled-system/` — generated by the editor's `prepare` script (`panda codegen`) and gitignored (`packages/apps/editor/.gitignore:29`); it exists locally but is absent from a fresh clone, and `tsc -b`/`vite build` need it. (2) `*.tsbuildinfo` files under each package's `node_modules/.tmp/` (gitignored via `node_modules`). (3) The current working copy's `node_modules` tree is **broken** — every workspace junction is dangling (see Environment Availability). | CI must run `panda codegen` (or rely on `pnpm install` triggering `prepare`) before `typecheck`/`build`. Baseline capture must record that it ran on a regenerated `styled-system`. Repair the local `node_modules` before capturing anything. |

**The canonical question** — *after every file in the repo is updated, what runtime systems still have
the old state cached, stored, or registered?* — has exactly two answers here: the **repository's merge
protection settings** (must be configured outside git, and once set becomes a standing constraint on
every later phase), and the **pending `mota-js` submodule checkout** (a working-tree state that changes
which tests can start at all). Everything else in the phase is reproducible from the committed tree.

## Common Pitfalls

### Pitfall 1: Decoupling the Vitest config while leaving seven runtime submodule reads
**What goes wrong:** `vite.config.ts` loses its `MOTA_JS_ROOT` import, editor unit tests start, the
config split is declared done — and the CI `unit` job still fails at collection in any checkout without
the submodule, because seven test modules import `MOTA_JS_ROOT` transitively or directly.
**Why it happens:** the coupling has two distinct mechanisms (config-load evaluation vs test-time file
reads) and only the loud one is visible.
**How to avoid:** enumerate the readers before writing `ci.yml`. Measured this session:
`packages/apps/editor/e2e/core-panel-write.spec.ts:5,23` (e2e), `packages/apps/editor/e2e/utils/projectSandbox.ts:4,14-15` (e2e),
`packages/apps/editor/test/utils/sampleProject.ts:3,27` (unit fixture, walks `project/`),
`packages/apps/editor/test/blockly/uiRoundTrip.test.ts:11,17` (unit),
`packages/apps/editor/test/blockly/projectEntries.test.ts:14,170` (unit),
`packages/apps/editor/src/project/commands/__tests__/sampleProjectCommands.test.ts:26,56,84,119` (unit),
plus the five unit files that consume `loadSampleProject()`:
`src/runtime/__tests__/RuntimeResourceGateway.test.ts:6`,
`src/project/history/__tests__/operationHistory.test.ts:12`,
`src/project/data/__tests__/persistStatus.integration.test.ts:9`,
`src/project/model/__tests__/projectModel.test.ts:10`.
**Warning signs:** `Error: Invalid mota-js root …; missing index.html, main.js, project/data.js, _server/table/data.comment.js` raised from a *test file* rather than from config evaluation.

### Pitfall 2: Treating "blocking merges" as a code change
**What goes wrong:** `ci.yml` is merged, everyone assumes merges are blocked, and nothing is blocked,
because required status checks are repository settings.
**Why it happens:** D-03/D-04 read like a single deliverable but mix a committed artifact with an
administrative one.
**How to avoid:** split it explicitly. The plan needs a task that ends in a human-verifiable state
("a PR shows four required checks and cannot merge while one is red"), and the RESEARCH/BASELINE
artifact must name the four job names so settings can reference them.
**Warning signs:** the phase's verification says "CI exists" rather than "a red check blocks merge".

### Pitfall 3: `tsc -b` does not typecheck the fixtures the new tests rely on
**What goes wrong:** the `typecheck` gate is green while `test/` (fixtures, `arbitraries.ts`,
`test/blockly/*.ts`) contains type errors, because the editor's app tsconfig excludes it:

```json
// packages/apps/editor/tsconfig.app.json:21-26
  "exclude": [
    "src/**/*.test.ts",
    "src/**/*.test.tsx",
    "src/**/__tests__/**",
    "test"
  ]
```
**Why it happens:** excluding tests from the app program is a deliberate build-hygiene choice, but it
means test code has **no** typechecking project — the editor's `tsconfig.node.json` only includes
`vite.config.ts`, `vite-plugin-mota-server.ts`, `editor-artifact-plugin.ts`, `mota-root.ts`
(`packages/apps/editor/tsconfig.node.json:14`).
**How to avoid:** decide explicitly whether the phase's "per-package typecheck" covers test code. If it
should, add a test tsconfig (e.g. `tsconfig.test.json` including `test` and `src/**/__tests__/**`) and
reference it from `tsconfig.json`; if not, record the gap in `BASELINE.md` so later phases know the
typecheck gate has a known blind spot.
**Warning signs:** a characterization test with a genuine type error that only fails at runtime.

### Pitfall 4: Baseline captured on a broken or dirty tree
**What goes wrong:** the numbers are recorded, later phases diff against them, and every subsequent
"regression" is actually noise from the original capture conditions.
**Why it happens:** the phase's whole value is a trustworthy before-picture, and "trustworthy" depends
on environment state that is easy to skip.
**How to avoid:** gate the baseline task on (a) a repaired `node_modules`, (b) an initialized submodule
at the recorded SHA, (c) a regenerated `styled-system`, and (d) a recorded `git rev-parse HEAD` +
`git submodule status` + `pnpm --version` + `node --version`. Capture **before** the `vitest.config.ts`
split so the "before" numbers come from the unmodified configuration.
**Warning signs:** the snapshot JSON has no commit SHA, or the submodule column is empty.

### Pitfall 5: Counting tests instead of reading the runner's own report
**What goes wrong:** the per-package "unit counts" in `BASELINE.md` disagree with what CI later
reports, so the baseline is immediately disputed.
**Why it happens:** counting files is easy and looks quantitative. A file census taken this session
gives 92 editor + 8 service-worker + 8 h5animate + 9 packer + 2 react-hooks + 2 react-monaco-editor +
1 react-store + 1 file2x = **123 unit test files** and **10 e2e specs** (8 editor + 2 service-worker) —
but "files" is not "tests", and D-05 asks for per-package unit counts.
**How to avoid:** derive counts from `vitest run --reporter=json` / Playwright's JSON reporter.
Record passed/failed/skipped/total separately — skipped is the number VERIFY-06 is about.
**Warning signs:** `BASELINE.md` reports a single integer per package with no pass/skip split.

### Pitfall 6: Assuming the submodule changes workspace membership
**What goes wrong:** someone avoids initializing the submodule in CI because "it will change the
lockfile / add a package / break `pnpm -r`", or conversely initializes it and is surprised.
**Why it happens:** `pnpm-workspace.yaml:1-4` lists `packages/external/*`, so the submodule directory
*is* in the workspace glob.
**How to avoid:** know that `packages/external/mota-js` contains **no `package.json`**, so pnpm will not
treat it as a workspace project and `pnpm-lock.yaml` should not change. This is an assumption that must
be confirmed with a one-line check the moment the submodule is initialized (see Assumptions Log A1).
**Warning signs:** `pnpm install` reporting a different workspace-project count after submodule init.

### Pitfall 7: Believing the local environment can produce the baseline
**What goes wrong:** the executor runs `pnpm --filter @motajs/editor test` as its first command, gets a
module-resolution error unrelated to the submodule, and misdiagnoses the phase's central problem.
**Why it happens:** the installed `node_modules` in this working copy is broken independently of the
submodule (see Environment Availability).
**How to avoid:** repair first, and treat "the test command runs at all" as Wave 0 exit criteria
separate from "the test command passes".
**Warning signs:** `Cannot find module '…/node_modules/vitest/vitest.mjs'` (observed this session).

## Code Examples

### Reading the existing per-package script surface (the gap VERIFY-02 must close)

Verbatim, measured this session:

```json
// packages/apps/editor/package.json:6-14
  "scripts": {
    "prepare": "panda codegen",
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview",
    "test": "vitest run",
    "test:e2e": "playwright test"
  },
```
— note the **absent** `typecheck`.

```json
// packages/apps/service-worker/package.json:6-17
  "scripts": {
    "dev": "vite build && vite",
    "build": "vite build",
    "build:with-editor": "pnpm --filter @motajs/editor build && pnpm build && pnpm stage:editor",
    "deploy:h5test": "bash scripts/deploy-h5test.sh",
    "verify:deployment": "node scripts/verify-deployment.mjs",
    "stage:editor": "node scripts/stage-editor.mjs",
    "preview": "vite preview",
    "typecheck": "tsc -b",
    "test": "vitest run",
    "test:e2e": "playwright test"
  },
```
— the only package with `typecheck`.

Script presence across the workspace (measured): `test` exists in editor, service-worker, file2x,
h5animate, packer, react-hooks, react-monaco-editor, react-store — **absent** in `@motajs/config`,
`@motajs/utils`, `@motajs/react-dark-mode`. `typecheck` exists **only** in service-worker. `build`
exists in editor, service-worker, packer. Packages with a `tsconfig.json` but no `typecheck`:
`file2x`, `packer`, `react-dark-mode`, `react-hooks`, `react-monaco-editor`, `react-store`, `utils`,
plus the editor.

### Mirroring the existing workflow's install/verify shape

```yaml
# Source: .github/workflows/deploy-editor-h5test.yml:17-35
      - uses: actions/checkout@v4
        with:
          submodules: recursive

      - uses: pnpm/action-setup@v4
        with:
          version: 11.10.0

      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Verify service worker host
        run: |
          pnpm --filter @motajs/service-worker typecheck
          pnpm --filter @motajs/service-worker test
```

The new `ci.yml` should reuse this exact preamble per job, with `submodules: recursive` present only on
`build` (D-15) — and, pending the D-13/D-15 decision below, possibly on `unit` as well.

### Freezing the protocol mismatch without changing either value (VERIFY-07)

Both sides, verbatim:

```ts
// packages/apps/editor/editor-artifact-plugin.ts:22-30
export interface EditorArtifactManifest {
  schemaVersion: 2;
  environmentProtocolVersion: 1;
  runtimeProtocolVersion: 3;
  editorVersion: string;
  buildId: string;
  entrypoints: { editor: "index.html"; runtime: "runtime.html" };
  files: EditorArtifactFile[];
}
```

```ts
// packages/apps/editor/editor-artifact-plugin.ts:163-171
      const manifest: EditorArtifactManifest = {
        schemaVersion: 2,
        environmentProtocolVersion: 1,
        runtimeProtocolVersion: 3,
        editorVersion,
        buildId: await calculateEditorBuildId(outDir),
        entrypoints: { editor: "index.html", runtime: "runtime.html" },
        files,
      };
```

```ts
// packages/apps/editor/src/runtime/protocol.ts:4
export const RUNTIME_PROTOCOL_VERSION = 4;
```

Already-asserted side, verbatim:

```ts
// packages/apps/editor/src/runtime/protocol.test.ts:4-6
describe("runtime host protocol", () => {
  it("requires protocol v4 and carries the host preview URL", () => {
    expect(RUNTIME_PROTOCOL_VERSION).toBe(4);
```

There is **no** existing assertion on the manifest's `runtimeProtocolVersion`. `editor-artifact-plugin.test.ts`
covers build-id stability and the plugin's two phases (`apply: "serve"` / `apply: "build"`) but the
manifest is only written inside `closeBundle`, which the unit test does not drive. The generated
assertion must therefore pin the literal `3` (and may additionally pin `schemaVersion: 2` and
`environmentProtocolVersion: 1`, which are the other two constants in the same object). Assert each
value against its own literal with a comment stating the manifest/runtime mismatch is intentionally
preserved per the milestone's Out-of-Scope table.

### The artifact budget the baseline must quantify

```ts
// packages/apps/editor/editor-artifact-plugin.ts:47
const MAX_EDITOR_ARTIFACT_BYTES = 20 * 1024 * 1024;
```
```ts
// packages/apps/editor/editor-artifact-plugin.ts:102-105
function validateEditorArtifact(files: readonly EditorArtifactFile[], report: EditorArtifactReport): void {
  if (report.rawBytes > MAX_EDITOR_ARTIFACT_BYTES) {
    throw new Error(`Editor artifact ${mib(report.rawBytes)} exceeds the ${mib(MAX_EDITOR_ARTIFACT_BYTES)} budget`);
  }
```
The report fields to record are `{ files, rawBytes, gzipBytes, brotliBytes }`
(`editor-artifact-plugin.ts:38-43`), plus `rawBytes / 20971520` as a percentage of the ceiling. The
build also enforces "exactly one standard `ts.worker`" and "no css/html workers" (`:106-114`), which are
worth recording as pass/fail baseline facts since later phases touch the MPA entry graph.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Vitest `workspace` key | `test.projects` | deprecated in Vitest 3.2, removed in favour of `projects` | If anyone proposes a root aggregator, use `projects`, not `workspace` [CITED: https://vitest.dev/guide/projects] |
| `pnpm/action-setup` installing pnpm via npm | `pnpm/setup@v2` installing a self-contained binary + runtime | `pnpm/setup@v2` requires pnpm 11+ | Available, but the repo standardizes on `pnpm/action-setup@v4` + `actions/setup-node@v4`; do not mix mechanisms in one repo without a reason |
| `actions/cache` for `~/.npm`-style caches | `setup-node`'s `cache: pnpm` (or explicit store-dir caching) | long-standing | Two competing monorepo cache strategies exist; the existing workflow's choice works and should be mirrored rather than re-litigated |
| Branch protection rules | Repository rulesets | rulesets are the newer, richer mechanism | Either satisfies "required status checks"; rulesets additionally support expected-source app pinning for checks |
| Playwright `toMatchSnapshot` for images | `toHaveScreenshot` with `maxDiffPixels`/`stylePath` | — | Not adopted here (D-08 manual comparison), but named so the planner can see the deliberate rejection |

**Deprecated/outdated in this repo's context:**
- Root `lint: eslint --fix` as a gate — see Anti-Patterns.
- `package.json` without `packageManager`/`engines` while CI pins pnpm 11.10.0 and Node 24
  (`CONCERNS.md` "Root workspace tooling is minimal"). Out of scope for this phase's requirements, but
  adding `packageManager` would be the cheapest way to stop local/CI drift — flag for the planner as an
  optional, low-risk addition; **do not** treat it as required by VERIFY-02.

## Assumptions Log

> Claims tagged `[ASSUMED]` in this research. The planner and discuss-phase use this table to identify
> decisions needing confirmation before execution.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `packages/external/mota-js` contains no `package.json`, so initializing it does **not** add a pnpm workspace project and does **not** change `pnpm-lock.yaml`. Evidence: a full enumeration of the pinned SHA returned 28 entries (`.github`, `.gitignore`, `.prettierignore`, `LICENSE.md`, `README.md`, `_codelab`, `_docs`, `_server`, `docs`, `editor-mobile.html`, `editor.html`, `extensions`, `index.html`, `libs`, `logo.png`, `main.js`, `project`, `runtime.d.ts`, `runtime.min.d.ts`, `server.js`, `server.py`, `styles.css`, `tsconfig.json`, two CJK-named entries) with no manifest — but this is an **absence in a remote listing**, not a declaration, so it is ASSUMED and must be confirmed on disk after `git submodule update --init`. | Pitfall 6, VERIFY-01 | If a manifest appears, `pnpm install` gains a workspace project: the lockfile may change, `pnpm -r build`/`test` may start running mota-js's own scripts, and CI could fail for an unrelated reason. Cheap to check, expensive to discover mid-execution. |
| A2 | The four CI job names (`lint`, `typecheck`, `unit`, `build`) are the right granularity for required status checks, and job-level checks are what gets registered. | D-01/D-04 | If finer granularity is wanted, the workflow shape changes before settings are configured; reconfiguring later means re-editing branch protection. |
| A3 | A Windows-captured PNG baseline is acceptable as a *human-review* artifact for later phases even though it would be unusable as an automated Playwright assertion (D-08 mandates manual comparison). | Pattern 5, D-07/D-08 | If a later phase tries to automate the comparison, the Windows/Linux rendering delta produces false positives and the baseline is discarded — a re-capture, not a wrong decision. |
| A4 | `pnpm install` triggers the editor's `prepare: panda codegen` in CI, so `styled-system/` exists before `typecheck`/`build`. Not verified by running it (local install is broken). | Environment Availability | If it does not run, `tsc -b` and `vite build` fail on unresolved `@styled-system/*`. Mitigation: add an explicit `panda codegen` step — cheap insurance. |
| A5 | The single `test.skip` found by grep is the *only* silent skip in the workspace e2e suites. | Pattern 4, VERIFY-06 | A skip expressed another way (conditional `return`, an `if` around the body) would be missed. Mitigation: apply the required fixture at file/config level so the whole spec inherits it. |
| A6 | "Resource reactivity after `set`/`patch`" is satisfiable by asserting observable value change, without asserting scheduler internals. | Pattern 3 | If the invariant is really about signal-effect scheduling, the assertion shape changes. Low risk — the existing `operationHistory.test.ts:88-89` already demonstrates the observable form. |
| A7 | The five screenshot targets are shell / map / table / code / asset, anchored on existing `data-test-id`s. CONTEXT says "four editors + shell" without enumerating them; the four are inferred from the milestone's capability list. | Pattern 5, D-07 | If the intended fourth surface differs, one image is wrong — a trivial re-capture. Worth a one-line confirmation. |

## Open Questions

1. **What is the actual test *count*, not test-*file* count, per package?** (D-05 requires counts.)
   - What we know: a file census this session gives editor 92, service-worker 8, h5animate 8, packer 9,
     react-hooks 2, react-monaco-editor 2, react-store 1, file2x 1 unit test files (123 total) plus 10
     e2e spec files (8 editor + 2 SW).
   - What's unclear: how many individual cases, and how many are skipped. Unmeasurable here — the local
     environment cannot execute vitest.
   - Recommendation: derive counts from `vitest run --reporter=json` and Playwright's JSON reporter,
     recording passed/failed/**skipped**/total. Use the file census only as a wiring sanity cross-check
     (a package reporting zero tests while owning files is a bug), not as the deliverable.

2. **Does the `unit` job check out the submodule, or do seven test modules get rewritten?** (the
   D-13/D-15 conflict — see Pitfall 1.)
   - What we know: D-15 says `unit` does not checkout the submodule; D-13 says unit tests use
     `MemoryFileSystem`/`sampleProject` fixtures rather than real mota-js. But `sampleProject.ts` *is*
     the real-mota-js fixture — it reads `MOTA_JS_ROOT/project` off disk
     (`test/utils/sampleProject.ts:1-3,27,29-47,60-71`). D-13's two clauses contradict each other.
   - Options: (a) checkout the submodule on `unit` — simplest, contradicts D-15's letter, preserves 100%
     of current coverage; (b) replace `sampleProject` with an embedded in-memory project fixture —
     honours D-15 but modifies a shared fixture 5 existing suites depend on, which D-09 forbids touching;
     (c) exclude the 7 submodule-dependent files from the unit job and run them in `build` — splits the
     suite and makes "unit counts" job-dependent.
   - Recommendation: **(a)**, with the deviation from D-15 recorded explicitly in `BASELINE.md`. A unit
     job that silently omits 7 of 92 editor files cannot anchor "behavior unchanged". Option (b) is the
     right long-term answer but is disproportionate for Phase 1 and collides with D-09. **Needs user
     confirmation before planning — it changes a locked decision (D-15).**

3. **Is test code in scope for the `typecheck` gate?** (Pitfall 3.)
   - What we know: nothing currently typechecks the editor's `test/` or `__tests__/` trees.
   - Recommendation: add an editor `tsconfig.test.json`, because this phase's characterization suites are
     the files you least want un-typechecked. If that is too much scope, record the blind spot in
     `BASELINE.md` and defer to Phase 2.

4. **Who sets the required status checks, and when?** (D-03/D-04.)
   - What we know: it needs admin/owner permission and lives outside git.
   - Recommendation: plan an explicit `checkpoint:human-verify` task whose acceptance is "a PR cannot
     merge while one of the four checks is red". The workflow remains independently valuable (it runs and
     reports) before it is made required.

5. **Should the editor e2e suites also fail-fast without the submodule?**
   - What we know: only the SW spec has a skip; all 8 editor specs already fail loudly without
     `ProjectSandbox`'s `MOTA_JS_ROOT`.
   - Recommendation: leave editor e2e alone — VERIFY-06 is specifically about *silent* skips. Do not add a
     fixture where no skip exists.

## Environment Availability

> Probed this session on the research machine (Windows, `E:\github\motajs-monorepo`).

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | vitest, vite, tsc | ✓ | `v22.18.0` local (CI uses 24) | Keep CI on 24 so it matches the recorded baseline environment |
| pnpm | install, `-r` fan-out | ✓ | `10.15.0` local (CI pins `11.10.0`) | Use `pnpm/action-setup@v4 version: 11.10.0` in CI; do not change local majors in this phase |
| git | submodule, baseline SHA | ✓ | `2.37.3.windows.1` | — |
| pnpm content-addressable store | offline repair | ✓ | `E:\.pnpm-store\v10` | Regenerate from the registry if the store is incomplete |
| Working `node_modules` | **every** test/build command | ✗ | — | **Blocking** — see below |
| `packages/external/mota-js` submodule | editor `vite.config.ts` load; editor e2e; 7 unit modules; editor build | ✗ | — | **Blocking for build/e2e**; see Pitfall 1 for the unit consequence |
| `packages/apps/editor/styled-system/` | editor `tsc -b`, `vite build` | ✓ present locally, gitignored | generated by PandaCSS 1.8.1 | Regenerate with `panda codegen` on any fresh clone or CI job |
| Playwright browsers | e2e + screenshot capture | not probed | — | `pnpm --filter @motajs/editor exec playwright install chromium`; the SW config specifically requires the `chrome` channel, while the editor prefers system Chrome only on non-CI macOS (`packages/apps/editor/playwright.config.ts:5-6`) |
| GitHub repo admin access | required status checks (D-04) | not probed | — | Manual hand-off task; see Open Question 4 |

**Missing dependencies with no fallback:**

- **A working `node_modules` tree.** Measured this session: every workspace junction in
  `packages/apps/editor/node_modules` is dangling. Of 44 entries, 31 were symlinks and **0 of 31
  resolved** (`fs.existsSync` false, `fs.realpathSync` → `UNKNOWN`), including `vitest`, `react`,
  `alien-signals`, `antd`, and `blockly`. Invoking the local vitest shim failed with
  `Cannot find module '…\packages\apps\editor\node_modules\vitest\vitest.mjs'` (observed), while the
  store target `node_modules/.pnpm/vitest@4.0.18_@types+node@2_40fa9cf456199f129a788c983c819a4a/node_modules/vitest/vitest.mjs`
  verifiably exists — so the store is intact and the links are stale. `pnpm install --frozen-lockfile`
  reports `Lockfile is up to date` / `Already up to date` and then aborts with
  `UNKNOWN: unknown error, open '…\node_modules\.pnpm\ajv-formats@3.0.1_ajv@8.20.0\node_modules\ajv\package.json'`.
  The volume is NTFS. Remediation in order: (1) re-run `pnpm install --frozen-lockfile` with the
  lockfile's pnpm major (`11.10.0`), (2) remove `node_modules` and reinstall, (3) `pnpm install --force`
  if the store is also damaged. **No baseline number produced before this is repaired can be trusted**,
  and the executor must not misread this error as a submodule problem.
- **The `mota-js` submodule.** Not initialized: `git submodule status` prints
  `-3efb548e407ad2b8007b498cb98401e2012a0b55 packages/external/mota-js` (leading `-`), and the directory
  is empty. `.gitmodules` pins `url = git@github.com:ckcz123/mota-js.git` (SSH). In CI,
  `actions/checkout` with `submodules: recursive` rewrites the SSH URL to HTTPS for the same host using
  the workflow token, and the repository is public, so no SSH key is needed — the existing deploy
  workflow already depends on this. Locally, the SSH URL requires a GitHub SSH key or a
  `url.<base>.insteadOf` rewrite. **Record the resolved SHA in the baseline snapshot.**

**Missing dependencies with fallback:**

- Playwright browsers — installable on demand and unnecessary for the lint/typecheck/unit gates.
- GitHub admin access — the workflow still runs and reports while advisory; only the "blocking" half of
  D-04 is gated on it.

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json:24`, so this section is included.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `4.0.18` (editor, service-worker) / catalog `^4.0.16`; Playwright `1.61.1` for e2e |
| Config file | Per package. Editor: **currently** the `test` block inside `packages/apps/editor/vite.config.ts:51-56` → **to become** `packages/apps/editor/vitest.config.ts`. Model to copy: `packages/apps/service-worker/vitest.config.ts:1-13`. Others: `packages/libs/{packer,h5animate,react-monaco-editor}/vitest.config.ts`; `file2x`/`react-hooks`/`react-store` run Vitest defaults and select the DOM with a `// @vitest-environment jsdom` docblock |
| Quick run command | `pnpm --filter @motajs/editor test` (per package). Root, once the fan-out lands: `pnpm test` → `pnpm -r run test` |
| Full suite command | `pnpm lint && pnpm typecheck && pnpm test` (root), plus `pnpm --filter @motajs/editor build`. e2e stays outside the gate (D-01): `pnpm --filter @motajs/editor test:e2e` |
| Baseline capture commands | `… test --reporter=json`; `pnpm --filter @motajs/editor build` (emits `dist/editor-manifest.json` plus the artifact size line); `pnpm --filter @motajs/editor test:e2e` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| VERIFY-01 (submodule) | Submodule present at a recorded SHA and the editor unit suite starts | smoke | `git submodule status packages/external/mota-js` (must not start with `-`) then `pnpm --filter @motajs/editor test` | ❌ Wave 0 — submodule init |
| VERIFY-01 (baseline) | Per-package unit counts, e2e run, build output, artifact size vs 20 MiB, manifest, protocol constants and screenshots are all recorded | smoke / artifact diff | `.planning/baseline/` regenerates to the same JSON modulo timestamps | ❌ Wave 0 — `.planning/baseline/` does not exist |
| VERIFY-02 (lint) | Lint gate fails on a lint error in any workspace package | CI gate | `pnpm exec eslint .` (no `--fix`) | ✅ `eslint.config.js`, `packages/apps/editor/eslint.config.js` |
| VERIFY-02 (typecheck) | Per-package `tsc -b` fails on a type error | CI gate | `pnpm -r run typecheck` | ❌ `packages/apps/editor/package.json` has no `typecheck`; 7 libs also lack it |
| VERIFY-02 (unit) | Unit gate fails on a failing test in any package | CI gate | `pnpm -r run test` | ✅ — subject to Open Question 2 |
| VERIFY-02 (build) | Production build succeeds and the artifact stays under 20 MiB | CI gate | `pnpm -r run build` | ✅ scripts exist; that job needs `submodules: recursive` + `styled-system` |
| VERIFY-03 | `error → retry → idle` | unit (characterization) | `pnpm --filter @motajs/editor exec vitest run src/fs/__tests__/persistExecutor.invariants.test.ts` | ❌ Wave 0 |
| VERIFY-03 | Concurrent latest-wins (one executing + one pending; a newer intent supersedes the pending one) | unit (characterization) | same file, distinct `it` | ❌ Wave 0 |
| VERIFY-03 | Persist failure does not roll resource/UI state back | unit (characterization) | same file; force a failure with `MemoryFileSystem.setWriteErrorForPath` and assert the resource value is unchanged | ❌ Wave 0 |
| VERIFY-04 | Capacity 100 — the 101st commit evicts the oldest and `current` tracks | unit (characterization) | `pnpm --filter @motajs/editor exec vitest run src/project/history/__tests__/operationHistory.invariants.test.ts` | ❌ Wave 0 |
| VERIFY-04 | Inverse ops — undo/redo restore prior values and rewrite the stored inverse | unit (characterization) | same file | ❌ Wave 0 |
| VERIFY-04 | Multi-target checkpoint rollback — duplicate `key` dedupe, reverse-order restore, a failed apply leaves every target at its pre-apply value | unit (characterization) | same file | ❌ Wave 0 |
| VERIFY-04 | Resource reactivity after `set`/`patch` (and after undo) | unit (characterization) | same file | ❌ Wave 0 |
| VERIFY-06 | A missing e2e prerequisite fails instead of skipping | e2e (fixture) | `pnpm --filter @motajs/service-worker test:e2e` with the editor unstaged must FAIL with a named message | ❌ Wave 0 — fixture |
| VERIFY-07 | Manifest `runtimeProtocolVersion === 3` and `RUNTIME_PROTOCOL_VERSION === 4`, both asserted, neither changed | unit (generated assertion) | `pnpm --filter @motajs/editor exec vitest run src/runtime/protocol.test.ts editor-artifact-plugin.test.ts` | ⚠️ half exists — `protocol.test.ts:6`; the manifest side is Wave 0 |

### Sampling Rate

- **Per task commit:** the narrowest command covering the change —
  `pnpm --filter @motajs/editor exec vitest run <touched test file>`.
- **Per wave merge:** `pnpm test && pnpm typecheck`.
- **Phase gate:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green **plus** the baseline
  artifacts committed and reproducible, before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] **Environment repair** — reinstall `node_modules` so any test command runs at all.
- [ ] **`packages/external/mota-js` initialized** — `git submodule update --init packages/external/mota-js`,
      then confirm Assumption A1 (no `package.json`) in the same task.
- [ ] **`packages/apps/editor/vitest.config.ts`** — extracted from `vite.config.ts:51-56`; aliases
      `@` / `@test` / `@styled-system`; no `MOTA_JS_ROOT` import.
- [ ] **`typecheck` scripts** — editor plus `file2x`, `packer`, `react-dark-mode`, `react-hooks`,
      `react-monaco-editor`, `react-store`, `utils`.
- [ ] **Root fan-out scripts** — `test` / `typecheck` / `build`, plus a non-`--fix` lint invocation for CI.
- [ ] **`.github/workflows/ci.yml`** — `lint` / `typecheck` / `unit` / `build`; `on: pull_request` +
      `push: branches: [main]`; no secrets; no path filters; `submodules: recursive` only where needed.
- [ ] **`.planning/baseline/`** — `BASELINE.md`, `baseline.json`, `editor-manifest.json`, `screenshots/`.
- [ ] **`src/fs/__tests__/persistExecutor.invariants.test.ts`** and **`persistenceMonitor.invariants.test.ts`** — VERIFY-03.
- [ ] **`src/project/history/__tests__/operationHistory.invariants.test.ts`** — VERIFY-04.
- [ ] **Manifest protocol assertion** — extend `editor-artifact-plugin.test.ts` (or add a sibling) to pin
      `runtimeProtocolVersion: 3` literally — the missing half of VERIFY-07.
- [ ] **Service-worker e2e required fixture** — replaces `test.skip` at `project-host.spec.ts:102` — VERIFY-06.
- [ ] **Screenshot capture script** under `packages/apps/editor/e2e/`. If it lives there, confirm the new
      editor vitest config still excludes `e2e/**` so vitest does not try to collect it.

*(If Open Question 2 resolves toward option (b), add a Wave 0 gap for an embedded in-memory project
fixture replacing `test/utils/sampleProject.ts`'s disk walk.)*

## Security Domain

> `workflow.security_enforcement` is `true` and `workflow.security_asvs_level` is `1`
> (`.planning/config.json:47-48`), so this section is included. Phase 1 adds no application code — its
> security surface is **CI supply chain and secret hygiene**, not runtime behaviour.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth code added or changed. |
| V3 Session Management | no | No session surface touched. |
| V4 Access Control | no | No authorization logic. The repository's *merge* access control (required checks) is platform configuration, covered under V14. |
| V5 Input Validation | no (new code) | The phase parses no untrusted input. Existing `new Function`/`eval` surfaces (`TableMetaEvaluator.ts:77,94,121`; `components/Table/externalEditor.ts:99`) are untouched by this phase. |
| V6 Cryptography | no | Nothing cryptographic is added. The artifact plugin's SHA-256 is pre-existing and used for integrity/dedupe, not confidentiality. |
| **V14 Configuration** | **yes** | Least-privilege `permissions: contents: read` on every `ci.yml` job; no secrets; no `pull_request_target`; actions referenced by the same major tags the existing workflow uses; required status checks pinned to an expected source app where the platform supports it. |
| **V10 Malicious Code** | **yes** | No new npm dependency is introduced — the strongest available control, and the reason the Package Legitimacy Audit is empty. `submodules: recursive` pulls third-party code into the CI workspace, but git pins it to an exact SHA and the gate jobs only read it. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| `pull_request_target` used to reach secrets from a fork PR | Elevation of Privilege | Use `pull_request` (D-03 already specifies it). Never add `pull_request_target` to this workflow. |
| Secrets reachable from fork-triggered runs | Information Disclosure | `ci.yml` must reference **no** secrets and **no** `environment:`. The `h5test` secrets stay exclusively in `deploy-editor-h5test.yml:13,44-46`. |
| Over-broad `GITHUB_TOKEN` | Elevation of Privilege / Tampering | Set `permissions: contents: read`; the deploy workflow already does this (`:14-15`). |
| Mutable third-party action tags | Tampering | Stay on the first-party `actions/*` and `pnpm/action-setup` the repo already uses; SHA-pinning is stronger but diverges from the existing convention — make that a deliberate decision, not a silent one. |
| Build scripts from untrusted packages executing during install | Tampering | `pnpm-workspace.yaml:6-11` already allow-lists which packages may run build scripts (`@parcel/watcher`, `dprint`, `esbuild`, `less`, `sharp`); do not widen it in this phase. |
| Committed screenshots leaking project data or developer paths | Information Disclosure | Capture only editor surfaces driven by the public sample project via `ProjectSandbox`. Avoid the runtime preview iframe, which executes project-authored code and renders arbitrary content. Keep `BASELINE.md`/`baseline.json` free of absolute paths and environment values. |
| A required check silently downgraded by a `paths:` filter | Repudiation | No `paths:` filter on the required workflow — see Anti-Patterns. |

**Explicitly out of scope for this phase's security work:** fixing the `fs.postData` error swallowing,
the `runtimeProtocolVersion` drift, the iframe `allow-same-origin` posture, or the absent CSP. All are
recorded in `.planning/codebase/CONCERNS.md`, and all are behaviour changes that the milestone's
Out-of-Scope table forbids.

## Sources

### Primary (HIGH confidence) — files read directly this session

- `packages/apps/editor/vite.config.ts:8,25,35,51-56` — the co-located test block and the `MOTA_JS_ROOT` chain
- `packages/apps/editor/mota-root.ts:4-9,15-21,25` — required paths, load-time throw, exported constant
- `packages/apps/editor/src/fs/PersistExecutor.ts:1-107` — full state machine and the no-rollback doc contract
- `packages/apps/editor/src/fs/PersistenceMonitor.ts:15-17,31-53,64-78,80-94,96,104-109,145`
- `packages/apps/editor/src/project/history/operationHistory.ts:42-46,48-73,79,81-98,100-122,124-148,150-196,199`
- `packages/apps/editor/src/project/history/operations.ts:60-102,87-89,143-156`
- `packages/apps/editor/editor-artifact-plugin.ts:22-30,38-43,47,102-115,163-171`
- `packages/apps/editor/src/runtime/protocol.ts:4`; `packages/apps/editor/src/runtime/protocol.test.ts:4-6`
- `packages/apps/editor/package.json`; `packages/apps/service-worker/package.json`; `package.json`; `pnpm-workspace.yaml`
- `packages/apps/service-worker/vitest.config.ts:1-13`; `packages/apps/service-worker/playwright.config.ts:3,20`; `packages/apps/editor/playwright.config.ts:3-6,16-29`
- `packages/apps/service-worker/e2e/project-host.spec.ts:3,55-59,101-102`
- `packages/apps/editor/src/fs/types.ts:8-16`; `test/utils/MemoryFileSystem.ts`; `test/utils/sampleProject.ts`; `test/utils/testHelpers.ts`; `test/setup.ts`
- `packages/apps/editor/tsconfig.app.json:21-26`; `tsconfig.node.json:14`; `packages/libs/config/tsconfig.lib.base.json:19-21`; `packages/libs/utils/tsconfig.json`
- `.github/workflows/deploy-editor-h5test.yml`; `eslint.config.js`; `packages/apps/editor/eslint.config.js`; `packages/apps/editor/panda.config.ts:9`
- `.planning/codebase/TESTING.md`; `.planning/codebase/CONCERNS.md` — corroborating layout, fixture and gap analysis
- Live probes: `git submodule status`; broken-junction enumeration; `pnpm install --frozen-lockfile`; a vitest invocation; `pnpm store path`; workspace script census; test-file census

### Secondary (MEDIUM confidence)

- [Playwright — Visual comparisons](https://playwright.dev/docs/test-snapshots) — snapshot layout, platform keying, `--update-snapshots`, `maxDiffPixels`, `stylePath`, and the instruction to generate baselines in the environment used for comparison
- [Vitest — Test Projects](https://vitest.dev/guide/projects) — `projects` vs the deprecated `workspace` key; step/root-only options; valid project config filenames
- [pnpm — pnpm run](https://pnpm.io/cli/run) — `-r` skips packages lacking the script; `--if-present`; dependency-aware task graph; `--dry-run` for recursive runs
- [GitHub Docs — Troubleshooting required status checks](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks) — eligible triggering events; `workflow_dispatch` does not satisfy required checks; path filters can leave a PR permanently "Waiting for status to be reported"; `skipped`/`neutral` count as success
- [GitHub Docs — Creating rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository) and [Available rules for rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets) — required status checks are settings/API configuration requiring admin, not workflow content
- [GitHub REST — Branch protection](https://docs.github.com/en/rest/branches/branch-protection) and [Rules](https://docs.github.com/en/rest/repos/rules) — the API surface for automation
- [GitHub API — ckcz123/mota-js contents at the pinned SHA](https://api.github.com/repos/ckcz123/mota-js/contents/?ref=3efb548e407ad2b8007b498cb98401e2012a0b55) — 28 entries, no `package.json` (basis for Assumption A1)

### Tertiary (LOW confidence — validation recommended)

- [Characterization test (Wikipedia)](https://en.wikipedia.org/wiki/Characterization_test), [FreeCodeCamp — characterization tests before refactoring](https://www.freecodecamp.org/news/characterization-tests-before-refactoring-legacy-code/), [Synapse Studios — characterization testing](https://docs.synapsestudios.com/concepts/legacy/characterization-testing), [TechDebt.works](https://techdebt.works/techniques/test-characterization/) — the observation-first procedure, "don't freeze implementation details", "keep the green test and mark the bug", and the mutation-check expectation. Consistent across sources and with Feathers, but web-sourced.
- pnpm monorepo CI caching claims (that `setup-node`'s `cache: 'pnpm'` caches `node_modules` rather than the content-addressable store) — single community article; the repo's existing workflow already works with `cache: pnpm`, so this research recommends mirroring rather than acting on it.

## Metadata

**Confidence breakdown:**

- **Standard stack: HIGH** — the phase adds no dependency; every version cited was read from the workspace manifests this session.
- **Architecture: HIGH** — the CI layering, the fan-out semantics and the config split are all grounded in files read directly, and the one non-obvious constraint (required checks are out-of-repo) is confirmed by GitHub's own documentation.
- **Pitfalls: HIGH for the repo-specific ones, MEDIUM for the tooling ones** — Pitfall 1, 3, 5, 6, 7 come from reading source and from live probes; the CI/caching and screenshot-determinism guidance is doc-backed but partly community-sourced.
- **Environment: HIGH** — measured, not assumed, including the negative results.
- **Characterization-test invariants: HIGH for what the code does (read verbatim), by design LOW for "is this the right thing to freeze"** — D-11 already constrains the latter to the REQ list, and the suite is scoped to observed behaviour rather than intent.

**Known limits of this research:** the local environment could not execute any test or build, so no
runtime figure in this document is measured — only file counts, config facts and static source
behaviour. Every number the phase is supposed to *record* (per-package test counts, artifact bytes, e2e
results) is therefore still unknown and must be produced by the phase itself.

**Research date:** 2026-09-20
**Valid until:** ~2026-10-20 for repo-derived facts (stable, but invalidated by any commit that moves
the files cited); ~2027-03 for the GitHub Actions and Playwright mechanics (slow-moving). The
environment findings should be treated as stale the moment `node_modules` is repaired.
