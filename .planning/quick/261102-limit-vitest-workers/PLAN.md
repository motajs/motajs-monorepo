---
quick_id: 261102-l54
slug: 261102-limit-vitest-workers
date: 2026-11-02
files_modified:
  - packages/apps/editor/vitest.config.ts
  - packages/apps/editor-dev/vitest.config.ts
  - packages/apps/service-worker/vitest.config.ts
  - packages/libs/editor-core/vitest.config.ts
  - packages/libs/editor-impl/vitest.config.ts
  - packages/libs/h5animate/vitest.config.ts
  - packages/libs/packer/vitest.config.ts
  - packages/libs/react-monaco-editor/vitest.config.ts
autonomous: true
requirements: []
---

<objective>
让仓库里的每个 vitest 配置最多只用一半 CPU 核数的worker，不再把机器跑满。

现在八个 `vitest.config.ts` 都没有设置 `maxWorkers`，vitest 默认按「核数 - 1」开 worker（本机 16 核即 15 个），多个测试进程同时抢 CPU，导致两个老问题——`devHostTable` 的「撤销」和 `devHostMap` 的「画格」——在负载下撞上 vitest 默认 5 秒超时。本计划只做一件事：在全部八个配置里加一条 `maxWorkers: '50%'`（用户已批准：按核数百分比，而不是写死数字）。不改测试、不调超时、不加依赖。

Purpose: 把并发降下来，让本就该通过的用例不再因为抢 CPU 而超时；百分比形式保证 4 核笔记本得到 2 个 worker、16 核 CI 得到 8 个。
Output: 八个 `vitest.config.ts` 各新增一行配置，以及前后耗时的实测对比。
</objective>

<tasks>

<task type="auto">
  <name>Task 1: 先量一次未改动状态下的基线耗时</name>
  <files>(none — read-only measurement)</files>
  <read_first>
    - packages/libs/editor-core/vitest.config.ts
    - packages/libs/editor-impl/vitest.config.ts
    - packages/apps/editor-dev/vitest.config.ts
    - packages/libs/editor-core/package.json（`test` = `vitest run`）
    - packages/libs/editor-impl/package.json（`test` = `vitest run`）
    - packages/apps/editor-dev/package.json（`test` = `vitest run`）
  </read_first>
  <action>
    在**任何文件改动之前**先跑一次三个门禁包，把每个包 vitest 输出末尾的 `Duration` 行、通过/失败用例数、以及本机核数（`node -p "require('node:os').availableParallelism?.() ?? require('node:os').cpus().length"`）原样记进执行汇报。

    这一次跑的是「未限流的现状」，所以两个已知用例（`devHostTable` 撤销、`devHostMap` 画格）可能因为超时失败——这正是要修的症状，不算本任务失败；但如果出现这两个之外的失败，必须原样记录，不要重试掩盖。

    本任务只测量，不改任何文件、不加 `testTimeout`、不提前编辑配置。先把基线写进汇报，再进入 Task 2，否则「前后对比」就没有依据。
  </action>
  <verify>
    <automated>pnpm --filter @motajs/editor-core --filter @motajs/editor-impl --filter @motajs/editor-dev test</automated>
    <fails_when>三个包中任何一个在 vitest 汇总输出之前就中止（配置或模块加载错误，例如 `styled-system` 缺失、`Cannot find module`），或者汇总里出现 `devHostTable` 撤销 / `devHostMap` 画格 之外的失败用例</fails_when>
  </verify>
  <done>三个包的 `Duration` 行和用例统计已记录；本机核数已记录；两个已知用例本次是否超时已记录。</done>
</task>

<task type="auto">
  <name>Task 2: 在八个 vitest 配置里加一条 `maxWorkers: '50%'`</name>
  <files>
    packages/apps/editor/vitest.config.ts
    packages/apps/editor-dev/vitest.config.ts
    packages/apps/service-worker/vitest.config.ts
    packages/libs/editor-core/vitest.config.ts
    packages/libs/editor-impl/vitest.config.ts
    packages/libs/h5animate/vitest.config.ts
    packages/libs/packer/vitest.config.ts
    packages/libs/react-monaco-editor/vitest.config.ts
  </files>
  <read_first>
    - node_modules/vitest/package.json（版本 4.0.18；catalog 声明为 `^4.0.16`）
    - node_modules/vitest/dist/chunks/reporters.d.CWXNI2jG.d.ts（`UserConfig.maxWorkers?: number | string`，注释 "Maximum number or percentage of workers"）
    - node_modules/vitest/dist/chunks/coverage.AVPTjMgw.js（`resolveInlineWorkerOption` 在 resolveConfig 阶段把 `'xx%'` 按 `os.availableParallelism()` 折算成整数并夹到 `[1, 核数]`）
    - 八个目标配置（都已有 `test: { ... }` 块）
    - AGENTS.md（格式以 Prettier 为准：单引号、分号、LF）
  </read_first>
  <action>
    在每个文件的既有 `test: {` 块里，作为**第一行属性**新增且仅新增一行：`maxWorkers: '50%',`（单引号，与 Prettier 配置一致）。八个文件一视同仁——策略统一，而不是只改今天常跑的三个包。

    选型理由（必须写进提交说明/汇报）：用通用的 `maxWorkers`，不用 `poolOptions.forks.maxForks` 或 `poolOptions.threads.maxThreads`。当前 vitest 4.0.18 的类型是 `maxWorkers?: number | string`，百分比字符串在配置解析阶段被 `resolveInlineWorkerOption` 折算为整数（本机 16 核 → 8），因此它既支持百分比又对池类型无感；而 `poolOptions.*` 是分池的，一旦将来把 `pool` 从默认的 `forks` 换成 `threads`/`vmThreads` 就会静默失效。现状没有任何配置显式设置 `pool`，默认即 `forks`，所以只加 `maxWorkers` 即可覆盖。

    明确不要做的事：不要设 `fileParallelism: false`（它会把 `maxWorkers` 强制成 1，等于所有测试文件串行，代价远超本次目标）；不要设 `minWorkers`；不要动 `pool`；不要调高任何 `testTimeout`（`packages/libs/packer/vitest.config.ts` 已有的 30000 保持原样）；不要改测试文件；不要加依赖；不要新增 import；不要重排配置结构。
  </action>
  <verify>
    <automated>node --input-type=module -e "import os from 'node:os'; import { createVitest } from 'vitest/node'; const roots = ['packages/apps/editor','packages/apps/editor-dev','packages/apps/service-worker','packages/libs/editor-core','packages/libs/editor-impl','packages/libs/h5animate','packages/libs/packer','packages/libs/react-monaco-editor']; const cores = os.availableParallelism ? os.availableParallelism() : os.cpus().length; const expected = Math.max(1, Math.round(cores * 0.5)); let bad = 0; for (const root of roots) { const v = await createVitest('test', { root, run: true }); const got = v.config.maxWorkers; const ok = got === expected; if (!ok) bad += 1; console.log(root + ' => maxWorkers=' + got + ' (expected ' + expected + ', pool=' + v.config.pool + ') ' + (ok ? 'OK' : 'MISMATCH')); await v.close(); } if (bad > 0) { console.error('MISMATCH count=' + bad); process.exit(1); }"</automated>
    <fails_when>任何一个包打印 `maxWorkers=undefined`（配置没被读到）或数值不等于 `round(核数 × 0.5)`（打印 `MISMATCH`），或进程以非零码退出；或者某个包打印的 `pool` 不是 `forks`（说明有人顺手改了 pool）</fails_when>
  </verify>
  <verify>
    <automated>pnpm exec prettier --check packages/apps/editor/vitest.config.ts packages/apps/editor-dev/vitest.config.ts packages/apps/service-worker/vitest.config.ts packages/libs/editor-core/vitest.config.ts packages/libs/editor-impl/vitest.config.ts packages/libs/h5animate/vitest.config.ts packages/libs/packer/vitest.config.ts packages/libs/react-monaco-editor/vitest.config.ts</automated>
    <fails_when>Prettier 报出任一文件格式不一致（例如用了双引号，或缩进/换行与仓库 `.prettierrc.json` 不符）</fails_when>
  </verify>
  <done>八个配置各自只多出一行 `maxWorkers: '50%',`；解析后的 `maxWorkers` 在八个包上都等于 `round(核数 × 0.5)`（本机为 8）；`pool` 仍是 `forks`；Prettier 全绿。</done>
</task>

<task type="auto">
  <name>Task 3: 复跑三个门禁包与类型检查，并给出前后耗时对比</name>
  <files>(none — read-only verification)</files>
  <read_first>
    - Task 1 记录的基线 `Duration` 与用例统计
    - Task 2 的解析结果（八个包 `maxWorkers` 均为 8）
    - packages/libs/editor-core/package.json（`typecheck` = `tsc -b`）
    - packages/libs/editor-impl/package.json（`typecheck` = `tsc -b`）
    - packages/apps/editor-dev/package.json（`typecheck` = `tsc -b`）
  </read_first>
  <action>
    用改动后的配置再跑一次三个门禁包，记录每个包的 `Duration` 和用例统计，并与 Task 1 的基线逐包对比，汇报里给出「包名：前 → 后（倍数）」和合计倍数。

    随后跑三个包的 `typecheck`（`tsc -b`），确认这行配置没引入类型错误。

    判定标准：限流后合计耗时增加约 1.3–2.5 倍是可接受的（本机 15 → 8 个 worker，峰值并发约减半）；若某个包超过基线的 2.5 倍，如实报告该倍数和该包的测试文件数，**不要**通过调高百分比或 `testTimeout` 去把数字变好看。若两个已知用例在限流后仍然超时，报告失败的用例名、实际耗时与当时的并发情况，不要重试到绿为止。
  </action>
  <verify>
    <automated>pnpm --filter @motajs/editor-core --filter @motajs/editor-impl --filter @motajs/editor-dev test</automated>
    <fails_when>任一包退出码非零（含 `devHostTable` 撤销 / `devHostMap` 画格 仍超时），或某个包没有输出 vitest 汇总（说明配置加载失败），或输出里出现「No test files found」这类空跑信号</fails_when>
  </verify>
  <verify>
    <automated>pnpm --filter @motajs/editor-core --filter @motajs/editor-impl --filter @motajs/editor-dev typecheck</automated>
    <fails_when>任一包的 `tsc -b` 报错（非零退出）——包括 `maxWorkers` 类型不被接受，说明当前 vitest 版本不支持该写法</fails_when>
  </verify>
  <done>三个门禁包全绿（含此前超时的两个用例）；三个 typecheck 全绿；汇报里有两个包的实测前后耗时与倍数。</done>
</task>

</tasks>

<risks>
- **百分比的分母可能不是「你以为的核数」**：`'50%'` 走 `os.availableParallelism()`，在容器或受限环境里可能返回宿主核数。这仍会按比例减半，但绝对值可能比预期大；执行时以 Task 2 打印出的 `expected` 为准。
- **每个 worker 的默认堆上限会变大**：vitest 用 `1 / maxWorkers` 推算单 worker 的内存上限，worker 变少后单个 worker 能用的堆更大（总量不变）。这是期望内的副作用，不需要额外设置 `vmMemoryLimit`。
- **只约束「单个包内」的并发**：根目录 `pnpm test` 是 `pnpm -r run test`，多个包本身仍会并行跑（pnpm 的 workspace 并发），总进程数约为「工作区并发 × 每包 8」。本计划的验收命令是按包过滤跑的，因此能直接体现限流效果；若将来要压住整仓并发，应另开计划调 `--workspace-concurrency`，不要塞进这次改动。
- **wall-clock 会变长**：这是限流的必然代价，可接受上限按 Task 3 的 2.5 倍判断；超过就如实上报，不用放宽超时来掩盖。
- **版本绑定**：结论基于已安装的 vitest 4.0.18（catalog `^4.0.16`）。若日后升到大版本且 `maxWorkers` 不再接受字符串，`typecheck` 或 Task 2 的解析探针会立刻报出来，届时改成纯数字并按核数手算。
- **不要顺手「优化」**：本计划不处理 `pool` 选择、`fileParallelism`、`sequence` 分组、测试本身的等待逻辑，也不碰 e2e / Playwright 配置。
</risks>
