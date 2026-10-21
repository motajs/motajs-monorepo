import { IMapDataSection, IMapDirections, IMapDocument, IMapTileEntry, IMapTileGroup } from '@motajs/editor-impl/map';
import { parseTableText, serializeTableText } from '@motajs/editor-impl/shared';
import { describe, expect, it } from 'vitest';
import { MemoryBackend } from '../memoryBackend';
import {
  applyMapDataSection,
  applyMapPropertiesSection,
  createMapCapabilities,
  IMapFileRecord,
  mapFilePath,
  MAP_LIST_PATH,
  toMapDocument,
} from '../mapFiles';

// 开发宿主地图适配器的单元测试：双向造型、两个保存域互不覆盖、图层别名真的落盘、图块目录只从选项进来。
// 全部经真实的内存后端，不碰面板；面板行为由端到端用例覆盖。

/** 四方向都可通行的方向表 */
const OPEN_DIRECTIONS: IMapDirections = { up: true, right: true, down: true, left: true };

/** 四方向都不可通行的方向表 */
const BLOCKED_DIRECTIONS: IMapDirections = { up: false, right: false, down: false, left: false };

/**
 * 造一个图块条目；裁切按「列 / 行 × 32 像素」推导
 * @param number 图块编号
 * @param column 图集列号
 * @param name 图块显示名
 * @param blocked 为 true 时该图块四方向都不可通行
 * @returns 图块条目
 */
function createTileEntry(number: number, column: number, name: string, blocked: boolean = false): IMapTileEntry {
  const directions = blocked ? BLOCKED_DIRECTIONS : OPEN_DIRECTIONS;

  return {
    number,
    column,
    row: 0,
    crop: { x: column * 32, y: 0, width: 32, height: 32 },
    name,
    pass: { out: directions, in: OPEN_DIRECTIONS, onlyEventLayer: false },
  };
}

/** 适配器测试用的图块目录：两个分组，第二个分组的图片故意指向不存在的文件 */
const TEST_TILE_GROUPS: readonly IMapTileGroup[] = [
  {
    id: 'terrain',
    name: '地形',
    imagePath: 'content/map/terrain.png',
    columns: 2,
    tiles: [createTileEntry(1, 0, '草地'), createTileEntry(2, 1, '墙', true)],
  },
  {
    id: 'missing',
    name: '缺图',
    imagePath: 'content/map/does-not-exist.png',
    columns: 1,
    tiles: [createTileEntry(3, 0, '物件')],
  },
];

/**
 * 造一份 3×2、两层、带属性 / 事件 / 额外字段的演示记录
 * @param overrides 覆盖个别字段
 * @returns 演示记录
 */
function createRecord(overrides: Partial<IMapFileRecord> = {}): IMapFileRecord {
  return {
    id: 'm1',
    name: '样例地图',
    width: 3,
    layers: { 0: [1, 2, 3, 4, 5, 6], 1: [0, 0, 0, 0, 0, 0] },
    layerNames: { 0: '底层', 1: '上层' },
    properties: { name: '样例', initialGold: 10 },
    events: { '1,1': { type: 'battle', enemyId: 'slime' } },
    extra: { custom: '保留', order: 7 },
    ...overrides,
  };
}

/**
 * 把中立文档收成数据域
 * @param document 中立文档
 * @returns 面板会交给宿主的数据域
 */
function toSection(document: IMapDocument): IMapDataSection {
  return { id: document.id, width: document.width, height: document.height, layers: document.layers };
}

/**
 * 把一份记录按宿主格式写进内存后端，并同步写清单
 * @param backend 内存后端
 * @param records 要预置的记录
 */
async function seedProject(backend: MemoryBackend, records: readonly IMapFileRecord[]): Promise<void> {
  const maps = records.map((record) => ({ id: record.id, name: record.name }));

  await backend.writeFile(MAP_LIST_PATH, serializeTableText({ maps }, ''));
  for (const record of records) await backend.writeFile(mapFilePath(record.id), serializeTableText(record, ''));
}

/**
 * 从内存后端读回一份地图记录
 * @param backend 内存后端
 * @param mapId 地图标识
 * @returns 解析出的记录
 */
async function readRecord(backend: MemoryBackend, mapId: string): Promise<IMapFileRecord> {
  const parsed = parseTableText(await backend.readFile(mapFilePath(mapId)));

  if (parsed.value === undefined) throw new Error(`地图文件无法解析：${mapId}`);

  return parsed.value as IMapFileRecord;
}

describe('演示宿主地图适配器', () => {
  // 扁平层按 width 切成 [y][x]，高度由各层完整行数的最小值推导
  it('扁平层切成 [y][x] 且高度由长度推导', () => {
    const record = createRecord({ layers: { 0: [1, 2, 3, 4, 5, 6], 1: [7, 8, 9, 10, 11, 12, 13, 14, 15] } });
    const document = toMapDocument(record, TEST_TILE_GROUPS);

    expect(document.width).toBe(3);
    expect(document.height).toBe(2);
    expect(document.layers).toHaveLength(2);
    expect(document.layers[0].cells).toEqual([
      [1, 2, 3],
      [4, 5, 6],
    ]);
    // 第二层有 3 行，按最小值统一成 2 行：长出的部分截断
    expect(document.layers[1].cells).toEqual([
      [7, 8, 9],
      [10, 11, 12],
    ]);
  });

  // 层别名缺失时回退为「图层 N」
  it('层别名缺失时回退为「图层 N」', () => {
    const record = createRecord({ layerNames: { 1: '上层' } });
    const document = toMapDocument(record, TEST_TILE_GROUPS);

    expect(document.layers[0].name).toBe('图层 1');
    expect(document.layers[1].name).toBe('上层');
  });

  // 保存数据域后 properties / events / extra 与 name 逐字不变
  it('保存数据域后 event / extra / properties 逐字不变', () => {
    const record = createRecord();
    const document = toMapDocument(record, TEST_TILE_GROUPS);
    const layers = document.layers.map((layer, index) =>
      index === 0 ? { ...layer, cells: [[0, 0, 0], [0, 0, 0]] } : layer,
    );
    const next = applyMapDataSection(record, { ...toSection(document), layers });

    expect(next).not.toBe(record);
    expect(next.name).toBe(record.name);
    expect(next.properties).toEqual(record.properties);
    expect(next.events).toEqual(record.events);
    expect(next.extra).toEqual(record.extra);
    expect(next.layers[0]).toEqual([0, 0, 0, 0, 0, 0]);
  });

  // 保存后文件里的图层仍是扁平行主序数组，不是中立文档的 [y][x]
  it('保存后文件里的图层仍是扁平数组', async () => {
    const backend = new MemoryBackend();
    const record = createRecord();

    await seedProject(backend, [record]);

    const capabilities = createMapCapabilities(backend, { tileGroups: TEST_TILE_GROUPS });
    const document = await capabilities.openMap('m1');
    const layers = document.layers.map((layer, index) =>
      index === 0 ? { ...layer, cells: layer.cells.map((row) => row.map(() => 1)) } : layer,
    );

    await capabilities.saveMapData({ ...toSection(document), layers });

    const saved = await readRecord(backend, 'm1');

    expect(Array.isArray(saved.layers[0])).toBe(true);
    expect(saved.layers[0]).toEqual([1, 1, 1, 1, 1, 1]);
    expect(typeof saved.layers[0][0]).toBe('number');
  });

  // 新建地图后清单多一条、新文件存在，初始图层名落进别名表
  it('新建地图后清单多一条且文件存在', async () => {
    const backend = new MemoryBackend();

    await seedProject(backend, [createRecord()]);

    const capabilities = createMapCapabilities(backend, { tileGroups: TEST_TILE_GROUPS });
    const created = await capabilities.createMap!({ name: '新地图', width: 4, height: 2, layerName: '底层' });
    const summaries = await capabilities.listMaps();

    expect(summaries).toHaveLength(2);
    expect(summaries.some((summary) => summary.id === created.id)).toBe(true);

    const saved = await readRecord(backend, created.id);

    expect(saved.name).toBe('新地图');
    expect(saved.width).toBe(4);
    expect(saved.layers[0]).toHaveLength(8);
    expect(saved.layerNames[0]).toBe('底层');
    expect(created.layers[0].name).toBe('底层');
  });

  // 加层后新层长度为宽 × 高且全 0，文件里同样是扁平数组
  it('加层后新层长度为宽 × 高且全 0', async () => {
    const backend = new MemoryBackend();

    await seedProject(backend, [createRecord()]);

    const capabilities = createMapCapabilities(backend, { tileGroups: TEST_TILE_GROUPS });
    const document = await capabilities.addLayer!('m1');
    const saved = await readRecord(backend, 'm1');
    const lastLayer = document.layers[document.layers.length - 1];

    expect(document.layers).toHaveLength(3);
    expect(lastLayer.cells).toEqual([
      [0, 0, 0],
      [0, 0, 0],
    ]);
    expect(saved.layers[2]).toEqual([0, 0, 0, 0, 0, 0]);
  });

  // 含 .. 或目录分隔符的地图标识被拒绝
  it('含 .. 的地图标识被拒绝', async () => {
    const backend = new MemoryBackend();

    await seedProject(backend, [createRecord()]);

    const capabilities = createMapCapabilities(backend, { tileGroups: TEST_TILE_GROUPS });

    await expect(capabilities.openMap('../escape')).rejects.toThrow();
    await expect(capabilities.saveMapData({ id: '../../escape', width: 1, height: 1, layers: [] })).rejects.toThrow();
  });

  // 保存属性域后几何、events、extra 逐字不变（两个保存域互不覆盖）
  it('保存属性域后几何、event、extra 逐字不变', async () => {
    const backend = new MemoryBackend();
    const record = createRecord();

    await seedProject(backend, [record]);

    const capabilities = createMapCapabilities(backend, { tileGroups: TEST_TILE_GROUPS, propertiesSchema: undefined });

    await capabilities.saveMapProperties!('m1', { name: '改后', initialGold: 99 });

    const saved = await readRecord(backend, 'm1');

    expect(saved.properties).toEqual({ name: '改后', initialGold: 99 });
    expect(saved.width).toBe(record.width);
    expect(saved.layers).toEqual(record.layers);
    expect(saved.layerNames).toEqual(record.layerNames);
    expect(saved.events).toEqual(record.events);
    expect(saved.extra).toEqual(record.extra);
  });

  // 新建的初始图层名与加层后用户改的名字都能写进 layerNames，重开读回仍是原名
  it('新建与加层的图层名都能重开读回', async () => {
    const backend = new MemoryBackend();

    await seedProject(backend, [createRecord()]);

    const capabilities = createMapCapabilities(backend, { tileGroups: TEST_TILE_GROUPS });
    const created = await capabilities.createMap!({ name: '新地图', width: 4, height: 2, layerName: '底层' });
    const reopened = await capabilities.openMap(created.id);
    const added = await capabilities.addLayer!(created.id);
    const renamed = added.layers.map((layer, index) =>
      index === added.layers.length - 1 ? { ...layer, name: '测试层' } : layer,
    );

    await capabilities.saveMapData({ ...toSection(added), layers: renamed });

    const again = await capabilities.openMap(created.id);
    const last = again.layers[again.layers.length - 1];
    const saved = await readRecord(backend, created.id);

    expect(reopened.layers[0].name).toBe('底层');
    expect(last.name).toBe('测试层');
    expect(saved.layerNames[again.layers.length - 1]).toBe('测试层');
  });

  // openMap / createMap / addLayer 返回的文档都带着经选项注入的图块目录
  it('三个入口的文档都带着注入的图块目录', async () => {
    const backend = new MemoryBackend();

    await seedProject(backend, [createRecord()]);

    const capabilities = createMapCapabilities(backend, { tileGroups: TEST_TILE_GROUPS });
    const opened = await capabilities.openMap('m1');
    const created = await capabilities.createMap!({ name: '新地图', width: 2, height: 2, layerName: '底层' });
    const added = await capabilities.addLayer!('m1');

    for (const document of [opened, created, added]) {
      expect(document.tileGroups).toBe(TEST_TILE_GROUPS);
      expect(document.tileGroups.length).toBe(2);
      expect(document.tileGroups.map((group) => group.id)).toEqual(['terrain', 'missing']);
    }

    expect(opened.tileGroups[1].imagePath).toBe('content/map/does-not-exist.png');
  });

  // 选项里的图块目录为空时 openMap 报错，而不是返回一份空目录的文档
  it('图块目录为空时 openMap 报错', async () => {
    const backend = new MemoryBackend();

    await seedProject(backend, [createRecord()]);

    const capabilities = createMapCapabilities(backend, { tileGroups: [] });

    await expect(capabilities.openMap('m1')).rejects.toThrow(/图块目录/);
  });

  // 属性域的返回值是独立副本：改返回值不会反过来改到文件内容里的对象
  it('读取属性与写回属性都不共享引用', async () => {
    const backend = new MemoryBackend();

    await seedProject(backend, [createRecord()]);

    const capabilities = createMapCapabilities(backend, { tileGroups: TEST_TILE_GROUPS });
    const properties = await capabilities.readProperties!('m1');

    properties.initialGold = 0;

    const saved = await readRecord(backend, 'm1');
    const next = applyMapPropertiesSection(saved, properties);

    expect(saved.properties.initialGold).toBe(10);
    expect(next.properties.initialGold).toBe(0);
  });
});
