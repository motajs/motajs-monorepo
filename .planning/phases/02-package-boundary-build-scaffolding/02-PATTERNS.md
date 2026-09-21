# Phase 2: Package Boundary & Build Scaffolding - Pattern Map

**Mapped:** 2026-09-21
**Files analyzed:** 20 (13 created, 7 modified)
**Analogs found:** 17 / 20 (2 no-analog, 1 partial)

> **Tracked-source gate:** every analog path named below was verified with `git ls-files -- <path>` and is tracked source. Phase 2 is a greenfield scaffold — `packages/libs/editor-core/` does **not** exist yet (`Test-Path` = False, `git ls-files` empty).
>
> **Naming note (must reconcile before writing plans):** the user-confirmed names in `INTERFACE-NAME.md` N-06..N-11 are **camelCase** (`coreExports.js`, `corePandaClass.js`, `coreReactCompiler.js`, `coreBoundaries.js`, `.dependencyCruiser.cjs`, `subpathStatus.json`). `02-RESEARCH.md` and `02-VALIDATION.md` still spell these **kebab-case** (`core-exports.js`, `.dependency-cruiser.cjs`, `subpath-status.json`). The confirmed names win; the plans must use the camelCase spellings, and the two upstream docs should be treated as stale on this point.
>
> **Phase-2 invariant:** no production `@motajs/editor` code moves. Every file below is either brand-new scaffolding or a host/config edit.

## File Classification

### Created

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `packages/libs/editor-core/package.json` | config (manifest) | n/a (metadata) | `packages/libs/react-hooks/package.json` + `packages/libs/react-dark-mode/package.json` + `packages/libs/utils/package.json` | exact (composite) |
| `packages/libs/editor-core/tsconfig.json` | config | n/a | `packages/libs/react-hooks/tsconfig.json` | exact |
| `packages/libs/editor-core/vitest.config.ts` | config | n/a | `packages/apps/editor/vitest.config.ts` + `packages/apps/service-worker/vitest.config.ts` | role-match (composite) |
| `packages/libs/editor-core/lib/index.ts` | barrel | transform | `packages/libs/react-hooks/lib/index.ts` (+ `utils`) | role-match (Phase-2 body is `export {}` — new) |
| `packages/libs/editor-core/lib/{code,table,map,asset,shell}/index.ts` | barrel | transform | `packages/libs/react-hooks/lib/index.ts` | role-match |
| `packages/libs/editor-core/lib/react/index.ts` | barrel (re-export) | transform | `packages/libs/react-dark-mode/lib/index.ts` (see note) | role-match |
| `packages/libs/editor-core/lib/react/CoreProbe.tsx` | component | request-response (render) | `packages/libs/react-dark-mode/lib/DarkModeButton/index.tsx` | role-match |
| `packages/libs/editor-core/lib/__tests__/coreProbe.test.tsx` | test | transform | `packages/libs/react-store/lib/store.test.tsx` + `packages/libs/file2x/lib/index.test.ts` | exact |
| `scripts/verify/coreExports.js` | verifier (utility) | file-I/O + batch | `scripts/verify/ci-workflow.js` + `scripts/verify/prettier-setup.js` | exact |
| `scripts/verify/corePandaClass.js` | verifier (utility) | file-I/O + subprocess | `scripts/verify/prettier-setup.js` | exact |
| `scripts/verify/coreReactCompiler.js` | verifier (utility) | file-I/O + subprocess | `scripts/verify/prettier-setup.js` | exact |
| `scripts/verify/coreBoundaries.js` | verifier (utility) | file-I/O + subprocess + batch | `scripts/verify/ci-workflow.js` (two-polarity shape) + `prettier-setup.js` (subprocess) | role-match |
| `.dependencyCruiser.cjs` | config (gate) | n/a | **none in repo** (tool not installed) | no analog |
| `.planning/phases/02-package-boundary-build-scaffolding/subpathStatus.json` | data (manifest) | transform | `.planning/baseline/editor-manifest.json` (JSON artifact) | partial |
| `pnpm-workspace.yaml` (edit) | config | n/a | itself — catalog/allowBuilds/overrides blocks | exact |

### Modified

| Modified File | Role | Data Flow | Analog / Anchor | Change |
|---------------|------|-----------|-----------------|--------|
| `packages/apps/editor/vite.config.ts` | config | n/a | itself (`resolve.alias` block) + `packages/apps/service-worker/vite.config.ts:70` | D-05: `'@'` alias → `resolvePlugin` |
| `packages/apps/editor/vitest.config.ts` | config | n/a | itself (`resolve.alias` block) + `service-worker/vitest.config.ts` | D-05 mirrored (Pitfall 2) |
| `packages/apps/editor/package.json` | config | n/a | itself (`dependencies`) | add `@motajs/editor-core: workspace:*` |
| `packages/apps/editor/panda.config.ts` | config | n/a | itself (`include:`) | D-09: widen include |
| `.github/workflows/ci.yml` | config (CI) | n/a | itself (4 job bodies) + `scripts/verify/ci-workflow.js` constraints | add steps only, no new jobs (D-13) |
| `packages/apps/editor/tsconfig.app.json` | config | n/a | itself (`paths`) | **conditional** — only if needed |
| `package.json` (root) | config | n/a | itself (`devDependencies` / `scripts`) | devDependency `dependency-cruiser` + optional script |

---

## Pattern Assignments

### `packages/libs/editor-core/package.json` (config / manifest)

**Analogs:** `packages/libs/react-hooks/package.json`, `packages/libs/react-dark-mode/package.json`, `packages/libs/utils/package.json`

**Manifest skeleton** — `packages/libs/react-hooks/package.json:1-12`:
```json
{
  "name": "@motajs/react-hooks",
  "version": "1.0.0",
  "description": "",
  "type": "module",
  "exports": {
    ".": "./lib/index.ts"
  },
  "scripts": {
    "typecheck": "tsc -b",
    "test": "vitest run"
  },
```

**Multi-subpath `exports` precedent** — `packages/libs/react-dark-mode/package.json:7-11` (explicit subpaths) and `packages/libs/utils/package.json:6-9` (wildcard subpath):
```json
"exports": {
  ".": "./lib/index.ts",
  "./DarkModeButton": "./lib/DarkModeButton/index.tsx",
  "./DarkModeEffect/*": "./lib/DarkModeEffect/*.tsx"
}
```
```json
"exports": {
  ".": "./lib/index.ts",
  "./advance/*": "./lib/advance/*/index.ts"
}
```
→ core's 7 subpaths follow this exact shape, verbatim per RESEARCH §Code Examples:
```jsonc
"exports": {
  ".": "./lib/index.ts",
  "./code": "./lib/code/index.ts",
  "./table": "./lib/table/index.ts",
  "./map": "./lib/map/index.ts",
  "./asset": "./lib/asset/index.ts",
  "./shell": "./lib/shell/index.ts",
  "./react": "./lib/react/index.ts"
}
```

**peer + devDependency triple** — `packages/libs/react-hooks/package.json:20-33` (a peer must also be a devDependency so the package resolves for its own tests):
```json
"peerDependencies": {
  "react": "catalog:default"
},
"devDependencies": {
  "@motajs/config": "workspace:*",
  "@testing-library/react": "16.3.2",
  "@types/lodash-es": "catalog:default",
  "@types/react": "catalog:default",
  "@types/react-dom": "catalog:default",
  "jsdom": "26.1.0",
  "react": "catalog:default",
  "react-dom": "catalog:default",
  "vitest": "catalog:default"
}
```

**Optional-peer encoding** — `packages/libs/react-dark-mode/package.json:23-31` (the repo's existing "peer but not always consumable" idiom; core uses `peerDependenciesMeta` instead per D-18):
```json
"peerDependencies": {
  "react": "catalog:default",
  "react-dom": "catalog:default"
},
"optionalDependencies": {
  "@douyinfe/semi-icons": "catalog:default",
  "@douyinfe/semi-ui": "catalog:default",
  "monaco-editor": "catalog:default"
}
```

**Required fields not present in any analog** (new to core, from D-01/D-02/D-18):
- `"private": true`, `"version": "0.0.0"`, `"sideEffects": false`
- `"peerDependencies"` listing **7 singletons** (`react`, `react-dom`, `antd`, `@douyinfe/semi-ui`, `alien-signals`, `immer`, `monaco-editor`, `pixi.js`, `blockly` — the count is 9 entries / "PKG-02's seven singleton libs + React/ReactDOM")
- `"peerDependenciesMeta": { "@douyinfe/semi-ui": { "optional": true } }` (D-18)
- scripts exactly `"typecheck": "tsc -b"` + `"test": "vitest run"` — **no `build`** (D-08)
- all peer/dev versions `catalog:default`; **`antd`/`alien-signals`/`immer`/`pixi.js`/`blockly` are NOT currently in the catalog** → D-19 adds them (see `pnpm-workspace.yaml` below)

---

### `packages/libs/editor-core/tsconfig.json` (config)

**Analog:** `packages/libs/react-hooks/tsconfig.json` — the entire 4-line file:
```json
{
  "extends": "@motajs/config/tsconfig.lib.base.json",
  "include": ["${configDir}/lib"]
}
```

**Base it inherits** — `packages/libs/config/tsconfig.lib.base.json:11-21`:
```json
"moduleResolution": "bundler",
"allowImportingTsExtensions": true,
"isolatedModules": true,
"moduleDetection": "force",
"noEmit": true,
"jsx": "react-jsx",
"strict": true,
"paths": {
  "@/*": ["${configDir}/lib/*"]
},
```
Key consequence: `${configDir}/lib/*` is already the correct `@/` mapping for any lib — core needs no change to the base. But because a child `paths` **replaces** the base's (RESEARCH Pattern 2), core must re-declare `@/*` if it adds `@styled-system/*`. RESEARCH §Pattern 2 gives the exact shape to use:
```jsonc
{
  "extends": "@motajs/config/tsconfig.lib.base.json",
  "compilerOptions": {
    "paths": {
      "@/*": ["${configDir}/lib/*"],
      "@styled-system/*": ["../../apps/editor/styled-system/*"]
    }
  },
  "include": ["${configDir}/lib"]
}
```
> Per D-06 (amended), core's intra-package imports are **relative**, so `@/*` inside core is only needed if the smoke test or probe uses it. The `@styled-system/*` entry is **required** (D-09) — the smoke test resolves `@styled-system` and the probe imports it.

---

### `packages/libs/editor-core/vitest.config.ts` (config)

**Analogs:** `packages/apps/editor/vitest.config.ts` (react + compiler + jsdom + setupFiles) and `packages/apps/service-worker/vitest.config.ts` (explicit `include`, explicit env, `restoreMocks`).

**Editor config** — full file, `packages/apps/editor/vitest.config.ts:1-26`:
```ts
import react from '@vitejs/plugin-react';
import path from 'path';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@test': path.resolve(import.meta.dirname, 'test'),
      '@styled-system': path.resolve(import.meta.dirname, 'styled-system'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    exclude: [...configDefaults.exclude, 'e2e/**'],
    setupFiles: ['./test/setup.ts'],
  },
});
```
`test/setup.ts` exists at `packages/apps/editor/test/setup.ts` (editor-only — core must not import it).

**Service-worker config** — full file, `packages/apps/service-worker/vitest.config.ts:1-13` (the explicit-include / node-env / restoreMocks idiom):
```ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    restoreMocks: true,
  },
});
```

**`resolvePlugin` registration in a Vite config** — `packages/apps/service-worker/vite.config.ts:70` (last entry of the plugins array):
```ts
      resolvePlugin,
    ],
  ],
```
→ core's vitest config composes: `resolvePlugin` (imported from `@motajs/config/resolvePlugin`) + `react({ babel: { plugins: [['babel-plugin-react-compiler']] } })` + `alias: { '@styled-system': <editor styled-system abs path> }` + `test: { environment: 'jsdom', include: ['lib/**/*.test.tsx'] }` (D-12). Add `@motajs/config` to devDependencies (it is already in every lib's devDeps).

---

### `packages/libs/editor-core/lib/index.ts` + 5 capability barrels (barrel)

**Analog:** `packages/libs/react-hooks/lib/index.ts:1-13` (barrel convention — named re-exports only, no default):
```ts
export * from './browser/event';
export * from './browser/media';
export * from './browser/serviceWorker';
export * from './browser/storage';

export * from './core/async';
export * from './core/common';
export * from './core/lifeCycle';
export * from './core/serialize';
export * from './core/state';

export * from './utils/common';
export * from './utils/type';
```
**Phase-2 body is `export {}`** (D-01) for `lib/index.ts` and each of `lib/{code,table,map,asset,shell}/index.ts` — this exact placeholder does not exist anywhere in the repo yet (grep for `export {}` → 0 hits), so it is a new-but-trivial pattern. Rationale: `exports` targets must exist on disk, and each subpath needs a real file node for dependency-cruiser.
> Anti-pattern guard (RESEARCH §Anti-Patterns / PITFALLS §16): the root `lib/index.ts` must **not** re-export the subpaths — keep it `export {}`.

---

### `packages/libs/editor-core/lib/react/index.ts` (barrel / re-export)

**Analog (structure):** `packages/libs/react-dark-mode/package.json:9-10` shows subpath→source mapping; the barrel convention is as above. For Phase 2 this file re-exports the probe (N-12):
```ts
export { CoreProbe } from './CoreProbe';
```
This is the only non-empty barrel, and it exists so PKG-05 has a real entry path into the probe (D-12/N-12).

---

### `packages/libs/editor-core/lib/react/CoreProbe.tsx` (component)

**Analog:** `packages/libs/react-dark-mode/lib/DarkModeButton/index.tsx:1-38` — the repo's canonical linked-lib component shape: `FC<Props>`, a hook call, JSX, default export:
```tsx
import { FC } from 'react';
import { Button, Dropdown } from '@douyinfe/semi-ui';
import { ButtonProps } from '@douyinfe/semi-ui/lib/es/button';
import { DarkModeStore } from '../store';

export interface IDarkModeButtonProps extends ButtonProps {
  dropdown?: DropdownProps;
}

const DarkModeButton: FC<IDarkModeButtonProps> = (props) => {
  const { dropdown, ...buttonProps } = props;
  const { isDarkMode, setIsDarkMode } = DarkModeStore.useStore();

  return (
    <Dropdown ...>
      <Button ... />
    </Dropdown>
  );
};

export default DarkModeButton;
```

**Required deviations for Phase 2 (all measured):**
1. **MUST call a hook** (D-21 / RESEARCH Pattern 4): a module with no component/hook emits **no** compiler marker. Use React's built-in `useState` — do **not** pull `@motajs/react-store` (that would add a non-peer workspace dep).
2. **PandaCSS call must be template-literal** — `packages/apps/editor/styled-system/css/css.d.ts:1-2` declares exactly one overload:
   ```ts
   /* eslint-disable */
   export declare function css(template: { raw: readonly string[] | ArrayLike<string> }): string
   ```
   So `` className={css`display: block;`} `` is the only type-correct form; `css({ display: 'block' })` is a **type error** (`TS2345`, Pitfall 4).
3. **Class assertion target is `.display_block`**, not `.d_block` (D-10 as corrected by RESEARCH §Pattern 3): `syntax: 'template-literal'` ⇒ `hasShorthand: false`, `prefix: undefined`; `hash: false` keeps it stable.
4. **Named export** (`export const CoreProbe` / `export function CoreProbe`) rather than the analog's default export — repo convention is "named exports only" and `lib/react/index.ts` re-exports by name.
5. Import `@styled-system/css` (D-09) — core resolves it to the editor's generated tree.
6. **No `@/` self-imports** (D-06 amended) — use relative imports inside core.

Sketch the planner should reproduce (not verbatim from any file — composite):
```tsx
import { useState } from 'react';
import { css } from '@styled-system/css';

export interface ICoreProbeProps {
  label?: string;
}

/** Phase 2 scaffolding probe — replaced/deleted in Phase 4+. */
export function CoreProbe({ label = 'editor-core probe' }: ICoreProbeProps): JSX.Element {
  const [count] = useState(0);
  return <div className={css`display: block;`}>{`${label}:${count}`}</div>;
}
```

---

### `packages/libs/editor-core/lib/__tests__/coreProbe.test.tsx` (test)

**Analogs:** `packages/libs/react-store/lib/store.test.tsx:1-38` (jsdom directive + testing-library) and `packages/libs/file2x/lib/index.test.ts:1-9` (plain import + `vitest` named imports).

**jsdom-per-file directive** — `packages/libs/react-store/lib/store.test.tsx:1-9`:
```tsx
// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import type { FC, ReactNode } from 'react';
import { describe, expect, test } from 'vitest';
import { mergeStores } from './merge';
import { createStore } from './store';
```

**Pure import assertion** — `packages/libs/file2x/lib/index.test.ts:1-9`:
```ts
import { describe, expect, test } from 'vitest';
import { ... } from './index';

describe('file2x data codecs', () => {
  test('reads comments and JSON5 without executing the wrapper', () => {
```

**Core smoke test contract** (D-12/D-21 + VALIDATION PKG-03): must assert
1. importing `CoreProbe` from the probe module (and/or from `../react`) succeeds;
2. a **relative** intra-package import resolves (D-06 amended);
3. `@styled-system` resolves.

> Note: `@testing-library/react` is **not** required — a `renderToString` from `react-dom/server` or a plain symbol assertion avoids the extra dependency (RESEARCH §Supporting). If `renderHook` is used, add `@testing-library/react` to devDependencies like `react-hooks/package.json:25`.
> Do **not** add `// @vitest-environment jsdom` unless the test actually renders (config already sets `environment: 'jsdom'`).

---

### `scripts/verify/coreExports.js` (verifier utility)

**Analogs:** `scripts/verify/ci-workflow.js`, `scripts/verify/prettier-setup.js`, `scripts/verify/lint-severities.js` — all three share one skeleton. Reproduce it exactly.

**Common skeleton** — `scripts/verify/ci-workflow.js:1-27,70-78,286-293`:
```js
#!/usr/bin/env node
/**
 * PR CI 工作流结构自检脚本（VERIFY-02）。
 *
 * 用法：node scripts/verify/ci-workflow.js
 *
 * 断言的是「仓库设置必须引用的契约」与安全约束……
 * 不访问网络、不导入任何 workspace 包；只按文本读取工作流文件。
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

// ==================== 常量 ====================

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');

// ==================== 断言工具 ====================

const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}
```
```js
function main() {
  ...
  if (failures.length > 0) {
    for (const failure of failures) console.error(`ci-workflow: ${failure}`);
    process.exit(1);
  }
  console.log('ci-workflow: 全部断言通过（…）');
}

main();
```
Success-message variants: `prettier-setup.js:273` → `console.log('prettier-setup: 全部断言通过');`, `lint-severities.js:175` → same. Per-failure line: `console.error('<scriptName>: [${index+1}] ${failure}')` in `ci-workflow.js:287`, or `<scriptName>: ${failure}` in the other two.

**Subprocess + JSON.parse idiom** (reuse for `depcruise`/Node-resolution calls) — `prettier-setup.js:179-194`:
```js
function resolveEslintConfig(relativeFile) {
  const result = spawnSync(process.execPath, [ESLINT_BIN_PATH, '--print-config', relativeFile], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim().replace(/\s+/g, ' ');
    return { error: detail.slice(-400) || `eslint --print-config 退出码 ${result.status}` };
  }
  try {
    return { config: JSON.parse(result.stdout) };
  } catch (error) {
    return { error: `无法解析 --print-config 的 JSON 输出：…` };
  }
}
```
Imports: `prettier-setup.js:18-23` — `import { spawnSync } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path'; import process from 'node:process';`

**`coreExports.js` assertions** (PKG-01 + PKG-02 + D-15):
1. all 7 `exports` targets exist on disk, and each is listed in `subpathStatus.json`;
2. `private === true`, `type === 'module'`, `sideEffects === false`;
3. each of the 7+2 peer entries carries a `catalog:default` declaration (parse `pnpm-workspace.yaml` catalog or assert the manifest string);
4. **realpath dedupe** — RESEARCH §Code Examples measured recipe (`createRequire(<pkgdir>/package.json).resolve(name)` + `fs.realpathSync`), one distinct realpath per singleton across `packages/apps/editor` + `packages/libs/editor-core`. **Semi is excluded** and asserted separately against `packages/apps/service-worker` (D-18/Pitfall 12).

---

### `scripts/verify/corePandaClass.js` (verifier utility)

**Analog:** `scripts/verify/prettier-setup.js` (same skeleton; the subprocess+read-output idiom above).

**Core operation** (D-10, RESEARCH §Code Examples):
```bash
# run from packages/apps/editor (cwd matters: include globs and default outfile are cwd-relative)
pnpm --filter @motajs/editor exec panda cssgen -o node_modules/.tmp/core-panda.css
```
```js
// assert against the extraction output — NOT the config, NOT a hash class
const css = fs.readFileSync(outfile, 'utf8');
if (!/\.display_block\s*\{\s*display:\s*block/.test(css)) fail('core class .display_block missing');
```
Acceptance: exit 0 when `.display_block { display: block }` is present; exit 1 otherwise. Use `spawnSync` with `cwd: path.join(REPO_ROOT, 'packages/apps/editor')` or `pnpm --filter`. The outfile path is disposable and must be cleaned/ignored.

---

### `scripts/verify/coreReactCompiler.js` (verifier utility)

**Analog:** `scripts/verify/prettier-setup.js` (same skeleton).

**Core operation** (D-11, RESEARCH §Code Examples / Pattern 4):
```js
// A live Vite transform of the probe with the editor's exact plugin config; marker = react/compiler-runtime
const result = await server.transformRequest('/packages/libs/editor-core/lib/react/CoreProbe.tsx');
if (!/react\/compiler-runtime/.test(result.code)) fail('React Compiler did not transform core TSX');
if (!/_c\(/.test(result.code)) fail('no memo-cache call in the compiler output');
```
Plugin defaults confirmed at `node_modules/.pnpm/@vitejs+plugin-react@5.1.2*/…/dist/index.js:87-94` (`defaultIncludeRE = /\.[tj]sx?$/`, `defaultExcludeRE = /\/node_modules\//`) — no editor config change required (D-11 default branch). This script runs the real tool; it must **not** re-implement the filter (RESEARCH §Don't Hand-Roll).

---

### `scripts/verify/coreBoundaries.js` (verifier utility — two-polarity gate)

**Analogs:** `scripts/verify/ci-workflow.js` (structure + two-polarity proof shape) and `scripts/verify/prettier-setup.js` (subprocess invocation).

**Two-polarity proof** (D-14/D-17/D-20): the script must
1. cruise the **real** tree with `.dependencyCruiser.cjs` → must exit 0;
2. plant a **synthetic violating fixture** (a temp file importing a forbidden target; created and removed by the script, never committed — INTERFACE-NAME.md "deliberately not named") → cruise → must exit **non-zero**, then clean up;
3. assert `couldNotResolve` is not masking the DAG rules (Pitfall 6).

**CLI shape** (RESEARCH §Code Examples):
```
pnpm exec depcruise --config .dependencyCruiser.cjs packages/libs/editor-core/lib
```
plus a second invocation/rule asserting the editor→core edge direction (D-14).

**Two-polarity precedent** — the repo's named-error-throw style from Phase 1 (`test.skip(!withEditor, …)` replaced by a required fixture that throws a named error, per RESEARCH §State of the Art).

---

### `.dependencyCruiser.cjs` (config — NO codebase analog)

**No analog exists** — dependency-cruiser is not installed and there is no `.cjs` rule-set in the repo. Use the RESEARCH §Code Examples rule set verbatim (forbidden edges, D-06 DAG with `$1` group matching, `no-circular`, D-16 singleton rule). Relevant repo conventions:
- `.cjs` extension is used for config in-repo (`packages/apps/editor/postcss.config.cjs:1` — `module.exports = { plugins: { … } };`) → `.dependencyCruiser.cjs` uses `module.exports`.
- The D-16 singleton rule **must** be `forbidden` (not `required` + `module.numberOfDependentsLessThan`, which only works in `forbidden` context — Pitfall 7).
- `options.tsConfig` is only needed if core keeps `@/`; D-06 (amended) uses relative imports, so the DAG rules are path-based and do not depend on tsconfig-aware resolution (mitigates Assumption A3).
- **Renamed** from the tool's conventional `.dependency-cruiser.cjs` per the no-hyphen rule (N-10); the wrapper passes it explicitly via `--config`.

---

### `.planning/phases/02-package-boundary-build-scaffolding/subpathStatus.json` (data manifest)

**Partial analog:** `.planning/baseline/editor-manifest.json` (a tracked JSON artifact produced by `packages/apps/editor/editor-artifact-plugin.ts` with a `schemaVersion`). RESEARCH Q3 is the authoritative recommendation: a small JSON listing, per subpath, whether it is an empty barrel or carries the probe — machine-checkable by `coreExports.js`.
> The schema keys are explicitly **agent discretion** (INTERFACE-NAME.md "deliberately not named"). Keep it minimal: one entry per subpath + a note identifying which carries the probe.

---

### `pnpm-workspace.yaml` (modified config)

**Analog:** itself. Relevant blocks:
- `allowBuilds:` — lines 6-11 (do **not** add dependency-cruiser; it has `postinstall: null`)
- `overrides:` — lines 13-14 (`vite: 7.3.1`)
- `catalog:` — lines 16-74 (alphabetical, `catalog:default` consumers)
- `minimumReleaseAgeExclude:` — lines 76-77 (only `monaco-editor@0.56.0`)

**Required edits (D-19 + Standard Stack):**
1. Add catalog entries for the currently-uncatalogued singletons, pinned to the exact versions the editor already uses (`packages/apps/editor/package.json:30,31,33,36,43`):
   `antd: 6.2.1`, `alien-signals: 3.1.2`, `immer: 11.1.3`, `pixi.js: 8.19.0`, `blockly: 12.3.1`.
   (`@douyinfe/semi-ui: ^2.90.0` and `monaco-editor: 0.56.0` are **already** in the catalog at lines 19 and 50.)
2. Add `dependency-cruiser: 18.2.0` to the catalog (pin — latest 18.4.0 is too new for the release-age guard; Pitfall 8 / Assumption A1).
3. No `allowBuilds` entry for dependency-cruiser.
4. If 18.2.0 is somehow rejected, add it to `minimumReleaseAgeExclude` exactly like `monaco-editor@0.56.0` (lines 76-77).

`catalog:default` cannot be used for a package the catalog does not define (RESEARCH §Code Examples).

---

## Modified Files — Pattern Assignments

### `packages/apps/editor/vite.config.ts` (D-05)

**Current state** — `packages/apps/editor/vite.config.ts:18-36`:
```ts
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
    nodePolyfills({
      include: ['events'],
    }),
    motaServerPlugin({ motaRoot: MOTA_JS_ROOT }),
    editorArtifactPlugin(packageInfo.version),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@test': path.resolve(__dirname, './test'),
      '@styled-system': path.resolve(__dirname, './styled-system'),
    },
  },
```
**Change:** remove the `'@'` line, add `resolvePlugin` to `plugins`, keep `@test` and `@styled-system`. Exact target shape (RESEARCH §Code Examples):
```ts
import { resolvePlugin } from '@motajs/config/resolvePlugin';
// ...
    resolvePlugin, // ← importer-relative `@/`
  ],
  resolve: {
    alias: {
      // '@' intentionally removed — vite:alias would hijack core's `@/`
      '@test': path.resolve(__dirname, './test'),
      '@styled-system': path.resolve(__dirname, './styled-system'),
    },
  },
```
Justification: Vite 7.3.1 evaluates `resolve.alias` **before** `enforce:'pre'` plugins and `vite:resolve` (RESEARCH §Pattern 1, verified in `vite/dist/node/chunks/config.js`), so the hard `'@'` alias would hijack core's `@/x`. `resolvePlugin.d.ts` types the import; `tsconfig.node.json:14` includes `vite.config.ts`, so it typechecks.

### `packages/apps/editor/vitest.config.ts` (D-05 mirrored — Pitfall 2)

**Current state** — `packages/apps/editor/vitest.config.ts:13-19`:
```ts
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@test': path.resolve(import.meta.dirname, 'test'),
      '@styled-system': path.resolve(import.meta.dirname, 'styled-system'),
    },
  },
```
**Change:** identical treatment — drop `'@'`, add `resolvePlugin` to `plugins`. Must stay consistent with `vite.config.ts` or dev and CI disagree (Pitfall 2). Verify with **both** `pnpm build` and `pnpm test`.

### `packages/apps/editor/package.json` (D-07)

**Anchor** — workspace deps block, `packages/apps/editor/package.json:20-23`:
```json
    "@motajs/file2x": "workspace:*",
    "@motajs/react-hooks": "workspace:*",
    "@motajs/react-monaco-editor": "workspace:*",
    "@motajs/react-store": "workspace:*",
```
**Change:** add `"@motajs/editor-core": "workspace:*"` (alphabetical — before `@motajs/file2x`). This is what makes editor's `tsc -b` descend into core and gives PKG-03 its positive polarity.

### `packages/apps/editor/panda.config.ts` (D-09)

**Current state** — `packages/apps/editor/panda.config.ts:7-23`:
```ts
  syntax: 'template-literal',

  jsxFramework: 'react',

  // Where to look for your css declarations
  include: ['./src/**/*.{js,jsx,ts,tsx}'],

  // Files to exclude
  exclude: [],

  ...
  outdir: 'styled-system',
```
**Change:** `include: ['./src/**/*.{js,jsx,ts,tsx}', '../../libs/editor-core/lib/**/*.{ts,tsx}']`. Include entries are resolved relative to the panda process cwd (the editor dir when run via `pnpm --filter @motajs/editor exec …`). Do **not** touch `exclude`/`syntax`/`hash`/`outdir`. Core must **not** gain its own `panda.config.ts` (D-09).

### `.github/workflows/ci.yml` (D-13)

**Current shape:** 4 jobs — `lint` (`:13-31`), `typecheck` (`:33-51`), `unit` (`:53-73`), `build` (`:75-98`); each runs `pnpm install --frozen-lockfile` then one root script; `build` already carries `- name: Generate PandaCSS styled-system / run: pnpm --filter @motajs/editor exec panda codegen` (`:95-96`) **before** `pnpm build` (`:98`).

**Change — add steps only, never a job:**
- `lint` job → add `- run: node scripts/verify/coreBoundaries.js` (dependency-cruiser gate) and the CI-wired verifiers.
- `build` job → add `- run: node scripts/verify/corePandaClass.js` and `- run: node scripts/verify/coreReactCompiler.js`.
- `typecheck`/`build` → the singleton single-copy assertion (`node scripts/verify/coreExports.js`).

**Hard constraints enforced by `scripts/verify/ci-workflow.js`:**
- `JOB_IDS = ['lint','typecheck','unit','build']` (`:31`) — **exactly 4**, no renames, no extras (`:199-210`).
- `JOB_SCRIPTS` (`:34-39`): `lint→pnpm lint`, `typecheck→pnpm typecheck`, `unit→pnpm test`, `build→pnpm build` — these commands must remain present (extra `- run:` steps are safe; the verifier only asserts presence, `:220-223`).
- `SUBMODULE_JOBS = ['unit','build']` (`:53`) — do **not** add `submodules: recursive` to `lint`/`typecheck` (`:225-232`).
- `TOOLCHAIN_PINS` (`:42-50`) must remain in every job (checkout@v4, pnpm/action-setup@v4, `12.5.1`, setup-node@v4, `node-version: 24`, `cache: pnpm`, `--frozen-lockfile`).
- `build`'s panda codegen must stay **before** `pnpm build` (`:242-250`).
- No `secrets`, no `environment:`, no `paths:` filters, triggers only `pull_request` + `push: [main]`, concurrency `cancel-in-progress: true` (`:155-176,181-185,256-269`).

Re-run `node scripts/verify/ci-workflow.js` after every `ci.yml` edit.

### `packages/apps/editor/tsconfig.app.json` (CONDITIONAL — likely no change needed)

**Current `paths`** — `packages/apps/editor/tsconfig.app.json:8-13`:
```json
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@test/*": ["./test/*"],
      "@styled-system/*": ["./styled-system/*"]
    },
```
D-06 (amended) has core use **relative** intra-package imports, so editor's program no longer needs a second `@/*` candidate — this file likely needs **no edit**. If the user ever revives `@/` inside core, option B (add `"../../libs/editor-core/lib/*"` as a second candidate + a guard invariant) becomes necessary; RESEARCH measured that this only works while no name collides and is therefore **not recommended** (Q1). The `@styled-system/*` entry already agrees with core's mapping — this is the one place the two programs already align.

### root `package.json` (devDependency + optional script)

**Anchors** — `package.json:10-18` (scripts) and `:22-43` (devDependencies):
```json
  "scripts": {
    "lint": "eslint .",
    "lint:fix": "eslint --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "pnpm -r run test",
    "typecheck": "pnpm -r run typecheck",
    "build": "pnpm -r run build"
  },
```
**Change:** add `"dependency-cruiser": "catalog:default"` to `devDependencies` (alphabetical, after `@vitejs/plugin-react` — actually alphabetically before `eslint`). Optionally expose a script; the catalog entry itself is added in `pnpm-workspace.yaml`. Installation command per RESEARCH: `pnpm add -Dw dependency-cruiser@catalog:` — requires a `checkpoint:human-verify` before the install step (package-legitimacy `[SUS] too-new`).

---

## Shared Patterns

### Importer-relative `@/` resolution — `resolvePlugin`
**Source:** `packages/libs/config/resolvePlugin.js:1-35` (full body below)
**Apply to:** editor `vite.config.ts`, editor `vitest.config.ts`, core `vitest.config.ts`
```js
import path from 'path';

const WORKSPACE_ROOT = path.resolve(import.meta.dirname, '../../../');

const getAliasByPackageType = (type) => {
  switch (type) {
    case 'libs':
      return 'lib';
    case 'apps':
    case 'external':
      return 'src';
    default:
      throw new Error(`unexcepted package type ${type}`);
  }
};

export const resolvePlugin = {
  name: 'resolve',
  resolveId(source, importer, options) {
    if (!source.startsWith('@/') || !importer) return null;
    const [packages, type, name] = path.relative(WORKSPACE_ROOT, importer).split(path.sep);
    const alias = getAliasByPackageType(type);
    const rest = source.substring(2);
    const result = path.join(WORKSPACE_ROOT, packages, type, name, alias, rest);
    return this.resolve(result, importer, options);
  },
};
```
There is **no hard-coded package list** — a brand-new `packages/libs/editor-core/**` importer yields `type === 'libs'` → `lib`. The only structural constraint: the importer must live at `packages/{libs|apps|external}/<name>/…` (segment 2 must be one of the three or it throws).
Type declaration: `packages/libs/config/resolvePlugin.d.ts:1-3` — `export const resolvePlugin: Plugin;`.

### `@styled-system/*` across the package boundary
**Source (core side):** `packages/libs/editor-core/tsconfig.json` `paths` → `../../apps/editor/styled-system/*`
**Source (editor side, already correct):** `packages/apps/editor/tsconfig.app.json:12` → `"@styled-system/*": ["./styled-system/*"]`
**Apply to:** core's `tsconfig.json` + core's `vitest.config.ts` alias.
**Caveat (measured):** `packages/apps/editor/styled-system` is **gitignored** (`packages/apps/editor/.gitignore:29:styled-system`; `git ls-files` → 0 files), not committed. It is regenerated by `packages/apps/editor/package.json:7` `"prepare": "panda codegen"`, which pnpm 12.5.1 runs on every `pnpm install` (including CI's four jobs). Do **not** "fix" a missing `styled-system` by adding a second panda config (Pitfall 3).

### Verifier-script convention
**Source:** `scripts/verify/ci-workflow.js`, `prettier-setup.js`, `lint-severities.js`
**Apply to:** all four new `scripts/verify/core*.js` — plain ESM, dependency-free where possible, Chinese file header ("用法：node scripts/verify/<name>.js"), `REPO_ROOT` derived from `import.meta.dirname`, `const failures = []` + `check(condition, message)`, one `console.error('<name>: …')` per failure, `process.exit(1)` on any failure, `console.log('<name>: 全部断言通过…')` on success. Every new script name must already appear in `INTERFACE-NAME.md` (N-06..N-09) before it is written.

### Catalog-pinned dependencies
**Source:** `pnpm-workspace.yaml:16-74`
**Apply to:** every version in core's `package.json` (`catalog:default`) and the new root devDependency. New tools also go into the catalog; no unnecessary runtime dependency is introduced by the split.

### tsconfig base chain
**Source:** `packages/libs/config/tsconfig.lib.base.json:11-21`, `tsconfig.app.base.json:10-21`
**Apply to:** core `tsconfig.json` extends `tsconfig.lib.base.json`. Remember: a child `paths` replaces the base's, so re-declare `@/*` if you add `@styled-system/*`. `noEmit: true` in the base is why project references are impossible (`TS6310`, Pitfall 1).

### `workspace:*` dependency declaration
**Source:** `packages/apps/editor/package.json:20-23`, `packages/libs/react-hooks/package.json:17`
**Apply to:** editor → core dependency and core's `@motajs/config` devDependency.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `.dependencyCruiser.cjs` | config (gate) | n/a | dependency-cruiser is not installed and the repo has no rule-set config of this kind. **Use RESEARCH §Code Examples** (forbidden edges + `$1` group matching + `no-circular` + the D-16 singleton `forbidden` rule). Existing `.cjs` convention: `packages/apps/editor/postcss.config.cjs:1`. |
| `.planning/phases/02-package-boundary-build-scaffolding/subpathStatus.json` | data | transform | No per-subpath status manifest exists. Partial analog: `.planning/baseline/editor-manifest.json` (tracked JSON artifact, `schemaVersion` concept from `editor-artifact-plugin.ts`). **Use RESEARCH Q3**; schema keys are agent discretion. |

Everything else has at least a role-match analog.

---

## Metadata

**Analog search scope:** `packages/libs/*` (react-hooks, react-dark-mode, react-store, react-monaco-editor, utils, config), `packages/apps/editor` + `packages/apps/service-worker` (vite/vitest/panda/tsconfig/package.json), `scripts/verify/*`, `.github/workflows/ci.yml`, `pnpm-workspace.yaml`, root `package.json`, `.planning/baseline/*`.
**Files scanned:** ~30 (all analogs git-tracked; verified via `git ls-files`).
**Pattern extraction date:** 2026-09-21
**Tooling constraint:** Plane 2 creates no runtime code; the only new install is root devDependency `dependency-cruiser@18.2.0` (needs a `checkpoint:human-verify` before `pnpm add`).
**Doc-staleness flags for the planner:**
1. `02-RESEARCH.md` and `02-VALIDATION.md` spell the four verifier scripts and the depcruise config in **kebab-case**; the confirmed `INTERFACE-NAME.md` names (N-06..N-10) are **camelCase**. Use the confirmed names.
2. `02-VALIDATION.md:36` says the pre-verify gate includes `node scripts/verify/core-exports.js` etc. — same kebab-case mismatch.
3. `02-CONTEXT.md` D-09's parenthetical "(已提交入库)" about `styled-system` is factually wrong (it is gitignored); RESEARCH §Pattern 2 corrects it.
4. `02-CONTEXT.md` D-10's example class `.d_block` is wrong; the measured target is `.display_block`.
