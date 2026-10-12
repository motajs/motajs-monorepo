---
phase: 02-table
plan: 06
subsystem: editor-impl
tags: [table, validation, ajv, json-schema, control, inputs, atomd, vitest, jsdom, d-22, d-23]

# Dependency graph
requires:
  - phase: 02-table
    provides: "editor-impl/table 的 JSON Schema 类型面（ITableSchemaNode / TableControlKind）与行树（ITableRowNode.config 携带每行 schema 节点）"
  - phase: 02-table
    provides: "editor-impl 的 vitest 工程脚手（jsdom 环境、mapPolyfill setup、barrel）"
provides:
  - "validateId：字段名校验（非空 / 字符集 / 不重名），带中文错误信息（唯一写入路径的前置防线，缓解 T-02-15）"
  - "validateValue：用 ajv（Draft 2020-12）对字段的标准 JSON Schema 节点做声明式校验；缺省 schema 视为无约束；删除许可 = validateValue(schema, null)"
  - "inferControlKind：由标准关键字（enum / boolean / array / number）推导行内控件，x-control 兜底（D-23）"
  - "五个行内输入控件：TextareaInput / SelectInput / CheckboxInput / CheckboxSet / ColorInput"
affects: [02-07, 02-08]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# tokens = chars/4 over the realized diff (git diff ${plan_head_before}..HEAD)
actuals:
  tokens: 6464
  tasks: 3
  commits: 3
  plan_head_before: 2512952b83c0b8bbf3112768aee510c5c8710acb

# Tech tracking
tech-stack:
  added:
    - "ajv 8.20.0（catalog 固定版本；Draft 2020-12 校验器，D-22 唯一新增运行时依赖）"
  patterns:
    - "校验完全声明式：validateValue 在函数内 new Ajv2020({ strict:false, allErrors:true }) 编译字段 schema，绝不对 schema 字符串做表达式求值（T-02-14）；strict:false 让 x-editor / x-control 扩展键被接受而非报未知关键字"
    - "控件推导由标准关键字驱动、x-control 兜底：x-control 优先，其次 enum→Select、type:boolean→Checkbox、type:array→MultiSelect、type:number/integer→Number，其余（含 schema 缺失）→Text"
    - "五种控件均为模块级函数组件 + 具名 props 接口；渲染内容一律是 React 文本节点（T-02-16）"

key-files:
  created:
    - "packages/libs/editor-impl/src/table/model/validation.ts"
    - "packages/libs/editor-impl/src/table/model/control.ts"
    - "packages/libs/editor-impl/src/table/components/inputs/TextareaInput.tsx"
    - "packages/libs/editor-impl/src/table/components/inputs/SelectInput.tsx"
    - "packages/libs/editor-impl/src/table/components/inputs/CheckboxInput.tsx"
    - "packages/libs/editor-impl/src/table/components/inputs/CheckboxSet.tsx"
    - "packages/libs/editor-impl/src/table/components/inputs/ColorInput.tsx"
    - "packages/libs/editor-impl/src/table/__tests__/validation.test.ts"
    - "packages/libs/editor-impl/src/table/__tests__/inputs.test.tsx"
  modified:
    - "pnpm-workspace.yaml"
    - "pnpm-lock.yaml"
    - "packages/libs/editor-impl/package.json"
    - "packages/libs/editor-impl/src/table/model/index.ts"
    - "packages/libs/editor-impl/src/table/components/index.ts"
    - "packages/libs/editor-impl/src/table/components/inputs/index.ts"
    - "packages/libs/editor-impl/src/table/table.css"

key-decisions:
  - "ajv 通过 catalog 固定为 8.20.0 并以 catalog:default 引入 editor-impl；`pnpm install --offline` 成功（8.4s）——未走网络，规避了代理挂起风险"
  - "validateValue 用单次断言 `schema as SchemaObject` 跨过 json-schema-typed 的 JSONSchema.Interface（无索引签名）与 ajv 的 SchemaObject（有索引签名）之间的 FFI 边界；只此一处，且非连续 as"
  - "TextareaInput 把空白文本视为 null 提交（而非解析失败），使「清空即提交空值」成立，交由上层按 schema 决定是否接受"
  - "ColorInput 仅依据源值是否有四通道决定是否回写 alpha（严格按本计划 must_have），不沿用旧实现里「alpha≠1 也保留」的附加条件"
  - "SelectInput 关闭虚拟滚动（virtual={false}）：enum 选项数量小，且使下拉项可在 jsdom 下稳定渲染为可点的 DOM"
  - "traversal.ts 无需改动：控件推导所需的逐行 schema 节点在 02-04 已作为 ITableRowNode.config 挂好"

patterns-established:
  - "校验边界：字段值校验只依赖字段自己的 JSON Schema 节点 + ajv，不引入任何表达式求值器（IValueEvaluator 已废弃，D-22）"
  - "控件选择：标准关键字优先、x-control 兜底；schema 缺失时统一回退为文本（D-29）"

requirements-completed: [TABLE-01]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "字段名校验候选实现：非空、白名单字符集（放行文本时豁免）、不重名，各分支返回中文错误信息"
    requirement: "TABLE-01"
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/validation.test.ts#validateId"
        status: pass
    human_judgment: false
  - id: D2
    description: "值校验：以 ajv 对字段的标准 JSON Schema 节点做声明式校验（含 enum 成员关系）；缺省 schema 无约束；validateValue(schema, null) 即删除许可"
    requirement: "TABLE-01"
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/validation.test.ts#validateValue"
        status: pass
    human_judgment: false
  - id: D3
    description: "行内控件推导：enum→Select、boolean→Checkbox、array→MultiSelect、number/integer→Number、其余与缺省→Text，x-control 优先"
    requirement: "TABLE-01"
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/inputs.test.tsx#inferControlKind"
        status: pass
    human_judgment: false
  - id: D4
    description: "五个行内控件：文本域（失焦解析 JSON、解析失败回退原值、空白→null）、下拉（enum 选项）、复选框、多选框组（保留未知成员）、颜色（按源通道数回写 3/4 通道）"
    requirement: "TABLE-01"
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/inputs.test.tsx#TextareaInput / SelectInput / CheckboxInput / CheckboxSet / ColorInput"
        status: pass
    human_judgment: false
  - id: D5
    description: "高于一行的值渲染为可滚动文本域：随内容增长到最大高度后内部滚动（CSS 行为）"
    verification: []
    human_judgment: true
    rationale: "纯 CSS/视觉行为（table.css 的 max-height + overflow + field-sizing），自动化测试只能钉住 DOM/值，无法证明实际滚动手感；属 must_have 的 backstop 项"

# Metrics
duration: 16min
completed: 2026-10-12
status: complete
---

# Phase 2 Plan 06: 校验模型与行内输入控件 Summary

**用 ajv 对字段的标准 JSON Schema 节点做声明式校验，并按标准关键字（x-control 兜底）推导、落地五个行内输入控件——编辑器内不存在任何表达式求值**

## Performance

- **Duration:** 16 min
- **Started:** 2026-10-12T15:48:00Z
- **Completed:** 2026-10-12T16:04:50Z
- **Tasks:** 3
- **Files modified:** 16 (10 created, 6 modified)

## Accomplishments

- 新增 `validateValue`：在函数内构造 `Ajv2020({ strict: false, allErrors: true })`，编译字段的 `ITableSchemaNode` 并校验；`enum` 额外强制成员关系；schema 缺省视为无约束。删除许可即 `validateValue(schema, null)` 为真。
- 新增 `validateId`：复刻旧表格的字段名规则（非空 / `[a-zA-Z0-9_]`（放行文本时豁免）/ 不重名），返回带中文错误信息的结果；恶意名（如 `constructor.prototype`、含 `\0`）被字符集拦下（缓解 T-02-15）。
- 新增 `inferControlKind`：`x-control` 优先，否则 `enum`→Select、`boolean`→Checkbox、`array`→MultiSelect、`number`/`integer`→Number、其余（含 schema 缺失）→Text。
- 新增五个行内控件：JSON 文本域（失焦解析、解析失败回退、空白→null）、下拉（enum 选项）、复选框、多选框组（保留值里的未知成员）、颜色（源三通道回写 `[r,g,b]`，源四通道回写 `[r,g,b,a]`）。
- 新增依赖仅 ajv（catalog 固定 8.20.0）；新增 31 个测试（12 + 19）；editor-impl 全量 40 个测试、editor-core 58 个测试全绿。

## Task Commits

Each task was committed atomically:

1. **Task 1: Validation model (pure) over JSON Schema** - `f7358ea` (feat)
2. **Task 2: Control inference + the five inline input controls** - `c5dd60d` (feat)
3. **Task 3: Test the input behaviour and the control mapping** - `84fe253` (test)

**Plan metadata:** (docs commit — see final commit)

## Files Created/Modified

- `packages/libs/editor-impl/src/table/model/validation.ts` - `validateId`（字段名规则）+ `validateValue`（ajv 声明式值校验）。
- `packages/libs/editor-impl/src/table/model/control.ts` - `inferControlKind`（标准关键字推导 + `x-control` 兜底）。
- `packages/libs/editor-impl/src/table/components/inputs/TextareaInput.tsx` - JSON 文本域（失焦解析、失败回退、空白→null）。
- `packages/libs/editor-impl/src/table/components/inputs/SelectInput.tsx` - 基于字段 `enum` 的下拉。
- `packages/libs/editor-impl/src/table/components/inputs/CheckboxInput.tsx` - 布尔复选框。
- `packages/libs/editor-impl/src/table/components/inputs/CheckboxSet.tsx` - 数组多选组（保留未知成员）。
- `packages/libs/editor-impl/src/table/components/inputs/ColorInput.tsx` - antd ColorPicker（按源通道数回写 3/4 通道）。
- `packages/libs/editor-impl/src/table/components/inputs/index.ts` - 输入控件桶（`export *`）。
- `packages/libs/editor-impl/src/table/__tests__/validation.test.ts` - `validateId` / `validateValue` 全部候选分支（含恶意名）。
- `packages/libs/editor-impl/src/table/__tests__/inputs.test.tsx` - 五个控件的行为 + `inferControlKind` 全分支。
- `packages/libs/editor-impl/src/table/model/index.ts` / `components/index.ts` - 追加对新模块的桶导出。
- `packages/libs/editor-impl/src/table/table.css` - 文本域填充单元格 / 内部滚动、下拉宽度、多选组换行的样式类。
- `pnpm-workspace.yaml` / `pnpm-lock.yaml` / `packages/libs/editor-impl/package.json` - catalog 新增 `ajv: 8.20.0`，editor-impl 以 `catalog:default` 依赖。

## Decisions Made

- ajv 固定 8.20.0 并走 `pnpm install --offline` 安装（成功，8.4s）：包已在本地 store 与 lockfile 中，完全不作网络请求，规避了计划里提示的代理挂起风险。
- `validateValue` 用单次断言 `schema as SchemaObject` 跨越 `JSONSchema.Interface`（无索引签名）与 ajv `SchemaObject`（有索引签名）的第三方类型边界；这是唯一一处 `as`，且非连续 `as`。
- `TextareaInput` 把空白文本按 `null` 提交（不是解析失败），使「清空即提交空值、是否接受交给 schema」成立。
- `ColorInput` 严格按 must_have：仅当源值为四通道时回写 alpha，不采纳旧实现里「alpha≠1 也保留」的附加条件。
- `SelectInput` 设 `virtual={false}`：enum 选项量小，且使下拉项在 jsdom 下稳定渲染为可点 DOM。
- `traversal.ts` 保持不变：控件推导所需的逐行 schema 节点在 02-04 已挂为 `ITableRowNode.config`。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 追加输入控件与模型桶导出（`model/index.ts`、`components/inputs/index.ts`、`components/index.ts`）**
- **Found during:** Task 2
- **Issue:** 计划 files_modified 未列出桶文件；但新模块需经 `./table` 公开面暴露给第三方（D-01），否则 `export *` 约定链断裂。
- **Fix:** 新增 `model/index.ts` 追加 `control` / `validation`；新增 `components/inputs/index.ts`；`components/index.ts` 追加 `./inputs`。
- **Verification:** `pnpm --filter @motajs/editor-impl typecheck` 与 test 均退出 0。
- **Committed in:** `c5dd60d`（Task 2 commit）

**2. [Rule 3 - Blocking] 在 `table.css` 补充控件样式类**
- **Found during:** Task 2
- **Issue:** must_have 的 backstop 要求文本域填充单元格并在超过最大高度后内部滚动；计划未列出 `table.css`。
- **Fix:** 追加 `.etable-input-textarea`（含 `field-sizing: content` + `max-height` + `overflow: auto`）、`.etable-input-select`、`.etable-input-checkbox-set`。
- **Files modified:** `packages/libs/editor-impl/src/table/table.css`
- **Committed in:** `c5dd60d`（Task 2 commit）

**3. [Rule 3 - Blocking] 测试内注入 `ResizeObserver` 打桩**
- **Found during:** Task 3
- **Issue:** antd Select / ColorPicker 依赖 `ResizeObserver`，而 jsdom 未实现；不注入则渲染即抛 `ReferenceError`。
- **Fix:** 在 `inputs.test.tsx` 模块顶部定义最小 `ResizeObserverStub` 并赋给 `globalThis.ResizeObserver`（测试树不受 module-state 门禁约束；未使用被禁全局 `document`）。
- **Files modified:** `packages/libs/editor-impl/src/table/__tests__/inputs.test.tsx`
- **Committed in:** `84fe253`（Task 3 commit）

---

**Total deviations:** 3 auto-fixed (3 blocking)
**Impact on plan:** 三处均为让计划可用/可验证的必要改动，无功能范围蔓延。`traversal.ts` 按计划保持未改。

## Issues Encountered

- antd 的 Select / ColorPicker 在 jsdom 下依赖 `ResizeObserver`（`@rc-component/resize-observer` 直接 `new ResizeObserver`），jsdom 未实现 → 以测试内打桩解决（见偏差 3）。
- ESLint 的 `no-restricted-globals` 同样覆盖测试树，最初用 `document.querySelector` 触达 antd 浮层被拦下 → 改为 `screen.getByTitle` / `screen.getAllByRole('spinbutton')` 与 `container.querySelector` 后通过。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 02-07 可在 `TableRow` 里用 `inferControlKind(row.config)` 选控件、用 `validateValue(row.config, value)` 决定提交 / 删除许可（删除许可 = `validateValue(config, null)`）。
- 02-08 的 schema 呈现模式可复用 `TableControlKind.Number`（本阶段无独立数字控件，按计划映射到 JSON 文本域）。
- 无阻塞项。

---

**Verification evidence**

- `pnpm --filter @motajs/editor-impl typecheck` → exit 0
- `pnpm --filter @motajs/editor-impl test` → exit 0（3 个测试文件、40 个用例；其中 `validation.test.ts` 12 个、`inputs.test.tsx` 19 个、`tracer.test.tsx` 9 个）
- `pnpm --filter @motajs/editor-core test` → exit 0（6 个测试文件、58 个用例全绿，保持不回归）
- `node scripts/verify/coreImportType.js` → exit 0（真实树扫描 60 个源码文件、0 条 `import type`）
- `node scripts/verify/coreEngineNeutral.js` → exit 0（48 个生产文件、0 条引擎词汇）
- `node scripts/verify/coreModuleState.js` → exit 0（真实树 lint 0 条 error 级受限规则）
- `node scripts/verify/coreFsSurface.js` → exit 0（`IEditorFileSystem` 仅出现在声明文件）
- 四个门禁脚本按要求**串行**运行。
- `gro` 检查：`src/table` 全树无 `eval(` / `new Function` / `IValueEvaluator`（0 命中）。

## Self-Check: PASSED

---
*Phase: 02-table*
*Completed: 2026-10-12*
