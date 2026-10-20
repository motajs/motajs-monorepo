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

## 待确认的偏离与口径（请一并过目）

1. **legacy 内置 Schema 由宿主注入，不写进 `editor-impl/src`。** D-08 要求内置两套（legacy + 新引擎），但 `coreEngineNeutral.js` 把 `tower` 等引擎专有词在两包 `src` 里当作违规（连注释也算），legacy 字段名必然含这些词。故包内只放**新引擎**那套内置 schema；legacy 那套由装配方经 `IAssetCategory.schema` 注入，门禁不破、能力仍是引擎无关的。
2. **`asset` 面板类型用工厂 `createAssetPanelType(capabilities)`，不是常量。** 面板类在 `onSwitchIn` 里就要读分类清单才能取数据，而 core 创建面板时不传任何能力（只有 `context` / `instanceId` / `openParam`）。工厂把能力闭包进去，仍然是「顶层注册一个 `IEditorPanelType`」，不违反「能力包不自装配进 core」。
3. **`./table` 不再导出 `.jsonc` 编解码与 schema 类型，改由 `./shared` 导出。** 代码风格禁止「一个文件导出不属于本文件夹的内容」，故不做转发；开发宿主三处导入随之改到 `@motajs/editor-impl/shared`。
4. **`table/types.ts` 保留一行选择性类型再导出**（`export type { … } from '../shared/schemaForm/types'`），沿用该文件已有的 `export type { ITablePreset }` 写法，避免改动表格与开发宿主的既有导入。这是本阶段唯一保留的「转发」，属于对风格规则的有意例外。
5. **转码换扩展名并同步改列表文件名。** 图片 `a.png` → `a.webp`、音频 `a.mp3` → `a.webm`；「不覆盖」时旧文件改名 `a-origin.png` / `a-origin.mp3`。理由：把 WebM 字节塞进 `.mp3` 会让按扩展名取 MIME 的宿主 / 引擎读错。
6. **字节改动立即落盘，列表 / 配置改动手动保存。** 未保存时列表里没有新条目，刷新后不显示（文件仍在，只是没登记）。
7. **默认值（2026-10-19 UAT 修订）：** WebP 质量 **100**；Opus 音频默认取源音频原本的采样率与码率（能读到时），读不到回退 **128 kbps / 48 kHz**；单文件上传上限 32 MiB。
8. **「无法撤销」提示由装配方订阅 `onUndoBlocked` 呈现**（文案常量在 `asset`）。core 不承载界面文案，能力层也不掌控全局快捷键。
