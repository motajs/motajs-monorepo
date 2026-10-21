# Phase 3 — 接口与命名确认 / 素材管理

**Status:** 已确认 —— 用户 2026-10-18 批准命名（之前 03-01…03-09 已按此表落地；03-10…03-17 直接用此表，不再逐名等待）
**Scope:** 本阶段新增 / 改动的全部对外名称。前序阶段已锁定的名称不重复登记。
**约定:** 类上的方法一律写成 `类名.方法名`；`type` 别名与其用途一并列出。

> 读法：每个 Plan 一节。先一句话说明「这个计划要做什么」，再列出它引入 / 改动的名字及**用途**。
> 若某个名字不合适，直接在对话里指出；改名后再进入执行。

---

## Plan 03-01 — `editor-core` 契约：撤销屏障、布尔返回、二进制读取、面板移动

**要做什么：** 让撤销能报告「这一步到底有没有执行」，给撤销条目加「到此为止」的标记，并让面板能读二进制、能移动文件。本计划只改契约声明与为保持编译通过所需的直通，屏障判定在 03-04 实现。

| 名称 | 种类 | 用途 |
|------|------|------|
| `IUndoContext.barrier` | 可选成员 `boolean` | 标记这条撤销记录是「不可撤销的屏障」：撤销碰到就停，不跳过它去撤更早的改动（D-14 / D-29） |
| `IUndoSystemHooks` | interface | 撤销系统的钩子集合 |
| `IUndoSystemHooks.onUndoBlocked` | 可选方法 | 撤销命中屏障时被调用，能力层 / 装配方据此提示「无法撤销」 |
| `IUndoSystem.undo` / `IUndoSystem.redo` | 方法，返回改 `Promise<boolean>` | `true` = 真的执行了一步；`false` = 没得撤 / 重做，或命中屏障（D-15） |
| `IUndoSystem extends IHookable<IUndoSystemHooks>` | 接口继承 | 让外部能挂 `onUndoBlocked`，复用 core 既有钩子机制 |
| `IResource.requestBinary` | 方法 | 从资源句柄读原始字节（`request()` 只按文本读，图片 / 音频必须走这条） |
| `IResourceStore.readBinary` | 方法 | 资源系统侧读字节的窄接缝（实现已存在，本计划补进契约） |
| `IEditorPanelContext.moveResource` | 方法 | 面板把文件改名（转码「保留旧文件」时改成 `{file}-origin.{ext}`） |

---

## Plan 03-02 — `shared` 中立类型落位 + `react` 接缝契约

**要做什么：** 把 schema 相关的**类型**搬到中立目录（`shared/schemaForm`），让 `table` 与 `asset` 都能引用而不互相 import（D-28 的前提）；同时在能力接缝上声明「素材能力」。

| 名称 | 种类 | 用途 |
|------|------|------|
| `src/shared/schemaForm/types.ts` | 文件（类型落位） | 中立目录，存放两侧都要用的类型 |
| `src/shared/schemaForm/index.ts` / `src/shared/index.ts` | 桶文件 | 汇总共享模块 |
| `ITableSchemaNode` / `ITableRowNode` | interface（迁址，名字不变） | 一份 JSON Schema 节点的编辑器侧描述；表格 / 表单里的一行 |
| `TableControlKind` / `TableEditMode` / `TableExternalEditor` | `const enum`（迁址） | 控件种类 / 编辑模式 / `x-editor` 外部编辑器种类 |
| `IPairedFieldGroup` / `ISchemaPresentationRule` | interface（迁址） | schema 视图里「成对关键字」的呈现规则 |
| `AssetCategoryKind` | `const enum`（`Image` / `Audio` / `Animation` / `Font`） | 大分类的种类，决定默认列表格式、预览与能否转码 |
| `AssetListFormat` | `const enum`（`StringList` / `ObjectList`） | 列表文件正文格式：`string[]`，或「对象数组挂在某个键下」 |
| `IAssetCategory` | interface | 一个分类的注入描述：`id` / `label` / `kind` / `dir` / `listPath` / `listFormat` / `listKey?` / `sourceField?` / `extension?` / `schemaPath?` / `defaultsPath?` / `schema?` |
| `IAssetPickerOpenRequest` / `IAssetPickerResult` | interface | 选择器打开参数（标题 / 分类 / 是否多选 / 初始选中）与返回值（选中名列表） |
| `IAssetPickerOpener` | interface | 打开素材选择器；取消返回 `null`（D-12） |
| `IAssetEditorCapabilities` | interface | 素材能力的注入面：分类清单 + 选择器 |
| `ITableEditorCapabilities.asset` | 可选成员 | 把素材能力挂进既有能力包（不另造一套 Provider） |

> 分类类型为什么放在 `react/`：`react/` 不允许 import 任何能力目录，而接缝要引用「分类」；因此分类形状声明在 `react/`（与 `ITablePreset` 同一做法），由 `asset` 反向引用。

---

## Plan 03-03 — `asset` 域类型、转码契约、约定常量

**要做什么：** 只声明素材面板这一层的数据形状与常量，不含实现。

| 名称 | 种类 | 用途 |
|------|------|------|
| `src/asset/types.ts` | 文件 | 素材能力的类型声明集中处 |
| `AssetPanelStatus` | `const enum`（`NoCategory` / `Loading` / `Ready` / `Empty` / `Error`） | 面板数据状态，驱动加载 / 空 / 错误 / 正常四种呈现 |
| `AssetPanelMode` | `const enum`（`Browse` / `Configure`） | 浏览素材 / 配置某个素材 |
| `AssetUndoType` | `const enum`（`Config` / `Barrier`） | 撤销记录种类：配置改动（可撤）与字节改动（屏障） |
| `AssetSchemaSource` | `const enum`（`ProjectFile` / `Injected` / `BuiltIn`） | 本次用的 schema 从哪来（工程文件 → 注入 → 内置） |
| `IAssetEntry` | interface | 面板里的一条素材：名字 / 字节路径 / 配置 / 文件是否存在 |
| `IAssetListEntry` | interface | 列表文件里的一条：名字 / 配置 / 原始顺序 |
| `IAssetSchemaResolution` | interface | schema 解析结果：节点 + 来源 |
| `IAssetPanelTarget` / `IAssetPanelParam` | interface | 打开面板时可带的初始目标 / 工厂参数扩展位 |
| `IAssetPanel` | interface | 面板对外动作面：`setTarget` / `save` |
| `IAssetPanelViewState` | interface | 面板视图状态（状态 / 模式 / 分类 / 条目 / 选中 / 配置行树 / 配置校验错误列表 `configErrors`（`readonly string[]`，空数组 = 通过）/ 未保存 / 提示） |
| `AssetTranscodeKind` | `const enum`（`ImageWebp` / `AudioOpus`） | 两种瘦身转码动作（`I` 前缀只给被 `implements` 的接口，故枚举不带 `I`） |
| `IAssetTranscodeService` | interface | 转码契约：能力探测 + 图片转 WebP + 音频转 WebM/Opus；测试注入假实现 |
| `src/asset/constants.ts` | 文件 | 面板级常量 |
| `ASSET_MAX_UPLOAD_BYTES` | 常量 `32 * 1024 * 1024` | 单个上传文件字节上限 |
| `UNDO_BLOCKED_MESSAGE` | 常量 `'无法撤销'` | 撤销命中屏障时的提示文案 |
| `src/asset/model/assetPaths.ts` | 文件 | 目录 / 文件命名约定常量 |
| `ASSET_LIST_FILE_NAME` | 常量 `'.list.jsonc'` | 每个分类目录下列表文件的固定名 |
| `ASSET_SCHEMA_FILE_NAME` | 常量 `'.schema.jsonc'` | 分类目录下「引擎自带 schema」的固定名（D-09） |
| `ASSET_ORIGIN_SUFFIX` | 常量 `'-origin'` | 不覆盖旧文件时旧文件的改名后缀（D-21） |
| `src/asset/transcode/types.ts` | 文件 | 转码选项 / 结果类型与默认参数 |
| `IAssetAudioTranscodeOptions` / `IAssetTranscodeOptions` / `IAssetTranscodeItemResult` / `IAssetTranscodeSummary` | interface | 音频参数 / 一整批参数 / 单项结果 / 汇总 |
| `ASSET_DEFAULT_WEBP_QUALITY` | 常量 `80` | WebP 质量默认值（0–100） |
| `ASSET_DEFAULT_OPUS_BITRATE` | 常量 `96000` | Opus 码率默认值（bps） |
| `ASSET_DEFAULT_OPUS_SAMPLE_RATE` | 常量 `48000` | Opus 采样率默认值（Hz） |
| `src/asset/index.ts` | 桶文件 | `./asset` 子路径起点 |

---

## Plan 03-04 — `editor-core` 撤销行为实现

**要做什么：** 让屏障真的挡住撤销、返回 `false`、触发通知；二进制读取与文件移动真的可用。不新增对外名称。

| 名称 | 种类 | 用途 |
|------|------|------|
| `UndoSystem.undo` | 方法实现 | 栈顶是屏障 → 不调用面板、不弹栈、返回 `false`、触发 `onUndoBlocked`；否则照旧返回 `true` |
| `UndoSystem.redo` | 方法实现 | 返回 `true` / `false`（屏障从不进重做栈） |
| `UndoSystem.createController` | 受保护方法 | `Hookable` 要求的控制器工厂 |
| `Resource.requestBinary` / `PanelContext.moveResource` | 方法实现 | 一行转发到资源系统 |

---

## Plan 03-05 — `.jsonc` 编解码抽到 `shared/jsonc`

**要做什么：** 把表格已有的 `.jsonc` 解析 / 写回（含系统前缀注释块逐字保留）原样搬到中立目录，并给包加 `./shared` 子路径。

| 名称 | 种类 | 用途 |
|------|------|------|
| `src/shared/jsonc/tableText.ts` / `index.ts` | 文件（整体搬迁） | `.jsonc` 编解码实现，行为不变 |
| `parseTableText` / `serializeTableText` | 函数（迁址，名字不变） | 解析（严格 → 拆前缀 → json5 回退）与写回（前缀逐字还原） |
| `SYSTEM_PREFIX_END_MARKER` | 常量（迁址） | 系统前缀结束标记行 `// --- SYSTEM PREFIX END --- //` |
| `TableTextParseStatus` / `ITableTextParseResult` | 枚举 / interface（迁址） | 解析结论与结果形状 |
| `@motajs/editor-impl/shared` | 包子路径 | 让包外消费者（开发宿主）引用共享件；`./table` 不再转发 |

---

## Plan 03-06 — schema 模型层抽到 `shared/schemaForm/model`

**要做什么：** 把 schema → 行树 / 字段路径 / 控件推断 / 校验五个纯逻辑模块搬到中立目录，表格改从新位置 import。

| 名称 | 种类 | 用途 |
|------|------|------|
| `src/shared/schemaForm/model/**` | 文件（整体搬迁） | `buildTableTree` / `buildSchemaTree` / `buildSchemaPresentation` / `inferControlKind` / `validateId` / `validateValue` / 字段路径工具 |
| `src/shared/schemaForm/model/index.ts` | 桶文件 | 汇总五个模型模块 |

---

## Plan 03-07 — 表单渲染抽到 `shared/schemaForm/components`

**要做什么：** 把网格 / 行 / 分组 / 编辑模式 / 工具栏 / 六个行内控件 / 样式整块搬到中立目录；表格只剩三个专属组件。

| 名称 | 种类 | 用途 |
|------|------|------|
| `src/shared/schemaForm/components/**` | 文件（整体搬迁） | `TableGrid` / `TableRow` / `GapRow` / `EditModeSegmented` / `TableToolbar` / `SchemaBanner` / `ActionButtons` / inputs |
| `src/shared/schemaForm/schemaForm.css` | 文件（由 `table/table.css` 搬迁） | 表单引擎样式；类名仍 `etable-*` |
| `ITableGridProps` / `TablePanelStatus` | 类型（迁址，名字不变） | 网格组件 props 面；素材配置表单直接复用 |

---

## Plan 03-08 — 素材模型层与内置 schema

**要做什么：** 素材侧的纯逻辑：名字 / 路径换算、列表读写、默认值合并、必填校验、schema 优先顺序；以及内置的新引擎 schema。

| 名称 | 种类 | 用途 |
|------|------|------|
| `sanitizeAssetFileName` | 函数 | 清洗上传文件名；分隔符 / `..` / 前导点 / 控制字符 / Windows 非法字符一律拒（防路径穿越） |
| `resolveAssetName` | 函数 | 文件名 → 列表里的素材名（按分类约定去扩展名） |
| `resolveAssetBytePath` | 函数 | 分类 + 素材名 → 字节文件路径 |
| `resolveTranscodedPath` | 函数 | 原路径 + 目标扩展名 → 转码后的新路径 |
| `resolveOriginPath` | 函数 | 原路径 → 「保留旧文件」的改名路径 |
| `readAssetList` | 函数 | 列表正文 → `IAssetListEntry[]`（两种格式；格式不符抛错） |
| `writeAssetList` | 函数 | 条目 → 列表正文（保持原格式与其余键） |
| `renameAssetListEntry` | 函数 | 改某条条目的文件名（转码换扩展名时用） |
| `mergeAssetDefaults` | 函数 | defaults 逐属性合并进新条目配置（不把 `@required` 写进结果） |
| `collectRequiredPaths` | 函数 | 从 defaults 收集 `@required` 必填路径（D-10） |
| `validateAssetConfig` | 函数 | schema + 必填路径 → 可读错误列表 |
| `resolveAssetSchema` | 函数 | 工程 schema → 注入 → 内置；工程 schema 非法时返回 `null`（调用方进错误态） |
| `resolveAssetSchemaPath` | 函数 | 分类 → 该分类的 schema 文件路径（缺省 `${dir}/.schema.jsonc`） |
| `getBuiltInAssetSchema` | 函数 | 按分类种类给内置新引擎 schema；动画 / 字体为空对象 schema（落回「尚未定义任何字段。」空态） |
| `src/asset/schemas/builtInSchemas.ts` / `index.ts` | 文件 / 桶 | 内置 schema 的存放处 |

---

## Plan 03-09 — 图片 → WebP 转码服务

**要做什么：** 用 `OffscreenCanvas` 把图片重新编码成 WebP（不使用 `document`），并给出「当前环境能不能转」。

| 名称 | 种类 | 用途 |
|------|------|------|
| `canUseImageTranscode` | 函数 | 判断环境是否有 `OffscreenCanvas` + `createImageBitmap`；没有就禁用入口 |
| `transcodeImageToWebp` | 函数 | 字节进、WebP 字节出；质量 0–100；不支持 / 产出类型不对都抛错 |
| `IBrowserAssetTranscodeService` | interface | 浏览器转码服务的接口（类必须 implements） |
| `BrowserAssetTranscodeService` | 类 | 把能力探测与两种转码包成可注入对象（音频分支 03-15 接上） |

---

## Plan 03-10 — 素材面板数据层

**要做什么：** 面板本体（类）：切换分类时读列表与文件是否存在，改动留内存，点保存才写盘（保留注释块），字节改动登记屏障。

| 名称 | 种类 | 用途 |
|------|------|------|
| `AssetPanel` | 类（`implements IEditorPanel, IAssetPanel`） | 素材面板：持有分类与内存中的列表 / 配置，读资源、算缺失、手动保存、登记撤销 |
| `IAssetPanelState` | interface（模块内私有） | 分类级内部状态（列表正文 / 前缀 / 条目 / 未保存 / 请求 token） |
| `AssetPanel.loadCategory` | 方法 | 读某分类的列表 + 目录，算出条目与「文件是否存在」 |
| `AssetPanel.save` | 方法 | 把未落盘改动写回列表资源（`serializeTableText`，前缀逐字保留） |
| `AssetPanel.selectCategory` | 方法 | 切换分类并重取 |
| `AssetPanel.registerBarrier` | 方法 | 把一次字节改动登记成带 `barrier` 的撤销条目 |
| `AssetPanel.registerConfigUndo` | 方法 | 把一次配置改动登记成普通（可撤）条目 |
| `AssetPanel.setTarget` / `AssetPanel.getTitle` | 方法 | 设置初始目标 / 生成标签标题（`getTitle` 与 `IEditorPanel.getTitle?` 同名） |
| `createAssetPanelType` | 函数 | 用注入的分类造出 `IEditorPanelType`（能力包只在顶层注册，不自行装配） |
| `ASSET_PANEL_TYPE_ID` | 常量 `'asset'` | 面板类型 id，装配方引用避免各写各的字符串 |
| `src/asset/__tests__/fixtures.ts` | 测试替身 | 内存文件系统 + 已初始化 core + 四个测试分类 + `listText` 工具 |

---

## Plan 03-11 — 面板视图层

**要做什么：** 三栏布局 + 分类导航 + 素材卡片网格 + 详情预览 + 五种状态。

| 名称 | 种类 | 用途 |
|------|------|------|
| `AssetPanelView` | 组件 | 面板外壳：三栏布局 + 状态分发 |
| `AssetToolbar` | 组件 | 顶部工具栏（保存 / 瘦身转码 / 新增素材） |
| `CategoryNav` | 组件 | 左侧分类导航（当前项 `aria-current`） |
| `AssetGrid` | 组件 | 素材卡片网格（缩略图 + 名称 + 缺失标记） |
| `AssetDetail` | 组件 | 右侧详情：名称 / 路径 / 提示 / 预览 / 操作行 |
| `AssetPreview` | 组件 | 按分类预览（位图 / 播放器 / 字体样例 / 动画占位） |
| `useAssetObjectUrl` | hook | 把字节变成可回收的 `blob:` 地址 |
| `src/asset/asset.css` | 样式 | 面板作用域样式（`--editor-*` + `--easset-*`） |

---

## Plan 03-12 — 默认素材选择器

**要做什么：** 给表格 / 未来的 Blockly 一个「选素材」弹窗：按分类列素材、带预览（图片缩略图 / 音频试听 / 动画预览）、多选、返回选中的名字。

| 名称 | 种类 | 用途 |
|------|------|------|
| `loadPickerItems` | 函数 | 按分类读列表 + 生成候选项（图片带 `blob:` 缩略图、音频带 `blob:` 试听地址、动画带预览提示），返回候选项与需回收的地址 |
| `IAssetPickerItems` | interface | 候选项集合 + 需回收的 `blob:` 地址 |
| `IMultiSelectItem.audio` | 可选成员 `string` | 候选项的音频试听地址（`blob:`）；存在时选择器渲染内联试听 |
| `IMultiSelectItem.animation` | 可选成员 `boolean` | 候选项是否有动画预览；为 `true` 时选择器渲染动画预览提示 |
| `MultiSelectModal` 的三类预览渲染 | 改动 | 按 `IMultiSelectItem` 的 `thumbnail` / `audio` / `animation` 渲染缩略图 / 内联 `<audio controls>` / 动画提示；缺省时为普通多选 |
| `AssetCapabilityProvider` | 组件 | 在既有 `CapabilityProvider` 之上补素材能力（分类 + 默认选择器）；装配方包一层即可 |
| `IAssetCapabilityProviderProps` | interface | Provider 的 props（资源访问口 / 分类 / 可选注入选择器 / 既有能力包 / 子节点） |
| `CapabilityProvider` 的透传修正 | 改动 | 补 `asset` 字段并与上层能力包合并，使多层 Provider 不互相吞掉能力 |

---

## Plan 03-13 — 字节生命周期（新增 / 替换 / 删除）

**要做什么：** 上传新增、覆盖替换、确认删除；三种操作立即写字节、都不可撤销（屏障）。

| 名称 | 种类 | 用途 |
|------|------|------|
| `IAssetUpload` | interface | 一次上传的名字 + 字节 |
| `AssetPanel.addAsset` | 方法 | 校验文件名 / 体积 / 同名 → 写字节 → 往列表追加（defaults 合并）→ 标记未保存 → 屏障 |
| `AssetPanel.replaceAsset` | 方法 | 覆盖某素材字节 → 屏障 |
| `AssetPanel.deleteAsset` | 方法 | 删字节 + 从列表移除 → 屏障 |
| `AssetFileInput` | 组件 | 隐藏原生文件选择 + 按钮触发；读字节前拦超限 |
| `AssetDetail.onReplace` | 组件方法（签名改动） | 由无参改为 `onReplace(upload: IAssetUpload): void`——把上传的名字 + 字节交给上层 |
| `AssetToolbar.onAddAsset` | 组件方法（签名改动） | 由无参改为 `onAddAsset(upload: IAssetUpload): void`——把上传的名字 + 字节交给上层 |
| `AssetPanelView` 的字节回调 | 组件 props | 转发 `onAddAsset` / `onReplace`（名字 + 字节）到 `AssetPanel.addAsset` / `AssetPanel.replaceAsset` / `AssetPanel.deleteAsset` |

---

## Plan 03-14 — 每素材配置表单

**要做什么：** 点「配置」后用抽出来的表单引擎在**主区整幅宽度**编辑该素材配置；可撤销重做，手动保存。

| 名称 | 种类 | 用途 |
|------|------|------|
| `AssetPanel.openConfig` | 方法 | 解析 schema、把该素材配置建成行树、进入配置模式（schema 非法 → 错误且不切换） |
| `AssetPanel.closeConfig` | 方法 | 返回素材列表（保留内存改动） |
| `AssetPanel.applyConfigEdit` | 方法 | 改一个字段：写内存 + 登记可撤销条目 + 标记未保存 |
| `AssetConfigView` | 组件 | 配置模式界面：面包屑「← 返回素材列表」+ 错误列表 + `TableGrid` |

---

## Plan 03-15 — 音频 → WebM/Opus（Mediabunny，含安装确认）

**要做什么：** 把音频重新编码成 WebM 容器里的 Opus；依赖 `mediabunny`，安装前必须由用户确认。

| 名称 | 种类 | 用途 |
|------|------|------|
| `mediabunny` | 新运行时依赖 `1.61.6`（进 catalog） | 浏览器内音频解码 / 编码 / 封装（D-20） |
| `canUseAudioTranscode` | 函数 | 用 `canEncode('opus')` 判断能否转；不能就禁用入口 |
| `transcodeAudioToWebmOpus` | 函数 | 字节进、WebM/Opus 字节出（码率 / 采样率可配） |

---

## Plan 03-16 — 转码弹窗与批量编排

**要做什么：** 选素材、调参数、勾「覆盖旧文件」（默认勾选，覆盖要二次确认），批量转换并汇总；改字节 = 不可撤销。

| 名称 | 种类 | 用途 |
|------|------|------|
| `ASSET_WEBP_EXTENSION` | 常量 `'.webp'` | 图片转码后的扩展名 |
| `ASSET_WEBM_EXTENSION` | 常量 `'.webm'` | 音频转码后的扩展名 |
| `AssetPanel.openTranscode` / `AssetPanel.closeTranscode` | 方法 | 打开 / 关闭转码弹窗（仅图片 / 音频分类可用） |
| `AssetPanel.transcodeAssets` | 方法 | 批量编排：读字节 → 转码 → 覆盖或改名保留 → 改列表文件名 → 登记屏障 → 汇总 |
| `TranscodeModal` | 组件 | 转码弹窗（批量选择 / 参数 / 覆盖勾选 / 破坏性二次确认 / 进度） |

---

## Plan 03-17 — 开发宿主接入与门禁收口

**要做什么：** 把素材面板接进开发宿主（种入四个分类的演示数据），跑三包 + 五道门禁，登记人工验收。

| 名称 | 种类 | 用途 |
|------|------|------|
| `src/demo/assetDemo.ts` | 文件 | 开发宿主的素材演示数据与注册函数 |
| `ASSET_DEMO_CATEGORIES` | 常量 | 四个分类的注入描述 |
| `ASSET_DEMO_FILES` | 常量 | 演示列表文件与示例字节（1×1 PNG、合成 WAV、占位动画 / 字体） |
| `registerAssetDemo` | 函数 | 注册素材面板类型 + 订阅「无法撤销」提示，返回注入用的能力对象 |

---

## Plan 03-18 — 配置模式只占中间区域（G-03-1）

**要做什么：** 点「配置」后，配置表格只替换中间的素材区、左侧分类导航仍可见可点；「← 返回素材列表」能退回；演示素材打开配置时不再一进来就报校验失败。

| 名称 | 种类 | 用途 |
|------|------|------|
| `assetConfigLayout.test.tsx` | 测试文件 | 钉住「配置表格的定位祖先就是配置区」「分类导航与返回按钮仍可用」两条回归 |
| `.asset-config-view` / `.asset-config-body` / `.asset-config-breadcrumb` / `.asset-config-errors` | 既有 CSS 类名（补样式） | 配置区的纵向布局；`.asset-config-body` 作为表格绝对定位的**有界祖先**，让表格只在配置区内铺满 |
| 文案「配置尚有未填项」 | 界面文案（替换「配置校验未通过」） | 校验不通过时不再读成「坏掉了」，改为非阻断的提醒；缺项列表与 `data-test-id="asset-config-errors"` 保持不变 |

---

## Plan 03-19 — 素材预览（G-03-2）

**要做什么：** 卡片按分类显示预览（图片本身 / 音频波形图标 / 动画占位 / 字体写「ABC」），右侧详情能看图、听音频、看字体样例；演示数据换成看得见、听得见、真能加载的样本。

| 名称 | 种类 | 用途 |
|------|------|------|
| `AssetCardPreview` | 组件 | 卡片缩略图按大分类分流：图片读字节出图、音频固定波形图标、动画占位、字体渲染「ABC」 |
| `IAssetCardPreviewProps` | interface | 卡片预览的 props（分类 / 路径 / 文件是否存在 / 读字节回调） |
| `AssetFontSample` | 组件 | 用给定 `blob:` 地址为字体写一段样例文字（卡片用「ABC」，详情用「魔塔 Mota 0123456789」） |
| `IAssetFontSampleProps` | interface | 字体样例的 props（字体 `blob:` 地址 / 文本 / 类名） |
| `IAssetGridProps.kind` / `IAssetGridProps.loadBytes` | 新增成员 | 网格需要知道当前分类（决定预览形态）并能按路径读字节 |
| `resolveAssetMime`（扩展） | 既有函数 | 字体分类返回真实字体 MIME（`.ttf` / `.otf` / `.woff` / `.woff2`），不再落到 `application/octet-stream` |
| `.asset-card-preview*` | 新增 CSS 类名 | 卡片内图片 / 波形图标 / 动画占位 / 字体样例的尺寸与居中 |
| `DEMO_FONT_DATA_URL` | 常量（开发宿主） | 以 `?inline` 引入工作区已有的 Fira Code 字体数据地址，供演示字节解码 |
| `createDemoFont`（改写） | 既有函数 | 由占位 8 字节改为上面那份真实字体的字节 |

> `AssetCardPreview.tsx` 内部的 `AssetCardImage` / `AssetCardFont` 只在本文件使用、不导出，故不进入对外命名表。

---

## Plan 03-20 — 枚举标签接口：schema 扩展键与下拉 props（G-03-6 第一步）

**要做什么：** 让 schema 能携带「枚举值 → 中文标签」的映射，并让枚举下拉先接受这个映射；本计划只定契约，不改变任何现有渲染结果（缺省时下拉仍显示原值）。

| 名称 | 种类 | 用途 |
|------|------|------|
| `IEnumTitleMap` | interface（`shared/schemaForm/types.ts`） | 枚举值到显示标签的映射；键是枚举值的字符串形式（数字 `0` → `"0"`，字符串原样），值是给人看的标签 |
| `ITableSchemaNode['x-enum-titles']` | 可选扩展键 `IEnumTitleMap` | 沿用 `x-editor` / `x-control` / `x-order` 的扩展键约定；缺省时行为不变（向后兼容表格既有 schema） |
| `ISelectInputProps.titles` | 可选成员 `IEnumTitleMap` | 把标签映射交给下拉控件；本计划只声明并保证不传时行为不变，渲染映射在 03-21 落地 |

---

## Plan 03-21 — 枚举标签渲染与内置素材标签（G-03-6 第二步）

**要做什么：** 下拉按标签显示、提交时仍写回原值（数字仍是数字）；内置图片 / 音频 schema 补上中文标签，配置表单不再显示裸数字。

| 名称 | 种类 | 用途 |
|------|------|------|
| `IMG_ASSET_READ_TITLES` / `IMG_ASSET_USAGE_TITLES` / `AUDIO_ASSET_TYPE_TITLES` | 常量（`asset/schemas/builtInSchemas.ts` 模块内） | 图片读取方式 / 图片用途 / 音频类型三组枚举标签，供对应字段的 `x-enum-titles` 引用 |
| `selectInput.test.tsx` | 新增测试文件（`shared/schemaForm/__tests__/`） | 钉住「有标签时显示标签、无标签时显示原值、选中后提交的是原值」三条回归 |

> 给出的标签：读取方式 `0 整图 / 1 网格 / 2 逐行动画 / 3 逐列动画 / 4 扫描动画`；用途 `0 常规图 / 1 图块 / 2 图块集`；音频类型 `0 背景音乐 / 1 音效`。

---

## Plan 03-22 — 转码弹窗版面与全局结果提示（G-03-3）

**要做什么：** 转码弹窗的素材列表竖排并在过长时自己滚动，区域之间加分割线、整体不再挤；去掉面板顶部会顶下内容的提示行和常驻绿色提示；转码中在弹窗上写「正在转码」，完成后只用全局 antd `message` 提示，并说明输出格式。

| 名称 | 种类 | 用途 |
|------|------|------|
| `AssetPanel.publish` | 方法（语义变更） | 第二个参数由「写进视图状态、在面板顶部渲染」改为「直接走 antd `message.info` 全局提示」；视图状态不再保存这行文字 |
| `IAssetPanelViewState.message` | 移除的成员 | 顶部提示行的数据来源；移除后顶部不再为任何操作结果顶出一行 |
| `IAssetPanelViewState.transcodeSummary` | 移除的成员 | 转码完成后常驻的绿色 `Alert` 的数据来源；结果改由全局 `message` 呈现 |
| `ASSET_TRANSCODE_IMAGE_FORMAT_HINT` | 常量（`asset/transcode/types.ts`） | 图片转码前的输出格式说明：WebP（`.webp`） |
| `ASSET_TRANSCODE_AUDIO_FORMAT_HINT` | 常量（`asset/transcode/types.ts`） | 音频转码前的输出格式说明：WebM 容器中的 Opus（`.webm`） |
| `ASSET_TRANSCODE_BUSY_TEXT` | 常量（`asset/transcode/types.ts`） | 转码进行中在弹窗上显示的「正在转码…」 |
| `.asset-transcode-section` / `.asset-transcode-format` | 新增 CSS 类 | 弹窗分区与分区之间的分割线；输出格式说明文字 |
| `.asset-transcode-list` / `.asset-transcode-item` / `.asset-transcode-name` | 既有类名（补样式） | 素材列表竖向排列、每项一行、过长时列表自身滚动并出现滚动条 |
| `.asset-transcode-params` / `.asset-transcode-param` / `.asset-transcode-cover` / `.asset-transcode-busy` | 既有类名（补样式） | 参数区、覆盖勾选与「正在转码」行的间距，避免整体拥挤 |

---

## Plan 03-23 — 演示图片数量与尺寸、卡片大小滑块（G-03-4）

**要做什么：** 内置三四十张可见图片（含长方形）方便测滚动与边界；工具栏加一个滑块，直接改变每张素材卡片框（及缩略图）的大小。

| 名称 | 种类 | 用途 |
|------|------|------|
| `DEMO_TEXTURE_COUNT` | 常量 `36`（开发宿主） | 内置图片素材的数量，测试据此断言「三四十张」 |
| `DEMO_TEXTURE_SPECS` | 常量（开发宿主） | 36 张演示图的宽高与色相，含多组长方形，覆盖滚动与不同比例 |
| `IAssetDemoTextureSpec` | interface（开发宿主模块内） | 一张演示图的描述：名字 / 宽 / 高 / 调色板序号；`DEMO_TEXTURE_SPECS` 的元素类型 |
| `createDemoPng` | 既有函数（签名变更） | 由「按文件名返回固定 base64」改为「按 `IAssetDemoTextureSpec` 现场编码 PNG」 |
| `encodePng` / `crc32` / `adler32` / `createPngChunk` | 模块内私有函数（开发宿主） | 生成浏览器可解码的 PNG 字节（8 位 RGBA、无压缩 deflate 块） |
| `DEFAULT_ASSET_CARD_WIDTH` | 常量 `116`（`asset/constants.ts`） | 卡片框宽度滑块默认值（与现有设计一致） |
| `ASSET_CARD_MIN_WIDTH` / `ASSET_CARD_MAX_WIDTH` / `ASSET_CARD_WIDTH_STEP` | 常量 `96` / `240` / `8`（`asset/constants.ts`） | 滑块的范围与步长 |
| `IAssetToolbarProps.cardWidth` / `IAssetToolbarProps.onCardWidthChange` | 新增成员 | 工具栏接收当前卡片宽度并回传滑块变化 |
| `IAssetGridProps.cardWidth` | 新增成员 | 网格按该宽度决定列宽、卡片高度与缩略图尺寸 |
| `.asset-toolbar-size` / `.asset-toolbar-size-slider` | 新增 CSS 类 | 工具栏里滑块与「图标大小」标签的布局 |

---

## Plan 03-24 — 音频源参数探测契约与转码默认值（G-03-5 第一步）

**要做什么：** 为「读源音频原本的采样率 / 码率」定义契约与入口，并把默认值改成 WebP 品质 100、Opus 码率 128 kbps；本计划只给直通实现（返回「读不到」）。

| 名称 | 种类 | 用途 |
|------|------|------|
| `IAssetAudioSourceInfo` | interface（`asset/transcode/types.ts`） | 源音频可读到的采样率（Hz）与码率（bps）；两项都可能缺省（读不到） |
| `probeAudioSource` | 函数（`asset/transcode/audioOpus.ts`） | 读源音频元数据；本计划直通返回 `undefined`（等于「读不到」），03-25 实现真实探测 |
| `ITranscodeModalProps.entries` | 成员（替换 `names`） | 弹窗改收完整条目（名字 + 字节路径），才能按路径读字节做探测 |
| `ITranscodeModalProps.loadBytes` | 新增成员 | 按路径读字节的回调（由面板视图提供），供 03-25 探测源参数 |
| `ASSET_DEFAULT_WEBP_QUALITY` | 常量值 `80` → `100` | 图片转码默认品质改为最高 |
| `ASSET_DEFAULT_OPUS_BITRATE` | 常量值 `96000` → `128000` | 读不到源码率时的回退值改为 128 kbps |

---

## Plan 03-25 — 读源音频参数并作为默认值（G-03-5 第二步）

**要做什么：** 打开音频转码弹窗时读第一条选中素材的采样率 / 码率，能读到就作为默认值；读不到或用户已经改过就保留回退值，不覆盖用户输入。

| 名称 | 种类 | 用途 |
|------|------|------|
| `probeAudioSource` | 函数实现（`asset/transcode/audioOpus.ts`） | 用 Mediabunny 读主音轨的采样率 / 码率；无音轨、解析失败或数值非法时返回 `undefined`，绝不抛出 |
| `audioProbe.test.ts` | 新增测试文件（`asset/transcode/__tests__/`，Node 环境） | 钉住「WAV 能读到 16000 Hz」与「无效字节返回 undefined」两条回归 |
| `transcodeModal.test.tsx` 的探测用例 | 测试（既有新文件） | 钉住「探测结果成为默认值」「探测不到时回退 128000 / 48000」「用户改过的不被覆盖」 |

---

## Plan 03-26 — 缩略图随卡片缩放 + 详情栏图片尺寸（G-03-7 / G-03-8）

**要做什么：** 让卡片里的图片本身跟着「图标大小」滑块缩放，并在图片详情里显示宽 × 高；尺寸用纯字节头解析，不碰 DOM。

| 名称 | 种类 | 用途 |
|------|------|------|
| `IAssetImageDimensions` | interface（`asset/model/imageSize.ts`） | 从图片字节头解析出的像素尺寸，含只读 `width` / `height` |
| `readImageDimensions` | 函数（`asset/model/imageSize.ts`） | 纯字节解析 PNG / GIF / JPEG / BMP / WebP 的宽高；格式不支持、字节不足或尺寸非法时返回 `undefined`，不抛错、不分配像素数组 |
| `AssetImageSize` | 组件（`asset/components/AssetImageSize.tsx`） | 详情栏里的「宽 × 高」一行；按素材路径读字节并解析，没有尺寸时什么也不渲染 |
| `IAssetImageSizeProps` | interface（`asset/components/AssetImageSize.tsx`） | 尺寸行组件的 props：素材路径 + 按路径读字节的回调 |
| `.asset-detail-size` | 新增 CSS 类 | 详情栏尺寸行的 muted / 12px / 等宽数字样式 |
| `imageSize.test.ts` / `assetDetailSize.test.tsx` | 新增测试文件 | 分别钉住「各格式头解析与坏字节」和「图片显示尺寸、其它分类 / 缺失不显示」 |

---

## Plan 03-27 — 开发宿主加入两张 4096² 演示大图（G-03-9）

**要做什么：** 生成两张足够大的演示图，让图片转码的「正在转码」状态肉眼可见；用压缩 PNG 控制内存，绝不生成 32768²。

| 名称 | 种类 | 用途 |
|------|------|------|
| `IAssetDemoFile` | 既有 interface（改为导出，开发宿主） | 一条要 seed 的演示文件：路径 + 文本 / 字节；供新增的大图生成函数作为返回元素类型 |
| `DEMO_LARGE_TEXTURE_WIDTH` / `DEMO_LARGE_TEXTURE_HEIGHT` | 常量 `4096`（开发宿主） | 两张超大演示图的宽高；选 4096 是因为 32768² 的 RGBA 约 4 GiB、8192² 的单缓冲约 268 MiB，都会 OOM |
| `DEMO_LARGE_TEXTURE_SPECS` | 常量（开发宿主） | 两张超大图的名字 `huge-01.png` / `huge-02.png` 与调色板序号 |
| `createLargeAssetDemoFiles` | 函数（开发宿主，返回 Promise） | 串行生成两张压缩 PNG，并返回一份把小图列表覆盖成 38 条的演示文件数组；尺寸参数可被测试改小 |
| `createPngPixels` / `createIhdrData` | 模块内私有函数（开发宿主） | 把 PNG 像素缓冲与 IHDR 数据的生成从 `encodePng` 中抽出，供同步 / 压缩两条编码路径复用 |
| `compressZlibStream` / `encodePngCompressed` | 模块内私有函数（开发宿主） | 用 `CompressionStream('deflate')` 生成 PNG 的 IDAT；缺少该 API 时回退到现有 stored deflate |

---

## Plan 03-28 — 替换字节后预览立即刷新（G-03-10）

**要做什么：** 替换一个素材的文件后，卡片缩略图、右侧预览与图片尺寸要立刻显示新内容，而不是等用户切走再切回。计划给每个素材记一个「字节版本号」，字节被覆盖时加一，预览看到版本变化就重新读取。

| 名称 | 种类 | 用途 |
|------|------|------|
| `IAssetEntry.byteVersion` | 新增可选只读成员（`asset/types.ts`） | 素材字节的版本号；同一路径的字节每被覆盖一次加一（替换 / 原地转码），加载得到的条目缺省视为 0。预览组件把它作为 effect 依赖，从而在替换后重新读取字节 |
| `useAssetObjectUrl` | 函数签名变更（新增第三个参数 `byteVersion`） | 把「字节版本」纳入 effect 依赖；版本变化时回收旧的 `blob:` 地址并重新读取字节。缺省值为 0，未更新的调用点行为不变 |
| `IAssetCardPreviewProps.byteVersion` | 新增成员 | 卡片缩略图接收条目的字节版本 |
| `IAssetPreviewProps.byteVersion` | 新增成员 | 详情预览接收条目的字节版本 |
| `IAssetImageSizeProps.byteVersion` | 新增成员 | 尺寸行接收条目的字节版本，版本变化时重新解析宽高 |
| `IAssetCardBytesProps.byteVersion` | 新增成员（组件内私有 interface） | 卡片内图片 / 字体两个子预览共用的字节版本入参 |
| `assetReplaceRefresh.test.tsx` | 新增测试文件（`asset/__tests__/`） | 回归：同路径替换后，卡片 `src`、详情预览 `src` 与尺寸行立即更新，且不依赖切换选中 |

---

## Plan 03-29 — 非法工程 schema 的可见错误态（G-03-11）

**要做什么：** 工程里的 `.schema.jsonc` 写坏时，点「配置」目前毫无反应。计划把数据层已经记录的错误文案显示成面板内的一条错误条，面板保持打开、其它操作照常。

| 名称 | 种类 | 用途 |
|------|------|------|
| `.asset-panel-error` | 新增 CSS 类（`asset/asset.css`） | 工具栏与三栏主体之间的错误条容器；复用面板已有的边框 / 危险色变量 |
| `asset-panel-error` | 新增 `data-test-id` | 供测试定位「配置无法解析」的可见错误条 |

---

## Plan 03-30 — 同路径转码也遵守「覆盖旧文件」（G-03-12）

**要做什么：** 不勾「覆盖旧文件」时，即使源文件已经是目标扩展名（如 `.webp`），也先把源改名为 `{file}-origin.{ext}` 备份，再把新字节写回原路径；勾选覆盖时才就地替换。只改数据层的写回分支，不新增对外名称。

| 名称 | 种类 | 用途 |
|------|------|------|
| `AssetPanel.transcodeEntry` | 私有方法（行为变更） | `targetPath === entry.path` 时按 `options.coverOrigin` 分流：覆盖 = 就地写回；不覆盖 = 先 `moveResource` 到 origin、再写回原路径；origin 已存在则整项失败 |

> 本计划不引入新导出名；`transcode.uat.test.tsx` 的用例 ⑨ 由「同路径也原地覆盖」改为「同路径不覆盖必须先备份」。

---

## Plan 03-31 — 详情栏显示文件大小（G-03-13）

**要做什么：** 在右侧详情里补一行人类可读的文件大小（如 `12.3 KB`），对图片 / 音频 / 动画 / 字体都显示；图片尺寸行保留。大小与尺寸共用同一次字节读取，因此把 03-26 的独立 `AssetImageSize` 合并进新的文件信息组件。

| 名称 | 种类 | 用途 |
|------|------|------|
| `src/asset/model/byteSize.ts` | 新增文件 | 文件大小格式化的纯函数落点（不碰 DOM、不做本地化） |
| `formatAssetFileSize` | 函数（`asset/model/byteSize.ts`） | 字节数 → 人类可读字符串；1024 进制，B / KB / MB / GB，非 B 单位保留一位小数；负数与非有限值按 0 处理 |
| `AssetFileInfo` | 组件（`asset/components/AssetFileInfo.tsx`） | 详情栏的文件信息：读一次字节，渲染文件大小行；图片额外渲染宽 × 高；字节缺失 / 读取失败时两行都不渲染 |
| `IAssetFileInfoProps` | interface（`AssetFileInfo.tsx`） | 文件信息组件的 props：大分类 / 素材路径 / 字节版本 / 按路径读字节的回调 |
| `.asset-detail-bytes` | 新增 CSS 类（`asset/asset.css`） | 文件大小行的样式；与 `.asset-detail-size` 共用同一条 muted / 12px / 等宽数字规则 |
| `asset-detail-bytes` | 新增 `data-test-id` | 供测试定位文件大小行 |
| `assetDetailBytes.test.tsx` | 新增测试文件（`asset/__tests__/`） | 钉住「四个分类显示大小」「只有图片有尺寸」「缺失 / 坏字节不显示」「版本变化后刷新」「大小与尺寸只读一次」 |
| `byteSize.test.ts` | 新增测试文件（`asset/model/__tests__/`） | 钉住各单位的格式化结果与非法输入的兜底 |
| `AssetImageSize` / `IAssetImageSizeProps` | 移除（并入 `AssetFileInfo`） | 原组件自行读字节、只产出尺寸；现在读取与尺寸解析都并入 `AssetFileInfo`，避免同一份字节为大小和尺寸读两遍 |

> `AssetImageSize.tsx` 删除后，`components/index.ts` 改导出 `./AssetFileInfo`；`readImageDimensions` 与 `imageSize` 模型不变。

---

## 待确认的偏离与口径（请一并过目）

1. **legacy 内置 Schema 由宿主注入，不写进 `editor-impl/src`。** D-08 要求内置两套（legacy + 新引擎），但 `coreEngineNeutral.js` 把 `tower` 等引擎专有词在两包 `src` 里当作违规（连注释也算），legacy 字段名必然含这些词。故包内只放**新引擎**那套内置 schema；legacy 那套由装配方经 `IAssetCategory.schema` 注入，门禁不破、能力仍是引擎无关的。
2. **`asset` 面板类型用工厂 `createAssetPanelType(capabilities)`，不是常量。** 面板类在 `onSwitchIn` 里就要读分类清单才能取数据，而 core 创建面板时不传任何能力（只有 `context` / `instanceId` / `openParam`）。工厂把能力闭包进去，仍然是「顶层注册一个 `IEditorPanelType`」，不违反「能力包不自装配进 core」。
3. **`./table` 不再导出 `.jsonc` 编解码与 schema 类型，改由 `./shared` 导出。** 代码风格禁止「一个文件导出不属于本文件夹的内容」，故不做转发；开发宿主三处导入随之改到 `@motajs/editor-impl/shared`。
4. **`table/types.ts` 保留一行选择性类型再导出**（`export type { … } from '../shared/schemaForm/types'`），沿用该文件已有的 `export type { ITablePreset }` 写法，避免改动表格与开发宿主的既有导入。这是本阶段唯一保留的「转发」，属于对风格规则的有意例外。
5. **转码换扩展名并同步改列表文件名。** 图片 `a.png` → `a.webp`、音频 `a.mp3` → `a.webm`；「不覆盖」时旧文件改名 `a-origin.png` / `a-origin.mp3`。理由：把 WebM 字节塞进 `.mp3` 会让按扩展名取 MIME 的宿主 / 引擎读错。
6. **字节改动立即落盘，列表 / 配置改动手动保存。** 未保存时列表里没有新条目，刷新后不显示（文件仍在，只是没登记）。
7. **默认值（2026-10-19 UAT 修订）：** WebP 质量 **100**；Opus 音频默认取源音频原本的采样率与码率（能读到时），读不到回退 **128 kbps / 48 kHz**；单文件上传上限 32 MiB。
8. **「无法撤销」提示由装配方订阅 `onUndoBlocked` 呈现**（文案常量在 `asset`）。core 不承载界面文案，能力层也不掌控全局快捷键。

---

# 追加批次（2026-10-20，**待用户确认**）

> 本批接在 03-31 之后，编号 03-32…03-37。以下每个 Plan 一节，**全部为待确认状态**：确认后再落进代码。
> 已确认的 03-01…03-31 各节一个字未改；本节只新增名称。

## Plan 03-32 — 追加批次契约：登记标记 + 转码预设（仅类型 / 常量 / 默认值）**待用户确认**

**要做什么：** 给每条素材加一个「是否已登记进 `.list.jsonc`」的必填标记；把转码参数从裸数字升级成三档固定预设 + 一个自定义档，并补三段界面说明文案；图片默认档定为无损压缩（质量 100，不下调）。本计划不碰界面、不碰扫描。

| 名称 | 种类 | 用途 |
|------|------|------|
| `IAssetEntry.registered` | interface 成员，**必填**只读 `boolean` | 该素材是否已登记进 `.list.jsonc`；false = 文件只在分类目录里、不进游戏。必填是为了让「写回只写已登记」有一个不靠缺省值的判据 |
| `AssetImagePreset` | `const enum`（`VolumeFirst` / `Standard` / `Lossless` / `Custom`） | 图片转码档位：体积优先 / 常规压缩 / 无损压缩 / 自定义参数 |
| `AssetAudioPreset` | `const enum`（`SmallestSize` / `VolumeFirst` / `Standard` / `Custom`） | 音频转码档位：最小体积 / 体积优先 / 常规压缩 / 自定义参数 |
| `IAssetImagePresetOption` | interface（`transcode/types.ts`） | 一档图片预设：`id` / `label` / `quality` / `summary`（`summary` 是给人看的一句「WebP 质量 100」） |
| `IAssetAudioPresetOption` | interface（同文件） | 一档音频预设：`id` / `label` / `bitrateKbps` / `sampleRateKHz` / `summary`；**数值用 kbps / kHz** |
| `IAssetAudioCustomOptions` | interface（同文件） | 自定义档的入参：`bitrateKbps` / `sampleRateKHz`，供 03-35 的换算函数使用 |
| `src/asset/transcode/presets.ts` | 新增文件 | 预设表、默认档、自定义档标签、三段说明文案的落点 |
| `ASSET_IMAGE_PRESETS` | 常量（三项） | `体积优先 80` / `常规压缩 92` / `无损压缩 100` |
| `ASSET_AUDIO_PRESETS` | 常量（三项） | `最小体积 64 kbps + 44.1 kHz` / `体积优先 92 kbps + 48 kHz` / `常规压缩 128 kbps + 48 kHz` |
| `ASSET_DEFAULT_IMAGE_PRESET` / `ASSET_DEFAULT_AUDIO_PRESET` | 常量 | 图片默认 `Lossless`（无损压缩 100）、音频默认 `Standard`（常规压缩 128 kbps + 48 kHz）；弹窗从这里取默认档，不自己写死 |
| `ASSET_TRANSCODE_CUSTOM_LABEL` | 常量 `'自定义参数'` | 第四个档位的显示名 |
| `ASSET_TRANSCODE_QUALITY_NOTE` | 常量 | 取舍说明：「质量 / 码率越低，文件越小，但图片会更模糊、声音会更差。」 |
| `ASSET_TRANSCODE_PIXEL_ART_NOTE` | 常量 | 像素风说明：「像素风素材压缩后会明显发糊：素材图建议用「无损压缩」，常规非像素风图片用「常规压缩」通常够用。」（默认档就是无损，说明与默认一致） |
| `ASSET_TRANSCODE_KEEP_ORIGIN_HINT` | 常量 | 不覆盖时的改名提示：「不覆盖旧文件时，源文件会被重命名为「{name}-origin{.ext}」保留，不会被删除。」 |

## Plan 03-33 — 未登记扫描与注册 / 注销数据动作 **待用户确认**

**要做什么：** 找出「分类目录里有、但 `.list.jsonc` 里没有」的文件，把它们变成面板条目；给面板加「注册到游戏」与「注销」两个只改列表的数据动作；保存时只写已登记条目。

| 名称 | 种类 | 用途 |
|------|------|------|
| `src/asset/model/assetScan.ts` | 新增文件 | 扫描规则的落点（纯函数，只按名字判断，不读文件内容） |
| `isAssetOriginFileName` | 函数 | 判断一个文件名是否是 `-origin` 备份（去扩展名后以 `-origin` 结尾） |
| `collectUnregisteredAssetNames` | 函数（`category` + 目录项 + 已登记名字 → 未登记素材名） | 去重、升序；排除隐藏文件、列表 / schema / defaults 文件、`-origin` 备份、目录、已登记名字，以及「名字反推路径对不上」的文件（如动画分类里的 `.png`） |
| `AssetPanel.registerAsset` | 方法（`async`） | 把未登记条目变成已登记：配置来自 defaults 合并、标记未保存；不写盘 |
| `AssetPanel.unregisterAsset` | 方法（`async`） | 把已登记条目变成未登记并清空配置；**不删除、不移动任何文件**；正在配置该素材时先退回浏览态 |
| `AssetPanel.loadCategory` | 方法（行为变更） | 已登记条目之后追加未登记条目（列表文件缺失时同样扫描） |
| `AssetPanel.toListEntries` | 私有方法（行为变更） | 只转换 `registered === true` 的条目，并按过滤后顺序重算 `index` |
| `assetScan.test.ts` | 新增测试文件（`asset/model/__tests__/`） | 扫描规则八条回归 |
| `assetRegistration.test.tsx` | 新增测试文件（`asset/__tests__/`） | 注册 / 注销 / 写回过滤 / 注销时的配置态退出的数据层回归 |

## Plan 03-34 — 未登记黄卡与注册 / 注销界面 **待用户确认**

**要做什么：** 未登记素材的缩略图底色变黄；详情栏按状态给「注册到游戏」或「注销」；注销要连点两次确认；「删除」的文案改成明确说会移除文件并指向「注销」。

| 名称 | 种类 | 用途 |
|------|------|------|
| `is-unregistered` | 新增 CSS 类（`AssetGrid` 卡片根节点） | 未登记卡片的标记类；`entry.registered === false` 时追加 |
| `data-registered` | 新增卡片属性 | `"true"` / `"false"`，供测试与样式之外的程序化判断 |
| `--easset-unregistered-bg` / `--easset-unregistered-fg` | 新增 CSS 变量（`#fffbe6` / `#ad8b00`） | 未登记缩略图的黄色底色与配套的深黄文字色 |
| `.asset-card.is-unregistered .asset-card-thumb` | 新增 CSS 规则 | 只把**缩略图**底色染黄，卡片其余部分保持原样 |
| `IAssetDetailProps.onRegister` / `IAssetDetailProps.onUnregister` | 新增可选成员 | 详情栏把「注册到游戏」/「注销」交给上层 |
| `IAssetPanelViewProps.onRegister` / `IAssetPanelViewProps.onUnregister` | 新增可选成员 | 视图层透传（都带当前选中素材名） |
| `IAssetPanelContainerProps.onRegister` / `IAssetPanelContainerProps.onUnregister` | 新增成员（模块内） | 容器层接到 `AssetPanel.registerAsset` / `AssetPanel.unregisterAsset` |
| `AssetDetail` 的两步注销状态 | 组件内私有 `useState<number>` | 0 = 未打开、1 = 第一个说明框、2 = 第二个确认框；只有第二次确认才调用 `onUnregister` |
| `ASSET_DELETE_CONFIRM_TEXT` | 常量（`asset/constants.ts`） | 删除弹窗文案：明确会移除文件，并提示只想不进游戏请用「注销」 |
| `ASSET_UNREGISTER_CONFIRM_TEXT` | 常量 | 第一个注销说明框：只移除登记与配置、文件保留 |
| `ASSET_UNREGISTER_FINAL_CONFIRM_TEXT` | 常量 | 第二个确认框：配置将永久丢失 |
| `asset-detail-register` / `asset-detail-unregister` | 新增 `data-test-id` | 详情栏两个互斥按钮 |
| `asset-unregister-next` / `asset-unregister-cancel` / `asset-unregister-final-confirm` / `asset-unregister-final-cancel` | 新增 `data-test-id` | 两步注销的四个按钮 |
| `assetUnregistered.uat.test.tsx` | 新增测试文件（`asset/__tests__/`） | 黄卡 → 注册 → 保存 → 注销（两次）→ 保存 → 文件的六条界面回归 |

## Plan 03-35 — 转码预设界面与说明 **待用户确认**

**要做什么：** 弹窗改成选档位（图片默认为无损压缩，音频默认为常规压缩）；只有自定义档才出现数字输入框；音频单位用 kbps / kHz；补上取舍说明、像素风说明与不覆盖时的改名提示；点开始时把档位换算回内部契约。

| 名称 | 种类 | 用途 |
|------|------|------|
| `src/asset/transcode/units.ts` | 新增文件 | 界面边界的单位换算落点 |
| `kbpsToBps` / `khzToHz` | 函数 | kbps → bps、kHz → Hz（四舍五入到整数） |
| `bpsToKbps` / `hzToKHz` | 函数 | 反向换算，供探测结果预填自定义输入框 |
| `resolveImagePresetQuality` | 函数（`transcode/presets.ts`） | 档位 + 自定义质量 → 0–100 的质量（自定义先四舍五入再夹紧） |
| `resolveAudioPresetOptions` | 函数（同文件） | 档位 + 自定义 kbps/kHz → `IAssetAudioTranscodeOptions`（bps / Hz） |
| `asset-transcode-image-preset` / `asset-transcode-audio-preset` | 新增 `data-test-id` | 两组档位选择器（antd `Segmented`，不接受泛型时用 `Radio.Group`） |
| `asset-transcode-effective` | 新增 `data-test-id` | 当前档位实际会用的参数（默认图片档显示 `WebP 质量 100`，音频默认档显示 `128 kbps + 48 kHz`） |
| `asset-transcode-quality-note` / `asset-transcode-pixel-art-note` | 新增 `data-test-id` | 取舍说明（两种分类都显示）与像素风说明（只在图片分类显示） |
| `asset-transcode-origin-hint` / `asset-transcode-origin-example` | 新增 `data-test-id` | 不覆盖时的改名提示与当前选中文件的具体例子（`hero.png → hero-origin.png`） |
| `.asset-transcode-preset` / `.asset-transcode-effective` / `.asset-transcode-note` | 新增 CSS 类 | 档位行、实际参数行与说明文字的排版 |
| `transcodePresets.test.ts` | 新增测试文件（`transcode/__tests__/`） | 换算与档位解析七条单测 |
| `transcodeModal.test.tsx`（重写） | 既有测试文件 | 保留四条版面用例；三条探测用例改为「自定义档」语义；新增档位 / 单位 / 说明 / 转换参数用例 |

## Plan 03-36 — 开发宿主新增素材顶层整合 **待用户确认**

**要做什么：** 在开发宿主里点真实文件选择框新增一张图，保存，再重新切入 / 换核心重开，证明「界面 → 数据层 → 文件」整条链路通。

| 名称 | 种类 | 用途 |
|------|------|------|
| `devHostAssetAdd.test.tsx` | 新增测试文件（`apps/editor-dev/src/__tests__/`） | 新增素材的五条顶层集成用例（含「预置未登记样本可见」） |
| `createHost` / `createHostWithUnregistered` / `openAssetPanel` / `pickFile` / `addAndSave` | 测试文件内私有 helper | 装配宿主（含预置未登记样本的变体）、经外壳打开面板、经真实 `asset-toolbar-add-input` 选文件、新增并保存 |
| `DEMO_UNREGISTERED_TEXTURE_NAME` | 常量 `'unregistered.png'`（`demo/assetDemo.ts`） | 开发宿主预置的未登记样本文件名；它只在分类目录里、不在 `.list.jsonc` 里，供人工验收直接使用 |
| `createUnregisteredAssetDemoFiles` | 函数（`demo/assetDemo.ts`） | 造出那一张 48×48 的样本字节（复用文件内的 `encodePng`） |
| `seedUnregisteredAssetDemo` | 函数（`demo/assetDemo.ts`，`IMemoryBackend` 入参） | 把样本写进注入的内存后端；只由 `main.tsx` 与本计划的测试调用，**不进** `ASSET_DEMO_FILES`（否则既有 36 / 38 条计数断言会失效） |

> 本计划除了测试，只额外改开发宿主的演示数据与入口（`assetDemo.ts` + `main.tsx`），目的是让「未登记素材」在宿主启动时就有一个现成样本；不改 `editor-core` / `editor-impl` 的任何行为。

## Plan 03-37 — 人工验收：新增素材链路 + 注册 / 注销 **待用户确认**

**要做什么：** 在真实浏览器里把两条流程各走一遍，把结论写进 `03-UAT.md`（Tests 4 / 5）；失败则登记新缺口。

| 名称 | 种类 | 用途 |
|------|------|------|
| Tests 4「新增素材链路（开发宿主）」 | `03-UAT.md` 条目 | 选文件 → 卡片 → 保存 → 关闭重开面板 / 切走分类再切回仍在（同一会话内；不要求刷新） |
| Tests 5「未登记素材的注册与注销」 | 同上 | 宿主预置的 `unregistered.png` 黄卡 → 注册 → 保存 → 注销（两次）→ 保存 → 配置消失且回黄卡、文件保留 |
| `G-03-14` / `G-03-15` | 缺口条目（仅失败时） | 分别对应新增链路与注册 / 注销的失败现象 |

---

## 追加批次需要一并确认的口径（**待用户确认**）

1. **`IAssetEntry.registered` 设为必填。** 会顺带改 5 处条目构造点与 4 个既有测试的条目字面量（只补字段、不改断言）。理由是「写回只写已登记」不能靠缺省值兜底。
2. **音频自定义采样率用 kHz 小数表达**（如 `44.1`），换算时 `Math.round(khz * 1000)` 得 `44100`；内部契约仍是 Hz。
3. **未登记候选多一条「名字反推路径必须一致」规则。** 例如动画分类只认 `.anim`，目录里的 `.png` 不会变成未登记素材——否则登记进动画列表会写出对不上的条目。
4. **源音频探测改为只预填「自定义」的两个输入框，不再改预设档。** 03-25 的「探测结果成为默认参数」在预设档位下没有位置；能力保留，落点变成自定义档的初值。
5. **未登记素材不进转码候选。** 它们还没进游戏，转码只会制造一个改名的未登记文件。
6. **注销两个弹窗的文案与按钮**：第一个「取消 / 继续」，第二个「取消 / 确认注销」；两个弹窗都禁用遮罩与 ESC 关闭。
7. **默认档（2026-10-20 复核修订）：图片默认无损压缩（质量 100），不改成 92。** 无损 WebP 本身已经压得够小，而本工程的素材以像素风为主、有损压缩会明显发糊；「常规压缩 92」「体积优先 80」仍保留为可选项。音频默认仍是常规压缩（128 kbps + 48 kHz）。

---

# UAT 追加修复（2026-10-21，**待用户确认**）

> 本节接在 03-37 之后，编号 03-38。只新增名称，已确认的 03-01…03-37 各节一个字未改。
> 本批**纯实现、零公开接口变更**：`IAssetCategory` / `IAssetDetailProps` / `IAssetFileInputProps` 一个都不动，后缀白名单只是面板内置默认值（`03-CONTEXT.md` §G）。
> 下表里标「包内私有」的名称都落在 **`asset/model/internal/`**——这个子目录**没有 `index.ts`**，`model/index.ts` / `asset/index.ts` 也不转发它，所以只被同包文件直接 import，既不构成公开契约，也没有给「桶文件必须导出该文件夹全部导出项」开例外，不需要先走一份纯接口计划。

## Plan 03-38 — 选文件顺序 + 分类后缀白名单 + 未登记黄卡可见 **待用户确认**

**要做什么：** 修「选完文件没反应」（顺序）、给面板内置一份常见后缀白名单（新增 / 替换 / 未登记扫描三处同一套判断）、把未登记的黄色从缩略图底色挪到卡片边框与内描边上并加一个「未登记」标记。注册后「配置不符合该分类的字段定义」按 §I 明确不做。

| 名称 | 种类 | 用途 |
|------|------|------|
| `src/asset/model/internal/assetFileTypes.ts` | 新增文件（`asset/model/internal/`，**包内私有、无桶**） | 后缀白名单的唯一落点：四类内置清单、判定函数、拒绝文案。纯常量 + 裸函数，无状态；放在没有 `index.ts` 的子目录，不被 `model/index.ts` 转发 |
| `ASSET_IMAGE_FILE_EXTENSIONS` | 常量（`readonly string[]`，**包内私有**） | 图片分类的默认可选后缀：`.png` / `.jpg` / `.jpeg` / `.webp` / `.gif` / `.bmp` |
| `ASSET_AUDIO_FILE_EXTENSIONS` | 常量（同类型，**包内私有**） | 音频分类的默认可选后缀：`.mp3` / `.wav` / `.flac` / `.ogg` / `.m4a` / `.aac` / `.opus` / `.webm` |
| `ASSET_ANIMATION_FILE_EXTENSIONS` | 常量（同类型，**包内私有**） | 动画分类的默认可选后缀：`.anim` |
| `ASSET_FONT_FILE_EXTENSIONS` | 常量（同类型，**包内私有**） | 字体分类的默认可选后缀：`.ttf` / `.otf` / `.woff` / `.woff2` |
| `resolveAssetFileExtensions` | 函数（`category` → 后缀数组，**包内私有**） | 当前分类能收哪些后缀：分类自带 `extension` 时**只**返回它，否则转调 `resolveKindFileExtensions`。新增入口与扫描共用 |
| `resolveKindFileExtensions` | 函数（`AssetCategoryKind` → 后缀数组，**包内私有**） | 只按大分类给内置清单。给「手上只有 `kind`、没有分类对象」的 `AssetDetail` 用来自算替换入口的 `accept` 提示，避免为一个提示串新增 props |
| `isAssetFileAccepted` | 函数（`category` + 文件名 → boolean，**包内私有**） | 某个文件名是否属于当前分类：取最后一个点后的后缀、转小写后比对；没有点或点在第 0 位时为 false（`.gitignore` 不算素材） |
| `ASSET_UNSUPPORTED_EXTENSION_PREFIX` | 常量（**包内私有**） | 拒绝文案的前半句：「不支持的素材格式，当前分类只接受：」 |
| `unsupportedAssetExtensionMessage` | 函数（后缀数组 → 文案，**包内私有**） | 拼出给用户看的完整拒绝文案（前缀 + 后缀用「、」连接），由视图交给 `onReject` |
| `assetFileInput.test.tsx` | 新增测试文件（`asset/__tests__/`） | 文件选择顺序的回归：用「活文件列表」替身让清空 `value` 真的把列表清空，钉死「先取文件、后清空」 |
| `installLiveFileList` | 测试文件内私有 helper（两个测试文件各一份同义实现） | 把隐藏的文件选择框换成真实浏览器语义：`files` 返回同一个数组，`value` 被置空时把该数组就地清空 |
| `assetFileTypes.test.ts` | 新增测试文件（`asset/model/__tests__/`） | 四类默认表、`extension` 优先、大小写不敏感、无后缀拒绝、拒绝文案 |
| `--easset-unregistered-strong` | 新增 CSS 变量（`#7a5d00`） | 未登记的深黄色：用于卡片边框、内描边与徽标底色。现有 `--easset-unregistered-fg`（`#ad8b00`）配白字对比度不足，故单独加一个更深的色 |
| `.asset-card.is-unregistered` | 新增 CSS 规则（同名类 03-34 已有，本计划补规则） | 卡片自身的可见标记：`border-color` + `box-shadow: inset 0 0 0 2px`，用内阴影避免加粗边框导致卡片尺寸跳动 |
| `.asset-card-unregistered` | 新增 CSS 类（卡片内的标记节点） | 「未登记」三个字的徽标样式：绝对定位左上角、深黄底、白字、12px |
| `asset-card-unregistered-{name}` | 新增 `data-test-id` | 某张未登记卡片上的标记节点，供测试断言「标记不在缩略图内部、不会被图片盖住」 |

> 本表**没有**新增任何 interface 成员：`IAssetDetailProps` 保持原样（不加 `replaceAccept`），`AssetDetail` 用自己已有的 `kind` 推出替换入口的提示串；`IAssetCategory` 也不加字段。

### 口径（请一并确认，**待用户确认**）

1. **`extension` 优先是「只认它」而不是「再加一个」。** 这与 `collectUnregisteredAssetNames` 里既有的「名字反推路径必须逐字相等」一致：声明了 `.anim` 的分类不会收 `.png`。当前只有动画分类声明了 `extension`，图片 / 音频不受影响。
2. **后缀比较大小写不敏感，名字保留原样。** `.PNG` 会被接受，登记名仍是用户选中的原文件名。
3. **校验点只放三个界面入口（工具栏新增、详情栏替换、未登记扫描），不在 `AssetPanel.addAsset` / `AssetPanel.replaceAsset` 再加一道。** 理由是「什么类型能进这个分类」属于输入策略，不是数据格式不变量；数据层再加一道会产生第二套错误文案，且会挡住宿主 / 测试的程序化调用。若以后要防程序化调用，另起计划给数据层加错误码，不复用界面文案。
4. **拒绝文案放在 `asset/model/internal/assetFileTypes.ts`，不搬进 `asset/constants.ts`。** 它由后缀表拼出来，和后缀表同源才不会改了一处忘了另一处。
5. **黄色用「卡片边框 + 内描边 + 卡级徽标」三件套，徽标必须在缩略图之外。** 底色与内阴影都可能被不透明的 `<img>` 盖住，只有卡片级、绝对定位的节点一定画在图片上面。
6. **徽标文案就是「未登记」。** 放左上角，缺失徽标（`asset-card-missing`）仍在右上角，两者不会重叠。
7. **替换入口的提示由 `AssetDetail` 自己按 `kind` 算，不加 props。** 工具栏沿用 03-11 就有、一直没接线的 `addAccept`（不改名、不删除）；注释 1 里「分类用 `extension` 收窄」时，替换入口的提示会比最终判定宽一档（显示该大类全部后缀），选中后仍由视图按分类拒绝并给出精确清单——只影响选择体验，不影响正确性。
8. **收窄是明确的取舍，不是遗漏。** `.svg`（图片）与 `.oga`（音频）虽然 `resolveAssetMime` 认得，但不在 §G 的建议清单里，因此不再算未登记候选；无后缀文件一律不算候选。副作用：已登记的无后缀素材被「注销」后会从卡片列表消失（字节文件仍在）。若要保住这两类，需要另开计划并先与你确认，不能在本批偷偷加回去。
9. **白名单模块放 `model/internal/` 而不是 `model/`：这是为了同时满足两条项目规则。** `model/` 是有桶的受管目录，规则要求「桶文件一律 `export *`、该文件夹的导出项都要导出」；而白名单必须保持私有。直接放 `model/` 就只有「违反桶规则」或「给桶文件开一个不导出某项的例外」两条路——全仓库目前没有这种例外，不开先例。放进**没有 `index.ts` 的子目录**（`model/internal/`，与既有的 `model/__tests__/` 同为无桶子目录）后：桶规则不适用于它，`model/index.ts` / `asset/index.ts` 也不引用它，公开面保持不变。**不要**在 `model/internal/` 里新建 `index.ts`。
10. **判定只写一次，提示分两处。** 「能不能收」是 `isAssetFileAccepted` 一个谓词（新增、替换、扫描三处都调它）；「选择框提示串」是纯 UI 便利：新增由 `AssetPanelView` 按分类算，替换由 `AssetDetail` 按 `kind` 算。不要为了复用提示串而给 `AssetDetail` 加 props。

---

# 保存模型修订（2026-10-21 第二轮 UAT，**待用户确认**）

> 本节接在 03-38 之后，编号 03-39。只新增名称，已确认的 03-01…03-38 各节一个字未改。
> 本批**纯实现、零公开接口变更**：`IAssetPanel` / `IAssetPanelViewState` / `IAssetPanelViewProps` / `IAssetToolbarProps` / `IAssetCategory` 一个都不动。新增的只有一个**包内私有**状态字段、一个既有私有方法的新参数与返回值变更，以及若干 CSS 变量与类名，所以不需要先走一份纯接口计划。

## Plan 03-39 — 新增 / 注册自动保存 + 切出写盘 + 保存按钮变黄 **待用户确认**

**要做什么：** 用户点「新增素材」或「注册到游戏」时当场把当前分类的 `.list.jsonc` 写盘（第二块面板立刻看到已登记）；面板切出（`onSwitchOut`）时把所有还没落盘的分类一起写盘；有未保存改动时把工具栏「保存」按钮染成黄色；注销 / 删除 / 转码仍按手动保存；写盘失败时保留未保存标记并报错。随后按新口径重走两条人工验收并收口 `03-UAT.md`。

| 名称 | 种类 | 用途 |
|------|------|------|
| `IAssetPanelState.loaded` | 新增字段（`assetPanel.ts` 内**包内私有**接口） | 「该分类是否已经成功读过一次」。守卫的唯一依据：没读过、或读失败（`AssetPanel.setError` 清空 `entries`）时，内存不能代表磁盘，写盘会把整份列表覆盖成一条或空表 |
| `AssetPanel.autoSaveCategory` | ~~新增私有方法~~ **取消（不会出现在代码里）** | 最初设想在自动保存处加一层包装，后改为「两个调用点各自 `await AssetPanel.writeCategory(...)`」，并把守卫收进 `writeCategory`——少一层间接，守卫只剩一处。保留这一行只为说明它**不会**被实现 |
| `AssetPanel.writeCategory` | 既有私有方法，签名与职责变更 | 新增第 4 个可选参数 `successNotice`（成功提示文案），返回值从 `void` 变成 `Promise<boolean>`（写成功与否）；**`loaded` 守卫落在它开头**——它是唯一写盘点，自动保存 / 手动保存 / 切出写盘三条路径都经由它。全仓只有 `AssetPanel.save`、`AssetPanel.addAsset`、`AssetPanel.registerAsset` 三个调用点 |
| `successNotice` | `AssetPanel.writeCategory` 的第 4 个参数名 | 写成功后给用户的提示；不传就只刷新状态（让保存按钮从黄回到禁用），不弹提示 |
| `AssetPanel.onSwitchOut` | 既有方法，实现变更（空实现 → `await this.save()`） | 面板失去当前状态时写盘全部分类的未落盘改动；不新写一套遍历，没读过的分类由 `AssetPanel.writeCategory` 的守卫挡掉 |
| `AssetPanel.save` | 既有方法，实现变更 | 循环里只收集成功与否，结束后最多弹一次「已保存」；写盘失败或被守卫跳过都不弹成功 |
| `已新增素材并保存` | 提示文案（`AssetPanel.addAsset`） | 替换原来的「已新增素材，请记得保存」——现在不需要用户再点保存 |
| `已注册素材并保存` | 提示文案（`AssetPanel.registerAsset`） | 替换原来的「已注册素材，请记得保存」 |
| `已保存` | 提示文案（`AssetPanel.save`） | 手动保存 / 切出写盘成功后统一一条，不再按分类连弹 |
| `保存失败，改动仍未落盘，请重试。` | 提示文案（`AssetPanel.writeCategory` 的写盘失败分支） | 自动保存与手动保存共用；无论失败的是不是当前分类都要弹全局错误，当前分类再写进面板错误条 |
| `分类尚未读取，未写入列表，请重新加载后重试。` | 提示文案（`AssetPanel.writeCategory` 的 `loaded` 守卫分支） | 没成功读过的分类不写盘时的说明；用全局提示是因为读失败会停在整屏错误态，面板内的错误条会被整屏态吸收 |
| `--easset-unsaved-bg` | 新增 CSS 变量（`#fff1b8`） | 未保存提示的按钮底色 |
| `--easset-unsaved-border` | 新增 CSS 变量（`#d48806`） | 未保存提示的按钮描边色 |
| `--easset-unsaved-fg` | 新增 CSS 变量（`#7a4f01`） | 未保存提示的按钮文字色（深黄，配浅黄底可读） |
| `.asset-toolbar-save` | 新增 CSS 类名（工具栏保存按钮的基础类名） | 给保存按钮一个稳定钩子，不必依赖 antd 生成的哈希类名 |
| `is-unsaved` | 新增状态类名（叠加在 `.asset-toolbar-save` 上） | 有未落盘改动时按钮变黄；没有时不加这个类、按钮仍是普通禁用态 |
| `.asset-panel .asset-toolbar-save.is-unsaved` | 新增 CSS 规则（含 `:hover` / `:focus` 变体） | 用 `.asset-panel` 前缀压过 antd 按钮自身样式优先级；不用 `!important`（黄色只在按钮可点时出现，不与 antd 禁用态竞争） |
| `assetAutoSave.test.tsx` | 新增测试文件（`asset/__tests__/`） | 七条回归：新增 / 注册自动落盘、第二面板看到已登记（各一条）、切出写盘、写盘失败保留未保存、注销不写盘、读失败（`loaded` 为 false）后新增与切出都不写盘 |
| `registerAssetPanel` / `openPanelTab` / `openAnotherPanel` | 测试文件内私有 helper | 注册面板类型并把实例收进数组、在首个标签打开、用 `openBlankTab` 再开一块面板（即「第二个面板实例」） |
| `cardOf` / `registeredOf` / `isDisabled` / `listBody` | 测试文件内私有 helper | 取卡片节点、读卡片的 `data-registered`、判断禁用态、读列表文件正文 |
| `03-38-SUMMARY.md` 台账核对 | 只读核对（不新增、不改写） | 用户已补好这份台账（任务 1–2 完成、第 3 项由 03-39 接替、缺口仍 open、没有 `status` 字段也没有 `resolved_by`）；03-39 只核对口径，不代写、不加 status、不允许把缺口写成 resolved |
| `03-VALIDATION.md` ASSET-01 行 | 修改（`.planning/phases/03-asset/`） | 「Add (upload) → unsaved until 保存」改为「新增 / 注册立即自动写回；注销 / 删除 / 转码 manual-until-save，切出面板一并写盘」，自动命令补上 `assetAutoSave.test.tsx` |

> 本表**没有**新增任何 interface 成员：`IAssetToolbarProps.unsaved` 早就存在、一直是保存按钮的禁用依据，本计划只是让同一个字段再决定类名；`IAssetPanelViewState.unsaved` 也一样。

### 口径（请一并确认，**待用户确认**）

1. **自动保存写的是「当前分类的整份列表」，不是「只追加一条」。** 因此同一分类里那些仍按手动保存的动作（注销 / 删除 / 转码）如果随后遇上一次自动写盘，它们的改动会一并落盘。这是「整份文件」的语义，不表示它们变成了自动保存——测试与 UAT 都按这个口径描述。
2. **`loaded` 守卫必须放在 `AssetPanel.writeCategory`（唯一写盘点），不是放在自动保存的分支里。** 分类没读过（或读失败把 `entries` 清空）时，内存不是磁盘的代表，写盘会把工程里的登记整份覆盖掉；守卫收在写盘点后，`AssetPanel.addAsset` / `AssetPanel.registerAsset` 的自动保存、`AssetPanel.save` 的手动保存、`AssetPanel.onSwitchOut` 的切出写盘三条路径一并受保护。被守卫跳过时用全局提示说「分类尚未读取，未写入列表，请重新加载后重试。」（读失败会停在整屏错误态，面板内的错误条会被整屏态吸收）。
3. **自动保存失败时不弹成功、也不清未保存标记。** 失败文案统一成一句「保存失败，改动仍未落盘，请重试。」；失败的不是当前分类时也要给全局提示（切出写盘正是这种情况）。
4. **黄色只管工具栏那个保存按钮，不动配置视图里共用的保存按钮。** 后者来自 `shared/schemaForm/components/TableGrid`，是与 Phase 2 表格能力共用的组件，改它会波及表格面板；工具栏按钮在浏览态与配置态都可见，已经覆盖两种模式。
5. **「第二个面板看到已登记」必须来自磁盘。** 不允许把面板状态提到模块级单例来共享内存；测试里让第二块面板重新 `onSwitchIn` → 从磁盘读，并同时断言列表文件正文。
6. **`03-38-SUMMARY.md` 归用户维护，本计划只核对。** 该文件已由用户补好（任务 1–2 完成、第 3 项由 03-39 接替、缺口仍 open），它没有 `status` 字段——不要替它加，更不要改成 `halted`：03-39 的 `depends_on` 指名 03-38，halted 会让 03-39 被自动判成 blocked。若核对时发现它把缺口写成了 resolved，停下来报告，不要自己重写。

