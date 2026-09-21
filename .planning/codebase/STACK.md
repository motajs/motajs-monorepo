# Technology Stack

**Analysis Date:** 2026-09-20

## Languages

**Primary:**
- TypeScript 5.9.3 - all workspace packages (`packages/apps/editor/package.json`, `packages/apps/service-worker/package.json`, all `packages/libs/*/package.json`)
- TSX / React JSX - React 19 UI in `packages/apps/editor/src/**` and `packages/apps/service-worker/src/view/**`

**Secondary:**
- JavaScript (ESM, `.js` / `.mjs` / `.cjs`) - build tooling and Vite plugins (`packages/apps/editor/vite-plugin-mota-server.ts` is TS, but `packages/libs/config/resolvePlugin.js`, `packages/apps/service-worker/scripts/stage-editor.mjs`, `packages/apps/service-worker/scripts/verify-deployment.mjs`, `packages/apps/editor/postcss.config.cjs`)
- Less - service-worker styling (`packages/apps/service-worker/src/view/*.module.less`, `packages/libs/theme/theme.less`)
- CSS - editor theme assets (`packages/apps/editor/assets/theme/editor_color_light.css`)
- Bash - deployment script (`packages/apps/service-worker/scripts/deploy-h5test.sh`)
- Python - legacy packer helper only (`packages/libs/packer/prev/forceRemoteBgm.py`)

## Runtime

**Environment:**
- Node.js 24 - CI runtime (`.github/workflows/deploy-editor-h5test.yml`), and Node >=18 required by `packages/libs/packer/package.json` (`engines.node`)
- Browser runtime - both apps are browser-targeted SPAs; service-worker app runs inside a Service Worker global scope (`packages/apps/service-worker/src/server/index.ts`)

**Package Manager:**
- pnpm 12.5.1 (pinned in `.github/workflows/deploy-editor-h5test.yml` and declared in root `package.json` as `engines.pnpm: ">=12.5.1"`; there is no `packageManager` field — pnpm 12 would record the pnpm binary plus 14 `@pnpm/exe.*` platform packages into `pnpm-lock.yaml`, so the lighter `engines` declaration is used instead)
- Workspace catalogs — dependency versions centralized in `pnpm-workspace.yaml` (`catalog:` references across all manifests)
- Lockfile: present (`pnpm-lock.yaml`)
- `.npmrc`: `ignore-workspace-root-check = true`

## Frameworks

**Core:**
- React 19.2.3 + React DOM 19.2.3 - both apps (catalog `react`/`react-dom`)
- Vite 7.3.1 - build/dev for both apps; root override forces `vite: 7.3.1` (`pnpm-workspace.yaml`)
- PandaCSS 1.8.1 - editor styling system (`packages/apps/editor/panda.config.ts`, `packages/apps/editor/postcss.config.cjs`; `syntax: template-literal`, `outdir: styled-system`)
- Ant Design 6.2.1 + `@ant-design/icons` 6.1.0 - editor component library (`packages/apps/editor/package.json`)
- Semi UI (`@douyinfe/semi-ui` ^2.90.0, icons, illustrations) - service-worker UI (`packages/apps/service-worker/package.json`)
- Blockly 12.3.1 + `@blockly/field-colour`, `@blockly/field-multilineinput` - visual coding in editor (`packages/apps/editor/src/blockly/`)
- Monaco Editor 0.56.0 (catalog) - code editing; wrapped and aliased through `packages/libs/react-monaco-editor`
- PixiJS 8.19.0 - map rendering in editor (`packages/apps/editor/src/MapEditor/`)
- TanStack React Query 5.90.20 + TanStack Store 0.8.0 - editor server/state (`packages/apps/editor/src/queryClient.ts`)
- `react-query` ^3.39.3 (legacy) - service-worker (`packages/apps/service-worker/src/view/App.tsx`, resolved via catalog)
- immer 11.1.3, alien-signals 3.1.2, ts-pattern 5.9.0 - state and control-flow primitives (editor)

**Testing:**
- Vitest 4.0.18 (editor) / catalog ^4.0.16 - unit tests in both apps and libs
- Playwright 1.61.1 (`@playwright/test`) - E2E; configs at `packages/apps/editor/playwright.config.ts` and `packages/apps/service-worker/playwright.config.ts`
- @testing-library/react 16.3.2 - component tests in `packages/libs/react-hooks`, `packages/libs/react-store`, editor
- fast-check 4.5.3 / 4.5.2 (catalog) - property-based tests
- jsdom 26.1.0 - DOM environment for lib tests

**Build/Dev:**
- ESLint 9.39.2 (flat config) + `typescript-eslint` 8.53.1 + `@stylistic/eslint-plugin` + `eslint-plugin-react-hooks` + `eslint-plugin-react-refresh` + `eslint-plugin-react-hooks-better-stable` (`eslint.config.js`, `packages/apps/editor/eslint.config.js`)
- dprint 0.50.2 - editor formatting, plugins fetched from the network (`packages/apps/editor/dprint.jsonc`)
- `babel-plugin-react-compiler` 1.0.0 - React Compiler via `@vitejs/plugin-react` babel config (`packages/apps/editor/vite.config.ts`)
- `vite-plugin-node-polyfills` - Node globals shims in both app builds
- `vite-plugin-svgr` - SVG-as-component (service-worker)
- `vite-bundle-analyzer` - static analysis report on service-worker build
- `typescript-plugin-css-modules` - typed CSS modules (base tsconfig)

## Key Dependencies

**Critical:**
- `@zip.js/zip.js` 2.8.15 - ZIP handling in editor
- `acorn` 8.17.0 + `acorn-walk` 8.3.5 - JS parsing (`packages/libs/file2x`, editor deps)
- `json5` 2.2.3 - mota-js data parsing (`packages/libs/file2x`)
- `dexie` ^4.2.1 - IndexedDB ORM for project registry (`packages/apps/service-worker/src/server/project.ts`)
- `memfs` ^4.51.1 - `FsaNodeFs` bridges File System Access API handles into Node-style FS (`packages/apps/service-worker/src/server/project.ts`)
- `mime` ^4.1.0 - content-type resolution for preview serving (`packages/apps/service-worker/src/server/preview.ts`)
- `universal-router` ^10.0.1 - view routing in service-worker (`packages/apps/service-worker/src/view/routes.ts`)
- `sharp` ^0.34.5 - native image processing (WebP, sprites, tilesets) in `packages/libs/h5animate/lib/webp.ts` and `packages/libs/packer/src/utils/image-utils.ts`
- `terser` ^5.44.1 - JS minification (`packages/libs/packer/src/minifier.ts`)
- `jszip` ^3.10.1 - ZIP archive packing (`packages/libs/packer/src/utils/zip-utils.ts`)
- `iconv-lite` ^0.7.1 - GBK decoding for legacy mota-js assets (`packages/libs/packer/src/utils/zip-utils.ts`)
- `zod` ^4.2.1 - validation in `packages/libs/h5animate`
- `lodash-es` ^4.17.22 - shared utilities (`packages/libs/react-store`, `react-hooks`, `react-monaco-editor`, `react-dark-mode`, service-worker)
- `localforage` 1.10.0 - in-editor runtime third-party asset (bundled into game preview load path)
- `lz-string` 1.5.0 - compression for editor persistence/runtime

**Infrastructure:**
- `es-toolkit` (1.44.0 editor / ^1.43.0 catalog) - utility belt in editor, packer, service-worker
- `js-beautify` 1.15.4, `json5`, `awesomplete` 1.1.7, `color-convert` 3.1.3, `lucide-react` 1.24.0 - editor UX
- `@motajs/config` - shared tsconfig bases and `resolvePlugin` (`packages/libs/config/`)
- Workspace libs: `@motajs/utils`, `@motajs/file2x`, `@motajs/packer`, `@motajs/h5animate`, `@motajs/react-store`, `@motajs/react-hooks`, `@motajs/react-monaco-editor`, `@motajs/react-dark-mode`

**Monaco toolchain:**
- `monaco-textmate` ^3.0.1, `monaco-editor-textmate` ^4.0.0, `onigasm` ^2.2.5 - TextMate grammar highlighting (`packages/libs/react-monaco-editor/package.json`)

## Configuration

**Environment:**
- Editor host configuration is injected via a JSON script node (`<script id="mota-editor-environment">`) and parsed at runtime — not env vars (`packages/apps/editor/index.html`, `packages/apps/editor/src/environment.ts`)
- Build/dev env vars consumed:
  - `MOTA_JS_ROOT` - override path to the mota-js game project (`packages/apps/editor/mota-root.ts`)
  - `MOTA_EDITOR_ARTIFACT`, `MOTA_EDITOR_OUTPUT` - artifact staging inputs (`packages/apps/service-worker/scripts/stage-editor.mjs`)
  - `MOTA_WITH_EDITOR`, `MOTA_EDITOR_E2E_PORT`, `PLAYWRIGHT_USE_SYSTEM_CHROME`, `PLAYWRIGHT_CHANNEL`, `CI` - test configs
  - `VITE_DEPLOY_REVISION`, `PACKAGE_VERSION` - service-worker cache versioning (`packages/apps/service-worker/src/server/cache.ts`); `import.meta.env.PACKAGE_VERSION` defined in `packages/apps/service-worker/vite.config.ts`
  - `DEPLOY_HOST`, `DEPLOY_ROOT`, `DEPLOY_URL`, `DEPLOY_SSH_PORT`, `SKIP_BUILD` - deployment (`packages/apps/service-worker/scripts/deploy-h5test.sh`)
- No `.env` file detected at repo root; secrets are supplied by GitHub Actions environment `h5test`

**Build:**
- Editor: `tsc -b && vite build`; MPA with two entrypoints — `index.html` (editor) and `runtime.html` (runtime bridge) (`packages/apps/editor/vite.config.ts`); `publicDir` = mota-js root; dev server on `127.0.0.1:1055`
- Editor artifact: SHA-256 manifest emitted by `packages/apps/editor/editor-artifact-plugin.ts` (`editor-manifest.json`, schemaVersion 2, 20 MiB raw budget, exactly one Monaco `ts.worker`, no css/html workers)
- Service worker: `vite build` emits `index.html` and `service-worker.js` (`packages/apps/service-worker/vite.config.ts`); custom dev middleware serves the built worker; `build:with-editor` chains editor build + `stage:editor`
- TypeScript project references/roots: `packages/libs/config/tsconfig.app.base.json`, `packages/libs/config/tsconfig.lib.base.json`, `packages/libs/config/tsconfig.vite.json`; per-package `tsconfig.json`/`tsconfig.app.json`/`tsconfig.server.json`/`tsconfig.node.json`
- Path aliases: `@/*` → `src/*` (apps) or `lib/*` (libs); `@test/*`, `@styled-system/*` in editor; workspace-wide `@/` resolution is implemented by `packages/libs/config/resolvePlugin.js`
- Lint/format configs: `eslint.config.js` (root), `packages/apps/editor/eslint.config.js`, `packages/apps/editor/dprint.jsonc`

**Notable workspace facts:**
- `packages/libs/theme/pacakge.json` is misspelled, so `@motajs/theme` is NOT a discoverable workspace package even though it is under `packages/libs/*`
- `packages/libs/packer/prev/package.json` is a legacy Babel-based leftover, not wired into scripts
- `packages/external/mota-js` is a git submodule (`.gitmodules` → `git@github.com:ckcz123/mota-js.git`) and is empty/uninitialized in this checkout; the editor build requires `git submodule update --init packages/external/mota-js`

## Platform Requirements

**Development:**
- Node.js 24 recommended (CI), pnpm >=12.5.1 (declared via `engines.pnpm`)
- Git submodule initialized: `packages/external/mota-js`
- Native/build-tool approvals in `pnpm-workspace.yaml` (`allowBuilds`): `@parcel/watcher`, `dprint`, `esbuild`, `less`, `sharp`
- Dev ports: editor `127.0.0.1:1055`; service-worker preview `127.0.0.1:4178`
- Playwright browsers required for E2E (`playwright install chromium`; Chrome channel preferred on non-CI macOS)

**Production:**
- Static hosting of the service-worker app + editor release artifacts under a scope URL; deployed to `https://mota.press/server/` on an SSH-accessible Linux host (`/var/www/doc/server`)
- Browser must support Service Workers, Cache Storage, IndexedDB, and the File System Access API (`@types/wicg-file-system-access`)

---

*Stack analysis: 2026-09-20*
