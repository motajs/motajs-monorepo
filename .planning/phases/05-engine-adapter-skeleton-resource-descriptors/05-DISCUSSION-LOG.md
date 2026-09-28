# Phase 5: Engine Adapter Skeleton & Resource Descriptors - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-28
**Phase:** 5-Engine Adapter Skeleton & Resource Descriptors
**Areas discussed:** 适配器边界, 描述符与 defineEngine 形状, LabelOverrides 与 MigrationHook, Fake engine B 与游戏标识符门禁

---

## 适配器边界（只定义 vs 顺带接线）

| Option | Description | Selected |
|--------|-------------|----------|
| 纯增量：只定义，不接线 | 只新增 defineEngine/描述符/fake B + 门禁；projectData 一行不改，接线留 Phase 11 | ✓ |
| 顺带接线：现在就改 projectData | 把 11 个访问器改经 ResourceRegistry 解析，保留旧方法名 shim | |
| 只定义 + 加对照断言钉住漂移 | 描述符落地 + 一条对照测试，不真接线 | |

**User's choice:** 纯增量：只定义，不接线
**Notes:** 延续 Phase 4「未接线」节奏，回归面最小。

| Option | Description | Selected |
|--------|-------------|----------|
| 新建 src/adapter/ 专用目录 | editor 下集中存放 mota 引擎描述符与后续钩子 | ✓ |
| 放到 src/project/ 旁边 | 靠近现有 projectData | |
| 独立 workspace 包 | 新建 packages/libs/adapter-mota | |

**User's choice:** 新建 src/adapter/ 专用目录

---

## 描述符与 defineEngine 形状

| Option | Description | Selected |
|--------|-------------|----------|
| defineEngine 在 core，扩展 EngineAdapter | core 导出带校验的构造器 + 演进接口 | ✓ |
| defineEngine 在适配器侧 | core 只留类型 | |
| 不要 defineEngine，用 satisfies | 最少新符号 | |

**User's choice:** defineEngine 在 core，扩展 EngineAdapter

| Option | Description | Selected |
|--------|-------------|----------|
| 工厂函数 | handler: (fileHandler) => IDataHandler，保惰性 | ✓ |
| 预构造实例 | 研究稿字面 handler: new ... | |
| 只带 format id + 单独注册表 | 描述符更纯但多一层间接 | |

**User's choice:** 工厂函数

**参数化路径（追问）：** 用户 free-text 指出「这个 editor-core 为什么会需要路径参数？它的所有数据都是从外部传入的，理应不需要任何路径相关的参数，上层自行实现文件读取，将必要的内容直接传给 editor-core。editor-core 本身只负责 json 编辑、代码编辑、地图编辑等功能，它改的是什么，内容来源完全无关。」

**路径归属（追问）：** 用户 free-text 继续质疑：「传入的内容都不一定真的是一个文件中的内容，甚至有可能是现场创建的，怎么可能每个都分配一个字符串键？还有你要说清楚这个字符串键到底是要干什么的，你只说了它为什么存在，但是没说它能干什么。」
→ Agent 查实 `fileHandlerManager.ts` / `persistExecutor.ts` / `persistenceMonitor.ts`，列出该字符串键的 6 处用途（身份/去重、加载锁、IO 地址、持久化分组、失败状态、预加载错误标识），并说明其中只有「身份/去重」是通用的，其余只对文件支撑资源成立。

| Option | Description | Selected |
|--------|-------------|----------|
| A. 保留 opaque key，只澄清语义 | 不改 Phase 4 契约 | |
| B. core 彻底去路径 | 需改契约/ROADMAP | |
| C. 先要更多材料再定 | | |

**User's choice:** free-text —「那就不应该有 path 成员，因为你就不能假定内容来自文件……顶多在 core 里面内置一个带有 path 的资源类型类，而不是所有的都包含 path。」

| Option | Description | Selected |
|--------|-------------|----------|
| A. 只留 id + 工厂 + preload | 通用 descriptor 完全不含来源/format/handler | ✓ |
| B. 加 format id | 额外保留内容编码 id | |
| C. 先出具体形状再定 | | |

**User's choice:** A. 只留 id + 工厂 + preload

| Option | Description | Selected |
|--------|-------------|----------|
| A. core 内置文件支撑资源类 | lib/resources 内置带 path 的类，适配器直接用 | ✓ |
| B. 适配器自建 | core 面最小但每引擎重造 | |
| C. 把 editor 的 DataResource 升进 core | | |

**User's choice:** A. core 内置文件支撑资源类

---

## LabelOverrides 与 MigrationHook

**User's first response:** free-text —「airwall 应该提供成游戏内显示与编辑器显示使用不同贴图的功能，而不是作为一个特例。还有你提到的这两个接口是干什么的？我对原本的项目没有任何了解，你应该解释清楚。」
→ Agent 读 `airwallMigration.ts`，详细解释了 LabelOverrides（UI 文案/词汇覆盖）与 MigrationHook（加载时旧数据升级），并拆解 airwall 的「显示分离（通用能力，`BlockInfo.editorDisplay` 已在）」与「数据升级（mota 专有，留适配器）」两件事。

| Option | Description | Selected |
|--------|-------------|----------|
| B. 下修/顺延：core 不定义 | PORT-06 用门禁落地；LabelOverrides 顺延 Phase 6+；PORT-07 由迁移留适配器满足 | ✓ |
| A. 按 ROADMAP 定义两类型 | 空接口风险 | |
| C. 只定义 LabelOverrides | | |

**User's choice:** B. 下修/顺延：core 不定义

---

## Fake engine B 与游戏标识符门禁

| Option | Description | Selected |
|--------|-------------|----------|
| A. core 测试夹具 | lib/__tests__/ 下，与 core 测试同跑 | ✓ |
| B. 独立样例包 | 边界显式但新增包 | |
| C. 放 editor 侧测试 | | |

**User's choice:** A. core 测试夹具

| Option | Description | Selected |
|--------|-------------|----------|
| A. scripts/verify 独立 verifier | 两极性、可精确排除 Math.floor、接入现有 CI job | ✓ |
| B. ESLint 作用域规则 | 统一 lint 但表达力弱 | |
| C. 两者都要 | | |

**User's choice:** A. scripts/verify 独立 verifier

| Option | Description | Selected |
|--------|-------------|----------|
| A. 全清单 + 上下文匹配 | tower/floor/loc/autopass/autotile/idnum/airwall/commonEvent/prefab/mota；floor 排除 Math.floor | ✓ |
| B. 保守清单 | 先不拦 tower/floor/loc | |
| C. 计划时定清单 | | |

**User's choice:** A. 全清单 + 上下文匹配

---

## the agent's Discretion

- `ResourceDescriptor` 字段名、`create(deps)` 的 deps 形状
- core 内置「文件支撑资源类」的类名与构造签名
- fake engine B 的文件名/符号名/资源构成
- verifier 文件名、排除规则、输出格式
- `preload` 取值集合与默认
- catalog 版本取值
（均须先经 `INTERFACE-NAME.md` 确认，Project Rules）

## Deferred Ideas

- `LabelOverrides` 定义与消费 → Phase 6+（有 UI 消费者时）
- `MigrationHook` 定义与执行点 → 顺延；迁移留适配器
- airwall「编辑器/游戏显示分离」一般化 → Phase 10（地图能力；通用位置 `BlockInfo.editorDisplay` 已存在）
- 素材区多图合并（一堆图、单图可含 enemy/item/npc、共同组成素材区）→ Phase 9（素材能力）
- 真正接线（改写 projectData、组合根切换、删 shim/singleton）→ Phase 11
- 文档修订：`ROADMAP.md` `PORT-04` 措辞 + `PORT-06`/`PORT-07` 下修 → 待用户确认
- 插件加载器 → 本期不做
