import {
  EditorEntryKind,
  IEditorPanelContext,
  IEditorPanelFactoryParam,
  IEditorPanelType,
  IFileEntry,
} from '@motajs/editor-core';
import { act, cleanup, configure, fireEvent, render, screen } from '@testing-library/react';
import { message } from 'antd';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFileExplorerPanelType, FileExplorerPanel, IFileExplorerCapabilities } from '..';

configure({ testIdAttribute: 'data-test-id' });

// 每个用例结束后卸载已挂载的组件并还原被替换的实现，避免 DOM 与替身在用例之间累积
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// 根目录条目：一个点开头目录、一个普通目录、一个可打开文件、一个不可打开文件
const ROOT_ENTRIES: readonly IFileEntry[] = [
  { path: 'content', name: 'content', kind: EditorEntryKind.Directory },
  { path: '.editor', name: '.editor', kind: EditorEntryKind.Directory },
  { path: 'hero.json', name: 'hero.json', kind: EditorEntryKind.File },
  { path: 'notes.txt', name: 'notes.txt', kind: EditorEntryKind.File },
];

/**
 * 造一个只提供目录读取的假面板上下文
 * @param entries 任何目录都返回的固定条目
 * @returns 假上下文
 */
function createContext(entries: readonly IFileEntry[]): IEditorPanelContext {
  return {
    requestResource: async (): Promise<null> => null,
    createResource: async (): Promise<null> => null,
    deleteResource: async (): Promise<void> => {},
    moveResource: async (): Promise<void> => {},
    listDirectory: async (): Promise<readonly IFileEntry[]> => entries,
    addUndoContext: (): void => {},
  };
}

/**
 * 造一个只用于候选判定的面板类型
 * @param id 类型标识
 * @param name 类型名称
 * @param accepts 判定该类型能否打开某路径
 * @returns 面板类型
 */
function makeType(id: string, name: string, accepts: (path: string) => boolean): IEditorPanelType {
  return {
    id,
    name,
    icon: createElement('span'),
    create: (param: IEditorPanelFactoryParam): FileExplorerPanel =>
      new FileExplorerPanel(param, { listPanelTypes: () => [], openPanel: async () => true }),
    canOpen: accepts,
    createOpenParam: (path: string): Record<string, unknown> => ({ path }),
  };
}

/**
 * 装配一个资源管理器面板与可观察的假能力
 * @param types 已注册的面板类型
 * @returns 面板与打开回调替身
 */
function createPanel(types: readonly IEditorPanelType[]) {
  const openPanel = vi.fn<IFileExplorerCapabilities['openPanel']>();

  openPanel.mockResolvedValue(true);

  const capabilities: IFileExplorerCapabilities = { listPanelTypes: () => types, openPanel };
  const panel = new FileExplorerPanel({ context: createContext(ROOT_ENTRIES), instanceId: 'explorer-1' }, capabilities);

  return { panel, openPanel };
}

/**
 * 挂载面板视图
 * @param panel 资源管理器面板
 * @returns 渲染结果
 */
function renderPanel(panel: FileExplorerPanel) {
  const View = panel.render();

  return render(createElement(View));
}

/**
 * 等待浏览器完成一次目录读取
 * @returns 无返回值的 Promise
 */
async function flush(): Promise<void> {
  await act(async (): Promise<void> => {});
}

describe('文件资源管理器面板', () => {
  // 目录级隐藏点开头目录，文件级隐藏无候选的文件，普通目录照常显示
  it('隐藏点开头目录与非候选文件，普通目录照常显示', async () => {
    const { panel } = createPanel([makeType('json', 'JSON', (path) => path.endsWith('.json'))]);

    renderPanel(panel);
    await flush();

    expect(screen.queryByTestId('explorer-entry-.editor')).toBeNull();
    expect(screen.queryByTestId('explorer-entry-notes.txt')).toBeNull();
    expect(screen.queryByTestId('explorer-entry-content')).not.toBeNull();
    expect(panel.filterPath('content/map/a.json')).toBe(true);
    expect(panel.filterPath('.editor/map-tiles.json')).toBe(false);
  });

  // 0 候选：直接调面板 API 时提示没有可打开的面板，且不调用宿主的打开回调
  it('0 候选时提示没有可打开的面板且不打开', async () => {
    const { panel, openPanel } = createPanel([makeType('table', '表格', () => false)]);
    const warning = vi.spyOn(message, 'warning');

    await act(async () => {
      await panel.openPath('notes.txt');
    });

    expect(openPanel).not.toHaveBeenCalled();
    expect(warning).toHaveBeenCalledWith('没有可以打开该文件的面板');
  });

  // 1 候选：点击文件行直接打开，不出现候选弹窗
  it('单个候选直接打开且不弹候选弹窗', async () => {
    const { panel, openPanel } = createPanel([makeType('table', '表格', (path) => path === 'hero.json')]);

    renderPanel(panel);
    await flush();

    await act(async () => {
      fireEvent.click(screen.getByTestId('explorer-entry-hero.json'));
    });

    expect(openPanel).toHaveBeenCalledTimes(1);
    expect(openPanel.mock.calls[0][0]).toBe('table');
    expect(openPanel.mock.calls[0][1]).toEqual({ path: 'hero.json' });
    expect(screen.queryByTestId('explorer-candidate-dialog')).toBeNull();
  });

  // 2 候选：先弹候选弹窗，点选后才打开，且弹窗从 DOM 消失
  it('多个候选时点选后打开且弹窗消失', async () => {
    const { panel, openPanel } = createPanel([
      makeType('table', '表格', (path) => path === 'hero.json'),
      makeType('map', '地图', (path) => path === 'hero.json'),
    ]);

    renderPanel(panel);
    await flush();

    await act(async () => {
      fireEvent.click(screen.getByTestId('explorer-entry-hero.json'));
    });

    expect(screen.queryByTestId('explorer-candidate-dialog')).not.toBeNull();
    expect(openPanel).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByTestId('explorer-candidate-table'));
    });

    expect(openPanel).toHaveBeenCalledTimes(1);
    expect(openPanel.mock.calls[0][0]).toBe('table');
    expect(screen.queryByTestId('explorer-candidate-dialog')).toBeNull();
  });

  // 2 候选：点取消不打开，且弹窗同样从 DOM 消失
  it('多个候选取消后不打开且弹窗消失', async () => {
    const { panel, openPanel } = createPanel([
      makeType('table', '表格', (path) => path === 'hero.json'),
      makeType('map', '地图', (path) => path === 'hero.json'),
    ]);

    renderPanel(panel);
    await flush();

    await act(async () => {
      fireEvent.click(screen.getByTestId('explorer-entry-hero.json'));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('explorer-candidate-cancel'));
    });

    expect(openPanel).not.toHaveBeenCalled();
    expect(screen.queryByTestId('explorer-candidate-dialog')).toBeNull();
  });

  // 资源变化后重读当前目录，但目录不变
  it('资源变化后重列当前目录且目录不重置', async () => {
    const { panel } = createPanel([makeType('table', '表格', (path) => path === 'hero.json')]);
    const loadChildren = vi.spyOn(panel, 'loadChildren');

    renderPanel(panel);
    await flush();

    const callsBefore = loadChildren.mock.calls.length;

    await act(async () => {
      await panel.onResourceChange();
    });
    await flush();

    expect(loadChildren.mock.calls.length).toBe(callsBefore + 1);
    expect(screen.getByTestId('explorer-current').textContent).toBe('/');
  });

  // 宿主打开失败时提示错误文案
  it('打开失败时提示稍后重试', async () => {
    const { panel, openPanel } = createPanel([makeType('table', '表格', (path) => path === 'hero.json')]);
    const error = vi.spyOn(message, 'error');

    openPanel.mockResolvedValue(false);

    renderPanel(panel);
    await flush();

    await act(async () => {
      fireEvent.click(screen.getByTestId('explorer-entry-hero.json'));
    });

    expect(error).toHaveBeenCalledWith('打开失败，请稍后重试');
  });

  // 资源管理器自身不声明候选能力，id 与名称符合契约
  it('面板类型自身不出现在候选里', () => {
    const type = createFileExplorerPanelType({ listPanelTypes: () => [], openPanel: async () => true });

    expect(type.id).toBe('explorer');
    expect(type.name).toBe('文件资源管理器');
    expect(type.canOpen).toBeUndefined();
    expect(type.createOpenParam).toBeUndefined();
  });
});
