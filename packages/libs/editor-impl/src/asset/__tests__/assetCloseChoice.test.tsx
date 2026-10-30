import { act, cleanup, configure, fireEvent, render, screen } from '@testing-library/react';
import { EditorCore, PanelCloseChoice } from '@motajs/editor-core';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ASSET_PANEL_TYPE_ID, AssetPanel } from '..';
import { ASSET_TEST_CATEGORIES, createAssetHarness, FakeFileSystem, listText } from './fixtures';

// 素材面板的关闭三态：没脏就直放行、脏就弹框、三个选择各走各的结算。
// 全部经真实 EditorCore 装配，因此「不保存关闭」会真的走到 onDiscard 与跳过落盘的释放路径。

configure({ testIdAttribute: 'data-test-id' });

/** 图片列表文件路径 */
const TEXTURE_LIST_PATH = 'content/texture/.list.jsonc';

/** 已装配好的面板 */
interface IHarness {
  /** 已初始化的编辑器核心 */
  readonly system: EditorCore;
  /** 被捕获的素材面板实例 */
  readonly panel: AssetPanel;
  /** 注入的内存文件系统 */
  readonly fs: FakeFileSystem;
  /** 面板所在标签的标识 */
  readonly tabId: string;
}

/**
 * 注册一个把新建实例收进数组的素材面板类型并打开图片分类
 * @param fs 注入的内存文件系统
 * @returns 核心、面板实例、文件系统与标签标识
 */
async function openTexturePanel(fs: FakeFileSystem): Promise<IHarness> {
  const system = await createAssetHarness(fs);
  const created: AssetPanel[] = [];

  system.shellSystem.registerPanelType({
    id: ASSET_PANEL_TYPE_ID,
    name: '素材管理器',
    icon: createElement('div'),
    create: (param): AssetPanel => {
      const panel = new AssetPanel(param, { categories: ASSET_TEST_CATEGORIES });

      created.push(panel);
      return panel;
    },
  });

  const tabId = system.shellSystem.listTabs()[0].id;

  await system.shellSystem.openPanelInTab(tabId, ASSET_PANEL_TYPE_ID);

  const panel = created[0];

  await panel.selectCategory('texture');

  return { system, panel, fs, tabId };
}

/**
 * 造一份只有一张图片的图片分类
 * @returns 已 seed 好的内存文件系统
 */
function createTextureFileSystem(): FakeFileSystem {
  const fs = new FakeFileSystem();

  fs.seed(TEXTURE_LIST_PATH, listText({ textures: [{ source: 'hero.png' }] }));
  fs.seed('content/texture/hero.png', new Uint8Array([1]));

  return fs;
}

/**
 * 落一笔改动，让面板变成「有未保存改动」
 * @param panel 素材面板实例
 * @returns 处理完成的异步结果
 */
async function makeDirty(panel: AssetPanel): Promise<void> {
  await panel.unregisterAsset('hero.png');
}

// 每个用例结束后卸载已挂载的组件并还原替身，避免 DOM 与调用记录在用例之间累积
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('素材面板：关闭三态', () => {
  // 没有脏改动：直接返回 Save，不弹关闭框、不写盘
  it('没有脏改动时直接允许关闭且不弹框', async () => {
    const fs = createTextureFileSystem();
    const harness = await openTexturePanel(fs);
    const writeFile = vi.spyOn(fs, 'writeFile');

    render(createElement(harness.panel.render()));

    let choice = PanelCloseChoice.Cancel;

    await act(async () => {
      choice = await harness.panel.onRequestClose();
    });

    expect(choice).toBe(PanelCloseChoice.Save);
    expect(screen.queryByTestId('panel-close-dialog')).toBeNull();
    expect(writeFile).not.toHaveBeenCalled();
  });

  // 有脏改动：弹框出现，三个选择按钮齐全
  it('有脏改动时弹出三态框且三个选择都在', async () => {
    const fs = createTextureFileSystem();
    const harness = await openTexturePanel(fs);

    render(createElement(harness.panel.render()));
    await makeDirty(harness.panel);

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
    const fs = createTextureFileSystem();
    const harness = await openTexturePanel(fs);

    render(createElement(harness.panel.render()));
    await makeDirty(harness.panel);

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
    expect(harness.panel['store'].state.unsaved).toBe(true);
  });

  // 不保存关闭：弹窗消失，标签释放，一次盘都没写
  it('不保存关闭时弹窗消失且不写盘', async () => {
    const fs = createTextureFileSystem();
    const harness = await openTexturePanel(fs);
    const writeFile = vi.spyOn(fs, 'writeFile');

    render(createElement(harness.panel.render()));
    await makeDirty(harness.panel);

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
    expect(writeFile).not.toHaveBeenCalled();
  });

  // 保存并关闭：盘写了一次，弹窗消失、标签关闭
  it('保存并关闭时写盘一次并关闭标签', async () => {
    const fs = createTextureFileSystem();
    const harness = await openTexturePanel(fs);
    const writeFile = vi.spyOn(fs, 'writeFile');

    render(createElement(harness.panel.render()));
    await makeDirty(harness.panel);

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

    expect(writeFile).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('panel-close-dialog')).toBeNull();
    expect(harness.system.shellSystem.listTabs().some((tab) => tab.id === harness.tabId)).toBe(false);
  });

  // 写盘失败：面板这一层只把改动排进缓冲（因此结算为保存），但待写必须保留，清掉故障后仍能落盘
  it('保存失败时改动不丢且重试可落盘', async () => {
    const fs = createTextureFileSystem();
    const harness = await openTexturePanel(fs);

    render(createElement(harness.panel.render()));
    await makeDirty(harness.panel);

    fs.failing.add(TEXTURE_LIST_PATH);

    let choice: PanelCloseChoice = PanelCloseChoice.Cancel;
    let closing: Promise<PanelCloseChoice> = Promise.resolve(PanelCloseChoice.Save);

    await act(async () => {
      closing = harness.panel.onRequestClose();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('panel-close-save'));
    });
    await act(async () => {
      choice = await closing;
    });

    // 保存只写缓冲，面板层必然结算为「保存」；真正的磁盘失败由外壳 flush 承担
    expect(choice).toBe(PanelCloseChoice.Save);
    expect(screen.queryByTestId('panel-close-dialog')).toBeNull();
    expect(harness.system.resourceSystem.hasAnyPendingContent()).toBe(true);

    fs.failing.delete(TEXTURE_LIST_PATH);

    await act(async () => {
      await harness.system.resourceSystem.flushAllContent();
    });

    expect(harness.system.resourceSystem.hasAnyPendingContent()).toBe(false);
    expect(await fs.readFile(TEXTURE_LIST_PATH)).not.toContain('hero.png');
  });
});
