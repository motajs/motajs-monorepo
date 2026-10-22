import { act, cleanup, configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EditorCore, IEditorPanel, IEditorPanelFactoryParam } from '@motajs/editor-core';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMapPanelType, MAP_PANEL_TYPE_ID, MapPanel } from '..';
import { MapPropertiesDrawer, IMapPropertiesDrawerProps } from '../components/MapPropertiesDrawer';
import { TablePanelStatus } from '../../shared/schemaForm/components/TableGrid';
import { buildTableTree } from '../../shared/schemaForm/model/traversal';
import { ITableRowNode, ITableSchemaNode, TableExternalEditor } from '../../shared/schemaForm/types';
import { IMapDataSection, IMapDocument, IMapEditorCapabilities, IMapPanelViewState, IMapSummary } from '../types';
import { createMapDocument, createMapHarness, FakeFileSystem } from './fixtures';

vi.mock('../components/MapSurface', async () => {
  const { createElement: createMockElement } = await import('react');

  return {
    MapSurface: (): ReturnType<typeof createMockElement> =>
      createMockElement('div', { 'data-test-id': 'map-surface-stub' }),
  };
});

configure({ testIdAttribute: 'data-test-id' });

// 地图属性域测试：读整表、一个字段一条撤销、保存整表；属性是宿主的 schema 决定的，面板不写死字段。
// 面板经真实 EditorCore 装配，撤销路径与生产一致；属性抽屉本身在别的用例里按受控组件渲染。

interface IHarness {
  /** 已初始化的编辑器核心 */
  readonly system: EditorCore;
  /** 被捕获的地图面板实例 */
  readonly panel: MapPanel;
}

/** 两字段（字符串 + 数字）的属性 schema，供各用例共用 */
const PROPERTY_SCHEMA: ITableSchemaNode = {
  type: 'object',
  properties: { name: { type: 'string' }, level: { type: 'number' } },
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

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
 * 造一份带属性 schema / 读取 / 保存能力的注入面
 * @param overrides 覆盖能力实现
 * @returns 地图能力注入面
 */
function createPropertyCapabilities(overrides: Partial<IMapEditorCapabilities> = {}): IMapEditorCapabilities {
  return createCapabilities({
    propertiesSchema: PROPERTY_SCHEMA,
    readProperties: async (): Promise<Record<string, unknown>> => ({ name: 'a', level: 1 }),
    saveMapProperties: async (): Promise<void> => {},
    ...overrides,
  });
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
 * 读取面板发布出去的视图状态；测试借此观察开 / 关与未保存，不改任何私有字段
 * @param panel 地图面板实例
 * @returns 当前视图状态
 */
function viewState(panel: MapPanel): IMapPanelViewState {
  return panel['store'].state;
}

/**
 * 读取面板当前的属性行树
 * @param panel 地图面板实例
 * @returns 属性行树
 */
function propertyRows(panel: MapPanel): readonly ITableRowNode[] {
  return panel['propertyRows'];
}

/**
 * 按字段路径在行树里递归找一行
 * @param rows 行树
 * @param key 行标识（字段路径）
 * @returns 命中的行；不存在时为 undefined
 */
function findRow(rows: readonly ITableRowNode[], key: string): ITableRowNode | undefined {
  for (const row of rows) {
    if (row.key === key) return row;

    const found = row.children === undefined ? undefined : findRow(row.children, key);

    if (found !== undefined) return found;
  }

  return undefined;
}

describe('地图面板：属性域', () => {
  // 宿主没注入属性 schema：不打开抽屉、不发读取请求，属性域保持「尚未读取」
  it('无 Schema 时属性域保持 Idle 且不打开抽屉', async () => {
    const readProperties = vi.fn(async (): Promise<Record<string, unknown>> => ({ name: 'a' }));
    const { panel } = await openMapPanel(createCapabilities({ readProperties }));

    await panel.openProperties();

    expect(readProperties).not.toHaveBeenCalled();
    expect(panel['propertiesStatus']).toBe(TablePanelStatus.NoTarget);
    expect(viewState(panel).propertiesOpen).toBe(false);
  });

  // 有 schema 但没有读取能力：同样保持「尚未读取」，绝不发一个注定失败的请求
  it('缺读取能力时属性域保持 Idle', async () => {
    const { panel } = await openMapPanel(createCapabilities({ propertiesSchema: PROPERTY_SCHEMA }));

    await panel.openProperties();

    expect(panel['propertiesStatus']).toBe(TablePanelStatus.NoTarget);
    expect(viewState(panel).propertiesOpen).toBe(false);
  });

  // 宿主读取失败：落错误态并记下原因，抽屉仍然打开，地图不受影响
  it('属性读取失败落 Error 并保留失败原因', async () => {
    const readProperties = vi.fn(async (): Promise<Record<string, unknown>> => {
      throw new Error('属性文件损坏');
    });
    const { panel } = await openMapPanel(createPropertyCapabilities({ readProperties }));

    await panel.openProperties();

    expect(panel['propertiesStatus']).toBe(TablePanelStatus.Error);
    expect(panel['propertiesError']).toContain('属性文件损坏');
    expect(viewState(panel).propertiesOpen).toBe(true);
  });

  // 读取成功：按宿主 schema 生成两行，值取自宿主返回的属性表
  it('属性读取成功生成两行字段', async () => {
    const { panel } = await openMapPanel(createPropertyCapabilities());

    await panel.openProperties();

    expect(panel['propertiesStatus']).toBe(TablePanelStatus.Ready);
    expect(propertyRows(panel).map((row) => row.key)).toEqual(["['name']", "['level']"]);
    expect(findRow(propertyRows(panel), "['name']")?.value).toBe('a');
    expect(findRow(propertyRows(panel), "['level']")?.value).toBe(1);
  });

  // 提交一个字段：内存更新、置「未保存」，且只登记一条可撤销记录
  it('提交一个字段记一条撤销并置未保存', async () => {
    const { system, panel } = await openMapPanel(createPropertyCapabilities());

    await panel.openProperties();
    panel.commitProperty(['name'], 'b');

    expect(panel['properties'].name).toBe('b');
    expect(panel.isDirty()).toBe(true);
    expect(await system.undoSystem.undo()).toBe(true);
    expect(panel['properties'].name).toBe('a');
    expect(await system.undoSystem.undo()).toBe(false);
  });

  // 撤销把字段改回旧值并重建行树；重做改回新值
  it('撤销与重做改回字段值并更新行树', async () => {
    const { system, panel } = await openMapPanel(createPropertyCapabilities());

    await panel.openProperties();
    const beforeUndo = propertyRows(panel);

    panel.commitProperty(['name'], 'b');
    expect(findRow(propertyRows(panel), "['name']")?.value).toBe('b');

    await system.undoSystem.undo();

    expect(findRow(propertyRows(panel), "['name']")?.value).toBe('a');
    expect(propertyRows(panel)).not.toBe(beforeUndo);

    await system.undoSystem.redo();

    expect(panel['properties'].name).toBe('b');
    expect(findRow(propertyRows(panel), "['name']")?.value).toBe('b');
  });

  // 保存属性域：宿主收到的是整份属性表，不是被改的那一个字段
  it('保存时把整份属性表交给宿主', async () => {
    const saveMapProperties = vi.fn(async (_mapId: string, _properties: Record<string, unknown>): Promise<void> => {});
    const { panel } = await openMapPanel(createPropertyCapabilities({ saveMapProperties }));

    await panel.openProperties();
    panel.commitProperty(['level'], 3);

    expect(await panel.save()).toBe(true);
    expect(saveMapProperties).toHaveBeenCalledTimes(1);
    expect(saveMapProperties.mock.calls[0][0]).toBe('m1');
    expect(saveMapProperties.mock.calls[0][1]).toEqual({ name: 'a', level: 3 });
  });

  // 数据域干净而属性域脏：只调属性保存，不打扰地图数据域的宿主
  it('只有属性域脏时只调属性保存', async () => {
    const saveMapData = vi.fn(async (_data: IMapDataSection): Promise<void> => {});
    const saveMapProperties = vi.fn(async (): Promise<void> => {});
    const { panel } = await openMapPanel(createPropertyCapabilities({ saveMapData, saveMapProperties }));

    await panel.openProperties();
    panel.commitProperty(['name'], 'b');

    expect(await panel.save()).toBe(true);
    expect(saveMapData).not.toHaveBeenCalled();
    expect(saveMapProperties).toHaveBeenCalledTimes(1);
    expect(viewState(panel).unsaved).toBe(false);
  });

  // 带外部编辑器标记的字段：交给表单引擎前剥掉 x-editor，宿主自己的 schema 不被改动
  it('属性 Schema 的 x-editor 被剥掉且不改宿主对象', async () => {
    const schemaWithEditor: ITableSchemaNode = {
      type: 'object',
      properties: { name: { type: 'string' }, script: { type: 'string', 'x-editor': TableExternalEditor.Code } },
    };
    const { panel } = await openMapPanel(
      createPropertyCapabilities({
        propertiesSchema: schemaWithEditor,
        readProperties: async (): Promise<Record<string, unknown>> => ({ name: 'a', script: 'x' }),
      }),
    );

    await panel.openProperties();

    const scriptRow = findRow(propertyRows(panel), "['script']");

    expect(scriptRow).not.toBeUndefined();
    expect(scriptRow?.['config'] === undefined ? undefined : 'x-editor' in scriptRow.config).toBe(false);
    expect(schemaWithEditor.properties?.script['x-editor']).toBe(TableExternalEditor.Code);
  });

  // 字段路径含原型污染段：整条提交被拒，属性表不变、不置脏、不登记撤销
  it('属性字段路径含危险段时被拒绝', async () => {
    const { system, panel } = await openMapPanel(createPropertyCapabilities());

    await panel.openProperties();
    const before = panel['properties'];

    for (const segment of ['__proto__', 'constructor', 'prototype']) panel.commitProperty([segment, 'polluted'], 'yes');

    expect(panel['properties']).toBe(before);
    expect(panel.isDirty()).toBe(false);
    expect(await system.undoSystem.undo()).toBe(false);
  });

  // 地图数据改动不影响属性行树：两个域各自持有自己的内存
  it('地图数据改动后属性行树不被重置', async () => {
    const { panel } = await openMapPanel(createPropertyCapabilities());

    await panel.openProperties();
    const rowsBefore = propertyRows(panel);

    panel.commitCells('layer-base', [{ x: 0, y: 0, value: 1 }]);

    expect(propertyRows(panel)).toBe(rowsBefore);
    expect(findRow(propertyRows(panel), "['name']")?.value).toBe('a');
  });

  // 关掉再打开不重读宿主、不丢内存改动：只有第一次打开才读
  it('关闭再打开只读一次宿主并保留内存改动', async () => {
    const readProperties = vi.fn(async (): Promise<Record<string, unknown>> => ({ name: 'a', level: 1 }));
    const { panel } = await openMapPanel(createPropertyCapabilities({ readProperties }));

    await panel.openProperties();
    expect(readProperties).toHaveBeenCalledTimes(1);

    panel.commitProperty(['name'], 'b');
    panel.closeProperties();
    expect(viewState(panel).propertiesOpen).toBe(false);

    await panel.openProperties();

    expect(readProperties).toHaveBeenCalledTimes(1);
    expect(viewState(panel).propertiesOpen).toBe(true);
    expect(panel['properties'].name).toBe('b');
    expect(findRow(propertyRows(panel), "['name']")?.value).toBe('b');
  });

  // 面板级回归：只渲染面板自己的组件、点一次「地图属性」，字段就该出现——不经过外壳重渲染
  it('属性抽屉首次打开即显示字段（不依赖外壳重渲染）', async () => {
    const { system, panel } = await openMapPanel(createPropertyCapabilities());
    const activateTab = vi.spyOn(system.shellSystem, 'activateTab');

    render(createElement(panel.render()));

    act(() => {
      fireEvent.click(screen.getByTestId('map-properties'));
    });

    await waitFor(() => expect(screen.getByTestId('map-properties-drawer')).not.toBeNull());
    await waitFor(() => expect(screen.getByTestId('table-input-name')).not.toBeNull());

    expect(screen.getByTestId('table-input-level')).not.toBeNull();
    expect(screen.queryByTestId('map-properties-error')).toBeNull();
    expect(activateTab).toHaveBeenCalledTimes(0);
  });
});

/**
 * 造一份属性抽屉的完整 props，可按用例覆盖个别字段
 * @param overrides 覆盖的 props
 * @returns 抽屉 props
 */
function createDrawerProps(overrides: Partial<IMapPropertiesDrawerProps> = {}): IMapPropertiesDrawerProps {
  return {
    open: true,
    status: TablePanelStatus.Ready,
    rows: buildTableTree(PROPERTY_SCHEMA, { name: 'a', level: 1 }),
    onChange: (): void => {},
    onRetry: (): void => {},
    onClose: (): void => {},
    ...overrides,
  };
}

/**
 * 按受控组件渲染属性抽屉
 * @param overrides 覆盖的 props
 * @returns 渲染结果
 */
function renderDrawer(overrides: Partial<IMapPropertiesDrawerProps> = {}): ReturnType<typeof render> {
  return render(<MapPropertiesDrawer {...createDrawerProps(overrides)} />);
}

describe('地图属性抽屉', () => {
  // 打开时出现抽屉与正文容器，两行字段真的渲染在 DOM 里
  it('打开时渲染抽屉、正文容器与两行字段', () => {
    renderDrawer();
    const drawer = screen.getByTestId('map-properties-drawer');

    expect(drawer.querySelector('.emap-properties-body')).not.toBeNull();
    expect(screen.getByText('地图属性')).not.toBeNull();
    expect(screen.getByText('name')).not.toBeNull();
    expect(screen.getByText('level')).not.toBeNull();
  });

  // 抽屉里没有第二个保存入口，也没有表格专属动作
  it('抽屉内没有保存按钮与表格专属动作', () => {
    renderDrawer();

    expect(screen.queryByText('保存')).toBeNull();
    expect(screen.queryByTestId('table-more')).toBeNull();
    expect(screen.queryByTestId('table-edit-schema')).toBeNull();
    expect(screen.queryByTestId('table-open-code')).toBeNull();
    expect(screen.queryByTestId('table-close-column')).toBeNull();
  });

  // 加载中：转圈 + 「正在加载地图属性…」
  it('加载中显示正在加载地图属性…', () => {
    renderDrawer({ status: TablePanelStatus.Loading, rows: [] });

    expect(screen.getByText('正在加载地图属性…')).not.toBeNull();
  });

  // 失败：破坏性标题 + 说明 + 重试，抽屉不关闭，重试交回面板
  it('加载失败显示两句错误且抽屉仍在', () => {
    const onRetry = vi.fn();

    renderDrawer({ status: TablePanelStatus.Error, rows: [], error: '属性文件损坏', onRetry });

    expect(screen.getByText('地图属性加载失败')).not.toBeNull();
    expect(screen.getByText('请稍后重试。')).not.toBeNull();
    expect(screen.getByTestId('map-properties-drawer')).not.toBeNull();

    fireEvent.click(screen.getByText('重试'));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  // 改一个字段后关掉再打开：值仍是内存里的新值（抽屉只是视图）
  it('关闭再打开后显示内存里的新值', async () => {
    const { panel } = await openMapPanel(createPropertyCapabilities());

    await panel.openProperties();

    const props = (): IMapPropertiesDrawerProps =>
      createDrawerProps({
        status: panel['propertiesStatus'],
        rows: propertyRows(panel),
        onChange: (path: readonly (string | number)[], value: unknown): void => panel.commitProperty(path, value),
      });
    const { rerender } = render(<MapPropertiesDrawer {...props()} />);
    const textarea = screen.getByTestId('table-input-name').querySelector('textarea');

    fireEvent.change(textarea as HTMLTextAreaElement, { target: { value: '"b"' } });
    fireEvent.blur(textarea as HTMLTextAreaElement);

    expect(panel['properties'].name).toBe('b');

    rerender(<MapPropertiesDrawer {...props()} open={false} />);

    expect(screen.queryByTestId('map-properties-drawer')).toBeNull();

    rerender(<MapPropertiesDrawer {...props()} open />);

    expect(screen.getByDisplayValue('"b"')).not.toBeNull();
  });

  // 关闭按钮只上报 onClose 一次；open 为假时正文容器不在 DOM
  it('关闭按钮上报 onClose 且关闭后正文容器消失', () => {
    const onClose = vi.fn();
    const { rerender } = renderDrawer({ onClose });
    const wrapper = screen.getByTestId('map-properties-drawer').closest('.ant-drawer-content-wrapper');

    fireEvent.click(wrapper?.querySelector('.ant-drawer-close') as Element);

    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(<MapPropertiesDrawer {...createDrawerProps({ open: false, onClose })} />);

    expect(screen.queryByTestId('map-properties-drawer')).toBeNull();
  });
});
