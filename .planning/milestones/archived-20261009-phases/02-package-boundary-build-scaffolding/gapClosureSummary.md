# Phase 2 Gap Closure Summary

**Unit:** phase-2 gap closure after `02-VERIFICATION.md` (`gaps_found`) — closes 1 BLOCKER + 1 WARNING
**Scope:** user-approved A+B+C (2026-09-21); names G-01 / G-02 confirmed in `INTERFACE-NAME.md` § Section 4
**Branch:** `editor/boundary` (current checkout; no branch switch, no worktree)
**Status:** complete

**One-liner:** The `@`-alias removal had silently dropped the shipped FiraCode font from the editor build; this unit
restores it with a relative `url()`, makes the loss class machine-loud with a new artifact-asset gate (G-01), and gives
truth 3's fourth resolver axis a committed editor test (G-02).

---

## Commits

| Task | Commit | Subject | Files |
|------|--------|---------|-------|
| A | `ee01e59` | `fix(02): resolve the FiraCode url relatively after the @ alias removal` | `packages/apps/editor/src/css/editor.css` |
| B | `c99cb36` | `test(02): assert the editor artifact ships every referenced asset` | `scripts/verify/editorArtifactAssets.js` (G-01), `.github/workflows/ci.yml` |
| C | `41eb5ad` | `test(02): guard the editor vitest axis of core resolution` | `packages/apps/editor/src/__tests__/editorCoreResolution.test.tsx` (G-02) |

---

## Task A — BLOCKER fix (font resolution)

`packages/apps/editor/src/css/editor.css:1320`:
`src: url('@/assets/FiraCode.ttf')` → `src: url('../assets/FiraCode.ttf')` (relative, same file).
No global `resolve.alias['@']` restored; no Vite/Vitest config touched (D-05 preserved).

**Before / after evidence (built artifact, `pnpm --filter @motajs/editor build`):**

| Signal | Before (stale dist, commit `97e9aa7` state) | After |
|--------|----------------------------------------------|-------|
| emitted CSS `@font-face src` | `src:url(@/assets/FiraCode.ttf)` (literal, 404) | `src:url(./FiraCode-CzoQJ4O7.ttf)` |
| `url(@/` in emitted CSS | present in `editor-B-BCRaVm.css` (1 hit) | **0 hits** in every `dist/assets/**/*.css` |
| font under `dist/` | absent | `dist/assets/FiraCode-CzoQJ4O7.ttf` — **289,624 bytes** |
| artifact report | `56 files …` (font missing) | `Editor artifact: 57 files, raw 16.80 MiB, gzip 4.29 MiB, brotli 3.58 MiB` |

The emitted font hash `FiraCode-CzoQJ4O7.ttf` matches the pre-regression baseline entry
`.planning/baseline/editor-manifest.json` (`assets/FiraCode-CzoQJ4O7.ttf`), confirming this is the exact asset the
BLOCKER reported missing.

---

## Task B — G-01 artifact-asset gate

`scripts/verify/editorArtifactAssets.js` (repo verifier style: shebang, Chinese header with `用法：`, `REPO_ROOT` from
`import.meta.dirname`, `failures[]` + `check(...)`, one `console.error('editorArtifactAssets: …')` per failure,
`process.exit(1)`, `…: 全部断言通过` success line). Asserts against the **built artifact only**:
(a) no `url(@/` in any emitted CSS (recursive); (b) every non-`data:` `url()` target in the Vite CSS bundles resolves
to a real file; (c) a `FiraCode*.ttf` is emitted under `dist/`.

CI: exactly one new step `- run: node scripts/verify/editorArtifactAssets.js` appended to the **existing** `build` job,
after `- run: pnpm build`. No job added/renamed/reordered (D-13); `ci-workflow.js` stays green.

**Two-polarity evidence (scratch manipulations of the built artifact, all reverted):**

| Polarity | Scratch action | Observed |
|----------|----------------|----------|
| FAIL | `dist/assets/editor-p_xLvuHk.css`: `./FiraCode-CzoQJ4O7.ttf` → `@/assets/FiraCode.ttf` | `exit=1`; `含未解析的 url(@/` **and** `引用的 @/assets/FiraCode.ttf 未解析到产物里的文件` |
| FAIL | rename `dist/assets/FiraCode-CzoQJ4O7.ttf` → `.bak` | `exit=1`; `引用的 ./FiraCode-CzoQJ4O7.ttf 未解析…` **and** `dist 下没有任何 FiraCode*.ttf` |
| PASS | both reverted | `exit=0`; `全部断言通过（5 个产物样式表无 url(@/、3 个 Vite bundle 的 url() 目标均可解析、FiraCode 字体已产出）` |

Gates: `node scripts/verify/editorArtifactAssets.js` → 0 · `node scripts/verify/ci-workflow.js` → 0 ·
`pnpm exec prettier --check scripts/verify/editorArtifactAssets.js` → 0.

---

## Task C — G-02 editor-Vitest resolver guard

`packages/apps/editor/src/__tests__/editorCoreResolution.test.tsx` imports `CoreProbe` from `@motajs/editor-core/react`
through the editor's own Vitest pipeline and asserts **module identity** with the same symbol loaded from core's source
file (`../../../../../packages/libs/editor-core/lib/react/index.ts`). Identity — not a build hash — is the robust
assertion: a same-name hijack by an editor file fails the equality, and a lost package resolver fails the import.

**Test counts (verbatim):** `Test Files 1 passed (1)` · `Tests 2 passed (2)` · `exit=0`.

**Regression catch (scratch, reverted):** temporarily aliasing `@motajs/editor-core/react` → a missing path in
`packages/apps/editor/vitest.config.ts` made the suite fail (`Failed Suites 1`, `Error: Failed to resolve import
"@motajs/editor-core/react"`, `exit=1`). Config reverted (`git diff` clean) and the suite re-ran green.

---

## Plan-level sweep

| Command | Exit | Summary line |
|---------|------|--------------|
| `pnpm lint` | 0 | `108 problems (0 errors, 108 warnings)` — baseline held |
| `pnpm format:check` | 0 | `All matched files use Prettier code style!` |
| `pnpm typecheck` | 0 | all packages `Done` (editor-core + editor + service-worker + libs) |
| `pnpm test` | 0 (retry) | editor `97 files / 893 tests` (was 96/891 → +1 file/+2 tests); see flake note |
| `pnpm --filter @motajs/editor build` | 0 | `Editor artifact: 57 files, raw 16.80 MiB, gzip 4.29 MiB, brotli 3.58 MiB` |
| `node scripts/verify/coreExports.js` | 0 | `全部断言通过（7 subpaths、9 peers、8 singletons 单副本）` |
| `node scripts/verify/coreBoundaries.js` | 0 | `全部断言通过（真实树 0 违规、合成违规被拦、PKG-03 负极性 TS2307、editor→core 边方向正确）` |
| `node scripts/verify/corePandaClass.js` | 0 | `提取产物包含 .display_block { display: block（产物 17015 字节）` |
| `node scripts/verify/coreReactCompiler.js` | 0 | both markers `存在` |
| `node scripts/verify/editorArtifactAssets.js` | 0 | `全部断言通过（5 个产物样式表无 url(@/、3 个 Vite bundle 的 url() 目标均可解析、FiraCode 字体已产出）` |
| `node scripts/verify/ci-workflow.js` | 0 | `全部断言通过（4 个 job 与工具链固定值一致，无 secrets/environment/paths）` |
| `node scripts/verify/prettier-setup.js` | 0 | `全部断言通过` |
| `node scripts/verify/lint-severities.js` | 0 | `扫描到 45 条 eslint-disable 注释，全部携带理由` |

`git status --porcelain` ends clean apart from the untracked `02-VERIFICATION.md` (left untouched for the re-verifier).

**Pre-existing flake:** the first `pnpm test` run reddened on the known `@motajs/react-monaco-editor` teardown issue
(`Test Files 2 passed (2) / Tests 6 passed (6)` but a non-zero lifecycle exit from an unhandled teardown error). Retried
once; green. Not introduced by this unit and not "fixed" per instruction.

---

## Deviations

1. **[Rule 3 / scope decision] G-01 check (b) is scoped to the Vite-emitted CSS bundles, not the verbatim-copied theme
   CSS.** A strict recursive `url()` check surfaces a **pre-existing** dangling reference unrelated to this defect:
   `dist/assets/theme/editor_color_dark.css` (`fs.cp`-copied verbatim by `editor-artifact-plugin.ts`, fetched at runtime
   via `new URL('assets/theme/…', baseURI)`) references `../blockly/media/sprites_white.png`; blockly 12 no longer
   ships that sprite, so it resolves to a nonexistent `dist/assets/blockly/media/sprites_white.png`. Only Vite-processed
   bundles can exhibit the "alias/relative path no longer resolved" class this gate exists to catch, so check (b) reads
   the Vite bundles (direct children of `dist/assets/`) while checks (a) and (c) remain recursive. This is documented in
   the script header. The pre-existing theme reference is **not** fixed (executor scope boundary) and is recorded here
   instead of a separate `deferred-items.md` to honor the frozen-names constraint ("no other new file names").

2. **[Tooling] `pnpm test` required the sanctioned single retry** due to the pre-existing `react-monaco-editor` teardown
   flake (see above).

No auth gates occurred. No gate was weakened; no new/renamed CI job; `.planning` configs and `pnpm-workspace.yaml`
untouched; `typescript-eslint` stays `8.53.1`.

---

## Self-Check: PASSED

- `packages/apps/editor/src/css/editor.css` — relative url present; no `url(@/` in any emitted CSS. FOUND
- `scripts/verify/editorArtifactAssets.js` — present, exit 0, two-polarity proven. FOUND
- `.github/workflows/ci.yml` — one step added to `build` after `pnpm build`; `ci-workflow.js` exit 0. FOUND
- `packages/apps/editor/src/__tests__/editorCoreResolution.test.tsx` — present, `2 passed`, collected (not skipped). FOUND
- Commits `ee01e59`, `c99cb36`, `41eb5ad` present. FOUND
