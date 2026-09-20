# External Integrations

**Analysis Date:** 2026-09-20

## APIs & External Services

**Game asset / plugin services:**
- h5mota.com plugin catalog — remote plugin listing opened from the code editor
  - URL: `https://h5mota.com/plugins/` (`packages/apps/editor/src/Workbench/CodeEditor/config/commands.ts`)
  - SDK/Client: plain browser navigation (no SDK)
  - Auth: none

**Editor host endpoints (injected, not hardcoded):**
- The editor resolves all backend URLs at runtime from the `<script id="mota-editor-environment">` JSON node; endpoints are `fs`, `runtime`, `preview`, `docs`, `project`, `update` (`packages/apps/editor/src/environment.ts`, `packages/apps/editor/index.html`)
  - Dev defaults in `packages/apps/editor/index.html`: `fs: "/"`, `runtime: "/runtime.html"`, `preview: "/game.html"`, `docs: "/_docs/"`, `project: "/"`
  - Editor update API — protocol v2 JSON over `GET`/`POST` `endpoints.update`, actions `check` and `activate` (`packages/apps/editor/src/Workbench/editorUpdate.ts`)
  - Service-worker host implements these as `/service/{id}/api/editor-update/` and `/service/{id}/api/fs/*` (`packages/apps/service-worker/src/server/router.ts`, `packages/apps/service-worker/src/view/routes.ts`)
- Editor file API — `POST` form-urlencoded operations `readFile`, `writeFile`, `writeMultiFiles`, `listFile`, `makeDir`, `moveFile`, `deleteFile` against `endpoints.fs` (`packages/apps/editor/src/services/fs/fs.ts`)
  - Dev implementation: local mota-js file server middleware (`packages/apps/editor/vite-plugin-mota-server.ts`, routes `/readFile`, `/writeFile`, `/writeMultiFiles`, `/listFile`, `/makeDir`, `/moveFile`, `/deleteFile`, `/reload`, `/hotReload`, `/replay*`)
  - Production implementation: service worker FS API (`packages/apps/service-worker/src/server/fsApi.ts`)

**Editor release channel:**
- `static/editor/current.json` channel pointer fetched with `cache: "no-cache"`; points at a `buildId` release directory containing `editor-manifest.json` and SHA-256-verified assets (`packages/apps/service-worker/src/server/editorRelease.ts`)
- Release assets fetched as JSON/static files; each asset validated by size and SHA-256 (`packages/apps/service-worker/src/server/releaseAssetCoordinator.ts`)

**Game runtime third-party libraries:**
- The editor runtime iframe loads third-party scripts from the host preview directory (`packages/apps/editor/src/runtime/iframeEntry.ts`):
  - `libs/thirdparty/lz-string.min.js`
  - `libs/thirdparty/priority-queue.min.js`
  - `libs/thirdparty/localforage.min.js`
  - `libs/thirdparty/zip.min.js`
  - `main.js` (mota-js engine)
- No package manager / CDN fetch at runtime — all scripts are served from the host preview root

**Build-time remote fetch:**
- dprint formatting plugins downloaded at format time from `https://plugins.dprint.dev/*.wasm` (`packages/apps/editor/dprint.jsonc`)
- pnpm registry (implicit) for all dependency installation

**Not detected:** no AI/LLM provider, no payment provider, no email/SMS, no CMS, no analytics, no error-tracking service, no OAuth/social login, no cloud storage SDK (S3/GCS/etc.).

## Data Storage

**Databases:**
- IndexedDB via Dexie — database `"service-worker"`, table `project` (`&id, name, lastTime`); stores project records keyed by a random numeric project ID in the range 1055–9922 (`packages/apps/service-worker/src/server/project.ts`)
  - Connection: in-browser only, no server connection string
  - Client: `dexie` ^4.2.1
- No external database servers detected.

**File Storage:**
- Browser File System Access API — real directories are accessed through `FileSystemDirectoryHandle` and wrapped with `memfs` `FsaNodeFs` for Node-style FS calls (`packages/apps/service-worker/src/server/project.ts`)
  - Permission checked via `handle.queryPermission({ mode: "readwrite" })`; `permission-required` state surfaced to the UI
- mota-js project files on disk during development — served/read by `packages/apps/editor/vite-plugin-mota-server.ts` from the `MOTA_JS_ROOT` submodule
- Editor in-memory resource layer with async persistence to the FS endpoint (`packages/apps/editor/src/fs/FileHandlerManager.ts`, `packages/apps/editor/src/project/data/DataResource.ts`)
- `localforage` is used inside the bundled game runtime (string reference in `packages/libs/packer/src/minifier.ts`, loader entry in `packages/apps/editor/src/runtime/iframeEntry.ts`)

**Caching:**
- Service Worker Cache Storage — cache prefix `motajs-service-worker:`, cache name `${PACKAGE_VERSION}:${VITE_DEPLOY_REVISION ?? "dev"}`; strategies `networkFirst`, `cacheFirst`, `cacheFirstWithRefresh`; stale caches purged on activate (`packages/apps/service-worker/src/server/cache.ts`)
- Separate editor release caches (per `buildId`) plus a shared blob cache and a metadata cache for release state (`packages/apps/service-worker/src/server/editorRelease.ts`)
- HTTP cache policy headers set by routing (`cache-control: no-cache` for app shell/static editor, long-lived `assets/*` via cache-first) (`packages/apps/service-worker/src/server/router.ts`)

## Authentication & Identity

**Auth Provider:**
- None — there is no user account, login, token, or identity provider in the codebase.
- Access control is limited to File System Access API permission grants per directory handle (`packages/apps/service-worker/src/server/project.ts`).
- Service worker `message` handler restricts senders to same-origin clients (`packages/apps/service-worker/src/server/index.ts`).

## Monitoring & Observability

**Error Tracking:**
- None detected.

**Logs:**
- `console.log` / `console.info` / `console.error` only (e.g. `packages/apps/editor/src/services/fs/fs.ts`, `packages/apps/editor/editor-artifact-plugin.ts`, `packages/apps/editor/vite-plugin-mota-server.ts`)
- Build-time artifact metrics emitted to console by `packages/apps/editor/editor-artifact-plugin.ts`

## CI/CD & Deployment

**Hosting:**
- Static site deployed to an SSH host under `/var/www/doc/server`, publicly served at `https://mota.press/server/` (`packages/apps/service-worker/scripts/deploy-h5test.sh`)
- Deployment is atomic: rsync to a staging dir, remote swap with rollback, previous release retained; verifies worker SHA-256 before and after swap

**CI Pipeline:**
- GitHub Actions — single workflow `Deploy editor to h5test` (`.github/workflows/deploy-editor-h5test.yml`)
  - Trigger: `workflow_dispatch` only; environment `h5test`; concurrency group `h5test-doc-server`
  - Steps: checkout with `submodules: recursive` → `pnpm/action-setup@v4` (pnpm 11.10.0) → `actions/setup-node@v4` (Node 24, pnpm cache) → `pnpm install --frozen-lockfile` → service-worker typecheck + test → `build:with-editor` → `playwright install --with-deps chromium` → SSH key setup from secrets → `deploy:h5test` with `SKIP_BUILD=1`
  - Post-deploy verification: `packages/apps/service-worker/scripts/verify-deployment.mjs` fetches `service-worker.js`, `current.json`, release manifest, launches Chromium and asserts Service Worker controller/scope
- No other CI workflows, no release automation, no npm publish pipeline detected.

**Git submodule:**
- `packages/external/mota-js` → `git@github.com:ckcz123/mota-js.git` (`.gitmodules`); required for editor build/dev/tests; currently uninitialized in this checkout

## Environment Configuration

**Required env vars / secrets:**
- GitHub Actions secrets: `H5TEST_SSH_HOST`, `H5TEST_SSH_PORT`, `H5TEST_SSH_PRIVATE_KEY`, `H5TEST_SSH_USER` (`.github/workflows/deploy-editor-h5test.yml`)
- Deployment script vars: `DEPLOY_HOST`, `DEPLOY_ROOT`, `DEPLOY_URL`, `DEPLOY_SSH_PORT`, `SKIP_BUILD` (`packages/apps/service-worker/scripts/deploy-h5test.sh`)
- Build/test vars: `MOTA_JS_ROOT`, `MOTA_EDITOR_ARTIFACT`, `MOTA_EDITOR_OUTPUT`, `MOTA_WITH_EDITOR`, `MOTA_EDITOR_E2E_PORT`, `PLAYWRIGHT_USE_SYSTEM_CHROME`, `PLAYWRIGHT_CHANNEL`, `VITE_DEPLOY_REVISION`
- Note: `.env` files are not used; the editor receives host configuration through the `#mota-editor-environment` JSON node.

**Secrets location:**
- GitHub Actions environment secrets (`h5test`); no secrets in-repo. No `.env`, `.npmrc` auth tokens, or credential files detected (`.npmrc` contains only `ignore-workspace-root-check`).

## Webhooks & Callbacks

**Incoming:**
- None (no externally callable webhook endpoints).
- Internal runtime interfaces:
  - Service Worker `fetch` event interception (`packages/apps/service-worker/src/server/index.ts`)
  - Service Worker `message` postMessage protocol with typed routes (`packages/apps/service-worker/src/server/index.ts`, `packages/apps/service-worker/src/idl/index.ts`)
  - Editor runtime `MessagePort` handshake `mota-runtime-connect` v3 with `resources-changed` / `resource-response` messages (`packages/apps/editor/src/runtime/iframeEntry.ts`)

**Outgoing:**
- `POST` editor update actions (`check`, `activate`) to the host-provided update endpoint (`packages/apps/editor/src/Workbench/editorUpdate.ts`)
- `POST` form-urlencoded FS operations to the host FS endpoint (`packages/apps/editor/src/services/fs/fs.ts`)
- `GET` editor release channel/manifest/assets from the deployment origin (`packages/apps/service-worker/src/server/editorRelease.ts`)
- Browser navigation to `https://h5mota.com/plugins/` for the online plugin list (`packages/apps/editor/src/Workbench/CodeEditor/config/commands.ts`)

---

*Integration audit: 2026-09-20*
