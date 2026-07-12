/**
 * Serialize Utilities
 *
 * 数据序列化工具函数，用于将数据对象序列化为 JS 文件格式。
 */

import { encodeGameData2x, encodeGameMapData2x } from "@motajs/file2x";

/**
 * 将数据序列化为 JS 数据文件格式
 *
 * 生成格式: `var varName = \n{json}`
 * 使用 tab 缩进
 *
 * @param varName - 变量名
 * @param data - 数据对象
 * @returns JS 文件内容字符串
 *
 * @example
 * serializeToJsDataFile('data_xxx', { a: 1, b: 2 })
 * // 返回:
 * // var data_xxx =
 * // {
 * // 	"a": 1,
 * // 	"b": 2
 * // }
 */
export function serializeToJsDataFile(varName: string, data: unknown): string {
  return encodeGameData2x({ uuid: varName, data });
}

/**
 * 将数据序列化为 JS 地图文件格式
 *
 * 生成格式: `main.floors.floorId = \n{json}`
 * 使用 tab 缩进
 *
 * @param floorId - 楼层 ID
 * @param data - 楼层数据对象
 * @returns JS 文件内容字符串
 *
 * @example
 * serializeToJsMapFile('MT1', { floorId: 'MT1', title: '主塔1层' })
 * // 返回:
 * // main.floors.MT1 =
 * // {
 * // 	"floorId": "MT1",
 * // 	"title": "主塔1层"
 * // }
 */
export function serializeToJsMapFile(floorId: string, data: unknown): string {
  return encodeGameMapData2x({ prefix: ["main", "floors"], mapId: floorId, data });
}
