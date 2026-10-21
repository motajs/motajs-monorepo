import { cleanup, configure } from '@testing-library/react';
import { EditorCore, IEditorPanel, IEditorPanelFactoryParam } from '@motajs/editor-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMapPanelType, MAP_PANEL_TYPE_ID, MapPanel } from '..';
import { IMapDataSection, IMapDocument, IMapEditorCapabilities, IMapPanelViewState, IMapSummary } from '../types';
import { createMapDocument, createMapHarness, FakeFileSystem } from './fixtures';

configure({ testIdAttribute: 'data-test-id' });

// 手动保存测试：只提交有改动的域、成功后把发出的快照设为基线、失败不丢改动。
// 全部经真实 EditorCore 装配，撤销路径与生产一致。

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
 * 造一个可手动兑现的 promise，用于测保存进行中的语义
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
  const summaries: readonly IMapSummary[] = [{ id: 'm1', name: '地图一' }];

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
 * 读取面板发布出去的视图状态；测试借此观察保存结果，不改任何私有字段
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

describe('地图面板：按域手动保存', () => {
  // 刚打开地图什么都没改：不算脏，点保存也不会打扰宿主
  it('刚打开时保存不调用宿主', async () => {
    const saveMapData = vi.fn(async (_data: IMapDataSection): Promise<void> => {});
    const { panel } = await openMapPanel(createCapabilities({ saveMapData }));

    expect(panel.isDirty()).toBe(false);

    const saved = await panel.save();

    expect(saved).toBe(true);
    expect(saveMapData).not.toHaveBeenCalled();
  });

  // 画一格后保存：宿主收到整份数据域，保存成功不再显示未保存
  it('画一格后保存把整份数据域交回宿主', async () => {
    const saveMapData = vi.fn(async (_data: IMapDataSection): Promise<void> => {});
    const { panel } = await openMapPanel(createCapabilities({ saveMapData }));

    panel.commitCells('layer-base', [{ x: 0, y: 0, value: 1 }]);

    const saved = await panel.save();

    expect(saved).toBe(true);
    expect(saveMapData).toHaveBeenCalledTimes(1);

    const payload = saveMapData.mock.calls[0][0];

    expect(payload.id).toBe('m1');
    expect(payload.width).toBe(4);
    expect(payload.height).toBe(3);
    expect(payload.layers).toHaveLength(2);
    expect(viewState(panel).unsaved).toBe(false);
    expect(panel.isDirty()).toBe(false);
  });

  // 宿主保存抛错：脏标记与内存改动都保留，错误按纯文本放进保存提示行
  it('保存失败保留脏标记与内存改动', async () => {
    const saveMapData = vi.fn(async (_data: IMapDataSection): Promise<void> => {
      throw new Error('磁盘已满');
    });
    const { panel } = await openMapPanel(createCapabilities({ saveMapData }));

    panel.commitCells('layer-base', [{ x: 0, y: 0, value: 1 }]);

    const saved = await panel.save();

    expect(saved).toBe(false);
    expect(viewState(panel).unsaved).toBe(true);
    expect(viewState(panel).error).toContain('磁盘已满');
    expect(viewState(panel).document?.layers[0].cells[0][0]).toBe(1);
  });

  // 保存期间继续编辑：成功后基线是「发出去的那份快照」，期间的新改动仍然算脏
  it('保存期间的新编辑在保存成功后仍然算脏', async () => {
    const deferred = createDeferred<void>();
    const saveMapData = vi.fn((): Promise<void> => deferred.promise);
    const { panel } = await openMapPanel(createCapabilities({ saveMapData }));

    panel.commitCells('layer-base', [{ x: 0, y: 0, value: 1 }]);

    const saving = panel.save();

    panel.commitCells('layer-base', [{ x: 1, y: 0, value: 2 }]);
    deferred.resolve();

    expect(await saving).toBe(true);
    expect(panel.isDirty()).toBe(true);
  });

  // 连续点两次保存：第二次在保存中直接返回，宿主只被调用一次
  it('连续两次保存只调用一次宿主', async () => {
    const deferred = createDeferred<void>();
    const saveMapData = vi.fn((): Promise<void> => deferred.promise);
    const { panel } = await openMapPanel(createCapabilities({ saveMapData }));

    panel.commitCells('layer-base', [{ x: 0, y: 0, value: 1 }]);

    const first = panel.save();
    const second = panel.save();

    deferred.resolve();
    await first;
    await second;

    expect(await second).toBe(false);
    expect(saveMapData).toHaveBeenCalledTimes(1);
  });

  // 保存成功后宿主收到的图层与当前文档逐格相等
  it('保存成功后宿主收到的图层与当前文档一致', async () => {
    const saveMapData = vi.fn(async (_data: IMapDataSection): Promise<void> => {});
    const { panel } = await openMapPanel(createCapabilities({ saveMapData }));

    panel.commitCells('layer-base', [
      { x: 0, y: 0, value: 1 },
      { x: 3, y: 2, value: 2 },
    ]);

    await panel.save();

    const document = viewState(panel).document;

    expect(document).toBeDefined();
    expect(saveMapData.mock.calls[0][0].layers).toEqual(document!.layers);
  });

  // 撤销回到已保存状态：未保存按基线重算后自动消失，而不是靠清标志
  it('撤销回到基线后未保存自动消失', async () => {
    const saveMapData = vi.fn(async (_data: IMapDataSection): Promise<void> => {});
    const { system, panel } = await openMapPanel(createCapabilities({ saveMapData }));

    panel.commitCells('layer-base', [{ x: 0, y: 0, value: 1 }]);
    await panel.save();
    panel.commitCells('layer-base', [{ x: 1, y: 0, value: 2 }]);

    expect(panel.isDirty()).toBe(true);

    const undone = await system.undoSystem.undo();

    expect(undone).toBe(true);
    expect(viewState(panel).document?.layers[0].cells[0][1]).toBe(0);
    expect(panel.isDirty()).toBe(false);
  });
});
