# Table Schema 现有场景审计

状态：设计审计；楼层属性纵向验证已完成，其余场景仍是后续候选。

本文使用现有 mota-js 表单检查 [Table Schema 设计草案](./table-schema-design.md) 是否足以表达真实场景。审计对象为：

- `_server/table/data.comment.js`
- `_server/table/comment.js`
- `_server/table/events.comment.js`
- `_server/table/functions.comment.js`
- `_server/table/plugins.comment.js`

审计关注目标表达方式，而不是逐字段复刻旧 `_leaf/_range/_action/_transform/_onconfirm`。

## 1. 初始楼层 Select：响应式确定性引用

### 旧场景

`firstData.floorId` 的 select values 来自 `data.main.floorIds`，range 也检查当前值是否属于楼层列表。

### 目标表达

Field Schema：

```ts
{
  id: "tower.firstFloor",
  label: "初始楼层",
  editor: {
    kind: "select",
    options: { ref: "data:main.floorIds" },
  },
}
```

UI Schema：

```ts
{
  kind: "field",
  fieldSchema: "tower.firstFloor",
  source: { ref: "data:firstData.floorId" },
}
```

数据模型独立验证 `firstData.floorId` 是否引用有效楼层。

### 变化行为

当 `main.floorIds` 变化：

1. select options 响应式更新；
2. 已选值不再存在时仍保留显示；
3. validation 产生 diagnostic；
4. UI 不自动选择第一层或写回数据。

### 审计结论

设计可以表达。它验证了“schema 可以直接引用确定性 data，只有实例上下文才用 params”。实现必须支持表达式依赖追踪和不存在于 options 中的当前值。

## 2. 勇士行走图：Project Registry Reference

### 旧场景

`firstData.hero.image` 从全局图片素材中选择 PNG，并允许 `null`。

### 目标表达

```ts
{
  id: "hero.image",
  label: "行走图",
  editor: {
    kind: "select",
    options: { ref: "project:materials.heroImages" },
  },
}
```

图片目录扫描、切图和扩展名过滤属于独立 Material Registry。Schema 只引用稳定 catalog。

### 审计结论

设计可以表达。`project:` reference 需要统一 entry 结构，包括 raw value、label、资源状态和可选 diagnostic。是否允许 `null` 是 editing value/normalizer 的问题，不应通过在 options 前手工拼 `[null]` 实现。

## 3. 楼层 BGM：Normalizer 与 Reference 分离

### 旧场景

楼层 `bgm` 使用素材选择器：空选择写成 `null`，单选写成字符串，多选写成数组。旧 `_transform` 同时承担音频过滤，`_onconfirm` 承担输出形状转换。

### 目标表达

```ts
{
  id: "floor.bgm",
  label: "背景音乐",
  editor: {
    kind: "reference",
    reference: { ref: "project:materials.bgms" },
    selection: "multiple",
  },
  normalizer: "nullableScalarOrList",
}
```

### 审计结论

设计可以表达，并证明以下职责必须分离：

- BGM 文件发现与过滤：Material Registry；
- 多选 editing value：editor；
- scalar/array/null：normalizer；
- 保存与撤销：command/history。

当 raw shape 不是 `null | string | string[]`，或 normalizer 处理失败时，该 field 进入统一的 `type-mismatch` 状态：显示 JSON Raw Value Fallback，保留原始值可见，并报告错误。它不能把异常值当作空选择继续显示。

用户可以直接编辑 JSON；解析成功后调用原 field source 的 `set`，绕过 `nullableScalarOrList` normalizer，但仍进入 command/history 和持久化。重新读取后如果值恢复为支持形状，UI 自动返回 BGM picker；否则继续停留在 JSON fallback。

当前验证版使用一次性多选 MaterialEditor，只能证明 normalizer 和素材 reference 的边界，还不能作为最终 BGM 数组交互。最终的 `bgmList` 是具名 Field Editor：内部使用通用 Collection Control，每项由可复用的 `BgmItem` 编辑，创建按钮也由 BgmList 连接素材 capability。Collection Control 不等同于 UI Schema ListNode；它只产出完整 editing array，Field Renderer 仍按单 field 提交。

外层 raw 为 `null | string | array` 时先正规化成 editing array。若外层形状无法正规化，整 field 使用 Raw Value Fallback；若外层数组合法但某个 item 不是合法 BGM，则只对该 item 显示 JSON fallback。这样用户可以删除或修复坏 item，而不失去其他 BGM 的专用编辑能力。

楼层贴图采用相同分层：`floorImageList` 组合 Collection Control 与 `FloorImageItem`，后者负责单项的图片、图层、位置、翻转、裁剪、帧数和禁用状态。当前把整个 `images` 数组交给 EventEditor 只是验证版临时实现，后续不应继续作为数组字段的默认交互。

## 4. Tileset 有序追加：Collection Editor 语义

### 旧场景

`main.tilesets` 选择素材后会保留旧条目的相对顺序，并在末尾追加新条目。

### 目标表达

Field Schema 只表达多选 tileset reference。Collection editor 接收当前有序数组，保留仍被选中的旧值的相对顺序，并把新选择追加到末尾；确认后产出完整的新数组。

### 审计结论

这属于 collection editor 如何从用户操作形成最终 editing value，不需要单独的 commit strategy。最终数组按统一协议经过 normalizer（若有）并调用 source 的 `set`；不恢复任意 `_onconfirm` 函数。

## 5. 怪物特殊属性：动态 Project Model Reference

### 旧场景

怪物 `special` 的 checkbox options 来自 `functions.enemys.getSpecials()`。现代 editor 已尝试静态解析该函数并生成 Enemy Special Catalog。

### 目标表达

```ts
{
  id: "enemy.special",
  label: "特殊属性",
  editor: {
    kind: "checkbox-list",
    options: { ref: "project:enemySpecials" },
  },
}
```

### 审计结论

设计可以表达。特殊属性解析、动态名称和解析失败 diagnostic 都属于 `project:enemySpecials`，不属于 schema。

该场景还会驱动 condition，例如只有包含领域类特殊属性时，领域伤害与范围字段才 active。

当前 Enemy SchemaTable 已按此边界实现：`checkboxSet` 可以引用动态 registry，紧凑字段行只显示
当前选择摘要并打开多选弹窗；旧 raw 的 `0 / scalar / array` 由 `numericScalarOrList` 转为统一数组
editing value，提交时写回数组。工程 catalog 无法加载时只在该字段显示 source error。

## 6. 怪物字段联动：Operator Condition

### 旧场景

`zone`、`range`、`haloRange`、`n` 等字段的适用条件主要写在说明文字里，没有真正联动。

### 目标表达

```ts
{
  kind: "field",
  fieldSchema: "enemy.zone",
  source: { ref: "enemy:zone" },
  condition: {
    when: {
      operator: "includes",
      args: [
        { ref: "enemy:special" },
        { literal: 15 },
      ],
    },
    otherwise: "inactive",
  },
}
```

Group 可以使用组合 condition 一次控制一组字段。

### 审计结论

基本 operator 足以覆盖常见联动。内置 UI Schema 可以按字段选择 condition 不满足时的表现：

- `hidden`：隐藏；
- `hidden-if-empty`：source 不存在或 editing value 为 `null` / `undefined` 时隐藏，有值时继续展示并允许编辑；
- `disabled`：展示但只读；
- `inactive`：展示、允许编辑，并使用非激活视觉。

Condition 变化不能清除旧数据。

Condition 依赖 loading 时显示字段骨架；依赖 error 时透出 Error Block；依赖发生 type mismatch 时显示对应 source 的 Raw Value Fallback 和错误。只有依赖全部 ready 后才计算 true/false，不能把未加载或损坏的数据当成 condition false。

怪物 UI Schema 已覆盖 legacy comment 中的全部正式字段，并将多连击、破甲、反击、净化、吸血、
退化、固伤、领域、阻击、激光与光环参数连接到特殊属性 condition。为兼容 raw 的单值特殊属性，
condition 使用具名 `enemy.hasSpecial(raw, id)` call，而不是要求 raw 本身永远是数组。所有 false
分支统一使用可编辑的 `inactive`；光环整组通过 group condition 一次控制。

## 7. 道具类别：Sibling Field Condition

### 旧场景

`itemEffect` 仅适用于 `cls === "items"`；`useItemEffect` 主要适用于 `tools / constants`，`canUseItemEffect` 主要适用于非 `items`，`equip` 主要适用于 `equips`。旧 comment schema 没有真正的 `_hide`，只用文案说明适用范围。

### 目标表达

```ts
{
  kind: "field",
  fieldSchema: "item.itemEffect",
  source: { ref: "item:itemEffect" },
  condition: {
    when: {
      operator: "eq",
      args: [
        { ref: "item:cls" },
        { literal: "items" },
      ],
    },
    otherwise: "inactive",
  },
}
```

### 审计结论

设计可以表达，而且验证了局部 bind 对 field 联动的重要性。Condition 不满足时选择 hidden、hidden-if-empty、disabled 或 inactive，由内置 UI Schema 决定，工程 override 可以修改展示策略，但不能改变数据验证语义。

实现验证使用严格 JSON 的 `item.fields` 和 `item-properties`。由于引擎中的 `cls`
并不是可靠的能力边界，道具字段级统一选择 `inactive`：类别不匹配时仍然显示并允许编辑，
但用明显的非激活色表明它不是当前类别的常规配置。这对模板数据是必要的：部分
`items` 类宝石同时保存 `useItemEffect / canUseItemEffect`，普通剑虽是 `items` 类也已有
`equip`。Condition 只做语义提示，不隐藏任何能力，也不再产生空 group。

## 8. 当前点 Auto Event：先正规化，再使用 List

### 旧场景

`floor.loc.autoEvent` 在点位视图中表现为数字 page ID 到 event 的动态对象；楼层文件中的完整路径是 `autoEvent["x,y"][pageId]`。旧 `_action` 在遍历时隐式补出 `0` 和 `1`，动态 `_data(key)` 为每项返回 autoEvent editor。

该 object record 是旧磁盘格式，不作为新 UI 抽象。数字 key 本质上是数组下标，数据模型直接将 pages 正规化成 `(AutoEvent | null)[]`；缺失的中间下标补 `null`，空 object 对应空 array。

### 目标表达

```ts
{
  kind: "list",
  source: { ref: "loc:autoEvents" },
  itemBind: "autoEvent",
  children: [
    {
      kind: "field",
      fieldSchema: "loc.autoEvent",
      source: { ref: "autoEvent:" },
    },
  ],
}
```

外层 panel 根据当前 floor 和 position 建立 `loc` bind。`loc:autoEvents` 指向正规化后的 canonical list，而不是旧 page object。List 内部为每项建立 `autoEvent` bind，局部 bind 浅层遮蔽同名外层 bind。

### 审计结论

设计可以表达，并确定采用“先正规化，再使用 List”的路径。Record Node 仍然存在，但不由 Auto Event 的旧 page object 来定义。

Array index 就是运行时 page index，不需要额外的 page identity、rename 或 renumber 协议。`set/insert/delete/push` 使用普通数组语义，insert/delete 自然移动后续 index；兼容 codec 再写回 numeric-key object。历史记录使用普通 List operation 的逆操作。渲染不能隐式补 `0/1`。

### 8.1 Record：业务 Key 的动态映射

Record 用于 key 自身有业务含义的动态对象，例如用户变量、按 ID 索引的配置、道具数量表或将来结构化编辑的 name map。它不是 Auto Event 兼容格式的兜底。

```ts
{
  kind: "record",
  source: { ref: "hero:flags" },
  keyBind: "flagName",
  valueBind: "flagValue",
  children: [
    {
      kind: "field",
      fieldSchema: "hero.flagValue",
      source: { ref: "flagValue:" },
    },
  ],
}
```

Record 是必要的正式节点。它提供动态 key 的新增、删除、rename 和 entry bind；recursive rest 仍只负责未建模字段。当前旧表单常把这些对象作为整个 JSON textarea 或专用 event 编辑，后续可以逐项选择是否改用 Record，而不要求第一版全部迁移。

Record Source 按 key 提供 `set/insert/delete/rename`，没有 `push`。List Source 按 array index 提供 `set/insert/delete/push`；`move` 只是可选能力。Item 若自身具有稳定 ID，那是 item value 的一部分，不是 List Source 的基础寻址协议。

## 9. Recursive Rest：未知深层字段

### 场景

工程可能在任意嵌套对象中加入自定义字段。内置 schema 不应要求每层都手写 rest，也不能因漏写而隐藏数据。

### 目标表达

在 UI Schema 末尾放一个根级 recursive rest。它读取 `path` 指向的 object，扣除当前 UI Schema 已引用的字段，再用 `hide` 过滤，剩余内容按原始对象层级展示为“未建模字段”。

### 审计结论

这是一个纯派生视图：输入是 `path` 对应的 object、当前 UI Schema 的字段引用以及 `hide`，输出是待展示的剩余字段。它不修改 data，也不需要额外暴露“路径消费表”概念。

对于未知动态字段，通用 JSON editor 足以兜底，但无法自动获得 event/material 等专用 editor。需要专用编辑的动态集合应使用显式 list/record，而不是依赖 rest 猜测。

## 10. Rest Hide：Runtime 管理字段

### 旧场景

`firstData.hero.equipment/items/followers/steps` 在旧表单中被 `_hide` 隐藏。Recursive rest 若不处理，会重新展示这些字段。

### 目标表达

```ts
{
  kind: "rest",
  path: { ref: "data:main" },
  hide: [
    "firstData.hero.equipment",
    "firstData.hero.items",
    "firstData.hero.followers",
    "firstData.hero.steps",
  ],
}
```

### 审计结论

把 hide 放在 rest 上能够区分：

- field 因 condition 暂时不展示；
- 数据从未被正式建模；
- 数据被明确排除出 rest。

`hide` 只是对 Rest 候选字段集的过滤，不另设命中报告或诊断协议。示例中的路径相对于 Rest 的 `path`；隐藏 object 字段即过滤其整棵子树。

## 11. 楼层 Group 与响应式列数

### 旧场景

楼层属性包含基础信息、移动规则、事件、楼梯点、视觉效果和 BGM。旧表单只按对象顺序纵向展开。

### 目标表达

UI Schema 可以建立嵌套 group：

```text
基础信息
移动与传送
到达事件
视觉与音频
其他字段（rest）
```

Group 不固定列坐标。同一 schema 可在窄面板单列、宽面板多列展示。

### 审计结论

现有场景不需要强布局系统。Group、嵌套和 renderer 决定列数已经足够。尚未发现必须使用 row/column span 的旧表单场景。

## 12. Point Editor：Params 的合理使用

### 旧场景

`upFloor/downFloor/flyPoint` 打开点选择器。选择器需要当前楼层和地图内容，但这些信息不是字段值的一部分。

### 目标表达

Field Schema 使用 point editor，UI 实例通过 params 提供当前楼层上下文：

```ts
{
  id: "floor.upPoint",
  editor: {
    kind: "point",
    floorId: { ref: "params:floorId" },
  },
}
```

### 审计结论

这是 params 的典型用途。它验证了“不把所有 source 外部传入，但保留实例上下文参数”的边界。

点位编辑器还需要区分楼层是否可选。像 `upFloor/downFloor/flyPoint` 这样由 `params:floorId` 固定在当前楼层的字段，调用选点 capability 时使用 `floorSelection: "fixed"`，不展示楼层选择器，也不响应滚轮切楼；真正允许跨楼层取点的调用才保留 `"selectable"`。这是 UI capability 的交互约束，不进入点位 Field Schema 的数据类型。

## 13. Readonly Field 与 UI Action

### 旧场景

楼层 ID、width、height 和图块 ID 在表格中 disable，但编辑器提供其他入口执行重命名或调整尺寸。

### 目标表达

UI Schema 同时放置 readonly field 和独立 action：

```ts
[
  { kind: "field", fieldSchema: "floor.width", source: { ref: "floor:width" } },
  { kind: "field", fieldSchema: "floor.height", source: { ref: "floor:height" } },
  {
    kind: "action",
    action: "floor.resize",
    label: "调整地图尺寸",
    args: {
      floorId: { ref: "floor:floorId" },
      width: { ref: "floor:width" },
      height: { ref: "floor:height" },
    },
  },
]
```

### 审计结论

Action 独立于 Field Schema 是必要的。同一 action 可以影响多个 field 或多个文件，并通过全局 operation history 撤销。

楼层验证版进一步暴露了一个与 Action 分开的展示缺口：`width` 与 `height` 是两个正式数据字段，但侧栏更适合将它们显示为一个只读的 `width × height` 项。当前 Field Node 只能引用一个 source，Group 又只表达层级，不能在不制造派生数据或漏掉 Rest 路径消费的前提下表达这种组合展示。它也不是 Record Node；Record 解决的是动态业务 key，而不是若干已知 field 的紧凑呈现。后续需要为 UI Schema 明确定义“多字段组合展示”原语，再将 resize action 挂在这个组合项上。

验证版的 resize 入口已改为预览弹窗：目标宽高独立输入，旧地图在新坐标系中的位置通过九宫格或精确偏移选择。命令仍接收有符号的 `offsetX/offsetY`；扩张时正偏移表示左/上留白，缩小时负偏移表示裁掉左/上区域。这个 UI capability 仍由 FloorPanel 注入，不代表 Action Node 已进入第一版 parser。

Action 使用 `args: Record<string, Expression>` 在当前词法作用域中显式解析具名参数。实现只接收解析后的 record，不接收整个 bind/params 环境。Action Registry 声明参数 contract，用于在调用前检查缺失值和类型。

Action 完成后，如果原 focus/selection 对应的 UI 项仍存在且 source 仍可解析，则保持原状态；如果原项消失，则直接清空。UI 不自动跳到相邻项，focus/selection 也不进入 undo/redo 历史。

## 14. 创建模板：退出 Schema

### 旧场景

`comment.js` 包含 `items_template`、`enemys_template`、`floors_template`。PrefabPanel 还会从 comment schema 中读取模板执行清空操作。

### 目标表达

- Item Factory 持有新建道具默认值；
- Enemy Factory 持有新建怪物默认值；
- Floor Factory 持有新建楼层默认值；
- 清空、复制和批量操作由 prefab/floor commands 实现。

### 审计结论

模板不应进入 Field Schema 或 UI Schema。迁移时必须先解除 PrefabPanel 对 comment schema 模板的真实运行时依赖，否则即使新 Table 能渲染，命令语义仍被旧 schema 控制。

## 15. Scripts、Plugins、Common Events：专用 UI

### 旧场景

- `functions.comment.js` 为固定脚本 hook 分组并启用 lint/preview；
- `plugins.comment.js` 对已知和未知插件函数提供脚本编辑；
- `events.comment.js` 对任意公共事件 key 提供事件编辑器。

### 目标表达

这些资源复用 Field Schema 和共享 Field Renderer：

- Scripts UI 使用脚本资源目录、代码编辑器、lint 和 preview capability；
- Plugins UI 使用插件资源模型和代码编辑器；
- Common Events UI 使用事件资源模型和 Blockly editor。

它们不使用 UI Schema。资源发现、导航、分组、排序和页面 action 全部由各自的专用 UI 管理；专用 UI 将选中的 source 和对应 Field Schema 交给共享 Field Renderer。

### 审计结论

该边界要求 Field Schema 和 Field Renderer 能脱离 Table/UI Schema 单独使用。Scripts、Plugins、Common Events 可以共享 editor、normalizer、reference、Block 状态和 diagnostic 展示，但不共享 Table 的 group/list/rest/action 组织协议。

Field Schema 自身是类 JSON Schema 的值契约。专用 UI 和 Table UI 都只把 `{ fieldSchema, source }` 交给 Field Renderer；UI Schema 只有 FieldNode 会引用 Field Schema ID，其他节点对 Field Schema 完全无感知。

## 16. 工程全量 Override 与升级

### 旧场景

用户可以直接编辑 comment 文件改变顺序、文案和行为。新设计仍要求工程可定制，但不能继续执行任意函数。

### 目标表达

工程第一次实际修改某 schema 时，复制内置完整 schema，并记录 `forkedFrom.revision` 与 canonical
SHA-256 digest。之后工程副本全量覆盖内置版本；只进入结构编辑模式不会创建文件。

工程文件放在：

```text
.metaphysics/schemas/field/<schemaId>.json
.metaphysics/schemas/ui/<schemaId>.json
```

两类 schema 分目录保存，不要求一一对应。

### 审计结论

该策略保留自定义能力且运行规则清晰。第一版不实现升级 diff 的计算、展示或应用，但以下元数据仍应保存，供未来版本判断 fork 基线：

- 稳定 schema ID；
- 内置 schema version；
- override fork version；
- forked base digest。

Recursive rest 可以降低旧 override 漏掉新数据字段的风险：新数据字段至少会以“未建模字段”出现。第一版不提供把新版内置 field/group 定义合并进工程 override 的流程。

加载时先注册 Editor 内置 Field Bundle，再以工程文件按 `schemaId` 全量替换，并合成全局 Field Registry。
v1 只挂载六个已知 Table slot，不扫描内置不存在的新 Table。损坏的工程 override 必须显示 load error，
不能静默回退到内置版本。Schema 文件统一使用严格 JSON，以便直接复用标准 parser、校验和格式化工具；
不支持保存时难以无损保留注释与风格的 JSON5。

## 17. 审计总结

### 已能表达的主要场景

- Schema 主导 field 顺序；
- 嵌套 group 与响应式列数；
- 直接引用确定性 data/project source；
- params 提供实例上下文；
- operator condition 处理常见字段联动；
- 固定十三项 Expression operator，并以统一 type-mismatch diagnostic 报告签名错误；
- 具名 call 处理复杂 condition；
- raw/edit normalizer；
- 统一的 loading/error/type-mismatch/ready Block 状态；
- recursive rest 与 rest.hide；
- list 和 record 建立局部 entry bind；
- UI action 与 field 解耦；
- validation diagnostic 显示在对应 field；
- 工程通过 `.metaphysics/schemas/{field,ui}` 完整 override 内置 schema；
- condition false 的 hidden、hidden-if-empty、disabled 和可编辑 inactive 展示策略。

### 本轮已澄清的边界

- Field 不需要 commit strategy：editor 产出最终 editing value，normalizer 负责 raw/edit `RawSlot` 转换，source 负责 `set` / `unset`；
- Field Schema 的自定义约束字段名是文件格式定稿时的命名问题，不构成架构能力缺口；
- DataReference 固定为 `{ ref: string }`，只是 Expression 的受限 ref 分支，不预留其他 variant；
- Rest 是标准原语：展示 `path` 所指 object 中未被当前 UI Schema 引用、且未被 `hide` 过滤的字段；
- 专用 UI 调用共享 Field Renderer 的最小输入就是 `{ fieldSchema, source, params? }`，不需要引入 UI Schema。
- 工程 override 升级 diff 明确不属于第一版范围，只保留 fork 元数据。
- Field/UI Schema 文件使用严格 JSON，不引入 JSON5 方言。

### 楼层与 Prefab 属性验证结果及下一步候选

`floor-properties` 已作为首个完整纵向验证实现，而不只验证单独 BGM 字段。结果覆盖 23 个显式 field、四个 group、根级 recursive rest、Material Registry、point/event/code/color editor、RawSlot、diagnostic、raw fallback、Rest CRUD 以及 operation history；新版默认展示，同时保留完整旧 Table 回退。

`defaultGround` 进一步验证了共享 `block` editor：字段行直接展示图块预览和 ID，选择器按普通图块
`cls` 或 tileset 文件名分组，并把选择正规化为引擎实际接受的字符串 ID。选择器读取现有 project
model registry，不要求 UI Schema 额外注入列表，也不会把素材表中未注册的空槽当成可写图块。

空气墙暴露了旧引擎保留编号不在 project registry 中的问题。当前处理不是让所有消费者认识 `17`：
预加载发现三层地图仍使用 `17` 时，会幂等补齐 `maps[17]` 的空气墙定义；`editorDisplay` 为它指定
编辑器专用预览，Project Model、地图渲染和图块选择器随后都走普通注册数据。编号和 `airwall` 字符串
保持不变，因此无需重写地图事件或脚本，旧引擎仍可运行迁移后的工程。

该验证也明确了两点此前文档没有落到接口上的细节：Writable source 必须同时提供 `set` 和 `unset`；normalizer 的输入输出必须是 `RawSlot`，否则无法区分 missing 与 present-null。Rest 的 JSON editor 复用同一写入能力，而不是另设保存协议。

MapBlock、Item 与 Enemy 也已完成纵向接入。Enemy 进一步证明动态 `project:` registry、具名 call、
历史 scalar/list normalization 以及 field/group 两级 `inactive` 能在同一窄侧栏内协作；特殊属性
catalog 继续由 Project Model 负责，Field/UI Schema 中没有可执行字符串或复制的静态编号表。

下一轮不再需要重复证明楼层 BGM 或怪物 condition。此前候选中的初始楼层与专用工作区已经完成：

- 全塔初始位置从动态 floor registry 读取候选，并由跨资源 diagnostic 校验初始楼层；
- Scripts/Plugins/Common Events 已成为独立全屏工作区，分别复用 CodeMirror 或 EventEditor 核心，
  不要求为列表和树引入虚假的 UI Schema 节点；
- 资源注册被明确保留在资源工作区和 project model/command 层，不塞入全塔 Schema。

当前更有价值的下一步候选是：

1. 当前点 autoEvent：先实现 canonical normalization，再验证 List、item bind 和兼容格式 round-trip；
2. 将资源引用影响范围从确认文案提升为可定位到楼层/图块的结构化诊断。

`.metaphysics` loader 已完成 v1：六张新版内置表均可进入真实表格的结构编辑模式，节点抽屉分别编辑
UI 节点和当前 Field，并可按需打开完整 Field Bundle/Table 源码。工程文件按 `schemaId` 全量替换内置
定义；首次实际修改记录 `forkedFrom.revision/digest`，损坏配置直接显示 load error。字段、节点属性、
位置、Group 子树、删除项与整层还原分别进入 history；升级 diff、展示和合并仍明确延期。

### BGM List 与楼层贴图后续验证

楼层 BGM 已从一次性多选素材框扩展为真正的 item list：点击项目本身替换，左侧 drag handle
重排；新增入口仍使用素材多选并可一次追加多项。集合控件提供新增、删除和排序。这里的
`CollectionControl` 是 field editor 内部的 UI 抽象，不等同于延期中的 Table
`List` node；它不解析 source/bind，也不直接写数据。

楼层贴图采用同样的边界：Table 只得到一个 `floorImages` field editor。编辑器内部维护数组草稿，
楼层弹窗配置摆放相关字段并通过 drag handle 排序；图片文件选择和 `sx/sy/w/h` 裁剪移入独立
图片弹窗，由文件缩略图和可视框选完成。地图上的拖拽只修改当前项的 `x/y`，确认后才通过
field source 整体提交。该编辑器已覆盖原 Blockly editor 的操作范围，楼层属性中不再提供
Blockly 兼容入口；数据格式与写入链不变。

图片弹窗本身是共享组件：楼层贴图开启 crop 参数；怪物/图块绑定贴图关闭 crop、允许逻辑切分图片，
并只把选中的图片名交回 material field editor。

天气字段验证了一个更小的组合控件边界：`optionalWeather` 将 raw tuple 映射为具名 editing
record，通用 `combine` 再按 key 组合 `suggestion(type)` 与 `number(level)`。suggestion 的候选
仅用于辅助输入，不构成 enum，因此插件注册的天气名仍可直接输入；非法 tuple 和越界强度进入
raw fallback，并由楼层数据 diagnostic 定位。
