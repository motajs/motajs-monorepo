# Phase 3: 素材管理 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-15
**Phase:** 3-素材管理
**Areas discussed:** 范围与面板拆分, 素材后端接缝, 引擎规则的注入边界, 素材选择器归属, 编辑深度与撤销粒度, 素材整合与格式转换, 新版引擎内容模型与 Schema

---

## 范围与面板拆分

| Option | Description | Selected |
|--------|-------------|----------|
| 合并成单个素材管理器面板 | 一个面板，内部按图片/动画/材质分区 | ✓（方向修订） |
| 照现状拆多个面板类型 | 资源管理器 / 追加素材 / 图块属性 各一个面板类型 | |
| 最小化（只浏览+增删改） | 只做素材库浏览与增删改 | |
| 你决定 | 由规划阶段定 | |

**User's choice:** 「一个面板。新版引擎已经把素材进行了整合，只需要区分图片、音频、动画、字体等大分类即可，不再需要细分，每个素材单独进行配置。」
**Notes:** 这是一次范围简化——不再有现状那种「一张图按行拆成多个材质」的细分；分类为 图片/音频/动画/字体 等大分类。

### 材质位置（追问）

| Option | Description | Selected |
|--------|-------------|----------|
| 材质并入每个素材的配置 | 大分类只有 图片/音频/动画/字体，每素材自带配置 | |
| 材质仍是独立大分类 | 材质单独一栏 | |
| 待研究引擎模型后再定 | | |

**User's choice:** 「我稍后提供详细的 JSON 类型，可以先讨论其他的方面。」
**Notes:** 数据模型延后；后续由新引擎 JSON 模型（texture 分类）回答。

---

## 素材后端接缝

| Option | Description | Selected |
|--------|-------------|----------|
| 走 editor-core 资源层 | 用 `IResourceSystem`；type 区分分类；列表用 `requestResourceList(type)` | ✓ |
| 专用素材后端接缝 | 另开注入接口，不走资源层 | |
| 混合：字节走资源层、配置引擎注入 | | |
| 待引擎模型后再定 | | |

**User's choice:** 「走 editor-core 资源层」

### 资源粒度（引擎模型追问）

| Option | Description | Selected |
|--------|-------------|----------|
| 列表文件=一个资源 | 分类的 `.list.jsonc` 是一个资源；字节文件各自是资源 | ✓ |
| 每个素材=一个资源 | | |
| 你决定 | | |

**User's choice:** 「列表文件=一个资源」

---

## 引擎规则的注入边界

| Option | Description | Selected |
|--------|-------------|----------|
| 注入 + 内置默认 | editor-impl/asset 内置四类预览与框架；引擎注入分类清单/类型号/配置描述 | ✓ |
| 全写死 | | |
| 全注入 | | |
| 待引擎模型后再定 | | |

**User's choice:** 「注入 + 内置默认」

### 配置表单描述方式

| Option | Description | Selected |
|--------|-------------|----------|
| 复用表格/表单引擎 | 每素材配置 = 一张 JSON Schema 小表 | ✓ |
| 引擎注入自定义组件 | | |
| 简单键值列表 | | |
| 你决定 | | |

**User's choice:** 「复用表格/表单引擎」

### 两套 Schema / legacy 含义

| Option | Description | Selected |
|--------|-------------|----------|
| 内置两套，装配方选 | editor-impl/asset 内置 legacy + 新引擎两套 | ✓ |
| 只内置新引擎一份 | | |
| 全由引擎注入 | | |
| 你决定 | | |

**User's choice:** 「内置两套，装配方选」；「legacy」= 现有 `@motajs/editor` 的旧素材模型。

### 引擎自带 Schema 的定位

| Option | Description | Selected |
|--------|-------------|----------|
| 约定固定文件名 | 每分类目录下一个约定文件，读不到回退内置 | ✓ |
| 作为资源读取 | | |
| 装配方注入 | | |
| 你决定 | | |

**User's choice:** 「约定固定文件名」

### 配置范围（font/animation/audio）

| Option | Description | Selected |
|--------|-------------|----------|
| 如类型所示，不多加 | font/animation 只有名字；audio 只有 type+source | ✓（目前足够） |
| 加占位/通用字段 | | |
| 你决定 | | |

**User's choice:** 「目前这些配置足够，如果后续需要再加。还有后面计划给这些 .list.jsonc 添加自己的 Schema 在引擎里面，优先尝试读取引擎包含的 Schema，如果没有再回退到内置的。」

### defaults 作用

| Option | Description | Selected |
|--------|-------------|----------|
| 是，取自 defaults | 新增素材默认值取自 defaults，`@required` 参与校验 | ✓ |
| 只作参考 | | |
| 你决定 | | |

**User's choice:** 「是，取自 defaults」

---

## 素材选择器归属

| Option | Description | Selected |
|--------|-------------|----------|
| editor-impl/asset 提供默认素材选择器 | 自行按分类列素材、预览、返回选中项 | ✓ |
| 调用方组装候选项 | | |
| 仍由宿主/引擎提供 | | |
| 你决定 | | |

**User's choice:** 「editor-impl/asset 提供默认素材选择器」

---

## 编辑深度与撤销粒度

| Option | Description | Selected |
|--------|-------------|----------|
| 全可撤销（含字节） | | |
| 只撤销配置 | | |
| 全可撤销但帧字节惰性保留 | | |
| 你决定 | | |

**User's choice:** 「字节改动无法撤销，撤销时提示无法撤销。可能需要给 undo redo 加一个返回值，返回 false 表示无法执行操作，返回 true 才表示撤销成功。」

### 撤销碰到不可撤销字节改动时的行为

| Option | Description | Selected |
|--------|-------------|----------|
| 作为屏障（停住） | 记进历史但标记不可撤销；撤销碰到停住、返回 false、提示 | ✓ |
| 不进历史（跳过） | | |
| 你决定 | | |

**User's choice:** 「作为屏障（停住）」

### 新增素材行为

| Option | Description | Selected |
|--------|-------------|----------|
| 本地上传文件 | | ✓ |
| 建空素材再配置 | | |
| 两种都要 | | |
| 待引擎模型后再定 | | |

**User's choice:** 「本地上传文件」

---

## 素材整合与格式转换（用户补充）

**User's background (no question):** ① 素材整合后不再合并成一张图；图片直放 images、注册后按配置读取；一张图有不同读取方式、可对应一个或多个图块；帧率不再按类型强制限制、最大 255 帧。② BGM 与音效合并、靠配置区分。③ 为推广新存储方案，面板需加图片→WebP、音频→WebM/Opus 两个瘦身功能。

### 音频封装

| Option | Description | Selected |
|--------|-------------|----------|
| 引入 JS WebM 封装库 (a) | 例如 webm-muxer | |
| 用 MediaRecorder (b) | | |
| 等你的处理方案 | | |

**User's choice:** 「根据我的研究，Mediabunny 库应该是最佳选择，像你提的 webm-muxer 这种库并不存在」——提供 https://mediabunny.dev/ 与 https://github.com/Vanilagy/mediabunny。
**Notes:** 已联网核实 Mediabunny（TS、零依赖、WebCodecs、WebM 输出 + Opus、可 tree-shake）。

### 转码行为

| Option | Description | Selected |
|--------|-------------|----------|
| 就地替换、逐个手动 | | |
| 就地替换、可批量 | 就地替换 + 批量 | ✓（扩展） |
| 另存新素材 | | |
| 你决定 | | |

**User's choice:** 「允许批量转换，并添加一个勾选框，表示是否覆盖旧文件，默认选择；如果不选，那么将旧文件命名为 `{file}-origin.{ext}`；如果选了，那么确认之后再弹出一个弹窗明确说明这会导致原文件被替换，无法找回。另外这里牵扯到了路径的问题，我可能需要调整一下现在的资源层接口（目前约束太强，面板根本无法获得路径，也难以实施新增素材等功能，这部分我后续自己调整）。另外转码时应允许用户进行适当的配置，比如 webp 的 quality，音频的码率、采样率等基础配置。」

---

## 新版引擎内容模型与 Schema（用户提供）

**User's model (以 `common.ts` 类型为准):** texture 项 `IClientTextureListConfig { source, read(TextureReadType), usage(TextureUsage), grid?, tiles? }`；audio 项 `IClientAudioListConfig { type(ClientAudioType), source }`；animation / font = `string[]`；另有 `defaults/*.jsonc`（默认条目 + `@required` + 逐属性比较）与 `IClientContentConfig`（目录与列表路径）。

**User's note:** 实际 `.list.jsonc` 内容与类型尚未对齐，**以类型为准**；素材管理要**通用**（保留自定义空间），提供 **legacy + 新引擎两套 Schema**。

---

## the agent's Discretion

- 面板与底层组件的具体接口形状、方法名、字段名；各分类 Schema 的具体字段表达；转码配置界面呈现；目录约定文件名的确切命名；分类清单注入形状——由研究 / 规划阶段提出，命名经 `INTERFACE-NAME.md` 确认。

## Deferred Ideas

- 资源层接口修订（支持新增素材、`path` 获取）——用户自行进行；`IResourceIdentifier.path` 已加入（core 不消费、impl 用于判定与写入），当前为未提交改动。
- 引擎为各 `.list.jsonc` 自带 Schema 的格式/位置细节。
- 转码配置界面 / 新增素材输入体验等交互细节。
- 地图 / 代码 / 事件编辑器（Phase 4/5/6）、插件机制、dev 宿主演示数据。
