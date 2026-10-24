import { cleanup, configure, render, screen } from '@testing-library/react';
import { Store } from '@tanstack/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TablePanelStatus } from '../../shared/schemaForm/components/TableGrid';
import { IMapPanelViewProps, MapPanelView } from '../components/MapPanelView';
import { MAP_PALETTE_MIN_WIDTH } from '../constants';
import { resolveMapLayout } from '../model/layout';
import {
  IMapPanelViewState,
  IMapRenderModel,
  MapBrushMode,
  MapDialogKind,
  MapImageStatus,
  MapPaletteKind,
  MapPanelStatus,
} from '../types';
import { createMapDocument } from './fixtures';

vi.mock('../components/MapSurface', async () => {
  const { createElement: createMockElement } = await import('react');

  return {
    MapSurface: (props: IMapSurfaceStubProps) =>
      createMockElement('div', {
        'data-test-id': 'map-surface-stub',
        'data-cell-width': props.model.cellWidth === undefined ? '' : String(props.model.cellWidth),
        'data-frame-speed': props.cellFrameSpeed === undefined ? '' : String(props.cellFrameSpeed),
      }),
  };
});

configure({ testIdAttribute: 'data-test-id' });

// 左右两列布局的视图测试：真实的 `MapPanelView` + `MapCanvas`，只有 Pixi 表面被替换成回显数据属性的桩。
// 布局数字一律用 `resolveMapLayout` 现算作为期望值，避免测试自己复制一份公式。

interface IMapSurfaceStubProps {
  /** 这一帧的渲染模型 */
  readonly model: IMapRenderModel;
  /** 动画帧速（毫秒 / 帧） */
  readonly cellFrameSpeed?: number;
}

/**
 * 造一份面板视图状态，可按用例覆盖个别字段
 * @param overrides 覆盖的字段
 * @returns 面板视图状态
 */
function createViewState(overrides: Partial<IMapPanelViewState> = {}): IMapPanelViewState {
  return {
    status: MapPanelStatus.Ready,
    summaries: [{ id: 'map-sample', name: '样例地图' }],
    document: createMapDocument(),
    currentLayerId: 'layer-base',
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
    ...overrides,
  };
}

/**
 * 造一份面板视图 props，可按用例覆盖个别字段
 * @param store 视图状态订阅源
 * @param overrides 覆盖的 props
 * @returns 面板视图 props
 */
function createViewProps(
  store: Store<IMapPanelViewState>,
  overrides: Partial<IMapPanelViewProps> = {},
): IMapPanelViewProps {
  return {
    store,
    onPaintCell: vi.fn(),
    onSave: vi.fn(),
    onRetry: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1200 });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('地图面板左右两列布局', () => {
  // 左列是工具栏 + 地图 + 底部占位，右列是素材区挂载点
  it('左右两列同时存在且左列含工具栏、地图与底部占位', () => {
    const store = new Store<IMapPanelViewState>(createViewState());

    render(<MapPanelView {...createViewProps(store)} />);

    const main = screen.getByTestId('map-main');
    const side = screen.getByTestId('map-sidebar');

    expect(main.querySelector('[data-test-id="map-toolbar"]')).not.toBeNull();
    expect(main.querySelector('[data-test-id="map-canvas"]')).not.toBeNull();
    expect(main.querySelector('.emap-bottom')).not.toBeNull();
    expect(main.querySelector('[data-test-id="map-notice"]')).not.toBeNull();
    expect(side.querySelector('.emap-side-slot')).not.toBeNull();
  });

  // 缩放 1 时右栏宽度就是布局函数给出的 240
  it('缩放 1 时右栏宽度等于布局函数的结果', () => {
    const document = createMapDocument();
    const store = new Store<IMapPanelViewState>(createViewState({ document }));

    render(<MapPanelView {...createViewProps(store)} />);

    const expected = resolveMapLayout(document, { zoom: 1 }).paletteWidth;

    expect(expected).toBe(240);
    expect(screen.getByTestId('map-sidebar').style.width).toBe('240px');
  });

  // 缩放 200% 时右栏收窄，但不低于最小可用宽度
  it('缩放到 200% 时右栏不小于最小可用宽度', () => {
    const document = createMapDocument();
    const store = new Store<IMapPanelViewState>(createViewState({ document, zoom: 2 }));

    render(<MapPanelView {...createViewProps(store)} />);

    const expected = resolveMapLayout(document, { zoom: 2 }).paletteWidth;

    expect(expected).toBe(MAP_PALETTE_MIN_WIDTH);
    expect(screen.getByTestId('map-sidebar').style.width).toBe(`${MAP_PALETTE_MIN_WIDTH}px`);
  });

  // 画布宽度 = 视口格数 × 缩放后的格像素（32px 文档格在 150% 时是 48px）
  it('画布尺寸随缩放后的格像素变化', () => {
    const document = createMapDocument();
    const store = new Store<IMapPanelViewState>(createViewState({ document, zoom: 1.5 }));

    render(<MapPanelView {...createViewProps(store)} />);

    const canvas = screen.getByTestId('map-canvas');

    expect(canvas.style.width).toBe('624px');
    expect(canvas.style.height).toBe('624px');
  });

  // 宿主注入的 15×9 视口进入布局，画布是 480×288
  it('宿主注入 15×9 视口时画布是 480×288', () => {
    const document = createMapDocument();
    const store = new Store<IMapPanelViewState>(createViewState({ document, viewportColumns: 15, viewportRows: 9 }));

    render(<MapPanelView {...createViewProps(store)} />);

    const canvas = screen.getByTestId('map-canvas');

    expect(canvas.style.width).toBe('480px');
    expect(canvas.style.height).toBe('288px');
  });

  // 宿主注入的帧速经视图与画布传到 Pixi 表面（150ms 覆盖默认 300ms）
  it('宿主注入的帧速 150ms 到达 Pixi 表面', () => {
    const store = new Store<IMapPanelViewState>(createViewState());

    render(<MapPanelView {...createViewProps(store, { cellFrameSpeed: 150 })} />);

    expect(screen.getByTestId('map-surface-stub').getAttribute('data-frame-speed')).toBe('150');
  });
});
