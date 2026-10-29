import { act, cleanup, configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EditorCore, IEditorPanelType } from '@motajs/editor-core';
import { ASSET_PANEL_TYPE_ID } from '@motajs/editor-impl/asset';
import { createFileExplorerPanelType } from '@motajs/editor-impl/explorer';
import { IMapEditorCapabilities, MAP_PANEL_TYPE_ID } from '@motajs/editor-impl/map';
import { tablePanelType } from '@motajs/editor-impl/table';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryBackend } from '../backend/memoryBackend';
import { registerAssetDemo, seedAssetDemo } from '../demo/assetDemo';
import { registerMapDemo, seedMapDemo } from '../demo/mapDemo';
import { TABLE_DEMO_DATA, TABLE_DEMO_DATA_PATH, TABLE_DEMO_SCHEMA, TABLE_DEMO_SCHEMA_PATH } from '../demo/tableDemo';

// 开发宿主资源管理器的集成用例：按 main.tsx 的装配重建组合根，经真实外壳打开三类文件，断言各自落在正确面板。
// Pixi 表面换成空壳，jsdom 不初始化 WebGL；图片与素材预览需要 `URL.createObjectURL`，这里只补两个静态方法。

vi.mock('../../../../libs/editor-impl/src/map/components/MapSurface', async () => {
  const React = await import('react');

  return { MapSurface: () => React.createElement('div', { 'data-test-id': 'map-surface-stub' }) };
});

configure({ testIdAttribute: 'data-test-id' });

Object.defineProperty(URL, 'createObjectURL', { value: vi.fn((): string => 'blob:test'), configurable: true });
Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });

/** 开发宿主的装配结果 */
interface IDevHost {
  /** 编辑器核心 */
  readonly core: EditorCore;
  /** 内存后端，供用例读取目录与文件 */
  readonly backend: MemoryBackend;
  /** 注入给地图面板的能力对象，供路径解析用例断言 */
  readonly mapCapabilities: IMapEditorCapabilities;
}

// 每个用例结束后卸载已挂载的组件，避免 DOM 在用例之间累积
afterEach(() => {
  cleanup();
});

/**
 * 装配开发宿主组合根：seed 演示表格 / 素材 / 地图，注册三种面板类型与资源管理器，再初始化核心
 * @returns 核心与内存后端
 */
async function createHost(): Promise<IDevHost> {
  const core = new EditorCore();
  const backend = new MemoryBackend();

  backend.seed(TABLE_DEMO_DATA_PATH, TABLE_DEMO_DATA);
  backend.seed(TABLE_DEMO_SCHEMA_PATH, TABLE_DEMO_SCHEMA);
  backend.seed('notes.txt', '没有面板认领这个文件');
  await seedAssetDemo(backend, { width: 64, height: 64 });
  await seedMapDemo(backend);
  core.shellSystem.registerPanelType(tablePanelType);
  registerAssetDemo(core);
  const mapCapabilities = registerMapDemo(core, backend);
  core.shellSystem.registerPanelType(
    createFileExplorerPanelType({
      listPanelTypes: (): readonly IEditorPanelType[] => core.shellSystem.listPanelTypes(),
      openPanel: async (typeId: string, openParam: Record<string, unknown>): Promise<boolean> => {
        const tabId = core.shellSystem.openBlankTab();
        const opened = await core.shellSystem.openPanelInTab(tabId, typeId, openParam);

        if (!opened) await core.shellSystem.closeTab(tabId);

        return opened;
      },
    }),
  );

  await core.initialize({ fs: backend, maxUndoStep: backend.maxUndoStep });
  return { core, backend, mapCapabilities };
}

/**
 * 经真实外壳新开一个标签并打开资源管理器
 * @param core 编辑器核心
 * @returns 资源管理器标签的标识符
 */
async function openExplorer(core: EditorCore): Promise<string> {
  const tabId = core.shellSystem.openBlankTab();

  await act(async () => {
    await core.shellSystem.openPanelInTab(tabId, 'explorer');
  });
  await act(async () => {});

  return tabId;
}

/**
 * 渲染外壳并等待资源管理器读到根目录
 * @param core 编辑器核心
 * @returns 渲染容器
 */
async function renderExplorer(core: EditorCore): Promise<HTMLElement> {
  const { container } = render(createElement(core.shellSystem.render()));

  await waitFor(() => {
    expect(container.querySelector('[data-test-id="explorer-entry-content"]')).not.toBeNull();
  });

  return container;
}

/**
 * 点击一个资源管理器条目并等界面稳定
 * @param testId 条目的 data-test-id
 */
async function clickEntry(testId: string): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByTestId(testId));
  });
  await act(async () => {});
}

/**
 * 取当前标签里指定面板类型的标签数量
 * @param core 编辑器核心
 * @param typeId 面板类型标识
 * @returns 该类型的标签数
 */
function tabCount(core: EditorCore, typeId: string): number {
  return core.shellSystem.listTabs().filter((tab) => tab.typeId === typeId).length;
}

describe('开发宿主资源管理器', () => {
  // 表格文件只有表格认领，点击后直接新开标签并落在表格面板
  it('表格 .json 只有一个候选，直接开进表格面板', async () => {
    const { core } = await createHost();

    await openExplorer(core);
    await renderExplorer(core);
    await clickEntry('explorer-entry-tables');
    await waitFor(() => {
      expect(screen.getByTestId('explorer-entry-tables/demo.json')).not.toBeNull();
    });

    const tabsBefore = core.shellSystem.listTabs().length;

    await clickEntry('explorer-entry-tables/demo.json');

    await waitFor(() => {
      expect(core.shellSystem.listTabs().length).toBe(tabsBefore + 1);
    });
    expect(screen.queryByTestId('explorer-candidate-dialog')).toBeNull();
    expect(tabCount(core, tablePanelType.id)).toBe(1);
  });

  // 地图文件同时被表格与地图认领：先弹候选弹窗，选「地图」后才新开标签并落在图面板
  it('地图 .json 先弹候选弹窗，选地图后才开进地图面板', async () => {
    const { core } = await createHost();

    await openExplorer(core);
    await renderExplorer(core);
    await clickEntry('explorer-entry-content');
    await waitFor(() => {
      expect(screen.getByTestId('explorer-entry-content/map')).not.toBeNull();
    });
    await clickEntry('explorer-entry-content/map');
    await waitFor(() => {
      expect(screen.getByTestId('explorer-entry-content/map/small.json')).not.toBeNull();
    });

    const tabsBefore = core.shellSystem.listTabs().length;

    await clickEntry('explorer-entry-content/map/small.json');

    await waitFor(() => {
      expect(screen.getByTestId('explorer-candidate-dialog')).not.toBeNull();
    });
    expect(core.shellSystem.listTabs().length).toBe(tabsBefore);
    expect(tabCount(core, MAP_PANEL_TYPE_ID)).toBe(0);

    await act(async () => {
      fireEvent.click(screen.getByTestId('explorer-candidate-map'));
    });

    await waitFor(() => {
      expect(tabCount(core, MAP_PANEL_TYPE_ID)).toBe(1);
    });
    expect(screen.queryByTestId('explorer-candidate-dialog')).toBeNull();
  });

  // 素材字节文件只有素材认领，点击后直接新开标签并落在素材面板
  it('素材 .png 只有一个候选，直接开进素材面板', async () => {
    const { core } = await createHost();

    await openExplorer(core);
    await renderExplorer(core);
    await clickEntry('explorer-entry-content');
    await waitFor(() => {
      expect(screen.getByTestId('explorer-entry-content/texture')).not.toBeNull();
    });
    await clickEntry('explorer-entry-content/texture');
    await waitFor(() => {
      expect(screen.getByTestId('explorer-entry-content/texture/hero.png')).not.toBeNull();
    });

    await clickEntry('explorer-entry-content/texture/hero.png');

    await waitFor(() => {
      expect(tabCount(core, ASSET_PANEL_TYPE_ID)).toBe(1);
    });
    expect(screen.queryByTestId('explorer-candidate-dialog')).toBeNull();
  });

  // 没有任何面板认领的文件（如 .txt）被资源管理器整行过滤，界面上不存在可点击的行
  it('.txt 没有候选，不出现在资源管理器里', async () => {
    const { core } = await createHost();

    await openExplorer(core);
    await renderExplorer(core);

    expect(screen.queryByTestId('explorer-entry-notes.txt')).toBeNull();
    expect(screen.getByTestId('explorer-entry-content')).not.toBeNull();
  });

  // 地图路径解析只认 content/map/<单段>.json：前缀、后缀、多段标识任一不符都返回 null
  it('地图路径解析只接受 content/map/<id>.json', async () => {
    const { mapCapabilities } = await createHost();
    const resolveMapPath = mapCapabilities.resolveMapPath;

    expect(resolveMapPath).toBeDefined();

    if (resolveMapPath === undefined) return;

    expect(resolveMapPath('content/map/tower.json')).toBe('tower');
    expect(resolveMapPath('content/other/tower.json')).toBeNull();
    expect(resolveMapPath('content/map/tower.jsonc')).toBeNull();
    expect(resolveMapPath('content/map/a/b.json')).toBeNull();
    expect(resolveMapPath('content/map/.json')).toBeNull();
  });
});
