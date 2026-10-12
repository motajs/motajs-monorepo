# Phase 2: 表格编辑 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-11
**Phase:** 2-表格编辑
**Areas discussed:** 表格如何挂进编辑器, 数据与 schema 从哪来, 与现状一致的粒度 + 样式, 命令 / 撤销 / 持久化, Schema 编辑呈现（追加）

---

## A. 表格如何挂进编辑器

| Option | Description | Selected |
|--------|-------------|----------|
| 面板类型工厂 + 底层组件 | 既导出可直接注册进 ShellSystem 的面板类型，也导出底层 React 表格组件 | ✓ |
| 只导出面板类型工厂 | 对外只给可注册的面板类型 | |
| 只导出纯 React 组件 | 由外部自己包成面板类型 | |

**User's choice:** 面板类型工厂 + 底层组件

**Notes:** 追问「实例如何决定编辑哪张表」时，用户否定了「单例跟随当前表」的建议，答：「内部存储，外部可以设置。编辑器不存在当前表格这一概念」。再追问「外部通过什么入口设置目标」，选「表格面板额外暴露方法」。

---

## B. 数据与 schema 从哪来

| Option | Description | Selected |
|--------|-------------|----------|
| schema 外部注入 + 数据走 core 资源层 | 数据经 editor-core 资源层读取 | ✓（用户扩展为「都走资源层」） |
| 两者都由外部「数据源钩子」提供 | | |
| editor-impl 自建读写 | | |

**User's choice（自由文本）:** 「都使用资源层获取。常规表格使用 `table.xxx`，schema 使用 `table#schema.xxx`。注意 schema 也属于一种表格，它允许被可视化编辑，对于这种表格，应当不出现 `table#schema#schema`。应提供一个编辑 Schema 的按钮，点击后进入当前正在编辑的表格的 schema 的编辑。」

**Notes:** 追问「点『编辑 Schema』后怎么进入」→ 选「新开一个表格面板实例」。

---

## C. 与现状一致的粒度 + 样式

| Option | Description | Selected |
|--------|-------------|----------|
| 完整对齐现有表格 | 行内编辑 / 行列增删 / 折叠 / 各类输入控件 / 外部编辑器全部对齐 | ✓ |
| 核心先行，其余后续补齐 | | |
| 你来定具体清单 | | |

**User's choice:** 完整对齐现有表格

样式问题：

| Option | Description | Selected |
|--------|-------------|----------|
| antd 组件 + 局部 CSS | antd 已是 editor-impl peerDep | ✓ |
| antd + PandaCSS（完全同栈） | | |
| core 自带纯 CSS | | |

**User's choice:** antd 组件 + 局部 CSS

---

## D. 命令 / 撤销 / 持久化

| Option | Description | Selected |
|--------|-------------|----------|
| 走 editor-core 统一撤销系统 | 每次编辑为可逆操作；资源层异步持久化 | ✓ |
| editor-impl 自建撤销 | | |

**User's choice:** 走 editor-core 统一撤销系统

---

## E. Schema 编辑呈现（追加灰区）

用户追加提问：「Schema 表格编辑是否考虑单独做？单独做的话可以定制，编辑体验更好，而不单独做的话可能需要让作者懂一部分 Schema 结构」，并进一步提出：「如果检测到是 Schema，那么启用另一套 json 解析方式。比如对于常规 json，有 min max，那么分两行两个 number input，而如果是 Schema 的 min max，那么改为一左一右一行两个小的 number input，这种方式可行吗？」

**agent 答复：** 可行——同一表格引擎 + 一个「schema 专用呈现模式」（schema 的呈现规则由引擎内建/可注入，不由 schema 描述，与「schema 无 schema」一致）。

**User's choice:** 锁定「同一表格引擎 + schema 专用呈现模式」。

---

## the agent's Discretion

- 表格面板与底层组件的具体接口形状、方法名、字段名；资源标识 `xxx` 的语义；schema 专用呈现的具体规则集；「同一组件带模式切换 vs 两套组件」。

## Deferred Ideas

- 地图 / 代码 / 事件编辑器（Phase 4/5/6）。
- 插件加载 / 注册机制（后续里程碑）。
- 「打开参数」通用化到外壳（本阶段以面板额外方法解决）。

---

## 第二轮讨论（2026-10-12）：JSON Schema 方向

**背景**：方向修订——schema 从旧「字段配置 / 注释对象」改为**标准 JSON Schema（完全替代）**；D-06 定为注入式打开器；新增面板参数约定 `IXxxPanelParam` / `ITablePanelParam`。本轮就 JSON Schema 的 4 个方向 + 2 个补充点讨论。

### 区域 1. schema 来源与旧格式

| Option | Description | Selected |
|--------|-------------|----------|
| 只认 JSON Schema（适配层转换） | impl 只读标准 JSON Schema；引擎格式转换由适配层负责 | ✓ |
| impl 两种格式都认 | impl 同时认识旧注释对象格式 | |
| 注入式 schema 解析器 | impl 定义可注入解析器接口 | |

**User's choice:** 只认 JSON Schema（适配层转换）

转换器：

| Option | Description | Selected |
|--------|-------------|----------|
| 本阶段不做转换器 | 旧→新转换留到引擎侧/后续 | ✓ |
| 本阶段做最小转换器 | 本阶段交付旧格式转 JSON Schema | |

**User's choice:** 本阶段不做转换器

### 区域 2. 版本与校验实现

| Option | Selected |
|--------|----------|
| Draft 2020-12 | ✓ |
| Draft-07 | |
| 不锁定版本 | |

**User's choice:** Draft 2020-12

校验：`用 ajv` ✓（自实现子集 / 注入式校验器 未选）。
求值器：`废弃 IValueEvaluator` ✓（保留 未选）。

### 区域 3. 外部编辑器触发约定

触发布局：`统一用 x- 扩展键` ✓（标准关键字 + x- / 外部注入映射 未选）。
行内控件：`标准推导 + x-control 兜底` ✓（完全由扩展键指定 未选）。

### 区域 4. schema 表怎么编辑

摊法：`properties 为行 + 递归` ✓（只做顶层一层 / 通用 JSON 树编辑 未选）。
成对呈现：`保留成对呈现` ✓（不特殊处理 / 内建规则可注入替换 未选）。
支持范围：`基础 + 常见` ✓（尽量支持全部 / 只支持最基础 未选）。

### 补充点 1. 行为对齐范围

| Option | Selected |
|--------|----------|
| 完整对齐旧表格 | |
| 整体对齐、可微调 | ✓ |
| 借机现代化 | |

**User's choice:** 整体对齐、可微调

### 补充点 2. `table#schema.<name>` 存什么 / 非法怎么办

存什么：`直接存 JSON Schema` ✓（包装一层 未选）。
异常处理：`分级处理、不崩溃` ✓（降级为纯 JSON 视图 / 直接报错 未选）。

### 待确认命名（本轮新增，拟名）

- `x-editor` / `x-control`（JSON Schema 扩展键）。
- JSON Schema 方向的数据模型 / 校验 / 控件映射 / 呈现规则等命名，待重规划时提案。

### Deferred Ideas（本轮）

- 旧格式 → JSON Schema 转换器（引擎侧 / 后续）。
- `$ref` / `oneOf` / `anyOf` / `allOf` / `$defs` 支持（后续）。
- 成对呈现等规则集「可注入替换」（默认内建，暂不做替换入口）。
