import { EditorCore } from '@motajs/editor-core';
import { ITablePanelOpener, ITablePreset } from '@motajs/editor-impl/react';
import { ITableSchemaNode, SYSTEM_PREFIX_END_MARKER } from '@motajs/editor-impl/shared';
import { tablePanelType } from '@motajs/editor-impl/table';

/** 演示表的不透明表名，数据与 schema 路径均据此生成 */
export const TABLE_DEMO_NAME: string = 'demo';

/** 演示表的字段条数：约 100 条以触发开发宿主表体的纵向滚动（P7） */
export const TABLE_DEMO_ENTRY_COUNT: number = 100;

/** 演示表数据文件的路径（按表名约定 `tables/<名>.json`） */
export const TABLE_DEMO_DATA_PATH: string = `tables/${TABLE_DEMO_NAME}.json`;

/** 演示表 schema 文件的路径（按 `xxx.schema.json` 约定推导） */
export const TABLE_DEMO_SCHEMA_PATH: string = `tables/${TABLE_DEMO_NAME}.schema.json`;

/** 生成字段名前缀在序号前的补零宽度，令 `field07` 排在 `field10` 之前 */
const FIELD_INDEX_WIDTH = 2;

/**
 * 由序号生成一个演示字段名，形如 `field07`
 * @param index 字段序号（0 基）
 * @returns 补零后的字段名
 */
function fieldName(index: number): string {
  return `field${String(index).padStart(FIELD_INDEX_WIDTH, '0')}`;
}

/**
 * 生成 `count` 个同级字段的演示数据：保留 title / level 两个标量字段与一个嵌套的 position 对象
 * （照见分组行），其余补成递增的数值字段，令行数足以触发表体纵向滚动（P7）
 * @param count 演示表要生成的字段总条数
 * @returns 演示数据对象
 */
export function createTableDemoData(count: number): Record<string, unknown> {
  const data: Record<string, unknown> = {
    title: '示例条目',
    level: 3,
    position: { x: 12, y: 34 },
  };
  const generated = Math.max(0, count - Object.keys(data).length);

  for (let index = 0; index < generated; index += 1) {
    data[fieldName(index)] = index;
  }

  return data;
}

/**
 * 生成与 `createTableDemoData` 对应的标准 JSON Schema：title / level / position 与全部数值字段，
 * 并以 `x-order` 固定同级呈现顺序，令 schema 与数据一一对应（P7）
 * @param count 演示表要生成的字段总条数
 * @returns 演示表所用的 JSON Schema 文档
 */
export function createTableDemoSchema(count: number): ITableSchemaNode {
  const properties: Record<string, ITableSchemaNode> = {
    title: { type: 'string', description: '标题' },
    level: { type: 'number', description: '等级' },
    position: {
      type: 'object',
      description: '坐标',
      properties: {
        x: { type: 'number', description: '横坐标' },
        y: { type: 'number', description: '纵坐标' },
      },
    },
  };
  const order: string[] = ['title', 'level', 'position'];
  const generated = Math.max(0, count - order.length);

  for (let index = 0; index < generated; index += 1) {
    const key = fieldName(index);

    properties[key] = { type: 'number', description: `字段 ${key}` };
    order.push(key);
  }

  return { type: 'object', properties, 'x-order': order };
}

/** seed 进 demo 数据表的示例内容文本（dev-only 生成值，非真实项目数据） */
export const TABLE_DEMO_DATA: string = JSON.stringify(createTableDemoData(TABLE_DEMO_ENTRY_COUNT), null, 2);

/** demo 数据表所用的标准 JSON Schema 文档文本，含一个嵌套 object 与约 100 个同级字段 */
export const TABLE_DEMO_SCHEMA: string = JSON.stringify(createTableDemoSchema(TABLE_DEMO_ENTRY_COUNT), null, 2);

/** 合规 `.jsonc` 样本数据文件的路径：带系统前缀注释块（由标记行结束），可演示前缀逐字往返 */
export const TABLE_DEMO_SYSTEM_PREFIX_DATA_PATH: string = 'tables/system-prefix.jsonc';

/** 合规 `.jsonc` 样本 schema 文件的路径（等于 `deriveSchemaPath` 对数据路径的推导结果） */
export const TABLE_DEMO_SYSTEM_PREFIX_SCHEMA_PATH: string = 'tables/system-prefix.schema.jsonc';

/** 非合规 `.jsonc` 样本数据文件的路径：含注释与尾逗号、无标记行，打开时须先确认剥离注释 */
export const TABLE_DEMO_COMMENTED_DATA_PATH: string = 'tables/commented.jsonc';

/** 非合规 `.jsonc` 样本 schema 文件的路径（等于 `deriveSchemaPath` 对数据路径的推导结果） */
export const TABLE_DEMO_COMMENTED_SCHEMA_PATH: string = 'tables/commented.schema.jsonc';

/** 两份 `.jsonc` 样本共用的标准 JSON Schema 文档文本（字段 `title` / `level`，含 `x-order`） */
export const TABLE_DEMO_SAMPLE_SCHEMA: string = JSON.stringify(
  {
    type: 'object',
    properties: {
      title: { type: 'string', description: '标题' },
      level: { type: 'number', description: '等级' },
    },
    'x-order': ['title', 'level'],
  },
  null,
  2,
);

/** 合规 `.jsonc` 样本数据文件的初始内容：系统前缀注释块（由标记行结束）+ 严格 JSON 正文 */
export const TABLE_DEMO_SYSTEM_PREFIX_DATA: string =
  `// 系统前缀示例：编辑器保存时应逐字保留本注释块\n${SYSTEM_PREFIX_END_MARKER}\n` +
  JSON.stringify({ title: '系统前缀示例', level: 1 }, null, 2);

/** 非合规 `.jsonc` 样本数据文件的初始内容：两行注释 + 带尾逗号的对象文本，不含标记行 */
export const TABLE_DEMO_COMMENTED_DATA: string =
  '{\n' +
  '  // 这是一个非合规的 .jsonc 示例\n' +
  '  // 打开并保存后会删除全部注释\n' +
  '  "title": "带注释示例",\n' +
  '  "level": 2,\n' +
  '}\n';

/** 开发宿主注入给「打开表格」列表的预设表清单（演示 `ITableEditorCapabilities.tablePresets`） */
export const TABLE_PRESETS: readonly ITablePreset[] = [
  { name: '演示表', path: TABLE_DEMO_DATA_PATH },
  { name: '系统前缀表', path: TABLE_DEMO_SYSTEM_PREFIX_DATA_PATH },
  { name: '带注释表', path: TABLE_DEMO_COMMENTED_DATA_PATH },
];

/**
 * 创建开发宿主的表格面板打开器：开一个空白标签页，再带打开参数打开表格面板类型
 * @param core 开发宿主的编辑器核心，经其外壳系统开标签页与面板
 * @returns 满足表格面板打开器契约的对象，供能力 Provider 注入给表格
 */
export function createTablePanelOpener(core: EditorCore): ITablePanelOpener {
  return {
    open: async (param: Record<string, unknown>): Promise<void> => {
      const tabId = core.shellSystem.openBlankTab();

      await core.shellSystem.openPanelInTab(tabId, tablePanelType.id, param);
    },
  };
}
