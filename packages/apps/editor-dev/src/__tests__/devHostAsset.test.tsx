import { act, cleanup, configure, render, screen, waitFor } from '@testing-library/react';
import { EditorCore, IUndoable } from '@motajs/editor-core';
import { AssetCapabilityProvider } from '@motajs/editor-impl/asset';
import { useTableCapabilities } from '@motajs/editor-impl/react';
import { createElement, ReactElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryBackend } from '../backend/memoryBackend';
import { ASSET_DEMO_CATEGORIES, ASSET_DEMO_FILES, registerAssetDemo } from '../demo/assetDemo';
import { DevCodeEditorProvider } from '../demo/devCodeEditor';
import { createTablePanelOpener, TABLE_PRESETS } from '../demo/tableDemo';

configure({ testIdAttribute: 'data-test-id' });

// 每个用例结束后卸载已挂载的组件，避免 DOM 在用例之间累积
afterEach(() => {
  cleanup();
});

// 装配开发宿主组合根：内存文件系统 seed 全部演示素材、注册素材面板类型并订阅「无法撤销」提示
async function createHost(): Promise<EditorCore> {
  const core = new EditorCore();
  const backend = new MemoryBackend();

  for (const file of ASSET_DEMO_FILES) backend.seed(file.path, file.content);
  registerAssetDemo(core);

  await core.initialize({ fs: backend, maxUndoStep: backend.maxUndoStep });
  return core;
}

// 探针组件：把能力包里的素材分类数与预设表数渲染成可断言的文本（验证两层 Provider 不互相覆盖）
function CapabilityProbe(): ReactElement {
  const capabilities = useTableCapabilities();

  return createElement(
    'div',
    null,
    createElement(
      'span',
      { 'data-test-id': 'probe-asset-count' },
      String(capabilities.asset?.categories?.length ?? -1),
    ),
    createElement('span', { 'data-test-id': 'probe-preset-count' }, String(capabilities.tablePresets?.length ?? -1)),
  );
}

// 取面板当前渲染出的素材卡片测试标记（保序）
function cardTestIds(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('[data-test-id^="asset-card-"]')).map(
    (element) => element.getAttribute('data-test-id') ?? '',
  );
}

describe('开发宿主素材接入', () => {
  // createPanelInstance('asset') 成功后渲染出素材面板根节点（data-test-id="asset-panel"）
  it('注册后能创建素材面板实例并渲染出面板根', async () => {
    const core = await createHost();
    const panel = await core.shellSystem.createPanelInstance('asset');

    if (panel === null) throw new Error('素材面板实例创建失败');

    const { container } = render(createElement(panel.render()));

    expect(container.querySelector('[data-test-id="asset-panel"]')).not.toBeNull();
  });

  // 切入素材面板后，默认的图片分类读出两条演示素材（DOM 卡片为 hero.png 与 tile.png）
  it('切入后图片分类读出两条演示素材', async () => {
    const core = await createHost();
    const tabId = core.shellSystem.listTabs()[0].id;

    await act(async () => {
      await core.shellSystem.openPanelInTab(tabId, 'asset');
    });

    const { container } = render(createElement(core.shellSystem.render()));

    await waitFor(() => {
      expect(cardTestIds(container)).toEqual(['asset-card-hero.png', 'asset-card-tile.png']);
    });
  });

  // 素材能力 Provider 注入后：素材分类为 4，且表格预设表仍可见（两层 Provider 不互相覆盖）
  it('素材能力 Provider 注入后分类为 4 且表格预设仍可见', async () => {
    const core = await createHost();

    render(
      createElement(AssetCapabilityProvider, {
        access: core.resourceSystem,
        categories: ASSET_DEMO_CATEGORIES,
        capabilities: { tablePanel: createTablePanelOpener(core), tablePresets: TABLE_PRESETS },
        children: createElement(DevCodeEditorProvider, {
          capabilities: {},
          children: createElement(CapabilityProbe),
        }),
      }),
    );

    expect(screen.getByTestId('probe-asset-count').textContent).toBe('4');
    expect(screen.getByTestId('probe-preset-count').textContent).toBe(String(TABLE_PRESETS.length));
  });

  // 撤销命中屏障时订户回调被调用一次，且 undo 返回 false（屏障不弹栈）
  it('撤销命中屏障时订户回调被调用且返回 false', async () => {
    const core = await createHost();
    let blocked = 0;

    core.undoSystem.addHook({
      onUndoBlocked: (): void => {
        blocked += 1;
      },
    });

    const undoable: IUndoable = {
      undo: async (): Promise<void> => {},
      redo: async (): Promise<void> => {},
    };

    core.undoSystem.addUndoContext(undoable, { type: 0, data: null, barrier: true });

    let result = true;

    await act(async () => {
      result = await core.undoSystem.undo();
    });

    expect(result).toBe(false);
    expect(blocked).toBe(1);
  });
});
