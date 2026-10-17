---
phase: 03-asset
plan: 08
subsystem: editor-impl-asset
tags: [typescript, asset, model, jsonc, schema, pure-functions]

# Dependency graph
requires:
  - phase: 03-asset
    provides: "asset 域类型（IAssetListEntry / IAssetSchemaResolution / AssetSchemaSource）与命名约定常量（ASSET_LIST_FILE_NAME / ASSET_SCHEMA_FILE_NAME / ASSET_ORIGIN_SUFFIX）"
  - phase: 03-asset
    provides: "中立 `.jsonc` 编解码 shared/jsonc（parseTableText / serializeTableText / TableTextParseStatus）"
  - phase: 03-asset
    provides: "中立 schema 模型 shared/schemaForm/model（validateValue）与 schema 节点类型（ITableSchemaNode）"
provides:
  - "文件名清洗与路径换算：sanitizeAssetFileName / resolveAssetName / resolveAssetBytePath / resolveTranscodedPath / resolveOriginPath（asset/model/assetPaths.ts）"
  - "列表文件读写：readAssetList / writeAssetList / renameAssetListEntry（asset/model/assetList.ts，两种分类格式）"
  - "默认值与校验：mergeAssetDefaults / collectRequiredPaths / validateAssetConfig（asset/model/assetDefaults.ts）"
  - "schema 解析：resolveAssetSchema / resolveAssetSchemaPath（asset/model/assetSchema.ts）"
  - "内置新引擎 schema：getBuiltInAssetSchema（asset/schemas/builtInSchemas.ts）与 `./asset` 的 ./schemas 导出面"
affects: [03-10, 03-12, 03-13, 03-14, 03-16]

actuals:
  tokens: 7626
  tasks: 3
  commits: 5
plan_head_before: a7d0ce2120fa5741858023a40f07571173b59854

tech-stack:
  added: []
  patterns:
    - "asset 模型层是纯函数：不读文件、无 await / fetch / require，输入即数据、输出即数据（IO 全部留在面板数据层）"
    - "上传文件名先过 sanitizeAssetFileName 才拼路径；越界由第一道闸 + 注入文件系统双重拒绝"
    - "模块级对象常量用 Object.freeze 包裹（coreModuleState 门禁：禁止模块级对象 / 数组字面量，D-10/KERN-06）"

key-files:
  created:
    - packages/libs/editor-impl/src/asset/model/assetList.ts
    - packages/libs/editor-impl/src/asset/model/assetDefaults.ts
    - packages/libs/editor-impl/src/asset/model/assetSchema.ts
    - packages/libs/editor-impl/src/asset/schemas/builtInSchemas.ts
    - packages/libs/editor-impl/src/asset/schemas/index.ts
    - packages/libs/editor-impl/src/asset/model/__tests__/assetPaths.test.ts
    - packages/libs/editor-impl/src/asset/model/__tests__/assetList.test.ts
    - packages/libs/editor-impl/src/asset/model/__tests__/assetConfig.test.ts
  modified:
    - packages/libs/editor-impl/src/asset/model/assetPaths.ts
    - packages/libs/editor-impl/src/asset/model/index.ts
    - packages/libs/editor-impl/src/asset/index.ts

key-decisions:
  - "文件名清洗的两个辅助函数（hasControlChar / containsAnyChar）代替正则：`[\\u0000-\\u001f]` 触发 ESLint no-control-regex，改为逐字符判码点更干净"
  - "内置 schema 常量一律 Object.freeze<ITableSchemaNode> 包裹：裸的模块级对象字面量会被 coreModuleState 判 error（D-10/KERN-06），冻结后引用仍稳定、结构不变"
  - "readAssetList 只对「容器形态不符」抛错（`素材列表格式不正确`），单条条目格式不慎（缺来源字段 / 空串 / 非对象）只跳过该条、不中断整份列表"
  - "mergeAssetDefaults 仅在目标值为 undefined 时写入默认值深拷贝；目标已有值（含数组）一律保留——避免默认值覆盖用户已填配置"
  - "collectRequiredPaths / mergeAssetDefaults 都跳过 `@` 前缀键：`@required` 只参与必填判定，绝不写进素材配置（D-10）"
  - "resolveAssetSchema 对工程内 schema 的三种非 Conforming 结论（Invalid / NeedsCommentStrip）统一返回 null，由面板进错误态而非静默回退（T-03-25）"
  - "内置只有新引擎那套 schema：legacy 那套必然含引擎专有词、会触发 coreEngineNeutral，按 D-08 由装配方经 IAssetCategory.schema 注入（INTERFACE-NAME.md §03-08 偏离 #1）"

patterns-established:
  - "纯逻辑先测透：路径 / 列表 / 默认值 / 校验 / schema 五块全为纯函数并各有单测，面板接线时不会把「路径拼错 / 前缀丢 / 默认值覆盖用户配置」带到 UI"
  - "引擎中立：asset 不 import table / code / map，也不写字面量引擎专有词；legacy schema 走注入"

requirements-completed: [ASSET-01]

coverage:
  - id: D1
    description: "文件名清洗（拒分隔符 / `..` / 前导点 / 控制字符 / Windows 非法字符 / 超长）与四种路径换算（名字 / 字节路径 / 转码路径 / 保留旧文件路径）"
    requirement: "ASSET-01"
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/model/__tests__/assetPaths.test.ts（15 tests）"
        status: pass
      - kind: other
        ref: "结构检查（五个 export function + ASSET_ORIGIN_SUFFIX 齐备）+ pnpm --filter @motajs/editor-impl typecheck（退出码 0）"
        status: pass
    human_judgment: false
  - id: D2
    description: "列表文件两种格式（对象数组挂键下 / string[]）的读写与条目改名，容器不符抛错、写回保序且保留基底其余键"
    requirement: "ASSET-01"
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/model/__tests__/assetList.test.ts（11 tests，含两种格式 round-trip 与改名）"
        status: pass
      - kind: other
        ref: "结构检查（三个 export function + `素材列表格式不正确` + 无 await / require / fetch）"
        status: pass
    human_judgment: false
  - id: D3
    description: "新增素材默认值逐属性合并（`@required` 不进结果、目标值不被覆盖）、嵌套必填路径收集、schema + 必填的可读错误校验"
    requirement: "ASSET-01"
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/model/__tests__/assetConfig.test.ts（mergeAssetDefaults / collectRequiredPaths / validateAssetConfig 用例）"
        status: pass
    human_judgment: false
  - id: D4
    description: "schema 优先级「工程内 .schema.jsonc → 注入回退 → 内置新引擎」；非法 / 需剥离注释的工程 schema 返回 null；内置图片 / 音频 schema 有可读描述、动画 / 字体为空对象 schema"
    requirement: "ASSET-01"
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/model/__tests__/assetConfig.test.ts（resolveAssetSchema 五条 + resolveAssetSchemaPath + getBuiltInAssetSchema）"
        status: pass
      - kind: other
        ref: "node scripts/verify/coreEngineNeutral.js（真实树 85 个生产文件 0 违规）+ node scripts/verify/coreModuleState.js（真实树 0 条 error 级受限规则）"
        status: pass
    human_judgment: false

duration: 24min
completed: 2026-10-17
status: complete
---

# Phase 3 Plan 08: 素材模型层与内置 schema Summary

**把素材侧的纯换算一次测透——上传名怎么清洗、路径怎么拼、两种列表文件怎么读写、默认值怎么合、必填怎么判、schema 按什么顺序取——并为新引擎补上内置 schema。**

## Performance

- **Duration:** 约 24 min
- **Started:** 2026-10-17T15:44:00Z
- **Completed:** 2026-10-17T16:08:00Z
- **Tasks:** 3
- **Files modified:** 11（8 新建，3 修改）

## Accomplishments

- `asset/model/assetPaths.ts` 追加五个纯函数：`sanitizeAssetFileName`（拒 `/` `\` / `..` / `.` 前导点 / U+0000–U+001F 控制字符 / `:*?"<>|` / >128 长度，防路径穿越第一道闸）、`resolveAssetName`、`resolveAssetBytePath`、`resolveTranscodedPath`、`resolveOriginPath`。
- `asset/model/assetList.ts` 实现列表文件读写：`readAssetList`（`StringList` 取非空字符串、`ObjectList` 按 `listKey` 取对象数组并以 `sourceField`（默认 `source`）取名字；容器不符抛 `素材列表格式不正确`、单条缺来源跳过）、`writeAssetList`（写回保序、保留基底其余键、缺配置的条目补来源字段）、`renameAssetListEntry`（改名字，`ObjectList` 同步改来源字段）。
- `asset/model/assetDefaults.ts` 实现默认值合并与校验：`mergeAssetDefaults`（逐属性合并、目标值不被覆盖、`@required` 不写进结果、目标缺省才补默认值深拷贝）、`collectRequiredPaths`（递归收集 `@required`，嵌套路径带 `.` 前缀）、`validateAssetConfig`（先按 schema 判整份再逐条查必填，返回可读错误文案）。
- `asset/model/assetSchema.ts` 实现 `resolveAssetSchema`（工程内 schema → 注入 schema → 内置 schema 的优先级；工程 schema 非法 / 需剥离注释时返回 `null`）与 `resolveAssetSchemaPath`（缺省 `${dir}/.schema.jsonc`）。
- `asset/schemas/builtInSchemas.ts` 给出**新引擎**内置 schema：图片覆盖 `source` / `read` / `usage` / `grid` / `tiles`（带中文可读描述与必填），音频用 `type` 区分背景音乐与音效，动画 / 字体为空对象 schema（落回「尚未定义任何字段。」空态）；legacy 那套按 D-08 由装配方注入。
- `asset/index.ts` 追加 `export * from './schemas'`，`asset/model/index.ts` 追加三个桶导出——`./asset` 对外导出面含内置 Schema 集。

## Task Commits

Each task was committed atomically:

1. **Task 1: 文件名清洗与路径推导** - `7c346d0` (feat)
2. **Task 2: 列表文件读写与条目改名** - `f3ecba5` (feat)
3. **Task 3: 默认值合并、必填校验、schema 解析与内置 schema** - `b4f5f23` (feat)
4. **门禁修复：内置 schema 改用 Object.freeze** - `b28b3d8` (fix)
5. **门禁修复：控制字符检查改码点扫描 + Prettier 排版** - `33304c6` (fix)

**Plan metadata:** (本 SUMMARY 提交) (docs)

_Note: 本计划为纯逻辑实现，无 TDD 循环；两次 fix 提交为门禁红转绿所需（见 Deviations）。_

## Files Created/Modified

- `packages/libs/editor-impl/src/asset/model/assetPaths.ts` - 改：追加 `sanitizeAssetFileName` / `resolveAssetName` / `resolveAssetBytePath` / `resolveTranscodedPath` / `resolveOriginPath` 与两个私有辅助（`hasControlChar` / `containsAnyChar`）
- `packages/libs/editor-impl/src/asset/model/assetList.ts` - 新：列表文件两种格式的读写与改名
- `packages/libs/editor-impl/src/asset/model/assetDefaults.ts` - 新：默认值合并 / 必填收集 / 配置校验
- `packages/libs/editor-impl/src/asset/model/assetSchema.ts` - 新：schema 优先级解析与路径推导
- `packages/libs/editor-impl/src/asset/model/index.ts` - 改：追加 assetList / assetDefaults / assetSchema 三个桶导出
- `packages/libs/editor-impl/src/asset/schemas/builtInSchemas.ts` - 新：`getBuiltInAssetSchema` 与新引擎内置 schema（`Object.freeze` 包裹）
- `packages/libs/editor-impl/src/asset/schemas/index.ts` - 新：`export * from './builtInSchemas';`
- `packages/libs/editor-impl/src/asset/index.ts` - 改：追加 `export * from './schemas';`
- `packages/libs/editor-impl/src/asset/model/__tests__/assetPaths.test.ts` - 新：清洗拒绝用例 + 四种路径换算（15 tests）
- `packages/libs/editor-impl/src/asset/model/__tests__/assetList.test.ts` - 新：两种格式 round-trip + 改名 + 容器抛错（11 tests）
- `packages/libs/editor-impl/src/asset/model/__tests__/assetConfig.test.ts` - 新：默认值 / 必填 / 校验文案 / schema 优先级 / 内置 schema（21 tests）

## Decisions Made

- **清洗用码点扫描代替正则。** `[\u0000-\u001f]` 触发 ESLint `no-control-regex`；改为 `hasControlChar` 逐字符判码点，并把 Windows 非法字符集合抽成常量由 `containsAnyChar` 匹配，无禁用注释、无行内正则。
- **内置 schema 常量用 `Object.freeze<ITableSchemaNode>(...)` 包裹。** 裸的模块级对象字面量触发 `coreModuleState`（D-10/KERN-06）；冻结后引用稳定、类型与结构不变，`validateValue` 的按引用缓存仍命中。
- **合并语义宁缺毋滥。** `mergeAssetDefaults` 只在目标值为 `undefined` 时写默认值；目标有任何已填值（含数组）都保留——默认值只补空缺，不覆盖用户配置。`@required` 与所有 `@` 前缀键既不进合并结果也不参与递归。
- **列表容错边界。** 容器形态不符（非数组 / 缺 `listKey` 数组）才抛 `素材列表格式不正确`；单条条目格式不慎只跳过该条，避免一条坏条目毁掉整份列表。
- **schema 非法即进错误态。** 工程内 schema 处于 `Invalid` 或 `NeedsCommentStrip` 时统一返回 `null`，不用半截 schema 静默渲染（威胁 T-03-25）。
- **只内置新引擎 schema。** legacy 那套必然含引擎专有词，`coreEngineNeutral.js` 会把两包 `src` 里（连注释）的 `tower` 等判违规，故按 D-08 由装配方经 `IAssetCategory.schema` 注入（INTERFACE-NAME.md §03-08 偏离 #1）。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 内置 schema 的模块级对象字面量触发 `coreModuleState` 门禁**
- **Found during:** Task 3 完成后（计划级门禁核查）
- **Issue:** `asset/schemas/builtInSchemas.ts` 的三个模块级 `const = { ... }` 被 `coreModuleState.js` 以 error 级 `no-restricted-syntax` 命中（三条，第 9/30/40 行）——门禁禁止模块级对象 / 数组字面量（D-10/KERN-06）。计划的自查只列了 test / typecheck / coreEngineNeutral，未预见到此门禁，但 red 的门禁属真实回归。
- **Fix:** 三个常量改用 `Object.freeze<ITableSchemaNode>({ ... })` 包裹（与 `shared/schemaForm/model/validation.ts` 里 `Object.freeze(new WeakMap())` 同款写法，也是门禁报错直接点名的合规形态）。行为不变：引用稳定、结构仍为 `ITableSchemaNode`。
- **Files modified:** `packages/libs/editor-impl/src/asset/schemas/builtInSchemas.ts`
- **Verification:** `node scripts/verify/coreModuleState.js` 退出码 0（真实树受限规则 error 级 0 条）；`eslint` 该文件退出码 0；`assetConfig.test.ts` 21 用例仍全绿。
- **Committed in:** `b28b3d8`

**2. [Rule 1 - Bug] 控制字符正则触发 ESLint `no-control-regex`**
- **Found during:** Task 3 完成后（对 `asset/` 全目录跑 ESLint）
- **Issue:** `sanitizeAssetFileName` 里的 `/[\u0000-\u001f]/` 被 `no-control-regex` 判 error（`asset/model/assetPaths.ts` 第 30 行）。
- **Fix:** 抽 `hasControlChar` 逐字符判码点（`charCodeAt(0) <= 0x1f`）替代正则；Windows 非法字符集合抽为常量 `WINDOWS_ILLEGAL_CHARS` 并用 `containsAnyChar` 匹配。行为完全一致。
- **Files modified:** `packages/libs/editor-impl/src/asset/model/assetPaths.ts`
- **Verification:** `eslint packages/libs/editor-impl/src/asset` 退出码 0；`assetPaths.test.ts` 15 用例仍全绿（含控制字符拒绝用例）。
- **Committed in:** `33304c6`

**3. [Rule 1 - Style] 两个测试文件未过 Prettier**
- **Found during:** Task 3 完成后（`prettier --check` 全量新文件）
- **Issue:** `assetList.test.ts` / `assetConfig.test.ts` 的换行未达标（Prettier 经 `prettier/prettier: error` 由 ESLint 强制，会红）。
- **Fix:** `prettier --write` 两文件。
- **Files modified:** `packages/libs/editor-impl/src/asset/model/__tests__/assetList.test.ts`、`.../assetConfig.test.ts`
- **Verification:** `prettier --check "packages/libs/editor-impl/src/asset/**/*.ts"` 全绿；该两个测试文件全绿。
- **Committed in:** `33304c6`

---

**Total deviations:** 3 auto-fixed（3 × Rule 1：1 门禁 / 1 lint / 1 格式）
**Impact on plan:** 三处都只改写法与格式，不改任何对外函数签名、行为或数据结构；命名与形状与 `INTERFACE-NAME.md` §03-08 完全一致，无范围蔓延。

## Issues Encountered

- **执行期发现的额外门禁（`coreModuleState` / `no-control-regex` / Prettier）** 均已在计划收尾前修掉并复验，不遗留。计划 `<verification>` 明列的三条（test / typecheck / coreEngineNeutral）加本次补跑的 `coreModuleState` 全部退出码 0。
- **jsdom 的 `window.getComputedStyle` 报错** 是 antd 弹层在测试环境下的既有噪声（与 assets 无关），不影响 238/238 通过。

## User Setup Required

None - 本计划纯逻辑实现与单测，无外部服务、环境变量或依赖安装。

## Known Stubs

None - 全部为可运行的纯函数与实测单测，无占位、无 TODO、无空数据源。

## Threat Flags

None - 未新增网络端点、鉴权路径或文件访问；本层不触达文件系统（纯函数）。威胁登记表的 T-03-22（`sanitizeAssetFileName` 拒绝用例）/ T-03-23（`mergeAssetDefaults` 只写新对象、跳过 `@` 前缀、深拷贝）/ T-03-25（非法工程 schema 返回 `null`）均以单测落地。

## Next Phase Readiness

- 素材模型层就位，03-10（面板数据层）可直接用 `readAssetList` / `writeAssetList` / `resolveAssetSchema` 接资源层；03-12（默认选择器）与 03-14（配置表单）可取 `getBuiltInAssetSchema` / `resolveAssetSchema`；03-13（字节生命周期）可取 `sanitizeAssetFileName` / `resolveAssetBytePath` / `resolveOriginPath`；03-16（转码弹窗）可取 `resolveTranscodedPath`。
- `asset` 仍零跨能力 import（只依赖 `../react` 与 `../shared`），四道门禁（typecheck / coreEngineNeutral / coreBoundaries / coreImportType / coreModuleState / coreFsSurface）本次均绿。
- 无阻塞。

---

## Self-Check: PASSED

- FOUND: packages/libs/editor-impl/src/asset/model/assetPaths.ts
- FOUND: packages/libs/editor-impl/src/asset/model/assetList.ts
- FOUND: packages/libs/editor-impl/src/asset/model/assetDefaults.ts
- FOUND: packages/libs/editor-impl/src/asset/model/assetSchema.ts
- FOUND: packages/libs/editor-impl/src/asset/model/index.ts
- FOUND: packages/libs/editor-impl/src/asset/schemas/builtInSchemas.ts
- FOUND: packages/libs/editor-impl/src/asset/schemas/index.ts
- FOUND: packages/libs/editor-impl/src/asset/index.ts
- FOUND: packages/libs/editor-impl/src/asset/model/__tests__/assetPaths.test.ts
- FOUND: packages/libs/editor-impl/src/asset/model/__tests__/assetList.test.ts
- FOUND: packages/libs/editor-impl/src/asset/model/__tests__/assetConfig.test.ts
- FOUND commit: 7c346d0 (Task 1)
- FOUND commit: f3ecba5 (Task 2)
- FOUND commit: b4f5f23 (Task 3)
- FOUND commit: b28b3d8 (fix)
- FOUND commit: 33304c6 (fix)

*Phase: 03-asset*
*Completed: 2026-10-17*
