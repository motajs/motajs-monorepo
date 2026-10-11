---
phase: "1"
slug: "shell"
status: verified
threats_open: 0
asvs_level: 1
created: "2026-10-11"
---

# Phase 1 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
>
> Sources: `<threat_model>` blocks in `01-01-PLAN.md` … `01-04-PLAN.md` (register authored at plan time). ASVS level 1, block-on `high`. All open-threat short-circuit conditions hold (`threats_open: 0`, plan-time register, ASVS L1), so L1 grep/test-depth evidence is sufficient.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| External registrant → ShellSystem | Panel-type metadata (`id` / `name` / `icon` / `create` factory) and menu items (`id` / `title` / `onClick`) | Untrusted display text + callbacks |
| Panel factory → shell | The factory may throw synchronously or the instance's `initialize()` may reject | Error objects / rejection |
| Tab interaction → tab state machine | User clicks `+` / tab / `×` | UI events → state transitions |
| Host → editor-core | The generic fs interface is implemented by the host; core only declares the type | Type contract (no runtime data) |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-01-01 | Tampering | `IEditorFileSystem` type surface mistaken for an implementation | medium | mitigate | `fs/types.ts` is declaration-only; `scripts/verify/coreFsSurface.js` real-tree scan = 0 non-declaration hits | closed |
| T-01-02 | Information Disclosure | core reaching the filesystem / network | high | mitigate | core implements/calls no fs; `coreModuleState.js` (globals/env ban), `coreBoundaries.js` (IO assertion), `coreImportType.js` all pass | closed |
| T-01-03 | Tampering | type-declaration comments tripping the low-level IO / engine-term gates | low | mitigate | Methods are signatures only (no leading dot); comments avoid `xxx.readFile(` and engine terms — gates pass | closed |
| T-01-SC | Tampering | npm/pnpm dependency install | low | accept | No external package installed this phase (deps remain `react` + `@tanstack/store`); documented in Accepted Risks | closed |
| T-02-01 | Tampering | `ShellSystem.registerPanelType` / `ShellSystem.registerMenuItem` | medium | mitigate | Atomic validation (id/name non-empty, `create` is a function) + unique id; invalid/duplicate rejected with `logger.error`, existing registration untouched — test `重复面板类型 id 被拒绝并记日志` | closed |
| T-02-02 | Tampering | `MenuRow` / `BlankTabList` / `TabRow` rendering external text | high | mitigate | Names/titles rendered as React text nodes; `dangerouslySetInnerHTML` absent (grep 0); test with `<b>`/`<img>` inputs generates no elements | closed |
| T-02-03 | Information Disclosure / Elevation | shell reaching files / network / storage | high | mitigate | core implements/calls no fs and does no IO; `coreModuleState` / `coreBoundaries` / `coreImportType` gates pass | closed |
| T-02-04 | Denial of Service | `ShellSystem.getSnapshot` returning a new reference causes infinite re-render | low | mitigate | Snapshot is a cached, reference-stable view state; tests render without `Maximum update depth exceeded` | closed |
| T-02-05 | Tampering | panel factory throw/reject crashing the shell | medium | mitigate | Factory throw / `initialize()` rejection is caught → tab shows 「面板打开失败」 error state and stays closable — tests `工厂抛错时拒绝打开且标签保持空白`, `实例初始化失败时显示错误态` | closed |
| T-02-SC | Tampering | npm/pnpm dependency install | low | accept | No external package installed; documented in Accepted Risks | closed |
| T-03-01 | Tampering | `MenuRow` / `BlankTabList` / `TabRow` text rendering (XSS) | high | mitigate | React default text escaping; no `dangerouslySetInnerHTML`; tests assert angle-bracket input creates no elements | closed |
| T-03-02 | Tampering | CSS tree-shaken away → unstyled shell (usability degradation) | low | mitigate | `package.json` `sideEffects: ["./src/**/*.css"]` + `import './shell.css';` from the render root; typecheck/test pass | closed |
| T-03-03 | Information Disclosure | styling/build pulling in an unexpected external resource or dependency | low | mitigate | Plain local kebab-case CSS, no external `@import`; no new dependency; variables inherit from the host | closed |
| T-03-SC | Tampering | npm/pnpm dependency install | low | accept | No external package installed; documented in Accepted Risks | closed |
| T-04-01 | Tampering | generic fs interface accidentally implemented/referenced in-repo | high | mitigate | `coreFsSurface.js` asserts `IEditorFileSystem` appears only in its declaration file; two-polarity fixture proves the assertion fires; non-vacuous lower bound | closed |
| T-04-02 | Elevation | core reaching IO without authorization | high | mitigate | Same source as T-04-01: no implementation ⇒ no IO; `coreBoundaries.js` IO assertion + `coreModuleState.js` global ban remain in force | closed |
| T-04-03 | Denial of Service | gate temp files lingering and polluting the repo | low | mitigate | All probes are deleted in `finally` with a follow-up `existsSync` (absent) assertion, matching existing gate style | closed |
| T-04-SC | Tampering | npm/pnpm dependency install | low | accept | No external package installed; the gate only reads the filesystem and invokes the repo's own `tsc`; documented in Accepted Risks | closed |

*Status: open · closed · open — below `high` threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above `workflow.security_block_on` (`high`) count toward `threats_open`*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

**threats_open: 0** — no open threat at or above the `high` threshold.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-01 | T-01-SC | No external package is installed in this phase (declaration-only change); no supply-chain surface added. | user | 2026-10-11 |
| R-02 | T-02-SC | No external package installed; shell uses only existing `react` + `@tanstack/store`. | user | 2026-10-11 |
| R-03 | T-03-SC | No external package installed; styling is a single local CSS file. | user | 2026-10-11 |
| R-04 | T-04-SC | No external package installed; the fs gate only reads the filesystem and runs the repo's own `tsc`. | user | 2026-10-11 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-11 | 18 | 18 | 0 | orchestrator (L1 grep/test-depth; short-circuit: `threats_open: 0`, plan-time register, ASVS L1 — auditor not spawned) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-11
