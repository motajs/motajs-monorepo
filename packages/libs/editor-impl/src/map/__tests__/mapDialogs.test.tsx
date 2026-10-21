import { act, cleanup, configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EditorCore, IEditorPanel, IEditorPanelFactoryParam } from '@motajs/editor-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMapPanelType, MAP_PANEL_TYPE_ID, MapPanel } from '..';
import { MapLayerDialog, MapNewDialog, MapUnsavedDialog } from '../components/dialogs';
import { MAP_RECENT_TILES_PATH } from '../constants';
import {
  IMapDocument,
  IMapEditorCapabilities,
  IMapPanelViewState,
  IMapSummary,
  MapDialogKind,
  MapPaletteKind,
  MapUnsavedChoice,
} from '../types';
import { createMapDocument, createMapHarness, FakeFileSystem } from './fixtures';

configure({ testIdAttribute: 'data-test-id' });

// 弹窗与面板数据层测试：新建地图 / 新增图层 / 未保存确认 / 最近使用。
// 弹窗按受控组件直接渲染；面板侧经真实 EditorCore 装配，撤销与资源层都与生产路径一致。

interface IHarness {
  /** 已初始化的编辑器核心 */
  readonly system: EditorCore;
  /** 被捕获的地图面板实例 */
  readonly panel: MapPanel;
  /** 注入的内存文件系统，供最近使用用例预置与读取文件 */
  readonly fileSystem: FakeFileSystem;
}

interface IDeferred<T> {
  /** 待兑现的 promise */
  readonly promise: Promise<T>;
  /** 兑现结果 */
  readonly resolve: (value: T) => void;
}

/**
 * 造一个可手动兑现的 promise，用于测提交中的语义
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
 * @param fileSystem 注入的内存文件系统；缺省时新建一个
 * @returns 核心、面板实例与文件系统
 */
async function openMapPanel(
  capabilities: IMapEditorCapabilities,
  fileSystem: FakeFileSystem = new FakeFileSystem(),
): Promise<IHarness> {
  const system = await createMapHarness(fileSystem);
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

  return { system, panel: panels[0], fileSystem };
}

/**
 * 读取面板发布出去的视图状态；测试借此观察状态，不改任何私有字段
 * @param panel 地图面板实例
 * @returns 当前视图状态
 */
function viewState(panel: MapPanel): IMapPanelViewState {
  return panel['store'].state;
}

/**
 * 等待落笔触发的最近使用写盘走完，再读回文件内容
 * @param fileSystem 内存文件系统
 * @returns 解析后的文件内容
 */
async function readRecentTilesFile(fileSystem: FakeFileSystem): Promise<unknown> {
  const text = await fileSystem.readFile(MAP_RECENT_TILES_PATH);

  return JSON.parse(text);
}

/**
 * 画一格，让面板进入有未保存改动的状态
 * @param panel 地图面板实例
 */
function paintOneCell(panel: MapPanel): void {
  panel.commitCells('layer-base', [{ x: 0, y: 0, value: 1 }]);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('新建地图弹窗', () => {
  // 打开时名称空、宽高 32、初始图层名「图层 1」，无上限时只显示单位提示
  it('打开时按默认值渲染，无上限时只显示单位提示', () => {
    render(<MapNewDialog open existingNames={[]} onSubmit={async (): Promise<void> => {}} onCancel={(): void => {}} />);

    expect(screen.getByTestId<HTMLInputElement>('map-new-name').value).toBe('');
    expect(screen.getByTestId<HTMLInputElement>('map-new-width').value).toBe('32');
    expect(screen.getByTestId<HTMLInputElement>('map-new-height').value).toBe('32');
    expect(screen.getByTestId<HTMLInputElement>('map-new-layer').value).toBe('图层 1');
    expect(screen.getByTestId('map-new-size-hint').textContent).toContain('宽高以格子为单位。');
    expect(screen.getByTestId('map-new-size-hint').textContent).not.toContain('最大');
  });

  // 宿主给了上限时提示追加「最大 64 × 48。」，两个数字框也带上对应上限
  it('宿主给了上限时追加最大尺寸提示', () => {
    render(
      <MapNewDialog
        open
        maxSize={{ maxWidth: 64, maxHeight: 48 }}
        existingNames={[]}
        onSubmit={async (): Promise<void> => {}}
        onCancel={(): void => {}}
      />,
    );

    expect(screen.getByTestId('map-new-size-hint').textContent).toContain('宽高以格子为单位。最大 64 × 48。');
    expect(screen.getByTestId('map-new-width').getAttribute('aria-valuemax')).toBe('64');
    expect(screen.getByTestId('map-new-height').getAttribute('aria-valuemax')).toBe('48');
  });

  // 提交中两个按钮都禁用并显示「正在创建…」，弹窗保持打开
  it('提交中禁用按钮并显示进度，弹窗不关闭', async () => {
    const deferred = createDeferred<void>();

    render(
      <MapNewDialog
        open
        existingNames={[]}
        onSubmit={(): Promise<void> => deferred.promise}
        onCancel={(): void => {}}
      />,
    );

    fireEvent.change(screen.getByTestId('map-new-name'), { target: { value: '新图' } });

    await act(async () => {
      fireEvent.click(screen.getByTestId('map-new-submit'));
    });

    expect(screen.getByTestId<HTMLButtonElement>('map-new-submit').disabled).toBe(true);
    expect(screen.getByTestId<HTMLButtonElement>('map-new-cancel').disabled).toBe(true);
    expect(screen.queryByText('正在创建…')).not.toBeNull();
    expect(screen.queryByTestId('map-new-dialog')).not.toBeNull();

    await act(async () => {
      deferred.resolve();
      await deferred.promise;
    });

    expect(screen.getByTestId<HTMLButtonElement>('map-new-submit').disabled).toBe(false);
  });

  // 字段错误逐项行内显示，且不会调用提交
  it('字段错误行内显示且不提交', async () => {
    const onSubmit = vi.fn(async (): Promise<void> => {});

    render(<MapNewDialog open existingNames={['地图一']} onSubmit={onSubmit} onCancel={(): void => {}} />);

    const widthInput = screen.getByTestId('map-new-width');

    fireEvent.change(widthInput, { target: { value: '1.5' } });
    fireEvent.blur(widthInput);
    fireEvent.change(screen.getByTestId('map-new-layer'), { target: { value: '  ' } });

    await act(async () => {
      fireEvent.click(screen.getByTestId('map-new-submit'));
    });

    expect(screen.getByTestId('map-new-name-error').textContent).toContain('请输入地图名称。');
    expect(screen.getByTestId('map-new-size-error').textContent).toContain('宽度必须是正整数。');
    expect(screen.getByTestId('map-new-layer-error').textContent).toContain('请输入图层名称。');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  // 宿主失败原因显示在弹窗内，按钮保持可用
  it('宿主失败原因显示在弹窗内且按钮可用', () => {
    render(
      <MapNewDialog
        open
        existingNames={[]}
        error="磁盘已满"
        onSubmit={async (): Promise<void> => {}}
        onCancel={(): void => {}}
      />,
    );

    expect(screen.getByTestId('map-new-error').textContent).toContain('磁盘已满');
    expect(screen.getByTestId<HTMLButtonElement>('map-new-submit').disabled).toBe(false);
  });

  // 点「取消」只把关闭意图交回面板
  it('点取消把关闭意图交回面板', () => {
    const onCancel = vi.fn();

    render(<MapNewDialog open existingNames={[]} onSubmit={async (): Promise<void> => {}} onCancel={onCancel} />);

    fireEvent.click(screen.getByTestId('map-new-cancel'));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('新增图层弹窗', () => {
  // 打开时按「现有层数 + 1」预填并聚焦全选
  it('打开时预填「图层 N」并聚焦全选', async () => {
    render(
      <MapLayerDialog
        open
        layerCount={2}
        existingNames={['基础层', '上层']}
        onSubmit={async (): Promise<void> => {}}
        onCancel={(): void => {}}
      />,
    );

    const input = screen.getByTestId<HTMLInputElement>('map-layer-name');

    expect(input.value).toBe('图层 3');
    await waitFor(() => expect(input.ownerDocument.activeElement).toBe(input));
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe('图层 3'.length);
  });

  // 提交中按钮禁用并显示「正在创建…」，弹窗保持打开
  it('提交中禁用按钮并显示进度，弹窗不关闭', async () => {
    const deferred = createDeferred<void>();

    render(
      <MapLayerDialog
        open
        layerCount={2}
        existingNames={['基础层', '上层']}
        onSubmit={(): Promise<void> => deferred.promise}
        onCancel={(): void => {}}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('map-layer-submit'));
    });

    expect(screen.getByTestId<HTMLButtonElement>('map-layer-submit').disabled).toBe(true);
    expect(screen.getByTestId<HTMLButtonElement>('map-layer-cancel').disabled).toBe(true);
    expect(screen.queryByText('正在创建…')).not.toBeNull();
    expect(screen.queryByTestId('map-layer-dialog')).not.toBeNull();

    await act(async () => {
      deferred.resolve();
      await deferred.promise;
    });
  });

  // 空名称与重名都行内显示，且不会调用提交
  it('空名称与重名都行内显示且不提交', async () => {
    const onSubmit = vi.fn(async (): Promise<void> => {});

    render(
      <MapLayerDialog
        open
        layerCount={2}
        existingNames={['基础层', '上层']}
        onSubmit={onSubmit}
        onCancel={(): void => {}}
      />,
    );

    fireEvent.change(screen.getByTestId('map-layer-name'), { target: { value: '  ' } });

    await act(async () => {
      fireEvent.click(screen.getByTestId('map-layer-submit'));
    });

    expect(screen.getByTestId('map-layer-name-error').textContent).toContain('请输入图层名称。');

    fireEvent.change(screen.getByTestId('map-layer-name'), { target: { value: '基础层' } });

    await act(async () => {
      fireEvent.click(screen.getByTestId('map-layer-submit'));
    });

    expect(screen.getByTestId('map-layer-name-error').textContent).toContain('图层名称已存在。');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  // 现有图层名不规范时默认名仍按层数生成，校验照常通过
  it('现有图层名不规范时仍生成默认名并可提交', async () => {
    const onSubmit = vi.fn(async (): Promise<void> => {});

    render(
      <MapLayerDialog open layerCount={2} existingNames={['', '  ']} onSubmit={onSubmit} onCancel={(): void => {}} />,
    );

    expect(screen.getByTestId<HTMLInputElement>('map-layer-name').value).toBe('图层 3');

    await act(async () => {
      fireEvent.click(screen.getByTestId('map-layer-submit'));
    });

    expect(onSubmit).toHaveBeenCalledWith('图层 3');
  });

  // 宿主失败原因显示在弹窗内，名称错误与宿主错误互不覆盖
  it('宿主失败原因显示在弹窗内', () => {
    render(
      <MapLayerDialog
        open
        layerCount={1}
        existingNames={[]}
        error="写入失败"
        onSubmit={async (): Promise<void> => {}}
        onCancel={(): void => {}}
      />,
    );

    expect(screen.getByTestId('map-layer-error').textContent).toContain('写入失败');
  });
});

describe('未保存确认弹窗', () => {
  // 保存中三个按钮都禁用并显示「正在保存…」
  it('保存中三个按钮禁用并显示进度', () => {
    render(<MapUnsavedDialog open saving onUnsavedDecision={(): void => {}} />);

    expect(screen.getByTestId<HTMLButtonElement>('map-unsaved-save').disabled).toBe(true);
    expect(screen.getByTestId<HTMLButtonElement>('map-unsaved-discard').disabled).toBe(true);
    expect(screen.getByTestId<HTMLButtonElement>('map-unsaved-cancel').disabled).toBe(true);
    expect(screen.queryByText('正在保存…')).not.toBeNull();
  });

  // 三个按钮只把选择交回，不做任何判断
  it('三个按钮只把用户选择交回面板', () => {
    const onUnsavedDecision = vi.fn();

    render(<MapUnsavedDialog open saving={false} onUnsavedDecision={onUnsavedDecision} />);

    fireEvent.click(screen.getByTestId('map-unsaved-save'));
    fireEvent.click(screen.getByTestId('map-unsaved-discard'));
    fireEvent.click(screen.getByTestId('map-unsaved-cancel'));

    expect(onUnsavedDecision.mock.calls.map((call) => call[0])).toEqual([
      MapUnsavedChoice.SaveAndContinue,
      MapUnsavedChoice.Discard,
      MapUnsavedChoice.Cancel,
    ]);
  });

  // 保存失败原因换行显示在正文下方
  it('保存失败原因显示在正文下方', () => {
    render(<MapUnsavedDialog open saving={false} saveError="磁盘已满" onUnsavedDecision={(): void => {}} />);

    expect(screen.getByTestId('map-unsaved-error').textContent).toContain('保存失败：磁盘已满');
  });
});

describe('面板：新建地图与新增图层', () => {
  // 新建成功后打开新文档、当前层是初始图层、视口回左上角并登记屏障
  it('新建地图成功后打开新文档并登记屏障', async () => {
    const createMap = vi.fn(async (): Promise<IMapDocument> => createEmptyDocument('m-new'));
    const { system, panel } = await openMapPanel(createCapabilities({ createMap }));
    const addUndo = vi.spyOn(system.undoSystem, 'addUndoContext');

    panel.openDialog(MapDialogKind.New);
    await panel.createMap({ name: '新图', width: 32, height: 32, layerName: '第一层' });

    expect(createMap).toHaveBeenCalledWith({ name: '新图', width: 32, height: 32, layerName: '第一层' });
    expect(viewState(panel).document?.id).toBe('m-new');
    expect(viewState(panel).currentLayerId).toBe(viewState(panel).document?.layers[0].id);
    expect(viewState(panel).viewport).toEqual({ left: 0, top: 0 });
    expect(viewState(panel).dialog).toBe(MapDialogKind.None);
    expect(viewState(panel).unsaved).toBe(false);
    expect(panel.isDirty()).toBe(false);
    expect(addUndo.mock.calls.at(-1)?.[1]).toMatchObject({ barrier: true });
  });

  // 宿主没注入 createMap 时不调用任何能力、不抛错，只把提示放进弹窗错误
  it('宿主不支持新建地图时给出提示且不抛错', async () => {
    const { panel } = await openMapPanel(createCapabilities());

    panel.openDialog(MapDialogKind.New);
    await panel.createMap({ name: '新图', width: 32, height: 32, layerName: '第一层' });

    expect(viewState(panel).dialogError).toBe('当前项目不支持新建地图。');
    expect(viewState(panel).document?.id).toBe('m1');
  });

  // 新增图层成功后新层成为当前层，用户输入的层名写进文档，且不置脏、不进撤销
  it('新增图层成功后新层成为当前层且名字写进文档', async () => {
    const addLayer = vi.fn(async (): Promise<IMapDocument> => {
      const base = createEmptyDocument('m1');
      const layer = {
        id: 'layer-new',
        name: '宿主默认名',
        zIndex: 2,
        isEventLayer: false,
        cells: base.layers[0].cells,
      };

      return { ...base, layers: [...base.layers, layer] };
    });
    const { system, panel } = await openMapPanel(createCapabilities({ addLayer }));
    const addUndo = vi.spyOn(system.undoSystem, 'addUndoContext');

    panel.openDialog(MapDialogKind.Layer);
    await panel.addLayer('新图层');

    const document = viewState(panel).document;

    expect(addLayer).toHaveBeenCalledWith('m1');
    expect(document?.layers.at(-1)?.name).toBe('新图层');
    expect(viewState(panel).currentLayerId).toBe('layer-new');
    expect(viewState(panel).unsaved).toBe(false);
    expect(panel.isDirty()).toBe(false);
    expect(viewState(panel).dialog).toBe(MapDialogKind.None);
    expect(addUndo.mock.calls.at(-1)?.[1]).toMatchObject({ barrier: true });
  });

  // 宿主没注入 addLayer 时同上：只给提示
  it('宿主不支持新增图层时给出提示且不抛错', async () => {
    const { panel } = await openMapPanel(createCapabilities());

    panel.openDialog(MapDialogKind.Layer);
    await panel.addLayer('新图层');

    expect(viewState(panel).dialogError).toBe('当前项目不支持新增图层。');
    expect(viewState(panel).document?.layers).toHaveLength(2);
  });

  // 面板侧再校验一次，绕过弹窗也拒绝空名称且不调用宿主
  it('面板侧拒绝非法名称且不调用宿主', async () => {
    const createMap = vi.fn(async (): Promise<IMapDocument> => createEmptyDocument('m-new'));
    const { panel } = await openMapPanel(createCapabilities({ createMap }));

    await panel.createMap({ name: '  ', width: 32, height: 32, layerName: '第一层' });

    expect(createMap).not.toHaveBeenCalled();
    expect(viewState(panel).dialogError).toBe('请输入地图名称。');
  });

  // 面板侧拒绝超过宿主上限的尺寸，不夹取也不调用宿主
  it('面板侧拒绝超限尺寸且不调用宿主', async () => {
    const createMap = vi.fn(async (): Promise<IMapDocument> => createEmptyDocument('m-new'));
    const { panel } = await openMapPanel(
      createCapabilities({ createMap, maxMapSize: { maxWidth: 16, maxHeight: 16 } }),
    );

    await panel.createMap({ name: '新图', width: 100, height: 32, layerName: '第一层' });

    expect(createMap).not.toHaveBeenCalled();
    expect(viewState(panel).dialogError).toBe('宽度必须是 1 到 16 之间的整数。');
  });
});

describe('面板：未保存确认', () => {
  // 刚打开、什么都没改时关闭标签直接放行，弹窗不出现
  it('干净时关闭标签直接放行', async () => {
    const { panel } = await openMapPanel(createCapabilities());

    expect(await panel.onBeforeClose()).toBe(true);
    expect(viewState(panel).dialog).toBe(MapDialogKind.None);
  });

  // 脏时切图会先问一句；取消后仍停在原图，宿主没有被再次调用
  it('脏时切图先询问，取消后不继续', async () => {
    const openMap = vi.fn(async (mapId: string): Promise<IMapDocument> => createEmptyDocument(mapId));
    const { panel } = await openMapPanel(createCapabilities({ openMap }));
    const initialCalls = openMap.mock.calls.length;

    paintOneCell(panel);

    const switching = panel.openMap('m2');

    expect(viewState(panel).dialog).toBe(MapDialogKind.Unsaved);
    await panel.resolveUnsavedDecision(MapUnsavedChoice.Cancel);
    await switching;

    expect(openMap).toHaveBeenCalledTimes(initialCalls);
    expect(viewState(panel).document?.id).toBe('m1');
    expect(viewState(panel).dialog).toBe(MapDialogKind.None);
    expect(panel.isDirty()).toBe(true);
  });

  // 放弃改动回到基线、清掉未保存并登记屏障，原操作继续
  it('放弃改动回到基线并登记屏障', async () => {
    const { system, panel } = await openMapPanel(createCapabilities());

    paintOneCell(panel);

    const addUndo = vi.spyOn(system.undoSystem, 'addUndoContext');
    const closing = panel.onBeforeClose();

    expect(viewState(panel).dialog).toBe(MapDialogKind.Unsaved);
    await panel.resolveUnsavedDecision(MapUnsavedChoice.Discard);

    expect(await closing).toBe(true);
    expect(viewState(panel).document?.layers[0].cells[0][0]).toBe(0);
    expect(panel.isDirty()).toBe(false);
    expect(addUndo).toHaveBeenCalledTimes(1);
    expect(addUndo.mock.calls[0][1]).toMatchObject({ barrier: true });
  });

  // 放弃改动后原切图操作继续，最终打开的是目标地图
  it('放弃改动后切图继续', async () => {
    const { panel } = await openMapPanel(createCapabilities());

    paintOneCell(panel);

    const switching = panel.openMap('m2');

    await panel.resolveUnsavedDecision(MapUnsavedChoice.Discard);
    await switching;

    expect(viewState(panel).document?.id).toBe('m2');
    expect(viewState(panel).dialog).toBe(MapDialogKind.None);
  });

  // 保存并继续成功时宿主收到保存，原操作继续
  it('保存并继续成功后切图继续', async () => {
    const saveMapData = vi.fn(async (): Promise<void> => {});
    const openMap = vi.fn(async (mapId: string): Promise<IMapDocument> => createEmptyDocument(mapId));
    const { panel } = await openMapPanel(createCapabilities({ saveMapData, openMap }));
    const initialCalls = openMap.mock.calls.length;

    paintOneCell(panel);

    const switching = panel.openMap('m2');

    await panel.resolveUnsavedDecision(MapUnsavedChoice.SaveAndContinue);
    await switching;

    expect(saveMapData).toHaveBeenCalledTimes(1);
    expect(openMap).toHaveBeenCalledTimes(initialCalls + 1);
    expect(viewState(panel).document?.id).toBe('m2');
  });

  // 保存并继续失败时弹窗保持打开、显示原因，原操作不继续；仍可选取消收尾
  it('保存并继续失败时弹窗保持打开且不继续', async () => {
    const saveMapData = vi.fn(async (): Promise<void> => {
      throw new Error('磁盘已满');
    });
    const openMap = vi.fn(async (mapId: string): Promise<IMapDocument> => createEmptyDocument(mapId));
    const { panel } = await openMapPanel(createCapabilities({ saveMapData, openMap }));
    const initialCalls = openMap.mock.calls.length;

    paintOneCell(panel);

    const switching = panel.openMap('m2');

    await panel.resolveUnsavedDecision(MapUnsavedChoice.SaveAndContinue);

    expect(viewState(panel).dialog).toBe(MapDialogKind.Unsaved);
    expect(viewState(panel).error).toContain('磁盘已满');
    expect(viewState(panel).saving).toBe(false);
    expect(openMap).toHaveBeenCalledTimes(initialCalls);
    expect(viewState(panel).document?.id).toBe('m1');

    await panel.resolveUnsavedDecision(MapUnsavedChoice.Cancel);
    await switching;

    expect(viewState(panel).dialog).toBe(MapDialogKind.None);
    expect(openMap).toHaveBeenCalledTimes(initialCalls);
  });

  // 关闭标签时取消返回 false，放弃返回 true
  it('关闭标签时取消返回 false', async () => {
    const { panel } = await openMapPanel(createCapabilities());

    paintOneCell(panel);

    const closing = panel.onBeforeClose();

    await panel.resolveUnsavedDecision(MapUnsavedChoice.Cancel);

    expect(await closing).toBe(false);
  });

  // 没有待决询问时结算方法直接返回，不抛错也不改状态
  it('没有待决询问时结算方法不抛错', async () => {
    const { panel } = await openMapPanel(createCapabilities());

    await expect(panel.resolveUnsavedDecision(MapUnsavedChoice.Cancel)).resolves.toBeUndefined();

    expect(viewState(panel).dialog).toBe(MapDialogKind.None);
    expect(viewState(panel).dialogError).toBeUndefined();
    expect(viewState(panel).document?.id).toBe('m1');
  });
});

describe('面板：最近使用图块', () => {
  // 打开地图后从项目内约定文件读出列表，顺序保留
  it('打开地图后读出预置的最近使用列表', async () => {
    const fileSystem = new FakeFileSystem();

    fileSystem.seed(MAP_RECENT_TILES_PATH, JSON.stringify({ tiles: [2, 1] }));

    const { panel } = await openMapPanel(createCapabilities(), fileSystem);

    await waitFor(() => expect(viewState(panel).recentTiles).toEqual([2, 1]));
  });

  // 文件不存在时按空列表处理，不抛错
  it('文件缺失时按空列表处理', async () => {
    const { panel } = await openMapPanel(createCapabilities());

    await expect(panel.loadRecentTiles()).resolves.toBeUndefined();
    expect(viewState(panel).recentTiles).toEqual([]);
  });

  // 文件内容损坏时按空列表处理
  it('文件损坏时按空列表处理', async () => {
    const fileSystem = new FakeFileSystem();

    fileSystem.seed(MAP_RECENT_TILES_PATH, '这不是 JSON');

    const { panel } = await openMapPanel(createCapabilities(), fileSystem);

    await panel.loadRecentTiles();

    expect(viewState(panel).recentTiles).toEqual([]);
  });

  // 落笔成功后把主图块写回文件，内容是 1×1 的编号列表
  it('落笔成功后写回主图块', async () => {
    const fileSystem = new FakeFileSystem();
    const { panel } = await openMapPanel(createCapabilities(), fileSystem);

    paintOneCell(panel);

    await waitFor(async () => expect(await readRecentTilesFile(fileSystem)).toEqual({ tiles: [1] }));
  });

  // 同一编号连续用两次只留一条
  it('同一编号只留一条', async () => {
    const fileSystem = new FakeFileSystem();
    const { panel } = await openMapPanel(createCapabilities(), fileSystem);

    paintOneCell(panel);
    panel.commitCells('layer-base', [{ x: 1, y: 0, value: 1 }]);

    await waitFor(async () => expect(await readRecentTilesFile(fileSystem)).toEqual({ tiles: [1] }));
    expect(viewState(panel).recentTiles).toEqual([1]);
  });

  // 用「空」擦除时不更新最近使用
  it('擦除不更新最近使用', async () => {
    const fileSystem = new FakeFileSystem();
    const { panel } = await openMapPanel(createCapabilities(), fileSystem);

    paintOneCell(panel);
    await waitFor(async () => expect(await readRecentTilesFile(fileSystem)).toEqual({ tiles: [1] }));

    panel['paletteSelection'] = {
      kind: MapPaletteKind.Empty,
      pattern: { width: 1, height: 1, tiles: [0] },
      primaryTileNumber: 0,
    };
    panel.commitCells('layer-base', [{ x: 0, y: 0, value: 0 }]);

    expect(viewState(panel).recentTiles).toEqual([1]);
    expect(await readRecentTilesFile(fileSystem)).toEqual({ tiles: [1] });
  });

  // 清除记录后文件内容变成空列表
  it('清除记录后写回空列表', async () => {
    const fileSystem = new FakeFileSystem();
    const { panel } = await openMapPanel(createCapabilities(), fileSystem);

    paintOneCell(panel);
    await waitFor(async () => expect(await readRecentTilesFile(fileSystem)).toEqual({ tiles: [1] }));

    await panel.clearRecentTiles();

    expect(viewState(panel).recentTiles).toEqual([]);
    expect(await readRecentTilesFile(fileSystem)).toEqual({ tiles: [] });
  });

  // 写文件失败时静默降级：文档仍被改、未保存仍出现，也没有未捕获的拒绝
  it('写文件失败不打断落笔', async () => {
    const fileSystem = new FakeFileSystem();
    const { panel } = await openMapPanel(createCapabilities(), fileSystem);

    fileSystem.failing.add(MAP_RECENT_TILES_PATH);
    paintOneCell(panel);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(viewState(panel).document?.layers[0].cells[0][0]).toBe(1);
    expect(viewState(panel).unsaved).toBe(true);
    await expect(fileSystem.readFile(MAP_RECENT_TILES_PATH)).rejects.toThrow();
  });
});
