# Phase 3: Kernel — Runtime, Ports, Registry, Diagnostics - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-22
**Phase:** 3-Kernel — Runtime, Ports, Registry, Diagnostics
**Areas discussed:** A 注册表 API 形态, B 诊断与启动失败契约, C 生命周期、隔离与版本常量, D 与现有 singleton 的关系、ports 深度、PORT-02 门禁

---

## Process notes (raised by the user during this discussion)

1. **提问前必须先讲清背景。** 用户说明自己是接手项目的、对细节不熟悉，要求每次提问前把问题、背景、名词与各选项的实际后果解释清楚再提问。后续 A2 起均按此执行（A2/B1/B2/B3/B4/C1/C2/C3/C4/D1/D2/D3/D4 均附详解）。
2. **`core` 不是新的全局。** 用户在 A1 质疑「拆分不就是要 per-instance 解耦、不存在全局单例吗，这个 core 又是什么？」——已澄清：`EditorCore` 是组合根创建的对象图，每次 `createEditorCore()` 得独立实例；三个选项皆为 per-instance，差别只在语法与模块结构。
3. **不要把设计框定在 mota-js 上。** 用户明确：「这个任务跟 mota-js 本身的关系并不大」。后续一律改用引擎中性的说法，不拿 `mota.*` 作设计依据。
4. **新增项目规则。** 用户在 A1 要求：为避免歧义，描述类上的方法必须用 `类名.方法名` 格式。已写入 `AGENTS.md` Project Rules 并提交（`1f5640f`）。

---

## A 注册表 API 形态

### A1 — capability registry 的调用形态

| Option | Description | Selected |
|--------|-------------|----------|
| 实例方法 | `EditorCore.registerCapability(kind, id, value, opts)` 等；注册表是实例上的协作者 | ✓ |
| 自由函数（显式传实例） | `registerCapability(editor, kind, id, value, opts)`；registry 可拆独立模块 | |
| 独立对象，不进 EditorCore | 组合根单独创建注册表对象，与其它协作者平级 | |

**User's choice:** 实例方法
**Notes:** 用户先追问「这个接口的作用是什么」，得到「core 的公开扩展面（按 `kind:id` 索引）、为什么需要它、三个接口的职责、具体会注册什么、与私有 service wiring 的区别、在 Phase 3 的位置」的说明后，又追问「这个 core 又是什么、不存在全局单例」，澄清后才选择实例方法，并要求新增 `类名.方法名` 的项目规则。

### A2 — `EditorCore.registerCapability` 的返回值与 rollback 语义

| Option | Description | Selected |
|--------|-------------|----------|
| 同时给 disposer 与 diagnostics | `{ disposer, diagnostics }`；失败无副作用，替换失败还原旧值 | ✓ |
| 只返回 diagnostics | 无法单独撤销一次注册，只能整体 dispose | |
| 只返回 Disposable | 失败信息走 DiagnosticBus | |

**User's choice:** 同时给 disposer 与 diagnostics
**Notes:** 此题在用户要求「先详解再问」之后重发，解释了诊断/Disposable/rollback 三个名词与三个真实使用场景（启动批量注册、替换覆盖、注销/热替换/测试隔离）。

### A3 — 同名 id 重复注册策略

| Option | Description | Selected |
|--------|-------------|----------|
| 默认不可覆盖，owner 仅作标签 | `replaceable` 默认 false；重复注册拒绝 + 诊断 | ✓ |
| 同上但同一 owner 幂等更新 | 同一 owner 重复注册替换自己、不报错 | |
| 默认可覆盖 + 诊断记录 | 后注册者胜，仅记录诊断 | |

**User's choice:** 默认不可覆盖，owner 仅作标签
**Notes:** 解释了「静默默认选择」为何是反模式、`owner`/`replaceable` 各自的角色、`replaceable` 默认值为何影响 Phase 7 的分层覆盖。

### A4 — `kind` 用开放字符串还是封闭枚举

| Option | Description | Selected |
|--------|-------------|----------|
| 开放字符串 + core 导出常量 | core 对种类无知；运行时校验 `段.段` 格式 | ✓ |
| 核心机制封闭 + 能力开放 | core 固定六个机制性种类，能力种类开放 | |
| 全封闭枚举 | 现在就把未来能力种类写进 core | |

**User's choice:** 开放字符串 + core 导出常量
**Notes:** 解释了封闭枚举的三个代价（core 提前耦合未实现能力、第三方无法新增种类、声明指向不存在类型），并指出封闭枚举与「第三方高自由度定制」的核心价值冲突。

---

## B 诊断与启动失败契约

### B1 — `Diagnostic` 的字段与严重级别

| Option | Description | Selected |
|--------|-------------|----------|
| 精简三档 + code/message/owner/target/cause | 三档 severity + 稳定 code + 中文 message + 可选定位与 cause | ✓ |
| 最小：两档 + code/message | 无 owner/target/cause | |
| 扩展版（加 source/timestamp/details） | 更丰富，但现阶段无人消费 | |

**User's choice:** 精简三档 + code/message/owner/target/cause

### B2 — `DiagnosticBus` 语义

| Option | Description | Selected |
|--------|-------------|----------|
| 同步 + 保留历史 + 订阅者隔离 | snapshot() + subscribe()；构造期诊断在构造后可读 | ✓ |
| 同步 + 无历史 | 启动问题走两条通道 | |
| 异步批量派发 | 需 await，构造期时序复杂 | |

**User's choice:** 同步 + 保留历史 + 订阅者隔离
**Notes:** 解释了「构造期间产生的诊断、晚订阅者读不到」这一时序陷阱，以及它如何决定 ROADMAP「汇总所有诊断」的实现方式。

### B3 — 「必需注册」由谁声明、什么粒度

| Option | Description | Selected |
|--------|-------------|----------|
| 组合根清单 + core 内置清单，按 kind:id | 适配器提供自己的必需项；core 另加内置清单 | ✓ |
| 仅 core 内置硬编码 | 适配器无法表达前置 | |
| 按 kind 声明（至少一个） | 可能「不是我需要的那个」也能过 | |

**User's choice:** 组合根清单 + core 内置清单，按 kind:id

### B4 — 「启动即失败」的形式、阻断范围与失败清理

| Option | Description | Selected |
|--------|-------------|----------|
| 抛专用错误 + 先拆除，仅必需项缺失阻断 | 逆序 dispose 后抛出携带全部诊断的专用错误 | ✓ |
| 同上但任何 error 级都阻断 | 更严，一次被拒注册即启动失败 | |
| 返回结果对象，不抛 | 启动失败成为数据，但可能被忽略 | |

**User's choice:** 抛专用错误 + 先拆除，仅必需项缺失阻断

---

## C 生命周期、隔离与版本常量

### C1 — `EditorCore.dispose()` 形态与拆除错误策略

| Option | Description | Selected |
|--------|-------------|----------|
| 同步 dispose(): void | 逆序、出错不中断、幂等；异步清理只标记停止 | ✓ |
| 异步 dispose(): Promise<void> | 可 await 真清理；调用点都要处理 Promise | |
| 两段式（同步 + 可等待） | 多一个方法 | |

**User's choice:** 同步 dispose(): void
**Notes:** 解释了「Phase 12 会冻结这个接口，现在选错以后改对第三方是破坏性变更」这一长期影响。

### C2 — 「两个实例互不干扰」验证到什么程度

| Option | Description | Selected |
|--------|-------------|----------|
| 行为测试 + 结构性门禁 | 隔离行为断言 + 「core 内无模块级可变绑定」机器门禁 | ✓ |
| 只做行为测试 | 抓不住后续搬代码时新引入的模块级状态 | |
| 行为 + 运行时防线 | 更强但复杂、可能误伤 | |

**User's choice:** 行为测试 + 结构性门禁

### C3 — `EDITOR_CORE_API_VERSION` 格式与起步值

| Option | Description | Selected |
|--------|-------------|----------|
| `"0.1.0"`，冻结时升 1.0.0 | 未冻结期按 semver 视为不稳定 | ✓ |
| 直接 `"1.0.0"` | 尚未冻结即宣称稳定 | |
| 整数 major | 表达不了 EXT-03 要求的 minor 弃用 | |

**User's choice:** `"0.1.0"`，冻结时升 1.0.0

### C4 — `EditorCore` 实例对外暴露哪些成员

| Option | Description | Selected |
|--------|-------------|----------|
| 最小暴露面 | 注册表四件套 + `.diagnostics` + `.dispose()`；不暴露 host/engine | ✓ |
| 再暴露 host/engine（标为内部） | 成为公开契约的一部分 | |
| 诊断走方法而非属性 | 多两个接口 | |

**User's choice:** 最小暴露面
**Notes:** 解释了 Phase 12 冻结后「多暴露一个成员就是多背一个包袱」，以及研究稿与 EXT-01 都反对把实例本体交出去。

---

## D 与现有 singleton 的关系、ports 深度、PORT-02 门禁

### D1 — Phase 3 是只增不删还是动现有代码

| Option | Description | Selected |
|--------|-------------|----------|
| 只增不删 | core 内新增内核与测试；`@motajs/editor` 一行不改 | ✓ |
| 只增 + 应用里空跑一个实例 | 证明内核能在真实应用启动；属行为增量 | |
| 开始替换一个 singleton | 提前验证，但侵入现有行为 | |

**User's choice:** 只增不删
**Notes:** 依据是 ROADMAP Phase 3 五条验收标准只谈内核存在/隔离/无默认 Fs，切换与删除是 Phase 11 的验收。

### D2 — 四个 port 接口本阶段定义到什么深度

| Option | Description | Selected |
|--------|-------------|----------|
| 四个都存，按已知消费者最小定义 | Fs/Host 较实；EngineAdapter 只留入口；PreviewAdapter 只留占位 | ✓ |
| 四个一次写完整 | 一步到位但大量猜测、无实现无消费无测试 | |
| 只定义 Fs/Host，另两个推后 | 需改 PORT-01 措辞 | |

**User's choice:** 四个都存，按已知消费者最小定义

### D3 — PORT-02 用什么机器手段保证

| Option | Description | Selected |
|--------|-------------|----------|
| ESLint 禁全局 + dependency-cruiser 管边界 | 工具分工正确；复用 lint-severities 完整性检查 | ✓ |
| 自写 verifier 脚本 | 风格统一但需自处理词法，易误报漏报 | |
| 两者都上 | 最稳但多一份维护 | |

**User's choice:** ESLint 禁全局 + dependency-cruiser 管边界
**Notes:** 解释了「否定式要求不上门禁就会腐化」，以及 `fetch`/`window` 是全局标识符（dependency-cruiser 管不了）、「不得 import 宿主/引擎」才是依赖边。并强调适配器**可以**用 `fetch`，禁令只针对 core。

### D4 — 内核与 port 的目录划分

| Option | Description | Selected |
|--------|-------------|----------|
| kernel/ 放机制，ports/ 放契约 | `lib/kernel/`（core/registry/diagnostics/errors）+ `lib/ports/` | ✓ |
| 全部平铺在 lib/kernel/ | 更浅；Phase 5+ 后混装机制与契约 | |
| 更细的多层目录 | 现阶段属提前优化 | |

**User's choice:** kernel/ 放机制，ports/ 放契约
**Notes:** 已知 `requireZero` 规则已锁定组合根为 `lib/kernel/core.ts`；锁定 subpath 无 `./kernel`，内核只能从 `.` 入口拿到。具体文件名/类型名须另行经 `INTERFACE-NAME.md` 确认。

---

## the agent's Discretion

- 诊断 `code` 的命名规则与常量表（须列入 `INTERFACE-NAME.md` 并确认）
- `snapshotCapabilities()` 返回的容器形态（须确认）
- `EditorCoreConfig` 的确切字段集
- 隔离测试与结构门禁的断言粒度
- ESLint 规则的具体选项形状与放置方式（根配置 override vs core 专属配置片段）

## Deferred Ideas

- 能力热替换/卸载的真实场景（扩展加载器）——本期不做，D-02 的 disposer 已预留接口
- 诊断的 `source`/`timestamp`/`details` 与诊断面板/上报——需要时再扩
- `EDITOR_CORE_API_VERSION` 冻结与弃用策略落地（Phase 12 升 1.0.0）
- port 接口的完整化（Phase 5 / 7–10 / 11）
- `@microsoft/api-extractor` 报告（Phase 11 起在 CI 强制）
