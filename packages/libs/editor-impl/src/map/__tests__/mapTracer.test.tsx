import { act, cleanup, configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EditorCore, IEditorPanel, IEditorPanelFactoryParam } from '@motajs/editor-core';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMapPanelType, MAP_PANEL_TYPE_ID, MapPanel } from '..';
import { applyCellChanges } from '../model/document';
import { IMapDataSection, IMapDocument, IMapEditorCapabilities, IMapRenderModel } from '../types';
import { createMapDocument, createMapHarness, createTileGroup, FakeFileSystem } from './fixtures';

vi.mock('../components/MapSurface', async () => {
  const { createElement: createMockElement } = await import('react');

  return {
    MapSurface: (props: { model: IMapRenderModel }) =>
      createMockElement('div', {
        'data-test-id': 'map-surface-stub',
        'data-cell-count': String(props.model.cells.length),
      }),
  };
});

configure({ testIdAttribute: 'data-test-id' });

// jsdom 不实现 blob 地址，这里用可断言的替身；每个用例前重设实现，避免 restoreAllMocks 把它清空
const createObjectUrl = vi.fn((_blob: Blob): string => 'blob:map-test');

Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: createObjectUrl });
Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: vi.fn() });

interface IOpenResult {
  /** 已初始化的编辑器核心 */
  readonly system: EditorCore;
  /** 被捕获的地图面板实例 */
  readonly panel: MapPanel;
  /** 注入的内存文件系统，便于用例预置图片与统计读取次数 */
  readonly fs: FakeFileSystem;
}

/**
 * 造一张所有格子都为 0 的地图，便于断言落笔前后的变化
 * @param overrides 覆盖文档字段
 * @returns 空格子的中立文档
 */
function createEmptyDocument(overrides: Partial<IMapDocument> = {}): IMapDocument {
  const base = createMapDocument({ id: 'm1', name: '地图一', ...overrides });
  const layers = base.layers.map((layer) => ({
    ...layer,
    cells: layer.cells.map((row) => row.map(() => 0)),
  }));

  return { ...base, layers };
}

/**
 * 造一份只实现打开与保存的地图能力
 * @param document 打开时返回的文档
 * @param saveMapData 保存实现
 * @returns 地图能力注入面
 */
function createCapabilities(
  document: IMapDocument,
  saveMapData: (data: IMapDataSection) => Promise<void> = async (): Promise<void> => {},
): IMapEditorCapabilities {
  return {
    listMaps: async () => [{ id: document.id, name: document.name }],
    openMap: async () => document,
    saveMapData,
  };
}

/**
 * 装配核心、注册带实例捕获的地图面板类型，并按打开参数打开面板
 * @param capabilities 地图能力注入面
 * @param fs 注入的内存文件系统；缺省时新建一个空文件系统
 * @returns 核心、面板实例与所用的文件系统
 */
async function openMapPanel(
  capabilities: IMapEditorCapabilities,
  fs: FakeFileSystem = new FakeFileSystem(),
): Promise<IOpenResult> {
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
 * 在画布左上角第一个格子上按下左键
 */
async function paintFirstCell(): Promise<void> {
  await act(async () => {
    // jsdom 没有 PointerEvent；用带坐标与按键的 MouseEvent 触发同一个 pointerdown 监听
    fireEvent(
      screen.getByTestId('map-canvas'),
      new MouseEvent('pointerdown', { bubbles: true, cancelable: true, clientX: 4, clientY: 4, button: 0 }),
    );
  });
}

/**
 * 点保存按钮并等异步保存走完
 */
async function savePanel(): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByTestId('map-save'));
    await Promise.resolve();
  });
}

beforeEach(() => {
  createObjectUrl.mockClear();
  createObjectUrl.mockImplementation((_blob: Blob): string => 'blob:map-test');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('地图 tracer：宿主 → 面板 → 画布 → 落笔 → 宿主', () => {
  // 宿主注入的地图能在真实外壳里打开，状态走到就绪，画布拿到大于 0 的格子
  it('打开宿主注入的地图后画布渲染出格子', async () => {
    const { system } = await openMapPanel(createCapabilities(createEmptyDocument()));

    render(createElement(system.shellSystem.render()));
    await act(async () => {});

    expect(screen.getByTestId('map-panel').getAttribute('data-status')).toBe('ready');
    expect(Number(screen.getByTestId('map-surface-stub').getAttribute('data-cell-count'))).toBeGreaterThan(0);
  });

  // 左键落笔后出现「未保存」标记，且保存按钮从禁用变为可用
  it('左键落笔后出现未保存标记', async () => {
    const { system } = await openMapPanel(createCapabilities(createEmptyDocument()));

    render(createElement(system.shellSystem.render()));
    await act(async () => {});
    await paintFirstCell();

    expect(screen.queryByTestId('map-unsaved')).not.toBeNull();
    expect(screen.getByTestId('map-save').hasAttribute('disabled')).toBe(false);
  });

  // 保存交回的是整份数据域：标识、宽高与完整图层数组；保存成功后未保存标记消失
  it('保存把整份地图数据域交回宿主并清掉未保存标记', async () => {
    const mapDocument = createEmptyDocument();
    const saveMapData = vi.fn(async (_data: IMapDataSection): Promise<void> => {});
    const { system } = await openMapPanel(createCapabilities(mapDocument, saveMapData));

    render(createElement(system.shellSystem.render()));
    await act(async () => {});
    await paintFirstCell();
    await savePanel();

    expect(saveMapData).toHaveBeenCalledTimes(1);

    const payload = saveMapData.mock.calls[0][0];
    const expected = applyCellChanges(mapDocument, 'layer-base', [{ x: 0, y: 0, before: 0, after: 1 }]);

    expect(payload).toEqual({
      id: expected.id,
      width: expected.width,
      height: expected.height,
      layers: expected.layers,
    });
    expect(payload.layers).toHaveLength(2);
    expect(screen.queryByTestId('map-unsaved')).toBeNull();
    expect(screen.getByTestId('map-notice').textContent).toContain('已保存');
  });

  // 保存失败时把宿主错误按纯文本显示，内存改动与未保存标记都保留
  it('保存失败时显示纯文本错误并保留未保存标记', async () => {
    const saveMapData = vi.fn(async (_data: IMapDataSection): Promise<void> => {
      throw new Error('磁盘已满');
    });
    const { system } = await openMapPanel(createCapabilities(createEmptyDocument(), saveMapData));

    render(createElement(system.shellSystem.render()));
    await act(async () => {});
    await paintFirstCell();
    await savePanel();

    expect(screen.getByTestId('map-notice').textContent).toContain('保存失败：磁盘已满');
    expect(screen.queryByTestId('map-unsaved')).not.toBeNull();
  });

  // 图块目录为空时左键不改文档、不置脏、不登记撤销
  it('图块目录为空时拒绝落笔且不登记撤销', async () => {
    const saveMapData = vi.fn(async (_data: IMapDataSection): Promise<void> => {});
    const { system, panel } = await openMapPanel(
      createCapabilities(createEmptyDocument({ tileGroups: [] }), saveMapData),
    );
    const addUndo = vi.spyOn(system.undoSystem, 'addUndoContext');

    render(createElement(system.shellSystem.render()));
    await act(async () => {});
    await paintFirstCell();

    expect(screen.queryByTestId('map-unsaved')).toBeNull();
    expect(screen.getByTestId('map-save').hasAttribute('disabled')).toBe(true);

    let saved = false;

    await act(async () => {
      saved = await panel.save();
    });

    expect(saved).toBe(true);
    expect(saveMapData).not.toHaveBeenCalled();
    expect(addUndo).not.toHaveBeenCalled();
  });

  // 图块图片读不到只影响画布上的格子，不会把面板判成加载失败
  it('图块图片读不到时面板仍然是就绪态', async () => {
    const mapDocument = createEmptyDocument({
      tileGroups: [createTileGroup({ imagePath: 'content/map/missing.png' })],
    });
    const { system } = await openMapPanel(createCapabilities(mapDocument));

    render(createElement(system.shellSystem.render()));
    await act(async () => {});

    expect(screen.getByTestId('map-panel').getAttribute('data-status')).toBe('ready');
    expect(screen.getByTestId('map-surface-stub')).not.toBeNull();
  });
});

describe('图块图片重试：真的重读字节并递增地址版本', () => {
  // 首次读不到图片时记失败；补上文件后点重试会重新请求字节、建出新地址并递增发布代次
  it('点重试会再次读取字节并递增地址版本', async () => {
    const fs = new FakeFileSystem();
    const readBinary = vi.spyOn(fs, 'readBinary');
    const { system, panel } = await openMapPanel(createCapabilities(createEmptyDocument()), fs);

    render(createElement(system.shellSystem.render()));
    await act(async () => {});

    const readsBefore = readBinary.mock.calls.length;
    const versionBefore = panel['store'].state.tileImageSourcesVersion ?? 0;
    const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);

    fs.seed('content/map/tiles-a.png', png);
    fs.seed('content/map/tiles-b.png', png);

    await act(async () => {
      panel.reloadTileImages();
    });
    await waitFor(() => expect(readBinary.mock.calls.length).toBeGreaterThan(readsBefore));

    expect(panel['store'].state.tileImageSourcesVersion).toBeGreaterThan(versionBefore);
    expect(panel['store'].state.tileImageSources?.urls['content/map/tiles-a.png']).toBe('blob:map-test');
    expect(createObjectUrl).toHaveBeenCalledTimes(2);
  });
});
