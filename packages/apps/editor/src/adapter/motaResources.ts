/**
 * mota 适配器本地常量（D-01：刻意重复，Phase 11 移除）。
 *
 * 本模块的路径与变量名字面量是**对编辑器 project-data 聚合模块（`projectData`）取值的
 * 有意重复**：D-01 要求本期纯增量，禁止改动那个模块（它是只读参照，一行不改），因此适配器
 * 无法从那里导出这些字面量。Phase 11 会把该聚合模块重写为消费本适配器，届时这份重复被移除。
 * 在此显式注明，以免被误认为「引擎词汇泄漏进 core」——这些字面量全部留在 editor 侧。
 */
import type { CommonEventData } from '@/services/commonEvent';

/** 适配器侧的 mota IO 地址与事件变量名（重复自 project-data，见文件头）。 */
export const MOTA_RESOURCE_ADDRESSES = Object.freeze({
  tower: 'project/data.js',
  items: 'project/items.js',
  enemys: 'project/enemys.js',
  maps: 'project/maps.js',
  icons: 'project/icons.js',
  functions: 'project/functions.js',
  plugins: 'project/plugins.js',
  events: 'project/events.js',
  editorConfig: '_server/config.json',
  eventsVarName: 'events_c12a15a8_c380_4b28_8144_256cba95f760',
});

/** events 文件的变量名（精确等于 project-data 聚合模块的 `EVENTS_VAR_NAME`）。 */
export const MOTA_EVENTS_VAR_NAME = MOTA_RESOURCE_ADDRESSES.eventsVarName;

/** events 文件的数据形状（映射自 project-data 的适配器本地类型）。 */
export interface EventsData {
  commonEvent: CommonEventData;
  [key: string]: unknown;
}

/** 由 floorId 解析出具体的楼层 IO 地址（参数化在适配器侧解析，D-07）。 */
export function motaFloorAddress(floorId: string): string {
  return `project/floors/${floorId}.js`;
}
