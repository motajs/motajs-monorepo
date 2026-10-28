import { act, cleanup, configure, fireEvent, render, screen } from '@testing-library/react';
import { EditorCore, IEditorPanel, IEditorPanelFactoryParam, PanelCloseChoice } from '@motajs/editor-core';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMapPanelType, MAP_PANEL_TYPE_ID, MapPanel } from '..';
import { IMapDataSection, IMapDocument, IMapEditorCapabilities, IMapSummary } from '../types';
import { createMapDocument, createMapHarness, FakeFileSystem } from './fixtures';

// 地图面板的关闭三态：没脏就直放行、脏就弹框、三个选择各走各的结算。
// 全部经真实 EditorCore 装配，因此「不保存关闭」会真的走到 onDiscard 与跳过落盘的释放路径。

configure({ testIdAttribute: 'data-test-id' });

/** 已装配好的面板 */
interface IHarness {
  /** 已初始化的编辑器核心 */
  readonly system: EditorCore;
  /** 被捕获的地图面板实例 */
  readonly panel: MapPanel;
  /** 面板所在标签的标识 */
  readonly tabId: string;
}

/**
 * 造一张所有格子都为 0 的地图，便于断言落笔前后的变化
 * @returns 空格子的中立文档
 */
function createEmptyDocument(): IMapDocument {
  const base = createMapDocument({ id: 'm1', name: '地图一' });
  const layers = base.layers.map((layer) => ({
    ...layer,
    cells: layer.cells.map((row) => row.map(() => 0)),
  }));

  return { ...base, layers };
}

/**
 * 造一份只实现打开与保存的地图能力
 * @param saveMapData 保存实现
 * @returns 地图能力注入面
 */
function createCapabilities(
  saveMapData: (data: IMapDataSection) => Promise<void> = async (): Promise<void> => {},
): IMapEditorCapabilities {
  const document = createEmptyDocument();

  return {
    listMaps: async (): Promise<readonly IMapSummary[]> => [{ id: document.id, name: document.name }],
    openMap: async (): Promise<IMapDocument> => document,
    saveMapData,
  };
}

/**
 * 装配核心、注册带实例捕获的地图面板类型，并按打开参数打开首张地图
 * @param capabilities 地图能力注入面
 * @returns 核心、面板实例与标签标识
 */
async function openPanel(capabilities: IMapEditorCapabilities): Promise<IHarness> {
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

  await act(async () => {
    await system.shellSystem.openPanelInTab(tabId, MAP_PANEL_TYPE_ID, { target: { mapId: 'm1' } });
  });
  await act(async () => {});

  return { system, panel: panels[0], tabId };
}

/**
 * 落一笔改动，让面板变成「有未保存改动」
 * @param panel 地图面板实例
 */
function makeDirty(panel: MapPanel): void {
  panel.commitCells('layer-base', [{ x: 0, y: 0, value: 1 }]);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('地图面板：关闭三态', () => {
  // 没有脏改动：直接返回 Save，不弹关闭框、不写盘
  it('没有脏改动时直接允许关闭且不弹框', async () => {
    const saveMapData = vi.fn(async (_data: IMapDataSection): Promise<void> => {});
    const harness = await openPanel(createCapabilities(saveMapData));

    render(createElement(harness.system.shellSystem.render()));
    await act(async () => {});

    let choice = PanelCloseChoice.Cancel;

    await act(async () => {
      choice = await harness.panel.onRequestClose();
    });

    expect(choice).toBe(PanelCloseChoice.Save);
    expect(screen.queryByTestId('panel-close-dialog')).toBeNull();
    expect(saveMapData).not.toHaveBeenCalled();
  });

  // 有脏改动：弹框出现，三个选择按钮齐全
  it('有脏改动时弹出三态框且三个选择都在', async () => {
    const harness = await openPanel(createCapabilities());

    render(createElement(harness.system.shellSystem.render()));
    await act(async () => {});

    makeDirty(harness.panel);

    let closing: Promise<PanelCloseChoice> = Promise.resolve(PanelCloseChoice.Cancel);

    await act(async () => {
      closing = harness.panel.onRequestClose();
    });

    expect(screen.queryByTestId('panel-close-dialog')).not.toBeNull();
    expect(screen.queryByTestId('panel-close-cancel')).not.toBeNull();
    expect(screen.queryByTestId('panel-close-discard')).not.toBeNull();
    expect(screen.queryByTestId('panel-close-save')).not.toBeNull();

    fireEvent.click(screen.getByTestId('panel-close-cancel'));

    await act(async () => {
      await closing;
    });
  });

  // 取消：弹窗消失，标签仍在，改动仍算脏
  it('取消后弹窗消失且标签保持打开', async () => {
    const harness = await openPanel(createCapabilities());

    render(createElement(harness.system.shellSystem.render()));
    await act(async () => {});

    makeDirty(harness.panel);

    let closing: Promise<void> = Promise.resolve();

    await act(async () => {
      closing = harness.system.shellSystem.closeTab(harness.tabId);
      await Promise.resolve();
    });

    fireEvent.click(screen.getByTestId('panel-close-cancel'));

    await act(async () => {
      await closing;
    });

    expect(screen.queryByTestId('panel-close-dialog')).toBeNull();
    expect(harness.system.shellSystem.listTabs()).toHaveLength(1);
    expect(harness.panel.isDirty()).toBe(true);
  });

  // 不保存关闭：弹窗消失，标签释放，一次盘都没写
  it('不保存关闭时弹窗消失且不写盘', async () => {
    const saveMapData = vi.fn(async (_data: IMapDataSection): Promise<void> => {});
    const harness = await openPanel(createCapabilities(saveMapData));

    render(createElement(harness.system.shellSystem.render()));
    await act(async () => {});

    makeDirty(harness.panel);

    let closing: Promise<void> = Promise.resolve();

    await act(async () => {
      closing = harness.system.shellSystem.closeTab(harness.tabId);
      await Promise.resolve();
    });

    fireEvent.click(screen.getByTestId('panel-close-discard'));

    await act(async () => {
      await closing;
    });

    expect(screen.queryByTestId('panel-close-dialog')).toBeNull();
    expect(harness.system.shellSystem.listTabs().some((tab) => tab.id === harness.tabId)).toBe(false);
    expect(saveMapData).not.toHaveBeenCalled();
  });

  // 保存并关闭：盘写了一次，弹窗消失、标签关闭
  it('保存并关闭时写盘一次并关闭标签', async () => {
    const saveMapData = vi.fn(async (_data: IMapDataSection): Promise<void> => {});
    const harness = await openPanel(createCapabilities(saveMapData));

    render(createElement(harness.system.shellSystem.render()));
    await act(async () => {});

    makeDirty(harness.panel);

    let closing: Promise<void> = Promise.resolve();

    await act(async () => {
      closing = harness.system.shellSystem.closeTab(harness.tabId);
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('panel-close-save'));
    });
    await act(async () => {
      await closing;
    });

    expect(saveMapData).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('panel-close-dialog')).toBeNull();
    expect(harness.system.shellSystem.listTabs().some((tab) => tab.id === harness.tabId)).toBe(false);
  });

  // 保存失败：弹窗仍在并显示失败原因，标签保持打开、内存改动不丢
  it('保存失败时保持打开并显示原因', async () => {
    const saveMapData = vi.fn(async (_data: IMapDataSection): Promise<void> => {
      throw new Error('磁盘已满');
    });
    const harness = await openPanel(createCapabilities(saveMapData));

    render(createElement(harness.system.shellSystem.render()));
    await act(async () => {});

    makeDirty(harness.panel);

    let choice: PanelCloseChoice = PanelCloseChoice.Save;
    let closing: Promise<PanelCloseChoice> = Promise.resolve(PanelCloseChoice.Cancel);

    await act(async () => {
      closing = harness.panel.onRequestClose();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('panel-close-save'));
    });
    await act(async () => {
      choice = await closing;
    });

    expect(choice).toBe(PanelCloseChoice.Cancel);
    expect(screen.queryByTestId('panel-close-dialog')).not.toBeNull();
    expect(screen.getByTestId('panel-close-error').textContent).toContain('磁盘已满');
    expect(harness.system.shellSystem.listTabs()).toHaveLength(1);
    expect(harness.panel['store'].state.document?.layers[0].cells[0][0]).toBe(1);
  });
});
