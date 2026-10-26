import { act, cleanup, configure, fireEvent, render, screen } from '@testing-library/react';
import { Store } from '@tanstack/store';
import { EditorCore, IEditorPanel, IEditorPanelFactoryParam } from '@motajs/editor-core';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMapPanelType, MAP_PANEL_TYPE_ID, MapPanel } from '..';
import { TablePanelStatus } from '../../shared/schemaForm/components/TableGrid';
import { MapBottomTabs } from '../components/MapBottomTabs';
import { MapFavoriteBar } from '../components/MapFavoriteBar';
import { IMapPanelViewProps, MapPanelView } from '../components/MapPanelView';
import {
  MAP_VIEWPORT_DEFAULT_COLUMNS,
  MAP_VIEWPORT_DEFAULT_ROWS,
  MAP_VIEWPORT_MAX_COUNT,
  MAP_VIEWPORT_MIN_COUNT,
  MAP_ZOOM_DEFAULT,
} from '../constants';
import { resolveMapLayout } from '../model/layout';
import {
  IMapBottomTabsProps,
  IMapDirections,
  IMapDocument,
  IMapEditorCapabilities,
  IMapFavoriteBarProps,
  IMapPaletteSelection,
  IMapPanelViewState,
  IMapRenderModel,
  IMapTileEntry,
  IMapTileGroup,
  MapBottomTab,
  MapBrushMode,
  MapDialogKind,
  MapImageStatus,
  MapPaletteKind,
  MapPanelStatus,
  MapTextureReadType,
  MapTileCategory,
} from '../types';
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
    zoom: MAP_ZOOM_DEFAULT,
    bottomTab: MapBottomTab.Recent,
    activeCategory: MapTileCategory.Terrain,
    showFrameCount: false,
    favorites: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    frequentTiles: [],
    viewportColumns: MAP_VIEWPORT_DEFAULT_COLUMNS,
    viewportRows: MAP_VIEWPORT_DEFAULT_ROWS,
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

/**
 * 取底部当前页的图块编号（按 DOM 顺序）
 * @returns 编号字符串列表
 */
function bottomNumbers(): string[] {
  const tiles = screen.queryAllByTestId(/^map-bottom-tile-/);

  return tiles.map((tile) => (tile.getAttribute('data-test-id') ?? '').slice('map-bottom-tile-'.length));
}

/** 已装配的面板夹具 */
interface IPanelHarness {
  /** 已初始化的编辑器核心 */
  readonly system: EditorCore;
  /** 被捕获的地图面板实例 */
  readonly panel: MapPanel;
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
 * 造一份四方向都可通行的通行属性
 * @returns 四方向都为 true 的通行属性
 */
function createOpenDirections(): IMapDirections {
  return { up: true, right: true, down: true, left: true };
}

/**
 * 造一个普通的图块条目
 * @param number 图块编号
 * @param column 图集列号
 * @returns 图块条目
 */
function createPlainTile(number: number, column: number): IMapTileEntry {
  return {
    number,
    column,
    row: 0,
    name: `图块 ${number}`,
    pass: { out: createOpenDirections(), in: createOpenDirections(), onlyEventLayer: false },
  };
}

/**
 * 造一个含 10 个编号的普通素材组，用来验证收藏满 9 格后的替换
 * @returns 含编号 1..10 的素材组
 */
function createWideTileGroup(): IMapTileGroup {
  const tiles: readonly IMapTileEntry[] = Array.from({ length: 10 }, (_unused, index) =>
    createPlainTile(index + 1, index),
  );

  return {
    id: 'group-wide',
    name: '宽图块',
    imagePath: 'content/map/tiles-wide.png',
    columns: 10,
    tiles,
    category: MapTileCategory.Terrain,
    read: MapTextureReadType.Grid,
    cellWidth: 32,
    cellHeight: 32,
    frames: 1,
  };
}

/**
 * 造一个 Tileset 素材组：编号 31 只属于 Tileset，不能进收藏
 * @returns Tileset 素材组
 */
function createTilesetGroup(): IMapTileGroup {
  return {
    id: 'group-tileset',
    name: '图块集',
    imagePath: 'content/map/tileset.png',
    columns: 2,
    tiles: [createPlainTile(31, 0)],
    category: MapTileCategory.Tileset,
    read: MapTextureReadType.Grid,
    cellWidth: 32,
    cellHeight: 32,
    frames: 1,
    tileset: { cellWidth: 32, cellHeight: 32, columns: 2, rows: 1 },
  };
}

/**
 * 造一个「只收录第 0 行、但来源图片是两行」的地形组
 *
 * 整张图集 128×64，目录里只有 (0,0) / (1,0)：按目录行号算会把第 1 行的图块一起画进同一格（U-25）。
 * @returns 两行地形分组
 */
function createTallTerrainGroup(): IMapTileGroup {
  return {
    id: 'group-tall-terrain',
    name: '两行地形',
    imagePath: 'content/map/tiles-tall-terrain.png',
    columns: 4,
    rows: 2,
    tiles: [createPlainTile(1, 0), createPlainTile(2, 1)],
    category: MapTileCategory.Terrain,
    read: MapTextureReadType.Grid,
    cellWidth: 32,
    cellHeight: 32,
    frames: 1,
  };
}

/**
 * 让面板根元素量到一个固定宽度，模拟真实外壳决定的可用宽度
 * @param width 面板可用宽度（像素）
 */
function stubPanelWidth(width: number): void {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    width,
    height: 0,
    top: 0,
    left: 0,
    right: width,
    bottom: 0,
    toJSON: (): Record<string, never> => ({}),
  });
}

/**
 * 渲染一份带指定文档 / 地图区宽高 / 缩放的面板视图，读回画布的内联宽高后卸载
 * @param document 当前打开的文档
 * @param columns 地图区横向格数
 * @param rows 地图区纵向格数
 * @param zoom 缩放倍率
 * @returns 画布的内联宽高
 */
function measureCanvas(
  document: IMapDocument,
  columns: number,
  rows: number,
  zoom: number,
): { width: string; height: string } {
  const store = new Store<IMapPanelViewState>(
    createViewState({ document, viewportColumns: columns, viewportRows: rows, zoom }),
  );
  const rendered = render(<MapPanelView {...createViewProps(store)} />);
  const canvas = screen.getByTestId('map-canvas');
  const size = { width: canvas.style.width, height: canvas.style.height };

  rendered.unmount();

  return size;
}

beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1200 });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('地图面板左右两列布局', () => {
  // 顶栏通栏在列容器之外；左列是地图 + 底部占位 + 提示行，右列是素材区挂载点
  it('左右两列同时存在且左列含地图、底部占位与提示行', () => {
    const store = new Store<IMapPanelViewState>(createViewState());

    render(<MapPanelView {...createViewProps(store)} />);

    const main = screen.getByTestId('map-main');
    const side = screen.getByTestId('map-sidebar');

    expect(main.querySelector('[data-test-id="map-canvas"]')).not.toBeNull();
    expect(main.querySelector('.emap-bottom')).not.toBeNull();
    expect(main.querySelector('[data-test-id="map-notice"]')).not.toBeNull();
    expect(side.querySelector('.emap-side-slot')).not.toBeNull();
  });

  // 量不到面板宽度时右栏回退到基准 320
  it('量不到面板宽度时右栏回退基准宽度', () => {
    const document = createMapDocument();
    const store = new Store<IMapPanelViewState>(createViewState({ document }));

    render(<MapPanelView {...createViewProps(store)} />);

    const expected = resolveMapLayout({ zoom: 1 }).paletteWidth;

    expect(expected).toBe(320);
    expect(screen.getByTestId('map-sidebar').style.width).toBe('320px');
  });

  // 面板实测 1200：右栏拿剩余 764（地图区 436 = 画布 416 + 标尺 20），不被任何上限截断
  it('面板实测宽度 1200 时右栏 764', () => {
    const document = createMapDocument();
    const store = new Store<IMapPanelViewState>(createViewState({ document }));

    stubPanelWidth(1200);
    render(<MapPanelView {...createViewProps(store)} />);

    const expected = resolveMapLayout({ zoom: 1, availableWidth: 1200 }).paletteWidth;

    expect(expected).toBe(764);
    expect(screen.getByTestId('map-sidebar').style.width).toBe(`${expected}px`);
  });

  // 面板实测 600：右栏拿 164（600 − 436），没有最小宽度夹取
  it('面板实测宽度 600 时右栏 164', () => {
    const document = createMapDocument();
    const store = new Store<IMapPanelViewState>(createViewState({ document }));

    stubPanelWidth(600);
    render(<MapPanelView {...createViewProps(store)} />);

    const expected = resolveMapLayout({ zoom: 1, availableWidth: 600 }).paletteWidth;

    expect(expected).toBe(164);
    expect(screen.getByTestId('map-sidebar').style.width).toBe(`${expected}px`);
  });

  // 面板实测 300 小于地图区：右栏压到 0（证明没有任何 240 下限）
  it('面板实测宽度 300 时右栏 0', () => {
    const document = createMapDocument();
    const store = new Store<IMapPanelViewState>(createViewState({ document }));

    stubPanelWidth(300);
    render(<MapPanelView {...createViewProps(store)} />);

    const expected = resolveMapLayout({ zoom: 1, availableWidth: 300 }).paletteWidth;

    expect(expected).toBe(0);
    expect(screen.getByTestId('map-sidebar').style.width).toBe('0px');
  });

  // 面板实测 2000：右栏跟着变宽（1564 = 2000 − 436），说明素材区拿剩余宽度且没有上限
  it('面板实测宽度 2000 时右栏 1564', () => {
    const document = createMapDocument();
    const store = new Store<IMapPanelViewState>(createViewState({ document }));

    stubPanelWidth(2000);
    render(<MapPanelView {...createViewProps(store)} />);

    const expected = resolveMapLayout({ zoom: 1, availableWidth: 2000 }).paletteWidth;

    expect(expected).toBe(1564);
    expect(screen.getByTestId('map-sidebar').style.width).toBe(`${expected}px`);
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

describe('地图面板顶层结构', () => {
  // 顶栏通栏：它挂在面板根下、在列容器之前，既不在左列也不在两列容器里
  it('顶栏在列容器之外且排在列容器之前', () => {
    const store = new Store<IMapPanelViewState>(createViewState());

    render(<MapPanelView {...createViewProps(store)} />);

    const toolbar = screen.getByTestId('map-toolbar');
    const columns = screen.getByTestId('map-columns');

    expect(toolbar.closest('[data-test-id="map-main"]')).toBeNull();
    expect(toolbar.closest('[data-test-id="map-columns"]')).toBeNull();
    expect(toolbar.parentElement).toBe(screen.getByTestId('map-panel'));
    expect(toolbar.compareDocumentPosition(columns) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  // 两列容器同时装着左列地图区与右列素材区
  it('两列容器同时包含地图区与素材区', () => {
    const store = new Store<IMapPanelViewState>(createViewState());

    render(<MapPanelView {...createViewProps(store)} />);

    const columns = screen.getByTestId('map-columns');

    expect(columns.contains(screen.getByTestId('map-main'))).toBe(true);
    expect(columns.contains(screen.getByTestId('map-sidebar'))).toBe(true);
  });

  // 左列从上到下只有三块：地图主体、底部三页、提示行（顶栏已经不在里面）
  it('左列依次是地图主体、底部三页与提示行', () => {
    const store = new Store<IMapPanelViewState>(createViewState());

    render(<MapPanelView {...createViewProps(store)} />);

    const children = Array.from(screen.getByTestId('map-main').children);

    expect(children).toHaveLength(3);
    expect(children[0].className).toBe('emap-body');
    expect(children[1].getAttribute('data-test-id')).toBe('map-bottom');
    expect(children[2].getAttribute('data-test-id')).toBe('map-notice');
  });
});

describe('画布尺寸跟着地图区宽高与缩放走', () => {
  // 默认 13×13 100% 是 416×416；15×9 是 480×288（控件改的值直接进布局）
  it('13×13 与 15×9 在 100% 下的画布像素', () => {
    expect(measureCanvas(createMapDocument(), 13, 13, 1)).toEqual({ width: '416px', height: '416px' });
    expect(measureCanvas(createMapDocument(), 15, 9, 1)).toEqual({ width: '480px', height: '288px' });
  });

  // 同一 13×13 下缩放是整张画布的等比倍率：200% 翻倍、50% 减半
  it('13×13 在 200% 与 50% 下的画布像素', () => {
    expect(measureCanvas(createMapDocument(), 13, 13, 2)).toEqual({ width: '832px', height: '832px' });
    expect(measureCanvas(createMapDocument(), 13, 13, 0.5)).toEqual({ width: '208px', height: '208px' });
  });

  // 文档声明 48×48 只是数据里的格尺寸，画布仍按 32 基准算：两种文档得到同一个 416
  it('48×48 文档与 32×32 文档画布尺寸相同', () => {
    const small = measureCanvas(createMapDocument({ cellWidth: 32, cellHeight: 32 }), 13, 13, 1);
    const large = measureCanvas(createMapDocument({ cellWidth: 48, cellHeight: 48 }), 13, 13, 1);

    expect(small).toEqual({ width: '416px', height: '416px' });
    expect(large).toEqual(small);
  });
});

describe('顶栏只读图格尺寸', () => {
  // 32×32 的地图显示 32px；换一张声明 48×48 的地图后文案跟着变（取的是文档值，不是常量 32）
  it('换图后图格尺寸标签跟着变', () => {
    const store = new Store<IMapPanelViewState>(
      createViewState({ document: createMapDocument({ id: 'camp', cellWidth: 32, cellHeight: 32 }) }),
    );

    render(<MapPanelView {...createViewProps(store)} />);

    expect(screen.getByTestId('map-cell-size').textContent).toBe('图格尺寸：32px * 32px');

    act((): void => {
      store.setState({
        ...store.state,
        document: createMapDocument({ id: 'detail', cellWidth: 48, cellHeight: 48 }),
      });
    });

    expect(screen.getByTestId('map-cell-size').textContent).toBe('图格尺寸：48px * 48px');
  });
});

describe('面板上的地图区宽高（D-40 / T-4.1-20-02）', () => {
  // 宽高只改视图状态：越界值夹到 1..64，非数保留当前值，视口左上角按新格数重新夹取
  it('宽高夹到 1..64 且重新夹取视口，不置脏', async () => {
    const harness = await openPanel(createWideMapDocument(40, 40));
    const store = harness.panel['store'];

    harness.panel.setViewport(27, 27);
    expect(store.state.viewport).toEqual({ left: 27, top: 27 });

    harness.panel.setViewportSize(1, 1);
    expect(store.state.viewportColumns).toBe(MAP_VIEWPORT_MIN_COUNT);
    expect(store.state.viewportRows).toBe(MAP_VIEWPORT_MIN_COUNT);

    harness.panel.setViewport(39, 39);
    expect(store.state.viewport).toEqual({ left: 39, top: 39 });

    harness.panel.setViewportSize(64, 64);
    expect(store.state.viewportColumns).toBe(MAP_VIEWPORT_MAX_COUNT);
    expect(store.state.viewportRows).toBe(MAP_VIEWPORT_MAX_COUNT);
    expect(store.state.viewport).toEqual({ left: 0, top: 0 });

    harness.panel.setViewportSize(0, 999);
    expect(store.state.viewportColumns).toBe(MAP_VIEWPORT_MIN_COUNT);
    expect(store.state.viewportRows).toBe(MAP_VIEWPORT_MAX_COUNT);

    harness.panel.setViewportSize(Number.NaN, Number.NaN);
    expect(store.state.viewportColumns).toBe(MAP_VIEWPORT_MIN_COUNT);
    expect(store.state.viewportRows).toBe(MAP_VIEWPORT_MAX_COUNT);

    expect(harness.panel.isDirty()).toBe(false);
  });
});

/**
 * 造一份空的调色板选中
 * @returns 空选择
 */
function createEmptySelection(): IMapPaletteSelection {
  return { kind: MapPaletteKind.Empty, pattern: { width: 1, height: 1, tiles: [0] }, primaryTileNumber: 0 };
}

/**
 * 造一份底部三页 props，可按用例覆盖个别字段
 * @param overrides 覆盖的 props
 * @returns 底部三页 props
 */
function createTabsProps(overrides: Partial<IMapBottomTabsProps> = {}): IMapBottomTabsProps {
  return {
    tab: MapBottomTab.Recent,
    recentTiles: [],
    frequentTiles: [],
    favorites: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    groups: createMapDocument().tileGroups,
    groupUrls: { 'group-a': 'blob:group-a', 'group-b': 'blob:group-b' },
    imageStatus: MapImageStatus.Ready,
    selection: createEmptySelection(),
    onSelectTab: vi.fn(),
    onSelectPattern: vi.fn(),
    ...overrides,
  };
}

/**
 * 造一份收藏栏 props，可按用例覆盖个别字段
 * @param overrides 覆盖的 props
 * @returns 收藏栏 props
 */
function createFavoriteProps(overrides: Partial<IMapFavoriteBarProps> = {}): IMapFavoriteBarProps {
  return {
    favorites: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    selection: createEmptySelection(),
    groups: createMapDocument().tileGroups,
    groupUrls: { 'group-a': 'blob:group-a', 'group-b': 'blob:group-b' },
    onSelectSlot: vi.fn(),
    onReorder: vi.fn(),
    reorderDisabled: false,
    ...overrides,
  };
}

describe('地图下方三页签', () => {
  // 三个页签都在，默认页是「最近使用」并显示 recentTiles
  it('三个页签都在且默认显示最近使用', () => {
    render(<MapBottomTabs {...createTabsProps({ recentTiles: [1, 2] })} />);

    expect(screen.getByTestId('map-bottom-tab-recent')).not.toBeNull();
    expect(screen.getByTestId('map-bottom-tab-frequent')).not.toBeNull();
    expect(screen.getByTestId('map-bottom-tab-favorites')).not.toBeNull();
    expect(bottomNumbers()).toEqual(['1', '2']);
  });

  // 点「最常使用」上报页签；切过去后按 frequentTiles 的顺序显示
  it('切到最常使用后按 frequentTiles 的顺序显示', () => {
    const onSelectTab = vi.fn();
    const props = createTabsProps({ frequentTiles: [5, 2, 4], onSelectTab });
    const rendered = render(<MapBottomTabs {...props} />);

    fireEvent.click(screen.getByTestId('map-bottom-tab-frequent'));

    expect(onSelectTab).toHaveBeenCalledWith(MapBottomTab.Frequent);

    rendered.rerender(<MapBottomTabs {...props} tab={MapBottomTab.Frequent} />);

    expect(bottomNumbers()).toEqual(['5', '2', '4']);
  });

  // 收藏页只显示非 0 编号
  it('收藏页过滤掉空位 0', () => {
    render(
      <MapBottomTabs {...createTabsProps({ tab: MapBottomTab.Favorites, favorites: [2, 0, 0, 5, 0, 0, 0, 0, 0] })} />,
    );

    expect(bottomNumbers()).toEqual(['2', '5']);
  });

  // 当前页的每个图块格都按目录 + 图片地址 + 帧矩形真的画出背景
  it('当前页的图块格带真实背景矩形', () => {
    render(<MapBottomTabs {...createTabsProps({ recentTiles: [2] })} />);

    const tile = screen.getByTestId('map-bottom-tile-2');

    expect(tile.getAttribute('data-frame-rect')).toBe('32,0,32,32');
    expect(tile.style.backgroundPosition).toBe('-32px 0px');
    expect(tile.style.backgroundSize).toBe('64px 32px');
    expect(tile.style.backgroundImage).toContain('blob:group-a');
  });

  // 同一组里第二格靠负偏移截取，说明一个按钮只显示一个源格（不是靠尺寸碰巧）
  it('同一组里第二格用负偏移截取', () => {
    render(<MapBottomTabs {...createTabsProps({ recentTiles: [1, 2] })} />);

    expect(screen.getByTestId('map-bottom-tile-1').style.backgroundPosition).toBe('0px 0px');
    expect(screen.getByTestId('map-bottom-tile-2').style.backgroundPosition).toBe('-32px 0px');
  });

  // 图片就绪后不再停在「正在加载」；点某格上报 1×1 的最近使用选中
  it('图片就绪后显示图块并能点出 1×1 选择', () => {
    const onSelectPattern = vi.fn();

    render(<MapBottomTabs {...createTabsProps({ recentTiles: [1], onSelectPattern })} />);

    expect(screen.queryByTestId('map-bottom-loading')).toBeNull();

    fireEvent.click(screen.getByTestId('map-bottom-tile-1'));

    expect(onSelectPattern).toHaveBeenCalledWith({
      kind: MapPaletteKind.Recent,
      pattern: { width: 1, height: 1, tiles: [1] },
      primaryTileNumber: 1,
    });
  });

  // 最近使用页只画缩略图：格子里没有编号文本，悬停 / 无障碍文案用图块名
  it('最近使用格没有编号文本且 title 用图块名', () => {
    render(<MapBottomTabs {...createTabsProps({ recentTiles: [1, 2] })} />);

    const first = screen.getByTestId('map-bottom-tile-1');
    const second = screen.getByTestId('map-bottom-tile-2');

    expect(first.textContent).toBe('');
    expect(second.textContent).toBe('');
    expect(first.getAttribute('title')).toBe('图块 1');
    expect(second.getAttribute('title')).toBe('图块 2');
  });

  // 空列表显示「暂无记录」
  it('空列表显示暂无记录', () => {
    render(<MapBottomTabs {...createTabsProps({ recentTiles: [] })} />);

    expect(screen.getByTestId('map-bottom-empty').textContent).toBe('暂无记录');
  });

  // U-25 回归：只收录第 0 行、图片两行的地形组，整张图集按 128×64 贴图，第二格靠负偏移取第二列
  it('两行地形组在底部三页按整张 128×64 贴图', () => {
    const group = createTallTerrainGroup();
    const groupUrls = { [group.id]: 'blob:tall-terrain' };

    render(<MapBottomTabs {...createTabsProps({ recentTiles: [1, 2], groups: [group], groupUrls })} />);

    const first = screen.getByTestId('map-bottom-tile-1');
    const second = screen.getByTestId('map-bottom-tile-2');

    expect(first.getAttribute('data-frame-rect')).toBe('0,0,32,32');
    expect(first.style.backgroundSize).toBe('128px 64px');
    expect(first.style.backgroundPosition).toBe('0px 0px');
    expect(second.style.backgroundSize).toBe('128px 64px');
    expect(second.style.backgroundPosition).toBe('-32px 0px');
  });
});

describe('收藏栏与排序', () => {
  // 1 个擦除格 + 9 个收藏格，测试标识完整
  it('擦除格与 9 个收藏格都在', () => {
    render(<MapFavoriteBar {...createFavoriteProps()} />);

    expect(screen.getByTestId('map-favorite-erase')).not.toBeNull();

    for (let index = 0; index < 9; index += 1) {
      expect(screen.getByTestId(`map-favorite-${index}`)).not.toBeNull();
    }
  });

  // 擦除格上报 0，第 i 个收藏格上报 i + 1
  it('擦除格上报 0，收藏格按 1..9 上报', () => {
    const onSelectSlot = vi.fn();

    render(<MapFavoriteBar {...createFavoriteProps({ onSelectSlot })} />);

    fireEvent.click(screen.getByTestId('map-favorite-erase'));
    fireEvent.click(screen.getByTestId('map-favorite-0'));
    fireEvent.click(screen.getByTestId('map-favorite-8'));

    expect(onSelectSlot.mock.calls.map((call) => call[0])).toEqual([0, 1, 9]);
  });

  // 上下移动按钮已经删掉，排序只剩拖拽
  it('不再有上移 / 下移按钮', () => {
    render(<MapFavoriteBar {...createFavoriteProps({ favorites: [2, 3, 0, 0, 0, 0, 0, 0, 0] })} />);

    expect(screen.queryByTestId('map-favorite-up-0')).toBeNull();
    expect(screen.queryAllByTestId(/^map-favorite-(up|down)-/)).toHaveLength(0);
  });

  // 收藏格写的是「按哪个数字键选它」：2…9、0；擦除格是 1；图块编号不再出现在可见文本里
  it('收藏格显示槽位键而不是图块编号', () => {
    render(<MapFavoriteBar {...createFavoriteProps({ favorites: [3, 4, 0, 0, 0, 0, 0, 0, 0] })} />);

    expect(screen.getByTestId('map-favorite-key-erase').textContent).toBe('1');
    expect(screen.getByTestId('map-favorite-key-0').textContent).toBe('2');
    expect(screen.getByTestId('map-favorite-key-7').textContent).toBe('9');
    expect(screen.getByTestId('map-favorite-key-8').textContent).toBe('0');
    expect(screen.getByTestId('map-favorite-0').textContent).toBe('2');
    expect(screen.getByTestId('map-favorite-1').textContent).toBe('3');
  });

  // 拖拽：按下起点格、进入目标格、在目标格松开后上报 from / to
  it('拖拽上报起点与目标槽位', () => {
    const onReorder = vi.fn();

    render(<MapFavoriteBar {...createFavoriteProps({ favorites: [2, 3, 5, 0, 0, 0, 0, 0, 0], onReorder })} />);

    fireEvent.pointerDown(screen.getByTestId('map-favorite-0'));
    fireEvent.pointerEnter(screen.getByTestId('map-favorite-2'));
    fireEvent.pointerUp(screen.getByTestId('map-favorite-2'));

    expect(onReorder).toHaveBeenCalledWith(0, 2);
  });

  // 拖拽视觉反馈：源格降不透明度、悬停目标加描边，松手后两种类名都清掉
  it('拖拽时源格带 is-dragging、悬停目标带 is-drag-over，松手后都消失', () => {
    const onReorder = vi.fn();

    render(<MapFavoriteBar {...createFavoriteProps({ favorites: [3, 4, 0, 0, 0, 0, 0, 0, 0], onReorder })} />);

    const source = screen.getByTestId('map-favorite-0');
    const target = screen.getByTestId('map-favorite-1');

    fireEvent.pointerDown(source);

    expect(source.classList.contains('is-dragging')).toBe(true);
    expect(target.classList.contains('is-dragging')).toBe(false);

    fireEvent.pointerEnter(target);

    expect(target.classList.contains('is-drag-over')).toBe(true);
    expect(source.classList.contains('is-dragging')).toBe(true);
    expect(source.classList.contains('is-drag-over')).toBe(false);

    fireEvent.pointerUp(target);

    expect(onReorder).toHaveBeenCalledWith(0, 1);
    expect(source.classList.contains('is-dragging')).toBe(false);
    expect(target.classList.contains('is-drag-over')).toBe(false);
  });

  // 空位是空格子；有编号的收藏格带真实背景矩形
  it('空位不画图块，有编号的格子带真实背景矩形', () => {
    render(<MapFavoriteBar {...createFavoriteProps({ favorites: [2, 0, 0, 0, 0, 0, 0, 0, 0] })} />);

    const filled = screen.getByTestId('map-favorite-0');
    const empty = screen.getByTestId('map-favorite-1');

    expect(filled.getAttribute('data-tile-number')).toBe('2');
    expect(filled.style.backgroundPosition).toBe('-32px 0px');
    expect(filled.style.backgroundSize).toBe('64px 32px');
    expect(empty.getAttribute('data-tile-number')).toBe('0');
    expect(empty.style.backgroundImage).toBe('');
  });

  // U-25 回归：收藏栏里的两行地形组同样按整张 128×64 贴图，一格只显示一个 32×32 源格
  it('两行地形组在收藏栏按整张 128×64 贴图', () => {
    const group = createTallTerrainGroup();
    const groupUrls = { [group.id]: 'blob:tall-terrain' };

    render(
      <MapFavoriteBar
        {...createFavoriteProps({ favorites: [1, 2, 0, 0, 0, 0, 0, 0, 0], groups: [group], groupUrls })}
      />,
    );

    expect(screen.getByTestId('map-favorite-0').style.backgroundSize).toBe('128px 64px');
    expect(screen.getByTestId('map-favorite-0').style.backgroundPosition).toBe('0px 0px');
    expect(screen.getByTestId('map-favorite-1').style.backgroundSize).toBe('128px 64px');
    expect(screen.getByTestId('map-favorite-1').style.backgroundPosition).toBe('-32px 0px');
  });
});

describe('底部三页与收藏栏接线', () => {
  // 两件都挂在 .emap-bottom 里，并从视图状态拿到各自的编号
  it('底部区域同时挂着收藏栏与三页签', () => {
    const store = new Store<IMapPanelViewState>(
      createViewState({ favorites: [2, 0, 0, 0, 0, 0, 0, 0, 0], recentTiles: [1] }),
    );

    render(<MapPanelView {...createViewProps(store)} />);

    const bottom = screen.getByTestId('map-bottom');

    expect(bottom.querySelector('[data-test-id="map-favorite-erase"]')).not.toBeNull();
    expect(bottom.querySelector('[data-test-id="map-bottom-tab-recent"]')).not.toBeNull();
    expect(screen.getByTestId('map-favorite-0').getAttribute('data-tile-number')).toBe('2');
    expect(bottomNumbers()).toEqual(['1']);
  });

  // 端到端：点页签 / 右键收藏 / 点收藏格 / 点擦除格后，面板状态真的变化
  it('端到端：点页签、右键图块、点收藏格与擦除格都改面板状态', async () => {
    const harness = await openPanel(createMapDocument({ tileGroups: [createTileGroup()] }));

    await renderShell(harness);

    fireEvent.click(screen.getByTestId('map-bottom-tab-frequent'));
    await act(async () => {});

    expect(harness.panel['store'].state.bottomTab).toBe(MapBottomTab.Frequent);

    fireEvent.contextMenu(screen.getByTestId('map-tile-2'));
    await act(async () => {});

    expect(harness.panel['store'].state.favorites ?? []).toContain(2);
    expect(screen.getByTestId('map-favorite-0').getAttribute('data-tile-number')).toBe('2');

    fireEvent.click(screen.getByTestId('map-favorite-0'));
    await act(async () => {});

    expect(harness.panel['store'].state.paletteSelection.primaryTileNumber).toBe(2);
    expect(harness.panel['store'].state.paletteSelection.kind).toBe(MapPaletteKind.Tiles);

    fireEvent.click(screen.getByTestId('map-favorite-erase'));
    await act(async () => {});

    expect(harness.panel['store'].state.paletteSelection.kind).toBe(MapPaletteKind.Empty);
  });

  // 数字键 1 选擦除、2..9 选收藏位、0 选第 9 位；事件被 preventDefault
  it('数字键按 1 / 2..9 / 0 选中擦除与收藏位', async () => {
    const harness = await openPanel(createMapDocument({ tileGroups: [createTileGroup()] }));

    await renderShell(harness);

    await act(async () => {
      harness.panel.addFavorite(2);
    });

    const canvas = screen.getByTestId('map-canvas');

    canvas.focus();

    expect(fireEvent.keyDown(canvas, { key: '2' })).toBe(false);
    await act(async () => {});

    expect(harness.panel['store'].state.paletteSelection.primaryTileNumber).toBe(2);

    expect(fireEvent.keyDown(canvas, { key: '1' })).toBe(false);
    await act(async () => {});

    expect(harness.panel['store'].state.paletteSelection.kind).toBe(MapPaletteKind.Empty);

    expect(fireEvent.keyDown(canvas, { key: '0' })).toBe(false);
    await act(async () => {});

    expect(harness.panel['store'].state.paletteSelection.kind).toBe(MapPaletteKind.Empty);
  });

  // 焦点不在画布上也能用：聚焦素材区图块按钮后按 2 仍然选中收藏位
  it('焦点在素材区时数字键仍然生效', async () => {
    const harness = await openPanel(createMapDocument({ tileGroups: [createTileGroup()] }));

    await renderShell(harness);

    await act(async () => {
      harness.panel.addFavorite(2);
    });

    const tile = screen.getByTestId('map-tile-2');

    tile.focus();

    expect(tile.ownerDocument.activeElement).toBe(tile);

    expect(fireEvent.keyDown(tile, { key: '2' })).toBe(false);
    await act(async () => {});

    expect(harness.panel['store'].state.paletteSelection.primaryTileNumber).toBe(2);
  });

  // 输入框里的数字是打字：既不选槽位，也不被 preventDefault
  it('输入框内的数字键不拦截', async () => {
    const harness = await openPanel(createMapDocument({ tileGroups: [createTileGroup()] }));

    await renderShell(harness);

    await act(async () => {
      harness.panel.addFavorite(2);
    });

    const input = screen.getByTestId<HTMLInputElement>('map-viewport-columns');
    const before = harness.panel['store'].state.paletteSelection;

    expect(input.disabled).toBe(false);
    expect(fireEvent.keyDown(input, { key: '2' })).toBe(true);

    await act(async () => {});

    expect(harness.panel['store'].state.paletteSelection).toBe(before);
  });

  // 点面板空白处（map-main，本身不接受焦点）后焦点落到面板根，数字键仍然生效（U-26）
  it('点面板空白处后数字键仍然生效', async () => {
    const harness = await openPanel(createMapDocument({ tileGroups: [createTileGroup()] }));

    await renderShell(harness);

    await act(async () => {
      harness.panel.addFavorite(2);
    });

    const panel = screen.getByTestId('map-panel');

    fireEvent.pointerDown(screen.getByTestId('map-main'));

    expect(panel.ownerDocument.activeElement).toBe(panel);

    expect(fireEvent.keyDown(panel.ownerDocument.activeElement!, { key: '2' })).toBe(false);

    await act(async () => {});

    expect(harness.panel['store'].state.paletteSelection.primaryTileNumber).toBe(2);
  });

  // 点输入框时面板根不抢焦点：焦点不搬到面板根，框里的数字也不被拦截
  it('点输入框不会把焦点抢到面板根', async () => {
    const harness = await openPanel(createMapDocument({ tileGroups: [createTileGroup()] }));

    await renderShell(harness);

    await act(async () => {
      harness.panel.addFavorite(2);
    });

    const panel = screen.getByTestId('map-panel');
    const input = screen.getByTestId('map-viewport-columns');
    const before = harness.panel['store'].state.paletteSelection;

    fireEvent.pointerDown(input);

    expect(panel.ownerDocument.activeElement).not.toBe(panel);

    expect(fireEvent.keyDown(input, { key: '2' })).toBe(true);

    await act(async () => {});

    expect(harness.panel['store'].state.paletteSelection).toBe(before);
  });

  // 点工具栏空白处时焦点照样落到面板根，数字键随之在整个面板内生效
  it('点工具栏空白处后数字键仍然生效', async () => {
    const harness = await openPanel(createMapDocument({ tileGroups: [createTileGroup()] }));

    await renderShell(harness);

    await act(async () => {
      harness.panel.addFavorite(2);
    });

    const panel = screen.getByTestId('map-panel');

    fireEvent.pointerDown(screen.getByTestId('map-toolbar'));

    expect(panel.ownerDocument.activeElement).toBe(panel);

    expect(fireEvent.keyDown(panel, { key: '2' })).toBe(false);

    await act(async () => {});

    expect(harness.panel['store'].state.paletteSelection.primaryTileNumber).toBe(2);

    expect(fireEvent.keyDown(panel, { key: '1' })).toBe(false);

    await act(async () => {});

    expect(harness.panel['store'].state.paletteSelection.kind).toBe(MapPaletteKind.Empty);
  });

  // Tileset 编号不能进收藏，普通编号可以
  it('右键收藏只接受目录内且非 Tileset 的编号', async () => {
    const document = createMapDocument({ tileGroups: [createTileGroup(), createTilesetGroup()] });
    const harness = await openPanel(document);

    await act(async () => {
      harness.panel.addFavorite(31);
      harness.panel.addFavorite(1);
    });

    expect(harness.panel['store'].state.favorites ?? []).not.toContain(31);
    expect(harness.panel['store'].state.favorites ?? []).toContain(1);
  });

  // 9 格全满时替换第 9 位，不会越界
  it('收藏满时替换第 9 位', async () => {
    const document = createMapDocument({ tileGroups: [createWideTileGroup()] });
    const harness = await openPanel(document);

    for (let number = 1; number <= 9; number += 1) {
      await act(async () => {
        harness.panel.addFavorite(number);
      });
    }

    await act(async () => {
      harness.panel.addFavorite(10);
    });

    const favorites = harness.panel['store'].state.favorites ?? [];

    expect(favorites).toHaveLength(9);
    expect(favorites[8]).toBe(10);
    expect(favorites.slice(0, 8)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  // 已收藏的编号不会被重复占两个位置
  it('重复收藏同一编号只占一格', async () => {
    const harness = await openPanel(createMapDocument({ tileGroups: [createTileGroup()] }));

    await act(async () => {
      harness.panel.addFavorite(2);
      harness.panel.addFavorite(2);
    });

    const favorites = harness.panel['store'].state.favorites ?? [];

    expect(favorites.filter((number) => number === 2)).toHaveLength(1);
  });
});
