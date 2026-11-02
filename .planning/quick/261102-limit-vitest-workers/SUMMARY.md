---
quick_id: 261102-l54
slug: 261102-limit-vitest-workers
date: 2026-11-02
subsystem: testing
tags: [vitest, maxWorkers, concurrency, ci, flaky-timeout]

# Actuals (#2632) — 与计划的 estimate 同尺度（chars/4，不是 harness token 计数）
# 口径：`git show 872150d` 的完整 diff 3665 字符 ÷ 4
actuals:
  tokens: 916
  tasks: 3
  commits: 1

tech-stack:
  added: []
  patterns:
    - '每个包的 vitest 配置都用同一条 `maxWorkers: '"'"'50%'"'"'` 限流，策略统一，不按「常用包」区别对待'
    - '只限「单个包内」的并发；整仓 `pnpm -r run test` 的跨包并发不在本计划范围内'

key-files:
  created: []
  modified:
    - packages/apps/editor/vitest.config.ts
    - packages/apps/editor-dev/vitest.config.ts
    - packages/apps/service-worker/vitest.config.ts
    - packages/libs/editor-core/vitest.config.ts
    - packages/libs/editor-impl/vitest.config.ts
    - packages/libs/h5animate/vitest.config.ts
    - packages/libs/packer/vitest.config.ts
    - packages/libs/react-monaco-editor/vitest.config.ts

key-decisions:
  - '用 `maxWorkers`，不用 `poolOptions.forks.maxForks` / `poolOptions.threads.maxThreads`：前者对池类型无感，后两者一旦换池就静默失效'
  - '用百分比 `50%` 而不是写死数字：本机 16 核得到 8 个 worker，4 核笔记本得到 2 个，换机器不用改配置'
  - '不设 `fileParallelism: false`（会把 worker 压成 1，等于全串行），不设 `minWorkers`，不动 `pool`，不调任何 `testTimeout`'

requirements-completed: []

coverage:
  - id: D1
    description: '八个 `packages/**/vitest.config.ts` 都只多出首行 `maxWorkers: '"'"'50%'"'"'`，解析后等于 round(核数 × 0.5)'
    verification:
      - kind: other
        ref: 'node --input-type=module -e "…createVitest…" 配置解析探针：改前 8/8 MISMATCH（undefined），改后 8/8 OK（maxWorkers=8, pool=forks）'
        status: pass
      - kind: other
        ref: 'pnpm exec prettier --check <八个配置>'
        status: pass
    human_judgment: false
  - id: D2
    description: '限流后三个门禁包（editor-core / editor-impl / editor-dev）测试与类型检查全绿，wall-clock 增幅可接受'
    verification:
      - kind: unit
        ref: 'pnpm --filter @motajs/editor-core --filter @motajs/editor-impl --filter @motajs/editor-dev test'
        status: pass
      - kind: other
        ref: 'pnpm --filter @motajs/editor-core --filter @motajs/editor-impl --filter @motajs/editor-dev typecheck'
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-11-02
status: complete
---

# Quick Task 261102-l54: 限制 vitest worker 并发 Summary

**八个 vitest 配置统一加了一条 `maxWorkers: '50%'`，本机 16 核从最多 15 个 worker 降到 8 个；三个门禁包全绿，合计耗时只从 156.5 秒涨到 169.3 秒（1.08 倍）。**

## Performance

- **Duration:** 10 min
- **Started:** 2026-11-02T15:17Z
- **Completed:** 2026-11-02T15:27Z
- **Tasks:** 3
- **Files modified:** 8（全部只加 1 行）

## Accomplishments

- 八个 `vitest.config.ts` 的 `test: {}` 块首行各新增一行 `maxWorkers: '50%',`，其余内容一字未动。
- 配置解析探针从改前「8/8 MISMATCH」变为改后「8/8 OK」：`maxWorkers=8`（`round(16 × 0.5)`），`pool=forks` 未变。
- 三个门禁包测试与类型检查全部通过，此前偶发超时的 `devHostTable` 撤销用例与 `devHostMap` 画格用例本次前后两轮都通过。
- Prettier 检查八个文件全绿。

## Task Commits

1. **Task 1: 改动前基线测量**（只读，无提交）
2. **Task 2: 八个配置加 `maxWorkers: '50%'`** — `872150d` (chore)
3. **Task 3: 复跑门禁包与类型检查**（只读，无提交）

## 前后耗时对比（本机 16 核，vitest 4.0.18）

| 包 | 改前 | 改后 | 倍数 |
| --- | --- | --- | --- |
| `@motajs/editor-core` | 8.56s | 8.34s | 0.97× |
| `@motajs/editor-impl` | 120.54s | 129.99s | 1.08× |
| `@motajs/editor-dev` | 27.43s | 30.92s | 1.13× |
| **合计** | **156.53s** | **169.25s** | **1.08×** |

远低于计划给的可接受上限 2.5 倍；`editor-impl` 停留在一分多钟量级，`editor-dev` 多出的约 3.5 秒属于并发减半的必然代价。

## 验证证据

- **配置解析探针（改前）：** 八个包全部 `maxWorkers=undefined (expected 8, pool=forks) MISMATCH`，`MISMATCH count=8`，退出码 1。
- **配置解析探针（改后）：** 八个包全部 `maxWorkers=8 (expected 8, pool=forks) OK`，退出码 0。
- **Prettier：** `All matched files use Prettier code style!`，退出码 0。
- **测试：**

| 包 | 文件 | 用例 |
| --- | --- | --- |
| `@motajs/editor-core` | 26 passed | 191 passed |
| `@motajs/editor-impl` | 101 passed | 1181 passed |
| `@motajs/editor-dev` | 13 passed | 111 passed |

  三个包 `vitest run` 退出码均为 0，没有出现 `No test files found`。
- **类型检查：** 三个包 `tsc -b` 均退出 0。

## Files Created/Modified

- `packages/apps/editor/vitest.config.ts` — `test` 块首行加 `maxWorkers: '50%'`
- `packages/apps/editor-dev/vitest.config.ts` — 同上
- `packages/apps/service-worker/vitest.config.ts` — 同上
- `packages/libs/editor-core/vitest.config.ts` — 同上
- `packages/libs/editor-impl/vitest.config.ts` — 同上
- `packages/libs/h5animate/vitest.config.ts` — 同上
- `packages/libs/packer/vitest.config.ts` — 同上（原有 `testTimeout: 30000` 原样保留）
- `packages/libs/react-monaco-editor/vitest.config.ts` — 同上

## Decisions Made

- **选 `maxWorkers` 而非 `poolOptions.*`：** 当前 vitest 4.0.18 的类型是 `maxWorkers?: number | string`，百分比字符串在配置解析阶段被折算成整数；`poolOptions.forks.maxForks` / `poolOptions.threads.maxThreads` 是分池的，将来把默认 `pool` 从 `forks` 换掉就会静默失效。现状没有任何配置显式设置 `pool`，默认即 `forks`，所以只加 `maxWorkers` 就能覆盖。
- **选百分比而非写死数字：** 同一条配置在不同机器上自动折算，4 核笔记本得到 2 个 worker，16 核机器得到 8 个。

## Deviations from Plan

None - 计划按原文执行。基线一轮恰好没有复现两个已知超时用例（`devHostTable` 撤销 1034ms、`devHostMap` 画格 2047ms 均通过），因此「改前」是一份干净的基线；未做任何重试或放宽超时。

## Issues Encountered

None。唯一需要说明的是：`pnpm` 在 PowerShell 下把 `$ tsc -b` 写到 stderr，会显示 `NativeCommandError` 红字，但三个 `tsc -b` 的退出码都是 0，属于 pnpm 在该 shell 下的正常输出行为。

## Next Phase Readiness

- 单个包内的并发已经封顶在核数的一半，不再把机器跑满。
- 整仓 `pnpm -r run test` 的跨包并发（pnpm workspace 并发）本次未改；若将来要压住整仓总进程数，应另开计划调 `--workspace-concurrency`。
- 结论绑定已安装的 vitest 4.0.18（catalog `^4.0.16`）；若日后大版本不再接受字符串形式，配置解析探针或 `typecheck` 会立刻报出来，届时改成纯数字并按核数手算。

## Self-Check: PASSED

- 八个配置文件均存在且各含一行 `maxWorkers: '50%'`（配置解析探针 8/8 OK）。
- 提交 `872150d` 存在于 `git log`。
- 三个门禁包测试与类型检查退出码均为 0。

---

*Quick Task: 261102-limit-vitest-workers*
*Completed: 2026-11-02*
