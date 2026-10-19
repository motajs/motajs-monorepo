---
phase: 03-asset
plan: 27
subsystem: ui
tags: [demo-data, png-encoder, compression-stream, asset-panel, uat-gap-closure, vitest, memory]

# Dependency graph
requires:
  - phase: 03-asset
    provides: "03-23 36 张代码现场生成的多尺寸演示 PNG 与列表文件"
  - phase: 03-asset
    provides: "03-11/03-19 素材面板图片分类与卡片预览"
  - phase: 03-asset
    provides: "03-09 图片转码的 busy 态与「正在转码」提示"
provides:
  - "两张 4096 × 4096 的演示 PNG：IDAT 经 CompressionStream('deflate') 压缩，串行生成"
  - "图片列表在 36 张小图之后追加 huge-01.png / huge-02.png，共 38 条"
  - "seedAssetDemo(backend, largeSize?) 统一启动与测试的 seed 路径"
  - "测试用 64×64 覆盖大图生成，ASSET_DEMO_FILES 仍只有 36 张图"
affects: [03-asset UAT G-03-9 复验]

actuals:
  tokens: 4060
  tasks: 2
  commits: 2
  plan_head_before: 00292271184ffa5eb1e0f30af483dbc5cff7b1c4

tech-stack:
  added: []
  patterns:
    - "超大演示图用 CompressionStream('deflate') 产出 zlib 流直接作为 PNG IDAT；缺少 API 或 Blob.prototype.stream 时回退 stored deflate"
    - "压缩输入直接 enqueue 原始 Uint8Array，不 slice、不复制整份像素缓冲"
    - "两张 4096² 图用 for...of 串行生成，任意时刻只存活一份约 64 MiB 的 RGBA 缓冲"
    - "大图列表与字节同路径覆盖小图列表；测试改用 64×64，避免每次装配都分配超大缓冲"

key-files:
  created: []
  modified:
    - packages/apps/editor-dev/src/demo/assetDemo.ts
    - packages/apps/editor-dev/src/main.tsx
    - packages/apps/editor-dev/src/__tests__/devHostAsset.test.tsx

key-decisions:
  - "尺寸取 4096×4096：单个 RGBA 缓冲约 64 MiB；明确拒绝 8192²（约 268 MiB）与 32768²（约 4 GiB），避免 OOM"
  - "大图不放进 ASSET_DEMO_FILES：现有装配测试每次都 seed 该数组，放进去会让每次测试都生成超大 PNG"
  - "压缩前同时检查 CompressionStream 与 Blob.prototype.stream：Vitest 的 jsdom 里后者为 undefined，直接 Blob.stream() 会抛错"
  - "seedAssetDemo 同时服务 main.tsx 与测试，测试才能覆盖「启动路径有没有 seed 大图」"
  - "列表在同路径上后写覆盖先写：先 seed 36 张小图，再用 38 条列表覆盖，顺序仍是 hero / tile 在前"

patterns-established:
  - "大字节生成函数的尺寸参数可被测试改小，测试永远不会触发默认的超大分配"
  - "压缩路径另用一次性临时测试（node:zlib inflateSync）校验 IDAT 可解，不入库"

requirements-completed: [ASSET-01]

coverage:
  - id: D1
    description: "开发宿主生成两张 4096×4096 的压缩 PNG，并登记进图片列表（共 38 条，末尾是 huge-01 / huge-02）"
    requirement: ASSET-01
    verification:
      - kind: integration
        ref: "packages/apps/editor-dev/src/__tests__/devHostAsset.test.tsx#超大演示图按尺寸生成并登记进图片列表"
        status: pass
      - kind: integration
        ref: "packages/apps/editor-dev/src/__tests__/devHostAsset.test.tsx#接入超大演示图后图片分类读出 38 条"
        status: pass
    human_judgment: false
  - id: D2
    description: "对两张 4096² 图批量转码时，「正在转码」状态会明显停留，不再一闪而过"
    requirement: ASSET-01
    verification: []
    human_judgment: true
    rationale: "测试只能证明图片尺寸与列表条目；转码耗时的可感知程度取决于真实浏览器的 WebP 编码速度，必须人工观察"

duration: 18min
completed: 2026-10-19
status: complete
---

# Phase 03 Plan 27: 两张 4096² 演示大图（G-03-9）Summary

**开发宿主的图片分类末尾多了两张 4096 × 4096 的压缩演示 PNG，批量转码时「正在转码」状态终于能被人眼看到；生成串行且压缩，不会把 64 MiB 原始像素常驻内存。**

## Performance

- **Duration:** 约 18 min
- **Started:** 2026-10-19T22:53:00+08:00
- **Completed:** 2026-10-19T23:11:00+08:00
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- **两张真正的大图。** 新增 `DEMO_LARGE_TEXTURE_WIDTH` / `DEMO_LARGE_TEXTURE_HEIGHT`（均为 4096）与 `DEMO_LARGE_TEXTURE_SPECS`（`huge-01.png` / `huge-02.png`）；默认尺寸下单个 RGBA 缓冲约 64 MiB，足以让浏览器 WebP 编码占用可感知的时间，又不会像 32768² 那样直接 OOM。
- **压缩而不是原样塞进去。** 新增 `compressZlibStream` / `encodePngCompressed`：用 `new ReadableStream(...).pipeThrough(new CompressionStream('deflate'))` 直接压缩扫描行，压缩字节就是 PNG 的 IDAT；输入 `Uint8Array` 不再 `slice()`，避免整份缓冲被复制。`CompressionStream` 或 `Blob.prototype.stream` 缺失时回退到已有的 stored deflate。
- **编码器拆分不改变输出。** 从 `encodePng` 抽出 `createIhdrData` / `createPngPixels`，`encodePng` 仍按原顺序拼 IHDR / IDAT / IEND，36 张小图字节与改动前等价（既有字节断言全绿）。
- **串行生成两张。** `createLargeAssetDemoFiles` 先造一份 38 条的列表，再用 `for...of` + `await` 一张一张生成，任意时刻只存活一份像素缓冲；模块顶层不调用它。
- **启动与测试共用 seed 路径。** 新增 `seedAssetDemo(backend, largeSize?)`，先 seed 36 张小图、再用大图列表覆盖同路径列表；`main.tsx` 在 `core.initialize` 前 `await seedAssetDemo(backend)`，测试则传 64×64。
- **两层回归。** 生成器用例断言 3 个文件、38 条列表、最后两项是 huge 图、两张 PNG 签名与 IHDR 为 64×64；宿主用例经共享 helper 打开图片分类，读出 38 条且首两张仍是 `hero.png` / `tile.png`。`ASSET_DEMO_FILES` 仍只有 36 张图。

## Task Commits

Each task was committed atomically:

1. **Task 1: 压缩生成两张 4096² 演示 PNG 与合并列表** - `0da20cd` (feat)
2. **Task 2: 开发宿主启动时 seed 大图并做组合回归** - `de3597e` (feat)

**Plan metadata:** 见本文件所在提交（docs: complete 03-27 plan）

## Files Created/Modified

- `packages/apps/editor-dev/src/demo/assetDemo.ts` — 导出 `IAssetDemoFile`；新增两张 4096² 图的常量与 spec、`createIhdrData` / `createPngPixels` / `compressZlibStream` / `encodePngCompressed` / `createLargeAssetDemoFiles` / `seedAssetDemo`。
- `packages/apps/editor-dev/src/main.tsx` — 删掉内联的 `ASSET_DEMO_FILES` seed 循环，改在 `core.initialize` 前 `await seedAssetDemo(backend)`。
- `packages/apps/editor-dev/src/__tests__/devHostAsset.test.tsx` — 新增生成器用例（64×64）、`createHostWithLargeDemo` helper 与 38 条卡片用例；既有 36 条用例未改。

## Decisions Made

- **4096² 是上限，不是起点。** 8192² 单缓冲约 268 MiB，叠加编码与 Blob 拷贝容易 OOM；32768² 约 4 GiB，必然失败。4096² 足以拖慢转码，且两张串行生成时峰值可控。
- **大图绝不进 `ASSET_DEMO_FILES`。** 该数组被所有开发宿主测试装配使用；把它放进数组等于让每次测试都生成两张超大 PNG，既慢又可能爆内存。
- **压缩前检查两个 API。** `typeof CompressionStream === 'undefined'` 之外还要检查 `Blob.prototype.stream`：Vitest 的 jsdom 里前者存在（Node 提供）、后者是 `undefined`，只看前者会走进会抛错的路径。
- **列表用同路径覆盖。** 小图列表 36 条先 seed，大图列表 38 条后写覆盖同一路径；`Map.set` 后写生效，`hero.png` / `tile.png` 的顺序因此保持不变。
- **测试尺寸参数化。** 生成函数接受宽高，测试固定传 64×64；默认值只在真实开发宿主启动时生效。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - 风格合规] 计划的内联对象类型改为内部接口**
- **Found during:** Task 2（`seedAssetDemo` 签名）
- **Issue:** 计划写的是 `largeSize?: { width: number; height: number }`，但 AGENTS.md 的代码风格明确禁止内联对象类型，要求单独声明 interface。
- **Fix:** 在 `assetDemo.ts` 内新增不导出的 `IAssetDemoLargeSize`（`width` / `height` 均 `readonly`），`seedAssetDemo` 以它作参数类型；行为与计划完全一致，测试仍直接传 `{ width: 64, height: 64 }`。
- **Files modified:** `packages/apps/editor-dev/src/demo/assetDemo.ts`
- **Verification:** `pnpm --filter @motajs/editor-dev typecheck` 与 ESLint 均退出 0。
- **Committed in:** `de3597e`（Task 2 提交）

**2. [Rule 3 - 阻塞] Prettier 3.9.8 重排了两处既有表达式**
- **Found during:** Task 1（提交前格式检查）
- **Issue:** 改动后的 `assetDemo.ts` 无法通过 `prettier --check`：`paletteColor` 里三行 `A + B % C` 被 Prettier 3.9.8 要求加括号成 `A + (B % C)`；这是仓库既有文件的格式差异，不是本次逻辑改动。
- **Fix:** 对 `assetDemo.ts` 与测试文件执行 `prettier --write`，只接受这两行括号重排；表达式语义不变（`%` 优先级本就高于 `+`）。
- **Files modified:** `packages/apps/editor-dev/src/demo/assetDemo.ts`
- **Verification:** `prettier --check` 与 `eslint` 均通过；36 张小图字节断言仍全绿。
- **Committed in:** `0da20cd`（Task 1 提交）

**3. [流程说明] `seedAssetDemo` 落在 Task 2 提交**
- **Found during:** Task 2 接线
- **Issue:** 计划 Task 2 的 `<files>` 只列了 `main.tsx` 与测试，但 Task 2 的 action 明确要求在 `assetDemo.ts` 新增 `seedAssetDemo`。
- **Fix:** 按 action 把 helper 与它的调用方一起提交在 Task 2，保持「一个任务一次可运行提交」；Task 1 提交里没有 `seedAssetDemo`。
- **Committed in:** `de3597e`（Task 2 提交）

---

**Total deviations:** 2 auto-fixed（1 风格合规、1 格式阻塞）+ 1 流程说明
**Impact on plan:** 无功能偏差；尺寸、串行生成、压缩、列表覆盖、测试尺寸与 `ASSET_DEMO_FILES` 保持 36 张等关键约束全部按计划落地。

## Issues Encountered

- **并发跑两包测试造成表格用例超时。** 第一次同时执行 `editor-dev` 与 `editor-impl` 的完整测试，`devHostTable.test.tsx` 有 4 条在 5 秒超时；单独重跑 `editor-dev` 后 29/29 通过，确认是 CPU 争用而非本次改动（表格测试的 `createHost` 根本不加载素材演示数据）。
- **jsdom 覆盖不到压缩路径。** jsdom 的 `Blob.prototype.stream` 是 `undefined`，自动化测试会走 stored deflate 回退。为确认压缩路径真的产出合法 zlib 流，用一次性临时测试（强制补上 `Blob.prototype.stream`，再用 `node:zlib` 的 `inflateSync` 解开 IDAT，校验扫描行长度为 `64 × (64 × 4 + 1)`）验证通过后删除，未入库。
- **jsdom 的 `getComputedStyle` 噪音。** 既有 antd 组件的环境噪音，不影响退出码与断言。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- G-03-9 的代码侧修复与两层回归已就位，等待用户在真实浏览器复验：`pnpm --filter @motajs/editor-dev dev`，滚到图片分类末尾确认两张 4096² 图，全选后打开「瘦身转码」观察「正在转码」是否肉眼可见（D2 标记为需人工判断）。
- `ASSET_DEMO_FILES` 保持 36 张，所有既有开发宿主测试的装配成本未增加。
- 开发宿主测试 29/29、`@motajs/editor-impl` 359/359 通过；`@motajs/editor-dev` typecheck 与 ESLint 退出 0。

---

## Self-Check: PASSED

- 3 个改动文件全部存在。
- 两个任务提交存在：`0da20cd`（Task 1）、`de3597e`（Task 2）。
- 提交计数由 ledger 实测：`git rev-list --count 0029227..HEAD` = 2。
- 计划禁令核对：未生成 8192² / 32768²；大图 IDAT 经压缩且未 `slice()` 输入；未放进 `ASSET_DEMO_FILES`；未使用 `document` / canvas；未改动 `editor-core` / `editor-impl`。

---

*Phase: 03-asset*
*Completed: 2026-10-19*
