# Phase 04.3 — 接口与命名提案 / 资源写入缓冲与表格自动保存

**Status: 已确认** —— 用户于 2026-10-30 以文字回复「确认」，未提出任何改名。本文记录的是**最终名称**，Plan 02…13 只按这些名字落地，不再另造同义形状。

**Scope:** 本阶段 Plan 02…13 会新建 / 改动的全部对外名称，以及研究点名、留给接口计划拍板的七组契约结论。前序阶段已锁定的名称（`IResourceSystem` / `IResourceSystemAccess` / `IResourceStore` / `IResourceAccess` / `IResource` / `IEditorPanelContext` / `IEditorPanel` / `IResourceSystemHooks` / `IEditorFileChange` 等）不重复登记，只登记它们的**新增**成员。

**约定:** 类上的方法写 `类名.方法名`（如 `WriteBuffer.schedule`），接口方法写 `接口名.方法名`（如 `IResourceSystem.flushAllContent`），自由函数写裸名（如 `isSameResourceContent`、`deriveSchemaPath`）。每个名字先说明「它是干什么的」，再给名字。

> 读法：一节一个计划。每节先一句话说明「这个计划要做什么」，再给一张「名称 / 种类 / 文件位置 / 用途」表。
> 若某个名字不合适，直接在对话里指出；改名时先改本文，再进入 Plan 02 / Plan 03。

---

## 全局约定（先读这一节）

| # | 约定 | 具体口径 |
|---|------|----------|
| G1 | 方法引用 | 一律 `类名.方法名` 或 `接口名.方法名`（例如 `WriteBuffer.schedule`、`IEditorPanelContext.flushResource`）；只有**自由函数**写裸名（例如 `isSameResourceContent`、`isEditableFieldElement`、`deriveSchemaPath`）。禁止出现裸方法名。 |
| G2 | 接口成员只读 | 接口成员**默认 `readonly`**；只有外部确实需要直接修改的才非 `readonly`。本阶段唯一的例外是缓冲条目的 `timer` / `inFlight` / `error` 三个成员——它们要在写盘结算时回写，其余（含 `content` / `version` / `externallyChanged`）全部 `readonly`，改动时整条替换。 |
| G3 | 枚举形态 | 一律 `const enum` + **数字**成员 + **大驼峰**成员名（照 `EditorFileChangeKind` / `PanelCloseChoice`）；不用字符串枚举、不用全大写成员。本阶段不新增枚举，但若实现时确实需要（例如表示某个动作的结果），必须照此形态。 |
| G4 | 类型导入 | **禁止 `import type`**；类型再导出用 `export type`。 |
| G5 | 文件头注释 | **不写文件头注释**。文件级说明写在 import 之后、正式代码之前；桶文件不写注释。 |
| G6 | 桶文件 | 一律 `export *`，**不跨目录深路径转发**；`resource/index.ts` 只加一行 `export * from './writeBuffer';`。 |
| G7 | 模块级状态 | 模块级只允许**字面量**常量（`FLUSH_DEBOUNCE_MS = 5000` 合规，对象 / 数组字面量要 `Object.freeze(...)`）；`Map` / `Set` / 定时器表**必须是实例字段**，不得出现在模块级（结构门禁会拦）。 |
| G8 | 页面事件 | `editor-core` 与 `editor-impl` 的任何文件（**含测试**）都不得出现 `document` / `navigator` 全局；页面事件一律挂在 `window` 上（`beforeunload` / `pagehide` / `blur`），这是 O3 的结论。 |
| G9 | 路径口径 | 全部路径都是「相对项目根、以 `/` 分隔、无前导斜线、不含 `..` 段」的规范化相对路径；缓冲的键就是 `IResourceIdentifier`，**不新增任何路径来源**。 |
| G10 | 换行与命名 | 全部新文件用 **LF**；代码文件名小驼峰；测试文件名 `xxx.test.ts` / `xxx.test.tsx`；Markdown 文件名连字符。 |
| G11 | 纯函数与类 | 纯函数保持裸函数（`isSameResourceContent` / `isEditableFieldElement`），只有有状态的缓冲才写成类（`WriteBuffer implements IWriteBuffer`）；每个类都必须先有 `interface` 再 `implements`。 |
| G12 | 不用字符串做键 | 状态 / 种类 / 结果一律用枚举或数字；只有「字符串本身就是内容」（路径、事件名、`data-test-id`、日志 id）才用字符串字面量。 |

---

## 七组契约的落实决策（先读这一节）

> 这一节把研究点名、D-xx 明确留给接口计划拍板的七件事一次给定。每条先给一句外行看得懂的话，再给「为什么这样定」。Plan 02 / 04 / 05 / 06 / 07 / 08 / 10 只按这一节落地，不再二次拍板。

### ① 缓冲条目与它的类型

**人话：** 一条路径的待写内容不散着放，而是打包成一条记录：内容、自增版本号、5 秒定时器句柄、正在写的那一次、上次失败原因，外加一个「外部已经改过它」的标记。改动时**整条替换**，不就地改字段。

**为什么这样定：** 整条替换能让「写盘期间又写了一次」这件事靠版本号判出来——`ResourceContent` 是 `string | Uint8Array`，`!==` 对字节是**引用比较**，如果复用同一个 `Uint8Array` 实例就会漏判（研究 §Q2.3 第 1 条）。版本号是数字，比较可靠。整条替换还让「外部已改」标记自然回到假，不需要额外的清理代码。

### ② 立刻写盘 / 全量写盘 / 待写查询的签名与归属

**人话：** 面板只需要两个动作——「这条路径立刻写盘」（`IResourceSystemAccess.flushContent`，面板通过 `IEditorPanelContext.flushResource` 转发看到）与「丢掉这条路径的待写」（`IResourceSystemAccess.discardPendingContent` / `IEditorPanelContext.discardPendingResource`）；再加上「订阅待写变化」（`IResourceSystemAccess.watchPendingChange` / `IEditorPanelContext.watchPendingChange`）。外壳与收口路径只需要三个——「全部写盘」（`IResourceSystem.flushAllContent`）、「有没有待写」（`IResourceSystem.hasAnyPendingContent`）、「有哪些路径待写」（`IResourceSystem.listPendingPaths`）。

**返回形态（现在定死）：**

- `IResourceSystemAccess.flushContent` → `Promise<void>`；幂等：这条路径没有待写时直接成功，调用方不必先查 `IResourceSystem.hasAnyPendingContent`。
- `IResourceSystem.flushAllContent` → `Promise<void>`：逐条尝试，**失败不阻止其它路径写盘**；全部尝试完再把**第一条**失败抛给调用方。外壳与释放路径自己 catch 并记 `resource.flushFailed`。
- `IResourceSystem.hasAnyPendingContent` → `boolean`；`IResourceSystem.listPendingPaths` → `readonly string[]`（返回新数组，不外泄内部引用）。

**为什么这样定：** 三者都**不挂在单个资源句柄上**——`IResource` 只有一个实现（`Resource`），在它上面再挂一个写盘入口就会出现两个落盘通道。全量写盘刻意不挂在「某条路径」上，因为它天生是跨路径的。`IResourceSystem.flushAllContent` 用「全部尝试 + 抛第一条」而不是 `Promise.all`，是因为一条磁盘写失败不该让别的路径的改动一起卡在缓冲里。

### ③ 合并通知走哪条钩子

**人话：** 一次写入之后不要立刻喊「文件变了」，攒 50 毫秒喊一次；这条通知**复用既有的两条通道**（`IResourceSystemHooks.onResourceChange` 与 `IResourceSystemHooks.onUpdateResource`），**不新增第三条钩子**，一次定时器里只投递一次、只投递 `EditorFileChangeKind.Change` 这一种变化。合并定时器「首次排程后不重置」：从第一次写入起 50 毫秒必发一次，期间的写入并进去。

**为什么这样定：** 新增第三条钩子会让每个面板面临「三条通道该实现哪一条」的选择，而地图 / 素材的 `IResourceSystemHooks.onUpdateResource` 目前就是空实现；复用既有通道则 `core.test.ts` 的旧断言继续成立，表格 / 资源管理器本来就用 `IResourceSystemHooks.onResourceChange`。**这条通知取代 04.2 的 D-14「自己写完不再通知」**（仅限「缓冲写入」这一条路径），04.2 的基线比较去重继续保留（它仍然吞掉重复通知）。地图 / 素材**没有**实现 `IEditorPanel.onResourceChange`，外壳的既有回退分支继续负责它们（研究 §Q3.2 / §Q3.4），因此合并通知**只投给声明了 `IEditorPanel.onResourceChange` 的面板**，不退化成预读——否则对二进制路径调 `IEditorFileSystem.readFile` 会抛错、被 `resource.hookFailed` 吞掉，变成日志噪音。定时器不重置的理由见第五项取舍。

### ④ 外部写入来源判定（方案 A：不引入来源标识）

**人话：** 不引入「这条写入是谁写的」这种标记，也不改宿主文件变化事件的载荷。同面板两栏与外部写入靠两条**既有事实**区分：

- **(a) 写者自己那一栏：** 写入返回后立刻把该栏基线推成刚写出的原文，50 毫秒通知到达时内容与基线相同即被吞掉。
- **(b) 同面板其它栏：** 若收到的内容与「本面板其它栏刚刚写出的那一份」相同，判为同面板自写，只刷新或保留草稿、**永不弹冲突**；内容不同才是外部写入，仍按既有规则「脏则提示、不脏则正常载入」。

**为什么这样定：** 这**不是**「用字符串比较冒充来源」（D-25 禁止的是后者）：比较的是「这内容是不是本面板刚刚写出去的那一份」，而不是猜「是谁写的」。它同时保住了 04.2 已落地并测试过的基线去重机制（研究 §Q4.4），也与 `04.2-19` 已定的「不要新增『自写标记』之类的旁路状态」同向。**本条取代 `04.3-RESEARCH.md` 责任图第 145 行「来源判定在资源层写日志」**：分层没有变化——资源层仍负责缓冲、落盘与通知，面板只消费通知并做内容比较——只是把判定从「写日志」换成「比对最近一次自己写出的内容」。判定落在面板上，不落到资源层，也不新增第二条钩子。

### 外部写入不得被待写遮蔽（D-16 的落实机制）

**人话：** 外部把文件改了的时候，内存里那份还没落盘的旧内容不能挡在前面让编辑器看不见外部变化；但也**不能**直接丢掉它（丢掉就等于把用户刚确认的改动扔了）。

**机制：** 外部变化到达（宿主的文件变化事件，以及测试里模拟外部变化的「失效缓存 + 通知」入口）时，若该路径还有待写内容，就**在这条待写自己的条目上**把 `IWriteBufferEntry.externallyChanged` 置真（由 `ResourceSystem.noteExternalWrite` 调 `WriteBuffer.noteExternalWrite` 完成）。这个标记是**条目上的一个布尔字段**，不是另开一个「已被标记的路径集合」——条目每次被自己的写入整条替换时标记自然回到假，因此一次外部冲突不会让该路径永久读不到待写。

条目本身**保留**（它仍然是「有内容没落盘」的证据，面板据此仍算未保存），但两件事同时生效：

1. **取消它的 5 秒自动落盘**，免得 5 秒后把外部写入静默覆盖；
2. **读取回落到磁盘**（`WriteBuffer.readPending` 对已标记条目返回空），于是面板拿到的是外部内容，既有的冲突规则（脏则提示、不脏则正常载入）原样生效。

自己写盘引起的宿主回声要能识别出来并**不标记**：判据是「磁盘上的内容等于本缓冲最近一次自己写出去的内容」（`WriteBuffer.lastWritten` + `isSameResourceContent`）。

**标记清掉 5 秒定时器之后不会自己装回来。** 这条路径的自动落盘到此为止，只能由用户在冲突弹窗上明确表态来结算（用户 2026-10-29 定稿，取代先前的「保留后重新写一次缓冲」）。两个动作点哪个都立刻生效：

- **(1)「保存编辑器的」** —— 表格面板把该栏内容重新排进缓冲，并**立刻**把该路径待写写盘（显式覆盖外部修改），待写条目与「外部已改」标记一起消失，右上角提示随之更新。实现落点：`TablePanel.keepExternalConflict`；实现要点是先按冲突路径把该栏放回「未落盘」（`TablePanel.saveDocument` 在 `wroteData` / `wroteSchema` 都为假时提前返回，不先放回就是空转），再走 `TablePanel.saveColumn` 写缓冲，再 `IEditorPanelContext.flushResource`。基线由 `TablePanel.saveDocument` 既有那一句推进，随后的宿主回声继续被忽略。
- **(2)「保存外部修改」** —— 丢弃该路径待写、同时失效该路径内容缓存，面板按收到变化时记下的外部原文重新载入。**不要**在这一支里重新读磁盘：磁盘可能已被在途写盘覆盖。实现落点：`TablePanel.discardExternalConflict` → `IEditorPanelContext.discardPendingResource`。

用户没表态之前**一个字节都不写**：待写条目保留、面板仍算未保存、右上角提示与 `beforeunload` 继续生效、该路径没有 5 秒自动落盘。因此不存在「保留之后定时器装不回来」的中间态——冲突路径只由弹窗结算。

**弹窗不在用户打字时抢焦点：** 冲突到达时立刻记进栏状态（未保存标记必须马上正确），但若该面板正有字段处于「已聚焦未失焦 / 未回车确认」，弹窗推迟；字段失焦或回车确认的那一刻立刻弹。机制落在 `editor-impl` 的面板视图上：根 `etable-columns` 的 React 焦点事件属性 `onFocus` / `onBlur` 经视图回调报给面板（`ITablePanelViewProps.onFieldEditingChange` → `TablePanel.setFieldEditing`），判定元素是否为可编辑字段用模块级裸函数 `isEditableFieldElement`；只用一个布尔，不碰 `document` / `navigator`（两个包都禁），也不动表格组件的 props。两个解除入口：① 失焦经视图回调；② **一次确认提交**由 `TablePanel.applyEdit` 自己解除——数字框按回车确认后不失焦，只靠失焦事件永远等不到「停手」；文本域里回车是换行、不算停手，所以不能改用按键判定。焦点在工具栏按钮或表格空白上不算「正在打字」。

**其余两条恢复路径不变：**

1. **任何一次自己的写入** —— `WriteBuffer.schedule` 整条替换条目，标记随替换清假、新定时器装上。
2. **回声分支** —— 不改内容、不改版本号、不置标记，但**重排一次 5 秒定时器**（先清后装），免得一次回声把自动落盘弄丢。
3. **成功写盘** —— 版本号未变则删条目（标记随之消失）；版本号已变则保留条目、清假标记并重排定时器。
4. **在途写盘** —— 期间到达的外部变化不取消那次写盘；整条替换条目时必须原样保留 `inFlight` 与 `error` 两个字段（否则同一个路径会出现第二个在途写盘），结算时标记优先（见 `## Plan 04`）。

**为什么不选「丢掉待写再重读」（一句话）：** 自动保存之后草稿已经不脏，丢掉待写会让这一栏被当成干净而静默载入外部内容，用户刚确认的改动直接消失，同时「脏则提示」也永远触发不了；保留待写正是为了让「有待写 = 未保存」这条 D-11 口径在外部变化时依然成立。**为什么不选「先落盘再比较」：** 那等于用本地内容覆盖外部写入，D-16 要求外部写入必须被看到。

**与决策的关系：** 落实 D-16；与 D-03（5 秒）、D-07（失败保留待写）、D-08（关闭三态）、D-14（打字时不打断）、D-11（有待写即未保存）、D-25（不得用字符串比较冒充来源）同时生效。

### ⑤ 页面生命周期事件集合

**人话：** 三个事件，全挂在 `window` 上——关闭页面时若有待写就弹浏览器原生确认（`beforeunload`，处理函数 `ShellSystem.beforeUnloadHandler`）；页面即将卸载 / 进往返缓存时尽力写一次盘（`pagehide`，处理函数 `ShellSystem.pageHideHandler`）；窗口失焦时也尽力写一次盘（`blur`，处理函数 `ShellSystem.windowBlurHandler`）。**不使用 `document`，不使用 `visibilitychange`。**

**为什么这样定：** `document` 在 `editor-core` 与 `editor-impl` 的结构门禁里被禁（含测试），而判断「页面是否隐藏」最直接的写法要读 `document.hidden`；`pagehide` 是 `window` 上的等价意图（覆盖「离开页面 / 进往返缓存」），不破门禁（O3 / D-18 / D-19）。写盘在缓冲为空时是空操作，因此失焦带来的噪声可忽略。`beforeunload` **只承诺「弹框」、不承诺「写完」**——浏览器不会等异步写盘，这一点必须写进 UAT，不能讲成「保证不丢数据」。

### ⑥ 外壳待写视图状态与刷新触发

**人话：** 外壳视图状态加一个布尔 `IShellViewState.hasPendingWrite`（菜单行 props 对应 `IMenuRowProps.hasPendingWrite`）；资源层在「有待写」这件事发生变化时通过 `IResourceSystemHooks.onPendingChange` 通知一次，外壳订阅后重渲染。

**为什么这样定：** 外壳根组件只收纯 props（组件不直接问资源系统），所以字段必须走 `ShellSystem.buildViewState` → props → `MenuRow` 这条既有链。`ShellSystem.notify()` 只在标签 / 面板 / 菜单变化时调用，缓冲状态变化不会触发它，因此必须由资源层主动通知一次，否则提示永远不出现。提示文案固定一条、不拼任何路径、无待写时不渲染任何元素（不是渲染空串——空串会占位并让 `getByTestId` 恒命中），见 D-17。

### ⑦ 表格「未保存」的第二来源

**人话：** 每一栏加一个布尔 `ITablePanelColumn.pendingWrite`，表示「本栏目标路径现在还有待写内容」；它与组件草稿脏取「或」后作为工具栏的未保存状态。

**为什么这样定：** D-11 要求「未保存」同时覆盖「组件草稿脏」和「缓冲有 pending」。这条布尔与 `TablePanel.isColumnDirty` 共用同一份数据（待写也算脏），面板通过 `IEditorPanelContext.watchPendingChange` 订阅「待写变化」并重发视图；订阅时资源层会立刻回调一次当前待写集合（见 `PendingChangeListener` 的契约），5 秒自动写盘完成后该标记会自动消失。

---

## 不缓冲的边界（写死）

| 动作 | 是否走缓冲 | 依据 |
|------|------------|------|
| 新建资源（`ResourceSystem.createResource` / `IEditorPanelContext.createResource`） | **不走缓冲，立刻碰磁盘** | O5：新建后紧接着要核对文件是否存在（索引 / 目录列举 / `IEditorFileSystem.fileExists`），「新建后 5 秒内崩掉、文件不见了」比「内容晚 5 秒」难解释得多。 |
| 删除资源（`ResourceSystem.deleteResource`） | **不走缓冲，立刻碰磁盘**；同时丢弃该路径待写并记 `resource.pendingDiscarded` | 否则删掉的文件会在 5 秒后被 `WriteBuffer.flush` 重新写出来。 |
| 移动资源（`ResourceSystem.moveResource`） | **不走缓冲，立刻碰磁盘**；同时丢弃**源路径**待写并记 `resource.pendingDiscarded` | 移动一个「刚改还没落盘」的文件语义本就模糊，丢弃比迁移更可解释（研究 §Q1.3）。 |
| 内容修改（`ResourceSystem.writeContent` / `IResource.write`） | **走 5 秒缓冲** | D-01 / D-03。 |

另外两条一起写死：

- 缓冲只接受**已经过既有路径校验**的资源标识，不新增任何路径来源（`WriteBuffer.flush` 只写缓冲里已有的键）。
- **禁止的修法：** 给 `FakeFileSystem` / `MemoryBackend` 加「写入即同步落盘」后门——那会让缓冲在自动化里永不被验证，bug 会跑到生产。

---

## 九个新测试文件一览

| 测试文件 | 所在包 | 钉住什么 |
|----------|--------|----------|
| `resourceBuffer.test.ts` | `editor-core` | 写入只进缓冲、读命中缓冲、5 秒后磁盘才变、写盘幂等、全量写盘覆盖多路径、查询口径。 |
| `resourceBufferConcurrency.test.ts` | `editor-core` | 并发写盘复用在途那一次、写盘期间再写不丢、失败保留待写可重试。 |
| `resourceNotifyCoalesce.test.ts` | `editor-core` | 50 毫秒内同一路径多次写入只通知一次；两个路径各一次；通知到达时读到的已是缓冲内容。 |
| `shellFlush.test.ts` | `editor-core` | 切标签 / 关标签 / 释放都会把缓冲打到磁盘；写盘失败不影响标签状态机。 |
| `shellPageLifecycle.test.ts` | `editor-core` | `pagehide` 触发写盘；`beforeunload` 在有 / 无待写时分别阻止 / 不阻止卸载。 |
| `shellPendingIndicator.test.tsx` | `editor-core` | 有待写时渲染提示并逐字断言文案；无待写时不渲染任何元素。 |
| `tableAutoSave.test.tsx` | `editor-impl` | 失焦确认后 50 毫秒内别处读得到、5 秒后磁盘才变、保存按钮 = 立即写盘、「未保存」覆盖两个来源。 |
| `twoColumnsSameTable.test.tsx` | `editor-impl` | 同路径两栏：一栏确认后另一栏 50 毫秒内更新；同时确认最后写盘者胜且不弹冲突；另一栏脏时保留自己的草稿。 |
| `devHostAutoSave.test.tsx` | `editor-dev` | 真实宿主端到端：改一格不点保存 → 5 秒后磁盘变；切标签立刻变；关标签显示「正在保存…」后关闭且磁盘是新值。 |

---

## Plan 02 — editor-core 的纯类型声明

**要做什么：** 在 `@motajs/editor-core` 里只加类型、只加语义正确的空实现，一行行为都不接：缓冲条目、缓冲契约、写盘回调类型、资源访问口 / 资源系统 / 资源钩子 / 面板上下文上的新成员、外壳视图状态里的待写布尔。这些成员在缓冲尚未接入时以语义正确的空实现交付（没有待写 → 立刻写盘是空操作、有无待写返回假、路径列表为空、取可读待写内容返回空、外部变化标记是空操作），因此**零行为改动**。

| 名称 | 种类 | 文件位置 | 用途 |
|------|------|----------|------|
| `IWriteBufferEntry` | interface（成员 `readonly content` / `readonly version` / `timer` / `inFlight` / `error` / `readonly externallyChanged`） | `packages/libs/editor-core/src/resource/types.ts` | 把一条路径的待写内容、自增版本号、5 秒定时器句柄、在途写盘与上次失败原因打包成一条只读记录；改动时整条替换，不就地改字段。 |
| `IWriteBufferEntry.externallyChanged` | 条目字段，`boolean` | 同上 | 这条待写是否已经被外部写入挡住：为真时读取回落到磁盘、取消它的 5 秒自动落盘，面板据此仍算未保存；它是**条目上的布尔**，不是另开的路径集合。 |
| `WriteBufferWriter` | type（`(path: string, content: ResourceContent) => Promise<void>`） | 同上 | 把一份内容真正写进磁盘的回调类型；缓冲自己不碰文件系统，只调用注入进来的这个函数。 |
| `IWriteBuffer` | interface | 同上 | 待写表的对外契约：排入、立刻写盘、全量写盘、查询、取可读内容、丢弃、清空、释放、标记外部已改。 |
| `WriteBuffer` | class（`implements IWriteBuffer`） | `packages/libs/editor-core/src/resource/writeBuffer.ts`（新建） | 持有「路径 → 待写条目」那张表的类；不设上限、不做 LRU，只在成功写盘后删条目。 |
| `WriteBuffer.schedule` | 方法，`(path: string, content: ResourceContent) => void` | 同上 | 把一条路径的最新内容排进待写表，并重排它的 5 秒定时器；已存在就整条替换（标记随之回到假）。 |
| `WriteBuffer.flush` | 方法，`(path: string) => Promise<void>` | 同上 | 把某一条路径的待写内容立刻写进磁盘，可以 `await`；没有待写时是空操作。 |
| `WriteBuffer.flushAll` | 方法，`() => Promise<void>` | 同上 | 把所有待写内容逐条尝试写盘，全部尝试完再把第一条失败抛给调用方。 |
| `WriteBuffer.has` | 方法，`(path: string) => boolean` | 同上 | 这条路径现在还有没有内容没写盘。 |
| `WriteBuffer.paths` | 方法，`() => readonly string[]` | 同上 | 现在还有哪些路径没写盘；返回新数组，不外泄内部引用。 |
| `WriteBuffer.size` | 方法，`() => number` | 同上 | 现在一共有多少条待写。 |
| `WriteBuffer.readPending` | 方法，`(path: string) => ResourceContent \| undefined` | 同上 | 只读取待写内容、不触发写盘；该条被标「外部已改」时返回空，让读取回落到磁盘。 |
| `WriteBuffer.discard` | 方法，`(path: string) => void` | 同上 | 丢弃某条路径的待写内容（连同它的定时器），用于「不保存关闭」「保存外部修改」与删除资源。 |
| `WriteBuffer.clear` | 方法，`() => void` | 同上 | 清空整张待写表，不写盘（只用于释放）。 |
| `WriteBuffer.dispose` | 方法，`() => void` | 同上 | 释放缓冲：清掉所有定时器与内部表，避免测试与热重载留下悬挂定时器。 |
| `WriteBuffer.noteExternalWrite` | 方法，`(path: string) => void` | 同上 | 外部内容到达时给这条待写打「外部已改」标记；没有待写时是空操作。 |
| `PendingChangeListener` | type（`(paths: readonly string[]) => void`） | `packages/libs/editor-core/src/resource/types.ts` | 「待写集合变了」的回调类型；订阅时资源层会先回调一次当前待写路径列表。 |
| `IResourceSystemAccess.flushContent` | 接口方法，`(identifier: IResourceIdentifier) => Promise<void>` | 同上 | 资源访问口上的「按路径立刻写盘」：面板与外壳都用这一个入口，不再各自找写盘通道。 |
| `IResourceSystemAccess.discardPendingContent` | 接口方法，`(identifier: IResourceIdentifier) => void` | 同上 | 资源访问口上的「丢弃这条路径的待写」，用于「不保存关闭」与冲突弹窗的「保存外部修改」。 |
| `IResourceSystemAccess.watchPendingChange` | 接口方法，`(listener: PendingChangeListener) => () => void` | 同上 | 资源访问口上的「订阅待写变化」；返回退订函数，订阅瞬间立刻回调一次当前待写路径列表。 |
| `IResourceSystem.flushAllContent` | 接口方法，`() => Promise<void>` | 同上 | 资源系统上的「全量写盘」：切标签、关标签、释放、页面离开都用它；逐条尝试、失败不阻止其它路径。 |
| `IResourceSystem.hasAnyPendingContent` | 接口方法，`() => boolean` | 同上 | 资源系统上的「有没有待写」；右上角提示与 `beforeunload` 只看这一个布尔。 |
| `IResourceSystem.listPendingPaths` | 接口方法，`() => readonly string[]` | 同上 | 资源系统上的「待写路径列表」，只给内部与外壳使用，不把任何路径渲染到界面。 |
| `IResourceSystemHooks.onPendingChange` | 可选接口方法，`() => Promise<void>` | 同上 | 「待写有无」发生变化时通知一次，外壳订阅后重渲染；不新增第二条变化通道。 |
| `IEditorPanelContext.flushResource` | 接口方法，`(identifier: IResourceIdentifier) => Promise<void>` | `packages/libs/editor-core/src/panel/types.ts` | 面板侧「按路径立刻写盘」的转发入口（资源访问口 `IResourceSystemAccess.flushContent` 的一对一转发），表格保存按钮与冲突弹窗用它。 |
| `IEditorPanelContext.discardPendingResource` | 接口方法，`(identifier: IResourceIdentifier) => void` | 同上 | 面板侧「丢弃待写」的转发入口（对应 `IResourceSystemAccess.discardPendingContent`），用于「不保存关闭」与「保存外部修改」。 |
| `IEditorPanelContext.watchPendingChange` | 接口方法，`(listener: PendingChangeListener) => () => void` | 同上 | 面板侧「订阅待写变化」的转发入口（同名转发），表格据此维护每栏「未保存」的第二来源。 |
| `IShellViewState.hasPendingWrite` | 视图状态字段，`boolean` | `packages/libs/editor-core/src/shell/shellSystem.ts` | 外壳视图状态里的待写布尔，决定右上角提示渲染不渲染。 |
| `IMenuRowProps.hasPendingWrite` | props 字段，`boolean` | 同上 | 菜单行新增的 props 成员，由外壳根透传，决定提示元素的出现。 |

**归属与命名口径（写死）：**

- 面板侧刻意用 `IEditorPanelContext.flushResource` / `IEditorPanelContext.discardPendingResource` 两个名字，**不与**资源层的 `IResourceSystemAccess.flushContent` / `IResourceSystemAccess.discardPendingContent` 同名——同义不同层，读代码时能立刻看出「这是面板在请求，不是资源层在实现」。第三项 `IEditorPanelContext.watchPendingChange` 与 `IResourceSystemAccess.watchPendingChange` 逐字同名转发。
- `IResourceSystemAccess` 同时继承 `IResourceSystem` / `IResourceAccess` / `IResourceStore`，因此 `IResourceSystem.flushAllContent` / `IResourceSystem.hasAnyPendingContent` / `IResourceSystem.listPendingPaths` 在访问口上同样可见；这不构成第二个入口，它们都转发到同一个缓冲。
- 缓冲的 `WriteBuffer.flushAll` / `WriteBuffer.discard` / `WriteBuffer.clear` / `WriteBuffer.dispose` / `WriteBuffer.readPending` / `WriteBuffer.noteExternalWrite` 六个名字**一经本文确认即为最终名**，后续计划不再改。

---

## Plan 03 — editor-impl 的纯声明

**要做什么：** 在 `@motajs/editor-impl` 里只追加类型与注释，不接任何行为：表格每栏状态上的待写布尔、面板渲染根上「某个字段正在输入」的可选回调、数字输入控件的提交契约。

| 名称 | 种类 | 文件位置 | 用途 |
|------|------|----------|------|
| `pendingWrite`（`ITablePanelColumn.pendingWrite`） | 栏状态字段，`boolean` | `packages/libs/editor-impl/src/table/tablePanel.ts` | 这一栏的目标路径现在还有没有内容没写盘；初值假，本计划只声明、不读取。 |
| `ITablePanelViewProps.onFieldEditingChange` | 可选 props 成员，`(editing: boolean) => void` | 同上 | 面板渲染根新增的视图参数：视图把「某个可编辑字段正在输入」的布尔报给面板；它是**面板自己的视图参数**，不是 `ITableEditableProps` 的成员，`EditableTable` / `TableGrid` 的 props 一字不改。 |
| `INumberInputProps` 的提交契约 | 既有 props 的 JSDoc（形状不变） | `packages/libs/editor-impl/src/shared/schemaForm/components/inputs/NumberInput.tsx` | 把注释改成「失焦 / 回车 / 清空后才提交一次」，先把契约写清楚；实现留到 Plan 09。 |

---

## Plan 04 — 缓冲本体与读写穿透

**要做什么：** 落 `writeBuffer.ts` 的实现，把 `ResourceSystem.writeContent` 改成「写缓冲 + 写缓存 + 排通知 + 排定时器」，让读取先命中缓冲，接上删除 / 移动 / 释放时与缓冲的联动，并落地「外部已改」标记与两条新日志。

| 名称 | 种类 | 文件位置 | 用途 |
|------|------|----------|------|
| `writeBuffer.ts` | 新文件 | `packages/libs/editor-core/src/resource/writeBuffer.ts` | 待写缓冲本体的落地文件：Plan 02 在这里定契约，本计划在这里写实现。 |
| `WriteBuffer`（实现本体） | 类（`implements IWriteBuffer`，Plan 02 已登记，此处只落实现） | 同上 | 缓冲表、5 秒定时器、在途写盘、失败原因的持有者；所有 `Map` 都是实例字段。 |
| `FLUSH_DEBOUNCE_MS` | 模块级不变常量，`5000` | 同上 | 内容改动后最多等多久把待写写进磁盘。 |
| `NOTIFY_COALESCE_MS` | 模块级不变常量，`50` | 同上 | 一次写入之后最多等多久把「这个路径变了」通知发出去。 |
| `WriteBuffer.lastWritten` | 私有实例字段（`Map<string, ResourceContent>`） | 同上 | 每条路径最近一次自己写出去的原文；宿主回声到达时用它判断「这次变化是不是我的写盘引起的」（配合 `isSameResourceContent`）。 |
| `isSameResourceContent` | 自由函数，`(left: ResourceContent, right: ResourceContent) => boolean` | 同上 | 判断两份内容是不是同一份：字符串按值比、字节按长度 + 逐字节比；不引入哈希库（D-24）。 |
| `ResourceSystem.bufferContent` | 私有方法，`(identifier: IResourceIdentifier, data: ResourceContent) => void` | `packages/libs/editor-core/src/resource/resourceSystem.ts` | 排入待写（同步返回、不碰磁盘），由 `ResourceSystem.writeContent` 调用。 |
| `ResourceSystem.scheduleFlush` | 私有方法，`(identifier: IResourceIdentifier) => void` | 同上 | 安排 / 重排这条路径的 5 秒写盘；每次写入都重排（D-03）。 |
| `ResourceSystem.flushOneContent` | 私有方法，`(identifier: IResourceIdentifier) => Promise<void>` | 同上 | 单路径写盘：拍快照、写盘、写盘期间又写入就保留待写并重排；同一路径复用同一在途写盘。 |
| `ResourceSystem.clearFlushTimers` | 私有方法，`() => void` | 同上 | 释放时清掉所有定时器，避免悬挂定时器与测试泄漏。 |
| `ResourceSystem.noteExternalWrite` | 私有方法，`(identifier: IResourceIdentifier) => void` | 同上 | 外部变化到达时把这条待写标成「外部已改」（条目保留、取消自动落盘、读取回落磁盘）；自己写盘的回声不标记。 |
| `ResourceSystem.writeContent` | 既有方法（改造） | 同上 | 从「立刻 `IEditorFileSystem.writeFile` / `IEditorFileSystem.writeBinary`」改成「写缓冲 + `cache.set` + 排合并通知 + 排 5 秒写盘」，不再 await 磁盘。 |
| `ResourceSystem.readContent` / `ResourceSystem.readBinary` | 既有方法（改造） | 同上 | 读取先查缓冲（`WriteBuffer.readPending`），再查内容缓存，最后回源；字节读取只在缓冲条目类型一致时命中。 |
| `ResourceSystem.deleteResource` / `ResourceSystem.moveResource` | 既有方法（改造） | 同上 | 删除丢弃该路径待写；移动丢弃源路径待写；两者都记 `resource.pendingDiscarded`。 |
| `ResourceSystem.dispose` | 既有方法（改造） | 同上 | 顺序写死：先全量写盘（失败只记日志），再清定时器与表，最后清索引 / 缓存 / `fs` 引用。 |
| `resource.flushFailed` | 日志 id | 同上 | 写盘失败时记的那条日志（没有面板上下文的路径只记日志、不把异常抛给定时器）。 |
| `resource.pendingDiscarded` | 日志 id | 同上 | 删除 / 移动资源时丢弃待写内容所记的日志。 |
| `resourceBuffer.test.ts` | 测试文件（新建） | `packages/libs/editor-core/src/resource/__tests__/` | 钉住「写入只进缓冲、读命中缓冲、5 秒后磁盘才变、写盘幂等、全量写盘覆盖多路径、三种查询口径」。 |
| `resourceBufferConcurrency.test.ts` | 测试文件（新建） | 同上 | 钉住「并发写盘复用在途那一次、写盘期间再写不丢、失败保留待写可重试」。 |
| `externalChange.test.tsx` | 既有测试（迁移） | `packages/libs/editor-impl/src/table/__tests__/` | 把「保存后宿主回声被忽略」改成「点保存 → 显式写盘 → 回送变化」，并补「有待写时外部改文件不被缓冲遮蔽且仍弹冲突框」。 |

**两条实现真值（写死，后续计划只引用）：**

1. 整条替换待写条目时**原样保留** `inFlight` 与 `error`：在途写盘照常完成，结算时标记优先（不删条目、不重排定时器），同一个路径不会出现第二个在途写盘。
2. `WriteBuffer.discard` **同时**失效该路径内容缓存（由 `ResourceSystem` 一侧完成），否则「丢弃后读到的还是旧的待写」。

---

## Plan 05 — 合并通知

**要做什么：** 让写入后的通知按 50 毫秒合并一次，一次定时器只投递一次，走既有通道；并钉住「首次排程不重置」。

| 名称 | 种类 | 文件位置 | 用途 |
|------|------|----------|------|
| `ResourceSystem.scheduleNotify` | 私有方法，`(identifier: IResourceIdentifier) => void` | `packages/libs/editor-core/src/resource/resourceSystem.ts` | 安排一次 50 毫秒的合并通知：首次排程后不重置，期间同路径的写入并进这一次。 |
| `ResourceSystem.emitBufferedChange` | 私有方法，`(identifier: IResourceIdentifier) => Promise<void>` | 同上 | 定时器到点后只投递一次「这个路径的内容变了」（`EditorFileChangeKind.Change`），并沿用 `Hookable.forEachHook` + `resource.hookFailed` 的吞错口径。 |
| `NOTIFY_COALESCE_MS` | 常量（已在 Plan 04 登记，此处只引用） | `packages/libs/editor-core/src/resource/writeBuffer.ts` | 50 毫秒合并窗口。 |
| `resourceNotifyCoalesce.test.ts` | 测试文件（新建） | `packages/libs/editor-core/src/resource/__tests__/` | 50 毫秒内同一路径多次写入只通知一次；两个路径各通知一次；通知到达时读到的已是缓冲内容。 |

**投递范围（写死）：** 合并通知只投给声明了 `IEditorPanel.onResourceChange` 的面板；未声明的（地图 / 素材）**不**退回预读通道，避免对二进制路径 `IEditorFileSystem.readFile` 产生日志噪音。旧通道 `IResourceSystemHooks.onUpdateResource` 的既有语义不变、也不新增第三条钩子。

---

## Plan 06 — 外壳落盘点与页面生命周期

**要做什么：** 把切标签 / 关标签 / 释放这三个既有落盘点接到「全量写盘」上，并在 `ShellSystem.initialize` / `ShellSystem.dispose` 注册 / 注销三个 `window` 页面事件。

| 名称 | 种类 | 文件位置 | 用途 |
|------|------|----------|------|
| `ShellSystem.flushPendingContent` | 私有方法，`() => Promise<void>` | `packages/libs/editor-core/src/shell/shellSystem.ts` | 外壳的「把缓冲写盘」辅助：调 `IResourceSystem.flushAllContent`，失败自己吞掉并记 `resource.flushFailed`，绝不打断标签状态机。 |
| `ShellSystem.beforeUnloadHandler` | 私有字段，`(event: BeforeUnloadEvent) => void` | 同上 | 关闭页面时若有待写（`IResourceSystem.hasAnyPendingContent` 为真）就 `preventDefault` + `returnValue = ''`，弹浏览器原生确认。 |
| `ShellSystem.pageHideHandler` | 私有字段，`() => void` | 同上 | 页面即将卸载 / 进往返缓存时发起一次尽力写盘（不 await、失败只记日志）。 |
| `ShellSystem.windowBlurHandler` | 私有字段，`() => void` | 同上 | 窗口失焦时发起一次尽力写盘；缓冲为空时是空操作，噪声可忽略。 |
| `ShellSystem.initialize` | 既有方法（改造） | 同上 | 注册上面三个 `window` 事件并保存引用；放在这里而不是 React 组件里，避免重挂重复注册。 |
| `ShellSystem.dispose` | 既有方法（改造） | 同上 | 注销三个 `window` 事件；字段形态与 `ResourceSystem` 的退订函数对称。 |
| `ShellSystem.invokeSwitchOut` | 既有私有方法（改造） | 同上 | 顺序铁律「面板 → 缓冲 → 磁盘」：先 await 面板的 `IEditorPanel.onSwitchOut`，随后调 `ShellSystem.flushPendingContent`。 |
| `shellFlush.test.ts` | 测试文件（新建） | `packages/libs/editor-core/src/shell/__tests__/` | 切标签 / 关标签 / 释放都会把缓冲打到磁盘；写盘失败不影响标签状态机。 |
| `shellPageLifecycle.test.ts` | 测试文件（新建） | 同上 | `pagehide` 触发写盘；`beforeunload` 在有 / 无待写时分别阻止 / 不阻止卸载（断言 `defaultPrevented`）。 |

---

## Plan 07 — 右上角待写提示

**要做什么：** 在菜单行末尾追加一条固定文案的待写提示，有 pending 才渲染，无 pending 不渲染任何元素。

| 名称 | 种类 | 文件位置 | 用途 |
|------|------|----------|------|
| `editor-shell-pending` | CSS 类名（`.editor-shell-pending`）与 `data-test-id` 共用的前缀值 | `packages/libs/editor-core/src/shell/shell.css`（样式）+ `packages/libs/editor-core/src/shell/shellSystem.ts`（元素） | 右上角待写提示的样式类与测试标识；样式用 `margin-left: auto` 右对齐、`--editor-muted` 颜色、不换行并省略溢出。 |
| `正在等待保存，请勿关闭页面或浏览器` | 固定文案（逐字） | `packages/libs/editor-core/src/shell/shellSystem.ts` | 有待写时右上角显示这一条；不拼任何路径，无待写时不渲染任何元素。 |
| `shellPendingIndicator.test.tsx` | 测试文件（新建） | `packages/libs/editor-core/src/shell/__tests__/` | 有待写时渲染提示并逐字断言文案；无待写时 `queryByTestId` 为 null（不能渲染空串）。 |

**放置理由（写死）：** 放菜单行不放标签行——标签行 `overflow: hidden` 且标签可压缩，长标签会把提示挤没；菜单按钮是固定宽度，右侧空间稳定。组件里**不直接调资源系统**，`hasPendingWrite` 走 `ShellSystem.buildViewState` → props → 菜单行。

---

## Plan 08 — 表格自动保存与保存按钮

**要做什么：** 字段确认后自动写一次缓冲，保存按钮改成「立刻写盘」，「未保存」接上缓冲待写这个第二来源，并把外部冲突弹窗的两个动作与「停手才弹」落到表格面板上。

| 名称 | 种类 | 文件位置 | 用途 |
|------|------|----------|------|
| `TablePanel.saveAfterEdit` | 方法，`(columnIndex: number) => void` | `packages/libs/editor-impl/src/table/tablePanel.ts` | 字段确认（失焦 / 回车 / 选中）之后把这一栏写一次缓冲；自动保存的唯一入口，内部复用 `TablePanel.saveColumn`（安静模式），不另写一套序列化。 |
| `TablePanel.refreshPendingWrites` | 方法，`(paths?: readonly string[]) => void` | 同上 | 按待写路径刷新每栏的 `pendingWrite` 布尔并重发视图；订阅待写变化时先拿一次当前路径列表。 |
| `TablePanel.isColumnDirty` | 既有方法（改造） | 同上 | 脏判定新增第三来源：本栏目标路径还有待写内容也算脏（与 `pendingWrite` 共用同一份数据，D-11）。 |
| `TablePanel.saveDocument` 的 `quiet` 参数 | 方法参数，`boolean`（缺省假） | 同上 | 安静模式：自动保存调用它时不刷「已保存」提示；手动保存仍刷。 |
| `TablePanel.saveColumn` 的 `quiet` 参数 | 方法参数，`boolean`（缺省假） | 同上 | 安静模式，向上转交给 `TablePanel.saveDocument`。 |
| `TablePanel.save` | 既有方法（改造） | 同上 | 保存按钮 = 立即写盘：先保存本栏，再对数据 / 推导出的 schema 两条路径调 `IEditorPanelContext.flushResource`；**不**用全量写盘（那会把别的面板还没确认的内容一起写盘）。 |
| `TablePanel.saveAllColumns` | 既有方法（改造） | 同上 | 「全部保存」在返回前等到这些路径的待写真正落盘，再报成功。 |
| `TablePanel.setFieldEditing` | 方法，`(editing: boolean) => void` | 同上 | 视图报「有字段正在输入」；为真时冲突弹窗推迟，为假的那一刻立刻弹。 |
| `ITablePanelViewProps.onFieldEditingChange` | 可选 props 成员（Plan 03 已声明） | 同上 | 视图回调，对应 `TablePanel.setFieldEditing`；根 `etable-columns` 的 React 焦点事件属性 `onFocus` / `onBlur` 转成这个布尔。 |
| `TablePanel.applyEdit` | 既有方法（改造） | 同上 | 一次确认提交成功后解除「正在输入」，覆盖数字框回车确认后不失焦的情形；同时触发 `TablePanel.saveAfterEdit`。 |
| `isEditableFieldElement` | 模块级自由函数，`(element: EventTarget \| null) => boolean` | 同上 | 判断焦点落在的是不是 input / textarea / select / contenteditable；工具栏按钮、表格空白都不算「正在打字」。 |
| `TablePanel.keepExternalConflict` | 方法，`(columnIndex: number) => Promise<void>` | 同上 | 冲突弹窗的「保存编辑器的」：先把该栏放回未落盘、排进缓冲，再立刻写盘覆盖外部修改；失败保留待写与弹窗，走既有错误通道。 |
| `TablePanel.discardExternalConflict` | 方法，`(columnIndex: number) => void` | 同上 | 冲突弹窗的「保存外部修改」：丢弃该路径待写（同时失效内容缓存），按收到变化时记下的外部原文重新载入，不重新读磁盘。 |
| `IExternalChangeDialogProps.keepLabel` | 可选 props 成员，`string` | `packages/libs/editor-impl/src/shared/panelDialogs/types.ts` | 「要编辑器这一份」按钮的文案；表格传「保存编辑器的」，地图 / 素材不传、保持原文案。 |
| `IExternalChangeDialogProps.discardLabel` | 可选 props 成员，`string` | 同上 | 「要外部那一份」按钮的文案；表格传「保存外部修改」。 |
| `IExternalChangeDialogProps.noteText` | 可选 props 成员，`string` | 同上 | 弹窗正文下方的一句补充说明；表格用它讲清「点哪个都立刻生效、没表态就不写盘」，地图 / 素材不传。 |
| `保存编辑器的` | 定稿文案（逐字） | `packages/libs/editor-impl/src/table/tablePanel.ts` | 冲突弹窗的「要编辑器这一份」：用编辑器里的内容覆盖外部修改，并立刻写盘。 |
| `保存外部修改` | 定稿文案（逐字） | 同上 | 冲突弹窗的「要外部那一份」：丢掉编辑器里的待写，重新载入外部那份。 |
| `ExternalChangeDialog` | 既有组件（改造） | `packages/libs/editor-impl/src/shared/panelDialogs/ExternalChangeDialog.tsx` | 读三个新文案参数；不传时用默认文案，地图 / 素材行为与文案一律不变。 |
| `panelDialogs.test.tsx` | 既有测试（改写 + 新增） | `packages/libs/editor-impl/src/shared/panelDialogs/__tests__/` | 传文案时逐字断言两句「保存编辑器的」/「保存外部修改」；不传时断言默认文案仍在。 |
| `closeChoice.test.tsx` | 既有测试（被接管） | `packages/libs/editor-impl/src/table/__tests__/` | 随自动保存改三处断言：取消后读资源层是新值、spy 的含义改成「缓冲写入次数」、保存并关闭保持原样。 |
| `tableAutoSave.test.tsx` | 测试文件（新建） | 同上 | 失焦确认后 50 毫秒内别处读得到、5 秒后磁盘才变、保存按钮 = 立即写盘、「未保存」覆盖两个来源。 |

**口径（写死）：**

- 两个既有回调 `IExternalChangeDialogProps.onKeep` / `IExternalChangeDialogProps.onDiscard` **不改名**：前者仍是「要编辑器这一份」（落点 `TablePanel.keepExternalConflict`），后者仍是「要外部这一份」（落点 `TablePanel.discardExternalConflict`）。地图 / 素材面板不传新文案、行为不变（D-21）。
- 「不保存关闭」与「保存外部修改」两处丢弃待写都调 `IEditorPanelContext.discardPendingResource`，不许各写一套清表逻辑。
- 两个动作都不把异常抛给点击处理器：「保存编辑器的」任一步失败时待写保留、弹窗不关、未保存标记仍在，失败走既有错误通道（既有文案「写入失败，请重试。」与 `resource.flushFailed` 日志），**不新增任何失败提示界面**（O2）。

---

## Plan 09 — 数字输入控件改为失焦 / 回车提交

**要做什么：** 把数字输入从「每敲一个键提交一次」改成「失焦 / 回车 / 清空后提交一次」，并把 schema 视图里绕过通用控件的成对数字框一起对齐（`TableGrid` 里内联的 antd `InputNumber`）。

**本计划不新增导出符号**：`NumberInput` 名字不变、props 形状不变、`TableRow` 的调用点不变。

| 名称 | 种类 | 文件位置 | 用途 |
|------|------|----------|------|
| `NumberInput` | 既有组件（行为契约变更，不新增导出符号） | `packages/libs/editor-impl/src/shared/schemaForm/components/inputs/NumberInput.tsx` | 组件内部持一份本地输入值，回车或失焦时提交一次，按 Escape 回退；不再逐键 `onChange`。 |
| `TableGrid` 的成对数字框 | 既有组件（改造，不新增导出符号） | `packages/libs/editor-impl/src/shared/schemaForm/components/TableGrid.tsx` | schema 视图里成对的最小 / 最大值输入绕过了 `NumberInput`，必须一起改成「确认一次才提交一次」，否则 D-09 在 schema 视图里不成立。 |
| `behaviour.uat.test.tsx` | 既有测试（改写数字框用例） | `packages/libs/editor-impl/src/table/__tests__/` | 从「change 后立即提交」改为三条：只输入不提交读回旧值、失焦提交、回车提交。 |

---

## Plan 10 — 两栏同一张表

**要做什么：** 让同一张表在同一表格面板的两栏同时打开时，一栏确认后另一栏 50 毫秒内更新；同面板两栏之间永不弹冲突；「另一栏脏」时保留它自己的草稿。

**本计划不新增导出符号**，只登记「同面板冲突抑制」的判定依据与测试。

| 名称 | 种类 | 文件位置 | 用途 |
|------|------|----------|------|
| `TablePanel.isSamePanelWrite` | 私有方法，`(columnIndex: number, text: string) => boolean` | `packages/libs/editor-impl/src/table/tablePanel.ts` | 判断收到的内容是不是本面板另一栏刚写出去的那一份；是就只刷新或保留草稿、永不弹冲突。 |
| `twoColumnsSameTable.test.tsx` | 测试文件（新建） | `packages/libs/editor-impl/src/table/__tests__/` | 同路径两栏：一栏确认后另一栏 50 毫秒内更新；同时确认最后写盘者胜且不弹冲突；另一栏脏时保留自己的草稿。 |
| `panelSync.uat.test.tsx` | 既有测试（改写） | 同上 | 从「点保存后同面板同步」改为「确认后 50 毫秒内同步」。 |

**与 ④ 的关系（写死）：** 这条判定**取代 `04.3-RESEARCH.md` 责任图第 145 行「来源判定在资源层写日志」**，因此它是定稿而不是偏离。判定依据只有两条既有事实：本面板另一栏刚写出的内容（`TablePanel.isSamePanelWrite`）与既有基线原文比较；不比时间戳、不比来源位、不新增自写标记。

---

## Plan 11 — 迁移「保存后读磁盘」断言

**要做什么：** 把写盘延后 5 秒之后会变红的既有断言逐个对齐；要求是**显式补一次写盘**，断言文案尽量不变。

**本计划不新增源码符号。**

| 名称 | 种类 | 文件位置 | 用途 |
|------|------|----------|------|
| `resourceSystem.test.ts` | 既有测试（改断言） | `packages/libs/editor-core/src/resource/__tests__/` | 把「写完磁盘立刻变」拆成「读缓冲是新值 + 磁盘仍是旧值」与「显式写盘后磁盘才变」两条。 |
| `tracer.test.ts` | 既有测试（补显式写盘） | `packages/libs/editor-core/src/__tests__/` | 写后读磁盘前先显式写盘一次。 |
| `editableContract.test.tsx` | 既有测试（补显式写盘） | `packages/libs/editor-impl/src/table/__tests__/` | 两处读裸磁盘的断言（约第 305 / 385 行）前各补一次显式写盘。 |
| `assetAutoSave.test.tsx` / `assetExternalChange.test.tsx` / `assetLifecycle.uat.test.tsx` | 既有测试（补显式写盘） | `packages/libs/editor-impl/src/asset/__tests__/` | 读回辅助前补一次显式写盘；`assetLifecycle.uat.test.tsx` 里已经走资源层的那一条不改。 |
| `mapDialogs.test.tsx` | 既有测试（补显式写盘 + 依赖删除丢待写） | `packages/libs/editor-impl/src/map/__tests__/` | 保存后读回前补写盘；「删除后文件不存在」靠实现丢弃待写保证，不靠测试兜。 |
| `manualSave.uat.test.tsx` | 既有测试（**整体重写**） | `packages/libs/editor-impl/src/table/__tests__/` | 从「必须点保存才落盘」改为「确认即写缓冲 / 5 秒后落盘 / 保存按钮立即写盘 / 切出立即写盘」。 |

**明确不用改（容易误列）：** `transcode.uat.test.tsx` 的二进制断言、`assetRegistration.test.tsx` 的二进制断言、`assetLifecycle.uat.test.tsx` 里已走资源层的那一条——它们走 `ResourceSystem.createResource`（O5：新建立刻落盘）；`mapDemo.test.ts` 的那两条读的是测试自己播种的产物，不走编辑器写入；`panelSync.uat.test.tsx` 由 Plan 10 改写。

---

## Plan 12 — 宿主端到端

**要做什么：** 在开发宿主上用真实 `EditorCore` + 真实 `MemoryBackend` 做端到端验收，并给三个既有宿主测试补显式写盘。

| 名称 | 种类 | 文件位置 | 用途 |
|------|------|----------|------|
| `devHostAutoSave.test.tsx` | 测试文件（新建） | `packages/apps/editor-dev/src/__tests__/` | 真实宿主端到端：改一格不点保存 → 5 秒后磁盘变；切标签立刻变；关标签显示「正在保存…」后关闭且磁盘是新值。 |
| `devHostAssetAdd.test.tsx` | 既有测试（补显式写盘） | 同上 | 读裸后端前补一次显式写盘。 |
| `devHostMap.test.tsx` | 既有测试（补显式写盘） | 同上 | 读裸后端前补一次显式写盘。 |
| `devHostWatch.test.tsx` | 既有测试（条件确认） | 同上 | 若「保存按钮 = 立即写盘」成立则不用改，只需跑一遍确认；不成立才补写盘。 |

---

## Plan 13 — 收口

**要做什么：** 跑完整验证、回填阶段状态，不留红。

**本计划不新增符号。**

| 名称 | 种类 | 文件位置 | 用途 |
|------|------|----------|------|
| 验证命令组 | 命令清单 | 三个包 + `scripts/verify/` | 三包全量 `test` 与 `typecheck`、四条结构门禁（`coreEngineNeutral` / `coreModuleState` / `coreImportType` / `coreBoundaries`）、`pnpm lint`、`pnpm format:check`。 |
| `04.3-VALIDATION.md` | 文档（回填） | `.planning/phases/04.3-resource-write-buffer/` | 回填每条门禁的实跑结果，并置 `nyquist_compliant`。 |
| `04.3-UAT.md` | 文档（新建 / 回填） | 同上 | 记录必须人工验收的项：`beforeunload` 原生弹框、切后台的真实写盘、5 秒防抖手感、两栏同表可能刷新掉未确认输入、冲突弹窗停手才弹、「保存编辑器的」真的覆盖了外部修改、右上角提示排版。 |
| `04.3-*-SUMMARY.md` | 文档（各计划产出） | 同上 | 每个计划的执行记录：任务、验证证据、偏差、提交。 |
| `STATE.md` / `ROADMAP.md` | 既有状态文件（由编排器更新） | `.planning/` | 阶段收口时回填进度与下一步；执行器不自行改写。 |

---

## 待用户确认的取舍

> 以下五项已于 2026-10-30 经用户文字确认「确认」，**全部按研究推荐值采用**。每项都保留**研究推荐值**与**替代方案的代价**，供后续回看「当时为什么不选另一条」。

| # | 取舍 | 研究推荐值 | 替代方案与代价 | 状态 |
|---|------|-----------|----------------|------|
| 1 | 同面板两栏与外部写入靠什么区分（来源判定） | **不引入来源标识**：写者自己那一栏靠「写盘返回后立刻推进基线」，同面板其它栏靠 `TablePanel.isSamePanelWrite` 比「本面板刚写出的那一份」，内容不同才算外部写入（④） | 走「资源层写日志 + 通知携带是否自写」：要新类型与新状态，二进制只能「尽力而为」；走「宿主 `origin` 字段」：只有 `MemoryBackend` 能填，真实宿主（Node / chokidar）填不了，等于没加 | **已确认（2026-10-30）** |
| 2 | 页面事件集合 | **`window` 上的 `pagehide` + `window` 失焦 + `beforeunload`**；不用 `visibilitychange`、不用 `document`（⑤ / O3） | 坚持 `visibilitychange`：要读 `document.hidden`，会破 `editor-core` / `editor-impl` 的结构门禁（含测试）；给门禁加白名单等于降低门禁，不建议 | **已确认（2026-10-30）** |
| 3 | 两栏同表时「未确认的输入可能被另一栏的写入刷新掉」 | **接受为已知行为**，并在人工验收里记录（研究 §Q8.3 方案 A）：另一栏确认后 50 毫秒通知会让本栏 `contentVersion` 递增、组件重置草稿，正在敲但未失焦的字可能被吞 | 选「本栏聚焦时跳过自动刷新」：需要新增回调 / 新栏位、扩大契约（方案 B），实现与测试面都更大；选「只在同面板两栏之间跳过刷新」：仍会走 `contentVersion` 重置，解决不了问题（方案 C） | **已确认（2026-10-30）** |
| 4 | 50 毫秒合并通知的形态 | **首次排程不重置**：第一次写入起 50 毫秒必发一次，期间写入并进去（③） | 用研究 §Q3.3 伪代码的「每次写入都重排」：持续写入下通知会被无限推迟，两栏同步迟迟不发生。通知只是同步节奏、不是落盘时机，因此选不重置 | **已确认（2026-10-30）** |
| 5 | 外部冲突的处置 | **已由用户 2026-10-29 拍板，本文按定稿写**：「停手才弹」+ 两个动作点了立刻生效（「保存编辑器的」= 立刻写盘覆盖外部修改 / 「保存外部修改」= 丢弃待写并重载外部那份）+ 没表态就不写盘 | 先前「保留后不自动落盘、只能等下一次显式保存」与「保留时重新写一次缓冲、让 5 秒定时器装回来」两个口径**已作废**，不再作为备选 | **已确认（2026-10-30，复述定稿）** |

**这五项分别约束：** 第 1 项 → Plan 04 / 10；第 2 项 → Plan 06；第 3 项 → Plan 10（并进人工验收）；第 4 项 → Plan 05；第 5 项 → Plan 04 / 08。

### 与 `04.3-RESEARCH.md` 命名不一致的地方（一律以本文 / PLAN 为准）

> 计划文本与研究稿在下列几处给了不同名字或不同归属。PLAN 是检查器核对过的契约，因此**本文按 PLAN 采用**；这四处差异已于 2026-10-30 随「确认」一并接受，一律以本文 / PLAN 的名字为准，不再作为待定项。

| # | 研究稿的说法 | 本文采用 | 说明 |
|---|--------------|----------|------|
| 1 | `ResourceSystem.hasPendingContent`（§Q2.1） | `IResourceSystem.hasAnyPendingContent` | 只是一个名字差异；语义相同（「现在还有待写吗」）。 |
| 2 | 待写表与写盘能力直接写在 `ResourceSystem` 上（§Q2.3） | 独立成 `WriteBuffer` 类 + `IWriteBuffer` 接口，`ResourceSystem` 转发 | 独立文件后定时器表与「整条替换」的规则有单一归属；`resourceSystem.ts` 现有 214 行、6 个职责，再塞会难读。 |
| 3 | 研究只提过 `IEditorPanelContext.flushResource`，没有给缓冲层的方法名 | 缓冲层新增 `WriteBuffer.flushAll` / `WriteBuffer.discard` / `WriteBuffer.clear` / `WriteBuffer.dispose` / `WriteBuffer.readPending` / `WriteBuffer.noteExternalWrite` | 这六个名字是本文补的，一经确认即为最终名。 |
| 4 | 研究未区分面板侧与资源层的丢弃 / 写盘名字 | 资源层 `IResourceSystemAccess.flushContent` / `IResourceSystemAccess.discardPendingContent`，面板侧 `IEditorPanelContext.flushResource` / `IEditorPanelContext.discardPendingResource` | 同义不同层，读代码时能立刻看出调用方是谁。 |

---

## 确认状态

**已确认：2026-10-30** —— 用户以文字回复「确认」。全部提案按原文接受：七组契约的结论、全部新增名称、九个新测试文件名、两句定稿文案、五项取舍的推荐值，以及四处「研究稿与 PLAN 命名不一致」按 PLAN 采用。**未提出任何改名。**

**改名记录：无。** 本阶段没有发生任何改名，下文列出的即为最终名称，全文只有最终名，不存在「原名 → 现名」条目。

### 最终名称 · editor-core（Plan 02 / 04 / 05 / 06 / 07）

| 名称 | 最终形态 |
|------|----------|
| `writeBuffer.ts` | 新文件，`packages/libs/editor-core/src/resource/writeBuffer.ts` |
| `IWriteBufferEntry` | interface，成员 `content` / `version` / `timer` / `inFlight` / `error` / `externallyChanged`（前四类中 `content` / `version` / `externallyChanged` 只读，`timer` / `inFlight` / `error` 可回写） |
| `WriteBufferWriter` | type，`(path: string, content: ResourceContent) => Promise<void>` |
| `IWriteBuffer` | interface，待写表的对外契约 |
| `WriteBuffer` | class，`implements IWriteBuffer` |
| `WriteBuffer.schedule` / `WriteBuffer.flush` / `WriteBuffer.flushAll` / `WriteBuffer.has` / `WriteBuffer.paths` / `WriteBuffer.size` / `WriteBuffer.readPending` / `WriteBuffer.discard` / `WriteBuffer.clear` / `WriteBuffer.dispose` / `WriteBuffer.noteExternalWrite` | 缓冲成员（一经确认即为最终名） |
| `WriteBuffer.lastWritten` | 私有实例字段，`Map<string, ResourceContent>` |
| `PendingChangeListener` | type，`(paths: readonly string[]) => void` |
| `IResourceSystemAccess.flushContent` / `IResourceSystemAccess.discardPendingContent` / `IResourceSystemAccess.watchPendingChange` | 资源访问口三个新成员 |
| `IResourceSystem.flushAllContent` / `IResourceSystem.hasAnyPendingContent` / `IResourceSystem.listPendingPaths` | 资源系统三个新成员 |
| `IResourceSystemHooks.onPendingChange` | 可选接口方法 |
| `ResourceSystem.bufferContent` / `ResourceSystem.scheduleFlush` / `ResourceSystem.flushOneContent` / `ResourceSystem.clearFlushTimers` / `ResourceSystem.noteExternalWrite` | 私有方法 |
| `FLUSH_DEBOUNCE_MS` / `NOTIFY_COALESCE_MS` | 模块级数字字面量常量，`5000` / `50` |
| `isSameResourceContent` | 自由函数，`(left, right) => boolean` |
| `resource.flushFailed` / `resource.pendingDiscarded` | 日志 id |
| `IEditorPanelContext.flushResource` / `IEditorPanelContext.discardPendingResource` / `IEditorPanelContext.watchPendingChange` | 面板上下文三个转发成员 |
| `IShellViewState.hasPendingWrite` / `IMenuRowProps.hasPendingWrite` | 外壳布尔视图字段 / 菜单行 props 成员 |
| `ShellSystem.flushPendingContent` / `ShellSystem.beforeUnloadHandler` / `ShellSystem.pageHideHandler` / `ShellSystem.windowBlurHandler` | 外壳写盘辅助 + 三个页面事件处理函数 |
| `editor-shell-pending` | 提示的 CSS 类名与 `data-test-id` |
| `正在等待保存，请勿关闭页面或浏览器` | 右上角提示的固定文案（逐字） |

### 最终名称 · editor-impl（Plan 03 / 08 / 09 / 10）

| 名称 | 最终形态 |
|------|----------|
| `ITablePanelColumn.pendingWrite` | 栏状态字段，`boolean` |
| `ITablePanelViewProps.onFieldEditingChange` | 可选 props 成员，`(editing: boolean) => void` |
| `TablePanel.saveAfterEdit` / `TablePanel.refreshPendingWrites` / `TablePanel.setFieldEditing` / `TablePanel.keepExternalConflict` / `TablePanel.discardExternalConflict` | 表格面板新增方法 |
| `TablePanel.isSamePanelWrite` | 私有方法，判「是不是本面板另一栏刚写出的那一份」 |
| `TablePanel.saveDocument` 的 `quiet` / `TablePanel.saveColumn` 的 `quiet` | 长期参数名，`boolean`（缺省假） |
| `isEditableFieldElement` | 模块级自由函数，`(element) => boolean` |
| `IExternalChangeDialogProps.keepLabel` / `.discardLabel` / `.noteText` | 可选文案参数 |
| `保存编辑器的` / `保存外部修改` | 冲突弹窗两个动作的定稿文案（逐字） |
| `NumberInput` | 既有组件，提交契约改为「失焦 / 回车 / 清空后提交一次」，不新增导出符号 |

### 最终名称 · 九个新测试文件

| 测试文件 | 所在包 |
|----------|--------|
| `resourceBuffer.test.ts` / `resourceBufferConcurrency.test.ts` / `resourceNotifyCoalesce.test.ts` | `editor-core`（`src/resource/__tests__/`） |
| `shellFlush.test.ts` / `shellPageLifecycle.test.ts` / `shellPendingIndicator.test.tsx` | `editor-core`（`src/shell/__tests__/`） |
| `tableAutoSave.test.tsx` / `twoColumnsSameTable.test.tsx` | `editor-impl`（`src/table/__tests__/`） |
| `devHostAutoSave.test.tsx` | `editor-dev`（`src/__tests__/`） |

### 最终取舍（五项）与四处命名差异

- 五项取舍的最终结论写在 `## 待用户确认的取舍` 一节，状态列已全部标 `已确认（2026-10-30）`；它们分别约束 Plan 04 / 05 / 06 / 08 / 10。
- 四处「研究稿与 PLAN 命名不一致」已按 PLAN 采用（`## 待用户确认的取舍 › 与 04.3-RESEARCH.md 命名不一致的地方`），不再作为待定项。
- `## 不缓冲的边界（写死）` 与 `## 七组契约的落实决策（先读这一节）` 的结论同样随本次确认生效。

**Plan 14 / 15 追加确认：2026-10-30** —— 按路径去重的形状与全部新名称已获用户第二次文字确认（原话「批准命名，可以执行计划」），详见本文末尾 `## 追加确认（Plan 14 / 15，2026-10-30）`。

---

## Plan 14 — 同文件多标签去重的接口与命名

**要做什么：** 先把「外壳怎么知道某条文件路径已经开在哪个标签里」这个小能力的形状与名字定下来，供 Plan 15 落地。本节只写文档，**不改任何源码**。

### 三句话讲清缺陷与根因

1. **同一个表格文件可以被两个标签各开一个面板。** 存储单位是「一条路径一份」，编辑单位却是「每个面板一份草稿」，两者不一致。
2. **于是没编辑过的标签会被误判为脏，后写盘的那一份会静默覆盖先写盘的那一份。**
3. **D-26 选择从结构上消灭这个情形**：按路径去重，一条路径任何时刻最多只开在一个标签里。要做到这一点，外壳必须先能回答一个问题——「这条路径已经开在哪个标签里」。

### 三个候选形状：选哪一个，为什么

| 形状 | 它是干什么的（外行话） | 代价 |
|------|------------------------|------|
| (a) 面板类型反推路径 | 给每种面板类型加一个可选方法，把「打开参数」翻译回「文件路径」，相当于 `IEditorPanelType.createOpenParam` 的反向操作。 | 只有表格反推得出来；地图与素材反推不出来（见下），这两类面板会继续把同一个文件开成两个标签。 |
| (b) 先造面板再问它 | 直接问已经打开的面板「你显示的是哪条路径」。 | 去重必须在造面板之前完成，否则每次「只是问一下」都要先造一个用完就丢的实例，被问的面板会提前开始读资源。 |
| (c) 调用方直接传路径 | 外壳的打开入口多一个可选参数，谁要打开文件谁就把路径一并交上来；外壳自己记一张「标签 → 路径」的表。 | 凡是调用方，开文件时都要多传一个路径（那是它手上本来就有的东西）；不带文件的入口（空白面板）不传，就不去重，这是正常降级。 |

**明确选 (c)。** 评审时最先提的是 (a) 的具体形态（给面板类型加一个 `resolvePath`）；这里保留这条记录，是为了让后来的人知道当时为什么换了形状。理由是对源码的实证，不是偏好：

- **表格能反推**：`tablePanelType.createOpenParam` 产出 `{ target: { dataPath: path } }`，路径原样留在打开参数里。
- **地图反推不出来**：`mapPanelType.createOpenParam` 只产出 `{ target: { mapId } }`，路径被解析成地图 id 之后就没了；地图能力面也只有单向的 `resolveMapPath`（路径 → id），没有反向。
- **素材反推不出来**：`assetPanelType.createOpenParam` 把清单文件、schema 文件、默认值文件三种不同文件压成同一个 `{ categoryId }`，字节文件再压成 `{ categoryId, assetName }`（扩展名可能被去掉）。同一个打开参数对应不止一条路径，反推必然出错。

因此 (a) 只对表格成立，地图与素材会继续把同一个文件开成两个标签、共用一份路径缓冲——正是 D-26 要消灭的场景。选 (c) 之后，外壳只做归一与登记、**不解释打开参数的形状**，04.2 的 D-32 一字不改；因此**没有任何面板类型需要为此新增成员**。

### 去重单位与路径口径

- **去重单位是调用方打开的那条文件路径**，不是「路径 + 面板类型」。两条推论写死：
  - 同一素材分类下的两个不同文件是两个标签——它们是两个文件，不该合并；
  - 同一个文件先按表格打开、再按地图打开，只得到一个标签（切回表格那个）。
- **资源标识沿用 G9**：相对项目根、以 `/` 分隔、无前导斜线、不含 `..` 段。
- **路径要归一**：`/foo`、`foo`、`foo/`、`foo//bar` 必须归一到同一个键——去掉全部前导 `/`、折叠重复的 `/`、去掉尾随 `/`；**不**解析 `.` / `..`（资源层已保证没有这些段）。
- **登记与查找共用同一个函数**：外壳在「登记路径」和「查找路径」两处必须用同一个函数算键，否则 `/foo` 与 `foo` 会被当成两条不同的路径。
- **空串一律当「没有路径」**，绝不作为登记键：否则所有传空串的打开都会聚到同一个标签上。

### 行为写死（后续计划不再二次拍板）

| 情形 | 行为 |
|------|------|
| 去重键是什么 | **归一后的路径**，不是「路径 + 面板类型」。路径的唯一来源是调用方传进来的参数；`editor-core` 仍然不解释打开参数的形状（04.2 D-32 一字不改），因此**没有任何面板类型需要为此新增成员**。 |
| 调用方没传路径，或路径归一后是空串 | **不去重**，照旧打开。空白面板、外壳菜单都属于这一类。 |
| 命中已有标签，且它就是本次的标签 | 激活该标签、返回成功、**不创建新实例**；同实例切出会短路，不落盘。 |
| 命中已有标签，本次的标签是调用方刚建的空标签 | 激活那个已有标签、返回成功、**不创建新实例**；并把调用方刚建出来的空白标签收掉（只对 `typeId` 与 `instanceId` 都为 null 的标签动手），保证命中后恰好一个标签。调用方自己已经在用的标签不得替它销毁。 |
| 已打开标签属于另一种面板类型 | 按 D-26 切过去、**不重开**；并排查看只能靠分屏共享同一份内容。 |
| 未命中 | 走原有流程不变；**实例创建成功、标签记录写入之后**才登记这条路径（不等到初始化完成）。 |
| 同一个标签换成另一条路径 | 登记改写成新路径，旧路径随之释放（之后再打开旧路径应当得到一个真正的新标签）。 |
| 同一个标签换成**不带路径**的面板（例如空表格面板） | 清掉该标签的登记。 |
| 关标签 / 释放整个外壳 | 清掉相应登记。 |
| 实例创建失败（工厂抛错） | **既不写也不清登记**：那个标签仍占着它原来那条路径，重新打开这条路径只会聚焦到这个标签，不会冒出第二个面板。取舍写清楚：宁可让一条路径暂时被一个坏标签占住，也不允许同一路径出现两个可编辑面板（`04.3-CONTEXT.md` 的前提）。 |
| 实例初始化失败 | **同样不清登记**，理由与上一条相同（标签已经指向这个实例，清掉登记等于允许同一路径开第二个面板）。 |

**哪些入口必须传路径、哪些天然没有路径：**

- **必须传**：资源管理器注入的打开回调（它在浏览文件，路径就在手上）、表格「编辑 Schema」打开器（它派生出的 schema 文件路径）、测试里的直接调用（它们要钉住去重行为）。
- **不传**：`ShellSystem.openBlankTab` 与外壳菜单「开一个空白面板」——它们没有文件，因此不参与去重，这是允许的正常降级。

**同时作废与确立的前提：**

- 04.2 的 **D-28「资源管理器总是新开标签」作废**；重复打开同一个文件不再产生第二个标签。
- 由此确立、供后续阶段引用的前提：**同一条路径，任何时刻最多只有一个可编辑面板持有它。** D-27 把「跨标签双写者」这个场景从结构上取消。

**明确不做的事（与 D-26 末段一致）：** 不引入写入来源标识、不做「每个面板一份缓冲」、不改 D-10（草稿与撤销仍留在组件 / 面板）、不新增公开的「按路径查标签」查询方法。

### 名称 / 种类 / 文件位置 / 用途

| 名称 | 种类 | 文件位置 | 用途 | 状态 |
|------|------|----------|------|------|
| `IShellSystem.openPanelInTab` | 既有接口方法**新增第 4 个可选参数** `path?: string` | `packages/libs/editor-core/src/shell/types.ts` | 让调用方把「它正在打开的那条文件路径」一并交给外壳；不传或传空串表示这次打开不对应任何文件，外壳因此不去重。JSDoc 写在接口源头，写明外壳只把路径归一后当键、不解释 `openParam` 的形状。 | 已确认（2026-10-30） |
| `normalizeResourcePath` | 自由函数，`(path: string) => string` | `packages/libs/editor-core/src/shell/shellSystem.ts` | 把 `/foo`、`foo`、`foo/`、`foo//bar` 归一成同一个去重键；空串归一后仍是空串，调用方据此判定「没有路径」。 | 已确认（2026-10-30） |
| `ShellSystem.tabPaths` | 私有实例字段，`Map<string, string>` | `packages/libs/editor-core/src/shell/shellSystem.ts` | 记住每个标签是被哪条文件路径打开的（标签 id → 归一后的路径），是去重判定的唯一数据来源。 | 已确认（2026-10-30） |
| `ShellSystem.findTabByPath` | 私有方法，`(path: string) => string \| undefined` | `packages/libs/editor-core/src/shell/shellSystem.ts` | 反查哪个标签已经登记这条（已归一的）路径；它是去重的唯一判据。 | 已确认（2026-10-30） |
| `ShellSystem.rememberTabPath` | 私有方法，`(tabId: string, path: string) => void` | `packages/libs/editor-core/src/shell/shellSystem.ts` | 登记或改写某个标签的路径，入参必须是已经归一的键；同一标签换成另一条路径时由它覆盖旧登记。 | 已确认（2026-10-30） |
| `ShellSystem.forgetTabPath` | 私有方法，`(tabId: string) => void` | `packages/libs/editor-core/src/shell/shellSystem.ts` | 清掉某个标签的路径登记；关标签、释放外壳、以及换成不带路径的面板时调用。 | 已确认（2026-10-30） |
| `ShellSystem.dropBlankTab` | 私有方法，`(tabId: string) => Promise<void>` | `packages/libs/editor-core/src/shell/shellSystem.ts` | 去重命中时把调用方刚建出来的空白标签收掉；只在 `typeId` 与 `instanceId` 都为 null 时动手，并先等 `ShellSystem.switchChain` 结算，绝不销毁调用方自己在用的标签。 | 已确认（2026-10-30） |
| `IFileExplorerCapabilities.openPanel` | 既有能力接缝**新增第 3 个参数** `path: string` | `packages/libs/editor-impl/src/explorer/types.ts` | 让资源管理器把它正在打开的文件路径一并交给宿主，宿主再原样交给 `IShellSystem.openPanelInTab`。JSDoc 要写明「路径只用于去重，宿主的打开实现不得用它决定打开什么」。 | 已确认（2026-10-30） |
| `ITablePanelOpener.open` | 既有能力接缝**新增第 2 个参数** `path: string` | `packages/libs/editor-impl/src/react/capabilities.ts` | 让表格「编辑 Schema」把派生出的 schema 文件路径一并交给宿主，使那个入口也参与去重。 | 已确认（2026-10-30） |
| `shellPathDedupe.test.ts` | 测试文件（新建） | `packages/libs/editor-core/src/shell/__tests__/` | 钉住去重行为（八条用例，详见下一节 `## Plan 15`），让「同一路径只有一个标签」成为一条真的能失败的断言。 | 已确认（2026-10-30） |

以上名称已于 2026-10-30 由用户文字确认（用户原话：「批准命名，可以执行计划」），即为最终名；Plan 15 只按这些名字实现，不再另造同义形状。

**命名与代码风格口径（与项目规则一致）：** 方法一律写成 `InterfaceName.methodName` / `ClassName.methodName`；自由函数写裸名；接口成员默认 `readonly`；枚举（若实现时确需）用 `const enum` + 数字成员；JSDoc 只写在接口源头、实现类不重复；禁止 `import type`；文件用 LF、无 BOM。

### 已知代价（单独写，不藏起来）

资源管理器的注入回调与表格打开器仍然是「先开一个空白标签，再在这个标签里打开面板」。如果这次打开命中了别的标签，那个刚建的空标签会被收掉，但 `ShellSystem.openBlankTab` 已经排下的那次切换仍会按既有语义让**原来的活动面板**切出并落盘一次。因此「命中即不写盘」只对**去重这一次调用本身**成立；要去掉这次切出必须改 `ShellSystem.openBlankTab` 的语义，本期不做。写清楚的理由：改成「先查后开」需要一个额外的公开查询方法，而它不在本次命名范围内。

### 留给未来的升级路径

如果将来真的要做分屏或多视图编辑同一条路径，必须先重新设计「一条路径最多一个可编辑面板」这条前提，而不是在现有去重上加判断。

### 取代 Plan 12 旧口径（2026-10-30）

> 这一节只是取代记录，**不改原文**。Plan 02…13 的原话保持不动，便于回看当时的口径。

- `## Plan 12` 表里 `devHostWatch.test.tsx` 那行写的「若『保存按钮 = 立即写盘』成立则不用改」**已作废**：Plan 12 会整体改写该文件的三条跨标签用例，因为 D-26 让「同一路径两个标签」这个场景在结构上消失。
- `## Plan 13` 表里写的「新建 / 回填 `04.3-UAT.md`」以 `04.3-VALIDATION.md` 为准：本阶段的人工验收清单落在 `04.3-VALIDATION.md`。

---

## Plan 15 — 同文件多标签去重的实现与测试

**要做什么：** 把 Plan 14 确认过的路径参数与登记表真正落进外壳，再用一个测试文件钉住八条去重行为；它只改实现与测试，不再新增名称。

| 名称 | 种类 | 文件位置 | 用途 | 状态 |
|------|------|----------|------|------|
| `shellPathDedupe.test.ts` | 测试文件（新建） | `packages/libs/editor-core/src/shell/__tests__/` | 钉住这些行为：同一路径开两次只有一个标签且第二次激活它、两条不同路径得两个标签、关标签后路径被释放可重新打开、`/foo` 与 `foo` 命中同一个标签、空串按没有路径处理、调用方不传路径时照旧打开、同一条路径按两种不同面板类型打开仍只有一个标签、同一标签换成另一条路径后旧路径被释放、工厂抛错时这条路径不被误判为空闲。 | 已确认（2026-10-30） |

其余名称（`ShellSystem.*` / `normalizeResourcePath` / `IShellSystem.openPanelInTab` 的新参数 / 两个能力接缝的新参数）**已在 Plan 14 登记，此处只引用**，不重复造同义名。

**实现落点（写死）：** 去重判定写在 `ShellSystem.openPanelInTab` 的入口处（任何关闭 / 创建动作之前），因此资源管理器注入的打开回调、表格「编辑 Schema」打开器、测试里的直接调用都会经过它。**不改** `IEditorPanelType` 的任何既有成员，也**不改** `ShellSystem.openBlankTab` 的既有语义。

---

## 追加确认（Plan 14 / 15，2026-10-30）

**状态：已确认（2026-10-30）**

本节列出的名字与形状已于 2026-10-30 获得用户第二次文字确认。用户原话：「批准命名，可以执行计划」——十个名称全部批准，未提出任何改名。`已确认：2026-10-30`。

### 用户已拍板的两件事（结论）

1. **形状：** 按 (c)「调用方在打开时把路径交给外壳」实现；不选 (a) 面板类型反推路径、不选 (b) 先造面板再问它。
2. **命中时收掉刚建的空白标签：** 同意由外壳把那个空白标签收掉（本提案的做法）；Plan 15 的「恰好一个标签」断言按此写法，不改写成「恰好一个已打开面板的标签」。

### 本节附带的两个取舍（已采用）

- **命中时收掉调用方刚建的空标签**：保证命中后恰好一个标签；只对真正的空标签（`typeId` 与 `instanceId` 都为 null）动手，调用方自己在用的标签不得替它销毁。
- **空串一律当「没有路径」**：绝不作为登记键。

用户批准命名时对这两条取舍**未提出异议**，因此按提案采用，Plan 15 不再二次拍板。

---

## Plan 16 — 两处阻断缺口的接口与命名

**要做什么：** 在修这两处阻断缺口之前，把唯一需要拍板的接口形状与全部行为口径写下来，供后面三个计划照做。本节只写文档，**不改任何源码**。

### 三句话讲清这两处缺口

1. **G1（素材面板「保存并关闭」磁盘失败仍关标签）：** 素材面板的保存只是把内容排进写缓冲，面板因此必然回答「保存」；真正的磁盘失败发生在外壳随后的一次全量写盘里，而外壳把失败吞成一条日志、继续关标签。磁盘失败时素材标签被关掉，与 D-08「失败保持标签与面板打开」不符。
2. **G2（没表态的外部冲突会被全量写盘覆盖）：** 外部改动到达后，缓冲条目虽然被标成「外部已改」、5 秒自动写盘也被取消，但全量写盘（窗口失焦 / `pagehide` / `beforeunload` / 切标签 / 关标签 / 释放）不检查这个标记，照样写出去；表格面板切走时的非安静保存也会无条件写本栏两条路径。于是用户还没在冲突弹窗上表态，编辑器内容就覆盖了外部修改。
3. **最隐蔽的那条入口是撤销 / 重做：** 它走 `TablePanel.saveDocument` 的安静分支，`persist` 会把待写条目整条替换、把「外部已改」标记顺手清假并重排 5 秒定时器。用户没点过弹窗任何动作，5 秒后编辑器内容就写上了盘。这两处都不是「实现细节没调好」，而是契约没有被任何一条判据守住；`04.3-17` / `04.3-18` 要先把判据写成会失败的测试，再改实现。

### G1 的形状（唯一需要拍板的一项）

- **要解决的问题：** 关闭标签时必须知道「这次写盘到底成没成」，才能决定是丢弃标签，还是把标签与面板留在屏幕上。
- **唯一形状：** `ShellSystem.flushPendingContent(): Promise<boolean>`。返回 `true` 表示「这次尝试之后缓冲已经空了，可以安全关闭」；返回 `false` 表示「有写盘抛错，或仍有待写（包括被冲突规则跳过的条目），不能丢弃标签」。它仍是私有方法，名字不变，只改返回类型；`IResourceSystem.flushAllContent` 仍返回 `Promise<void>`，公开接口一字不改。
- **`ShellSystem.closeTab` 的用法：** 在 `PanelCloseChoice.Save` 分支先 `await` 这个布尔；为 `false` 就直接返回，`ShellSystem.discardTab` 不执行；为 `true` 才继续丢弃标签。`PanelCloseChoice.Discard` 分支不变。
- **为什么不是「带失败路径列表的结果对象」：** 关闭标签只关心一个问题——「现在能不能丢」；没有任何调用方需要知道具体是哪条路径失败，用户看到的也是同一条固定文案。多一个结果类型只会多一处要维护的形状。若将来确实需要更强诊断，再改成结果对象，`04.3-18` 跟着改。
- **假值是全局判据（取舍与可见状态）：** 判据只有一句「还有没有待写」（`IResourceSystem.hasAnyPendingContent`），不区分「这条待写属于哪个标签」。所以一个自身没有待写的标签，在别处有未决冲突、或某条路径的写盘一直失败时，也会保持打开。本阶段**不**把它收窄成「本标签涉及的路径」：那需要给面板新增一个「我持有哪些待写路径」的接口成员，与本节「不新增公开接口成员」直接冲突；也不新增任何文案或界面。它**不是静默失败**——只要还有待写，右上角既有的「正在等待保存，请勿关闭页面或浏览器」提示就已经在屏幕上，这就是假值的可见状态。
- **用户可见的失败从哪里来：** `AssetPanel.answerCloseDialog` 的保存分支在 `AssetPanel.saveAll` 之后，用面板上下文既有的 `IEditorPanelContext.flushResource` 把刚排进缓冲的清单路径逐条写盘；任一条失败就结算 `PanelCloseChoice.Cancel`，并把这次被清成假的各分类 `unsaved` 恢复为真，使重试仍会重新走同一条保存链。第一层失败由面板自己看见（弹窗留在屏幕上），外壳的布尔只是第二层保险：任何面板若回答「保存」却仍有待写，标签都不会被丢。
- **复用哪条既有文案（为什么排除另一条）：** 素材面板另有一条「保存失败，改动仍未落盘，请重试。」。**不选它**：`PanelCloseDialog` 已经在错误行前面加了「保存失败：」，两条相接会渲染成「保存失败：保存失败，……」，等于重复标题；选表格的「写入失败，请重试。」读作「保存失败：写入失败，请重试。」，落在「失败原因」这一格，语义正确。两条都是既有文案，不新增。
- **明确不新增的名字：** 不新增公开接口成员、不新增结果类型、不新增文案；`ShellSystem.flushPendingContent` 只是返回形态变化，`AssetPanel.answerCloseDialog` / `AssetPanel.saveAll` 只是内部行为变化。

### G2 的规则（明确不需要新名字）

- **一句话：** 全量写盘跳过 `externallyChanged` 的条目；单路径 `flushContent` 仍可写这类条目，因为「保存编辑器的」会先 `schedule` 清掉标记再 flush。
- **缓冲侧：** 只改 `WriteBuffer.flushAll` 的循环——遍历待写路径时，若该条目 `externallyChanged === true` 就跳过；`WriteBuffer.flush` 保持不动（面板的手动保存与两个冲突动作都走单路径）。不新增方法、不新增常量、不新增类型；`types.ts` 只把这句规则补进 `IWriteBuffer.flushAll` 与 `IResourceSystem.flushAllContent` 的 JSDoc。
- **宿主回声不得把标记条目重新装上定时器：** `WriteBuffer.noteExternalWrite` 的「自己写盘引起的宿主回声」分支目前会重排 5 秒定时器；如果条目此前已被标记，到点就会走 `WriteBuffer.flush` 把这条被标记的内容写出去，与「被标记路径没有 5 秒自动落盘」不符。规则改成：该分支遇到 `externallyChanged === true` 时直接返回，不清标记、不重排定时器。不加新名字。
- **表格侧——不变量写在唯一入口，不是两个调用点：** `TablePanel.saveDocument` 在取到 `target` 之后、拍 `startVersion` / `wroteData` 之前，对 `column.pendingConflict !== undefined` 一律返回 `ContentSaveStatus.Saved`，**不区分 `quiet`**。于是撤销 / 重做（`TablePanel.applyUndoRedo` 调 `TablePanel.saveDocument(..., true)`）、字段确认自动保存（`TablePanel.saveAfterEdit`）、切走、保存按钮、保存并关闭都走同一条守卫。**唯一豁免**是 `TablePanel.keepExternalConflict`：它先取下该栏的冲突标记，再走同一条保存链（`schedule` 因此重建条目并把标记清假），最后只对真正有待写的路径各 flush 一次。
- **为什么不能只挡「最后的 flush」：** `persist` 走的是 `IResource.write` → `WriteBuffer.schedule`，会把条目整条替换、标记自然清假并重排定时器；只在最后不 flush 仍会在 5 秒后被定时器写出去。因此必须在 persist 之前就停手，自动保存与撤销这类安静路径同样如此。
- **一栏两条路径必须能一起结算，但只结算真正有待写的那一条：** 一栏的数据文件与由它推导出的 schema 文件可以同时有待写（`TablePanel.computeAdd` 同时置 `unsaved` 与 `unsavedSchema`），而冲突槽只有一个、一次只弹一个框。因此两个动作动手前先取一帧「当前待写路径」（冲突路径本身视为待写），只对这一集合结算：「保存编辑器的」= 取下标记 → 把集合里的路径放回未落盘 → 走同一条链排缓冲 → 这些路径各 flush 一次；「保存外部修改」= 集合里的路径各丢弃一次待写 → 头部那条用收到变化时记下的外部原文、另一条重读磁盘，都换回外部内容。**从未编辑过的兄弟路径既不 persist 也不 flush**。一次结算把这一栏真正脏的路径都结掉，因此不存在「没有出口」的标记；不新增名字、不引入冲突队列。
- **切回时不得把草稿换成外部那一份：** `TablePanel.refresh`（以及所有转调它的刷新入口）在该栏 `pendingConflict !== undefined` 或 `pendingWrite` 为真时必须提前返回，不重读磁盘。原因很直接：冲突未表态时磁盘上正是外部那一份，重读会把内存草稿换成它，随后「保存编辑器的」写回去的就是外部内容——冲突弹窗两个动作也就失去了意义。这条规则不新增名字，只是给既有早退条件补两个判据。
- **与「单路径仍可写」的关系：** 不改成「`flush` 也跳过」，因为「保存编辑器的」正是「用户明确选择覆盖外部修改」的唯一出口；它点下去就应立刻写盘。它先经 `TablePanel.saveDocument` 的安静分支 `schedule`（标记清假），再 `IEditorPanelContext.flushResource`，所以即使 `flush` 允许写标记条目，也不会出现「没表态就写盘」。
- **风险与出口：** 未表态的冲突路径会一直留在待写里，右上角「正在等待保存」与 `beforeunload` 继续生效；「保存并关闭」不能替用户结算，所以外壳的布尔会让标签保持打开、冲突弹窗仍是唯一出口；「不保存关闭」会丢弃待写，释放编辑器时 `ResourceSystem.dispose` 先做一次跳过式全量写盘再 `clear`，冲突内容随释放一起丢掉且不会被写盘。**不新增超时、不自动重排、不自动替用户选。**
- **非表格面板的影响：** 外部已改的素材 / 地图清单在切走时不再被全量写盘；它们仍可在手动保存或单路径 flush 时写出，符合这些面板既有的「保留我的改动，下次保存覆盖」口径，不改它们的行为契约。

### 形状 / 种类 / 文件位置 / 用途 / 状态

| 形状 | 种类 | 文件位置 | 用途 | 状态 |
|------|------|----------|------|------|
| `ShellSystem.flushPendingContent` | 私有方法（返回形态改为 `Promise<boolean>`） | `packages/libs/editor-core/src/shell/shellSystem.ts` | 让关闭流程知道「缓冲是否已经空了、能不能丢标签」；真 = 缓冲已空可关，假 = 抛错或仍有待写不能丢标签。假值是全局判据，可见状态复用右上角既有提示 | 待确认 |
| `ShellSystem.closeTab` | 既有私有方法（改造） | `packages/libs/editor-core/src/shell/shellSystem.ts` | `PanelCloseChoice.Save` 分支按上面的布尔决定是否走 `ShellSystem.discardTab`；`Discard` 分支不变 | 待确认 |
| `WriteBuffer.flushAll` / `WriteBuffer.noteExternalWrite` | 既有方法（改造） | `packages/libs/editor-core/src/resource/writeBuffer.ts` | 全量写盘跳过 `externallyChanged === true` 的条目；宿主回声分支遇到已标记条目直接返回，不清标记、不重排 5 秒定时器；都不新增名字 | 待确认 |
| `TablePanel.saveDocument` / `TablePanel.saveAfterEdit` | 既有私有方法（改造） | `packages/libs/editor-impl/src/table/tablePanel.ts` | `TablePanel.saveDocument` 入口对该栏 `pendingConflict` 一律停手（含 `quiet`），撤销 / 重做与自动保存因此都受同一条守卫；`TablePanel.saveAfterEdit` 不再排缓冲；不新增名字 | 待确认 |
| `TablePanel.keepExternalConflict` / `TablePanel.discardExternalConflict` | 既有私有方法（改造） | `packages/libs/editor-impl/src/table/tablePanel.ts` | 两个冲突动作只结算真正有待写的路径（冲突路径视为待写），未编辑的兄弟路径不写盘；`TablePanel.keepExternalConflict` 是上述入口守卫的唯一豁免 | 待确认 |
| `TablePanel.refresh` | 既有私有方法（改造） | `packages/libs/editor-impl/src/table/tablePanel.ts` | 该栏有 `pendingConflict` 或 `pendingWrite` 时提前返回、不重读磁盘，保住内存草稿；不新增名字 | 待确认 |
| `AssetPanel.answerCloseDialog` / `AssetPanel.saveAll` | 既有私有方法（改造） | `packages/libs/editor-impl/src/asset/assetPanel.ts` | 保存后用 `IEditorPanelContext.flushResource` 逐条 flush，失败结算 `PanelCloseChoice.Cancel`、恢复被清掉的 `unsaved` 并复用既有文案「写入失败，请重试。」；不新增名字 | 待确认 |

**G2 不新增任何名字；如果认为需要新增，只能在确认时另提，不在本提案里预造。**

### 待确认清单

1. **G1 用 `Promise<boolean>`**（而不是「带失败路径列表的结果对象」）：`ShellSystem.flushPendingContent` 返回布尔，`ShellSystem.closeTab` 用布尔决定丢不丢标签；假值保持全局判据，可见状态就是右上角既有的「正在等待保存」提示。
2. **素材面板的关闭失败由面板自己 flush**，并复用表格那条既有文案「写入失败，请重试。」（排除素材自己那条「保存失败，改动仍未落盘，请重试。」：`PanelCloseDialog` 的「保存失败：」前缀会让后者渲染成重复标题）。
3. **G2 不新增名字**，按上述规则落地：`WriteBuffer.flushAll` 跳过 `externallyChanged`、宿主回声分支不重排定时器、`TablePanel.saveDocument` 入口守卫（含撤销 / 重做与自动保存）、`TablePanel.keepExternalConflict` 是唯一豁免。
4. **冲突动作只结算真正有待写的路径**（从未编辑过的兄弟路径不写盘），且 `TablePanel.refresh` 在 `pendingConflict` / `pendingWrite` 时不再重读磁盘（切标签往返不会把草稿换成外部那一份）；假值的全局判据与右上角提示作为可见状态保持不变。

**后续落地与收口：`04.3-17`（G2 实现）、`04.3-18`（G1 实现）、`04.3-19`（重新收口）。**

状态：待确认
