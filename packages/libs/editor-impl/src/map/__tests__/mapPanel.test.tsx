import { cleanup, configure } from '@testing-library/react';
import { EditorCore, IEditorPanel, IEditorPanelFactoryParam } from '@motajs/editor-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMapPanelType, MAP_PANEL_TYPE_ID, MapPanel } from '..';
import {
  IMapDocument,
  IMapEditorCapabilities,
  IMapPanelViewState,
  IMapSummary,
  MapPanelStatus,
  MapUndoType,
} from '../types';
import { createMapDocument, createMapHarness, FakeFileSystem } from './fixtures';

configure({ testIdAttribute: 'data-test-id' });

// 面板数据层测试：直接驱动 MapPanel 的清单 / 打开 / 切换，不渲染视图、不依赖画布。
// 每个用例都经真实 EditorCore 装配，撤销能力与上下文与生产路径一致。

interface IHarness {
  /** 已初始化的编辑器核心 */
  readonly system: EditorCore;
  /** 被捕获的地图面板实例 */
  readonly panel: MapPanel;
}

interface IDeferred<T> {
  /** 待兑现的 promise */
  readonly promise: Promise<T>;
  /** 兑现结果 */
  readonly resolve: (value: T) => void;
}

/**
 * 造一个可手动兑现的 promise，用于测在途请求的先后顺序
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
 * @param overrides 覆盖文档字段
 * @returns 空格子的中立文档
 */
function createEmptyDocument(mapId: string, overrides: Partial<IMapDocument> = {}): IMapDocument {
  const base = createMapDocument({ id: mapId, name: mapId, ...overrides });
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
 * @returns 核心与面板实例
 */
async function openMapPanel(capabilities: IMapEditorCapabilities): Promise<IHarness> {
  const system = await createMapHarness(new FakeFileSystem());
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

  return { system, panel: panels[0] };
}

/**
 * 读取面板发布出去的视图状态；测试借此观察面板内部状态，不改任何私有字段
 * @param panel 地图面板实例
 * @returns 当前视图状态
 */
function viewState(panel: MapPanel): IMapPanelViewState {
  return panel['store'].state;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('地图面板：清单 / 打开 / 切换', () => {
  // 宿主清单为空时进入「无地图」，不留在加载态
  it('清单为空时状态为无地图', async () => {
    const { panel } = await openMapPanel(createCapabilities({ listMaps: async () => [] }));

    await panel.loadSummaries();

    expect(viewState(panel).status).toBe(MapPanelStatus.NoMaps);
    expect(viewState(panel).summaries).toHaveLength(0);
  });

  // 清单读取失败时进入「清单读取失败」，已经打开的地图仍留在内存里
  it('清单读取失败时保留已打开的地图', async () => {
    const { panel } = await openMapPanel(
      createCapabilities({
        listMaps: async () => {
          throw new Error('目录不可读');
        },
      }),
    );

    await panel.loadSummaries();

    expect(viewState(panel).status).toBe(MapPanelStatus.ListError);
    expect(viewState(panel).listError).toContain('目录不可读');
    expect(viewState(panel).document?.id).toBe('m1');
  });

  // 打开成功后进入就绪态，当前层取新文档的第一层
  it('打开成功后就绪且当前层为第一层', async () => {
    const { panel } = await openMapPanel(createCapabilities());

    expect(viewState(panel).status).toBe(MapPanelStatus.Ready);
    expect(viewState(panel).document?.id).toBe('m1');
    expect(viewState(panel).currentLayerId).toBe('layer-base');
  });

  // 宿主交回畸形文档时进入「地图加载失败」，不把半份数据当成可编辑文档
  it('打开畸形文档时进入加载失败', async () => {
    const { panel } = await openMapPanel(
      createCapabilities({
        openMap: async (mapId: string): Promise<IMapDocument> => createEmptyDocument(mapId, { layers: [] }),
      }),
    );

    await panel.openMap('bad');

    expect(viewState(panel).status).toBe(MapPanelStatus.Error);
    expect(viewState(panel).document).toBeUndefined();
  });

  // 切图时旧文档立即从状态里移除，成功后当前层换成新图第一层、视口回左上角
  it('切图时立即清空旧内容并重置图层与视口', async () => {
    const deferred = createDeferred<IMapDocument>();
    const mapTwo = createEmptyDocument('m2', {
      layers: [{ id: 'layer-two', name: '第二层', zIndex: 0, isEventLayer: false, cells: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]] }],
    });
    const openMap = vi.fn(async (mapId: string): Promise<IMapDocument> => {
      return mapId === 'm2' ? deferred.promise : createEmptyDocument(mapId);
    });
    const { panel } = await openMapPanel(createCapabilities({ openMap }));

    const pending = panel.openMap('m2');

    expect(viewState(panel).status).toBe(MapPanelStatus.Loading);
    expect(viewState(panel).document).toBeUndefined();

    deferred.resolve(mapTwo);
    await pending;

    expect(viewState(panel).status).toBe(MapPanelStatus.Ready);
    expect(viewState(panel).document?.id).toBe('m2');
    expect(viewState(panel).currentLayerId).toBe('layer-two');
    expect(viewState(panel).viewport).toEqual({ left: 0, top: 0 });
  });

  // 快速连切三张图时，晚到的旧请求被丢弃，只有最后一次结果落地
  it('快速切图只落地最后一次的结果', async () => {
    const deferreds = new Map<string, IDeferred<IMapDocument>>();
    const openMap = vi.fn(async (mapId: string): Promise<IMapDocument> => {
      if (mapId === 'm1') return createEmptyDocument(mapId);

      const deferred = createDeferred<IMapDocument>();

      deferreds.set(mapId, deferred);
      return deferred.promise;
    });
    const { panel } = await openMapPanel(createCapabilities({ openMap }));

    const first = panel.openMap('a');
    const second = panel.openMap('b');
    const third = panel.openMap('c');

    deferreds.get('c')!.resolve(createEmptyDocument('c'));
    await third;
    deferreds.get('a')!.resolve(createEmptyDocument('a'));
    deferreds.get('b')!.resolve(createEmptyDocument('b'));
    await first;
    await second;

    expect(viewState(panel).document?.id).toBe('c');
  });

  // 切图成功后登记一条屏障记录，撤销碰到它会停住而不是串到上一张图
  it('切图成功后登记一条撤销屏障', async () => {
    const { system, panel } = await openMapPanel(createCapabilities());
    const addUndo = vi.spyOn(system.undoSystem, 'addUndoContext');

    await panel.openMap('m2');

    expect(addUndo).toHaveBeenCalledTimes(1);
    expect(addUndo.mock.calls[0][1]).toMatchObject({ barrier: true });
  });

  // 有未保存改动时切入面板不重读当前文档，否则会把内存改动覆盖掉
  it('有未保存改动时切入不重读当前文档', async () => {
    const openMap = vi.fn(async (mapId: string): Promise<IMapDocument> => createEmptyDocument(mapId));
    const listMaps = vi.fn(async (): Promise<readonly IMapSummary[]> => [{ id: 'm1', name: '地图一' }]);
    const { panel } = await openMapPanel(createCapabilities({ openMap, listMaps }));

    panel.commitCells('layer-base', [{ x: 0, y: 0, value: 1 }]);
    openMap.mockClear();
    listMaps.mockClear();

    await panel.onSwitchIn();

    expect(panel.isDirty()).toBe(true);
    expect(listMaps).toHaveBeenCalledTimes(1);
    expect(openMap).not.toHaveBeenCalled();
  });

  // 打开成功即捕获基线：什么都没改的面板不算未保存
  it('打开成功即捕获基线且不显示未保存', async () => {
    const { panel } = await openMapPanel(createCapabilities());

    expect(panel.isDirty()).toBe(false);
    expect(viewState(panel).unsaved).toBe(false);
  });

  // 一笔连续画三格只登记一条撤销记录，不按格拆成三条
  it('一笔连续三格只产生一条撤销记录', async () => {
    const { system, panel } = await openMapPanel(createCapabilities());
    const addUndo = vi.spyOn(system.undoSystem, 'addUndoContext');

    panel.commitCells('layer-base', [
      { x: 0, y: 0, value: 1 },
      { x: 1, y: 0, value: 2 },
      { x: 2, y: 0, value: 3 },
    ]);

    expect(addUndo).toHaveBeenCalledTimes(1);
    expect(viewState(panel).document?.layers[0].cells[0].slice(0, 3)).toEqual([1, 2, 3]);
  });

  // 撤销把一笔里的三格都改回原值，并按基线重算：回到刚打开的状态即变干净
  it('撤销三格后全部回原值且未保存消失', async () => {
    const { system, panel } = await openMapPanel(createCapabilities());

    panel.commitCells('layer-base', [
      { x: 0, y: 0, value: 1 },
      { x: 1, y: 0, value: 2 },
      { x: 2, y: 0, value: 3 },
    ]);

    expect(panel.isDirty()).toBe(true);

    const undone = await system.undoSystem.undo();

    expect(undone).toBe(true);
    expect(viewState(panel).document?.layers[0].cells[0].slice(0, 3)).toEqual([0, 0, 0]);
    expect(panel.isDirty()).toBe(false);
  });

  // 重做又把三格写回去，未保存按基线重新出现
  it('重做把三格写回并重新算脏', async () => {
    const { system, panel } = await openMapPanel(createCapabilities());

    panel.commitCells('layer-base', [
      { x: 0, y: 0, value: 1 },
      { x: 1, y: 0, value: 2 },
      { x: 2, y: 0, value: 3 },
    ]);

    await system.undoSystem.undo();

    const redone = await system.undoSystem.redo();

    expect(redone).toBe(true);
    expect(viewState(panel).document?.layers[0].cells[0].slice(0, 3)).toEqual([1, 2, 3]);
    expect(panel.isDirty()).toBe(true);
  });

  // 撤销载荷的地图标识与当前地图不一致时直接忽略，绝不把上一张图的格子套到新图上
  it('跨地图的撤销记录不修改当前地图', async () => {
    const { panel } = await openMapPanel(createCapabilities());

    panel.commitCells('layer-base', [{ x: 0, y: 0, value: 1 }]);
    await panel.openMap('m2');

    const before = viewState(panel).document;

    await panel.undo({
      type: MapUndoType.Cells,
      data: {
        mapId: 'm1',
        layerId: 'layer-base',
        changes: [{ x: 0, y: 0, before: 0, after: 1 }],
      },
    });

    expect(viewState(panel).document).toEqual(before);
  });

  // 切图成功后撤销栈顶是屏障：撤销返回 false，且不会调用面板自己的撤销实现
  it('切图后的屏障挡住撤销', async () => {
    const { system, panel } = await openMapPanel(createCapabilities());
    const undoSpy = vi.spyOn(panel, 'undo');

    await panel.openMap('m2');

    const undone = await system.undoSystem.undo();

    expect(undone).toBe(false);
    expect(undoSpy).not.toHaveBeenCalled();
  });

  // 同一笔里重复落同一格时按净变化去重，撤销只回到这笔开始前的值
  it('同一笔重复落同一格时撤销回到原始值', async () => {
    const { system, panel } = await openMapPanel(createCapabilities());

    panel.commitCells('layer-base', [
      { x: 0, y: 0, value: 1 },
      { x: 0, y: 0, value: 2 },
    ]);

    expect(viewState(panel).document?.layers[0].cells[0][0]).toBe(2);

    await system.undoSystem.undo();

    expect(viewState(panel).document?.layers[0].cells[0][0]).toBe(0);
  });
});
