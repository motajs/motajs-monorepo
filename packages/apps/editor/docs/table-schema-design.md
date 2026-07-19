# Table Schema 设计草案

状态：Field/Table Schema v1 已落地；List、Record、Action 与升级 diff 仍延期。

本文记录现代编辑器 Table Schema 的当前设计共识。它描述的是目标模型，不要求兼容旧 `_server/table/*.comment.js` 的内部结构。旧表单场景对本设计的审计见 [table-schema-audit.md](./table-schema-audit.md)。

## 1. 目标与边界

Table Schema 是工程数据的可定制 UI 投影。它负责：

- 指定 field 的展示顺序；
- 用 group 组织 field，并允许 group 嵌套；
- 选择 field editor；
- 声明 UI condition、动态选项等常见表达式；
- 用递归 rest 展示未被命名的字段；
- 在 UI 中放置与 field 无关的 action；
- 通过 list 重复渲染同一项结构，并为每一项建立局部 bind。

它不负责：

- 定义数据是否合法；
- 执行数据验证；
- 注册素材、脚本、插件或公共事件；
- 隐式补默认值或迁移数据；
- 在渲染过程中修改工程数据；
- 执行任意 JavaScript 字符串。

数据模型持有数据、命令和验证结果。素材等全局注册表是独立的 project model。Table Schema 可以引用它们，但不拥有它们。

## 2. 两层 Schema

Field Schema 和 UI Schema 是两层独立、JSON-compatible 的声明式文件，两者不要求一一对应。

### 2.1 Field Schema

Field Schema 是类 JSON Schema 的值契约，描述一个具名 field 的数据形状和编辑语义，例如：

- `type`、`enum`、object properties、array items 等结构约束；
- label 和说明；
- editor 类型；
- editor 使用的 reference；
- raw value 与 editing value 之间的 normalizer；
- editor 相关的表达式属性；
- 自定义约束的 code 和人类可读描述。

Field Schema 不描述 field 在某个页面中的位置。自定义约束描述是声明式元数据，不携带任意验证函数；验证执行和结果仍属于 Data Resource。Field Renderer 根据 diagnostic code 将数据上的验证结果与 Field Schema 中的约束描述组合展示。

v1 Field Bundle 使用 record 保存完整 Field ID；record key 就是 ID，定义内部不再重复 `$id`：

```json
{
  "kind": "field-bundle",
  "formatVersion": 1,
  "schemaId": "floor.fields",
  "revision": 1,
  "fields": {
    "floor.title": {
      "type": "string",
      "title": "楼层标题",
      "editor": { "kind": "text" },
      "diagnostics": {
        "floor.title.invalid": "必须是合法的楼层标题"
      }
    }
  }
}
```

静态 shape 只支持 `type / enum / properties / required / items`；未知属性与未支持的 JSON Schema
keyword 均报错。`diagnostics` 是 code 到通用说明的 record；实际 message、severity、source 与 related
source 由数据层提供。Field Schema 保持 JSON-compatible，不允许函数体或其他不可序列化值。

`block` editor 是共享 Field Editor 原语之一：editing value 是稳定的图块 ID 字符串（普通图块如
`ground`，额外 tileset 图块如 `X10000`）。可选图块由 Editor 确定性读取工程的 block、sprite 与
tileset registry；Field Schema 不复制这些注册表，也不描述分类栏、折叠密度等选择器布局。无法在
registry 中解析的既有字符串仍按原值展示，不在渲染阶段改写数据。

逻辑图块可以在工程 `maps.js` 定义中携带 `editorDisplay`，为编辑器指定独立图片及裁剪位置；该属性
不参与游戏逻辑，也不属于 UI Schema。它用于空气墙这类游戏中透明、编辑时必须可见的少数图块，
避免把固定编号或素材路径继续硬编码进各个 picker 和 renderer。旧工程出现数字图块 `17` 时，编辑器
一次性补全普通的 `maps[17]` 注册及该显示属性，保留 `17/airwall` 编号协议以兼容既有事件和旧引擎。

### 2.2 UI Schema

UI Schema 负责顺序、分组、作用域和操作，对 Field Schema 的内部结构无感知。只有 FieldNode 在标记当前 field 的数据 source 时引用一个 Field Schema ID；group、list、record、rest 和 action 都不引用 Field Schema。

当前节点集合为：

```ts
type UINode =
  | FieldNode
  | GroupNode
  | ListNode
  | RecordNode
  | RestNode
  | ActionNode;
```

脚本、插件和公共事件复用 Field Schema 和 Field Renderer，但不使用 UI Schema。它们由专用 UI 负责资源发现、导航、分组和操作，再把具体值交给共享 field editor。

## 3. 引用、Bind 与作用域

### 3.1 稳定命名空间

Schema 可以确定性引用稳定数据，不需要把所有依赖都从外部传入。当前预期的引用根包括：

```text
data      当前工程数据的绝对根
project   编辑器生成的工程模型和全局注册表
params    当前 UI 实例才能确定的参数
value     当前 field 的 editing value
```

局部 bind 可以增加其他名称，例如 `hero`、`floor`、`loc`、`autoEvent`。

示例：

```ts
{ ref: "data:main.floorIds" }
{ ref: "project:materials.images" }
{ ref: "params:floorId" }
{ ref: "hero:hp" }
```

`DataReference` 没有其他 variant 或属性，它就是 Expression 中受限的 ref 分支：

```ts
type DataReference = { ref: string };
```

单独命名这个类型是为了表达能力边界：Field/List/Record 的 `source`、Rest 的 `path` 和 Group 的 `bind` 必须是可寻址引用，不能使用 `literal`、`operator` 或 `call`。保留 `{ ref }` 对象形状则使它可以和 options、condition、action args 中的 Expression 共用同一种 AST 表示，并避免把普通字符串值误解释成引用。

可写 field 和 list 的 source 必须最终解析为可寻址的数据引用。普通计算表达式可以用于 condition、label 和 options，但不能伪装成可写 source。

所有具体 source capability 建立在同一个响应式只读接口上：

```ts
type RawSlot<T> =
  | { present: true; value: T }
  | { present: false };

interface ValueSource<T> {
  snapshot(): BlockResolution<RawSlot<T>>;
  subscribe(listener: () => void): () => void;
  reload?(): Promise<void>;
}

interface WritableValueSource<T> extends ValueSource<T> {
  set(value: T): Promise<void>;
  unset(): Promise<void>;
}
```

ListSource、RecordSource 和普通 field source 在此基础上分别增加允许的写操作。`BlockResolution` 的统一状态语义见 9.1 节。

### 3.2 Params

只有实例化时才能确定的上下文才通过 params 传入，例如：

- 当前楼层 ID；
- 当前地图坐标；
- 当前选中的 prefab。

可以从 `data` 或 `project` 确定性取得的内容不应重复成为 params。例如初始楼层 select 的选项应直接引用 `data:main.floorIds`。

### 3.3 局部 Bind

容器节点可以为后代建立局部 bind，减少重复绝对路径：

```ts
{
  kind: "group",
  bind: {
    hero: { ref: "data:firstData.hero" },
  },
  children: [
    { kind: "field", fieldSchema: "hero.name", source: { ref: "hero:name" } },
    { kind: "field", fieldSchema: "hero.hp", source: { ref: "hero:hp" } },
  ],
}
```

作用域使用浅层覆盖：

```ts
childBindings = {
  ...parentBindings,
  ...localBindings,
};
```

因此局部同名 bind 会遮蔽外层 bind；其他外层 bind 继续可用；离开节点后不会影响兄弟节点。

## 4. 表达式原语

Field Schema 和 UI Schema 都需要有限、确定性的表达式能力。它用于 condition、动态 options、label 等展示计算，不替代数据验证。

概念模型：

```ts
type Expression =
  | { literal: unknown }
  | { ref: string }
  | {
      operator:
        | "eq"
        | "ne"
        | "gt"
        | "gte"
        | "lt"
        | "lte"
        | "and"
        | "or"
        | "not"
        | "in"
        | "includes"
        | "exists"
        | "empty";
      args: Expression[];
    }
  | {
      call: string;
      args?: Expression[];
    };
```

能力按复杂度分三级：

1. literal 和 ref；
2. 内置 operator；
3. 编辑器公开的具名外部 call。

工程自定义 schema 可以自由组合前两级。复杂领域逻辑可以调用第三级，但 schema 不允许携带函数体或任意 JavaScript。

内置 operator 集合即以上十三项，第一版不再增加算术、字符串拼接、任意属性访问等能力。签名固定为：

| Operator | 参数与结果 |
| --- | --- |
| `eq(a, b)` / `ne(a, b)` | 任意 JSON-compatible 值；不做类型转换，array/object 按结构比较 |
| `gt(a, b)` / `gte(a, b)` / `lt(a, b)` / `lte(a, b)` | 两个有限 number，返回 boolean |
| `and(...values)` / `or(...values)` | 一个或多个 boolean，按短路规则求值 |
| `not(value)` | 一个 boolean |
| `in(value, values)` | `values` 必须是 array，按 `eq` 语义判断成员关系 |
| `includes(container, value)` | `container` 为 array 时按 `eq` 判断成员；为 string 时 `value` 必须是 string |
| `exists(ref)` | 参数必须是 ref；路径存在即为 true，值为 `null` 仍算存在 |
| `empty(value)` | `null`、`undefined`、空 string、空 array、空 object 为 true；`false` 和 `0` 为 false |

operator 不做 JavaScript 隐式类型转换。参数数量或类型不符合签名时，解释器产生包含 operator、expression path、expected 和 actual 的 diagnostic，并让使用该表达式的 Block 进入统一的 `type-mismatch` 状态。`exists` 遇到路径缺失返回 false，但仍传播 source 的 loading 和 error；外部 `call` 的参数类型由其 registry contract 用同一协议检查。

表达式解释器应能从 ref 收集响应式依赖。被引用数据变化时，只重新计算相关 condition 或 options，不重新执行整个 schema 文件。

## 5. Field

Field Node 将 Field Schema 放到某个 UI 位置，并绑定真实数据 source：

```ts
interface FieldNode {
  kind: "field";
  fieldSchema: string;
  source: DataReference;
  condition?: Condition;
}
```

UI Schema 编译器只校验 `fieldSchema` ID 存在，不读取或合并其 type、constraint、editor 或 normalizer。运行时由 Field Renderer 接收 `{ fieldSchema, source }` 并完成值解析、控件选择和 diagnostic 展示。

显式 field 是否存在于当前数据，不影响其展示顺序。不存在、`undefined` 和 `null` 必须保持不同状态。渲染 field 不得为了展示而向数据中写入 `null`；只有用户命令可以新增、修改或删除路径。

只要 field 已在 schema 中声明，它的 source 就被视为已消费。即使 condition 使它暂时隐藏，递归 rest 也不能再次收集该路径。

## 6. Group 与布局

Group 是语义容器，不是完整布局系统：

```ts
interface GroupNode {
  kind: "group";
  id: string;
  label?: string;
  bind?: Record<string, DataReference>;
  condition?: Condition;
  children: UINode[];
}
```

Group 允许嵌套。列数由 renderer、容器宽度或用户显示设置决定，而不是由 schema 固定网格坐标。第一版不设计 row span、column span 等强布局能力。

## 7. List

List 是建立重复 UI 和局部 source scope 的结构节点，不只是一个数组输入控件。

```ts
interface ListNode {
  kind: "list";
  source: DataReference;
  itemBind: string;
  condition?: Condition;
  children: UINode[];
}
```

List 从 source 读取集合，并为每个 item 建立局部 bind：

```ts
{
  kind: "list",
  source: { ref: "loc:autoEvents" },
  itemBind: "autoEvent",
  children: [
    {
      kind: "field",
      fieldSchema: "autoEvent",
      source: { ref: "autoEvent:" },
    },
  ],
}
```

List 按 array index 寻址，并提供以下四个基础写操作：

```ts
interface ListSource<T> extends ValueSource<readonly T[]> {
  set(index: number, value: T): Promise<void>;
  insert(at: number, value: T): Promise<void>;
  delete(index: number): Promise<void>;
  push(value: T): Promise<void>;
  move?(from: number, to: number): Promise<void>;
}
```

- `set` 替换指定 item；
- `insert` 在指定位置插入；
- `delete` 删除指定 item；
- `push` 追加到末尾；
- `move` 是可选额外能力，不是所有 List 都允许移动。

所有写操作都进入 command/history。List 不在遍历阶段隐式补元素。

Auto Event 的旧磁盘格式虽然是数字 key object，但进入 UI Schema 前应先由数据模型正规化为 list；不能让旧格式反向决定 List 的抽象。

### 7.1 Field Editor 内部的 Collection Control

UI Schema 的 ListNode 与数组字段内部使用的集合控件不是同一层抽象。

- ListNode 是 Table 结构原语：直接连接 ListSource，为每个 item 建立 bind，并允许在 item 作用域中继续放置 Field、Group、Rest 等 UI Schema 节点；
- Collection Control 是 React UI 原语：只接收某个 Field Editor 的 editing value，不认识 source、bind、Field Schema、normalizer 或 operation history；
- Table/Field Renderer 看到的仍然是一个具名 Field Editor，例如 `bgmList` 或 `floorImageList`。整个数组仍是一个 field value。

概念接口可以是：

```ts
interface CollectionControlProps<T> {
  value: readonly T[];
  disabled?: boolean;
  item: ComponentType<CollectionItemProps<T>>;
  create: () => T | null | Promise<T | null>;
  onChange: (next: readonly T[]) => void | Promise<void>;
  movable?: boolean;
}

interface CollectionItemProps<T> {
  value: T;
  index: number;
  disabled?: boolean;
  onChange: (next: T) => void | Promise<void>;
}
```

Collection Control 负责通用的数组交互：替换、插入、删除、追加，以及在启用时移动。它不生成领域 item，不猜测 item 的展示，也不直接写 source。具名 Field Editor 负责提供 item component 和 create capability：

```tsx
function BgmList(props: FieldEditorProps<string[]>) {
  return (
    <CollectionControl
      value={props.value}
      item={BgmItem}
      create={createBgmItem}
      onChange={props.onCommit}
      movable
    />
  );
}
```

`BgmItem` 同时用于 BGMList 的单项编辑和真正的单 BGM 字段；`FloorImageItem` 同理负责一个楼层贴图对象的展示、编辑和创建默认值。schema 只保存具名 editor 及其 JSON-compatible 参数，组件实现来自 Editor Registry，不把 React component 或 create 函数序列化进 schema。

Field Renderer 在每次明确的 create/delete/move/item confirm 后接收完整的新 editing array，再统一经过 normalizer 并调用 field source 的 `set`。因此它不需要 ListSource，也不会让 Table 直接按数组 index 写数据；每次用户动作仍形成一个普通 field command/history entry。

错误边界分两级：外层容器无法正规化时使用整个 field 的 Raw Value Fallback；外层是合法数组但某个 item 类型不匹配时，只让该 item 进入 item-level JSON fallback，其他 item 仍可正常编辑。BGM 的 `null | scalar | array` normalizer 只负责外层兼容形状，不能因为数组中一个坏 item 就把整组列表降级。

### 7.2 Record

Record 用于 key 本身具有业务意义的动态映射，例如用户变量、按 ID 索引的配置或数量表。它与 List 的区别是：

- List 的主要身份是 array index 和顺序；
- Record 的主要身份是用户可见、可新增或重命名的 key；
- Record item 同样通过局部 bind 暴露给子节点；
- Record 提供按 key 的 `set/insert/delete/rename`，但没有 `push`；
- 所有写操作都必须是显式 command。

概念模型：

```ts
interface RecordNode {
  kind: "record";
  source: DataReference;
  keyBind?: string;
  valueBind: string;
  condition?: Condition;
  children: UINode[];
}
```

对应 source capability 的概念接口为：

```ts
interface RecordSource<T> extends ValueSource<Readonly<Record<string, T>>> {
  set(key: string, value: T): Promise<void>;
  insert(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
}
```

Record 没有不指定 key 的追加语义，因此没有 `push`。

Record 不等同于 recursive rest。Record 表示 schema 已知这里是一个动态映射，并能为每个 entry 指定正式 editor；rest 只为未建模数据提供通用兜底。

### 7.3 Auto Event 正规化

旧楼层文件按以下结构保存自动事件：

```text
autoEvent["x,y"][pageId] = event | null
```

数字 key 的行为本质上是数组下标。数据模型应直接正规化为：

```ts
type CanonicalAutoEventPages = Array<AutoEvent | null>;
```

正规化规则为：

- object 的数字 key 直接成为 array index；
- 中间缺失的 index 用 `null` 补齐；
- 空 object 对应空 array，不在读取时隐式补 `0/1`；
- array index 就是运行时 page index，不再单独保存 page identity；
- `set/insert/delete/push` 使用普通数组语义，insert/delete 会移动后续 index；
- 兼容 codec 负责 canonical array 与旧 numeric-key object 的双向转换；
- 所有数组操作由 operation history 记录逆操作，不需要 Auto Event 专用 rename/renumber 历史协议。

UI Schema 只消费 canonical list，不直接理解旧 page object。引擎将 index 用于 symbol 和同优先级排序，正好对应正规化数组的下标语义。

## 8. Recursive Rest

Rest 是一个标准 UI 原语：它读取 `path` 指向的 object，递归展示其中未被当前 UI Schema 引用、且未被 `hide` 过滤的字段。一个根级 rest 应足以保证 schema 漏写字段时数据仍然可见。

收集逻辑为：

```text
path 所指 object 中的所有递归字段
- 当前 UI Schema 引用的字段
- hide 匹配的字段
= rest 展示的路径
```

概念模型：

```ts
interface RestNode {
  kind: "rest";
  path: DataReference;
  hide?: string[];
  condition?: Condition;
}
```

约定：

- `path` 必须解析为 object；否则使用所有 Block 通用的 loading、error 或 type-mismatch 展示；
- “已引用”由当前 UI Schema 中的显式 Field、List 和 Record 决定；节点即使因 condition 暂时隐藏，仍然算作已引用；
- Rest 递归收集剩余字段，而不是只处理 object 的直接子字段；
- `hide` 是对剩余字段集的过滤，pattern 相对于 `path`，支持精确字段和整棵子树；
- 自动生成的内容保留原始对象层级；
- 未命名字段使用通用 editor，并明确标记为未建模；
- 数组默认视为原子值，除非由显式 list 消费；
- 空对象、空数组和 `null` 不得在递归中消失。

Rest 中每层 object 都保留新增入口；叶子使用 JSON editor 修改，object/叶子都可以删除。新增和修改调用目标路径的 `set`，删除调用 `unset`，全部经过正常 command/history。Rest 不引入另一套 mutation 协议，也不在渲染时创建缺失 object。

Hide 只属于 rest。显式 field 的临时隐藏由 condition 表达，不使用 rest.hide。

## 9. Condition 与字段联动

Condition 是 UI Schema 的响应式展示逻辑，可以挂在 field、group、list、rest 或 action 上。

概念模型：

```ts
interface Condition {
  when: Expression;
  otherwise: "hidden" | "hidden-if-empty" | "disabled" | "inactive";
}
```

`when` 为 true 时，节点按正常状态展示；为 false 时，由 `otherwise` 决定表现：

- `hidden`：始终不展示，但仍视为已引用；
- `hidden-if-empty`：仅用于具有主 source 的节点；没有值时隐藏，已经有值时仍展示并允许编辑；
- `disabled`：展示但不可编辑；
- `inactive`：展示并允许编辑，但使用非激活视觉明确提示当前配置暂不生效。

这里的“没有值”固定表示 source 路径不存在，或 Field Renderer 得到的 editing value 为 `null` / `undefined`，不用 JavaScript truthiness 判断。`false`、`0`、空字符串、空数组和空对象仍是值；如果某个领域希望把这些形状视为空，应由 normalizer 明确转换，不能让 Condition 隐式猜测。

Condition 状态变化不得自动删除或改写数据。

常见联动用 operator condition 表达；真正复杂的领域判断使用具名外部 call。Condition 不承担合法性验证，验证仍由数据模型完成。

### 9.1 Block 解析状态

Condition 不是特殊孤例。任何 UI Block 都要面对 source、reference、expression 和 normalizer 尚未得到可用值的情况。所有节点共享统一的解析状态：

```ts
type BlockResolution<T> =
  | { status: "loading" }
  | { status: "error"; error: Error }
  | { status: "type-mismatch"; rawValue: unknown; error: Error }
  | { status: "ready"; value: T };
```

统一展示规则为：

- `loading`：保留该 block 的位置，控件区域显示骨架；
- `error`：显示 Error Block，直接透出上游 error；如果 source 支持恢复或重试，Error Block 可以提供对应操作；
- `type-mismatch`：显示 Raw Value Fallback，展示原始值并同时报告类型错误；
- `ready`：继续计算 condition，并渲染正常 editor 或容器。

Normalizer 无法接受 raw value、expression operator 收到错误类型、reference entry 形状不符合协议，都进入 `type-mismatch`，不能伪造默认值继续渲染。

Raw Value Fallback 固定使用通用 JSON editor：

1. 使用格式化 JSON 展示原始 raw value 和当前错误；
2. JSON 语法错误时留在编辑态并显示解析错误，不提交；
3. JSON 解析成功后绕过 normalizer，直接调用原 `WritableValueSource.set(parsedValue)`；
4. `set` 必须进入正常 command/history 和持久化流程；
5. 提交完成后重新读取 source，并从头执行 block resolution；
6. 新值恢复为 editor 支持的类型时自动返回正式控件，否则继续显示 Raw Value Fallback 和新错误。

如果原 source 只读，Raw Value Fallback 仍展示 JSON 和错误，但编辑及提交能力禁用。Fallback 不绕过 Data Source，只绕过无法处理当前值的 normalizer。

Condition 只在其依赖全部 ready 后求值。依赖 loading、error 或 type mismatch 时，使用上述统一 Block 状态，而不是把 condition 当作 false。这样不会把“尚未加载”或“数据损坏”误表现为字段不适用。

## 10. Reference 与动态选项

Select 等 editor 可以直接引用确定性数据或 project model：

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

Reference 必须响应源数据变化。例如 `main.floorIds` 变化时，初始楼层 select 的选项立即更新。

当当前值已经不在新选项中时：

- 保留并显示原值；
- 数据模型重新验证并产生 diagnostic；
- Table 将错误显示在对应 field；
- UI 不自动替换或删除当前值。

素材、怪物特殊属性等动态选项通过 `project:` 命名空间引用独立注册表，不在 Table Schema 中重新注册。

## 11. Normalizer

Normalizer 负责 raw value 与方便编辑的 editing value 之间的双向转换。它不是 validation，也不是 action。

例如楼层 BGM：

```text
raw null       -> edit []
raw "a.mp3"    -> edit ["a.mp3"]
raw ["a","b"] -> edit ["a","b"]

edit []        -> raw null
edit ["a"]     -> raw "a"
edit ["a","b"] -> raw ["a","b"]
```

概念接口：

```ts
interface Normalizer<Raw, Edit> {
  toEdit(raw: RawSlot<Raw>): Edit;
  toRaw(edit: Edit, previous: RawSlot<Raw>): RawSlot<Raw>;
}
```

Schema 只引用注册的 normalizer ID，不携带函数体。`toEdit` 不能写回数据；保存后应重新读取 raw value，再生成 editing value。`RawSlot` 明确区分路径缺失与路径存在且值为 `null`；Field Renderer 根据 `toRaw` 返回的 `present` 调用 `set` 或 `unset`。

`toEdit` 抛错或返回不符合 editor 协议的值时，Block 进入 `type-mismatch`，使用 Raw Value Fallback 展示原始 raw value 和错误。它不能用空数组、`null` 或其他默认 editing value 掩盖异常数据。

文件类型过滤属于 reference source；去除扩展名或 scalar/list 转换属于 normalizer。控件负责产生最终 editing value，再经 normalizer 转为 raw value 并调用 source 的 `set`；保持已有相对顺序、新选择追加等行为是 collection editor 的交互语义，不需要额外的 commit strategy。

## 12. Validation 与 Diagnostic

Validation 的执行和结果加在数据模型上，而不是 UI Schema 上。Field Schema 可以描述标准结构约束和自定义约束 code，但不持有某份数据的验证状态。Data Resource 对外提供 value 和 diagnostics：

```ts
interface Diagnostic {
  source: string;
  path?: string;
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
  related?: DiagnosticReference[];
}
```

Field Renderer 根据 FieldNode 的 source 自动接收同路径 diagnostic，并使用 Field Schema 的约束描述补充展示。跨字段或跨资源错误可以通过 related reference 显示在多个对应 field 上。UI Schema 不读取 diagnostic 或约束描述。

Validation 和 reference options 可以依赖同一份数据，但互不调用。例如楼层列表变化会同时更新 select options 和初始楼层 diagnostic。

## 13. Action

Action 属于 UI Schema，不属于 Field Schema：

```ts
interface ActionNode {
  kind: "action";
  action: string;
  args?: Record<string, Expression>;
  label?: string;
  condition?: Condition;
}
```

Schema 引用具名 action；实现由编辑器 command/capability 提供。Action Node 使用具名参数 record 显式组装调用参数：

```ts
{
  kind: "action",
  action: "floor.resize",
  label: "调整地图尺寸",
  args: {
    floorId: { ref: "floor:floorId" },
    width: { ref: "floor:width" },
    height: { ref: "floor:height" },
    currentSelection: { ref: "params:selection" },
  },
}
```

参数表达式在 Action Node 当前词法作用域内解析，因此可以引用局部 bind、稳定根和 params。Action 实现只接收解析完成的具名参数 record，不接收整个 bind/params 环境，也不能隐式读取 UI Scope。

Action Registry 应为每个具名 action 声明参数 contract，并在执行前检查缺失参数和类型。参数解析同样遵循统一 Block 状态：loading 显示骨架，error 透出错误，type mismatch 显示参数错误；不能用缺省值静默调用 action。

Action 完成后的 focus/selection 使用简单的存在性规则：原 UI 项仍存在且 source 仍可解析时保持原状态；原项被删除、被 condition 隐藏或 source 不再可解析时清空。UI 不自动选择相邻项，也不把 focus/selection 纳入 operation history。

楼层重命名、地图尺寸调整、prefab 复制粘贴等长期看适合成为 action，而不是特殊 field patch。`floor-properties` 验证版仍未把 Action Node 加入 parser；重命名按钮和带位置预览的 resize 弹窗暂由 FloorPanel 按 field source 注入，用于验证交互而不冒充 schema 已具备 Action 能力。

## 14. 内置 Schema 与工程 Override

Editor 自带完整 schema。工程可以修改 schema；一旦修改，则在工程内保存完整副本并全量 override 内置版本，不做逐字段 overlay。

工程 schema 统一放在隐藏的工程元数据目录中：

```text
.metaphysics/
  schemas/
    field/
      <schemaId>.json
    ui/
      <schemaId>.json
```

Field Schema 和 UI Schema 分目录保存，两层文件不要求一一对应。文件统一使用严格 JSON，不支持 JSON5。这样可以直接使用标准 JSON parser、JSON Schema 校验和格式化工具，也避免 Editor 重写文件时丢失注释或改变 JSON5 风格。

内置 schema 使用显式语法版本与内容修订号：

```json
{
  "kind": "table-schema",
  "formatVersion": 1,
  "schemaId": "tower-properties",
  "revision": 7,
  "nodes": []
}
```

工程 override 保存完整文件，并记录其内置 fork 基线：

```json
{
  "kind": "table-schema",
  "formatVersion": 1,
  "schemaId": "tower-properties",
  "revision": 7,
  "forkedFrom": {
    "revision": 7,
    "digest": "sha256:..."
  },
  "nodes": []
}
```

digest 是递归排序 object key 后的 canonical JSON SHA-256；工程修改不会递增 `revision`。override 与当前
内置内容 canonical 相等时删除工程文件，避免持久化无意义副本。

加载顺序固定为：

1. 加载 Editor 内置 Field/UI Schema；
2. 并行读取六个已知 Field override，按 `schemaId` 全量替换同 ID Bundle；
3. 所有有效 Bundle 合成全局 Field Registry，重复 Field ID 标记 ambiguous；
4. 在 Registry ready 后加载已知 Table override，并校验其跨 Bundle Field 引用。

v1 不扫描或挂载未知 Table 文件。Field/Table override 都是全量替换而非 overlay；重复 Field ID 只使引用
该 ID 的 Table 失败，不拖垮无关 Table。验证版的 `fields` array、缺少 `formatVersion: 1` 或使用 slash
reference 的工程文件直接显示“不支持的 Schema 格式”，不自动迁移、不静默回退。

工程 override 解析或校验失败时必须展示 schema load error，不能静默退回同 ID 内置版本，否则用户会误以为自己的修改已经生效。工程中没有对应文件时才使用内置版本。

工程 override 的升级 diff、diff 展示和自动应用第一版均不实现。`forkedFrom` 当前只保留来源信息，不触发任何合并行为。

## 15. 本轮设计结论

本轮提出的未决项均已收束。Schema 落盘使用严格 JSON；Expression operator 使用第 4 节固定集合；Condition false 的表现由 UI Schema 配置；工程 override 升级 diff 不属于第一版范围。

## 16. Floor SchemaTable 验证版结果

首个纵向验证位于 `src/components/SchemaTable` 和 `Workbench/FloorPanel`。内置 `floor.fields.json` 与 `floor-properties.json` 使用严格 JSON，迁移 23 个楼层属性并按“基本信息 / 通行与传送 / 到达与脚本 / 视觉与音频”排序；根级 Rest 递归覆盖其余工程字段，并过滤地图层和点位事件等运行时管理字段。

本验证版确认了以下实现约束：

- Field source 使用 `RawSlot`，normalizer 决定 `set` 或 `unset`，渲染阶段不补默认值；
- Raw Value Fallback 只绕过 normalizer，JSON 解析成功后直接 `set`；提交失败保留编辑文本并显示行内错误；
- 数据模型产生 diagnostic，Renderer 按 source reference 定位；Field Schema 只声明约束 code；
- Rest 支持递归收集以及每层 object 的新增、叶子修改和删除；数组保持原子；
- `floor:path`、`params:name`、`project:registry.name` 由外部 scope 解析；素材 registry 不写入 schema；
- Schema parser 第一版只接受 Field、Group、Rest；List、Record、Action 会形成明确 load error；
- FloorPanel 默认新版，旧 Table 与编辑模式只在切到旧版后出现；旧 comment schema 不再提供自定义入口，rename/resize 继续使用现有工具；
- BGM 的 `nullableScalarOrList` 已验证 null、scalar、array 以及非法 raw fallback；所有写入继续进入 operation history。

在后续楼层纵向验证中，BGM 与楼层贴图改为具名 field editor。`BgmList` 复用通用
`CollectionControl`，由 BGM item 自己提供素材选择、替换和显示，集合层只负责新增、删除与排序。
BGM item 整行点击即替换，左侧 drag handle 用于排序；新增入口允许一次选择多首音乐并批量追加；
提交值仍经过 `nullableScalarOrList`，因此 raw 的 `null / string / string[]` 兼容格式没有泄漏到列表控件中。

楼层贴图仍使用原有 `FloorImageData[]`。楼层弹窗只编辑图层、翻转、位置、帧数和启用状态，
贴图列表使用 drag handle 排序；右侧地图预览中的拖拽只把像素位移写回该项 `x / y`。
图片选择与裁剪由独立图片弹窗负责：左侧按文件缩略图浏览，右侧大图框选并精确调整
`sx / sy / w / h`。确认前不写数据。新编辑器覆盖了原 Blockly 入口的能力，因此 UI 不再保留
Blockly 按钮；底层 `FloorImageData[]` 格式保持不变，异常值仍可经 raw fallback 修复。
同一个 `ImageAssetPickerModal` 也用于怪物与图块的绑定贴图；调用方通过参数决定是否包含逻辑切分
图片以及是否开放裁剪。绑定贴图只返回图片名，不暴露或产生裁剪参数。

窄侧栏中的字段表使用“字段 / 值与操作”两列。操作作为控件的一部分随值区域自然排布，不再
单独预留固定操作列。Field Schema 的 `description` 与 constraint description 由字段名 hover
tooltip 展示，表格行内不展开帮助文本。
tooltip 第一行来自 UI Schema source 的末级 key，随后才是 Field Schema description 与约束说明；
因此同一个 Field Schema 绑定到不同 source 时会显示各自的数据 key。可清空字段仅在 raw value
存在且非 `null` 时显示清空操作，空值摘要统一显示“未设定”。

Field editor 另提供 `combine` 原语：它从 editing record 按 key 映射多个紧凑子输入，并在任一
子输入提交时回传完整 record。首个场景是天气字段，`optionalWeather` 在 raw
`[type, level]` 与 editing `{ type, level }` 之间转换；`type` 使用既可选建议又可自由输入的
`suggestion`，`level` 使用强制数字的 `number`。combine 不解释 tuple，也不承担天气约束。

后续验证已补齐 `.metaphysics` loader、工程全量 override 与表格内联结构编辑模式。编辑模式继续渲染真实
Table；Field、Group、Rest 具有稳定节点 ID，可选择、跨 Group 拖动、新增、删除和细粒度还原。点击节点
打开右侧抽屉：Field 抽屉分别编辑当前 Table 节点与当前 Field 定义，需要时才打开完整 Field Bundle；
Group/Rest 抽屉只编辑自身结构。局部确认立即校验并进入 history，同时修改 Field/UI 时以 composite
operation 原子写入。损坏 override 提供原始 JSON 与删除入口，不静默回退。

第一次实际修改才复制完整内置 schema，并写入 `forkedFrom.revision/digest`；仅进入模式或打开抽屉不写工程。
Field、节点属性、位置、Group 子树、删除项和整层均可独立还原；恢复后与内置 canonical 相等即删除该层
override。仍明确延期升级 diff/merge、List、Record、Action、JSONPath indexer 和尚未迁移的旧 Table。

## 17. MapBlock、Item 与 Enemy 后续验证

图块属性、道具属性与怪物属性已继续接入同一 `SchemaTable`，并在 PrefabPanel 保留新版 / 旧版切换。
图块场景验证了命名 source、通行方向 combine 控件和图块素材预览；道具场景则验证了
sibling field condition。道具类别改变后，字段显隐会立即重新计算，但不会改写或删除任何旧值。

道具 UI Schema 对类别适用性统一使用 `inactive`。不匹配当前 `cls` 的字段仍然显示且可编辑，
但以明显的非激活色呈现。这里 condition 只表达引擎的常规用法，不把 `cls` 误当成强能力边界；
因此历史上跨类别使用的 `useItemEffect / canUseItemEffect / equip` 始终可见，也不会产生空 group。

怪物场景验证了动态 project reference、具名 condition call 和历史 raw shape normalizer。
`special` 的选项通过 `project:enemySpecials` 从工程 `functions.js` 的 `enemys.getSpecials` catalog 加载；
内置 schema 不复制特殊属性编号。raw 的 `0 / number / number[]` 统一正规化为多选 editing list，
明确提交后写为数组。特殊属性参数使用 `inactive`：不适用时仍可编辑，condition 变化不清除旧值。
registry loading/error/type-mismatch 保持在特殊属性字段内，不应使整个 PrefabPanel 失败。
地图范围效果与光环作为 `specials` 的 nested group，而不是独立的顶层分类；嵌套只表达业务层级，
字段仍直接引用原始 source，并保留各自的 condition。

图块 / 道具 / 怪物 ID 修改、素材追加和删除仍是 PrefabPanel 的专用 UI action，不伪装成 Field Schema；
其中 ID 行只提供打开修改弹窗的 field action，真实操作继续通过现有 material command 和 operation history。

## 18. 全塔属性与应用工作区验证

全塔属性现已作为第二个全屏 SchemaTable 场景接入。`tower.fields.json` 与
`tower-properties.json` 仍是严格 JSON；写入根为 `tower:...`，最终统一通过
`tableCommands.patchTower` 进入 operation history。初始位置使用一个具名 field editor 同时提交
楼层、X/Y 与朝向；楼层候选来自动态 project registry。装备孔使用 `stringList`，标题事件化、
自绘状态栏等真实联动使用可编辑的 `inactive`，未知工程字段继续由根级 recursive Rest 收集。

多栏属于 renderer 能力而不是 UI Schema：全塔内容按可用宽度显示 1、2 或 3 栏，Rest 横跨全部栏；
宽屏左侧 Anchor 的条目直接来自顶层 Group ID。这样同一份 UI Schema 在侧栏和全屏工作区中不需要
复制布局描述。全塔默认新版，旧 Table 只通过页面头部切换进入。

编辑器外壳增加一级 workspace 状态，并把 map 子面板状态与 scripts 子分类状态分离。operation
viewport 同时记录 workspace、map panel 和 script category；undo/redo 因而可以恢复正确工作区，
而不再把所有页面伪装成地图侧栏。顶栏统一承载工作区导航、帮助、游戏、history 与主题；地图工具栏
只保留地图操作。地图保持挂载但在其他工作区不可见，从而保留当前楼层、素材选择与视口。

资源注册不进入 Field/UI Schema。资源工作区按目录、文件网格和详情分栏，注册数组仍写 `tower.main`，
autotile/图块继续复用 material registry command；tileset 排序与取消注册在写入前提示 ID 映射风险。
图片切分、文件别名和追加图块成为资源工作区专页。公共事件复用同一 `EventsEditor` 核心，但维护按事件
隔离的内存草稿；初始化 import 不会误标为用户修改。函数与插件使用树、标签和 CodeMirror，保存前依次
经过 Acorn 完整函数表达式检查、数据副本修改和 file2x 全文件编码门禁，任何一步失败都不写数据。

本轮已经实现 `.metaphysics` loader 与工程 schema 全量 override；通用 UI Schema List/Record/Action
仍未实现，也没有把资源目录、公共事件列表或脚本树误建模成这些尚未落地的节点。
