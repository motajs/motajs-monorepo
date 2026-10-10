---
phase: 01-shell
plan: 01
subsystem: editor-core
tags: [typescript, interfaces, editor-core, shell, fs, react]

# Dependency graph
requires: []
provides:
  - "editor-core 面板类型契约：IEditorPanelType、EditorPanelFactory"
  - "editor-core 浏览器式外壳契约：IShellSystem、IShellInjection、IEditorMenuItem、IEditorTab"
  - "editor-core 通用 fs 契约：IEditorFileSystem（只声明、不实现、不引用）"
  - "包根公开面：src/index.ts 新增 ./shell 与 ./fs 导出"
  - "shell.* 日志 id（7 条）"
affects: [01-02 外壳实现, 01-03 外壳样式, 01-04 fs 面门禁, editor-impl]

actuals:
  tokens: 1653
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "接口族 + 逐成员/逐方法 jsDoc（接口本身不写 jsDoc，type 别名要写）"
    - "空注入接口 IShellInjection 供 IEditorCoreInjection 多重 extends"
    - "纯类型声明、零实现体：先接口后实现"

key-files:
  created:
    - packages/libs/editor-core/src/shell/types.ts
    - packages/libs/editor-core/src/shell/index.ts
    - packages/libs/editor-core/src/fs/types.ts
    - packages/libs/editor-core/src/fs/index.ts
  modified:
    - packages/libs/editor-core/src/panel/types.ts
    - packages/libs/editor-core/src/index.ts
    - packages/libs/editor-core/src/log/messages.ts

key-decisions:
  - "外壳契约用单一 IShellSystem 统管面板类型注册 / 实例生命周期 / 标签 / 菜单（不拆 IPanelSystem + 独立外壳系统）"
  - "IEditorFileSystem 只声明六个方法（读/写/列目录/建目录/移动/删除），全返回 Promise，只定义不实现不引用"
  - "IShellSystem 不 extends IUndoable —— 标签导航不进撤销历史"
  - "保留既有 IEditorPanel / IEditorPanelContext / EditorPanelCreator / IPanelSystem / PanelUndoType，纯追加不删除"

patterns-established:
  - "接口成员默认 readonly；方法 jsDoc 换行式逐 @param；type 别名写 jsDoc"
  - "桶文件仅 export *，无注释，不跨目录深路径转发"
  - "core 源码全程无 import type / 无引擎术语 / 无模块级可变绑定"

requirements-completed: [SHELL-01, CORE-01]

coverage:
  - id: D1
    description: "面板类型契约（IEditorPanelType + EditorPanelFactory）已声明并经 panel 桶导出"
    requirement: "SHELL-01"
    verification:
      - kind: automated
        ref: "pnpm --filter @motajs/editor-core typecheck (tsc -b)"
        status: pass
      - kind: automated
        ref: "node scripts/verify/coreImportType.js"
        status: pass
    human_judgment: false
  - id: D2
    description: "外壳契约（IShellSystem / IShellInjection / IEditorMenuItem / IEditorTab）已声明并经 shell 桶导出"
    requirement: "SHELL-01"
    verification:
      - kind: automated
        ref: "pnpm --filter @motajs/editor-core typecheck (tsc -b)"
        status: pass
      - kind: automated
        ref: "node scripts/verify/coreEngineNeutral.js"
        status: pass
    human_judgment: false
  - id: D3
    description: "通用 fs 契约（IEditorFileSystem）已声明并只经 fs 桶与包根导出；7 条 shell.* 日志 id 已追加"
    requirement: "CORE-01"
    verification:
      - kind: automated
        ref: "pnpm --filter @motajs/editor-core typecheck (tsc -b)"
        status: pass
      - kind: automated
        ref: "node scripts/verify/coreModuleState.js"
        status: pass
    human_judgment: false

duration: 3min
completed: 2026-10-10
status: complete
---

# Phase 1 Plan 01: 编辑器外壳与通用 fs 接口（接口定义）Summary

**editor-core 新增三组引擎无关接口——面板类型契约、浏览器式外壳契约、通用 fs 契约——全部为纯类型声明、经包根可导入，无任何实现体**

## Performance

- **Duration:** 约 3 min
- **Started:** 2026-10-10T09:54Z (approx)
- **Completed:** 2026-10-10T09:57Z
- **Tasks:** 3
- **Files modified:** 7（4 新增 / 3 修改）

## Accomplishments
- 面板类型契约：`IEditorPanelType`（`id`/`name`/`icon`/`create`，全 readonly）与 `EditorPanelFactory`（`(context, instanceId) => Promise<IEditorPanel>`）——承载 D-08 / D-09。
- 浏览器式外壳契约：`IShellSystem`（16 个方法：面板类型注册、实例生命周期、标签状态机、菜单项、渲染根、释放）、`IShellInjection`、`IEditorMenuItem`、`IEditorTab`。
- 通用 fs 契约：`IEditorFileSystem` 六个方法（读/写/列目录/建目录/移动/删除），**只声明、不实现、不引用**（D-13）。
- 包根公开面扩展：`src/index.ts` 追加 `export * from './shell'` 与 `export * from './fs'`；`log/messages.ts` 追加 7 条 `shell.*` 日志 id。
- 遵守「先接口、后实现」：本计划无任何函数体 / 类方法体 / 渲染逻辑 / 注册表状态。

## Task Commits

Each task was committed atomically:

1. **Task 1: 面板类型契约（panel/types.ts，追加式）** - `13e41ea` (feat)
2. **Task 2: 外壳契约（shell/types.ts + shell/index.ts）** - `f7c7aa3` (feat)
3. **Task 3: 通用 fs 契约 + 日志 id + 包根导出** - `4a7f011` (feat)

**Plan metadata:** 本次 SUMMARY 提交（docs: complete plan）

_Note: 无 TDD 任务，无多提交。_

## Files Created/Modified
- `packages/libs/editor-core/src/panel/types.ts` - 追加 `IEditorPanelType`、`EditorPanelFactory`；`ReactNode` 改为普通 import
- `packages/libs/editor-core/src/shell/types.ts` - 新增外壳契约 `IShellSystem` / `IShellInjection` / `IEditorMenuItem` / `IEditorTab`
- `packages/libs/editor-core/src/shell/index.ts` - 新增，仅 `export * from './types';`
- `packages/libs/editor-core/src/fs/types.ts` - 新增通用 fs 契约 `IEditorFileSystem`
- `packages/libs/editor-core/src/fs/index.ts` - 新增，仅 `export * from './types';`
- `packages/libs/editor-core/src/index.ts` - 追加 `./shell`、`./fs` 导出
- `packages/libs/editor-core/src/log/messages.ts` - 追加 7 条 `shell.*` 日志 id

## Decisions Made
- 采用**单一** `IShellSystem` 统管面板类型 / 实例 / 标签 / 菜单（对应规划假设 A5）。
- `IShellSystem` 不 extends `IUndoable`——标签导航不进撤销历史（A7 / UI-SPEC resolved A2）。
- `IEditorFileSystem` 六方法命名采用 `listDirectory` / `makeDirectory`（对应 A2）。
- 保留既有 `IEditorPanel` / `IEditorPanelContext` / `EditorPanelCreator` / `IPanelSystem` / `PanelUndoType`，纯追加不删除，保证 `typecheck` 与现有 45 用例不回归。

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- 发现 `.git/gsd-plan-head-before-01-01` 存在上一次运行的陈旧基线（指向 402 个提交之前）。执行前已将基线重置为本次计划起点 `1524edf`，故 SUMMARY 的 `commits: 3` 由 `git rev-list --count 1524edf..HEAD` 实测得出，真实反映本计划提交数。

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 三组接口已定并经包根可导入，后续 01-02（`ShellSystem` 实现）、01-03（外壳样式）、01-04（fs 面门禁）可在其之上推进。
- 待用户确认：`INTERFACE-NAME.md` 中 Plan 01 的全部命名与 A2/A5 假设（`listDirectory`/`makeDirectory`、单一 `IShellSystem`）。
- 本计划**未**运行 `node scripts/verify/coreFsSurface.js`（由 01-04 创建并运行）。

## Verification Evidence
- `pnpm --filter @motajs/editor-core typecheck`（`tsc -b`）→ 退出 0。
- `pnpm --filter @motajs/editor-core test` → 5 文件 / 45 用例全绿。
- `node scripts/verify/coreImportType.js` → 真实树 32 文件、0 条 `import type`；两极性成立。
- `node scripts/verify/coreEngineNeutral.js` → 真实树 26 生产文件、0 条引擎术语；两极性成立。
- `node scripts/verify/coreModuleState.js` → 真实树 0 条 error 级受限规则；组合根与测试树豁免成立；PORT-02 成立。
- T-01-01 不变量：仓库源码中 `IEditorFileSystem` 仅出现在 `fs/types.ts`，无 `implements` / 调用。

## Self-Check: PASSED

---
*Phase: 01-shell*
*Completed: 2026-10-10*
