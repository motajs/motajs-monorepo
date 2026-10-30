import { act, cleanup, configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EditorCore, IEditorPanel, IEditorPanelFactoryParam } from '@motajs/editor-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMapPanelType, MAP_PANEL_TYPE_ID, MapPanel } from '..';
import { MapLayerDialog, MapNewDialog } from '../components/dialogs';
import { MAP_RECENT_TILES_PATH, MAP_TILE_PREFS_PATH } from '../constants';
import {
  IMapDataSection,
  IMapDocument,
  IMapEditorCapabilities,
  IMapPanelViewState,
  IMapSummary,
  IMapTileGroup,
  MapDialogKind,
  MapImageStatus,
  MapPaletteKind,
  MapTileCategory,
} from '../types';
import { createMapDocument, createMapHarness, createTileGroup, FakeFileSystem } from './fixtures';

configure({ testIdAttribute: 'data-test-id' });

// 弹窗与面板数据层测试：新建地图 / 新增图层 / 未保存确认 / 最近使用。
// 弹窗按受控组件直接渲染；面板侧经真实 EditorCore 装配，撤销与资源层都与生产路径一致。

interface IHarness {
  /** 已初始化的编辑器核心 */
  readonly system: EditorCore;
  /** 被捕获的地图面板实例 */
  readonly panel: MapPanel;
  /** 注入的内存文件系统，供最近使用用例预置与读取文件 */
  readonly fileSystem: FakeFileSystem;
}

interface IDeferred<T> {
  /** 待兑现的 promise */
  readonly promise: Promise<T>;
  /** 兑现结果 */
  readonly resolve: (value: T) => void;
}

/**
 * 造一个可手动兑现的 promise，用于测提交中的语义
 * @returns 延迟兑现的 promise 与其兑现函数
 */
function createDeferred<T>(): IDeferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });

  return { promise, resolve };
}

/**
 * 造一张所有格子都为 0 的地图，便于断言落笔前后的变化
 * @param mapId 地图标识
 * @returns 空格子的中立文档
 */
function createEmptyDocument(mapId: string): IMapDocument {
  const base = createMapDocument({ id: mapId, name: mapId });
  const layers = base.layers.map((layer) => ({
    ...layer,
    cells: layer.cells.map((row) => row.map(() => 0)),
  }));

  return { ...base, layers };
}

/**
 * 造一份默认可用、可按用例覆盖个别回调的地图能力
 * @param overrides 覆盖能力实现
 * @returns 地图能力注入面
 */
function createCapabilities(overrides: Partial<IMapEditorCapabilities> = {}): IMapEditorCapabilities {
  const summaries: readonly IMapSummary[] = [
    { id: 'm1', name: '地图一' },
    { id: 'm2', name: '地图二' },
  ];

  return {
    listMaps: async (): Promise<readonly IMapSummary[]> => summaries,
    openMap: async (mapId: string): Promise<IMapDocument> => createEmptyDocument(mapId),
    saveMapData: async (): Promise<void> => {},
    ...overrides,
  };
}

/**
 * 装配核心、注册带实例捕获的地图面板类型，并按打开参数打开首张地图
 * @param capabilities 地图能力注入面
 * @param fileSystem 注入的内存文件系统；缺省时新建一个
 * @returns 核心、面板实例与文件系统
 */
async function openMapPanel(
  capabilities: IMapEditorCapabilities,
  fileSystem: FakeFileSystem = new FakeFileSystem(),
): Promise<IHarness> {
  const system = await createMapHarness(fileSystem);
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

  await system.shellSystem.openPanelInTab(tabId, MAP_PANEL_TYPE_ID, { target: { mapId: 'm1' } });

  return { system, panel: panels[0], fileSystem };
}

/**
 * 读取面板发布出去的视图状态；测试借此观察状态，不改任何私有字段
 * @param panel 地图面板实例
 * @returns 当前视图状态
 */
function viewState(panel: MapPanel): IMapPanelViewState {
  return panel['store'].state;
}

/**
 * 等待落笔触发的偏好写盘走完，再读回 `.editor/map-tiles.json` 的内容
 * @param fileSystem 内存文件系统
 * @returns 解析后的偏好文件内容
 */
async function readPreferencesFile(fileSystem: FakeFileSystem): Promise<unknown> {
  const text = await fileSystem.readFile(MAP_TILE_PREFS_PATH);

  return JSON.parse(text);
}

/**
 * 造一个只含 Tileset 分类组的图块分组，编号 101..104
 * @returns Tileset 分类的图块分组
 */
function createTilesetGroup(): IMapTileGroup {
  const base = createTileGroup({ id: 'group-tileset', name: '整图', imagePath: 'content/map/tileset.png' });
  const tiles = base.tiles.map((tile, index) => ({ ...tile, number: 101 + index }));

  return { ...base, tiles, category: MapTileCategory.Tileset };
}

/**
 * 造一张除普通图块外还带 Tileset 分类组的地图
 * @param mapId 地图标识
 * @returns 带 Tileset 分类组的空格子文档
 */
function createTilesetDocument(mapId: string): IMapDocument {
  const base = createEmptyDocument(mapId);

  return { ...base, tileGroups: [...base.tileGroups, createTilesetGroup()] };
}

/**
 * 画一格，让面板进入有未保存改动的状态
 * @param panel 地图面板实例
 */
function paintOneCell(panel: MapPanel): void {
  panel.commitCells('layer-base', [{ x: 0, y: 0, value: 1 }]);
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('新建地图弹窗', () => {
  // 打开时名称空、宽高 32、初始图层名「图层 1」，无上限时只显示单位提示
  it('打开时按默认值渲染，无上限时只显示单位提示', () => {
    render(<MapNewDialog open existingNames={[]} onSubmit={async (): Promise<void> => {}} onCancel={(): void => {}} />);

    expect(screen.getByTestId<HTMLInputElement>('map-new-name').value).toBe('');
    expect(screen.getByTestId<HTMLInputElement>('map-new-width').value).toBe('32');
    expect(screen.getByTestId<HTMLInputElement>('map-new-height').value).toBe('32');
    expect(screen.getByTestId<HTMLInputElement>('map-new-layer').value).toBe('图层 1');
    expect(screen.getByTestId('map-new-size-hint').textContent).toContain('宽高以格子为单位。');
    expect(screen.getByTestId('map-new-size-hint').textContent).not.toContain('最大');
  });

  // 宿主给了上限时提示追加「最大 64 × 48。」，两个数字框也带上对应上限
  it('宿主给了上限时追加最大尺寸提示', () => {
    render(
      <MapNewDialog
        open
        maxSize={{ maxWidth: 64, maxHeight: 48 }}
        existingNames={[]}
        onSubmit={async (): Promise<void> => {}}
        onCancel={(): void => {}}
      />,
    );

    expect(screen.getByTestId('map-new-size-hint').textContent).toContain('宽高以格子为单位。最大 64 × 48。');
    expect(screen.getByTestId('map-new-width').getAttribute('aria-valuemax')).toBe('64');
    expect(screen.getByTestId('map-new-height').getAttribute('aria-valuemax')).toBe('48');
  });

  // 提交中两个按钮都禁用并显示「正在创建…」，弹窗保持打开
  it('提交中禁用按钮并显示进度，弹窗不关闭', async () => {
    const deferred = createDeferred<void>();

    render(
      <MapNewDialog
        open
        existingNames={[]}
        onSubmit={(): Promise<void> => deferred.promise}
        onCancel={(): void => {}}
      />,
    );

    fireEvent.change(screen.getByTestId('map-new-name'), { target: { value: '新图' } });

    await act(async () => {
      fireEvent.click(screen.getByTestId('map-new-submit'));
    });

    expect(screen.getByTestId<HTMLButtonElement>('map-new-submit').disabled).toBe(true);
    expect(screen.getByTestId<HTMLButtonElement>('map-new-cancel').disabled).toBe(true);
    expect(screen.queryByText('正在创建…')).not.toBeNull();
    expect(screen.queryByTestId('map-new-dialog')).not.toBeNull();

    await act(async () => {
      deferred.resolve();
      await deferred.promise;
    });

    expect(screen.getByTestId<HTMLButtonElement>('map-new-submit').disabled).toBe(false);
  });

  // 字段错误逐项行内显示，且不会调用提交
  it('字段错误行内显示且不提交', async () => {
    const onSubmit = vi.fn(async (): Promise<void> => {});

    render(<MapNewDialog open existingNames={['地图一']} onSubmit={onSubmit} onCancel={(): void => {}} />);

    const widthInput = screen.getByTestId('map-new-width');

    fireEvent.change(widthInput, { target: { value: '1.5' } });
    fireEvent.blur(widthInput);
    fireEvent.change(screen.getByTestId('map-new-layer'), { target: { value: '  ' } });

    await act(async () => {
      fireEvent.click(screen.getByTestId('map-new-submit'));
    });

    expect(screen.getByTestId('map-new-name-error').textContent).toContain('请输入地图名称。');
    expect(screen.getByTestId('map-new-size-error').textContent).toContain('宽度必须是正整数。');
    expect(screen.getByTestId('map-new-layer-error').textContent).toContain('请输入图层名称。');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  // 宿主失败原因显示在弹窗内，按钮保持可用
  it('宿主失败原因显示在弹窗内且按钮可用', () => {
    render(
      <MapNewDialog
        open
        existingNames={[]}
        error="磁盘已满"
        onSubmit={async (): Promise<void> => {}}
        onCancel={(): void => {}}
      />,
    );

    expect(screen.getByTestId('map-new-error').textContent).toContain('磁盘已满');
    expect(screen.getByTestId<HTMLButtonElement>('map-new-submit').disabled).toBe(false);
  });

  // 点「取消」只把关闭意图交回面板
  it('点取消把关闭意图交回面板', () => {
    const onCancel = vi.fn();

    render(<MapNewDialog open existingNames={[]} onSubmit={async (): Promise<void> => {}} onCancel={onCancel} />);

    fireEvent.click(screen.getByTestId('map-new-cancel'));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('新增图层弹窗', () => {
  // 打开时按「现有层数 + 1」预填并聚焦全选
  it('打开时预填「图层 N」并聚焦全选', async () => {
    render(
      <MapLayerDialog
        open
        layerCount={2}
        existingNames={['基础层', '上层']}
        onSubmit={async (): Promise<void> => {}}
        onCancel={(): void => {}}
      />,
    );

    const input = screen.getByTestId<HTMLInputElement>('map-layer-name');

    expect(input.value).toBe('图层 3');
    await waitFor(() => expect(input.ownerDocument.activeElement).toBe(input));
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe('图层 3'.length);
  });

  // 提交中按钮禁用并显示「正在创建…」，弹窗保持打开
  it('提交中禁用按钮并显示进度，弹窗不关闭', async () => {
    const deferred = createDeferred<void>();

    render(
      <MapLayerDialog
        open
        layerCount={2}
        existingNames={['基础层', '上层']}
        onSubmit={(): Promise<void> => deferred.promise}
        onCancel={(): void => {}}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('map-layer-submit'));
    });

    expect(screen.getByTestId<HTMLButtonElement>('map-layer-submit').disabled).toBe(true);
    expect(screen.getByTestId<HTMLButtonElement>('map-layer-cancel').disabled).toBe(true);
    expect(screen.queryByText('正在创建…')).not.toBeNull();
    expect(screen.queryByTestId('map-layer-dialog')).not.toBeNull();

    await act(async () => {
      deferred.resolve();
      await deferred.promise;
    });
  });

  // 空名称与重名都行内显示，且不会调用提交
  it('空名称与重名都行内显示且不提交', async () => {
    const onSubmit = vi.fn(async (): Promise<void> => {});

    render(
      <MapLayerDialog
        open
        layerCount={2}
        existingNames={['基础层', '上层']}
        onSubmit={onSubmit}
        onCancel={(): void => {}}
      />,
    );

    fireEvent.change(screen.getByTestId('map-layer-name'), { target: { value: '  ' } });

    await act(async () => {
      fireEvent.click(screen.getByTestId('map-layer-submit'));
    });

    expect(screen.getByTestId('map-layer-name-error').textContent).toContain('请输入图层名称。');

    fireEvent.change(screen.getByTestId('map-layer-name'), { target: { value: '基础层' } });

    await act(async () => {
      fireEvent.click(screen.getByTestId('map-layer-submit'));
    });

    expect(screen.getByTestId('map-layer-name-error').textContent).toContain('图层名称已存在。');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  // 现有图层名不规范时默认名仍按层数生成，校验照常通过
  it('现有图层名不规范时仍生成默认名并可提交', async () => {
    const onSubmit = vi.fn(async (): Promise<void> => {});

    render(
      <MapLayerDialog open layerCount={2} existingNames={['', '  ']} onSubmit={onSubmit} onCancel={(): void => {}} />,
    );

    expect(screen.getByTestId<HTMLInputElement>('map-layer-name').value).toBe('图层 3');

    await act(async () => {
      fireEvent.click(screen.getByTestId('map-layer-submit'));
    });

    expect(onSubmit).toHaveBeenCalledWith('图层 3');
  });

  // 宿主失败原因显示在弹窗内，名称错误与宿主错误互不覆盖
  it('宿主失败原因显示在弹窗内', () => {
    render(
      <MapLayerDialog
        open
        layerCount={1}
        existingNames={[]}
        error="写入失败"
        onSubmit={async (): Promise<void> => {}}
        onCancel={(): void => {}}
      />,
    );

    expect(screen.getByTestId('map-layer-error').textContent).toContain('写入失败');
  });
});

describe('面板：新建地图与新增图层', () => {
  // 新建成功后打开新文档、当前层是初始图层、视口回左上角并登记屏障
  it('新建地图成功后打开新文档并登记屏障', async () => {
    const createMap = vi.fn(async (): Promise<IMapDocument> => createEmptyDocument('m-new'));
    const { system, panel } = await openMapPanel(createCapabilities({ createMap }));
    const addUndo = vi.spyOn(system.undoSystem, 'addUndoContext');

    panel.openDialog(MapDialogKind.New);
    await panel.createMap({ name: '新图', width: 32, height: 32, layerName: '第一层' });

    expect(createMap).toHaveBeenCalledWith({ name: '新图', width: 32, height: 32, layerName: '第一层' });
    expect(viewState(panel).document?.id).toBe('m-new');
    expect(viewState(panel).currentLayerId).toBe(viewState(panel).document?.layers[0].id);
    expect(viewState(panel).viewport).toEqual({ left: 0, top: 0 });
    expect(viewState(panel).dialog).toBe(MapDialogKind.None);
    expect(viewState(panel).unsaved).toBe(false);
    expect(panel.isDirty()).toBe(false);
    expect(addUndo.mock.calls.at(-1)?.[1]).toMatchObject({ barrier: true });
  });

  // 宿主没注入 createMap 时不调用任何能力、不抛错，只把提示放进弹窗错误
  it('宿主不支持新建地图时给出提示且不抛错', async () => {
    const { panel } = await openMapPanel(createCapabilities());

    panel.openDialog(MapDialogKind.New);
    await panel.createMap({ name: '新图', width: 32, height: 32, layerName: '第一层' });

    expect(viewState(panel).dialogError).toBe('当前项目不支持新建地图。');
    expect(viewState(panel).document?.id).toBe('m1');
  });

  // 新增图层成功后新层成为当前层，用户输入的层名写进文档并立刻写回宿主，且不置脏、不进撤销
  it('新增图层成功后新层成为当前层且名字写进文档', async () => {
    const addLayer = vi.fn(async (): Promise<IMapDocument> => {
      const base = createEmptyDocument('m1');
      const layer = {
        id: 'layer-new',
        name: '宿主默认名',
        zIndex: 2,
        isEventLayer: false,
        cells: base.layers[0].cells,
      };

      return { ...base, layers: [...base.layers, layer] };
    });
    const saveMapData = vi.fn(async (_data: IMapDataSection): Promise<void> => {});
    const { system, panel } = await openMapPanel(createCapabilities({ addLayer, saveMapData }));
    const addUndo = vi.spyOn(system.undoSystem, 'addUndoContext');

    panel.openDialog(MapDialogKind.Layer);
    await panel.addLayer('新图层');

    const document = viewState(panel).document;

    expect(addLayer).toHaveBeenCalledWith('m1');
    expect(document?.layers.at(-1)?.name).toBe('新图层');
    // 层名立刻落盘：载荷最后一层是用户起的名字，宿主默认名不许留在里边
    expect(saveMapData).toHaveBeenCalledTimes(1);
    expect(saveMapData.mock.calls[0][0].layers.at(-1)?.name).toBe('新图层');
    expect(saveMapData.mock.calls[0][0].layers.some((layer) => layer.name === '宿主默认名')).toBe(false);
    expect(viewState(panel).currentLayerId).toBe('layer-new');
    expect(viewState(panel).unsaved).toBe(false);
    expect(panel.isDirty()).toBe(false);
    expect(viewState(panel).dialog).toBe(MapDialogKind.None);
    expect(addUndo.mock.calls.at(-1)?.[1]).toMatchObject({ barrier: true });
  });

  // 宿主没注入 addLayer 时同上：只给提示
  it('宿主不支持新增图层时给出提示且不抛错', async () => {
    const { panel } = await openMapPanel(createCapabilities());

    panel.openDialog(MapDialogKind.Layer);
    await panel.addLayer('新图层');

    expect(viewState(panel).dialogError).toBe('当前项目不支持新增图层。');
    expect(viewState(panel).document?.layers).toHaveLength(2);
  });

  // 面板侧再校验一次，绕过弹窗也拒绝空名称且不调用宿主
  it('面板侧拒绝非法名称且不调用宿主', async () => {
    const createMap = vi.fn(async (): Promise<IMapDocument> => createEmptyDocument('m-new'));
    const { panel } = await openMapPanel(createCapabilities({ createMap }));

    await panel.createMap({ name: '  ', width: 32, height: 32, layerName: '第一层' });

    expect(createMap).not.toHaveBeenCalled();
    expect(viewState(panel).dialogError).toBe('请输入地图名称。');
  });

  // 面板侧拒绝超过宿主上限的尺寸，不夹取也不调用宿主
  it('面板侧拒绝超限尺寸且不调用宿主', async () => {
    const createMap = vi.fn(async (): Promise<IMapDocument> => createEmptyDocument('m-new'));
    const { panel } = await openMapPanel(
      createCapabilities({ createMap, maxMapSize: { maxWidth: 16, maxHeight: 16 } }),
    );

    await panel.createMap({ name: '新图', width: 100, height: 32, layerName: '第一层' });

    expect(createMap).not.toHaveBeenCalled();
    expect(viewState(panel).dialogError).toBe('宽度必须是 1 到 16 之间的整数。');
  });
});

describe('面板：切走与换图前自动保存', () => {
  // 切走即保存：改一格后切走，宿主收到新值、未保存清空，全程不出现任何弹窗
  it('切走时自动保存且不弹任何确认框', async () => {
    const saveMapData = vi.fn(async (_data: IMapDataSection): Promise<void> => {});
    const { panel } = await openMapPanel(createCapabilities({ saveMapData }));

    paintOneCell(panel);

    expect(panel.isDirty()).toBe(true);

    await panel.onSwitchOut();

    expect(saveMapData).toHaveBeenCalledTimes(1);
    expect(saveMapData.mock.calls[0][0].id).toBe('m1');
    expect(saveMapData.mock.calls[0][0].layers[0].cells[0][0]).toBe(1);
    expect(viewState(panel).unsaved).toBe(false);
    expect(viewState(panel).dialog).toBe(MapDialogKind.None);
    expect(screen.queryByTestId('map-unsaved-dialog')).toBeNull();
  });

  // 换图前保存：先把手上的改动写给原地图，再切到目标地图
  it('换图前先把改动存回原地图', async () => {
    const saveMapData = vi.fn(async (_data: IMapDataSection): Promise<void> => {});
    const openMap = vi.fn(async (mapId: string): Promise<IMapDocument> => createEmptyDocument(mapId));
    const { panel } = await openMapPanel(createCapabilities({ saveMapData, openMap }));

    paintOneCell(panel);
    await panel.openMap('m2');

    expect(saveMapData).toHaveBeenCalledTimes(1);
    expect(saveMapData.mock.calls[0][0].id).toBe('m1');
    expect(saveMapData.mock.calls[0][0].layers[0].cells[0][0]).toBe(1);
    expect(viewState(panel).document?.id).toBe('m2');
    expect(viewState(panel).unsaved).toBe(false);
  });

  // 保存失败中止换图：仍停在原地图，改动与错误提示都保留
  it('保存失败时中止换图并保留原地图与改动', async () => {
    const saveMapData = vi.fn(async (_data: IMapDataSection): Promise<void> => {
      throw new Error('磁盘已满');
    });
    const openMap = vi.fn(async (mapId: string): Promise<IMapDocument> => createEmptyDocument(mapId));
    const { panel } = await openMapPanel(createCapabilities({ saveMapData, openMap }));
    const initialCalls = openMap.mock.calls.length;

    paintOneCell(panel);
    await panel.openMap('m2');

    expect(openMap).toHaveBeenCalledTimes(initialCalls);
    expect(viewState(panel).document?.id).toBe('m1');
    expect(viewState(panel).document?.layers[0].cells[0][0]).toBe(1);
    expect(viewState(panel).error).toContain('磁盘已满');
    expect(viewState(panel).unsaved).toBe(true);
  });
});

describe('面板：图块偏好与最近使用', () => {
  // 新偏好文件存在时按 `{ recent, frequent, favorites }` 读入，最近列表顺序保留
  it('打开地图后读出预置的最近使用列表', async () => {
    const fileSystem = new FakeFileSystem();

    fileSystem.seed(MAP_TILE_PREFS_PATH, JSON.stringify({ recent: [2, 1], frequent: { '2': 3 }, favorites: [2] }));

    const { panel } = await openMapPanel(createCapabilities(), fileSystem);

    await waitFor(() => expect(viewState(panel).recentTiles).toEqual([2, 1]));
    expect(viewState(panel).frequentTiles).toEqual([2]);
    expect(viewState(panel).favorites).toEqual([2, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(viewState(panel).recentStatus).toBe(MapImageStatus.Ready);
  });

  // 两条文件都不存在时按空的正常路径处理，最近使用不再停在加载态
  it('文件缺失时按空列表处理且状态为就绪', async () => {
    const { panel } = await openMapPanel(createCapabilities());

    await expect(panel.loadTilePreferences()).resolves.toBeUndefined();
    expect(viewState(panel).recentTiles).toEqual([]);
    expect(viewState(panel).frequentTiles).toEqual([]);
    expect(viewState(panel).recentStatus).toBe(MapImageStatus.Ready);
  });

  // 文件内容损坏时按空偏好处理，不抛错
  it('文件损坏时按空列表处理', async () => {
    const fileSystem = new FakeFileSystem();

    fileSystem.seed(MAP_TILE_PREFS_PATH, '这不是 JSON');

    const { panel } = await openMapPanel(createCapabilities(), fileSystem);

    await panel.loadTilePreferences();

    expect(viewState(panel).recentTiles).toEqual([]);
    expect(viewState(panel).recentStatus).toBe(MapImageStatus.Ready);
  });

  // 读取抛错时发布错误态，最近使用不再一直显示正在加载
  it('读取抛错后状态为失败', async () => {
    const fileSystem = new FakeFileSystem();

    fileSystem.seed(MAP_TILE_PREFS_PATH, JSON.stringify({ recent: [1], frequent: {}, favorites: [] }));
    fileSystem.failing.add(MAP_TILE_PREFS_PATH);

    const { panel } = await openMapPanel(createCapabilities(), fileSystem);

    await waitFor(() => expect(viewState(panel).recentStatus).toBe(MapImageStatus.Error));
  });

  // 新文件不存在时只读一次旧文件做迁移，旧文件不会被删除
  it('旧版最近使用文件被迁移且保留原文件', async () => {
    const fileSystem = new FakeFileSystem();

    fileSystem.seed(MAP_RECENT_TILES_PATH, JSON.stringify({ tiles: [3, 2] }));

    const { panel } = await openMapPanel(createCapabilities(), fileSystem);

    await waitFor(() => expect(viewState(panel).recentTiles).toEqual([3, 2]));
    expect(viewState(panel).recentStatus).toBe(MapImageStatus.Ready);
    expect(viewState(panel).frequentTiles).toEqual([]);
    expect(JSON.parse(await fileSystem.readFile(MAP_RECENT_TILES_PATH))).toEqual({ tiles: [3, 2] });
  });

  // 新文件存在时优先于旧文件，不做迁移
  it('新文件优先于旧文件', async () => {
    const fileSystem = new FakeFileSystem();

    fileSystem.seed(MAP_RECENT_TILES_PATH, JSON.stringify({ tiles: [3] }));
    fileSystem.seed(MAP_TILE_PREFS_PATH, JSON.stringify({ recent: [1], frequent: {}, favorites: [] }));

    const { panel } = await openMapPanel(createCapabilities(), fileSystem);

    await waitFor(() => expect(viewState(panel).recentTiles).toEqual([1]));
  });

  // 落笔成功后同时写最近与最常，收藏保持 9 格空位
  it('落笔成功后同时写回最近与最常', async () => {
    const fileSystem = new FakeFileSystem();
    const { panel } = await openMapPanel(createCapabilities(), fileSystem);

    paintOneCell(panel);

    await waitFor(async () =>
      expect(await readPreferencesFile(fileSystem)).toEqual({
        recent: [1],
        frequent: { '1': 1 },
        favorites: [0, 0, 0, 0, 0, 0, 0, 0, 0],
      }),
    );
  });

  // 同一编号连续用两次只留一条最近记录，次数累加到 2
  it('同一编号只留一条且次数累加', async () => {
    const fileSystem = new FakeFileSystem();
    const { panel } = await openMapPanel(createCapabilities(), fileSystem);

    paintOneCell(panel);
    panel.commitCells('layer-base', [{ x: 1, y: 0, value: 1 }]);

    await waitFor(async () =>
      expect(await readPreferencesFile(fileSystem)).toEqual({
        recent: [1],
        frequent: { '1': 2 },
        favorites: [0, 0, 0, 0, 0, 0, 0, 0, 0],
      }),
    );
    expect(viewState(panel).recentTiles).toEqual([1]);
    expect(viewState(panel).frequentTiles).toEqual([1]);
  });

  // 次数表来自读盘：预置的 3 次在落笔一次后变成 4 次
  it('落笔在已读入的次数上自增', async () => {
    const fileSystem = new FakeFileSystem();

    fileSystem.seed(MAP_TILE_PREFS_PATH, JSON.stringify({ recent: [2], frequent: { '2': 3 }, favorites: [] }));

    const { system, panel } = await openMapPanel(createCapabilities(), fileSystem);

    await waitFor(() => expect(viewState(panel).frequentTiles).toEqual([2]));

    panel['paletteSelection'] = {
      kind: MapPaletteKind.Tiles,
      pattern: { width: 1, height: 1, tiles: [2] },
      primaryTileNumber: 2,
    };
    panel.commitCells('layer-base', [{ x: 1, y: 0, value: 2 }]);

    await waitFor(async () => {
      // 已存在的偏好文件走缓冲：核对磁盘前先显式写盘
      await system.resourceSystem.flushContent(MAP_TILE_PREFS_PATH);

      expect(await readPreferencesFile(fileSystem)).toMatchObject({ frequent: { '2': 4 } });
    });
  });

  // 用「空」擦除时不更新最近使用
  it('擦除不更新最近使用', async () => {
    const fileSystem = new FakeFileSystem();
    const { panel } = await openMapPanel(createCapabilities(), fileSystem);

    paintOneCell(panel);
    await waitFor(async () => expect(await readPreferencesFile(fileSystem)).toMatchObject({ recent: [1] }));

    panel['paletteSelection'] = {
      kind: MapPaletteKind.Empty,
      pattern: { width: 1, height: 1, tiles: [0] },
      primaryTileNumber: 0,
    };
    panel.commitCells('layer-base', [{ x: 0, y: 0, value: 0 }]);

    expect(viewState(panel).recentTiles).toEqual([1]);
    expect(await readPreferencesFile(fileSystem)).toMatchObject({ recent: [1], frequent: { '1': 1 } });
  });

  // 清除记录只清最近与最常，收藏不动
  it('清除记录后写回空列表', async () => {
    const fileSystem = new FakeFileSystem();
    const { system, panel } = await openMapPanel(createCapabilities(), fileSystem);

    paintOneCell(panel);
    await waitFor(async () => {
      await system.resourceSystem.flushContent(MAP_TILE_PREFS_PATH);

      expect(await readPreferencesFile(fileSystem)).toMatchObject({ recent: [1] });
    });

    await panel.clearRecentTiles();

    // 清空同样只写缓冲：核对磁盘前先显式写盘
    await system.resourceSystem.flushContent(MAP_TILE_PREFS_PATH);

    expect(viewState(panel).recentTiles).toEqual([]);
    expect(viewState(panel).frequentTiles).toEqual([]);
    expect(await readPreferencesFile(fileSystem)).toEqual({
      recent: [],
      frequent: {},
      favorites: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    });
  });

  // 写文件失败时静默降级：文档仍被改、未保存仍出现，且推进 5 000 毫秒后文件仍不存在（没有待写复活）
  it('写文件失败不打断落笔', async () => {
    const fileSystem = new FakeFileSystem();
    const { panel } = await openMapPanel(createCapabilities(), fileSystem);

    vi.useFakeTimers();
    fileSystem.failing.add(MAP_TILE_PREFS_PATH);
    paintOneCell(panel);
    // 推进整整一个写盘防抖周期：若失败留下了待写，文件会在这之后被写出来
    await vi.advanceTimersByTimeAsync(5000);
    vi.useRealTimers();

    expect(viewState(panel).document?.layers[0].cells[0][0]).toBe(1);
    expect(viewState(panel).unsaved).toBe(true);
    await expect(fileSystem.readFile(MAP_TILE_PREFS_PATH)).rejects.toThrow();
  });

  // Tileset 分类的编号既不进最近也不进最常
  it('Tileset 编号不进最近与最常', async () => {
    const fileSystem = new FakeFileSystem();
    const openMap = async (mapId: string): Promise<IMapDocument> => createTilesetDocument(mapId);
    const { panel } = await openMapPanel(createCapabilities({ openMap }), fileSystem);

    panel['paletteSelection'] = {
      kind: MapPaletteKind.Tiles,
      pattern: { width: 1, height: 1, tiles: [101] },
      primaryTileNumber: 101,
    };

    vi.useFakeTimers();
    panel.commitCells('layer-base', [{ x: 0, y: 0, value: 101 }]);
    // 推进整整一个写盘防抖周期：任何被误排进缓冲的内容都会在这之后落到磁盘
    await vi.advanceTimersByTimeAsync(5000);
    vi.useRealTimers();

    expect(viewState(panel).recentTiles).toEqual([]);
    expect(viewState(panel).frequentTiles).toEqual([]);
    await expect(fileSystem.readFile(MAP_TILE_PREFS_PATH)).rejects.toThrow();
  });

  // 读盘后收藏固定补齐到 9 格
  it('读盘后收藏固定为 9 格', async () => {
    const fileSystem = new FakeFileSystem();

    fileSystem.seed(MAP_TILE_PREFS_PATH, JSON.stringify({ recent: [], frequent: {}, favorites: [1, 2] }));

    const { panel } = await openMapPanel(createCapabilities(), fileSystem);

    await waitFor(() => expect(viewState(panel).favorites).toEqual([1, 2, 0, 0, 0, 0, 0, 0, 0]));
  });

  // 选中收藏位与擦除只改视图状态：不置脏、不进撤销
  it('选中收藏位与擦除只改视图状态', async () => {
    const fileSystem = new FakeFileSystem();

    fileSystem.seed(MAP_TILE_PREFS_PATH, JSON.stringify({ recent: [], frequent: {}, favorites: [1, 2] }));

    const { system, panel } = await openMapPanel(createCapabilities(), fileSystem);
    const addUndo = vi.spyOn(system.undoSystem, 'addUndoContext');

    await waitFor(() => expect(viewState(panel).favorites).toEqual([1, 2, 0, 0, 0, 0, 0, 0, 0]));

    panel.selectFavoriteSlot(2);

    expect(viewState(panel).paletteSelection.kind).toBe(MapPaletteKind.Tiles);
    expect(viewState(panel).paletteSelection.primaryTileNumber).toBe(2);

    panel.selectFavoriteSlot(0);

    expect(viewState(panel).paletteSelection.kind).toBe(MapPaletteKind.Empty);
    expect(viewState(panel).paletteSelection.primaryTileNumber).toBe(0);

    panel.selectFavoriteSlot(5);

    expect(viewState(panel).paletteSelection.kind).toBe(MapPaletteKind.Empty);
    expect(viewState(panel).unsaved).toBe(false);
    expect(panel.isDirty()).toBe(false);
    expect(addUndo).not.toHaveBeenCalled();
  });

  // 收藏排序落盘，且不置脏、不进撤销
  it('收藏排序落盘且不置脏', async () => {
    const fileSystem = new FakeFileSystem();

    fileSystem.seed(MAP_TILE_PREFS_PATH, JSON.stringify({ recent: [], frequent: {}, favorites: [1, 2, 3] }));

    const { system, panel } = await openMapPanel(createCapabilities(), fileSystem);
    const addUndo = vi.spyOn(system.undoSystem, 'addUndoContext');

    await waitFor(() => expect(viewState(panel).favorites?.[0]).toBe(1));

    panel.reorderFavorites(0, 2);

    expect(viewState(panel).favorites).toEqual([2, 3, 1, 0, 0, 0, 0, 0, 0]);
    await waitFor(async () => {
      // 已存在的偏好文件走缓冲：核对磁盘前先显式写盘
      await system.resourceSystem.flushContent(MAP_TILE_PREFS_PATH);

      expect(await readPreferencesFile(fileSystem)).toMatchObject({ favorites: [2, 3, 1, 0, 0, 0, 0, 0, 0] });
    });
    expect(viewState(panel).unsaved).toBe(false);
    expect(addUndo).not.toHaveBeenCalled();
  });
});
