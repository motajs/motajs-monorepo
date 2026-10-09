# Phase 4: Resource + Edit Layers Moved - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-23
**Phase:** 4-Resource + Edit Layers Moved
**Areas discussed:** 迁移边界（哪些文件真的搬）, per-instance 化与 editor 连续可用, shim / subpath / 新依赖形态, 测试迁移与 core 覆盖率

---

## 迁移边界（哪些文件真的搬）

### Q1. fs 里两个引擎格式 handler（Json2xDataHandler / ScriptDataHandler）

| Option | Description | Selected |
|--------|-------------|----------|
| 留在 editor（core 纯通用） | core 只收通用 DataHandler + JsonDataHandler，不引入 @motajs/file2x | ✓ |
| 搬进 core，Phase 5 再搬出 | 严格按「原样搬」字面，core 暂时携带引擎格式 | |
| 搬进 core 但显式标记待搬出 | 放 legacy 目录 + 门禁标记 | |

**User's choice:** 留在 editor（core 纯通用）
**Notes:** 与 Phase 5「core 只保留 JsonDataHandler」一致。此问题被用户要求重问一次（附详细背景）。

### Q2. history 里 viewport.ts / materialOperations.ts

| Option | Description | Selected |
|--------|-------------|----------|
| 只搬纯机制，viewport/material/楼层导航留 editor | core 只收通用撤销机制 | ✓ |
| 把视口抽象为注入接口搬进 core | 提前视口抽象，Phase 10 直接用 | |
| 只搬 operationHistory，operations 整体留 editor | 最小搬迁 | |

**User's choice:** 用户未直接选项，而是给出设计意见：**「理应只搬基础规则，提供撤销接口，基础规则中记录每个可撤销操作由什么上层提供的系统完成，撤销时规则会逐步调用上层系统的 restore 接口」**。
**Notes:** 据此细化为「可撤销系统注册表」方案（见 Q2b）。

### Q2b. 委托接缝形状

| Option | Description | Selected |
|--------|-------------|----------|
| 方案一：系统注册表 + 操作记录 owner system | UndoSystem { id, capture, restore }，core 按逆序回调 | ✓ |
| 方案二：视口就是一个普通 OperationTarget | 复用现有 target 接缝 | |
| 方案三：core 只给纯栈 + 前后钩子 | core 最简，视口语义落 editor | |

**User's choice:** 方案一：系统注册表 + 操作记录 owner system（推荐）
**Notes:** core 只认识 id + 回调，不认识视口/素材/引擎语义。

### Q3. patchResourceOperation 与 commandOperations 的归属

| Option | Description | Selected |
|--------|-------------|----------|
| 框架 + 字段动作原语都进 core | Action/applyActionsWithInverse/PatchableResource/patchResourceOperation 进 core；commandOperations 留 editor | ✓ |
| core 只收框架，patch/command 全留 editor | 与 ROADMAP 字面最贴合，core 最小 | |
| 连 DataResource/CommandResult 一起搬 | 改动最大，超范围 | |

**User's choice:** 框架 + 字段动作原语都进 core（推荐）
**Notes:** 用户先问「这几个都是用来干什么的？」——已详细解释 Action/applyActionsWithInverse/DataResource/patchResourceOperation/dataResourceTarget/commandOperations 后再提问。

### Q4. 被搬代码消费的文件 I/O 契约

| Option | Description | Selected |
|--------|-------------|----------|
| 消费 Phase 3 的 FsPort | 注入 FsPort，无默认值；editor 传 fs.promises | ✓ |
| core 另定义含 .promises 的 Fs | core 内两个文件 I/O 接口，概念重复 | |
| 改 FsPort 形状为嵌套 | 修改 Phase 3 已交付接口 | |

**User's choice:** 消费 Phase 3 的 FsPort
**Notes:** 用户补充原则：**「editor-core 不应该自己持有任何 fs 实现，它应该仅消费外部提供的 fs 接口。外部可能会提供多种 fs 实现，例如浏览器 FileSystemHandler 实现、HTTP 请求实现、Node 实现等等。」**

---

## per-instance 化与 editor 连续可用

### Q1. core 去单例后，editor 40 处 import 与测试夹具怎么拿到实例

| Option | Description | Selected |
|--------|-------------|----------|
| core 出 class，editor 侧临时应用实例模块 | composition-root-lite，new 一份以旧名导出，Phase 11 删除 | ✓ |
| 提前建 editor 组合根/context | 一步到位，但改动面大、与 Phase 11 重叠 | |
| 每个导入点自己拿实例 | 实例散落，等于隐式单例 | |

**User's choice:** core 出 class，editor 侧临时应用实例模块（推荐）

### Q2. 去单例的范围

| Option | Description | Selected |
|--------|-------------|----------|
| 三个全去单例 | FileHandlerManager/PersistenceMonitor/OperationHistory 都是 class | ✓ |
| 只去 FileHandlerManager | 会撞 D-10 门禁，隔离目标不达成 | |
| 另两个不搬 | 与 RES-04 冲突 | |

**User's choice:** 三个全去单例（推荐）
**Notes:** `FileHandler` 改为构造注入 `PersistenceMonitor`。

### Q3. Phase 2 的 requireZero 门禁在 Phase 4 后失效，怎么处理

| Option | Description | Selected |
|--------|-------------|----------|
| 规则改指剩下 3 个，注释记录变化 | 保留规则连续性；core 无模块实例由 D-10 保证 | ✓ |
| 删掉规则 | 丢掉「单例引用面锁在组合根」的显式意图 | |
| 改为锁 class import | 会误伤合法的类型 import | |

**User's choice:** 规则改指剩下 3 个，注释记录变化（推荐）

---

## shim / subpath / 新依赖形态

### Q1. lib/resources 与 lib/edit 是否新增对外 subpath

| Option | Description | Selected |
|--------|-------------|----------|
| 并入根 `.`，不新增 subpath | 对外保持 7 个，与 EXT-05 一致 | ✓ |
| 新增 ./resources 与 ./edit subpath | 对外面从 7 变 9，与 EXT-05 冲突 | |
| 只新增其中一个 | 不对称，解释成本高 | |

**User's choice:** 并入根 `.`，不新增 subpath（推荐）

### Q2. re-export shim 的粒度与追踪方式

| Option | Description | Selected |
|--------|-------------|----------|
| 逐文件 shim + 标记/verifier 追踪 | 旧路径各留转发文件，`// SHIM(phase4)` + verifier | ✓ |
| 只保留 barrel shim，改写深层 import | shim 少，但要改很多 import | |
| 不建 shim，全部改 import | 与成功标准 5 冲突 | |

**User's choice:** 逐文件 shim + 标记/verifier 追踪（推荐）

### Q3. useOperationHistory（React hook）与 @tanstack/react-store 放哪

| Option | Description | Selected |
|--------|-------------|----------|
| hook 进 ./react，Store 挂实例 | 根 `.` 无 React；@tanstack/react-store 只在 ./react | ✓ |
| hook 留 editor | core 完全无 React，但 hook 要转发/重复 | |
| 根 `.` 直接带 React | 违反分层，非 React 消费者被迫拉 React | |

**User's choice:** hook 进 ./react，Store 挂实例（推荐）
**Notes:** 同时决定 `historyStore`（模块级 Store）挂到 `OperationHistory` 实例，以过 D-10 门禁。

### Q4. BinaryFileHandler 与 JsonDataHandler 怎么处理

| Option | Description | Selected |
|--------|-------------|----------|
| 按 RES-01 字面搬入 | 两者原样进 core | ✓ |
| BinaryFileHandler 暂不搬 | 无消费者，等 Phase 9 | |
| 搬入并抽象 image codec | 与 Phase 9 RasterCodec 部分重叠 | |

**User's choice:** 按 RES-01 字面搬入（推荐）
**Notes:** 用户澄清：**「编辑器 editor-core 本身没必要做成仅支持 node 的，因为编辑器是可视化的……之前说会有 fs node 实现是在 electron 桌面端部署的情况」**——浏览器 API 可接受。

---

## 测试迁移与 core 覆盖率

### Q1. 测试怎么迁移

| Option | Description | Selected |
|--------|-------------|----------|
| 纯内存测试搬 core，submodule 耦合的留 editor | 只改 import、断言不动 | ✓ |
| 不搬测试，全部留 editor | 最保守，但 core 零覆盖 | |
| 两边都建等价测试 | 覆盖最全，但重复且与 D-10 相冲 | |

**User's choice:** 纯内存测试搬 core，submodule 耦合的留 editor（推荐）

### Q2. 内存 fs 夹具怎么处理

| Option | Description | Selected |
|--------|-------------|----------|
| core 自建内存 FsPort，editor 保留现有 | 两份各服务不同接口形状 | ✓ |
| MemoryFileSystem 移到 core，两边共用 | 单一来源，但跨包测试引用改动大 | |
| 新建共享测试工具包 | 超出 Phase 4 边界 | |

**User's choice:** core 自建内存 FsPort，editor 保留现有（推荐）

---

## 讨论外的授权动作

用户要求在 `AGENTS.md` 的 Project Rules 段新增两条规则（已写入，第 510–521 行）：

1. **提问前必须先详细描述问题**（用户对本项目不熟悉，几乎全由 AI 编写）。
2. **网络请求走本地代理 `http://127.0.0.1:7890`**（git fetch / pnpm add 等）。

---

## the agent's Discretion

- 临时应用实例模块的文件名与导出名；core 内存 FsPort 测试替身名；`UndoSystem`/`PatchableResource` 最终命名（须先入 `INTERFACE-NAME.md` 确认）。
- shim 标记文本与 verifier 输出格式。
- `waitUntil` 在 core 内的具体落点。
- `lib/resources` / `lib/edit` 内部文件划分与 barrel 结构。
- catalog 版本取值。

## Deferred Ideas

- 视口抽象搬进 core（Phase 10 可能需要）。
- 删除 shim、临时应用实例模块与 6 个 singleton、组合根切换（Phase 11）。
- `ResourceDescriptor` / `defineEngine` / 引擎侧逻辑 id 描述（Phase 5）。
- 图片/二进制解码抽象 image codec port（Phase 9 若需要）。
- 全仓 lint/cruise 债务清理（Phase 1 已记录）。

## Open Item

- **RES-02 `ResourceRegistry`**：当前源码不存在该名字；本次四个 Area 未覆盖。planner/researcher 须先判定其落点（Phase 4 vs 与 Phase 5 描述符合并）并给出形状。
