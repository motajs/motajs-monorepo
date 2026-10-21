import { cleanup, configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Store } from '@tanstack/store';
import { EditorCore, IEditorPanel, IEditorPanelFactoryParam } from '@motajs/editor-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMapPanelType, MAP_PANEL_TYPE_ID, MapPanel } from '..';
import { buildTableTree } from '../../shared/schemaForm/model/traversal';
import { TablePanelStatus } from '../../shared/schemaForm/components/TableGrid';
import { ITableSchemaNode } from '../../shared/schemaForm/types';
import { MapPanelView, IMapPanelViewProps } from '../components/MapPanelView';
import { MapStatusBar } from '../components/MapStatusBar';
import { MapToolbar, IMapToolbarProps } from '../components/MapToolbar';
import {
  IMapDocument,
  IMapEditorCapabilities,
  IMapPanelViewState,
  IMapSummary,
  MapBrushMode,
  MapDialogKind,
  MapImageStatus,
  MapPanelStatus,
  MapPaletteKind,
  MapUnsavedChoice,
} from '../types';
import { createMapDocument, createMapHarness, FakeFileSystem } from './fixtures';

vi.mock('../components/MapSurface', async () => {
  const { createElement: createMockElement } = await import('react');

  return {
    MapSurface: (): ReturnType<typeof createMockElement> =>
      createMockElement('div', { 'data-test-id': 'map-surface-stub' }),
  };
});

configure({ testIdAttribute: 'data-test-id' });

// 工具栏 / 状态条 / 视图装配测试：工具栏与状态条按受控 props 直接渲染；
// 弹窗、抽屉与属性入口经面板视图装配，必要时由真实面板实例驱动。

const PROPERTY_SCHEMA: ITableSchemaNode = {
  type: 'object',
  properties: { name: { type: 'string' } },
};

/**
 * 造一份工具栏的完整 props，可按用例覆盖个别字段
 * @param overrides 覆盖的 props
 * @returns 工具栏 props
 */
function createToolbarProps(overrides: Partial<IMapToolbarProps> = {}): IMapToolbarProps {
  const document = createMapDocument();

  return {
    status: MapPanelStatus.Ready,
    mapSummaries: [
      { id: 'm1', name: '地图一' },
      { id: 'm2', name: '地图二' },
    ],
    currentMapId: 'm1',
    canCreateMap: true,
    canOpenProperties: true,
    unsaved: false,
    saving: false,
    onSelectMap: vi.fn(),
    onOpenCreate: vi.fn(),
    onOpenProperties: vi.fn(),
    onSave: vi.fn(),
    onRetry: vi.fn(),
    showEditRow: true,
    layers: document.layers,
    currentLayerId: 'layer-base',
    canAddLayer: true,
    brushMode: MapBrushMode.Line,
    passabilityVisible: false,
    bigMap: false,
    onSelectLayer: vi.fn(),
    onOpenAddLayer: vi.fn(),
    aboveLayerOpacity: 0.3,
    onAboveLayerOpacityChange: vi.fn(),
    onSelectBrushMode: vi.fn(),
    onTogglePassability: vi.fn(),
    onToggleBigMap: vi.fn(),
    onMoveViewport: vi.fn(),
    ...overrides,
  };
}

/**
 * 造一份面板视图状态，可按用例覆盖个别字段
 * @param overrides 覆盖的字段
 * @returns 面板视图状态
 */
function createViewState(overrides: Partial<IMapPanelViewState> = {}): IMapPanelViewState {
  return {
    status: MapPanelStatus.Ready,
    summaries: [
      { id: 'map-sample', name: '样例地图' },
      { id: 'm2', name: '地图二' },
    ],
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

/**
 * 把弹窗开关写回订阅源，模拟面板的 `openDialog` / `closeDialog`
 * @param store 视图状态订阅源
 * @param kind 目标弹窗
 */
function setDialog(store: Store<IMapPanelViewState>, kind: MapDialogKind): void {
  store.setState({ ...store.state, dialog: kind });
}

beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1200 });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('地图工具栏', () => {
  // 加载中：编辑控件全部禁用，地图切换与重试仍可用
  it('加载中编辑控件禁用且切换与重试可用', () => {
    render(<MapToolbar {...createToolbarProps({ status: MapPanelStatus.Loading })} />);

    expect(screen.getByTestId<HTMLButtonElement>('map-new').disabled).toBe(true);
    expect(screen.getByTestId<HTMLButtonElement>('map-layer-add').disabled).toBe(true);
    expect(screen.getByTestId('map-layer-mode').getAttribute('data-disabled')).toBe('true');
    expect(screen.getByTestId('map-brush-mode').getAttribute('data-disabled')).toBe('true');
    expect(screen.getByTestId('map-passability').querySelector('button')?.disabled).toBe(true);
    expect(screen.getByTestId<HTMLButtonElement>('map-bigmap').disabled).toBe(true);
    expect(screen.getByTestId<HTMLButtonElement>('map-save').disabled).toBe(true);
    expect(screen.getByTestId('map-select').getAttribute('data-disabled')).toBe('false');
    expect(screen.getByTestId<HTMLButtonElement>('map-toolbar-retry').disabled).toBe(false);
  });

  // 失败态：编辑控件禁用，只保留地图切换与重试可用
  it('失败态只有切换与重试可用', () => {
    render(<MapToolbar {...createToolbarProps({ status: MapPanelStatus.Error })} />);

    expect(screen.getByTestId<HTMLButtonElement>('map-new').disabled).toBe(true);
    expect(screen.getByTestId<HTMLButtonElement>('map-layer-add').disabled).toBe(true);
    expect(screen.getByTestId('map-brush-mode').getAttribute('data-disabled')).toBe('true');
    expect(screen.getByTestId<HTMLButtonElement>('map-bigmap').disabled).toBe(true);
    expect(screen.getByTestId<HTMLButtonElement>('map-save').disabled).toBe(true);
    expect(screen.getByTestId('map-select').getAttribute('data-disabled')).toBe('false');
    expect(screen.getByTestId<HTMLButtonElement>('map-toolbar-retry').disabled).toBe(false);
  });

  // 就绪且干净：保存禁用，不显示「未保存」
  it('就绪且干净时保存禁用且无未保存标记', () => {
    render(<MapToolbar {...createToolbarProps()} />);

    expect(screen.getByTestId<HTMLButtonElement>('map-save').disabled).toBe(true);
    expect(screen.queryByTestId('map-unsaved')).toBeNull();
  });

  // 就绪且有改动：保存可用并出现「未保存」
  it('就绪且脏时保存可用并出现未保存标记', () => {
    render(<MapToolbar {...createToolbarProps({ unsaved: true })} />);

    expect(screen.getByTestId<HTMLButtonElement>('map-save').disabled).toBe(false);
    expect(screen.getByTestId('map-unsaved').textContent).toBe('未保存');
  });

  // 无属性 Schema：属性入口禁用并给出固定 tooltip 文案
  it('无属性配置时属性入口禁用并给出 tooltip 文案', () => {
    render(<MapToolbar {...createToolbarProps({ canOpenProperties: false })} />);

    const button = screen.getByTestId<HTMLButtonElement>('map-properties');

    expect(button.disabled).toBe(true);
    expect(button.title).toBe('当前项目未提供地图属性配置。');
  });

  // 窄于 900px 时出现「视图」下拉，宽屏时不出现
  it('窄宽度出现视图下拉而宽屏不出现', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 800 });
    render(<MapToolbar {...createToolbarProps()} />);

    expect(screen.queryByTestId('map-view-menu')).not.toBeNull();

    cleanup();
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1200 });
    render(<MapToolbar {...createToolbarProps()} />);

    expect(screen.queryByTestId('map-view-menu')).toBeNull();
    expect(screen.queryByTestId('map-bigmap')).not.toBeNull();
  });

  // 地图名过长时通过 title 暴露全名
  it('当前地图名过长时 title 等于全名', () => {
    const longName = '这是一张名字非常非常长以至于必须省略显示的地图';

    render(
      <MapToolbar
        {...createToolbarProps({
          mapSummaries: [{ id: 'm-long', name: longName }],
          currentMapId: 'm-long',
        })}
      />,
    );

    const name = screen.getByTestId('map-select').querySelector('.emap-toolbar-map-name');

    expect(name?.getAttribute('title')).toBe(longName);
  });

  // 未打开地图时第二行整行不渲染，第一行仍在
  it('showEditRow 为假时第二行不渲染且第一行仍在', () => {
    render(<MapToolbar {...createToolbarProps({ status: MapPanelStatus.NotOpened, showEditRow: false })} />);

    expect(screen.getByTestId('map-toolbar')).not.toBeNull();
    expect(screen.getByTestId('map-new')).not.toBeNull();
    expect(screen.queryByTestId('map-layer-mode')).toBeNull();
    expect(screen.queryByTestId('map-layer-add')).toBeNull();
    expect(screen.queryByTestId('map-brush-mode')).toBeNull();
    expect(screen.queryByTestId('map-passability')).toBeNull();
    expect(screen.queryByTestId('map-bigmap')).toBeNull();
    expect(screen.queryByTestId('map-viewport-left')).toBeNull();
  });

  // 宿主没有新建能力：新建入口禁用并给出固定 tooltip 文案
  it('无新建能力时新建入口禁用并给出 tooltip 文案', () => {
    render(<MapToolbar {...createToolbarProps({ canCreateMap: false })} />);

    const button = screen.getByTestId<HTMLButtonElement>('map-new');

    expect(button.disabled).toBe(true);
    expect(button.title).toBe('当前项目不支持新建地图。');
  });

  // 属性入口可点时只上报 onOpenProperties，工具栏自己不判断是否开抽屉
  it('点属性入口只上报一次打开意图', () => {
    const onOpenProperties = vi.fn();

    render(<MapToolbar {...createToolbarProps({ onOpenProperties })} />);
    fireEvent.click(screen.getByTestId('map-properties'));

    expect(onOpenProperties).toHaveBeenCalledTimes(1);
  });

  // 当前层不是最上层时滑块可用并显示传入值；当前层是最上层时禁用
  it('高于当前层的不透明度滑块按当前层位置启用或禁用', () => {
    render(<MapToolbar {...createToolbarProps()} />);

    const slider = screen.getByRole('slider');

    expect(slider.getAttribute('aria-valuenow')).toBe('0.3');
    expect(screen.getByTestId('map-layer-opacity').querySelector('.ant-slider')?.className).not.toContain(
      'ant-slider-disabled',
    );

    cleanup();
    render(<MapToolbar {...createToolbarProps({ currentLayerId: 'layer-upper' })} />);

    expect(screen.getByTestId('map-layer-opacity').querySelector('.ant-slider')?.className).toContain(
      'ant-slider-disabled',
    );
  });

  // 拖动滑块只把新值回调出去，不自行改状态
  it('拖动不透明度滑块回调新值', () => {
    const onAboveLayerOpacityChange = vi.fn();

    render(<MapToolbar {...createToolbarProps({ onAboveLayerOpacityChange })} />);
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight', keyCode: 39 });

    expect(onAboveLayerOpacityChange).toHaveBeenCalled();
    expect(onAboveLayerOpacityChange.mock.calls[0][0]).toBeGreaterThan(0.3);
  });
});

describe('地图状态条', () => {
  // 就绪时五段齐全：坐标 / 选区 / 地图 / 图层 / 模式
  it('显示坐标、选区、地图、图层与模式五段', () => {
    render(
      <MapStatusBar
        cursor={{ x: 1, y: 2 }}
        selection={{ x: 1, y: 2, width: 2, height: 3 }}
        mapSize={{ width: 4, height: 3 }}
        layerName="基础层"
        bigMap={false}
        narrow={false}
      />,
    );

    const text = screen.getByTestId('map-status').textContent ?? '';

    expect(text).toContain('坐标');
    expect(text).toContain('选区');
    expect(text).toContain('地图');
    expect(text).toContain('图层');
    expect(text).toContain('模式');
  });

  // 没有选区：不渲染选区段
  it('没有选区时不渲染选区段', () => {
    render(
      <MapStatusBar
        cursor={{ x: 1, y: 2 }}
        mapSize={{ width: 4, height: 3 }}
        layerName="基础层"
        bigMap
        narrow={false}
      />,
    );

    expect(screen.getByTestId('map-status').textContent).not.toContain('选区');
    expect(screen.getByTestId('map-status').textContent).toContain('大地图');
  });

  // 窄宽度：只保留坐标与选区，从右向左隐藏地图 / 图层 / 模式
  it('窄宽度只保留坐标与选区', () => {
    render(
      <MapStatusBar
        cursor={{ x: 1, y: 2 }}
        selection={{ x: 1, y: 2, width: 2, height: 3 }}
        mapSize={{ width: 4, height: 3 }}
        layerName="基础层"
        bigMap={false}
        narrow
      />,
    );

    const status = screen.getByTestId('map-status');
    const text = status.textContent ?? '';

    expect(status.getAttribute('data-width')).toBe('narrow');
    expect(text).toContain('坐标');
    expect(text).toContain('选区');
    expect(text).not.toContain('图层');
    expect(text).not.toContain('模式');
  });

  // 数字段使用等宽数字类
  it('数字段带等宽数字类', () => {
    render(
      <MapStatusBar
        cursor={{ x: 1, y: 2 }}
        selection={{ x: 1, y: 2, width: 2, height: 3 }}
        mapSize={{ width: 4, height: 3 }}
        layerName="基础层"
        bigMap={false}
        narrow={false}
      />,
    );

    expect(screen.getByTestId('map-status').querySelectorAll('.emap-status-num').length).toBe(3);
  });
});

describe('地图面板视图装配', () => {
  // 地图未就绪时状态条不渲染
  it('地图加载中不渲染状态条', () => {
    const store = new Store<IMapPanelViewState>(createViewState({ status: MapPanelStatus.Loading }));

    render(<MapPanelView {...createViewProps(store)} />);

    expect(screen.queryByTestId('map-status')).toBeNull();
    expect(screen.getByTestId('map-loading')).not.toBeNull();
  });

  // 保存中：提示行显示「正在保存…」，保存按钮禁用
  it('保存中提示行显示正在保存且保存按钮禁用', () => {
    const store = new Store<IMapPanelViewState>(createViewState({ saving: true, unsaved: true }));

    render(<MapPanelView {...createViewProps(store)} />);

    expect(screen.getByTestId('map-notice').textContent).toContain('正在保存…');
    expect(screen.getByTestId<HTMLButtonElement>('map-save').disabled).toBe(true);
  });

  // 保存失败：提示行为破坏性文案并提供重试
  it('保存失败提示行显示原因与重试', () => {
    const onSave = vi.fn();
    const store = new Store<IMapPanelViewState>(createViewState({ error: '磁盘已满', unsaved: true }));

    render(<MapPanelView {...createViewProps(store, { onSave })} />);

    expect(screen.getByTestId('map-notice').textContent).toContain('保存失败：磁盘已满');

    fireEvent.click(screen.getByTestId('map-notice-retry'));

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  // 点工具栏「新建地图」→ 新建弹窗出现；点取消后消失
  it('工具栏新建地图打开并关闭新建弹窗', async () => {
    const store = new Store<IMapPanelViewState>(createViewState());

    render(
      <MapPanelView
        {...createViewProps(store, {
          canCreateMap: true,
          onOpenDialog: (kind): void => setDialog(store, kind),
          onCloseDialog: (): void => setDialog(store, MapDialogKind.None),
        })}
      />,
    );

    fireEvent.click(screen.getByTestId('map-new'));

    await waitFor(() => expect(screen.getByTestId('map-new-dialog')).not.toBeNull());

    fireEvent.click(screen.getByTestId('map-new-cancel'));

    await waitFor(() => expect(screen.queryByTestId('map-new-dialog')).toBeNull());
  });

  // 点「新增图层」→ 新增图层弹窗出现
  it('工具栏新增图层打开新增图层弹窗', async () => {
    const store = new Store<IMapPanelViewState>(createViewState());

    render(
      <MapPanelView
        {...createViewProps(store, {
          canAddLayer: true,
          onOpenDialog: (kind): void => setDialog(store, kind),
        })}
      />,
    );

    fireEvent.click(screen.getByTestId('map-layer-add'));

    await waitFor(() => expect(screen.getByTestId('map-layer-dialog')).not.toBeNull());
  });

  // 脏状态下出现未保存确认；点取消只上报取消并保持当前地图
  it('未保存弹窗由视图状态渲染且取消不换图', async () => {
    const store = new Store<IMapPanelViewState>(createViewState({ unsaved: true, dialog: MapDialogKind.Unsaved }));
    const onUnsavedDecision = vi.fn((choice: MapUnsavedChoice): void => {
      if (choice === MapUnsavedChoice.Cancel) setDialog(store, MapDialogKind.None);
    });

    render(<MapPanelView {...createViewProps(store, { onUnsavedDecision })} />);

    expect(screen.getByTestId('map-unsaved-dialog')).not.toBeNull();

    fireEvent.click(screen.getByTestId('map-unsaved-cancel'));

    await waitFor(() => expect(screen.queryByTestId('map-unsaved-dialog')).toBeNull());

    expect(onUnsavedDecision).toHaveBeenCalledWith(MapUnsavedChoice.Cancel);
    expect(store.state.document?.id).toBe('map-sample');
  });

  // 抽屉由视图状态打开，正文容器带 emap-properties-body，关闭只上报一次
  it('属性抽屉按视图状态打开并带正文容器', () => {
    const onCloseProperties = vi.fn();
    const rows = buildTableTree(PROPERTY_SCHEMA, { name: 'a' });
    const store = new Store<IMapPanelViewState>(createViewState({ propertiesOpen: true }));

    render(
      <MapPanelView
        {...createViewProps(store, {
          canOpenProperties: true,
          propertiesStatus: TablePanelStatus.Ready,
          propertyRows: rows,
          onCloseProperties,
        })}
      />,
    );

    const drawer = screen.getByTestId('map-properties-drawer');

    expect(drawer.querySelector('.emap-properties-body')).not.toBeNull();

    const wrapper = drawer.closest('.ant-drawer-content-wrapper');

    fireEvent.click(wrapper?.querySelector('.ant-drawer-close') as Element);

    expect(onCloseProperties).toHaveBeenCalledTimes(1);
  });

  // 端到端入口：真实面板实例 + 视图，属性按钮 → 打开抽屉 → 第一次才读宿主
  it('属性入口经真实面板只读一次宿主属性', async () => {
    const readProperties = vi.fn(async (): Promise<Record<string, unknown>> => ({ name: 'a' }));
    const capabilities: IMapEditorCapabilities = {
      listMaps: async (): Promise<readonly IMapSummary[]> => [{ id: 'm1', name: '地图一' }],
      openMap: async (mapId: string): Promise<IMapDocument> => createMapDocument({ id: mapId, name: mapId }),
      saveMapData: async (): Promise<void> => {},
      propertiesSchema: PROPERTY_SCHEMA,
      readProperties,
    };
    const harness = await openMapPanel(capabilities);
    const store = harness.panel['store'];

    render(
      <MapPanelView
        store={store}
        onPaintCell={vi.fn()}
        onSave={vi.fn()}
        onRetry={vi.fn()}
        canOpenProperties
        onOpenProperties={(): void => {
          void harness.panel.openProperties();
        }}
        onCloseProperties={(): void => harness.panel.closeProperties()}
      />,
    );

    fireEvent.click(screen.getByTestId('map-properties'));

    await waitFor(() => expect(screen.getByTestId('map-properties-drawer')).not.toBeNull());
    await waitFor(() => expect(readProperties).toHaveBeenCalledTimes(1));

    const wrapper = screen.getByTestId('map-properties-drawer').closest('.ant-drawer-content-wrapper');

    fireEvent.click(wrapper?.querySelector('.ant-drawer-close') as Element);

    await waitFor(() => expect(screen.queryByTestId('map-properties-drawer')).toBeNull());

    fireEvent.click(screen.getByTestId('map-properties'));

    await waitFor(() => expect(screen.getByTestId('map-properties-drawer')).not.toBeNull());

    expect(readProperties).toHaveBeenCalledTimes(1);
  });
});

interface IPanelHarness {
  /** 已初始化的编辑器核心 */
  readonly system: EditorCore;
  /** 被捕获的地图面板实例 */
  readonly panel: MapPanel;
}

/**
 * 装配核心、注册带实例捕获的地图面板类型，并按打开参数打开首张地图
 * @param capabilities 地图能力注入面
 * @returns 核心与面板实例
 */
async function openMapPanel(capabilities: IMapEditorCapabilities): Promise<IPanelHarness> {
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
