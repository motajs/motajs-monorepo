import { IEditorFileSystem } from '@motajs/editor-core';
import {
  IMapCreateRequest,
  IMapDataSection,
  IMapDocument,
  IMapEditorCapabilities,
  IMapLayer,
  IMapSizeLimit,
  IMapSummary,
  IMapTileGroup,
} from '@motajs/editor-impl/map';
import { ITableSchemaNode, parseTableText, serializeTableText } from '@motajs/editor-impl/shared';

// 开发宿主的地图适配器：唯一知道「演示工程文件长什么样」的地方。
// 演示文件把图层存成扁平行主序数组（没有 height，由 `长度 / width` 推导），几何与属性、事件、额外字段同住一份文件；
// 中立文档按 `[y][x]` 组织图层，因此这里负责双向搬运，并在两个保存域里各自只替换自己那一块，其它字段逐字保留。

/** 演示工程放地图文件的目录（相对项目根） */
export const MAP_DIRECTORY_PATH = 'content/map';

/** 地图清单文件的约定路径（相对项目根） */
export const MAP_LIST_PATH = 'content/map/.list.jsonc';

/**
 * 演示工程里一张地图的原始文件形状
 *
 * `properties` 是必填字段：属性保存与几何保存共用同一份文件，读取方在字段缺省时补 `{}`。
 */
export interface IMapFileRecord {
  /** 地图标识；同时是文件名，不含目录分隔符 */
  readonly id: string;
  /** 地图显示名 */
  readonly name: string;
  /** 地图宽度（格子数） */
  readonly width: number;
  /** 扁平行主序图层：层序号 → 从左上角起逐行拼接的格子数组 */
  readonly layers: Record<number, number[]>;
  /** 层序号 → 用户看到的图层名 */
  readonly layerNames: Record<number, string>;
  /** 属性表的整份键值对，与几何存在同一份文件里 */
  readonly properties: Record<string, unknown>;
  /** 本演示不展示的事件数据；保存时必须逐字保留 */
  readonly events: Record<string, unknown>;
  /** 本演示不展示的其它字段；保存时必须逐字保留 */
  readonly extra: Record<string, unknown>;
}

/** 地图能力的宿主选项：图块目录必须由宿主交进来，其余能力按需注入 */
export interface IMapCapabilityOptions {
  /** 图块目录；必填，缺了它打开后的地图没有目录、调色板一片空 */
  readonly tileGroups: readonly IMapTileGroup[];
  /** 地图属性表单的 JSON Schema；缺省时属性入口禁用 */
  readonly propertiesSchema?: ITableSchemaNode;
  /** 地图尺寸上限；缺省表示不限制 */
  readonly maxMapSize?: IMapSizeLimit;
  /** 最近使用文件的项目内路径覆盖；缺省用面板自己的约定 */
  readonly recentTilesPath?: string;
}

/**
 * 判断一个值是否为非空、非数组的普通对象
 * @param value 待判断的值
 * @returns 是普通对象时为 true
 */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 递归复制任意属性值，避免写回后继续编辑改到调用方持有的对象
 * @param value 待复制的值
 * @returns 与入参结构相同、不共享引用对象的新值
 */
function cloneUnknown(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item: unknown) => cloneUnknown(item));
  if (!isPlainRecord(value)) return value;

  const result: Record<string, unknown> = {};

  for (const key of Object.keys(value)) result[key] = cloneUnknown(value[key]);

  return result;
}

/**
 * 深拷贝一份属性表
 * @param value 待复制的属性表
 * @returns 不共享引用对象的新属性表
 */
function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const key of Object.keys(value)) result[key] = cloneUnknown(value[key]);

  return result;
}

/**
 * 读一个可选的字符串字段
 * @param value 待读取的值
 * @returns 非空字符串原样返回，否则为 undefined
 */
function readText(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * 读一个必须为正整数的字段
 * @param value 待读取的值
 * @param field 字段名，仅用于错误文案
 * @returns 正整数值
 */
function readCount(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new Error(`地图文件字段 ${field} 必须是正整数`);
  }

  return value;
}

/**
 * 把任意格子值折成可写进地图的整数；非数字与非法数值按 0 处理
 * @param value 待折的格子值
 * @returns 非负整数以外的内容一律为 0
 */
function normalizeCell(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;

  return Math.trunc(value);
}

/**
 * 读一份扁平行主序图层
 * @param value 待读取的值
 * @returns 折好的扁平数组；不是数组时为 undefined
 */
function readFlatLayer(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) return undefined;

  return value.map((cell: unknown) => normalizeCell(cell));
}

/**
 * 读图层表：键必须是整数层序号，值必须是扁平数组
 * @param value 待读取的值
 * @param path 文件路径，仅用于错误文案
 * @returns 层序号 → 扁平数组；一层都没有时抛错
 */
function readLayers(value: unknown, path: string): Record<number, number[]> {
  if (!isPlainRecord(value)) throw new Error(`地图文件缺少图层：${path}`);

  const layers: Record<number, number[]> = {};
  let count = 0;

  for (const key of Object.keys(value)) {
    const index = Number(key);
    const flat = readFlatLayer(value[key]);

    if (!Number.isInteger(index) || index < 0 || flat === undefined) continue;

    layers[index] = flat;
    count += 1;
  }

  if (count === 0) throw new Error(`地图文件没有任何图层：${path}`);

  return layers;
}

/**
 * 读图层别名表：只保留字符串值，键统一成数字层序号
 * @param value 待读取的值
 * @returns 层序号 → 图层名；不是对象时为空表
 */
function readLayerNames(value: unknown): Record<number, string> {
  if (!isPlainRecord(value)) return {};

  const names: Record<number, string> = {};

  for (const key of Object.keys(value)) {
    const index = Number(key);
    const name = value[key];

    if (!Number.isInteger(index) || index < 0 || typeof name !== 'string') continue;

    names[index] = name;
  }

  return names;
}

/**
 * 读一个不展示的普通对象字段；缺省或形状不对时按空表处理
 * @param value 待读取的值
 * @returns 深拷贝后的普通对象
 */
function readObjectField(value: unknown): Record<string, unknown> {
  return isPlainRecord(value) ? cloneRecord(value) : {};
}

/**
 * 把一份解析出来的文件内容收成合法记录，字段缺失时给出可用缺省
 * @param value 解析出的值
 * @param path 文件路径，仅用于错误文案
 * @returns 规范化后的地图记录
 */
function normalizeRecord(value: unknown, path: string): IMapFileRecord {
  if (!isPlainRecord(value)) throw new Error(`地图文件不是对象：${path}`);

  const id = readText(value.id);

  if (id === undefined) throw new Error(`地图文件缺少 id：${path}`);

  return {
    id,
    name: readText(value.name) ?? id,
    width: readCount(value.width, 'width'),
    layers: readLayers(value.layers, path),
    layerNames: readLayerNames(value.layerNames),
    properties: readObjectField(value.properties),
    events: readObjectField(value.events),
    extra: readObjectField(value.extra),
  };
}

/**
 * 取图层号并升序排列
 * @param layers 图层表
 * @returns 升序的层序号
 */
function layerIndices(layers: Record<number, number[]>): readonly number[] {
  return Object.keys(layers)
    .map((key: string) => Number(key))
    .filter((index: number) => Number.isInteger(index) && index >= 0)
    .sort((left: number, right: number) => left - right);
}

/**
 * 由扁平数组推导地图高度：取各层「完整行数」的最小值，避免参差层把行数撑大
 * @param layers 图层表
 * @param indices 升序的层序号
 * @param width 地图宽度
 * @returns 地图高度；没有一层能凑出完整行时为 0
 */
function deriveMapHeight(layers: Record<number, number[]>, indices: readonly number[], width: number): number {
  if (width <= 0) return 0;

  const heights: number[] = [];

  for (const index of indices) {
    const flat = layers[index];
    const rows = flat === undefined ? 0 : Math.floor(flat.length / width);

    if (rows > 0) heights.push(rows);
  }

  if (heights.length === 0) return 0;

  return Math.min(...heights);
}

/**
 * 把扁平数组切成 `[y][x]`；短于宽 × 高的部分补 0，长出的部分截断
 * @param flat 扁平行主序数组
 * @param width 地图宽度
 * @param height 地图高度
 * @returns 二维格子
 */
function toCellRows(flat: readonly number[], width: number, height: number): number[][] {
  const rows: number[][] = [];

  for (let y = 0; y < height; y += 1) {
    const row: number[] = [];

    for (let x = 0; x < width; x += 1) row.push(normalizeCell(flat[y * width + x]));

    rows.push(row);
  }

  return rows;
}

/**
 * 把 `[y][x]` 拼回扁平行主序数组；缺行或缺格按 0 处理
 * @param cells 二维格子
 * @param width 地图宽度
 * @param height 地图高度
 * @returns 长度为宽 × 高的扁平数组
 */
function toFlatLayer(cells: readonly (readonly number[])[], width: number, height: number): number[] {
  const flat: number[] = [];

  for (let y = 0; y < height; y += 1) {
    const row = cells[y];

    for (let x = 0; x < width; x += 1) flat.push(row === undefined ? 0 : normalizeCell(row[x]));
  }

  return flat;
}

/**
 * 取图层显示名：没有名字时回退为「图层 {N}」
 * @param name 宿主给的图层名
 * @param index 图层在文档里的位置
 * @returns 可显示的图层名
 */
function resolveLayerName(name: string | undefined, index: number): string {
  if (name !== undefined && name.trim().length > 0) return name;

  return `图层 ${index + 1}`;
}

/**
 * 求一层写回文件时应使用的名字：优先用户当前给的名字，其次旧别名，最后回退「图层 {N}」
 * @param next 本次保存里该层的名字
 * @param previous 文件里原有的别名
 * @param index 图层在文档里的位置
 * @returns 写回文件的图层名
 */
function resolveNextLayerName(next: string, previous: string | undefined, index: number): string {
  if (next.trim().length > 0) return next.trim();

  return resolveLayerName(previous, index);
}

/**
 * 校验路径没有越出项目根（拒绝 `..` 段、前导斜线）
 * @param path 待校验路径
 */
function assertInBounds(path: string): void {
  if (path.length === 0) throw new Error('地图文件路径不能为空');
  if (path.startsWith('/') || path.startsWith('\\')) throw new Error(`地图文件路径必须相对项目根：${path}`);
  if (path.split(/[\\/]/).includes('..')) throw new Error(`地图文件路径越出项目根：${path}`);
}

/**
 * 校验地图标识能安全拼进文件名
 * @param mapId 地图标识
 */
function assertMapId(mapId: string): void {
  assertInBounds(mapId);

  if (mapId.includes('/') || mapId.includes('\\')) throw new Error(`地图标识不能包含目录分隔符：${mapId}`);
}

/**
 * 求一张地图的文件路径
 * @param mapId 地图标识
 * @returns 相对项目根的地图文件路径
 */
export function mapFilePath(mapId: string): string {
  assertMapId(mapId);

  return `${MAP_DIRECTORY_PATH}/${mapId}.json`;
}

/**
 * 判断一个错误是否是「文件不存在」；内存后端用它表示缺文件
 * @param error 捕获到的错误
 * @returns 缺文件时为 true
 */
function isMissingFileError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  return /not found|no such file|不存在/i.test(error.message);
}

/**
 * 把文件内容读成合法记录
 * @param backend 宿主注入的文件系统
 * @param mapId 地图标识
 * @returns 规范化后的地图记录
 */
async function readMapRecord(backend: IEditorFileSystem, mapId: string): Promise<IMapFileRecord> {
  const path = mapFilePath(mapId);
  const text = await backend.readFile(path);
  const parsed = parseTableText(text);

  if (parsed.value === undefined) throw new Error(`地图文件无法解析：${path}`);

  return normalizeRecord(parsed.value, path);
}

/**
 * 把记录以「无系统前缀」的 JSON 写回地图文件
 * @param backend 宿主注入的文件系统
 * @param mapId 地图标识
 * @param record 要写入的记录
 */
async function writeMapRecord(backend: IEditorFileSystem, mapId: string, record: IMapFileRecord): Promise<void> {
  const path = mapFilePath(mapId);

  await backend.makeDirectory(MAP_DIRECTORY_PATH);
  await backend.writeFile(path, serializeTableText(record, ''));
}

/**
 * 读地图清单；文件不存在按空清单处理，损坏则把错误交给调用方
 * @param backend 宿主注入的文件系统
 * @returns 地图清单
 */
async function readSummaries(backend: IEditorFileSystem): Promise<readonly IMapSummary[]> {
  let text: string;

  try {
    text = await backend.readFile(MAP_LIST_PATH);
  } catch (error) {
    if (isMissingFileError(error)) return [];
    throw error;
  }

  const parsed = parseTableText(text);
  const value = parsed.value;

  if (!isPlainRecord(value) || !Array.isArray(value.maps)) return [];

  const summaries: IMapSummary[] = [];

  for (const entry of value.maps) {
    if (!isPlainRecord(entry)) continue;

    const id = readText(entry.id);
    const name = readText(entry.name);

    if (id === undefined || name === undefined) continue;

    summaries.push({ id, name });
  }

  return summaries;
}

/**
 * 写回地图清单
 * @param backend 宿主注入的文件系统
 * @param summaries 要写入的清单
 */
async function writeSummaries(backend: IEditorFileSystem, summaries: readonly IMapSummary[]): Promise<void> {
  const maps = summaries.map((summary) => ({ id: summary.id, name: summary.name }));

  await backend.makeDirectory(MAP_DIRECTORY_PATH);
  await backend.writeFile(MAP_LIST_PATH, serializeTableText({ maps }, ''));
}

/**
 * 在现有清单之外造一个未被占用的地图标识
 * @param summaries 现有清单
 * @returns 新地图标识
 */
function createMapId(summaries: readonly IMapSummary[]): string {
  const taken: Set<string> = new Set(summaries.map((summary) => summary.id));
  let index = summaries.length + 1;
  let id = `map-${index}`;

  while (taken.has(id)) {
    index += 1;
    id = `map-${index}`;
  }

  return id;
}

/**
 * 造一个新地图记录：单层全 0、初始图层名写进别名表、两个不展示域为空
 * @param id 新地图标识
 * @param request 名称、尺寸与初始图层名
 * @returns 新地图记录
 */
function createNewRecord(id: string, request: IMapCreateRequest): IMapFileRecord {
  if (request.width <= 0 || request.height <= 0) throw new Error('新地图的宽高必须是正整数');

  const cells: number[] = [];
  const count = request.width * request.height;

  for (let index = 0; index < count; index += 1) cells.push(0);

  return {
    id,
    name: request.name,
    width: request.width,
    layers: { 0: cells },
    layerNames: { 0: request.layerName },
    properties: {},
    events: {},
    extra: {},
  };
}

/**
 * 检查宿主是否真的把图块目录交进来了
 * @param options 地图能力选项
 * @returns 注入的图块目录
 */
function requireTileGroups(options: IMapCapabilityOptions): readonly IMapTileGroup[] {
  if (options.tileGroups.length === 0) {
    throw new Error('地图能力缺少图块目录：请在 IMapCapabilityOptions.tileGroups 注入。');
  }

  return options.tileGroups;
}

/**
 * 把演示工程记录转成中立文档
 *
 * 高度取各层完整行数的最小值；参差的层在结果里统一补 0 或截断，保证每层行数一致。
 * @param record 演示工程记录
 * @param tileGroups 宿主注入的图块目录，原样带给文档
 * @returns 中立地图文档
 */
export function toMapDocument(record: IMapFileRecord, tileGroups: readonly IMapTileGroup[]): IMapDocument {
  if (record.width <= 0) throw new Error(`地图宽度必须为正：${record.id}`);

  const indices = layerIndices(record.layers);
  const height = deriveMapHeight(record.layers, indices, record.width);
  const layers: IMapLayer[] = indices.map((index: number, position: number) => {
    const flat = record.layers[index] ?? [];

    return {
      id: `layer-${index}`,
      name: resolveLayerName(record.layerNames[index], position),
      zIndex: position,
      isEventLayer: false,
      cells: toCellRows(flat, record.width, height),
    };
  });

  return { id: record.id, name: record.name, width: record.width, height, layers, tileGroups };
}

/**
 * 把中立文档的数据域写回演示工程记录
 *
 * 只替换 `width` / `layers` / `layerNames`；`name`、`properties`、`events`、`extra` 原样保留，
 * 图层名取本次保存里各层的名字（用户新起的名字因此能落进文件）。返回新记录，不修改入参。
 * @param record 原记录
 * @param section 面板交回的数据域
 * @returns 写回后的新记录
 */
export function applyMapDataSection(record: IMapFileRecord, section: IMapDataSection): IMapFileRecord {
  if (section.width <= 0) throw new Error(`地图宽度必须为正：${section.id}`);

  const layers: Record<number, number[]> = {};
  const layerNames: Record<number, string> = {};

  section.layers.forEach((layer: IMapLayer, index: number) => {
    layers[index] = toFlatLayer(layer.cells, section.width, section.height);
    layerNames[index] = resolveNextLayerName(layer.name, record.layerNames[index], index);
  });

  return { ...record, width: section.width, layers, layerNames };
}

/**
 * 把中立文档的属性域写回演示工程记录
 *
 * 只替换 `properties`；几何、事件、额外字段与图层别名原样保留。返回新记录，不修改入参。
 * @param record 原记录
 * @param properties 面板交回的整份属性表
 * @returns 写回后的新记录
 */
export function applyMapPropertiesSection(
  record: IMapFileRecord,
  properties: Record<string, unknown>,
): IMapFileRecord {
  return { ...record, properties: cloneRecord(properties) };
}

/**
 * 造一份开发宿主用的地图能力：全部读写都经注入的内存后端，图块目录只从选项进来
 * @param backend 宿主注入的文件系统
 * @param options 图块目录与可选的属性 schema / 尺寸上限 / 最近使用路径
 * @returns 地图能力注入面
 */
export function createMapCapabilities(
  backend: IEditorFileSystem,
  options: IMapCapabilityOptions,
): IMapEditorCapabilities {
  const listMaps = async (): Promise<readonly IMapSummary[]> => readSummaries(backend);

  const openMap = async (mapId: string): Promise<IMapDocument> => {
    const tileGroups = requireTileGroups(options);
    const record = await readMapRecord(backend, mapId);

    return toMapDocument(record, tileGroups);
  };

  const saveMapData = async (data: IMapDataSection): Promise<void> => {
    const record = await readMapRecord(backend, data.id);

    await writeMapRecord(backend, data.id, applyMapDataSection(record, data));
  };

  const createMap = async (request: IMapCreateRequest): Promise<IMapDocument> => {
    const tileGroups = requireTileGroups(options);
    const summaries = await readSummaries(backend);
    const id = createMapId(summaries);
    const record = createNewRecord(id, request);

    await writeMapRecord(backend, id, record);
    await writeSummaries(backend, [...summaries, { id, name: record.name }]);

    return toMapDocument(record, tileGroups);
  };

  const addLayer = async (mapId: string): Promise<IMapDocument> => {
    const tileGroups = requireTileGroups(options);
    const record = await readMapRecord(backend, mapId);
    const indices = layerIndices(record.layers);
    const height = deriveMapHeight(record.layers, indices, record.width);
    const index = indices.length === 0 ? 0 : Math.max(...indices) + 1;
    const cells: number[] = [];

    for (let position = 0; position < record.width * height; position += 1) cells.push(0);

    const next: IMapFileRecord = {
      ...record,
      layers: { ...record.layers, [index]: cells },
      layerNames: { ...record.layerNames, [index]: `图层 ${index + 1}` },
    };

    await writeMapRecord(backend, mapId, next);

    return toMapDocument(next, tileGroups);
  };

  const readProperties = async (mapId: string): Promise<Record<string, unknown>> => {
    const record = await readMapRecord(backend, mapId);

    return cloneRecord(record.properties);
  };

  const saveMapProperties = async (mapId: string, properties: Record<string, unknown>): Promise<void> => {
    const record = await readMapRecord(backend, mapId);

    await writeMapRecord(backend, mapId, applyMapPropertiesSection(record, properties));
  };

  return {
    listMaps,
    openMap,
    saveMapData,
    createMap,
    addLayer,
    readProperties,
    saveMapProperties,
    propertiesSchema: options.propertiesSchema,
    maxMapSize: options.maxMapSize,
    recentTilesPath: options.recentTilesPath,
  };
}
