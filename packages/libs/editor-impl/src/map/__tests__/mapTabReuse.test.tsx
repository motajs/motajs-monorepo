import { act, cleanup, configure, waitFor } from '@testing-library/react';
import { EditorCore, IEditorPanel, IEditorPanelFactoryParam, IEditorPanelType } from '@motajs/editor-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMapPanelType, MAP_PANEL_TYPE_ID, MapPanel } from '..';
import { tablePanelType } from '@motajs/editor-impl';
import { IMapDataSection, IMapDocument, IMapEditorCapabilities, IMapSummary } from '../types';
import { createMapDocument, createMapHarness, FakeFileSystem } from './fixtures';

configure({ testIdAttribute: 'data-test-id' });

// 地图面板复用同一标签的守门用例：打开 A 再打开 B 只剩一个标签、A 的格子改动先交给宿主保存且只保存一次；
// 冲突未表态时复用被拒、不保存；保存失败时保留 A 并返回假。实例一律经真实 `mapPanelType.create` 创建，
// 确保 `MapPanel.setMap(openParam.target)` 真的执行。

/** 第一张地图的标识 */
const MAP_ONE = 'm1';

/** 第二张地图的标识 */
const MAP_TWO = 'm2';

/** 第一张地图的文件路径 */
const MAP_ONE_PATH = 'content/map/m1.json';

/** 第二张地图的文件路径 */
const MAP_TWO_PATH = 'content/map/m2.json';

/** 地图面板类型与捕获到的实例 */
interface IMapTypeHarness {
  /** 真实工厂造出的面板类型 */
  readonly base: IEditorPanelType;
  /** 复制了真实能力、并按创建顺序收集实例的注册用类型 */
  readonly type: IEditorPanelType;
}

// 每个用例结束后卸载已挂载的组件并还原替身，避免 DOM 与调用记录在用例之间累积
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * 造一份默认可用、可按用例覆盖个别回调的地图能力
 * @param overrides 覆盖能力实现
 * @returns 地图能力注入面
 */
function createCapabilities(overrides: Partial<IMapEditorCapabilities> = {}): IMapEditorCapabilities {
  const summaries: readonly IMapSummary[] = [
    { id: MAP_ONE, name: '地图一' },
    { id: MAP_TWO, name: '地图二' },
  ];

  return {
    listMaps: async (): Promise<readonly IMapSummary[]> => summaries,
    openMap: async (mapId: string): Promise<IMapDocument> => createMapDocument({ id: mapId, name: mapId }),
    saveMapData: async (): Promise<void> => {},
    ...overrides,
  };
}

/**
 * 注册一个复用真实工厂、并收集实例的地图面板类型
 * @param system 已初始化的编辑器核心
 * @param capabilities 地图能力注入面
 * @param created 按创建顺序收集面板实例的数组
 * @returns 真实类型与注册用类型
 */
function registerMapType(
  system: EditorCore,
  capabilities: IMapEditorCapabilities,
  created: MapPanel[],
): IMapTypeHarness {
  const base = createMapPanelType(capabilities);
  const type: IEditorPanelType = {
    ...base,
    create: (param: IEditorPanelFactoryParam): IEditorPanel => {
      const panel = base.create(param);

      if (panel instanceof MapPanel) created.push(panel);

      return panel;
    },
  };

  system.shellSystem.registerPanelType(type);

  return { base, type };
}

/**
 * 在指定标签里打开地图面板
 * @param system 已初始化的编辑器核心
 * @param tabId 目标标签 id
 * @param type 注册用面板类型
 * @param mapId 打开的目标地图
 * @param path 交给外壳去重用的文件路径
 * @returns 外壳的打开结果
 */
async function openMapInTab(
  system: EditorCore,
  tabId: string,
  type: IEditorPanelType,
  mapId: string,
  path: string,
): Promise<boolean> {
  let opened = false;

  await act(async () => {
    opened = await system.shellSystem.openPanelInTab(tabId, type.id, { target: { mapId } }, path);
  });

  return opened;
}

/**
 * 在暂存空白标签里打开地图面板；开空白标签与开面板必须在同一同步段内完成才能领走暂存
 * @param system 已初始化的编辑器核心
 * @param type 注册用面板类型
 * @param mapId 打开的目标地图
 * @param path 交给外壳去重用的文件路径
 * @returns 外壳的打开结果
 */
async function openMapInBlankTab(
  system: EditorCore,
  type: IEditorPanelType,
  mapId: string,
  path: string,
): Promise<boolean> {
  let opened = false;

  await act(async () => {
    const tabId = system.shellSystem.openBlankTab();

    opened = await system.shellSystem.openPanelInTab(tabId, type.id, { target: { mapId } }, path);
  });

  return opened;
}

/**
 * 只统计地图类型的标签
 * @param system 已初始化的编辑器核心
 * @returns 地图标签列表
 */
function mapTabs(system: EditorCore): readonly { readonly id: string }[] {
  return system.shellSystem.listTabs().filter((tab) => tab.typeId === MAP_PANEL_TYPE_ID);
}

/**
 * 等第一张地图真正打开
 * @param panel 地图面板实例
 */
async function waitForMapOne(panel: MapPanel): Promise<void> {
  await waitFor((): void => {
    expect(panel['document']?.id).toBe(MAP_ONE);
  });
}

describe('地图面板复用标签', () => {
  // 打开 A → 改格子 → 打开 B：一个标签、内容为 B、A 的改动已保存且只保存一次
  it('打开 A 再打开 B 时复用同一标签，并先保存 A 的改动', async () => {
    const saveMapData = vi.fn(async (_data: IMapDataSection): Promise<void> => {});
    const system = await createMapHarness(new FakeFileSystem());
    const created: MapPanel[] = [];
    const { base, type } = registerMapType(system, createCapabilities({ saveMapData }), created);

    expect(base.reuseTab).toBe(true);
    expect(tablePanelType.reuseTab).toBeUndefined();

    const firstTab = system.shellSystem.listTabs()[0].id;

    await openMapInTab(system, firstTab, type, MAP_ONE, MAP_ONE_PATH);
    await waitForMapOne(created[0]);

    created[0].commitCells('layer-base', [{ x: 0, y: 0, value: 2 }]);

    expect(created[0].isDirty()).toBe(true);

    const opened = await openMapInBlankTab(system, type, MAP_TWO, MAP_TWO_PATH);

    expect(opened).toBe(true);
    expect(mapTabs(system)).toHaveLength(1);
    expect(created).toHaveLength(2);
    expect(saveMapData).toHaveBeenCalledTimes(1);

    const payload = saveMapData.mock.calls[0][0];
    const baseLayer = payload.layers.find((layer) => layer.id === 'layer-base');

    expect(payload.id).toBe(MAP_ONE);
    expect(baseLayer?.cells[0][0]).toBe(2);

    await waitFor((): void => {
      expect(created[1]['document']?.id).toBe(MAP_TWO);
    });
  });

  // 冲突未表态且 owner 仍是活动标签：不保存、不复用、不切出，只把标签留在前台
  it('存在未表态冲突时拒绝复用且不保存', async () => {
    const saveMapData = vi.fn(async (_data: IMapDataSection): Promise<void> => {});
    const system = await createMapHarness(new FakeFileSystem());
    const created: MapPanel[] = [];
    const { type } = registerMapType(system, createCapabilities({ saveMapData }), created);

    const firstTab = system.shellSystem.listTabs()[0].id;

    await openMapInTab(system, firstTab, type, MAP_ONE, MAP_ONE_PATH);
    await waitForMapOne(created[0]);

    created[0].commitCells('layer-base', [{ x: 0, y: 0, value: 2 }]);
    created[0]['publish']({ pendingConflict: { path: MAP_ONE_PATH, text: '' } });

    const switchOut = vi.spyOn(created[0], 'onSwitchOut');

    const opened = await openMapInBlankTab(system, type, MAP_TWO, MAP_TWO_PATH);

    expect(opened).toBe(true);
    expect(mapTabs(system)).toHaveLength(1);
    expect(created).toHaveLength(1);
    expect(created[0].hasPendingConflict()).toBe(true);
    expect(saveMapData).not.toHaveBeenCalled();
    expect(switchOut).not.toHaveBeenCalled();
  });

  // 保存失败：保留 A、不重建、返回假，面板仍报「仍有未保存改动」
  it('保存失败时保留 A 并返回假', async () => {
    const saveMapData = vi.fn(async (_data: IMapDataSection): Promise<void> => {
      throw new Error('磁盘已满');
    });
    const system = await createMapHarness(new FakeFileSystem());
    const created: MapPanel[] = [];
    const { type } = registerMapType(system, createCapabilities({ saveMapData }), created);

    const firstTab = system.shellSystem.listTabs()[0].id;

    await openMapInTab(system, firstTab, type, MAP_ONE, MAP_ONE_PATH);
    await waitForMapOne(created[0]);

    created[0].commitCells('layer-base', [{ x: 0, y: 0, value: 2 }]);

    const dispose = vi.spyOn(created[0], 'dispose');

    const opened = await openMapInBlankTab(system, type, MAP_TWO, MAP_TWO_PATH);

    expect(opened).toBe(false);
    expect(mapTabs(system)).toHaveLength(1);
    expect(created).toHaveLength(1);
    expect(created[0]['document']?.id).toBe(MAP_ONE);
    expect(created[0].hasUnsavedChanges()).toBe(true);
    expect(dispose).not.toHaveBeenCalled();
  });
});
