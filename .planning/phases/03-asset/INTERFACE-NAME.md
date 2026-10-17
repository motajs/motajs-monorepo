# Phase 3 — 接口与命名确认 / 素材管理

**Status:** 待用户确认（项目规则：重要命名先确认，确认后才可写入代码）
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
| `IAssetTranscodeKind` | `const enum`（`ImageWebp` / `AudioOpus`） | 两种瘦身转码动作 |
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
| `AssetPanel.setTarget` / `AssetPanel.buildTitle` | 方法 | 设置初始目标 / 生成标签标题 |
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

**要做什么：** 给表格 / 未来的 Blockly 一个「选素材」弹窗：按分类列素材、缩略图、多选、返回选中的名字。

| 名称 | 种类 | 用途 |
|------|------|------|
| `loadPickerItems` | 函数 | 按分类读列表 + 生成候选项（图片分类带 `blob:` 缩略图），返回候选项与需回收的地址 |
| `IAssetPickerItems` | interface | 候选项集合 + 需回收的 `blob:` 地址 |
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

## 待确认的偏离与口径（请一并过目）

1. **legacy 内置 Schema 由宿主注入，不写进 `editor-impl/src`。** D-08 要求内置两套（legacy + 新引擎），但 `coreEngineNeutral.js` 把 `tower` 等引擎专有词在两包 `src` 里当作违规（连注释也算），legacy 字段名必然含这些词。故包内只放**新引擎**那套内置 schema；legacy 那套由装配方经 `IAssetCategory.schema` 注入，门禁不破、能力仍是引擎无关的。
2. **`asset` 面板类型用工厂 `createAssetPanelType(capabilities)`，不是常量。** 面板类在 `onSwitchIn` 里就要读分类清单才能取数据，而 core 创建面板时不传任何能力（只有 `context` / `instanceId` / `openParam`）。工厂把能力闭包进去，仍然是「顶层注册一个 `IEditorPanelType`」，不违反「能力包不自装配进 core」。
3. **`./table` 不再导出 `.jsonc` 编解码与 schema 类型，改由 `./shared` 导出。** 代码风格禁止「一个文件导出不属于本文件夹的内容」，故不做转发；开发宿主三处导入随之改到 `@motajs/editor-impl/shared`。
4. **`table/types.ts` 保留一行选择性类型再导出**（`export type { … } from '../shared/schemaForm/types'`），沿用该文件已有的 `export type { ITablePreset }` 写法，避免改动表格与开发宿主的既有导入。这是本阶段唯一保留的「转发」，属于对风格规则的有意例外。
5. **转码换扩展名并同步改列表文件名。** 图片 `a.png` → `a.webp`、音频 `a.mp3` → `a.webm`；「不覆盖」时旧文件改名 `a-origin.png` / `a-origin.mp3`。理由：把 WebM 字节塞进 `.mp3` 会让按扩展名取 MIME 的宿主 / 引擎读错。
6. **字节改动立即落盘，列表 / 配置改动手动保存。** 未保存时列表里没有新条目，刷新后不显示（文件仍在，只是没登记）。
7. **默认值：** WebP 质量 80；Opus 96 kbps / 48 kHz；单文件上传上限 32 MiB。
8. **「无法撤销」提示由装配方订阅 `onUndoBlocked` 呈现**（文案常量在 `asset`）。core 不承载界面文案，能力层也不掌控全局快捷键。
