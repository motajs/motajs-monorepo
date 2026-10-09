# Phase 1: Baseline & Verification Net - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-20
**Phase:** 1-Baseline & Verification Net
**Areas discussed:** CI 门禁范围, 基线产物形态, 特性化测试, 单测与 submodule

---

## CI 门禁范围

| Option | Description | Selected |
|--------|-------------|----------|
| lint + typecheck + unit + build | 四层全覆盖；保证构建产物/manifest/MPA 形态不变 | ✓ |
| lint + typecheck + unit | 跳过生产构建，更快但漏构建期问题 | |
| 四层 + e2e | 覆盖最全但 PR 最慢、成本最高 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 所有 workspace 包 | 统一；覆盖跨包回归 | ✓ |
| 仅两个 app | 快，但 libs 回归不捕获 | |
| affected only | 最快但配置复杂、易漏 | |

| Option | Description | Selected |
|--------|-------------|----------|
| PR + push main，独立 ci.yml | 与手动部署 workflow 分离 | ✓ |
| 仅 pull_request | 最省，main 无验证 | |
| 扩展现有 workflow | 不新建文件，但部署与验证耦合 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 阻塞合并 | 安全网成为硬约束 | ✓ |
| 先 advisory 再收紧 | 跑通后设 required | |
| 部分阻塞 | typecheck+build 阻塞，lint+unit advisory | |

**User's choice:** 四层（含 build，不含 e2e）；所有 workspace 包；PR + push main 独立 `ci.yml`；阻塞合并
**Notes:** 本重构需保证构建产物/manifest/MPA 形态不变，因此 build 门禁不可省。

---

## 基线产物形态

| Option | Description | Selected |
|--------|-------------|----------|
| 全量记录 | 单测计数 + e2e + 构建 + 体积 + manifest + 协议常量 + 截图 | ✓ |
| 核心指标 | 只记关键指标，轻量 | |
| JSON 快照为主 | 机器可读 JSON diff，截图另存 | |

| Option | Description | Selected |
|--------|-------------|----------|
| `.planning/baseline/` | 里程碑级，随代码版本化 | ✓ |
| phase 目录内 | 与阶段产物在一起 | |
| 仅 CI artifact | 仓库干净但难长期参照 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 提交入库作为比对基线 | 后续阶段可直接视觉比对 | ✓ |
| 仅 CI artifact | 不占仓库 | |
| 本地生成即可 | 不入库不上传 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 人工对照 | 本阶段只建基线，后续人工比对 | ✓ |
| 自动比对脚本 | 本阶段就写 diff 工具 | |
| CI 自动比对告警 | 最强但超范围 | |

**User's choice:** 全量记录；存 `.planning/baseline/`；截图入库；后续人工对照
**Notes:** 无

---

## 特性化测试

| Option | Description | Selected |
|--------|-------------|----------|
| 新增独立特性化套件 | 现有测试不动，冻结语义更明确 | ✓ |
| 扩展现有测试文件 | 集中，但易被一起改掉 | |
| 只补边界用例 | 最省 | |

| Option | Description | Selected |
|--------|-------------|----------|
| co-located `__tests__/` | 贴近模块，迁移时随迁、仅改 import | ✓ |
| `test/characterization/` | 独立冻结契约套件，视觉显眼 | |
| `src/characterization/` | 跨 fs 与 history 共用 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 仅 REQ 列出的不变量 | 避免过拟合实现细节 | ✓ |
| 不变量 + 完整快照 | 更严但脆弱 | |
| 最小关键路径 | 只冻结 error→retry→idle 与 rollback | |

| Option | Description | Selected |
|--------|-------------|----------|
| 视为回归，修实现 | 纯重构，红了就改实现而非断言 | ✓ |
| 允许例外评审 | 确认原测试写错时可修正 | |
| 标记 skip 继续 | 有静默放过风险 | |

**User's choice:** 独立套件；co-located `__tests__/`；仅冻结 REQ 不变量；失败视为回归、修实现
**Notes:** 无

---

## 单测与 submodule

| Option | Description | Selected |
|--------|-------------|----------|
| unit 脱离 submodule | 修加载期抛错，unit 用内存 FS；e2e 仍要求 submodule | ✓ |
| 统一要求 submodule | 关系简单，但贡献者与 lite CI 必须先 checkout | |
| setup 注入兜底值 | 不改 config 加载逻辑 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 拆分独立 vitest.config.ts | editor 当前 test block 与 dev/build 共用 | ✓ |
| 惰性化 resolveMotaJsRoot | 改动更小 | |
| setup 注入兜底目录 | 不动 config 结构 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 按 job 区分 | unit 不取，build/e2e 取 recursive | ✓ |
| 全部 job 统一取 | 配置简单但每 job 多一步 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 改为必需 fixture，缺则 fail | 保证 e2e 结果可信 | ✓ |
| 保留 skip + 可见标记 | 只让跳过可见 | |
| 暂不处理 | 记录为已知问题 | |

**User's choice:** unit 脱离 submodule；拆独立 `vitest.config.ts`；CI 按 job 区分；e2e skip 改为必需 fixture
**Notes:** `mota-js` submodule 由用户后续补上；`MOTA_JS_ROOT` 对 dev/build 仍必需。

---

## the agent's Discretion

- 截图基线的生成方式（Playwright 脚本 vs 手动）
- `BASELINE.md` 字段清单与快照 JSON schema
- `ci.yml` 的 job 划分、缓存与并发策略
- `VERIFY-07` 协议不一致断言的具体写法（硬约束：不得修改 `3`/`4` 两个值）

## Deferred Ideas

- 自动 JSON/图像 diff 与 CI 视觉回归告警
- 覆盖率阈值与覆盖率上报
- 将 e2e 纳入 PR CI
- 修复 `fs.postData` 错误吞没、`runtimeProtocolVersion` 漂移等既有缺陷
