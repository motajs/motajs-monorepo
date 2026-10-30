import { act, cleanup, configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EditorCore, EditorFileChangeKind } from '@motajs/editor-core';
import { message } from 'antd';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ASSET_PANEL_TYPE_ID, AssetPanel } from '..';
import { IAssetEntry } from '../types';
import { ASSET_TEST_CATEGORIES, createAssetHarness, FakeFileSystem, listText } from './fixtures';

// 素材面板的两类外部变化：清单文件重读 / 冲突，目录内字节只递增版本号；自身写入回声与重复事件都被压掉。
// 用例直接投递 IEditorPanel.onResourceChange（路径合法性与索引维护由 core 的既有用例覆盖），
// 因此每条用例都能精确断言「条目有没有换、版本号有没有动、冲突框有没有出现」。

configure({ testIdAttribute: 'data-test-id' });

/** 图片列表文件路径 */
const TEXTURE_LIST_PATH = 'content/texture/.list.jsonc';

/** 图片分类目录 */
const TEXTURE_DIR = 'content/texture';

/** 已装配好的面板与文件系统 */
interface IHarness {
  /** 已初始化的编辑器核心 */
  readonly system: EditorCore;
  /** 被捕获的素材面板实例 */
  readonly panel: AssetPanel;
  /** 注入的内存文件系统 */
  readonly fs: FakeFileSystem;
}

/**
 * 注册一个把新建实例收进数组的素材面板类型并打开图片分类
 * @param fs 注入的内存文件系统
 * @returns 核心、面板实例与文件系统
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

  return { system, panel, fs };
}

/**
 * 投递一次外部变化：先让资源层失效缓存（真实宿主在变化事件里做同一件事），再交给面板
 * @param harness 面板装配结果
 * @param path 变化路径
 * @param kind 变化种类
 * @returns 处理完成的异步结果
 */
async function dispatchChange(
  harness: IHarness,
  path: string,
  kind: EditorFileChangeKind = EditorFileChangeKind.Change,
): Promise<void> {
  await harness.system.resourceSystem.updateResource(path);
  await act(async () => {
    await harness.panel.onResourceChange(path, kind);
  });
}

/**
 * 取当前分类里某个名字的条目
 * @param harness 面板装配结果
 * @param name 素材名
 * @returns 命中的条目；不存在时为 undefined
 */
function entryOf(harness: IHarness, name: string): IAssetEntry | undefined {
  return harness.panel['store'].state.entries.find((entry) => entry.name === name);
}

/**
 * 取某张素材卡片的节点
 * @param container 渲染容器
 * @param name 素材名
 * @returns 卡片节点；未渲染时为 null
 */
function cardOf(container: HTMLElement, name: string): Element | null {
  return container.querySelector(`[data-test-id="asset-card-${name}"]`);
}

// 每个用例结束后卸载已挂载的组件并还原替身，避免 DOM 与调用记录在用例之间累积
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('素材面板：外部变化', () => {
  // 清单文件被外部改动且不脏：静默重读分类，新条目出现在卡片列表里
  it('清单变化且不脏时重读分类', async () => {
    const fs = new FakeFileSystem();

    fs.seed(TEXTURE_LIST_PATH, listText({ textures: [{ source: 'hero.png' }] }));
    fs.seed(`${TEXTURE_DIR}/hero.png`, new Uint8Array([1]));
    fs.seed(`${TEXTURE_DIR}/foe.png`, new Uint8Array([2]));

    const harness = await openTexturePanel(fs);
    const container = render(createElement(harness.panel.render())).container;

    await waitFor((): void => {
      expect(cardOf(container, 'hero.png')).not.toBeNull();
    });

    fs.seed(TEXTURE_LIST_PATH, listText({ textures: [{ source: 'hero.png' }, { source: 'foe.png' }] }));
    await dispatchChange(harness, TEXTURE_LIST_PATH);

    await waitFor((): void => {
      expect(cardOf(container, 'foe.png')).not.toBeNull();
    });

    expect(harness.panel['store'].state.unsaved).toBe(false);
    expect(screen.queryByTestId('panel-conflict-dialog')).toBeNull();
  });

  // 清单文件被外部改动但内存有脏改动：内容不换，冲突框出现在 DOM 里
  it('清单变化且脏时弹冲突框且内容不变', async () => {
    const fs = new FakeFileSystem();

    fs.seed(TEXTURE_LIST_PATH, listText({ textures: [{ source: 'hero.png' }] }));
    fs.seed(`${TEXTURE_DIR}/hero.png`, new Uint8Array([1]));
    fs.seed(`${TEXTURE_DIR}/foe.png`, new Uint8Array([2]));

    const harness = await openTexturePanel(fs);
    const container = render(createElement(harness.panel.render())).container;

    await waitFor((): void => {
      expect(cardOf(container, 'hero.png')).not.toBeNull();
    });

    await harness.panel.unregisterAsset('hero.png');

    const entriesBefore = harness.panel['store'].state.entries;

    fs.seed(TEXTURE_LIST_PATH, listText({ textures: [{ source: 'hero.png' }, { source: 'foe.png' }] }));
    await dispatchChange(harness, TEXTURE_LIST_PATH);

    expect(screen.queryByTestId('panel-conflict-dialog')).not.toBeNull();
    expect(harness.panel['store'].state.entries).toBe(entriesBefore);
    expect(entryOf(harness, 'foe.png')?.registered).toBe(false);
  });

  // 冲突里选「放弃我的改动并刷新」：内容换成外部原文，冲突框关掉
  it('放弃冲突后内容变为外部内容', async () => {
    const fs = new FakeFileSystem();

    fs.seed(TEXTURE_LIST_PATH, listText({ textures: [{ source: 'hero.png' }] }));
    fs.seed(`${TEXTURE_DIR}/hero.png`, new Uint8Array([1]));
    fs.seed(`${TEXTURE_DIR}/foe.png`, new Uint8Array([2]));

    const harness = await openTexturePanel(fs);
    const container = render(createElement(harness.panel.render())).container;

    await waitFor((): void => {
      expect(cardOf(container, 'hero.png')).not.toBeNull();
    });

    await harness.panel.unregisterAsset('hero.png');

    fs.seed(TEXTURE_LIST_PATH, listText({ textures: [{ source: 'hero.png' }, { source: 'foe.png' }] }));
    await dispatchChange(harness, TEXTURE_LIST_PATH);

    fireEvent.click(screen.getByTestId('panel-conflict-discard'));

    await waitFor((): void => {
      expect(cardOf(container, 'foe.png')).not.toBeNull();
    });

    expect(screen.queryByTestId('panel-conflict-dialog')).toBeNull();
    expect(entryOf(harness, 'hero.png')?.registered).toBe(true);
    expect(harness.panel['store'].state.unsaved).toBe(false);
  });

  // 冲突里选「保留我的改动，下次保存覆盖」：内容不动，下一次保存把外部内容覆盖掉
  it('保留冲突后内容不变且下次保存覆盖外部', async () => {
    const fs = new FakeFileSystem();

    fs.seed(TEXTURE_LIST_PATH, listText({ textures: [{ source: 'hero.png' }] }));
    fs.seed(`${TEXTURE_DIR}/hero.png`, new Uint8Array([1]));
    fs.seed(`${TEXTURE_DIR}/foe.png`, new Uint8Array([2]));

    const harness = await openTexturePanel(fs);
    const container = render(createElement(harness.panel.render())).container;

    await waitFor((): void => {
      expect(cardOf(container, 'hero.png')).not.toBeNull();
    });

    await harness.panel.unregisterAsset('hero.png');

    fs.seed(TEXTURE_LIST_PATH, listText({ textures: [{ source: 'hero.png' }, { source: 'foe.png' }] }));
    await dispatchChange(harness, TEXTURE_LIST_PATH);

    fireEvent.click(screen.getByTestId('panel-conflict-keep'));

    expect(screen.queryByTestId('panel-conflict-dialog')).toBeNull();
    expect(entryOf(harness, 'foe.png')?.registered).toBe(false);

    await act(async () => {
      await harness.panel.save();
      // 保存只写缓冲：要核对磁盘就必须显式写盘
      await harness.system.resourceSystem.flushContent(TEXTURE_LIST_PATH);
    });

    expect(await fs.readFile(TEXTURE_LIST_PATH)).not.toContain('foe.png');
  });

  // 条目字节变化：只递增该条目的字节版本，清单文件一个字都没重读
  it('条目字节变化只递增字节版本且不重读清单', async () => {
    const fs = new FakeFileSystem();

    fs.seed(TEXTURE_LIST_PATH, listText({ textures: [{ source: 'hero.png' }, { source: 'foe.png' }] }));
    fs.seed(`${TEXTURE_DIR}/hero.png`, new Uint8Array([1]));
    fs.seed(`${TEXTURE_DIR}/foe.png`, new Uint8Array([2]));

    const harness = await openTexturePanel(fs);
    const container = render(createElement(harness.panel.render())).container;

    await waitFor((): void => {
      expect(cardOf(container, 'hero.png')).not.toBeNull();
    });

    const readFile = vi.spyOn(fs, 'readFile');
    const before = entryOf(harness, 'hero.png');

    expect(before?.byteVersion ?? 0).toBe(0);

    fs.seed(`${TEXTURE_DIR}/hero.png`, new Uint8Array([9, 9, 9]));
    await dispatchChange(harness, `${TEXTURE_DIR}/hero.png`);

    const after = entryOf(harness, 'hero.png');

    expect(after?.byteVersion ?? 0).toBe((before?.byteVersion ?? 0) + 1);
    expect(after?.name).toBe(before?.name);
    // 外壳的更新钩子会按文本重读变化路径，这里只关心清单文件有没有被重读
    expect(readFile.mock.calls.some((call) => call[0] === TEXTURE_LIST_PATH)).toBe(false);
    expect(screen.queryByTestId('panel-conflict-dialog')).toBeNull();
  });

  // 保存后的回声：清单变化与基线一致，不弹框也不重建条目
  it('保存后的清单回声被忽略', async () => {
    const fs = new FakeFileSystem();

    fs.seed(TEXTURE_LIST_PATH, listText({ textures: [{ source: 'hero.png' }, { source: 'foe.png' }] }));
    fs.seed(`${TEXTURE_DIR}/hero.png`, new Uint8Array([1]));
    fs.seed(`${TEXTURE_DIR}/foe.png`, new Uint8Array([2]));

    const harness = await openTexturePanel(fs);
    const container = render(createElement(harness.panel.render())).container;

    await waitFor((): void => {
      expect(cardOf(container, 'hero.png')).not.toBeNull();
    });

    await harness.panel.unregisterAsset('foe.png');
    await act(async () => {
      await harness.panel.save();
      // 显式写盘后，宿主回声才能与「最近一次成功写出的内容」对上而被识别
      await harness.system.resourceSystem.flushContent(TEXTURE_LIST_PATH);
    });

    const entriesAfterSave = harness.panel['store'].state.entries;

    await dispatchChange(harness, TEXTURE_LIST_PATH);

    expect(screen.queryByTestId('panel-conflict-dialog')).toBeNull();
    expect(harness.panel['store'].state.entries).toBe(entriesAfterSave);
  });

  // 同一条字节事件投递两次只处理一次：字节版本只涨一次
  it('同一条事件只处理一次', async () => {
    const fs = new FakeFileSystem();

    fs.seed(TEXTURE_LIST_PATH, listText({ textures: [{ source: 'hero.png' }] }));
    fs.seed(`${TEXTURE_DIR}/hero.png`, new Uint8Array([1]));

    const harness = await openTexturePanel(fs);
    const container = render(createElement(harness.panel.render())).container;

    await waitFor((): void => {
      expect(cardOf(container, 'hero.png')).not.toBeNull();
    });

    fs.seed(`${TEXTURE_DIR}/hero.png`, new Uint8Array([7, 7]));
    await dispatchChange(harness, `${TEXTURE_DIR}/hero.png`);

    const versionAfterFirst = entryOf(harness, 'hero.png')?.byteVersion ?? 0;

    await dispatchChange(harness, `${TEXTURE_DIR}/hero.png`);

    expect(entryOf(harness, 'hero.png')?.byteVersion ?? 0).toBe(versionAfterFirst);
  });

  // 外部内容读取失败：给出提示、不替换内存内容、也不弹冲突框
  it('读取外部内容失败时提示且不替换', async () => {
    const fs = new FakeFileSystem();

    fs.seed(TEXTURE_LIST_PATH, listText({ textures: [{ source: 'hero.png' }] }));
    fs.seed(`${TEXTURE_DIR}/hero.png`, new Uint8Array([1]));

    const harness = await openTexturePanel(fs);
    const container = render(createElement(harness.panel.render())).container;

    await waitFor((): void => {
      expect(cardOf(container, 'hero.png')).not.toBeNull();
    });

    const entriesBefore = harness.panel['store'].state.entries;
    const warnings = vi.spyOn(message, 'warning');

    fs.failing.add(TEXTURE_LIST_PATH);
    await dispatchChange(harness, TEXTURE_LIST_PATH);

    expect(warnings).toHaveBeenCalled();
    expect(String(warnings.mock.calls[0][0])).toContain('读取外部改动失败');
    expect(harness.panel['store'].state.entries).toBe(entriesBefore);
    expect(screen.queryByTestId('panel-conflict-dialog')).toBeNull();
  });
});
