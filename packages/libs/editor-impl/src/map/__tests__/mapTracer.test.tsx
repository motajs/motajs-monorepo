import { act, cleanup, configure, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { EditorCore, IEditorPanel, IEditorPanelFactoryParam } from '@motajs/editor-core';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMapPanelType, MAP_PANEL_TYPE_ID, MapPanel } from '..';
import { useMapObjectUrl } from '../components/useMapObjectUrl';
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
 * @returns 核心与面板实例
 */
async function openMapPanel(capabilities: IMapEditorCapabilities): Promise<IOpenResult> {
  const fs = new FakeFileSystem();
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

  return { system, panel: panels[0] };
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

describe('useMapObjectUrl：图片路径 → 资源层字节 → blob 地址', () => {
  // 合法路径读出字节后生成对应 MIME 的 blob 地址
  it('把资源层字节变成 blob 地址', async () => {
    const fs = new FakeFileSystem();
    const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);

    fs.seed('content/map/tiles-a.png', png);

    const loadBytes = async (path: string): Promise<Uint8Array | undefined> => {
      try {
        return await fs.readBinary(path);
      } catch {
        return undefined;
      }
    };
    const hook = renderHook(() =>
      useMapObjectUrl({ path: 'content/map/tiles-a.png', mime: 'image/png', version: 0, loadBytes }),
    );

    await waitFor(() => {
      expect(hook.result.current).toBe('blob:map-test');
    });

    expect(createObjectUrl).toHaveBeenCalledTimes(1);
    expect(createObjectUrl.mock.calls[0][0].type).toBe('image/png');
    expect(createObjectUrl.mock.calls[0][0].size).toBe(png.length);
  });

  // 绝对路径与含 `..` 的路径被守卫拒绝，资源层一次都不被请求
  it('拒绝绝对路径与含 .. 的路径且不请求资源层', async () => {
    const loadBytes = vi.fn(async (_path: string): Promise<Uint8Array | undefined> => Uint8Array.from([1]));
    const absolute = renderHook(() =>
      useMapObjectUrl({ path: '/etc/a.png', mime: 'image/png', version: 0, loadBytes }),
    );
    const relative = renderHook(() =>
      useMapObjectUrl({ path: 'content/../../a.png', mime: 'image/png', version: 0, loadBytes }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(loadBytes).not.toHaveBeenCalled();
    expect(createObjectUrl).not.toHaveBeenCalled();
    expect(absolute.result.current).toBeUndefined();
    expect(relative.result.current).toBeUndefined();
  });

  // 字节读取失败时 hook 保持 undefined，不抛错也不生成地址
  it('字节读取失败时返回 undefined 而不抛错', async () => {
    const loadBytes = vi.fn(async (_path: string): Promise<Uint8Array | undefined> => {
      throw new Error('读取失败');
    });
    const hook = renderHook(() =>
      useMapObjectUrl({ path: 'content/map/tiles-a.png', mime: 'image/png', version: 0, loadBytes }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(hook.result.current).toBeUndefined();
    expect(createObjectUrl).not.toHaveBeenCalled();
  });
});
