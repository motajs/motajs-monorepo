import { act, cleanup, configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EditorCore, IEditorPanel, IEditorPanelFactoryParam } from '@motajs/editor-core';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMapPanelType, MAP_PANEL_TYPE_ID, MapPanel } from '..';
import { MAP_CELL_SIZE } from '../constants';
import { IMapCanvasProps, MapCanvas } from '../components/MapCanvas';
import { IPaintWrite } from '../model/document';
import { buildMapRenderModel, IMapRenderView } from '../model/renderModel';
import { IMapDocument, IMapEditorCapabilities, IMapRenderModel, MapBrushMode } from '../types';
import {
  createMapDocument,
  createMapHarness,
  createTileGroup,
  createWideMapDocument,
  FakeFileSystem,
} from './fixtures';

vi.mock('../components/MapSurface', async () => {
  const { createElement: createMockElement } = await import('react');

  return {
    MapSurface: (props: { model: IMapRenderModel }) => {
      const model = props.model;
      const opacities = model.cells
        .map((cell) => `${cell.key.split(':')[0]}:${cell.opacity}`)
        .filter((entry, index, list) => list.indexOf(entry) === index)
        .join(',');
      const selection = model.selection;
      const preview = model.preview;
      const hover = model.hover;

      return createMockElement('div', {
        'data-test-id': 'map-surface-stub',
        'data-cell-count': String(model.cells.length),
        'data-grid-count': String(model.gridLines.length),
        'data-pass-count': String(model.passMarks.length),
        'data-pass-dots': String(model.passMarks.filter((mark) => mark.dot).length),
        'data-selection':
          selection === undefined ? '' : `${selection.x}:${selection.y}:${selection.width}:${selection.height}`,
        'data-preview':
          preview === undefined
            ? ''
            : `${preview.rect.x}:${preview.rect.y}:${preview.rect.width}:${preview.rect.height}`,
        'data-hover': hover === undefined ? '' : `${hover.x},${hover.y}`,
        'data-opacity': opacities,
      });
    },
  };
});

configure({ testIdAttribute: 'data-test-id' });

// 画布手势 / 快捷键 / 标尺 / 状态条 / 大地图与叠加层的视图测试。
// Pixi 表面被替换成只回显渲染模型的数据属性；手势与快捷键走真实 MapCanvas，接线类用例走完整面板视图。

interface IPanelHarness {
  /** 已初始化的编辑器核心 */
  readonly system: EditorCore;
  /** 被捕获的地图面板实例 */
  readonly panel: MapPanel;
}

interface IPointerInit {
  /** 指针在视口中的横坐标 */
  readonly x: number;
  /** 指针在视口中的纵坐标 */
  readonly y: number;
  /** 按键：0 左键、2 右键 */
  readonly button?: number;
  /** 当前按住的按键掩码 */
  readonly buttons?: number;
  /** 指针标识；缺省 1（轨迹型指针） */
  readonly pointerId?: number;
}

/**
 * 造一帧渲染模型
 * @param document 中立文档
 * @param overrides 覆盖视图参数
 * @returns 渲染模型
 */
function createModel(document: IMapDocument, overrides: Partial<IMapRenderView> = {}): IMapRenderModel {
  return buildMapRenderModel(document, {
    width: document.width * MAP_CELL_SIZE,
    height: document.height * MAP_CELL_SIZE,
    currentLayerId: document.layers[0]?.id ?? '',
    aboveLayerOpacity: 0.3,
    viewport: { left: 0, top: 0 },
    bigMap: false,
    passMarks: [],
    ...overrides,
  });
}

/**
 * 造一份画布 props，可按用例覆盖个别字段
 * @param overrides 覆盖的 props
 * @returns 画布 props
 */
function createCanvasProps(overrides: Partial<IMapCanvasProps> = {}): IMapCanvasProps {
  const document = overrides.document ?? createMapDocument();

  return {
    document,
    model: createModel(document),
    currentLayerId: document.layers[0]?.id ?? '',
    viewport: { left: 0, top: 0 },
    bigMap: false,
    brushMode: MapBrushMode.Line,
    pattern: { width: 1, height: 1, tiles: [1] },
    canPaint: true,
    layerName: '基础层',
    narrow: false,
    onCommitCells: vi.fn(),
    onCopyRegion: vi.fn(),
    onPasteAt: vi.fn(),
    onClearRegion: vi.fn(),
    onMoveViewport: vi.fn(),
    onToggleBigMap: vi.fn(),
    ...overrides,
  };
}

/**
 * 取某格中心的视口坐标（jsdom 里画布 left/top 为 0）
 * @param x 格子横坐标
 * @param y 格子纵坐标
 * @returns 视口坐标
 */
function cellPoint(x: number, y: number): { x: number; y: number } {
  return { x: x * MAP_CELL_SIZE + MAP_CELL_SIZE / 2, y: y * MAP_CELL_SIZE + MAP_CELL_SIZE / 2 };
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
 * 装配核心、注册带实例捕获的地图面板类型并打开一张地图
 * @param document 打开时返回的文档
 * @param overrides 覆盖能力注入面
 * @returns 核心与面板实例
 */
async function openPanel(
  document: IMapDocument,
  overrides: Partial<IMapEditorCapabilities> = {},
): Promise<IPanelHarness> {
  const system = await createMapHarness(new FakeFileSystem());
  const panels: MapPanel[] = [];
  const type = createMapPanelType({
    listMaps: async () => [{ id: document.id, name: document.name }],
    openMap: async () => document,
    saveMapData: async (): Promise<void> => {},
    ...overrides,
  });

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
    await system.shellSystem.openPanelInTab(tabId, MAP_PANEL_TYPE_ID, { target: { mapId: document.id } });
  });
  await act(async () => {});

  return { system, panel: panels[0] };
}

/**
 * 渲染完整外壳并等首帧稳定
 * @param harness 核心与面板实例
 */
async function renderShell(harness: IPanelHarness): Promise<void> {
  render(createElement(harness.system.shellSystem.render()));
  await act(async () => {});
}

/**
 * 点一次左键并松开
 * @param target 画布元素
 * @param x 格子横坐标
 * @param y 格子纵坐标
 */
function clickCell(target: Element, x: number, y: number): void {
  const point = cellPoint(x, y);

  dispatchPointer(target, 'pointerdown', { ...point, buttons: 1 });
  dispatchPointer(target, 'pointerup', point);
}

beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1200 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 800 });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('地图画布手势', () => {
  // 线笔刷拖过三格：只提交一次，写入三个格子
  it('线笔刷拖动三格只提交一次', () => {
    const onCommitCells = vi.fn();
    const props = createCanvasProps({ onCommitCells, pattern: { width: 1, height: 1, tiles: [2] } });

    render(<MapCanvas {...props} />);

    const canvas = screen.getByTestId('map-canvas');

    dispatchPointer(canvas, 'pointerdown', { ...cellPoint(0, 0), buttons: 1 });
    dispatchPointer(canvas, 'pointermove', { ...cellPoint(1, 0), buttons: 1 });
    dispatchPointer(canvas, 'pointermove', { ...cellPoint(2, 0), buttons: 1 });
    dispatchPointer(canvas, 'pointerup', cellPoint(2, 0));

    expect(onCommitCells).toHaveBeenCalledTimes(1);

    const writes = onCommitCells.mock.calls[0][0];

    expect(writes.map((write: IPaintWrite) => [write.x, write.y, write.value])).toEqual([
      [0, 0, 2],
      [1, 0, 2],
      [2, 0, 2],
    ]);
  });

  // 矩形笔刷：拖动时出现与拖出范围一致的预览，松开后矩形内四格全部落笔
  it('矩形笔刷预览并在松开时整块落笔', () => {
    const onCommitCells = vi.fn();
    const props = createCanvasProps({ onCommitCells, brushMode: MapBrushMode.Rect });

    render(<MapCanvas {...props} />);

    const canvas = screen.getByTestId('map-canvas');

    dispatchPointer(canvas, 'pointerdown', { ...cellPoint(0, 0), buttons: 1 });
    dispatchPointer(canvas, 'pointermove', { ...cellPoint(1, 1), buttons: 1 });

    expect(screen.getByTestId('map-surface-stub').getAttribute('data-preview')).toBe('0:0:2:2');

    dispatchPointer(canvas, 'pointerup', cellPoint(1, 1));

    expect(onCommitCells).toHaveBeenCalledTimes(1);
    expect(onCommitCells.mock.calls[0][0]).toHaveLength(4);
  });

  // 填充：只替换与点击格同值且四邻域连通的区域
  it('填充只改连通同值区域', () => {
    const onCommitCells = vi.fn();
    const props = createCanvasProps({
      onCommitCells,
      brushMode: MapBrushMode.Fill,
      pattern: { width: 1, height: 1, tiles: [9] },
    });

    render(<MapCanvas {...props} />);

    clickCell(screen.getByTestId('map-canvas'), 0, 2);

    expect(onCommitCells).toHaveBeenCalledTimes(1);

    const writes = onCommitCells.mock.calls[0][0];

    expect(writes.map((write: IPaintWrite) => `${write.x},${write.y}`).sort()).toEqual(['0,2', '1,2']);
    expect(writes.every((write: IPaintWrite) => write.value === 9)).toBe(true);
  });

  // 擦除：空图案写 0
  it('空图案落笔写入 0', () => {
    const onCommitCells = vi.fn();
    const props = createCanvasProps({ onCommitCells, pattern: { width: 1, height: 1, tiles: [0] } });

    render(<MapCanvas {...props} />);

    clickCell(screen.getByTestId('map-canvas'), 1, 0);

    expect(onCommitCells).toHaveBeenCalledTimes(1);
    expect(onCommitCells.mock.calls[0][0]).toEqual([{ x: 1, y: 0, value: 0 }]);
  });

  // 绘制中按右键：取消笔画，不提交、预览消失
  it('绘制中按右键取消笔画且不提交', () => {
    const onCommitCells = vi.fn();
    const props = createCanvasProps({ onCommitCells });

    render(<MapCanvas {...props} />);

    const canvas = screen.getByTestId('map-canvas');

    dispatchPointer(canvas, 'pointerdown', { ...cellPoint(0, 0), buttons: 1 });
    dispatchPointer(canvas, 'pointermove', { ...cellPoint(1, 0), buttons: 1 });
    dispatchPointer(canvas, 'pointerdown', { ...cellPoint(1, 0), button: 2, buttons: 2 });
    dispatchPointer(canvas, 'pointerup', { ...cellPoint(1, 0), button: 2 });

    expect(onCommitCells).not.toHaveBeenCalled();
    expect(screen.getByTestId('map-surface-stub').getAttribute('data-preview')).toBe('');
    expect(screen.queryByTestId('map-menu')).toBeNull();
  });

  // 右键拖拽：框选一块区域，不改文档、不提交
  it('右键拖拽产生选区且不提交', () => {
    const onCommitCells = vi.fn();
    const props = createCanvasProps({ onCommitCells });

    render(<MapCanvas {...props} />);

    const canvas = screen.getByTestId('map-canvas');

    dispatchPointer(canvas, 'pointerdown', { ...cellPoint(0, 0), button: 2, buttons: 2 });
    dispatchPointer(canvas, 'pointermove', { ...cellPoint(1, 2), button: 2, buttons: 2 });
    dispatchPointer(canvas, 'pointerup', { ...cellPoint(1, 2), button: 2 });

    expect(screen.getByTestId('map-surface-stub').getAttribute('data-selection')).toBe('0:0:2:3');
    expect(onCommitCells).not.toHaveBeenCalled();
  });

  // 右键单击：在指针处打开上下文菜单
  it('右键单击打开上下文菜单', () => {
    render(<MapCanvas {...createCanvasProps()} />);

    const canvas = screen.getByTestId('map-canvas');

    dispatchPointer(canvas, 'pointerdown', { ...cellPoint(0, 0), button: 2, buttons: 2 });
    dispatchPointer(canvas, 'pointerup', { ...cellPoint(0, 0), button: 2 });

    expect(screen.getByTestId('map-menu')).not.toBeNull();
  });

  // Escape 三级优先级：先取消笔画，再关菜单，最后清选区
  it('Escape 按笔画 / 菜单 / 选区的顺序生效', () => {
    const onCommitCells = vi.fn();
    const props = createCanvasProps({ onCommitCells });

    render(<MapCanvas {...props} />);

    const canvas = screen.getByTestId('map-canvas');

    dispatchPointer(canvas, 'pointerdown', { ...cellPoint(0, 0), buttons: 1 });
    dispatchPointer(canvas, 'pointermove', { ...cellPoint(1, 0), buttons: 1 });
    fireEvent.keyDown(canvas, { key: 'Escape' });

    expect(screen.getByTestId('map-surface-stub').getAttribute('data-preview')).toBe('');

    dispatchPointer(canvas, 'pointerup', cellPoint(1, 0));

    expect(onCommitCells).not.toHaveBeenCalled();

    dispatchPointer(canvas, 'pointerdown', { ...cellPoint(0, 0), button: 2, buttons: 2 });
    dispatchPointer(canvas, 'pointerup', { ...cellPoint(0, 0), button: 2 });
    fireEvent.keyDown(canvas, { key: 'Escape' });

    expect(screen.queryByTestId('map-menu')).toBeNull();

    dispatchPointer(canvas, 'pointerdown', { ...cellPoint(0, 0), button: 2, buttons: 2 });
    dispatchPointer(canvas, 'pointermove', { ...cellPoint(1, 1), button: 2, buttons: 2 });
    dispatchPointer(canvas, 'pointerup', { ...cellPoint(1, 1), button: 2 });

    expect(screen.getByTestId('map-surface-stub').getAttribute('data-selection')).not.toBe('');

    fireEvent.keyDown(canvas, { key: 'Escape' });

    expect(screen.getByTestId('map-surface-stub').getAttribute('data-selection')).toBe('');
  });

  // 复制 / 粘贴快捷键只在画布聚焦时生效：事件打在容器外不触发，打在画布上触发
  it('复制粘贴只在画布聚焦时生效', () => {
    const onCopyRegion = vi.fn();
    const onPasteAt = vi.fn();
    const props = createCanvasProps({ onCopyRegion, onPasteAt });

    render(
      <div data-test-id="outside">
        <MapCanvas {...props} />
      </div>,
    );

    fireEvent.keyDown(screen.getByTestId('outside'), { key: 'v', ctrlKey: true });

    expect(onPasteAt).not.toHaveBeenCalled();

    const canvas = screen.getByTestId('map-canvas');

    canvas.focus();
    fireEvent.keyDown(canvas, { key: 'c', ctrlKey: true });

    expect(onCopyRegion).toHaveBeenCalledWith({ x: 0, y: 0, width: 1, height: 1 });

    fireEvent.keyDown(canvas, { key: 'v', ctrlKey: true });

    expect(onPasteAt).toHaveBeenCalledWith({ x: 0, y: 0 });
  });

  // 方向键移动视口一格
  it('方向键移动视口一格', () => {
    const onMoveViewport = vi.fn();
    const props = createCanvasProps({ onMoveViewport });

    render(<MapCanvas {...props} />);

    fireEvent.keyDown(screen.getByTestId('map-canvas'), { key: 'ArrowRight' });

    expect(onMoveViewport).toHaveBeenCalledWith(1, 0, false);
  });

  // 大地图下滚轮上下移动、Shift + 滚轮左右移动
  it('大地图下滚轮与 Shift 滚轮移动视口', () => {
    const onMoveViewport = vi.fn();
    const props = createCanvasProps({
      onMoveViewport,
      bigMap: true,
      model: createModel(createMapDocument(), { bigMap: true }),
    });

    render(<MapCanvas {...props} />);

    const canvas = screen.getByTestId('map-canvas');

    fireEvent(canvas, new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 120 }));
    fireEvent(canvas, new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 120, shiftKey: true }));

    expect(onMoveViewport.mock.calls[0]).toEqual([0, 1, false]);
    expect(onMoveViewport.mock.calls[1]).toEqual([1, 0, false]);
  });
});

describe('地图画布叠加层渲染模型', () => {
  // 普通模式渲染模型带网格线
  it('普通模式网格线非空', () => {
    render(<MapCanvas {...createCanvasProps()} />);

    expect(Number(screen.getByTestId('map-surface-stub').getAttribute('data-grid-count'))).toBeGreaterThan(0);
  });

  // 大地图模式不画网格线、不显示标尺
  it('大地图模式没有网格线与标尺', () => {
    const document = createMapDocument();

    render(
      <MapCanvas {...createCanvasProps({ document, bigMap: true, model: createModel(document, { bigMap: true }) })} />,
    );

    expect(screen.getByTestId('map-surface-stub').getAttribute('data-grid-count')).toBe('0');
    expect(screen.queryByTestId('map-ruler-top')).toBeNull();
    expect(screen.queryByTestId('map-ruler-left')).toBeNull();
  });

  // 普通模式显示上方与左侧标尺
  it('普通模式显示行列标尺', () => {
    render(<MapCanvas {...createCanvasProps()} />);

    expect(screen.getByTestId('map-ruler-top')).not.toBeNull();
    expect(screen.getByTestId('map-ruler-left')).not.toBeNull();
  });

  // 拖动预览的宽高等于笔刷图案宽高（多格笔刷不退化成单格）
  it('预览尺寸等于图案宽高', () => {
    const props = createCanvasProps({ pattern: { width: 2, height: 3, tiles: [1, 2, 3, 4, 1, 2] } });

    render(<MapCanvas {...props} />);

    const canvas = screen.getByTestId('map-canvas');

    dispatchPointer(canvas, 'pointerdown', { ...cellPoint(0, 0), buttons: 1 });
    dispatchPointer(canvas, 'pointermove', { ...cellPoint(1, 0), buttons: 1 });

    expect(screen.getByTestId('map-surface-stub').getAttribute('data-preview')).toBe('1:0:2:3');
  });

  // 悬停格进入渲染模型
  it('悬停格进入渲染模型', () => {
    render(<MapCanvas {...createCanvasProps()} />);

    dispatchPointer(screen.getByTestId('map-canvas'), 'pointermove', cellPoint(2, 1));

    expect(screen.getByTestId('map-surface-stub').getAttribute('data-hover')).toBe('2,1');
  });

  // 大地图格边长小于 16px 时通行度降级为红点
  it('大地图小格时通行度改为红点', () => {
    const document = createWideMapDocument(64, 64);
    const model = buildMapRenderModel(document, {
      width: 300,
      height: 300,
      currentLayerId: 'layer-wide',
      aboveLayerOpacity: 0.3,
      viewport: { left: 0, top: 0 },
      bigMap: true,
      passMarks: [
        {
          x: 0,
          y: 0,
          blocked: { up: false, right: false, down: false, left: false },
          dot: false,
        },
      ],
    });

    render(<MapCanvas {...createCanvasProps({ document, bigMap: true, model })} />);

    const stub = screen.getByTestId('map-surface-stub');

    expect(Number(stub.getAttribute('data-pass-count'))).toBeGreaterThan(0);
    expect(stub.getAttribute('data-pass-dots')).toBe(stub.getAttribute('data-pass-count'));
  });
});

describe('地图面板里的画布接线', () => {
  // 粘贴越界时提示被裁剪的格数，且整次粘贴只登记一条撤销
  it('粘贴越界时提示裁剪格数并只登记一条撤销', async () => {
    const harness = await openPanel(createMapDocument());
    const addUndo = vi.spyOn(harness.system.undoSystem, 'addUndoContext');

    harness.panel.copyRegion({ x: 2, y: 1, width: 2, height: 2 });
    harness.panel.pasteAt({ x: 3, y: 2 });

    const state = harness.panel['store'].state;

    expect(state.notice).toBe('已粘贴区域（2 × 2）；超出地图的 3 格已裁剪');
    expect(addUndo).toHaveBeenCalledTimes(1);
  });

  // 切换图层取消进行中的笔画、清除框选，但保留剪贴板
  it('切换图层取消笔画并保留剪贴板', async () => {
    const harness = await openPanel(createMapDocument());

    await renderShell(harness);

    const canvas = screen.getByTestId('map-canvas');

    act(() => {
      harness.panel.copyRegion({ x: 0, y: 0, width: 1, height: 1 });
    });

    dispatchPointer(canvas, 'pointerdown', { ...cellPoint(0, 0), buttons: 1 });
    dispatchPointer(canvas, 'pointermove', { ...cellPoint(1, 0), buttons: 1 });

    expect(screen.getByTestId('map-surface-stub').getAttribute('data-preview')).not.toBe('');

    const addUndo = vi.spyOn(harness.system.undoSystem, 'addUndoContext');

    await act(async () => {
      harness.panel.selectLayer('layer-upper');
    });

    expect(harness.panel['store'].state.currentLayerId).toBe('layer-upper');
    expect(harness.panel['store'].state.clipboard).not.toBeUndefined();
    expect(screen.getByTestId('map-surface-stub').getAttribute('data-preview')).toBe('');

    dispatchPointer(canvas, 'pointerup', cellPoint(1, 0));

    expect(addUndo).not.toHaveBeenCalled();
  });

  // 大地图：进入后滚轮移动视口，退出后回到进入前的视口
  it('大地图退出后还原进入前的视口', async () => {
    const harness = await openPanel(createWideMapDocument(20, 20));

    await renderShell(harness);

    await act(async () => {
      harness.panel.moveViewport(1, 0, false);
      harness.panel.setBigMap(true);
    });

    expect(harness.panel['store'].state.viewport.left).toBe(1);

    const canvas = screen.getByTestId('map-canvas');

    fireEvent(canvas, new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 120 }));

    expect(harness.panel['store'].state.viewport.top).toBe(1);

    await act(async () => {
      harness.panel.setBigMap(false);
    });

    expect(harness.panel['store'].state.bigMap).toBe(false);
    expect(harness.panel['store'].state.viewport).toEqual({ left: 1, top: 0 });
  });

  // 通行度开关：标记由面板算好进入渲染模型，开关不置脏、不进撤销，关闭后清空
  it('显示通行度把面板算好的标记喂给渲染模型', async () => {
    const harness = await openPanel(createMapDocument({ tileGroups: [createTileGroup()] }));

    await renderShell(harness);

    const addUndo = vi.spyOn(harness.system.undoSystem, 'addUndoContext');
    const before = harness.panel['store'].state.document;

    expect(screen.getByTestId('map-surface-stub').getAttribute('data-pass-count')).toBe('0');

    fireEvent.click(screen.getByTestId('map-passability').querySelector('button') as Element);

    await waitFor(() => {
      expect(harness.panel['store'].state.passabilityVisible).toBe(true);
    });

    expect(harness.panel['store'].state.passMarks.length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(Number(screen.getByTestId('map-surface-stub').getAttribute('data-pass-count'))).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByTestId('map-passability').querySelector('button') as Element);

    await waitFor(() => {
      expect(screen.getByTestId('map-surface-stub').getAttribute('data-pass-count')).toBe('0');
    });

    expect(harness.panel['store'].state.document).toBe(before);
    expect(harness.panel['store'].state.unsaved).toBe(false);
    expect(addUndo).not.toHaveBeenCalled();
  });

  // 指针移到第 (3, 5) 格：画布内状态条的「坐标」段跟着变
  it('状态条坐标跟随指针格', async () => {
    const harness = await openPanel(createWideMapDocument(10, 10));

    await renderShell(harness);

    dispatchPointer(screen.getByTestId('map-canvas'), 'pointermove', cellPoint(3, 5));

    expect(screen.getByTestId('map-status').textContent).toContain('(3, 5)');
  });

  // 右键框出 2×3：状态条显示 2×3，Escape 清掉后该段消失
  it('状态条选区跟随框选并能被 Escape 清除', async () => {
    const harness = await openPanel(createWideMapDocument(10, 10));

    await renderShell(harness);

    const canvas = screen.getByTestId('map-canvas');

    dispatchPointer(canvas, 'pointerdown', { ...cellPoint(0, 0), button: 2, buttons: 2 });
    dispatchPointer(canvas, 'pointermove', { ...cellPoint(1, 2), button: 2, buttons: 2 });
    dispatchPointer(canvas, 'pointerup', { ...cellPoint(1, 2), button: 2 });

    expect(screen.getByTestId('map-status').textContent).toContain('2×3');

    fireEvent.keyDown(canvas, { key: 'Escape' });

    expect(screen.getByTestId('map-status').textContent).not.toContain('选区');
  });

  // 图块目录为空：左键不改文档、不登记撤销；换一张目录非空的图后同样点击能写入
  it('图块目录为空时拒绝落笔，目录非空后同一次点击能写入', async () => {
    const empty = createMapDocument({ tileGroups: [] });
    const emptyHarness = await openPanel(empty);

    await renderShell(emptyHarness);

    const emptyUndo = vi.spyOn(emptyHarness.system.undoSystem, 'addUndoContext');

    clickCell(screen.getByTestId('map-canvas'), 0, 1);

    expect(emptyHarness.panel['store'].state.document).toBe(empty);
    expect(emptyHarness.panel['store'].state.unsaved).toBe(false);
    expect(emptyUndo).not.toHaveBeenCalled();

    cleanup();

    const filledHarness = await openPanel(createMapDocument());
    const filledUndo = vi.spyOn(filledHarness.system.undoSystem, 'addUndoContext');
    const before = filledHarness.panel['store'].state.document;

    await renderShell(filledHarness);

    clickCell(screen.getByTestId('map-canvas'), 0, 1);

    expect(filledHarness.panel['store'].state.document).not.toBe(before);
    expect(filledHarness.panel['store'].state.unsaved).toBe(true);
    expect(filledUndo).toHaveBeenCalledTimes(1);
  });

  // 图层不透明度：低于 / 当前层为 1，高于当前层取滑块值；调滑块不置脏、不进撤销
  it('高于当前层的图层按滑块不透明度渲染', async () => {
    const harness = await openPanel(createMapDocument());

    await renderShell(harness);

    const addUndo = vi.spyOn(harness.system.undoSystem, 'addUndoContext');

    await act(async () => {
      harness.panel.setAboveLayerOpacity(0.5);
    });

    const opacity = screen.getByTestId('map-surface-stub').getAttribute('data-opacity') ?? '';

    expect(opacity).toContain('layer-base:1');
    expect(opacity).toContain('layer-upper:0.5');
    expect(harness.panel['store'].state.unsaved).toBe(false);
    expect(addUndo).not.toHaveBeenCalled();
  });
});

describe('地图画布状态条口径', () => {
  // 状态条由画布渲染：坐标段读本地指针、选区段读本地框选
  it('画布内直接渲染状态条', () => {
    render(<MapCanvas {...createCanvasProps()} />);

    const status = screen.getByTestId('map-status');

    expect(status.textContent).toContain('坐标');
    expect(status.textContent).toContain('图层 基础层');
  });

  // 没有选区时状态条不出现选区段
  it('没有选区时状态条省略选区段', () => {
    render(<MapCanvas {...createCanvasProps()} />);

    expect(screen.getByTestId('map-status').textContent).not.toContain('选区');
  });

  // 渲染模型仍由面板视图现算：格子数大于 0，画布只消费
  it('面板视图把现算的渲染模型交给画布', async () => {
    const harness = await openPanel(createMapDocument());

    await renderShell(harness);

    expect(Number(screen.getByTestId('map-surface-stub').getAttribute('data-cell-count'))).toBeGreaterThan(0);
  });

  // 空图层文档在画布上给出「该地图没有图层」并保留棋盘格容器
  it('没有图层时画布显示空图层提示', () => {
    const document = createMapDocument({ layers: [] });

    render(<MapCanvas {...createCanvasProps({ document, model: createModel(document), currentLayerId: '' })} />);

    expect(screen.getByTestId('map-empty-layer').textContent).toBe('该地图没有图层');
    expect(screen.getByTestId('map-canvas').className).toContain('is-empty-layer');
  });

  // 图块目录为空时画布进入只读态（光标与落笔都关闭）
  it('图块目录为空时画布为只读态', async () => {
    const harness = await openPanel(createMapDocument({ tileGroups: [] }));

    await renderShell(harness);

    expect(screen.getByTestId('map-canvas').className).toContain('is-readonly');
  });
});
