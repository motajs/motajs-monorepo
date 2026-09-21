import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { FileHandlerManager } from '@/fs/FileHandlerManager';
import { persistenceMonitor } from '@/fs/PersistenceMonitor';
import { projectData } from '@/project/data/projectData';
import { projectAssets } from '@/project/assets';
import { operationHistory } from '@/project/history';
import { fs as browserFs } from '@/services/fs';
import { floorCommands } from '@/project/commands/floorCommands';
import { locCommands } from '@/project/commands/locCommands';
import { mapCommands, readMapInfo } from '@/project/commands/mapCommands';
import { materialCommands } from '@/project/commands/materialCommands';
import { parsePrefabClipboard, prefabCommands, serializePrefabClipboard } from '@/project/commands/prefabCommands';
import { tableCommands } from '@/project/commands/tableCommands';
import { animationCommands } from '@/project/commands/animationCommands';
import { projectModel } from '@/project/model/projectModel';
import type { PrefabInfo } from '@/services/prefab';
import { META_FILE_CONFIG, VALID_META_FILE_KEYS } from '@/services/tableMeta/tableMetaService';
import { loadSampleProject, type SampleProjectContext } from '@test/utils/sampleProject';
import { MOTA_JS_ROOT } from '../../../../mota-root';

describe('ProjectData + Commands with real sample project', () => {
  let project: SampleProjectContext;
  let assetSpies: MockInstance[];

  beforeEach(async () => {
    operationHistory.clear();
    project = await loadSampleProject();
    projectAssets.reset();
    assetSpies = [
      vi.spyOn(browserFs.promises, 'readFile').mockImplementation(project.fs.readFile.bind(project.fs)),
      vi.spyOn(browserFs.promises, 'readFileBinary').mockImplementation(project.fs.readFileBinary.bind(project.fs)),
      vi.spyOn(browserFs.promises, 'writeFile').mockImplementation(project.fs.writeFile.bind(project.fs)),
      vi.spyOn(browserFs.promises, 'readdir').mockImplementation(project.fs.readdir.bind(project.fs)),
      vi.spyOn(browserFs.promises, 'deleteFile').mockImplementation(project.fs.deleteFile.bind(project.fs)),
    ];
  });

  afterEach(() => {
    operationHistory.clear();
    FileHandlerManager.clear();
    projectData.resetForTests();
    projectAssets.reset();
    for (const spy of assetSpies) spy.mockRestore();
  });

  it('preloads every project data file once after startup', async () => {
    for (const key of VALID_META_FILE_KEYS) {
      const filePath = META_FILE_CONFIG[key].filePath;
      project.fs.setFile(filePath, await readFile(path.join(MOTA_JS_ROOT, filePath), 'utf-8'));
    }
    FileHandlerManager.clear();
    projectData.resetForTests();

    const first = projectData.preloadAll();
    expect(projectData.preloadAll()).toBe(first);
    const report = await first;

    expect(report.failures).toEqual([]);
    const resources = [
      projectData.tower(),
      projectData.items(),
      projectData.enemys(),
      projectData.mapBlocks(),
      projectData.icons(),
      projectData.functions(),
      projectData.plugins(),
      projectData.events(),
      ...VALID_META_FILE_KEYS.map((key) => projectData.tableMetaSource(key)),
      ...projectData
        .tower()
        .value()
        .main.floorIds.map((floorId) => projectData.floor(floorId)),
    ];
    expect(resources.every((resource) => resource.snapshot().status === 'loaded')).toBe(true);
  });

  it('builds project-aware table schema and logical split image catalog', async () => {
    for (const key of VALID_META_FILE_KEYS) {
      const filePath = META_FILE_CONFIG[key].filePath;
      project.fs.setFile(filePath, await readFile(path.join(MOTA_JS_ROOT, filePath), 'utf-8'));
      await project.registerPath(filePath);
    }
    const tower = projectData.tower();
    await project.loadResource(tower);
    const towerStatuses: string[] = [];
    const unsubscribe = tower.subscribe((content) => towerStatuses.push(content.status));
    const images = projectModel.projectImageCatalog();
    await images.reload();
    unsubscribe();
    expect(towerStatuses).not.toContain('loading');
    const imageCatalog = images.value();
    expect(imageCatalog.entries.filter((entry) => entry.kind === 'split').map((entry) => entry.name)).toEqual(
      expect.arrayContaining(['dragon_0.png', 'dragon_1.png', 'dragon_2.png', 'dragon_3.png']),
    );

    const schemaResource = projectModel.tableSchema('dataComment');
    await schemaResource.reload();
    const schema = schemaResource.value().schema as any;
    const floorId = schema._data.firstData._data.floorId;
    const heroImage = schema._data.firstData._data.hero._data.image;
    expect(floorId._select.values).toContain('sample0');
    expect(heroImage._select.values).toContain('hero.png');
    expect(heroImage._select.values).toContain('dragon_0.png');

    const commentResource = projectModel.tableSchema('comment');
    await commentResource.reload();
    const comment = commentResource.value().schema as any;
    const specialOptions = comment._data.enemys._data.special._checkboxSet();
    expect(specialOptions.key).toEqual(expect.arrayContaining([1, 6, 27]));
    expect(specialOptions.prefix).toEqual(expect.arrayContaining(['先攻(1)', '连击(6)']));
  });

  it('keeps preloading independent resources when tower data cannot be parsed', async () => {
    for (const key of VALID_META_FILE_KEYS) {
      const filePath = META_FILE_CONFIG[key].filePath;
      project.fs.setFile(filePath, await readFile(path.join(MOTA_JS_ROOT, filePath), 'utf-8'));
    }
    project.fs.setFile('project/data.js', 'not valid tower data');
    FileHandlerManager.clear();
    projectData.resetForTests();

    const report = await projectData.preloadAll();

    expect(report.failures.map((failure) => failure.path)).toContain('project/data.js');
    expect(report.loaded).toEqual(
      expect.arrayContaining([
        'items',
        'enemys',
        'mapBlocks',
        'icons',
        'functions',
        'plugins',
        'events',
        'tableMeta:dataComment',
      ]),
    );
    expect(report.loaded.some((id) => id.startsWith('floor:'))).toBe(false);
  });

  it('patches functions and persists after reload', async () => {
    const functions = await project.loadResource(projectData.functions());
    expect(functions.events).toBeDefined();

    const result = await tableCommands.patchFunctions([
      ['add', "['events']['__commandTest']", "function () { return 'ok'; }"],
    ]);

    expect(result).toEqual({ ok: true });
    await persistenceMonitor.whenQuiescent([projectData.functions().path]);
    await projectData.functions().reload();
    const updated = projectData.functions().value();
    expect(updated.events?.__commandTest).toContain('function __commandTest');
    expect(updated.events?.__commandTest).toContain("return 'ok'");
    expect(project.readText('project/functions.js')).toContain('__commandTest');
  });

  it('edits animation sound cues through history while preserving animation data', async () => {
    const path = 'project/animates/jianji.animate';
    const before = JSON.parse(Buffer.from(project.fs.getFile(path)!, 'base64').toString());
    const result = await animationCommands.setSoundCues('jianji', [{ frame: 2, sound: 'attack.mp3', pitch: 130 }]);
    expect(result).toEqual({ ok: true });
    const changed = JSON.parse(Buffer.from(project.fs.getFile(path)!, 'base64').toString());
    expect(changed.se).toEqual({ 2: 'attack.mp3' });
    expect(changed.pitch).toEqual({ 2: 130 });
    expect(changed.frames).toEqual(before.frames);
    expect(changed.bitmaps).toEqual(before.bitmaps);

    await operationHistory.undo();
    const undone = JSON.parse(Buffer.from(project.fs.getFile(path)!, 'base64').toString());
    expect(undone.se).toEqual(before.se);
    await operationHistory.redo();
    const redone = JSON.parse(Buffer.from(project.fs.getFile(path)!, 'base64').toString());
    expect(redone.se).toEqual({ 2: 'attack.mp3' });
  });

  it('patches common events through events.commonEvent without dropping sibling event data', async () => {
    await project.loadResource(projectData.events());
    await projectData.events().mutate((draft) => {
      draft.__commandSentinel = { keep: true };
    });

    const result = await tableCommands.patchCommonEvents([
      ['add', "['__commandEvent']", [{ type: 'comment', text: 'created by commands test' }]],
    ]);

    expect(result).toEqual({ ok: true });
    await persistenceMonitor.whenQuiescent([projectData.commonEvents().path]);
    await projectData.events().reload();
    const events = projectData.events().value();
    expect(events.__commandSentinel).toEqual({ keep: true });
    expect(events.commonEvent.__commandEvent).toEqual([{ type: 'comment', text: 'created by commands test' }]);
  });

  it('patches plugins and persists after reload', async () => {
    await project.loadResource(projectData.plugins());

    const result = await tableCommands.patchPlugins([
      ['add', "['__commandPlugin']", 'function () { this.__commandPlugin = true; }'],
    ]);

    expect(result).toEqual({ ok: true });
    await persistenceMonitor.whenQuiescent([projectData.plugins().path]);
    await projectData.plugins().reload();
    const plugins = projectData.plugins().value();
    expect(plugins.__commandPlugin).toContain('function __commandPlugin');
    expect(plugins.__commandPlugin).toContain('this.__commandPlugin = true');
    expect(project.readText('project/plugins.js')).toContain('__commandPlugin');
  });

  it('patches a real floor field and persists after reload', async () => {
    await project.loadResource(projectData.floor('sample0'));

    const result = await tableCommands.patchFloor('sample0', [['change', "['title']", 'Commands Sample 0']]);

    expect(result).toEqual({ ok: true });
    await persistenceMonitor.whenQuiescent([projectData.floor('sample0').path]);
    await projectData.floor('sample0').reload();
    expect(projectData.floor('sample0').value().title).toBe('Commands Sample 0');
    expect(project.readText('project/floors/sample0.js')).toContain('Commands Sample 0');
  });

  it('routes loc actions to x,y floor paths including autoEvent pages', async () => {
    await project.loadResource(projectData.floor('sample0'));

    const eventResult = await locCommands.patch('sample0', { x: 4, y: 4 }, [
      ['change', "['events']", [{ type: 'comment', text: 'loc event' }]],
    ]);
    const autoResult = await locCommands.patch('sample0', { x: 4, y: 4 }, [
      ['add', "['autoEvent']['2']", { condition: 'true', data: [] }],
    ]);

    expect(eventResult).toEqual({ ok: true });
    expect(autoResult).toEqual({ ok: true });
    const floor = projectData.floor('sample0').value();
    expect(floor.events?.['4,4']).toEqual([{ type: 'comment', text: 'loc event' }]);
    expect(floor.autoEvent?.['4,4']?.['2']).toEqual({ condition: 'true', data: [] });
  });

  it('adds the next autoEvent page id for a location', async () => {
    await project.loadResource(projectData.floor('sample0'));
    await floorCommands.patch('sample0', [['add', "['autoEvent']['5,5']['2']", { condition: 'true', data: [] }]]);

    const result = await locCommands.addAutoEventPage('sample0', { x: 5, y: 5 });

    expect(result).toEqual({ ok: true, pageId: '3' });
    expect(projectData.floor('sample0').value().autoEvent?.['5,5']?.['3']).toBeNull();
  });

  it('paints map cells through mapCommands', async () => {
    await project.loadResource(projectData.floor('sample0'));

    const result = await mapCommands.paint({
      floorId: 'sample0',
      positions: [
        { x: 6, y: 5 },
        { x: 7, y: 5 },
      ],
      idnum: 21,
    });

    expect(result).toEqual({ ok: true });
    const floor = projectData.floor('sample0').value();
    expect(floor.map[5][6]).toBe(21);
    expect(floor.map[5][7]).toBe(21);
  });

  it('adds stair changeFloor events while painting stairs', async () => {
    await project.loadResource(projectData.floor('sample0'));

    const result = await mapCommands.paint({
      floorId: 'sample0',
      pos: { x: 6, y: 5 },
      block: { id: 'upFloor', idnum: 87 },
    });

    expect(result).toEqual({ ok: true });
    const floor = projectData.floor('sample0').value();
    expect(floor.map[5][6]).toBe(87);
    expect(floor.changeFloor?.['6,5']).toEqual({
      floorId: ':next',
      stair: 'downFloor',
    });
  });

  it('binds the tower start point through mapCommands', async () => {
    await project.loadResource(projectData.tower());

    const result = await mapCommands.bindStartPoint('sample1', { x: 3, y: 4 });

    expect(result).toEqual({ ok: true });
    await persistenceMonitor.whenQuiescent([projectData.tower().path]);
    await projectData.tower().reload();
    const tower = projectData.tower().value();
    expect(tower.firstData.floorId).toBe('sample1');
    expect(tower.firstData.hero.loc).toMatchObject({ x: 3, y: 4 });
    expect(project.readText('project/data.js')).toContain('"sample1"');
  });

  it('binds stair and portal changeFloor events through mapCommands', async () => {
    await project.loadResource(projectData.floor('sample0'));

    const cases: Array<[string, Record<string, unknown>]> = [
      ['upFloor', { floorId: ':next', stair: 'downFloor' }],
      ['downFloor', { floorId: ':before', stair: 'upFloor' }],
      ['leftPortal', { floorId: ':next', stair: ':symmetry_x' }],
      ['rightPortal', { floorId: ':next', stair: ':symmetry_x' }],
      ['upPortal', { floorId: ':next', stair: ':symmetry_y' }],
      ['downPortal', { floorId: ':next', stair: ':symmetry_y' }],
    ];

    for (const [index, [blockId, expected]] of cases.entries()) {
      const result = await mapCommands.bindStair('sample0', { x: index, y: 10 }, blockId);
      expect(result).toEqual({ ok: true });
      expect(projectData.floor('sample0').value().changeFloor?.[`${index},10`]).toEqual(expected);
    }

    const unsupported = await mapCommands.bindStair('sample0', { x: 12, y: 10 }, 'yellowKey');
    expect(unsupported).toMatchObject({ ok: false, stage: 'bind-stair' });
  });

  it('binds special door auto events and enemy counters through mapCommands', async () => {
    await project.loadResource(projectData.floor('sample0'));

    const result = await mapCommands.bindSpecialDoor('sample0', { x: 11, y: 10 }, [
      { x: 0, y: 7 },
      { x: 1, y: 7 },
    ]);

    expect(result).toEqual({ ok: true });
    const floor = projectData.floor('sample0').value();
    const flag = 'flag:door_sample0_11_10';
    expect(floor.autoEvent?.['11,10']?.['0']).toMatchObject({
      condition: `${flag}==2`,
      currentFloor: true,
      data: [{ type: 'openDoor' }, { type: 'setValue', name: flag, operator: '=', value: 'null' }],
    });
    expect(floor.afterBattle?.['0,7']).toContainEqual({
      type: 'setValue',
      name: flag,
      operator: '+=',
      value: '1',
    });
    expect(floor.afterBattle?.['1,7']).toContainEqual({
      type: 'setValue',
      name: flag,
      operator: '+=',
      value: '1',
    });
  });

  it('resolves static changeFloor targets through mapCommands', async () => {
    await project.loadResource(projectData.floor('sample0'));
    await floorCommands.patch('sample0', [
      ['change', "['changeFloor']['1,1']", { floorId: 'sample1', loc: [2, 3] }],
      ['change', "['changeFloor']['2,1']", { floorId: ':next' }],
      ['change', "['changeFloor']['3,1']", { floorId: ':before' }],
      ['change', "['changeFloor']['4,1']", { floorId: ':now' }],
    ]);

    const explicit = mapCommands.resolveChangeFloorTarget('sample0', { x: 1, y: 1 }, ['sample0', 'sample1']);
    expect(explicit).toEqual({ ok: true, target: { floorId: 'sample1', pos: { x: 2, y: 3 } } });

    const next = mapCommands.resolveChangeFloorTarget('sample0', { x: 2, y: 1 }, ['sample0', 'sample1']);
    expect(next).toEqual({ ok: true, target: { floorId: 'sample1', pos: undefined } });

    const before = mapCommands.resolveChangeFloorTarget('sample0', { x: 3, y: 1 }, [
      'sampleBefore',
      'sample0',
      'sample1',
    ]);
    expect(before).toEqual({ ok: true, target: { floorId: 'sampleBefore', pos: undefined } });

    const dynamic = mapCommands.resolveChangeFloorTarget('sample0', { x: 4, y: 1 }, ['sample0', 'sample1']);
    expect(dynamic).toMatchObject({ ok: false, stage: 'resolve-change-floor-target' });
  });

  it('reports map paint failures before mutating floor data', async () => {
    await project.loadResource(projectData.floor('sample0'));
    const before = projectData.floor('sample0').value().map[5][6];

    const result = await mapCommands.paint({
      floorId: 'sample0',
      pos: { x: 6, y: 5 },
      block: { id: 'missingIdnum' },
    });

    expect(result).toMatchObject({ ok: false, stage: 'paint-map' });
    expect(projectData.floor('sample0').value().map[5][6]).toBe(before);
  });

  it('clears map blocks and location events through mapCommands', async () => {
    await project.loadResource(projectData.floor('sample0'));
    await floorCommands.patch('sample0', [
      ['change', "['map']['5']['6']", 21],
      ['change', "['events']['6,5']", [{ type: 'comment', text: 'event' }]],
      ['change', "['changeFloor']['6,5']", { floorId: 'sample1' }],
      ['change', "['cannotMove']['6,5']", ['up']],
    ]);

    const clearBlockResult = await mapCommands.clearBlock('sample0', 'map', { x: 6, y: 5 });

    expect(clearBlockResult).toEqual({ ok: true });
    expect(projectData.floor('sample0').value().map[5][6]).toBe(0);
    expect(projectData.floor('sample0').value().events?.['6,5']).toEqual([{ type: 'comment', text: 'event' }]);

    const clearEventsResult = await mapCommands.clearEvents('sample0', { x: 6, y: 5 });

    expect(clearEventsResult).toEqual({ ok: true });
    const floor = projectData.floor('sample0').value();
    expect(floor.events?.['6,5']).toBeUndefined();
    expect(floor.changeFloor?.['6,5']).toBeUndefined();
    expect(floor.cannotMove?.['6,5']).toBeUndefined();
  });

  it('clears a map location and its events through mapCommands', async () => {
    await project.loadResource(projectData.floor('sample0'));
    await floorCommands.patch('sample0', [
      ['change', "['map']['5']['6']", 21],
      ['change', "['events']['6,5']", [{ type: 'comment', text: 'event' }]],
    ]);

    const result = await mapCommands.clearLoc('sample0', 'map', { x: 6, y: 5 });

    expect(result).toEqual({ ok: true });
    const floor = projectData.floor('sample0').value();
    expect(floor.map[5][6]).toBe(0);
    expect(floor.events?.['6,5']).toBeUndefined();
  });

  it('pastes copied map info and replaces target location events', async () => {
    await project.loadResource(projectData.floor('sample0'));
    await floorCommands.patch('sample0', [
      ['change', "['map']['5']['6']", 0],
      ['change', "['events']['6,5']", [{ type: 'comment', text: 'old' }]],
      ['change', "['cannotMove']['6,5']", ['up']],
    ]);

    const result = await mapCommands.pasteInfo({
      floorId: 'sample0',
      layer: 'map',
      pos: { x: 6, y: 5 },
      info: {
        w: 1,
        h: 1,
        layer: 'map',
        data: [
          {
            map: 21,
            events: {
              events: [{ type: 'comment', text: 'new' }],
              changeFloor: { floorId: 'sample1', loc: [1, 1] },
            },
          },
        ],
      },
    });

    expect(result).toEqual({ ok: true });
    await persistenceMonitor.whenQuiescent([projectData.floor('sample0').path]);
    await projectData.floor('sample0').reload();
    const floor = projectData.floor('sample0').value();
    expect(floor.map[5][6]).toBe(21);
    expect(floor.events?.['6,5']).toEqual([{ type: 'comment', text: 'new' }]);
    expect(floor.changeFloor?.['6,5']).toEqual({ floorId: 'sample1', loc: [1, 1] });
    expect(floor.cannotMove?.['6,5']).toBeUndefined();
    expect(project.readText('project/floors/sample0.js')).toContain('new');
  });

  it('replaces a map layer after validating dimensions', async () => {
    await project.loadResource(projectData.floor('sample0'));
    const floor = projectData.floor('sample0').value();
    const nextMap = floor.map.map((row) => row.map(() => 0));
    nextMap[5][6] = 21;

    const result = await mapCommands.replaceLayer('sample0', 'map', nextMap);

    expect(result).toEqual({ ok: true });
    await persistenceMonitor.whenQuiescent([projectData.floor('sample0').path]);
    await projectData.floor('sample0').reload();
    expect(projectData.floor('sample0').value().map[5][6]).toBe(21);
    expect(project.readText('project/floors/sample0.js')).toContain('21');
  });

  it('rejects mismatched map layer replacement without mutating the floor', async () => {
    await project.loadResource(projectData.floor('sample0'));
    const before = projectData.floor('sample0').value().map[0][0];

    const result = await mapCommands.replaceLayer('sample0', 'map', [[1, 2, 3]]);

    expect(result).toMatchObject({ ok: false, stage: 'replace-map-layer' });
    expect(projectData.floor('sample0').value().map[0][0]).toBe(before);
  });

  it('clears all floor map layers and location event data', async () => {
    await project.loadResource(projectData.floor('sample0'));
    await floorCommands.patch('sample0', [
      ['change', "['bgmap']", [[1]]],
      ['change', "['fgmap']", [[2]]],
      ['change', "['firstArrive']", [{ type: 'comment', text: 'first' }]],
      ['change', "['eachArrive']", [{ type: 'comment', text: 'each' }]],
      ['change', "['events']['6,5']", [{ type: 'comment', text: 'event' }]],
      ['change', "['changeFloor']['6,5']", { floorId: 'sample1' }],
      ['change', "['cannotMove']['6,5']", ['up']],
    ]);

    const result = await mapCommands.clearFloorMap('sample0');

    expect(result).toEqual({ ok: true });
    const floor = projectData.floor('sample0').value();
    expect(floor.map.every((row) => row.every((cell) => cell === 0))).toBe(true);
    expect(floor.bgmap?.every((row) => row.every((cell) => cell === 0))).toBe(true);
    expect(floor.fgmap?.every((row) => row.every((cell) => cell === 0))).toBe(true);
    expect(floor.firstArrive).toEqual([]);
    expect(floor.eachArrive).toEqual([]);
    expect(floor.events).toEqual({});
    expect(floor.changeFloor).toEqual({});
    expect(floor.cannotMove).toEqual({});
  });

  it('moves and exchanges map cells with location events', async () => {
    await project.loadResource(projectData.floor('sample0'));
    await floorCommands.patch('sample0', [
      ['change', "['map']['5']['6']", 21],
      ['change', "['map']['5']['7']", 22],
      ['change', "['events']['6,5']", [{ type: 'comment', text: 'from' }]],
      ['change', "['events']['7,5']", [{ type: 'comment', text: 'to' }]],
    ]);

    const moveResult = await mapCommands.moveLoc({
      floorId: 'sample0',
      from: { x: 6, y: 5 },
      to: { x: 8, y: 5 },
    });

    expect(moveResult).toEqual({ ok: true });
    let floor = projectData.floor('sample0').value();
    expect(floor.map[5][6]).toBe(0);
    expect(floor.map[5][8]).toBe(21);
    expect(floor.events?.['6,5']).toBeUndefined();
    expect(floor.events?.['8,5']).toEqual([{ type: 'comment', text: 'from' }]);

    const exchangeResult = await mapCommands.exchangeLoc({
      floorId: 'sample0',
      from: { x: 8, y: 5 },
      to: { x: 7, y: 5 },
    });

    expect(exchangeResult).toEqual({ ok: true });
    floor = projectData.floor('sample0').value();
    expect(floor.map[5][8]).toBe(22);
    expect(floor.map[5][7]).toBe(21);
    expect(floor.events?.['8,5']).toEqual([{ type: 'comment', text: 'to' }]);
    expect(floor.events?.['7,5']).toEqual([{ type: 'comment', text: 'from' }]);
  });

  it('routes prefab patches to enemy, item, and mapBlock resources', async () => {
    await project.loadResource(projectData.enemys());
    await project.loadResource(projectData.items());
    await project.loadResource(projectData.mapBlocks());

    const enemyInfo: PrefabInfo = { images: 'enemys', id: 'greenSlime' };
    const itemInfo: PrefabInfo = { images: 'items', id: 'yellowKey' };
    const mapBlockInfo: PrefabInfo = { images: 'terrains', idnum: 1 };

    expect(await prefabCommands.patch(enemyInfo, [['change', "['name']", '测试绿头怪']])).toEqual({ ok: true });
    expect(await prefabCommands.patch(itemInfo, [['change', "['name']", '测试黄钥匙']])).toEqual({ ok: true });
    expect(await prefabCommands.patch(mapBlockInfo, [['change', "['id']", 'testYellowWall']])).toEqual({ ok: true });

    expect(projectData.enemys().value().greenSlime.name).toBe('测试绿头怪');
    expect(projectData.items().value().yellowKey.name).toBe('测试黄钥匙');
    expect(projectData.mapBlocks().value()[1].id).toBe('testYellowWall');
  });

  it('copies, validates, previews and pastes prefab data through prefabCommands', async () => {
    await project.loadResource(projectData.enemys());
    await projectData.enemys().patch([
      [
        'change',
        "['greenSlime']",
        {
          id: 'greenSlime',
          name: '绿头怪',
          hp: 50,
          displayIdInBook: 1,
          faceIds: { down: 'greenSlime' },
          sourceOnly: true,
        },
      ],
      [
        'change',
        "['redSlime']",
        {
          id: 'redSlime',
          name: '红头怪',
          hp: 80,
          displayIdInBook: 2,
          faceIds: { down: 'redSlime' },
          targetOnly: true,
        },
      ],
    ]);

    const copy = prefabCommands.getClipboardData({ images: 'enemys', id: 'greenSlime' }, projectData.enemys().value());
    expect(copy).toMatchObject({
      ok: true,
      data: { kind: 'mota-prefab-properties', version: 1, type: 'enemy', source: { id: 'greenSlime' } },
    });
    const clipboard = parsePrefabClipboard(serializePrefabClipboard(copy.data!));
    const replacePreview = prefabCommands.previewPaste(
      { images: 'enemys', id: 'redSlime' },
      clipboard,
      projectData.enemys().value(),
      'replace',
    );
    expect(replacePreview.next).toMatchObject({
      id: 'redSlime',
      name: '红头怪',
      hp: 50,
      displayIdInBook: 2,
      faceIds: { down: 'redSlime' },
      sourceOnly: true,
    });
    expect(replacePreview.next.targetOnly).toBeUndefined();
    const mergePreview = prefabCommands.previewPaste(
      { images: 'enemys', id: 'redSlime' },
      clipboard,
      projectData.enemys().value(),
      'merge',
    );
    expect(mergePreview.next.targetOnly).toBe(true);

    const result = await prefabCommands.pasteFromClipboard(
      { images: 'enemys', id: 'redSlime' },
      clipboard,
      projectData.enemys().value(),
      'replace',
    );

    expect(result).toEqual({ ok: true });
    expect(projectData.enemys().value().redSlime).toMatchObject({
      id: 'redSlime',
      name: '红头怪',
      hp: 50,
      displayIdInBook: 2,
      faceIds: { down: 'redSlime' },
      sourceOnly: true,
    });
    expect(projectData.enemys().value().redSlime.targetOnly).toBeUndefined();
  });

  it('resets enemy, item and map block data without legacy comment templates', async () => {
    await project.loadResource(projectData.enemys());
    await project.loadResource(projectData.items());
    await project.loadResource(projectData.mapBlocks());
    await projectData.enemys().patch([
      [
        'change',
        "['greenSlime']",
        {
          id: 'greenSlime',
          name: '绿头怪',
          hp: 50,
          atk: 20,
          displayIdInBook: 1,
          faceIds: { down: 'greenSlime' },
        },
      ],
    ]);
    await projectData.items().patch([
      [
        'change',
        "['yellowKey']",
        {
          id: 'yellowKey',
          cls: 'keys',
          name: '黄钥匙',
          text: 'remove me',
        },
      ],
    ]);

    const enemyResult = await prefabCommands.reset(
      { images: 'enemys', id: 'greenSlime' },
      projectData.enemys().value(),
    );
    const itemResult = await prefabCommands.reset({ images: 'items', id: 'yellowKey' }, projectData.items().value());
    const mapBlockResult = await prefabCommands.reset(
      { images: 'animates', id: 'yellowWall', idnum: 1 },
      projectData.mapBlocks().value(),
    );

    expect(enemyResult).toEqual({ ok: true });
    expect(projectData.enemys().value().greenSlime).toEqual({
      hp: 0,
      atk: 0,
      def: 0,
      money: 0,
      exp: 0,
      point: 0,
      special: 0,
      id: 'greenSlime',
      name: '绿头怪',
      displayIdInBook: 1,
      faceIds: { down: 'greenSlime' },
    });
    expect(itemResult).toEqual({ ok: true });
    expect(projectData.items().value().yellowKey).toEqual({
      id: 'yellowKey',
      cls: 'keys',
      name: '黄钥匙',
    });
    expect(mapBlockResult).toEqual({ ok: true });
    expect(projectData.mapBlocks().value()[1]).toEqual({ cls: 'animates', id: 'yellowWall' });
  });

  it('batch resets all auto registered item prefabs through prefabCommands', async () => {
    await project.loadResource(projectData.items());
    await projectData.items().patch([
      ['change', "['I100']", { id: 'I100', cls: 'items', name: 'Auto Item', text: 'remove' }],
      ['change', "['yellowKey']", { id: 'yellowKey', cls: 'keys', name: '黄钥匙', text: 'keep' }],
    ]);

    const result = await prefabCommands.resetAll({ images: 'items', id: 'I100' }, projectData.items().value());

    expect(result).toEqual({ ok: true });
    expect(projectData.items().value().I100).toEqual({
      id: 'I100',
      cls: 'items',
      name: 'Auto Item',
    });
    expect(projectData.items().value().yellowKey.text).toBe('keep');
  });

  it('returns failures for invalid prefab routing inputs', async () => {
    expect(await tableCommands.patchPrefab({ images: 'enemys' }, [['change', "['name']", 'x']])).toMatchObject({
      ok: false,
      stage: 'patch-prefab',
    });
    expect(await tableCommands.patchPrefab({ images: 'terrains' }, [['change', "['id']", 'x']])).toMatchObject({
      ok: false,
      stage: 'patch-prefab',
    });
  });

  it('registers and renames materials through modern materialCommands', async () => {
    await project.loadResource(projectData.icons());
    await project.loadResource(projectData.mapBlocks());
    await project.loadResource(projectData.items());
    await project.loadResource(projectData.enemys());

    const templates = {
      item: { cls: 'items', name: '新物品', canUseItemEffect: 'true' },
      enemy: { name: '新敌人', hp: 0, atk: 0, def: 0, money: 0, exp: 0, point: 0, special: [] },
    };
    const newResult = await materialCommands.changeIdAndIdnum(
      'commandItem',
      399,
      { images: 'items', y: 399 },
      { templates },
    );

    expect(newResult).toEqual({ ok: true });
    expect(projectData.mapBlocks().value()['399']).toEqual({ cls: 'items', id: 'commandItem' });
    expect(projectData.icons().value().items.commandItem).toBe(399);
    expect(projectData.items().value().commandItem).toEqual(templates.item);

    const renameResult = await materialCommands.changeIdAndIdnum(
      'commandYellowKey',
      null,
      { images: 'items', id: 'yellowKey', idnum: 21, y: 0 },
      { templates },
    );

    expect(renameResult).toEqual({ ok: true });
    expect(projectData.mapBlocks().value()['21'].id).toBe('commandYellowKey');
    expect(projectData.icons().value().items.commandYellowKey).toBeDefined();
    expect(projectData.icons().value().items.yellowKey).toBeUndefined();
    expect(projectData.items().value().commandYellowKey).toBeDefined();
    expect(projectData.items().value().yellowKey).toBeUndefined();

    await operationHistory.undo();
    expect(projectData.mapBlocks().value()['21'].id).toBe('yellowKey');
    expect(projectData.icons().value().items.yellowKey).toBeDefined();
    expect(projectData.icons().value().items.commandYellowKey).toBeUndefined();
    expect(projectData.items().value().yellowKey).toBeDefined();
    expect(projectData.items().value().commandYellowKey).toBeUndefined();
    await operationHistory.redo();
    expect(projectData.mapBlocks().value()['21'].id).toBe('commandYellowKey');
    expect(projectData.items().value().commandYellowKey).toBeDefined();
  });

  it('auto-registers material rows and autotiles through materialCommands', async () => {
    await project.loadResource(projectData.icons());
    await project.loadResource(projectData.mapBlocks());
    await project.loadResource(projectData.items());

    await projectData.icons().patch([['delete', "['items']['yellowKey']", undefined]]);
    const result = await materialCommands.register(
      { images: 'items' },
      {
        rowCount: 1,
        templates: {
          item: { cls: 'items', name: '新物品' },
          enemy: {},
        },
      },
    );

    expect(result).toEqual({ ok: true });
    const autoId = Object.entries(projectData.icons().value().items).find(([, row]) => row === 0)?.[0];
    expect(autoId).toBeDefined();
    expect(projectData.items().value()[autoId!]).toBeDefined();

    await operationHistory.undo();
    expect(projectData.icons().value().items[autoId!]).toBeUndefined();
    expect(projectData.items().value()[autoId!]).toBeUndefined();
    expect(Object.values(projectData.mapBlocks().value())).not.toContainEqual({
      cls: 'items',
      id: autoId,
    });
    await operationHistory.redo();
    expect(projectData.icons().value().items[autoId!]).toBe(0);
    expect(projectData.items().value()[autoId!]).toBeDefined();

    const autotile = await materialCommands.registerAutotile('commandAutotile');
    expect(autotile).toEqual({ ok: true });
    expect(projectData.icons().value().autotile.commandAutotile).toBe(0);
    expect(Object.values(projectData.mapBlocks().value())).toContainEqual({
      cls: 'autotile',
      id: 'commandAutotile',
    });
    await operationHistory.undo();
    expect(projectData.icons().value().autotile.commandAutotile).toBeUndefined();
    expect(Object.values(projectData.mapBlocks().value())).not.toContainEqual({
      cls: 'autotile',
      id: 'commandAutotile',
    });
    await operationHistory.redo();
    expect(projectData.icons().value().autotile.commandAutotile).toBe(0);
  });

  it('blocks removal of referenced materials', async () => {
    const info: PrefabInfo = { images: 'items', id: 'yellowKey', idnum: 21 };

    expect(await materialCommands.remove(info)).toMatchObject({
      ok: false,
      stage: 'material-remove:references',
      canForce: true,
    });
  });

  it('renames a floor and updates tower floor ids', async () => {
    await project.loadResource(projectData.tower());
    await project.loadResource(projectData.floor('MT0'));
    await project.registerPath('project/floors/MT0_RENAMED.js');
    await projectData.tower().mutate((draft) => {
      draft.firstData.floorId = 'MT0';
      draft.main.floorPartitions = [['MT0', 'MT0']];
    });

    const result = await floorCommands.rename('MT0', 'MT0_RENAMED');

    expect(result).toEqual({ ok: true });
    await persistenceMonitor.whenQuiescent([projectData.tower().path]);
    expect(project.hasFile('project/floors/MT0.js')).toBe(false);
    expect(project.hasFile('project/floors/MT0_RENAMED.js')).toBe(true);
    const tower = projectData.tower().value();
    expect(tower.main.floorIds).toContain('MT0_RENAMED');
    expect(tower.main.floorIds).not.toContain('MT0');
    expect(tower.firstData.floorId).toBe('MT0_RENAMED');
    expect(tower.main.floorPartitions).toEqual([['MT0_RENAMED', 'MT0_RENAMED']]);

    await operationHistory.undo();
    expect(project.hasFile('project/floors/MT0.js')).toBe(true);
    expect(project.hasFile('project/floors/MT0_RENAMED.js')).toBe(false);
    expect(projectData.tower().value().main.floorIds).toContain('MT0');
    expect(projectData.tower().value().firstData.floorId).toBe('MT0');
    expect(projectData.tower().value().main.floorPartitions).toEqual([['MT0', 'MT0']]);

    await operationHistory.redo();
    expect(project.hasFile('project/floors/MT0.js')).toBe(false);
    expect(project.hasFile('project/floors/MT0_RENAMED.js')).toBe(true);
    expect(projectData.tower().value().main.floorIds).toContain('MT0_RENAMED');
  });

  it('creates and deletes a floor in the sample project copy', async () => {
    await project.loadResource(projectData.tower());
    await project.registerPath('project/floors/COMMAND_NEW.js');

    const createResult = await floorCommands.create('COMMAND_NEW', {
      title: 'Command New Floor',
      width: 4,
      height: 3,
    });

    expect(createResult).toEqual({ ok: true });
    expect(project.hasFile('project/floors/COMMAND_NEW.js')).toBe(true);
    expect(projectData.tower().value().main.floorIds).toContain('COMMAND_NEW');
    expect(projectData.floor('COMMAND_NEW').value().map).toHaveLength(3);

    await operationHistory.undo();
    expect(project.hasFile('project/floors/COMMAND_NEW.js')).toBe(false);
    expect(projectData.tower().value().main.floorIds).not.toContain('COMMAND_NEW');
    await operationHistory.redo();
    expect(project.hasFile('project/floors/COMMAND_NEW.js')).toBe(true);
    expect(projectData.tower().value().main.floorIds).toContain('COMMAND_NEW');

    const deleteResult = await floorCommands.delete('COMMAND_NEW');

    expect(deleteResult).toEqual({ ok: true });
    expect(project.hasFile('project/floors/COMMAND_NEW.js')).toBe(false);
    expect(projectData.tower().value().main.floorIds).not.toContain('COMMAND_NEW');

    await operationHistory.undo();
    expect(project.hasFile('project/floors/COMMAND_NEW.js')).toBe(true);
    expect(projectData.tower().value().main.floorIds).toContain('COMMAND_NEW');
    await operationHistory.redo();
    expect(project.hasFile('project/floors/COMMAND_NEW.js')).toBe(false);
    expect(projectData.tower().value().main.floorIds).not.toContain('COMMAND_NEW');
  });

  it('rebuilds a registered floor whose file was removed', async () => {
    const tower = projectData.tower();
    const floor = projectData.floor('sample0');
    await project.loadResource(tower);
    await project.loadResource(floor);
    await project.fs.deleteFile(floor.path);
    await floor.reload();

    expect(floor.snapshot().status).toBe('not-found');
    expect(tower.value().main.floorIds).toContain('sample0');

    expect(await floorCommands.rebuildMissing('sample0')).toEqual({ ok: true });
    expect(projectData.floor('sample0').value()).toMatchObject({
      floorId: 'sample0',
      width: 13,
      height: 13,
    });
    expect(projectData.floor('sample0').value().map).toHaveLength(13);
    expect(tower.value().main.floorIds).toContain('sample0');

    await operationHistory.undo();
    expect(projectData.floor('sample0').snapshot().status).toBe('not-found');
    expect(tower.value().main.floorIds).toContain('sample0');
    await operationHistory.redo();
    expect(projectData.floor('sample0').value().map).toHaveLength(13);

    await operationHistory.undo();
    expect(await floorCommands.delete('sample0')).toEqual({ ok: true });
    expect(tower.value().main.floorIds).not.toContain('sample0');
    await operationHistory.undo();
    expect(tower.value().main.floorIds).toContain('sample0');
    expect(projectData.floor('sample0').snapshot().status).toBe('not-found');
  });

  it('batch creates floors after validating all inputs', async () => {
    await project.loadResource(projectData.tower());
    await project.registerPath('project/floors/COMMAND_BATCH_1.js');
    await project.registerPath('project/floors/COMMAND_BATCH_2.js');

    const result = await floorCommands.batchCreate([
      { floorId: 'COMMAND_BATCH_1', title: 'Batch 1', name: 'B1', width: 3, height: 2 },
      { floorId: 'COMMAND_BATCH_2', title: 'Batch 2', name: 'B2', width: 4, height: 3 },
    ]);

    expect(result).toEqual({ ok: true });
    expect(project.hasFile('project/floors/COMMAND_BATCH_1.js')).toBe(true);
    expect(project.hasFile('project/floors/COMMAND_BATCH_2.js')).toBe(true);
    expect(projectData.tower().value().main.floorIds).toEqual(
      expect.arrayContaining(['COMMAND_BATCH_1', 'COMMAND_BATCH_2']),
    );

    await operationHistory.undo();
    expect(project.hasFile('project/floors/COMMAND_BATCH_1.js')).toBe(false);
    expect(project.hasFile('project/floors/COMMAND_BATCH_2.js')).toBe(false);
    expect(projectData.tower().value().main.floorIds).not.toContain('COMMAND_BATCH_1');

    await operationHistory.redo();
    expect(project.hasFile('project/floors/COMMAND_BATCH_1.js')).toBe(true);
    expect(project.hasFile('project/floors/COMMAND_BATCH_2.js')).toBe(true);
    expect(projectData.tower().value().main.floorIds).toEqual(
      expect.arrayContaining(['COMMAND_BATCH_1', 'COMMAND_BATCH_2']),
    );
  });

  it('updates floor order and partitions atomically with undo and redo', async () => {
    await project.loadResource(projectData.tower());
    const originalIds = [...projectData.tower().value().main.floorIds];

    const result = await floorCommands.updateOrganization({
      floorIds: ['sample1', 'sample0', 'sample2', 'MT0'],
      floorPartitions: [['sample1', 'sample0']],
    });

    expect(result).toEqual({ ok: true });
    expect(projectData.tower().value().main.floorIds).toEqual(['sample1', 'sample0', 'sample2', 'MT0']);
    expect(projectData.tower().value().main.floorPartitions).toEqual([['sample1', 'sample0']]);

    await operationHistory.undo();
    expect(projectData.tower().value().main.floorIds).toEqual(originalIds);
    expect(projectData.tower().value().main.floorPartitions).toEqual([]);
    await operationHistory.redo();
    expect(projectData.tower().value().main.floorIds).toEqual(['sample1', 'sample0', 'sample2', 'MT0']);
  });

  it('copies complete and blank floors while preserving partition membership', async () => {
    await project.loadResource(projectData.tower());
    await project.loadResource(projectData.floor('sample0'));
    await project.registerPath('project/floors/COPY_FULL.js');
    await project.registerPath('project/floors/COPY_BLANK.js');
    await projectData.tower().mutate((draft) => {
      draft.main.floorPartitions = [['sample0', 'sample1']];
    });
    await projectData.floor('sample0').mutate((draft) => {
      draft.eachArrive = [{ type: 'tip', text: 'each' }];
      draft.parallelDo = 'flag:test = true;';
      draft.cannotMoveIn = { '1,1': ['up'] };
    });

    expect(await floorCommands.copy('sample0', 'COPY_FULL', 'full')).toEqual({ ok: true });
    const full = projectData.floor('COPY_FULL').value();
    expect(full.floorId).toBe('COPY_FULL');
    expect(full.map).toEqual(projectData.floor('sample0').value().map);
    expect(full.events).toEqual(projectData.floor('sample0').value().events);

    expect(await floorCommands.copy('sample0', 'COPY_BLANK', 'blank')).toEqual({ ok: true });
    const blank = projectData.floor('COPY_BLANK').value();
    expect(blank.map).toHaveLength(blank.height!);
    expect(blank.map.every((row) => row.every((cell) => cell === 0))).toBe(true);
    expect(blank.bgmap.every((row) => row.every((cell) => cell === 0))).toBe(true);
    expect(blank.fgmap.every((row) => row.every((cell) => cell === 0))).toBe(true);
    expect(blank.events).toEqual({});
    expect(blank.changeFloor).toEqual({});
    expect(blank.cannotMoveIn).toEqual({});
    expect(blank.firstArrive).toEqual(projectData.floor('sample0').value().firstArrive);
    expect(blank.eachArrive).toEqual([{ type: 'tip', text: 'each' }]);
    expect(blank.parallelDo).toBe('flag:test = true;');
    expect(projectData.tower().value().main.floorIds.slice(0, 4)).toEqual([
      'sample0',
      'COPY_BLANK',
      'COPY_FULL',
      'sample1',
    ]);
    expect(projectData.tower().value().main.floorPartitions).toEqual([['sample0', 'sample1']]);

    await operationHistory.undo();
    expect(project.hasFile('project/floors/COPY_BLANK.js')).toBe(false);
    expect(projectData.tower().value().main.floorIds).not.toContain('COPY_BLANK');
    await operationHistory.redo();
    expect(project.hasFile('project/floors/COPY_BLANK.js')).toBe(true);
    expect(projectData.tower().value().main.floorIds).toContain('COPY_BLANK');
  });

  it('rejects batch create precheck failures without writing earlier floors', async () => {
    await project.loadResource(projectData.tower());
    await project.registerPath('project/floors/COMMAND_BATCH_OK.js');

    const result = await floorCommands.batchCreate([
      { floorId: 'COMMAND_BATCH_OK', width: 3, height: 2 },
      { floorId: 'sample0', width: 3, height: 2 },
    ]);

    expect(result).toMatchObject({ ok: false, stage: 'precheck-batch-create-floors' });
    expect(project.hasFile('project/floors/COMMAND_BATCH_OK.js')).toBe(false);
    expect(projectData.tower().value().main.floorIds).not.toContain('COMMAND_BATCH_OK');
  });

  it('reports floor command failure stages for duplicate create and rename targets', async () => {
    await project.loadResource(projectData.tower());
    await project.loadResource(projectData.floor('sample0'));
    await project.loadResource(projectData.floor('sample1'));

    expect(await floorCommands.create('sample0')).toMatchObject({
      ok: false,
      stage: 'check-new-floor',
    });
    expect(await floorCommands.rename('sample0', 'sample1')).toMatchObject({
      ok: false,
      stage: 'check-new-floor',
    });
  });

  it('resizes a real floor and shifts map/event structures', async () => {
    await project.loadResource(projectData.floor('sample0'));

    const result = await floorCommands.resize('sample0', {
      width: 14,
      height: 14,
      offsetX: 1,
      offsetY: 1,
    });

    expect(result).toEqual({ ok: true });
    const floor = projectData.floor('sample0').value();
    expect(floor.width).toBe(14);
    expect(floor.height).toBe(14);
    expect(floor.map).toHaveLength(14);
    expect(floor.map[0]).toHaveLength(14);
    expect(floor.map[1][1]).toBe(0);
    expect(floor.events?.['3,11']).toBeDefined();
    expect(floor.events?.['2,10']).toBeUndefined();
  });

  it('uses the coordinate reference index to update project-wide floor targets', async () => {
    await project.loadResource(projectData.tower());
    await project.loadResource(projectData.floor('sample0'));
    await project.loadResource(projectData.floor('sample1'));
    await projectData.floor('sample1').mutate((draft) => {
      draft.changeFloor = {
        ...(draft.changeFloor ?? {}),
        '0,0': { floorId: 'sample0', loc: [2, 3] },
      };
    });
    await projectData.tower().mutate((draft) => {
      draft.firstData.floorId = 'sample0';
      const hero = draft.firstData.hero as Record<string, unknown>;
      hero.loc = { x: 1, y: 2, direction: 'up' };
    });

    expect(
      await floorCommands.resize('sample0', {
        width: 14,
        height: 14,
        offsetX: 1,
        offsetY: 1,
      }),
    ).toEqual({ ok: true });

    expect((projectData.floor('sample1').value().changeFloor?.['0,0'] as { loc: number[] }).loc).toEqual([3, 4]);
    expect((projectData.tower().value().firstData.hero as { loc: unknown }).loc).toEqual({
      x: 2,
      y: 3,
      direction: 'up',
    });

    await operationHistory.undo();
    expect((projectData.floor('sample1').value().changeFloor?.['0,0'] as { loc: number[] }).loc).toEqual([2, 3]);
    expect((projectData.tower().value().firstData.hero as { loc: unknown }).loc).toEqual({
      x: 1,
      y: 2,
      direction: 'up',
    });
  });

  it("refuses to delete the project's final floor", async () => {
    await project.loadResource(projectData.tower());
    await project.loadResource(projectData.floor('sample0'));
    await projectData.tower().mutate((draft) => {
      draft.main.floorIds = ['sample0'];
      draft.main.floorPartitions = [];
      draft.firstData.floorId = 'sample0';
    });

    expect(await floorCommands.delete('sample0')).toMatchObject({
      ok: false,
      stage: 'update-floorIds',
    });
    expect(project.hasFile('project/floors/sample0.js')).toBe(true);
    expect(projectData.tower().value().firstData.floorId).toBe('sample0');
  });

  it('paints a repeating tileset pattern as one undoable command', async () => {
    await project.loadResource(projectData.floor('sample0'));
    const positions = [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 4, y: 1 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 4, y: 2 },
    ];
    const before = positions.map(({ x, y }) => projectData.floor('sample0').value().map[y][x]);

    const result = await mapCommands.paintPattern({
      floorId: 'sample0',
      targetPositions: positions,
      anchor: { x: 1, y: 1 },
      tileset: {
        startIdnum: 10000,
        sourceX: 2,
        sourceY: 3,
        width: 2,
        height: 2,
        columns: 10,
        rows: 10,
      },
    });

    expect(result).toEqual({ ok: true });
    expect(projectData.floor('sample0').value().map[1].slice(1, 5)).toEqual([10032, 10033, 10032, 10033]);
    expect(projectData.floor('sample0').value().map[2].slice(1, 5)).toEqual([10042, 10043, 10042, 10043]);
    await operationHistory.undo();
    expect(positions.map(({ x, y }) => projectData.floor('sample0').value().map[y][x])).toEqual(before);
    await operationHistory.redo();
    expect(projectData.floor('sample0').value().map[1].slice(1, 5)).toEqual([10032, 10033, 10032, 10033]);
  });

  it('copies and clears a rectangular map area with events', async () => {
    await project.loadResource(projectData.floor('sample0'));
    await floorCommands.patch('sample0', [
      ['change', "['map']['1']['1']", 21],
      ['change', "['map']['1']['2']", 22],
      ['change', "['events']['1,1']", [{ type: 'comment', text: 'area' }]],
    ]);
    const floor = projectData.floor('sample0').value() as unknown as Record<string, unknown>;
    const copied = readMapInfo(floor, 'map', { x0: 2, y0: 1, x1: 1, y1: 1 });
    expect(copied).toMatchObject({ w: 2, h: 1, layer: 'map' });
    expect(copied.data?.map((cell) => cell.map)).toEqual([21, 22]);
    expect(copied.data?.[0]?.events.events).toEqual([{ type: 'comment', text: 'area' }]);

    const result = await mapCommands.clearArea('sample0', 'map', { x0: 1, y0: 1, x1: 2, y1: 1 });
    expect(result).toEqual({ ok: true });
    expect(projectData.floor('sample0').value().map[1].slice(1, 3)).toEqual([0, 0]);
    expect(projectData.floor('sample0').value().events?.['1,1']).toBeUndefined();
  });
});
