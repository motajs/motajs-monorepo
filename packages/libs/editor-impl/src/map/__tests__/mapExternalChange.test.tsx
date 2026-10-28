import { act, cleanup, configure, render, screen, waitFor } from '@testing-library/react';
import { EditorCore, EditorFileChangeKind, IEditorPanel, IEditorPanelFactoryParam } from '@motajs/editor-core';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMapPanelType, MAP_PANEL_TYPE_ID, MapPanel } from '..';
import { MAP_TILE_PREFS_PATH } from '../constants';
import { IMapDataSection, IMapDocument, IMapEditorCapabilities, IMapSummary } from '../types';
import { createMapDocument, createMapHarness, FakeFileSystem } from './fixtures';

// 地图面板的三类外部变化：地图文件 / 图块图片 / 偏好文件各有各的处理，无关路径什么都不做。
// 这里直接投递 IEditorPanel.onResourceChange（路径合法性与索引维护由 core 的既有用例覆盖），
// 因此每条用例都能精确断言「文档有没有换、地址版本有没有动、冲突框有没有出现」。

configure({ testIdAttribute: 'data-test-id' });

/** 当前地图在宿主里的文件路径 */
const MAP_FILE_PATH = 'content/map/m1.json';

/** 第一张图块图片的路径 */
const MAP_IMAGE_A = 'content/map/tiles-a.png';

/** 第二张图块图片的路径 */
const MAP_IMAGE_B = 'content/map/tiles-b.png';

/** 每建一个地址就递增的序号，保证每次拿到的地址字符串不同 */
let sequence = 0;

/** `URL.createObjectURL` 的可断言替身 */
const createObjectUrl = vi.fn((_blob: Blob): string => {
  sequence += 1;
  return `blob:map-external-${sequence}`;
});

/** `URL.revokeObjectURL` 的可断言替身 */
const revokeObjectUrl = vi.fn((_url: string): void => {});

Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: createObjectUrl });
Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: revokeObjectUrl });

/** 已装配好的面板与文件系统 */
interface IHarness {
  /** 已初始化的编辑器核心 */
  readonly system: EditorCore;
  /** 被捕获的地图面板实例 */
  readonly panel: MapPanel;
  /** 注入的内存文件系统 */
  readonly fs: FakeFileSystem;
}

/**
 * 造一张所有格子都为 0 的地图，便于断言文档是否被替换
 * @returns 空格子的中立文档
 */
function createEmptyDocument(): IMapDocument {
  const base = createMapDocument({ id: 'm1', name: '地图一' });
  const layers = base.layers.map((layer) => ({
    ...layer,
    cells: layer.cells.map((row) => row.map(() => 0)),
  }));

  return { ...base, layers };
}

/**
 * 造一份地图能力：每次打开都取当前宿主内容，`resolveMapPath` 只认本图文件
 * @param current 取当前宿主文档的回调
 * @param saveMapData 保存实现
 * @returns 地图能力注入面
 */
function createCapabilities(
  current: () => IMapDocument,
  saveMapData: (data: IMapDataSection) => Promise<void> = async (): Promise<void> => {},
): IMapEditorCapabilities {
  return {
    listMaps: async (): Promise<readonly IMapSummary[]> => [{ id: 'm1', name: '地图一' }],
    openMap: async (): Promise<IMapDocument> => current(),
    saveMapData,
    resolveMapPath: (path: string): string | null => (path === MAP_FILE_PATH ? 'm1' : null),
  };
}

/**
 * 装配核心、注册带实例捕获的地图面板类型，并按打开参数打开首张地图
 * @param fs 注入的内存文件系统
 * @param capabilities 地图能力注入面
 * @returns 核心、面板实例与文件系统
 */
async function openPanel(fs: FakeFileSystem, capabilities: IMapEditorCapabilities): Promise<IHarness> {
  const system = await createMapHarness(fs);
  const panels: MapPanel[] = [];
  const type = createMapPanelType(capabilities);

  system.shellSystem.registerPanelType({
    id: type.id,
    name: type.name,
    icon: type.icon,
    create: (param: IEditorPanelFactoryParam): IEditorPanel => {
      const panel = type.create(param);

      if (panel instanceof MapPanel) panels.push(panel);
      return panel;
    },
  });

  const tabId = system.shellSystem.listTabs()[0].id;

  await act(async () => {
    await system.shellSystem.openPanelInTab(tabId, MAP_PANEL_TYPE_ID, { target: { mapId: 'm1' } });
  });
  await act(async () => {});

  return { system, panel: panels[0], fs };
}

/**
 * 投递一次外部变化：先让资源层失效缓存（真实宿主在变化事件里做同一件事），再交给面板
 * @param harness 面板装配结果
 * @param path 变化路径
 * @param kind 变化种类
 * @returns 处理完成的异步结果
 */
async function dispatchChange(
  harness: IHarness,
  path: string,
  kind: EditorFileChangeKind = EditorFileChangeKind.Change,
): Promise<void> {
  await harness.system.resourceSystem.updateResource(path);
  await act(async () => {
    await harness.panel.onResourceChange(path, kind);
  });
}

beforeEach(() => {
  sequence = 0;
  createObjectUrl.mockClear();
  revokeObjectUrl.mockClear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('地图面板：三类外部变化', () => {
  // 替换一张图块图片只重建地址表：地址换新、版本递增，文档与撤销都不动
  it('图块图片变化只重建地址表', async () => {
    const fs = new FakeFileSystem();

    fs.seed(MAP_IMAGE_A, Uint8Array.from([1, 2, 3]));
    fs.seed(MAP_IMAGE_B, Uint8Array.from([4, 5]));

    const document = createEmptyDocument();
    const harness = await openPanel(
      fs,
      createCapabilities(() => document),
    );

    render(createElement(harness.system.shellSystem.render()));
    await act(async () => {});

    const versionBefore = harness.panel['store'].state.tileImageSourcesVersion ?? 0;
    const urlBefore = harness.panel['store'].state.tileImageSources?.urls[MAP_IMAGE_A];
    const documentBefore = harness.panel['store'].state.document;
    const addUndo = vi.spyOn(harness.system.undoSystem, 'addUndoContext');

    fs.seed(MAP_IMAGE_A, Uint8Array.from([9, 9, 9]));
    await dispatchChange(harness, MAP_IMAGE_A);

    expect(harness.panel['store'].state.tileImageSourcesVersion).toBeGreaterThan(versionBefore);
    expect(harness.panel['store'].state.tileImageSources?.urls[MAP_IMAGE_A]).not.toBe(urlBefore);
    expect(harness.panel['store'].state.document).toBe(documentBefore);
    expect(addUndo).not.toHaveBeenCalled();
    expect(screen.queryByTestId('panel-conflict-dialog')).toBeNull();
  });

  // 与当前地图无关的路径：不读字节、不换文档、不动地址版本
  it('无关路径零副作用', async () => {
    const fs = new FakeFileSystem();

    fs.seed(MAP_IMAGE_A, Uint8Array.from([1]));
    fs.seed(MAP_IMAGE_B, Uint8Array.from([2]));

    const document = createEmptyDocument();
    const harness = await openPanel(
      fs,
      createCapabilities(() => document),
    );

    render(createElement(harness.system.shellSystem.render()));
    await act(async () => {});

    const versionBefore = harness.panel['store'].state.tileImageSourcesVersion ?? 0;
    const documentBefore = harness.panel['store'].state.document;
    const readBinary = vi.spyOn(fs, 'readBinary');

    await dispatchChange(harness, 'content/map/unrelated.txt');

    expect(readBinary).not.toHaveBeenCalled();
    expect(harness.panel['store'].state.tileImageSourcesVersion).toBe(versionBefore);
    expect(harness.panel['store'].state.document).toBe(documentBefore);
  });

  // 偏好文件变化：最近使用按最新文件内容重读
  it('偏好文件变化重读最近使用', async () => {
    const fs = new FakeFileSystem();

    fs.seed(MAP_TILE_PREFS_PATH, JSON.stringify({ recent: [1], frequent: {}, favorites: [] }));
    fs.seed(MAP_IMAGE_A, Uint8Array.from([1]));
    fs.seed(MAP_IMAGE_B, Uint8Array.from([2]));

    const document = createEmptyDocument();
    const harness = await openPanel(
      fs,
      createCapabilities(() => document),
    );

    render(createElement(harness.system.shellSystem.render()));
    await act(async () => {});
    await waitFor(() => expect(harness.panel['store'].state.recentTiles).toEqual([1]));

    fs.seed(MAP_TILE_PREFS_PATH, JSON.stringify({ recent: [2], frequent: {}, favorites: [] }));
    await dispatchChange(harness, MAP_TILE_PREFS_PATH);

    await waitFor(() => expect(harness.panel['store'].state.recentTiles).toEqual([2]));
  });

  // 同一条事件投递两次只处理一次：地址版本只涨一次
  it('同一条事件只处理一次', async () => {
    const fs = new FakeFileSystem();

    fs.seed(MAP_IMAGE_A, Uint8Array.from([1, 2]));
    fs.seed(MAP_IMAGE_B, Uint8Array.from([3]));

    const document = createEmptyDocument();
    const harness = await openPanel(
      fs,
      createCapabilities(() => document),
    );

    render(createElement(harness.system.shellSystem.render()));
    await act(async () => {});

    await dispatchChange(harness, MAP_IMAGE_A);

    const versionAfterFirst = harness.panel['store'].state.tileImageSourcesVersion ?? 0;

    await dispatchChange(harness, MAP_IMAGE_A);

    expect(harness.panel['store'].state.tileImageSourcesVersion).toBe(versionAfterFirst);
  });

  // 地图文件变化且不脏：静默重读文档、重置基线，不弹冲突框
  it('地图文件变化且不脏时更新文档', async () => {
    const fs = new FakeFileSystem();

    fs.seed(MAP_FILE_PATH, JSON.stringify({ name: '地图一' }));
    fs.seed(MAP_IMAGE_A, Uint8Array.from([1]));
    fs.seed(MAP_IMAGE_B, Uint8Array.from([2]));

    let current = createEmptyDocument();
    const harness = await openPanel(
      fs,
      createCapabilities(() => current),
    );

    render(createElement(harness.system.shellSystem.render()));
    await act(async () => {});

    const documentBefore = harness.panel['store'].state.document;

    current = { ...createEmptyDocument(), name: '外部改名' };
    fs.seed(MAP_FILE_PATH, JSON.stringify({ name: '外部改名' }));
    await dispatchChange(harness, MAP_FILE_PATH);

    expect(harness.panel['store'].state.document).not.toBe(documentBefore);
    expect(harness.panel['store'].state.document?.name).toBe('外部改名');
    expect(harness.panel['store'].state.unsaved).toBe(false);
    expect(screen.queryByTestId('panel-conflict-dialog')).toBeNull();
  });

  // 地图文件变化但内存有改动：文档不换、冲突框出现在 DOM 里
  it('地图文件变化且脏时弹冲突框', async () => {
    const fs = new FakeFileSystem();

    fs.seed(MAP_FILE_PATH, JSON.stringify({ name: '地图一' }));
    fs.seed(MAP_IMAGE_A, Uint8Array.from([1]));
    fs.seed(MAP_IMAGE_B, Uint8Array.from([2]));

    let current = createEmptyDocument();
    const harness = await openPanel(
      fs,
      createCapabilities(() => current),
    );

    render(createElement(harness.system.shellSystem.render()));
    await act(async () => {});

    harness.panel.commitCells('layer-base', [{ x: 0, y: 0, value: 1 }]);

    const documentBefore = harness.panel['store'].state.document;

    current = { ...createEmptyDocument(), name: '外部改名' };
    fs.seed(MAP_FILE_PATH, JSON.stringify({ name: '外部改名' }));
    await dispatchChange(harness, MAP_FILE_PATH);

    expect(harness.panel['store'].state.document).toBe(documentBefore);
    expect(harness.panel['store'].state.pendingConflict?.path).toBe(MAP_FILE_PATH);
    expect(screen.queryByTestId('panel-conflict-dialog')).not.toBeNull();
  });
});
