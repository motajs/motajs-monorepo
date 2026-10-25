import { cleanup, configure, fireEvent, render, screen } from '@testing-library/react';
import { Store } from '@tanstack/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IMapCanvasProps, MapCanvas } from '../components/MapCanvas';
import { IMapPanelViewProps, MapPanelView } from '../components/MapPanelView';
import { MAP_VIEWPORT_DEFAULT_COLUMNS, MAP_VIEWPORT_DEFAULT_ROWS, MAP_ZOOM_DEFAULT } from '../constants';
import { buildMapRenderModel, IMapRenderView } from '../model/renderModel';
import {
  IMapDocument,
  IMapPanelViewState,
  IMapRenderModel,
  MapBottomTab,
  MapBrushMode,
  MapDialogKind,
  MapImageStatus,
  MapPaletteKind,
  MapPanelStatus,
  MapTileCategory,
} from '../types';
import { TablePanelStatus } from '../../shared/schemaForm/components/TableGrid';
import { createMapDocument, createSizedTileGroup, createWideMapDocument } from './fixtures';

vi.mock('../components/MapSurface', async () => {
  const { createElement: createMockElement } = await import('react');

  return {
    MapSurface: (props: { model: IMapRenderModel }) => {
      const model = props.model;
      const first = model.cells[0];

      return createMockElement('div', {
        'data-test-id': 'map-surface-stub',
        'data-cell-width': String(model.cellWidth),
        'data-cell-height': String(model.cellHeight),
        'data-render-scale': String(model.renderScale),
        'data-cell-rect': first === undefined ? '' : `${first.x}:${first.y}:${first.width}:${first.height}`,
      });
    },
  };
});

configure({ testIdAttribute: 'data-test-id' });

// 显示格基准与整体倍率的视图链路测试：文档 → 渲染模型 → 视图 / 画布。
// Pixi 表面被替换成只回显格度量与倍率的数据属性；画布走真实 MapCanvas，命中换算与绘制消费同一份度量。

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
 * 造一张格子尺寸与素材尺寸都可控的地图文档
 * @param overrides 覆盖文档字段
 * @returns 中立地图文档
 */
function createDocument(overrides: Partial<IMapDocument> = {}): IMapDocument {
  return createMapDocument({
    tileGroups: [createSizedTileGroup({ cellWidth: 64, cellHeight: 64 })],
    ...overrides,
  });
}

/**
 * 造一份默认就绪的面板视图状态
 * @param document 当前地图文档
 * @param overrides 覆盖视图字段
 * @returns 面板视图状态
 */
function createViewState(document: IMapDocument, overrides: Partial<IMapPanelViewState> = {}): IMapPanelViewState {
  return {
    status: MapPanelStatus.Ready,
    summaries: [{ id: document.id, name: document.name }],
    document,
    currentLayerId: document.layers[0]?.id ?? '',
    brushMode: MapBrushMode.Line,
    paletteSelection: {
      kind: MapPaletteKind.Empty,
      pattern: { width: 1, height: 1, tiles: [0] },
      primaryTileNumber: 0,
    },
    recentTiles: [],
    recentStatus: MapImageStatus.Ready,
    dialog: MapDialogKind.None,
    paletteVersion: 0,
    propertiesOpen: false,
    propertiesStatus: TablePanelStatus.NoTarget,
    propertyRows: [],
    passMarks: [],
    aboveLayerOpacity: 0.3,
    passabilityVisible: false,
    bigMap: false,
    viewport: { left: 0, top: 0 },
    unsaved: false,
    saving: false,
    zoom: MAP_ZOOM_DEFAULT,
    bottomTab: MapBottomTab.Recent,
    activeCategory: MapTileCategory.Terrain,
    tilesetOpen: false,
    showFrameCount: false,
    favorites: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    frequentTiles: [],
    viewportColumns: MAP_VIEWPORT_DEFAULT_COLUMNS,
    viewportRows: MAP_VIEWPORT_DEFAULT_ROWS,
    ...overrides,
  };
}

/**
 * 渲染地图面板视图
 * @param document 当前地图文档
 * @param overrides 覆盖视图字段
 */
function renderPanel(document: IMapDocument, overrides: Partial<IMapPanelViewState> = {}): void {
  const store = new Store<IMapPanelViewState>(createViewState(document, overrides));
  const props: IMapPanelViewProps = { store, onSave: vi.fn(), onRetry: vi.fn() };

  render(<MapPanelView {...props} />);
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
    model: buildMapRenderModel(document, {
      width: document.width * 32,
      height: document.height * 32,
      currentLayerId: document.layers[0]?.id ?? '',
      aboveLayerOpacity: 0.3,
      viewport: { left: 0, top: 0 },
      bigMap: false,
      passMarks: [],
    }),
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
    onSetViewport: vi.fn(),
    onToggleBigMap: vi.fn(),
    ...overrides,
  };
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

beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1200 });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('文档声明的格尺寸不进入显示格', () => {
  // 48 × 24 的文档格放 64 × 64 素材：屏幕格仍是 32，素材 contain 到 32 × 32
  it('非正方形文档格不影响显示格', () => {
    renderPanel(createDocument({ cellWidth: 48, cellHeight: 24 }));

    const stub = screen.getByTestId('map-surface-stub');

    expect(stub.getAttribute('data-cell-width')).toBe('32');
    expect(stub.getAttribute('data-cell-height')).toBe('32');
    expect(stub.getAttribute('data-render-scale')).toBe('1');
    expect(stub.getAttribute('data-cell-rect')).toBe('0:0:32:32');
  });

  // 48 × 48 的文档格同样按 32 显示：显示格与文档声明彻底脱钩
  it('正方形文档格也按 32 显示', () => {
    renderPanel(createDocument({ cellWidth: 48, cellHeight: 48 }));

    const stub = screen.getByTestId('map-surface-stub');

    expect(stub.getAttribute('data-cell-width')).toBe('32');
    expect(stub.getAttribute('data-render-scale')).toBe('1');
    expect(stub.getAttribute('data-cell-rect')).toBe('0:0:32:32');
  });
});

describe('缩放经视图进入渲染模型', () => {
  // 同一画布尺寸下 100% 与 200%：屏幕格像素翻倍，而模型的显示格基准仍是 32
  it('100% 与 200% 只差整体倍率', () => {
    renderPanel(createDocument(), { zoom: 1 });

    const normal = screen.getByTestId('map-surface-stub');

    expect(normal.getAttribute('data-cell-width')).toBe('32');
    expect(normal.getAttribute('data-render-scale')).toBe('1');

    cleanup();
    renderPanel(createDocument(), { zoom: 2 });

    const doubled = screen.getByTestId('map-surface-stub');

    expect(doubled.getAttribute('data-cell-width')).toBe('32');
    expect(doubled.getAttribute('data-render-scale')).toBe('2');
    expect(doubled.getAttribute('data-cell-rect')).toBe('0:0:32:32');
  });

  // 150%：模型带倍率 1.5，屏幕格像素 = 32 × 1.5
  it('150% 下倍率是 1.5 而格基准仍是 32', () => {
    renderPanel(createDocument(), { zoom: 1.5 });

    const stub = screen.getByTestId('map-surface-stub');

    expect(stub.getAttribute('data-cell-width')).toBe('32');
    expect(stub.getAttribute('data-cell-height')).toBe('32');
    expect(stub.getAttribute('data-render-scale')).toBe('1.5');
  });

  // 不传 zoom 时按 1 处理：倍率 1、格基准 32
  it('不传缩放时按 1 处理', () => {
    renderPanel(createDocument());

    expect(screen.getByTestId('map-surface-stub').getAttribute('data-cell-width')).toBe('32');
    expect(screen.getByTestId('map-surface-stub').getAttribute('data-render-scale')).toBe('1');
  });
});

describe('大地图命中与绘制同源', () => {
  // 大地图缩略从 (0,0) 起画：视口停在 (100,100) 时点缩略图左上格仍得到 (0,0)
  it('大地图模式用零视口换算命中', () => {
    const document = createWideMapDocument(256, 256);
    const view: IMapRenderView = {
      width: 416,
      height: 416,
      currentLayerId: 'layer-wide',
      aboveLayerOpacity: 0.3,
      viewport: { left: 100, top: 100 },
      bigMap: true,
      passMarks: [],
    };
    const onCommitCells = vi.fn();

    render(
      <MapCanvas
        {...createCanvasProps({
          document,
          model: buildMapRenderModel(document, view),
          bigMap: true,
          viewport: { left: 100, top: 100 },
          onCommitCells,
        })}
      />,
    );

    const canvas = screen.getByTestId('map-canvas');

    dispatchPointer(canvas, 'pointerdown', { x: 1, y: 1, buttons: 1 });
    dispatchPointer(canvas, 'pointerup', { x: 1, y: 1 });

    expect(onCommitCells).toHaveBeenCalledTimes(1);
    expect(onCommitCells.mock.calls[0][0]).toEqual([{ x: 0, y: 0, value: 1 }]);
  });

  // 同一份视口切回普通模式：同样点 (1,1) 要叠加视口得到 (100,100)，证明只有大地图改用零视口
  it('普通模式仍然叠加视口', () => {
    const document = createWideMapDocument(256, 256);
    const view: IMapRenderView = {
      width: 416,
      height: 416,
      currentLayerId: 'layer-wide',
      aboveLayerOpacity: 0.3,
      viewport: { left: 100, top: 100 },
      bigMap: false,
      passMarks: [],
    };
    const onCommitCells = vi.fn();

    render(
      <MapCanvas
        {...createCanvasProps({
          document,
          model: buildMapRenderModel(document, view),
          bigMap: false,
          viewport: { left: 100, top: 100 },
          onCommitCells,
        })}
      />,
    );

    const canvas = screen.getByTestId('map-canvas');

    dispatchPointer(canvas, 'pointerdown', { x: 1, y: 1, buttons: 1 });
    dispatchPointer(canvas, 'pointerup', { x: 1, y: 1 });

    expect(onCommitCells).toHaveBeenCalledTimes(1);
    expect(onCommitCells.mock.calls[0][0]).toEqual([{ x: 100, y: 100, value: 1 }]);
  });
});
