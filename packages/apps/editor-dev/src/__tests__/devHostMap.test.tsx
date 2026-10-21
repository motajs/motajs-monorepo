import { act, cleanup, configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EditorCore, IEditorPanel } from '@motajs/editor-core';
import { IMapDocument, IMapEditorCapabilities, MAP_PANEL_TYPE_ID, MapPanel } from '@motajs/editor-impl/map';
import { parseTableText } from '@motajs/editor-impl/shared';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IMapFileRecord, mapFilePath } from '../backend/mapFiles';
import { MemoryBackend } from '../backend/memoryBackend';
import { MAP_DEMO_MAPS, MAP_DEMO_TILES, registerMapDemo, seedMapDemo } from '../demo/mapDemo';

// 开发宿主地图端到端：注册 → 打开 → 画 / 擦 / 切层 → 加层 → 改属性 → 保存 → 关闭重开。
// Pixi 表面按相对模块标识替换成空壳，jsdom 里不初始化 WebGL；其余全部是真实装配（真实面板、真实内存后端）。

vi.mock('../../../../libs/editor-impl/src/map/components/MapSurface', async () => {
  const React = await import('react');

  return { MapSurface: () => React.createElement('div', { 'data-test-id': 'map-surface-stub' }) };
});

configure({ testIdAttribute: 'data-test-id' });

// jsdom 没有实现 `URL.createObjectURL`，调色板却要靠它把图块字节变成地址；只补这两个静态方法
Object.defineProperty(URL, 'createObjectURL', { value: vi.fn((): string => 'blob:test'), configurable: true });
Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });

/** 已经装好的开发宿主 */
interface IDevHost {
  /** 编辑器核心 */
  readonly core: EditorCore;
  /** 内存后端，用来读回地图文件 */
  readonly backend: MemoryBackend;
  /** 注入给地图面板的能力对象（测试用来等待属性读取完成） */
  readonly capabilities: IMapEditorCapabilities;
}

/** 派发指针事件时的坐标与按键 */
interface IPointerInit {
  /** 指针在视口中的横坐标 */
  readonly x: number;
  /** 指针在视口中的纵坐标 */
  readonly y: number;
  /** 按键：0 左键 */
  readonly button?: number;
  /** 当前按住的按键掩码 */
  readonly buttons?: number;
  /** 指针标识；缺省 1（轨迹型指针） */
  readonly pointerId?: number;
}

// 每个用例结束后卸载已挂载的组件，避免 DOM 在用例之间累积
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1200 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 800 });
});

/**
 * 装配开发宿主：先 seed 演示地图文件，再注册地图面板，最后初始化核心
 * @returns 核心与内存后端
 */
async function createHost(): Promise<IDevHost> {
  const core = new EditorCore();
  const backend = new MemoryBackend();

  await seedMapDemo(backend);
  const capabilities = registerMapDemo(core, backend);

  await core.initialize({ fs: backend, maxUndoStep: backend.maxUndoStep });
  return { core, backend, capabilities };
}

/**
 * 在首个标签里打开一张演示地图
 * @param core 编辑器核心
 * @param mapId 地图标识
 */
async function openMapTab(core: EditorCore, mapId: string): Promise<void> {
  const tabId = core.shellSystem.listTabs()[0].id;

  await act(async () => {
    await core.shellSystem.openPanelInTab(tabId, MAP_PANEL_TYPE_ID, { target: { mapId } });
  });
  await act(async () => {});
}

/**
 * 渲染外壳并等地图面板进入就绪态
 * @param core 编辑器核心
 * @returns 渲染容器
 */
async function renderShell(core: EditorCore): Promise<HTMLElement> {
  const { container } = render(createElement(core.shellSystem.render()));

  await act(async () => {});
  await waitFor(() => {
    expect(container.querySelector('[data-test-id="map-panel"]')?.getAttribute('data-status')).toBe('ready');
  });

  return container;
}

/**
 * 取当前画布元素；面板还没渲染出画布时抛错
 * @param container 渲染容器
 * @returns 画布元素
 */
function queryCanvas(container: HTMLElement): Element {
  const canvas = container.querySelector('[data-test-id="map-canvas"]');

  if (canvas === null) throw new Error('地图画布缺失');

  return canvas;
}

/**
 * 取某格中心的视口坐标（jsdom 里画布 left/top 为 0）
 * @param x 格子横坐标
 * @param y 格子纵坐标
 * @returns 视口坐标
 */
function cellPoint(x: number, y: number): { x: number; y: number } {
  return { x: x * 32 + 16, y: y * 32 + 16 };
}

/**
 * 派发一个带坐标、按键与 pointerId 的鼠标事件；jsdom 没有 PointerEvent，用 MouseEvent 承担同一监听
 * @param target 事件目标
 * @param type 事件类型
 * @param init 坐标与按键
 */
function dispatchPointer(target: Element, type: string, init: IPointerInit): void {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: init.x,
    clientY: init.y,
    button: init.button ?? 0,
    buttons: init.buttons ?? 0,
  });

  Object.defineProperty(event, 'pointerId', { configurable: true, value: init.pointerId ?? 1 });
  fireEvent(target, event);
}

/**
 * 点一次左键并松开：在指定格落一笔
 * @param target 画布元素
 * @param x 格子横坐标
 * @param y 格子纵坐标
 */
function clickCell(target: Element, x: number, y: number): void {
  const point = cellPoint(x, y);

  dispatchPointer(target, 'pointerdown', { ...point, buttons: 1 });
  dispatchPointer(target, 'pointerup', point);
}

/**
 * 点第二行工具栏里的某个图层
 * @param container 渲染容器
 * @param name 图层显示名
 */
function clickLayer(container: HTMLElement, name: string): void {
  const items = Array.from(container.querySelectorAll('.ant-segmented-item'));
  const item = items.find((element) => (element.textContent ?? '').trim() === name);

  if (item === undefined) throw new Error(`图层项缺失：${name}`);

  fireEvent.click(item);
}

/**
 * 点「保存地图」并等提示行出现「已保存」
 */
async function saveMap(): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByTestId('map-save'));
  });
  await waitFor(() => {
    expect(screen.getByTestId('map-notice').textContent).toContain('已保存');
  });
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

/**
 * 另开一个不渲染的面板实例并打开地图
 * @param core 编辑器核心
 * @param mapId 地图标识
 * @returns 地图面板实例
 */
async function createProbePanel(core: EditorCore, mapId: string): Promise<MapPanel> {
  const created: IEditorPanel | null = await act(async () =>
    core.shellSystem.createPanelInstance(MAP_PANEL_TYPE_ID, { target: { mapId } }),
  );

  if (!(created instanceof MapPanel)) throw new Error('地图面板实例创建失败');

  return created;
}

/**
 * 另开一个不渲染的面板实例读回文档；用来断言「关闭重开后读到的内容」
 * @param core 编辑器核心
 * @param mapId 地图标识
 * @returns 打开好的中立文档
 */
async function probeDocument(core: EditorCore, mapId: string): Promise<IMapDocument> {
  const panel = await createProbePanel(core, mapId);

  await waitFor(() => {
    expect(panel['document']).not.toBeUndefined();
  });

  const document = panel['document'];

  if (document === undefined) throw new Error('地图文档未就绪');

  return document;
}

/**
 * 取演示记录里的某一层扁平格子
 * @param mapId 地图标识
 * @returns 演示记录
 */
function demoRecord(mapId: string): IMapFileRecord {
  const record = MAP_DEMO_MAPS.find((candidate) => candidate.id === mapId);

  if (record === undefined) throw new Error(`演示地图缺失：${mapId}`);

  return record;
}

describe('开发宿主地图端到端', () => {
  // 打开 → 画 / 擦 / 切层 → 加层 → 点「地图属性」改字段 → 保存 → 关闭重开，事件与额外字段逐字未变
  it('画擦切层加层改属性保存后重开，改动与图层名都在', async () => {
    const { core, backend, capabilities } = await createHost();
    const readSpy = vi.spyOn(capabilities, 'readProperties');

    await openMapTab(core, 'small');

    const container = await renderShell(core);
    const canvas = queryCanvas(container);

    // 调色板就绪后才能点图块；先确认图块按钮真的渲染出来
    await waitFor(() => {
      expect(screen.getByTestId('map-tile-1')).not.toBeNull();
    });

    // 画一格（(1,2) 原是编号 3 的格子，改写成编号 1），再选擦除格擦掉原点上的一块墙，最后重新选中图块
    clickCell(canvas, 1, 2);
    fireEvent.click(screen.getByTestId('map-palette-erase'));
    clickCell(canvas, 0, 0);
    fireEvent.click(screen.getByTestId('map-tile-1'));

    await waitFor(() => {
      expect(screen.getByTestId('map-unsaved')).not.toBeNull();
    });

    // 切到第二层再画一格
    clickLayer(container, '遮挡层');
    clickCell(queryCanvas(container), 1, 1);

    // 先存一次，避免「新增图层」被未保存确认拦下（两处保存都会保留事件与额外字段）
    await saveMap();

    // 新增图层并命名为「测试层」，它成为当前层；再在当前层画一格让数据域重新变脏
    fireEvent.click(screen.getByTestId('map-layer-add'));
    await waitFor(() => {
      expect(screen.getByTestId('map-layer-dialog')).not.toBeNull();
    });

    fireEvent.change(screen.getByTestId('map-layer-name'), { target: { value: '测试层' } });
    await act(async () => {
      fireEvent.click(screen.getByTestId('map-layer-submit'));
    });
    await act(async () => {});

    expect(container.textContent).toContain('测试层');

    clickCell(queryCanvas(container), 2, 3);

    // 打开地图属性抽屉，改数字字段
    await act(async () => {
      fireEvent.click(screen.getByTestId('map-properties'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('map-properties-drawer')).not.toBeNull();
    });

    // 等属性读取真的完成，再让外壳重渲染一次面板：属性行是面板 props，只有外壳重渲染才会刷新
    const readResult = readSpy.mock.results[0];

    if (readResult !== undefined && readResult.type === 'return') await readResult.value;

    await act(async () => {
      core.shellSystem.activateTab(core.shellSystem.listTabs()[0].id);
    });
    await waitFor(() => {
      expect(screen.queryByTestId('table-input-initialGold')).not.toBeNull();
    });

    const goldInput = screen.getByTestId('table-input-initialGold').querySelector('input');

    if (goldInput === null) throw new Error('初始金币输入框缺失');

    fireEvent.change(goldInput, { target: { value: '7' } });
    fireEvent.blur(goldInput);

    await saveMap();

    const saved = await readRecord(backend, 'small');
    const demo = demoRecord('small');

    // 数据域：画的一格、擦的一格、第二层的一格、新层的一格都在
    expect(saved.layers[0][2 * 8 + 1]).toBe(1);
    expect(saved.layers[0][0]).toBe(0);
    expect(saved.layers[1][1 * 8 + 1]).toBe(1);
    expect(saved.layers[2][3 * 8 + 2]).toBe(1);
    expect(saved.layerNames[2]).toBe('测试层');

    // 属性域：只改了金币，名称与事件、额外字段逐字未变
    expect(saved.properties.initialGold).toBe(7);
    expect(saved.properties.name).toBe(demo.properties.name);
    expect(saved.events).toEqual(demo.events);
    expect(saved.extra).toEqual(demo.extra);
    expect(saved.layerNames[0]).toBe(demo.layerNames[0]);

    // 无未保存改动 → 直接关标签；外壳补一个空白标签
    const closeButton = container.querySelector('.editor-shell-tab-close');

    if (closeButton === null) throw new Error('标签关闭按钮缺失');

    await act(async () => {
      fireEvent.click(closeButton);
    });
    await act(async () => {});

    expect(core.shellSystem.listTabs()[0].typeId).toBeNull();

    await openMapTab(core, 'small');
    await waitFor(() => {
      expect(container.querySelector('[data-test-id="map-panel"]')?.getAttribute('data-status')).toBe('ready');
    });

    expect(container.textContent).toContain('测试层');

    const reopened = await probeDocument(core, 'small');

    expect(reopened.layers[0].cells[2][1]).toBe(1);
    expect(reopened.layers[0].cells[0][0]).toBe(0);
    expect(reopened.layers[2].name).toBe('测试层');
  });

  // 有未保存改动时点关闭标签 → 出现未保存确认；选「取消」后标签仍在
  it('未保存时关闭标签会弹确认，取消后标签仍在', async () => {
    const { core } = await createHost();

    await openMapTab(core, 'small');

    const container = await renderShell(core);

    clickCell(queryCanvas(container), 1, 2);

    await waitFor(() => {
      expect(screen.getByTestId('map-unsaved')).not.toBeNull();
    });

    const tabsBefore = core.shellSystem.listTabs().length;
    const closeButton = container.querySelector('.editor-shell-tab-close');

    if (closeButton === null) throw new Error('标签关闭按钮缺失');

    await act(async () => {
      fireEvent.click(closeButton);
    });

    await waitFor(() => {
      expect(screen.getByTestId('map-unsaved-dialog')).not.toBeNull();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('map-unsaved-cancel'));
    });
    await act(async () => {});

    expect(core.shellSystem.listTabs()).toHaveLength(tabsBefore);
    expect(container.querySelector('[data-test-id="map-panel"]')).not.toBeNull();
    expect(screen.queryByTestId('map-unsaved-dialog')).toBeNull();
  });

  // 有未保存改动时选「放弃改动」：标签关闭、文件没被写入，重新打开回到保存前状态
  it('放弃改动后关标签，重开回到保存前状态', async () => {
    const { core, backend } = await createHost();

    await openMapTab(core, 'small');

    const container = await renderShell(core);

    clickCell(queryCanvas(container), 1, 2);

    const closeButton = container.querySelector('.editor-shell-tab-close');

    if (closeButton === null) throw new Error('标签关闭按钮缺失');

    await act(async () => {
      fireEvent.click(closeButton);
    });

    await waitFor(() => {
      expect(screen.getByTestId('map-unsaved-dialog')).not.toBeNull();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('map-unsaved-discard'));
    });
    await act(async () => {});

    expect(core.shellSystem.listTabs()[0].typeId).toBeNull();

    const file = await readRecord(backend, 'small');

    expect(file.layers[0][2 * 8 + 1]).toBe(demoRecord('small').layers[0][2 * 8 + 1]);

    await openMapTab(core, 'small');
    await waitFor(() => {
      expect(container.querySelector('[data-test-id="map-panel"]')?.getAttribute('data-status')).toBe('ready');
    });

    const reopened = await probeDocument(core, 'small');

    expect(reopened.layers[0].cells[2][1]).toBe(demoRecord('small').layers[0][2 * 8 + 1]);
  });

  // 就绪后调色板真的出现演示分组与图块：证明图块目录经 options.tileGroups → openMap → 文档流到了调色板
  it('就绪后调色板出现两个演示分组与属于目录的图块', async () => {
    const { core } = await createHost();

    await openMapTab(core, 'small');

    const container = await renderShell(core);

    await waitFor(() => {
      expect(container.querySelector('[data-test-id="map-tile-1"]')).not.toBeNull();
    });

    const groups = container.querySelectorAll('[data-test-id^="map-palette-group-"]');

    expect(groups.length).toBeGreaterThanOrEqual(2);

    const numbers: Set<number> = new Set(
      MAP_DEMO_TILES.flatMap((group) => group.tiles.map((tile) => tile.number)),
    );
    const tiles = Array.from(container.querySelectorAll('[data-test-id^="map-tile-"]'));

    expect(tiles.length).toBeGreaterThan(0);

    for (const tile of tiles) {
      const testId = tile.getAttribute('data-test-id') ?? '';
      const number = Number(testId.slice('map-tile-'.length));

      expect(numbers.has(number)).toBe(true);
    }
  });
});
