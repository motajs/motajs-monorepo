import type { ProjectDiagnostic } from './projectModel';

export interface BlocklyCompletionItem {
  value: string;
  label?: string;
  kind: string;
  idnum?: number;
}

export interface BlocklyCompletionCatalog {
  all: BlocklyCompletionItem[];
  bySource: Record<string, BlocklyCompletionItem[]>;
  diagnostics: ProjectDiagnostic[];
}

export interface FlagUsage {
  source: string;
  label: string;
  path: string;
}

export interface FlagUsageIndex {
  flags: string[];
  usages: Record<string, FlagUsage[]>;
}

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {};
}

function addEntries(target: BlocklyCompletionItem[], value: unknown, kind: string, prefix = ''): void {
  for (const [id, data] of Object.entries(record(value))) {
    const info = record(data);
    target.push({
      value: `${prefix}${id}`,
      label: typeof info.name === 'string' ? info.name : undefined,
      kind,
      idnum: typeof info.idnum === 'number' ? info.idnum : undefined,
    });
  }
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function buildBlocklyCompletionCatalog(input: {
  tower: unknown;
  items: unknown;
  enemys: unknown;
  mapBlocks: unknown;
  commonEvents: unknown;
  floorIds: string[];
}): BlocklyCompletionCatalog {
  const tower = record(input.tower);
  const main = record(tower.main);
  const firstData = record(tower.firstData);
  const bySource: Record<string, BlocklyCompletionItem[]> = {};
  const source = (name: string) => (bySource[name] ??= []);

  addEntries(source('enemy'), input.enemys, 'enemy');
  addEntries(source('item'), input.items, 'item');
  for (const [id, value] of Object.entries(record(input.items))) {
    if (record(value).cls === 'equips') source('equip').push({ value: id, kind: 'equip' });
  }
  addEntries(source('id'), input.mapBlocks, 'block');
  addEntries(source('commonEvent'), input.commonEvents, 'commonEvent');
  input.floorIds.forEach((id) => source('floor').push({ value: id, kind: 'floor' }));
  stringArray(firstData.shops).forEach((id) => source('shop').push({ value: id, kind: 'shop' }));
  if (Array.isArray(firstData.shops)) {
    firstData.shops.forEach((shop) => {
      const id = record(shop).id;
      if (typeof id === 'string') source('shop').push({ value: id, kind: 'shop' });
    });
  }

  const materialFields: Array<[string, unknown]> = [
    ['image', main.images],
    ['animate', main.animates],
    ['bgm', main.bgms],
    ['sound', main.sounds],
    ['image', main.autotiles],
    ['image', main.tilesets],
  ];
  materialFields.forEach(([kind, values]) =>
    stringArray(values).forEach((value) => {
      source(kind).push({ value, kind });
    }),
  );
  stringArray(main.fonts).forEach((value) => source('font').push({ value, kind: 'font' }));
  const mainStyle = record(main.styles).font;
  if (typeof mainStyle === 'string') source('font').push({ value: mainStyle, kind: 'font' });
  [
    'aqua',
    'black',
    'blue',
    'fuchsia',
    'gray',
    'green',
    'lime',
    'maroon',
    'navy',
    'gold',
    'olive',
    'orange',
    'purple',
    'red',
    'silver',
    'teal',
    'white',
    'yellow',
  ].forEach((value) => source('color').push({ value, kind: 'color' }));

  const expression = source('expression');
  [
    'status:hp',
    'status:atk',
    'status:def',
    'status:mdef',
    'status:money',
    'status:exp',
    'hero.hp',
    'hero.atk',
    'hero.def',
    'hero.money',
    'flags.',
    'core.',
  ].forEach((value) => {
    expression.push({ value, kind: 'expression' });
  });
  Object.keys(record(tower.values)).forEach((id) => expression.push({ value: `value:${id}`, kind: 'value' }));
  Object.keys(record(tower.flags)).forEach((id) => {
    source('flag').push({ value: id, kind: 'flag' });
    expression.push({ value: `flag:${id}`, kind: 'flag' });
  });
  ['hp', 'atk', 'def', 'mdef', 'money', 'exp', 'lv', 'name', 'loc', 'direction', 'items', 'equipment'].forEach(
    (value) => source('status').push({ value, kind: 'status' }),
  );
  [
    'status',
    'material',
    'events',
    'ui',
    'maps',
    'items',
    'enemys',
    'flags',
    'values',
    'getBlockInfo',
    'insertAction',
    'getFlag',
    'setFlag',
    'hasFlag',
    'removeFlag',
  ].forEach((value) => source('core').push({ value, kind: 'core' }));
  Object.keys(record(main.nameMap)).forEach((alias) => source('id').push({ value: alias, kind: 'alias' }));
  ['bg', 'event', 'event2', 'fg', 'ui', 'data'].forEach((id) => source('id').push({ value: id, kind: 'canvas' }));
  const enemyAttributes = new Set<string>();
  Object.values(record(input.enemys)).forEach((enemy) => {
    Object.keys(record(enemy)).forEach((key) => enemyAttributes.add(key));
  });
  source('enemy')
    .slice()
    .forEach((enemy) =>
      enemyAttributes.forEach((attribute) => {
        expression.push({ value: `enemy:${enemy.value}:${attribute}`, kind: 'enemy-attribute' });
      }),
    );
  source('textEscape').push(
    { value: '\\n', kind: 'escape', label: '换行' },
    { value: '\\i[]', kind: 'escape', label: '图标' },
    { value: '\\f[]', kind: 'escape', label: '绘制图片' },
    { value: '\\c[]', kind: 'escape', label: '字体大小' },
    { value: '\\r[]', kind: 'escape', label: '文字颜色' },
    { value: '\\g[]', kind: 'escape', label: '字体' },
    { value: '\\z', kind: 'escape', label: '暂停打字' },
    { value: '\\t[]', kind: 'escape', label: '标题与图像' },
    { value: '\\b[]', kind: 'escape', label: '对话框位置' },
    { value: '\\d', kind: 'escape', label: '切换粗体' },
    { value: '\\e', kind: 'escape', label: '切换斜体' },
  );

  const all = Array.from(
    new Map(
      Object.values(bySource)
        .flat()
        .map((item) => [item.value, item]),
    ).values(),
  );
  return { all, bySource, diagnostics: [] };
}

const FLAG_PATTERN = /(?:flag:|变量[:：])([A-Za-z0-9_\u4E00-\u9FCC\u3040-\u30FF\u2160-\u216B\u0391-\u03C9]+)/g;

function collectFlags(
  value: unknown,
  usage: Omit<FlagUsage, 'path'>,
  path: string,
  output: Record<string, FlagUsage[]>,
): void {
  if (typeof value === 'string') {
    FLAG_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = FLAG_PATTERN.exec(value))) {
      const list = output[match[1]] ?? [];
      list.push({ ...usage, path });
      output[match[1]] = list;
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectFlags(item, usage, `${path}[${index}]`, output));
    return;
  }
  if (value && typeof value === 'object') {
    Object.entries(value as UnknownRecord).forEach(([key, item]) =>
      collectFlags(item, usage, path ? `${path}.${key}` : key, output),
    );
  }
}

export function buildFlagUsageIndex(input: {
  tower: unknown;
  items: unknown;
  enemys: unknown;
  mapBlocks: unknown;
  commonEvents: unknown;
  floors: Record<string, unknown>;
}): FlagUsageIndex {
  const usages: Record<string, FlagUsage[]> = {};
  const scan = (value: unknown, source: string, label: string) => collectFlags(value, { source, label }, '$', usages);
  scan(input.tower, 'tower', '全塔属性');
  Object.entries(record(input.commonEvents)).forEach(([id, value]) =>
    scan(value, `commonEvent:${id}`, `公共事件 ${id}`),
  );
  Object.entries(record(input.items)).forEach(([id, value]) => scan(value, `item:${id}`, `道具 ${id}`));
  Object.entries(record(input.enemys)).forEach(([id, value]) => scan(value, `enemy:${id}`, `怪物 ${id}`));
  Object.entries(record(input.mapBlocks)).forEach(([id, value]) => scan(value, `mapBlock:${id}`, `图块 ${id}`));
  Object.entries(input.floors).forEach(([id, value]) => scan(value, `floor:${id}`, `楼层 ${id}`));
  for (const list of Object.values(usages)) {
    const unique = new Map(list.map((item) => [`${item.source}:${item.path}`, item]));
    list.splice(0, list.length, ...unique.values());
  }
  return { flags: Object.keys(usages).sort(), usages };
}
