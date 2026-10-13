import { EditorCore } from '@motajs/editor-core';
import {
  ITablePanelParam,
  ITablePanelTarget,
  ITableSchemaNode,
  tableDataResourceId,
  tablePanelType,
  tableSchemaResourceId,
} from '@motajs/editor-impl/table';

/** 演示表的不透明表名，数据与 schema 资源 id 均据此生成 */
export const TABLE_DEMO_NAME: string = 'demo';

/** seed 进 demo 数据表的示例内容（dev-only 字面量，非真实项目数据） */
export const TABLE_DEMO_DATA: Record<string, unknown> = {
  title: '示例条目',
  level: 3,
  position: { x: 12, y: 34 },
};

/** demo 数据表所用的标准 JSON Schema 文档，含一个嵌套 object 与一个数值字段 */
export const TABLE_DEMO_SCHEMA: ITableSchemaNode = {
  type: 'object',
  properties: {
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
  },
};

/** 表格演示的目标表，指向 `table.demo` 数据与其 `table#schema.demo` schema */
export const TABLE_DEMO_TARGET: ITablePanelTarget = {
  data: tableDataResourceId(TABLE_DEMO_NAME),
  schema: tableSchemaResourceId(TABLE_DEMO_NAME),
};

/** 「打开表格」菜单项的唯一标识符 */
export const TABLE_DEMO_MENU_ID: string = 'table-demo';

/** 「打开表格」菜单项的显示标题 */
export const TABLE_DEMO_MENU_TITLE: string = '打开表格';

/**
 * 打开一张已瞄准 demo 表的表格面板：先开一个空白标签页，再带打开参数打开表格面板类型
 * @param core 开发宿主的编辑器核心，经其外壳系统开标签页与面板
 */
export async function openTableDemoPanel(core: EditorCore): Promise<void> {
  const tabId = core.shellSystem.openBlankTab();
  const param: ITablePanelParam = { target: TABLE_DEMO_TARGET };

  await core.shellSystem.openPanelInTab(tabId, tablePanelType.id, param);
}
