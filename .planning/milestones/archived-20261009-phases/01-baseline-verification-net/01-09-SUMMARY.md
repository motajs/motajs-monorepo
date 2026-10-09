---
phase: 01-baseline-verification-net
plan: 09
subsystem: tooling
tags: [eslint, lint-gate, no-explicit-any, react-hooks, react-refresh, eslint-disable, allowExportNames, verify-02]
status: complete

# Dependency graph
requires:
  - phase: 01-baseline-verification-net (01-06)
    provides: the non-fixing root `eslint .` gate and the 46-error baseline
  - phase: 01-baseline-verification-net (01-08)
    provides: Prettier as the formatting authority, which removed the 4 formatting/generated-output errors and left the 42 real rule violations this plan resolves
provides:
  - "scripts/verify/lint-severities.js — asserts the previously-erroring rules keep their severity and that every eslint-disable* comment carries a reason"
  - "zero ESLint errors under both the root config and the editor config (was 42); `pnpm lint` and `pnpm --filter @motajs/editor lint` both exit 0"
  - "11 real, behaviour-preserving fixes plus 27 narrow reason-carrying disables; the `>21` bucket of `@typescript-eslint/no-explicit-any` shrinks to 19 disables plus 2 real casts"
  - "editor `allowExportNames` limited to the four context-module hooks"
  - "reasons added to all 18 pre-existing disable comments so the verifier's whole-tree assertion can hold"
affects: [01-07 (ci.yml lint job), editor-core extraction phases]

# Actuals (#2632)
# Basis: chars/4 over `git diff 47d5491..HEAD` = 45,597 chars / 4. The 60,000-token estimate was
# sizing the reasoning + full-gate runs, not the realised diff, so the measured number is far lower.
actuals:
  tokens: 11399
  tasks: 5
  commits: 5
  plan_head_before: 47d549151023b71c07e72220653755dd1636d5d2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Resolve a lint error at the narrowest scope: real fix -> per-line reasoned disable -> name-scoped rule option"
    - "Severity/config assertions come from parsed `eslint --print-config` JSON, never from config source text"
    - "Every `eslint-disable*` comment must carry a ` -- ` reason; a repo-owned verifier enforces it tree-wide"

key-files:
  created:
    - scripts/verify/lint-severities.js
    - packages/apps/editor/src/Workbench/modals/SelectPoint/SelectPointShell.tsx
  modified:
    - packages/apps/editor/src/Workbench/AppendPicPanel/index.tsx
    - packages/apps/editor/src/utils/canvas/detectWhiteBackground.ts
    - packages/apps/editor/src/blockly/registry/path.ts
    - packages/apps/service-worker/src/server/fsApi.ts
    - packages/apps/editor/src/runtime/iframeEntry.ts
    - packages/apps/editor/src/runtime/RuntimeProvider.tsx
    - packages/apps/editor/src/project/model/tableModels.ts
    - packages/apps/editor/src/hooks/useFs.ts
    - packages/apps/editor/src/hooks/useImageAssetUrl.ts
    - packages/apps/editor/src/MapEditor/rendering/MapPixiRenderer.tsx
    - packages/apps/editor/src/Workbench/modals/SearchFlags/useSearchFlagsModal.tsx
    - packages/apps/editor/src/Workbench/modals/SelectPoint/SelectPointContent.tsx
    - packages/apps/editor/src/Workbench/modals/SelectPoint/useSelectPointModal.tsx
    - packages/apps/editor/src/Workbench/modals/StatusBarPreview/StatusBarPreviewContent.tsx
    - packages/apps/editor/src/Workbench/EventsEditor/BlocklyCapabilitiesContext.tsx
    - packages/apps/editor/src/Workbench/modals/CheckboxSet/CheckboxSetModalContext.tsx
    - packages/apps/editor/src/components/ContentBoundary/index.tsx
    - packages/apps/editor/src/components/Table/index.tsx
    - packages/apps/editor/src/Workbench/components/PanelSlot.tsx
    - packages/apps/editor/e2e/core-panel-write.spec.ts
    - packages/apps/editor/eslint.config.js
    - "18 files carrying pre-existing disable comments (reasons added; see Deviations)"

key-decisions:
  - "The two `any` operand casts in tableModels.ts become `as number`, not `string | number`: TypeScript rejects `'+'` on two `string | number` operands (TS2365), and casts are erased so the emitted `+` keeps JavaScript's own string-or-number semantics."
  - "The seven `react-hooks/set-state-in-effect` sites are all narrow disables, not refactors: each setState is the visible consequence of an external-system handshake, and the milestone forbids behaviour change."
  - "`useFs.useHandlerUpdate` uses `useMemo(() => handler.update.bind(handler), [handler])` — React's own `useCallback(fn, deps)` == `useMemo(() => fn, deps)` equivalence; the overloaded `UpdateFn` cannot take an inline forwarding wrapper without a cast."
  - "The four context-module hooks are resolved with `allowExportNames` (a rule option narrowing a known false-positive class), not by extracting the context into a third module — the severity stays `error` and no other name is whitelisted."
  - "The `RuntimeProvider` forward reference to `start()` keeps a narrow `react-hooks/immutability` disable: routing the retry through a ref would change the handshake retry's timing."

patterns-established:
  - "Repo-owned severity/disable verifier: parse `--print-config` JSON per config region, and `git ls-files`-walk the tree for reasonless disables"

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "`pnpm lint` (= plain `eslint .`, no --fix, no --max-warnings) exits 0 with zero errors"
    requirement: "VERIFY-02"
    verification:
      - kind: integration
        ref: "`pnpm lint` -> exit 0, '108 problems (0 errors, 108 warnings)'; `node -e` census of `eslint . -f json` -> errors=0 warnings=108"
        status: pass
      - kind: unit
        ref: "`node -e` on the resolved `package.json` scripts -> lint === \"eslint .\""
        status: pass
    human_judgment: false
  - id: D2
    description: "`pnpm --filter @motajs/editor lint` also exits 0, so the editor config standing alone is green"
    requirement: "VERIFY-02"
    verification:
      - kind: integration
        ref: "`pnpm --filter @motajs/editor lint` -> exit 0, '92 problems (0 errors, 92 warnings)'"
        status: pass
    human_judgment: false
  - id: D3
    description: "No rule was weakened: severities unchanged in both config regions, no new ignore, no warning cap, and every disable carries a reason"
    requirement: "VERIFY-02"
    verification:
      - kind: integration
        ref: "`node scripts/verify/lint-severities.js` -> exit 0; 45 disable comments scanned, all reasoned"
        status: pass
      - kind: integration
        ref: "`git diff 47d5491 -- eslint.config.js packages/apps/editor/eslint.config.js` -> only the editor `allowExportNames` addition; no severity token changed, root config untouched"
        status: pass
    human_judgment: false
  - id: D4
    description: "No behaviour changed: typecheck, the editor unit suite and the production build stay green at the recorded figures"
    requirement: "VERIFY-02"
    verification:
      - kind: integration
        ref: "`pnpm typecheck` -> exit 0 (9 packages + service-worker)"
        status: pass
      - kind: unit
        ref: "`pnpm --filter @motajs/editor test` -> 96 files / 891 tests passed (baseline 891), exit 0"
        status: pass
      - kind: integration
        ref: "`pnpm build` -> exit 0; editor artifact 57 files / 17,616,604 bytes / 16.8005 MiB (baseline 17,616,558 bytes; budget 20 MiB)"
        status: pass
      - kind: unit
        ref: "`pnpm --filter @motajs/service-worker test` -> 8 files / 44 tests passed (covers the rewritten `normalizeProjectPath` control-char guard)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The two pattern rewrites are provably behaviour-identical (no-useless-escape class, control-char helper)"
    requirement: "VERIFY-02"
    verification:
      - kind: other
        ref: "Throwaway Node comparison: old vs new `parseDataPath` regex identical over 27 inputs; old control-char regex vs `hasControlCharacter` identical over all 65,536 UTF-16 code units + 12 strings"
        status: pass
    human_judgment: false
  - id: D6
    description: "Formatting stays clean and no dependency changed"
    requirement: "VERIFY-02"
    verification:
      - kind: integration
        ref: "`pnpm format` -> exit 0; `pnpm format:check` -> exit 0, 'All matched files use Prettier code style!'; no `.planning/**` or `packages/external/**` tracked path modified"
        status: pass
      - kind: integration
        ref: "`git diff --name-only 47d5491 -- pnpm-lock.yaml package.json packages/apps/*/package.json` -> empty"
        status: pass
    human_judgment: false

# Metrics
duration: 21m 45s
completed: 2026-09-21
---

# Phase 01 Plan 09: Clear the 42-error lint debt without weakening a rule Summary

**The four-layer PR gate's lint layer is now satisfiable: `pnpm lint` and `pnpm --filter @motajs/editor lint` both exit 0 (0 errors / 108 warnings), reached by 11 behaviour-preserving real fixes, 27 narrow reason-carrying per-line disables, and one name-scoped `allowExportNames` rule option — with a repo-owned verifier proving no severity moved and no disable comment is reasonless.**

## Performance

- **Duration:** 21m 45s
- **Started:** 2026-09-21T07:46:08Z
- **Completed:** 2026-09-21T08:07:53Z
- **Tasks:** 5
- **Files changed:** 39 (311 insertions, 75 deletions) from plan head `47d5491`

## Accomplishments

- **42 errors → 0.** Every pre-existing non-stylistic error is resolved; warnings are untouched at 108 (none capped or suppressed). `pnpm lint` = exactly `eslint .`.
- **No rule weakened.** Both config regions report the same severities as before the plan. `git diff 47d5491` on the two ESLint configs contains only the editor's `allowExportNames` addition — no severity token, no new ignore, no `--max-warnings`, no root-config change.
- **A repo-owned proof.** `scripts/verify/lint-severities.js` parses `eslint --print-config` JSON for an editor file and a non-editor file, asserts the eight previously-erroring rules still resolve to their original severity, walks `git ls-files` for every `eslint-disable*` comment, and fails on a missing ` -- reason`. It scanned **45** disable comments, all reasoned.
- **Behaviour is untouched.** `pnpm typecheck` exit 0, the editor suite 891/891 (baseline 891), the service-worker suite 44/44, `pnpm build` exit 0 with the editor artifact at 57 files / 17,616,604 bytes / 16.8005 MiB (baseline 17,616,558; +46 bytes).

## Verification Evidence

| Check | Command | Result |
|-------|---------|--------|
| Severity/disable verifier | `node scripts/verify/lint-severities.js` | **pass** — exit 0, 45 disables all reasoned |
| Root lint | `pnpm lint` (`eslint .`) | **pass** — exit 0, 0 errors / 108 warnings |
| Editor lint | `pnpm --filter @motajs/editor lint` | **pass** — exit 0, 0 errors / 92 warnings |
| Lint census | `pnpm exec eslint . -f json` | **pass** — `errors=0 warnings=108` |
| Format | `pnpm format` | **pass** — exit 0 (idempotent) |
| Format check | `pnpm format:check` | **pass** — exit 0, "All matched files use Prettier code style!" |
| Typecheck | `pnpm typecheck` | **pass** — exit 0, 9 packages + service-worker |
| Editor units | `pnpm --filter @motajs/editor test` | **pass** — 96 files / **891 tests** (baseline 891), exit 0 |
| Service-worker units | `pnpm --filter @motajs/service-worker test` | **pass** — 8 files / 44 tests, exit 0 |
| Build + artifact | `pnpm build` | **pass** — exit 0; editor artifact 57 files / 17,616,604 B / 16.8005 MiB / 84.0025 % of the 20 MiB ceiling (baseline 57 files / 17,616,558 B; Δ +46 B) |
| No dependency change | `git diff --name-only 47d5491 -- pnpm-lock.yaml package.json packages/apps/*/package.json` | **pass** — empty |
| Config severities | `git diff 47d5491 -- eslint.config.js packages/apps/editor/eslint.config.js` | **pass** — only the `allowExportNames` block; no severity change |
| Pattern equivalence | throwaway Node comparison (outside the repo) | **pass** — `parseDataPath` regex identical over 27 inputs; control-char regex vs helper identical over all 65,536 code units + 12 strings |

**Final warning breakdown (108):** `@typescript-eslint/no-unused-vars` 51, `arrow-body-style` 34, `react-hooks/exhaustive-deps` 7, `react-hooks-better-stable/exhaustive-deps` 7, unused `eslint-disable` directives 6, `@typescript-eslint/no-explicit-any` 3. The total is identical to the 01-08 baseline; one warning re-bucketed from `exhaustive-deps` to `no-unused-vars` as a side effect of the `useFs.ts` memoisation change and the `SelectPointShell` extraction.

## Per-site resolution table (all 42 errors)

Legend: **fix** = real, behaviour-preserving change; **disable** = single-line `// eslint-disable-next-line <rule> -- <reason>`.

### `prefer-const` (2)

| Site | Resolution | Detail |
|------|-----------|--------|
| `src/Workbench/AppendPicPanel/index.tsx:203` | **fix** | Removed `let source: HTMLCanvasElement`, declared `const source = rasterCanvas(...)` at the single assignment site |
| `src/utils/canvas/detectWhiteBackground.ts:11` | **fix** | Split `black` out as `const black = 0` (its only writer is a commented-out line); the `white > black && …` comparison is preserved, so the returned boolean is identical |

### `no-useless-escape` (1)

| Site | Resolution | Detail |
|------|-----------|--------|
| `src/blockly/registry/path.ts:8` | **fix** | `[^.\[\]]` → `[^.[\]]`; the closing bracket's escape is kept (an unescaped one would terminate the class). Character class identical |

### `no-control-regex` (1)

| Site | Resolution | Detail |
|------|-----------|--------|
| `packages/apps/service-worker/src/server/fsApi.ts:13` | **fix** | Replaced `/[\u0000-\u001f\u007f-\u009f]/` with a module-local `hasControlCharacter` UTF-16 code-unit scan; guard order (control → backslash → leading slash) and error type/message untouched |

### `@typescript-eslint/no-explicit-any` (21) — 2 fixes, 19 disables

| Site | Resolution | Reason text (where a disable) |
|------|-----------|-------------------------------|
| `src/project/model/tableModels.ts:85` | **fix** | `safeValue(node.left, env) as any` → `as number` |
| `src/project/model/tableModels.ts:86` | **fix** | `safeValue(node.right, env) as any` → `as number` (casts erase; emitted `left + right` unchanged) |
| `src/project/model/tableModels.ts:40` | **disable** | `遍历 acorn 节点的动态属性读取器，属性名在运行时决定；收紧为精确类型需在每处属性访问加断言，属独立议题` |
| `src/runtime/iframeEntry.ts:10` | **disable** | `引擎注入到 iframe window 上的未类型化 mota-js 全局桥；本侧没有其类型定义，后续逐值收窄` |
| `src/runtime/iframeEntry.ts:436` | **disable** | `runtime.core 是引擎侧未类型化的 mota-js core 对象，本侧无其类型，读取处逐值收窄` |
| `src/runtime/iframeEntry.ts:496` | **disable** | same as 436 |
| `src/runtime/iframeEntry.ts:563` | **disable** | same as 436 |
| `src/runtime/iframeEntry.ts:606` | **disable** | same as 436 |
| `e2e/core-panel-write.spec.ts:52` | **disable** | `Playwright 用例读写的是动态形状的项目 JSON 文件，为整个夹具建模精确类型不划算` |
| `e2e/core-panel-write.spec.ts:57` | **disable** | same as 52 |
| `e2e/core-panel-write.spec.ts:61` | **disable** | same as 52 |
| `e2e/core-panel-write.spec.ts:66` | **disable** | same as 52 |
| `e2e/core-panel-write.spec.ts:70` | **disable** | same as 52 |
| `e2e/core-panel-write.spec.ts:1173` | **disable** | `事件编辑器面板输出的 JSON5 为动态结构，用例需就地改写字段` |
| `src/project/commands/__tests__/sampleProjectCommands.test.ts:101` | **disable** | `测试读取的是深度嵌套、动态生成的表结构元数据，其形状正是被测对象；为夹具而非生产代码补类型不划算` |
| `src/project/commands/__tests__/sampleProjectCommands.test.ts:110` | **disable** | same as 101 |
| `src/project/model/__tests__/tableModels.test.ts:74` | **disable** | same as 101 |
| `src/services/tower/__tests__/towerService.test.ts:25` | **disable** | `需重置 towerService 私有的 dataHandler 单例缓存；towerService 未暴露测试清理接口，新增生产方法仅为测试不划算` |
| `src/services/tower/__tests__/towerService.test.ts:30` | **disable** | same as 25 |
| `src/services/tower/__tests__/towerService.test.ts:63` | **disable** | `需把绑定内存文件系统的 handler 注入私有 handlers 映射；FileHandlerManager 只有 clear() 没有注入接口，新增生产方法仅为测试不划算` |
| `src/services/tableMeta/__tests__/tableMetaService.test.ts:42` | **disable** | same as towerService.test.ts:63 |

**Seam audit (why the two `FileHandlerManager`/`towerService` casts stay disables):** `FileHandlerManager` exposes `clear()`/`get()`/`remove()` but no way to register an already-loaded `FileHandler`; `get()` would construct one bound to the default `fs`, not the test's `MemoryFileSystem`, so the tests reach into the private `handlers` map. `towerService` exposes no cache-reset seam. Adding a production method purely for tests was explicitly rejected by the plan.

### `react-hooks/set-state-in-effect` (7) — 7 disables

| Site | Resolution | Site-specific reason |
|------|-----------|----------------------|
| `src/MapEditor/rendering/MapPixiRenderer.tsx:294` | **disable** | `该 setState 是销毁 ref 持有的 Pixi 纹理这一外部系统拆卸的可见结果，并非可派生状态` |
| `src/hooks/useImageAssetUrl.ts:21` | **disable** | `object URL 的创建与 cleanup 中的 revoke 同属一个生命周期，url 无法在渲染期派生` |
| `src/Workbench/modals/SearchFlags/useSearchFlagsModal.tsx:38` | **disable** | `flag 索引懒加载，到达后需回填受控 select 的值；改为派生会在首帧改变受控值` |
| `src/Workbench/modals/SelectPoint/SelectPointContent.tsx:117` | **disable** | `地图尺寸收缩时需把夹取后的坐标持久写回 state，渲染期只能重算不能持久化` |
| `src/Workbench/modals/StatusBarPreview/StatusBarPreviewContent.tsx:53` | **disable** | `仅在代码变化时解析一次用户脚本；改为渲染期派生会在每次渲染重复解析` |
| `src/Workbench/modals/StatusBarPreview/StatusBarPreviewContent.tsx:73` | **disable** | `该 effect 驱动返回 Promise 的预览租约，异步回调内部写 state，属对外部系统订阅` |
| `src/Workbench/modals/StatusBarPreview/StatusBarPreviewContent.tsx:80` | **disable** | `运行时进入 error 时关闭租约并同步清理 React 持有的租约引用，属外部系统清理` |

**Per-site justification (all seven rejected a refactor):** each `setState` is the *visible consequence* of an external-system transition (Pixi texture teardown, object-URL revoke lifecycle, lazy index arrival, dimension-driven clamp persisted to state, code-driven parse memo, Promise-returning preview lease, runtime-error lease close). In every case, removing the synchronous `setState` would require deriving the value during render, which changes either a rendered prop (the controlled select's first-frame value), the parse frequency (user-code re-parse per render), or the commit ordering — none of which is behaviour-preserving on a milestone whose premise is that behaviour does not change. No effect body, dependency array or rendered prop was touched.

### `react-refresh/only-export-components` (8) — 4 fixes, 4 config-narrowed

| Site | Resolution | Detail |
|------|-----------|--------|
| `src/components/ContentBoundary/index.tsx:60` | **fix** | Deleted `export * from './RecoveryUI'`; `NotFoundRecovery` now imported from `@/components/ContentBoundary/RecoveryUI` in `PanelSlot.tsx` (the only barrel consumer; verified repo-wide) |
| `src/components/Table/index.tsx:44` | **fix** | Deleted `export { openExternalEditor } from './externalEditor'`; internal consumers (`TableRow.tsx`, `externalEditor.test.ts`) import the module directly, so the barrel re-export had no consumer |
| `src/Workbench/modals/SelectPoint/SelectPointContent.tsx:39` | **fix** | Dropped `export` from `parseStaticPointCoordinate` (file-local; the only caller is line 97) |
| `src/Workbench/modals/SelectPoint/useSelectPointModal.tsx:11` | **fix** | Moved `SelectPointShell` into its own module `SelectPointShell.tsx`; `useSelectPointModal.tsx` now exports only the hook and defines no local component (the local error-boundary class is not an offending export) |
| `src/Workbench/EventsEditor/BlocklyCapabilitiesContext.tsx:43` | **config-narrowed** | `allowExportNames` — value `useBlocklyInteractionCapabilities` |
| `src/Workbench/EventsEditor/EventEditorContext.tsx:49` | **config-narrowed** | `allowExportNames` — value `useEventEditor` |
| `src/Workbench/EventsEditor/EventEditorContext.tsx:55` | **config-narrowed** | `allowExportNames` — value `useEventEditorRegistration` |
| `src/Workbench/modals/CheckboxSet/CheckboxSetModalContext.tsx:8` | **config-narrowed** | `allowExportNames` — value `useCheckboxSetModalAction` |

**`allowExportNames` (exactly four names):** `useBlocklyInteractionCapabilities`, `useEventEditor`, `useEventEditorRegistration`, `useCheckboxSetModalAction`. These are the idiomatic React context-module shape (Provider + consumer hook in one file); extracting each context into a third module would rewire every consumer for no behavioural gain. This is the plugin's own documented option — a rule option narrowing a known false-positive class to named identifiers, **not** a severity change (still `error`), not a disable, and not a wildcard. The root config and every other name are untouched. Resolved editor config confirms `[2,{"allowConstantExport":true,"allowExportNames":[…four names…]}]`.

### `react-hooks/use-memo` (1)

| Site | Resolution | Detail |
|------|-----------|--------|
| `src/hooks/useFs.ts:47` | **fix** | `useCallback(handler.update.bind(handler), [handler])` → `useMemo(() => handler.update.bind(handler), [handler])`. This is React's own equivalence (`useCallback(fn, deps)` is implemented as `useMemo(() => fn, deps)`), the returned bound function and its dependency array are identical, and no hook slot or call signature changed. The inline-forwarding-wrapper form was rejected because `UpdateFn<T>` is an overloaded type whose last overload is `(transform: (current: T) => Promise<T>) => Promise<void>`, so a single inline arrow cannot satisfy all three overloads without a cast. |

### `react-hooks/immutability` (1)

| Site | Resolution | Reason text |
|------|-----------|-------------|
| `src/runtime/RuntimeProvider.tsx:129` | **disable** | `重试必须调用当前的 start 回调；改用 ref 打破该引用会改变握手重试的时序` |

The retry closure reads the `start` callback declared beneath it. Routing it through a ref (the "obvious" structural fix) would change what the retry invokes and its timing relative to render, in the handshake path the retry-once semantics depend on. Declarations, retry count and timeout were left untouched.

## Disable-comment ledger

- **45** disable comments exist in the tracked source tree; the verifier reports all 45 reasoned.
- 18 of them are pre-existing (see Deviations); 27 are new in this plan (19 `no-explicit-any` + 7 `set-state-in-effect` + 1 `immutability`).
- Real fixes: 4 mechanical + 2 casts + 4 export removals + 1 memoisation = **11** (the plan's artifact table said "12"; it double-counted the `fsApi` helper, which is one of the four mechanical fixes).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Added ` -- reason` to all 18 pre-existing disable comments**

- **Found during:** Task 1 (creating `scripts/verify/lint-severities.js`)
- **Issue:** Task 1's verifier was specified to walk the tracked tree and fail on any reasonless `eslint-disable*` comment, and Task 1's acceptance criterion required it to exit 0 — but all 18 pre-existing disable comments in the tree (`@typescript-eslint/no-explicit-any` ×2, `@typescript-eslint/no-implied-eval` ×5, `react-hooks/exhaustive-deps` ×5, `react-refresh/only-export-components` ×4, plus two file-level `/* eslint-disable … */` headers) carried no reason, so the verifier could not pass without them. The same task's "only the four named sites plus the new verifier" diff check therefore could not hold simultaneously.
- **Fix:** Appended a concrete ` -- <reason>` to each of the 18 existing comments. Comment-only; no rule, severity, code or dependency changed.
- **Files modified:** `packages/libs/react-monaco-editor/lib/MonacoEditor/index.tsx`, `src/Workbench/CommonEventPanel/index.tsx`, `src/Workbench/TowerPanel/index.tsx`, `src/Workbench/CodeEditor/index.tsx`, `src/Workbench/ScriptsWorkspace/index.tsx`, `src/Workbench/EventsEditor/CustomBlockManager.tsx` (×2), `src/utils/__tests__/serialize.property.test.ts` (×4), `src/components/Table/externalEditor.ts`, `src/Workbench/modals/shared/useCanvasDrawing.ts`, `src/fs/__tests__/FileHandler.test.ts`, `src/fs/__tests__/FileHandlerManager.test.ts`, `src/Workbench/modals/SelectFloor/SelectFloorModalContext.tsx`, `src/Workbench/modals/SelectMaterial/SelectMaterialModalContext.tsx`, `src/Workbench/modals/SelectPoint/SelectPointModalContext.tsx`
- **Verification:** `node scripts/verify/lint-severities.js` exit 0 (45/45 reasoned)
- **Committed in:** `ac6f2b8` (Task 1 commit)

**2. [Rule 1 - Bug] The `+` branch's "string-or-number" cast had to be `as number`**

- **Found during:** Task 2 (`tableModels.ts` operand casts)
- **Issue:** The plan asked the addition branch for "a cast that still permits JavaScript's own string-or-number semantics". The natural reading — `as string | number` — does not type-check: TypeScript reports `TS2365 Operator '+' cannot be applied to types 'string | number' and 'string | number'` (probe reproduced in an isolated `tsc --strict` run).
- **Fix:** Used `as number` for both operands in all four arithmetic branches. Casts are erased, so the emitted JavaScript is byte-identical and runtime `+` still performs JavaScript's own string concatenation-or-addition; only the compile-time view is narrowed.
- **Files modified:** `packages/apps/editor/src/project/model/tableModels.ts`
- **Verification:** `pnpm typecheck` exit 0; `eslint` reports zero `no-explicit-any`
- **Committed in:** `6c62417` (Task 2 commit)

### Process notes (not deviations from the plan's intent)

- **Commits landed on `main`.** `.planning/config.json` sets `git.branching_strategy: "none"`, this plan was explicitly directed to run in the main working tree with no worktree isolation, and plans 01-01…01-08 all committed on `main`. No `--no-verify` was used and no git config was changed.
- **`prettier --write` was run on the new verifier inside Task 1.** It immediately reported one `prettier/prettier` error on `scripts/verify/lint-severities.js`; formatting the new file is Prettier's own job and was explicitly sanctioned by Task 5. No `eslint --fix` was ever run.
- **A warning re-bucketed.** `react-hooks/exhaustive-deps` 8 → 7 and `@typescript-eslint/no-unused-vars` 50 → 51 versus the 01-08 baseline; the total stays 108. No exhaustive-deps warning was suppressed (every disable this plan added names a different rule).

## Issues Encountered

- **An `Edit` on `StatusBarPreviewContent.tsx` matched a 4-space search string inside a 6-space statement**, placing the reason comment before the wrong `setLease(null)`. Caught immediately by the per-rule JSON gate (one `set-state-in-effect` error remained at the re-located line), corrected by restoring the catch block and re-anchoring the comment with surrounding context. Lesson: for indented one-liners, anchor edits on the enclosing statement, not the line alone.
- **PowerShell mangles inline `node -e` JS** containing regex literals and quotes. Equivalence probes and the `--print-config` census were run from small temp `.js` files (under the approved temp dir) or via JSON-report post-processing instead.

## Known Stubs

None. No hardcoded empty value, placeholder text, or unwired data source was introduced.

## Threat Flags

None. The plan introduced no new network endpoint, auth path, file-access pattern or trust-boundary schema change. The `fsApi` control-char guard was rewritten to be exactly equivalent, and the lint run's JSON report is written to `node_modules/.gsd-lint.json` (gitignored) as the threat register required.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Plan 01-07 (ci.yml)** can now wire its `lint` job to `pnpm lint`: the gate exits 0 with 0 errors, so the four-job PR gate is finally satisfiable.
- **VERIFY-02** is declared by 01-07, 01-08 and 01-09; the shared-ID gate keeps it open until the last declaring plan has a SUMMARY.
- **Editor-core extraction phases** inherit an error-free, reason-disciplined lint baseline; any future `eslint-disable` must now carry a reason or `scripts/verify/lint-severities.js` fails.

---

*Phase: 01-baseline-verification-net*
*Completed: 2026-09-21*

## Self-Check: PASSED

- `scripts/verify/lint-severities.js` — FOUND
- `packages/apps/editor/src/Workbench/modals/SelectPoint/SelectPointShell.tsx` — FOUND
- `.planning/phases/01-baseline-verification-net/01-09-SUMMARY.md` — FOUND
- Commits `ac6f2b8`, `6c62417`, `2625198`, `bd8f0a1`, `89224cc` — FOUND (5 commits since plan head `47d5491`)
- `pnpm lint` / `pnpm --filter @motajs/editor lint` / `pnpm format:check` / `pnpm typecheck` / editor suite / `pnpm build` after all edits — exit 0
