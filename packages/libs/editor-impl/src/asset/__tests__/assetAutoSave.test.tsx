import { cleanup, configure, render, waitFor } from '@testing-library/react';
import { EditorCore } from '@motajs/editor-core';
import { message } from 'antd';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ASSET_PANEL_TYPE_ID, AssetPanel } from '..';
import { ASSET_TEST_CATEGORIES, createAssetHarness, FakeFileSystem, listText } from './fixtures';

// 保存模型的回归用例：新增 / 注册当场写盘、切出写盘、写盘失败不装成功、注销仍手动、没读过的分类绝不写盘。
// 全部走 FakeFileSystem + 已初始化的 EditorCore，「第二个面板」也来自磁盘重读而不是共享内存。

configure({ testIdAttribute: 'data-test-id' });

// 每个用例结束后卸载已挂载的组件并还原替身，避免 DOM 与调用记录在用例之间累积
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** 图片列表文件路径 */
const TEXTURE_LIST_PATH = 'content/texture/.list.jsonc';

/** 动画列表文件路径 */
const ANIMATION_LIST_PATH = 'content/animation/.list.jsonc';

/**
 * 注册一个把新建实例收进数组的素材面板类型
 * @param system 已初始化的编辑器核心
 * @param created 收集面板实例的数组
 */
function registerAssetPanel(system: EditorCore, created: AssetPanel[]): void {
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
}

/**
 * 在首个标签页打开素材面板
 * @param system 已初始化的编辑器核心
 * @param created 收集面板实例的数组
 * @returns 新打开的面板实例
 */
async function openPanelTab(system: EditorCore, created: AssetPanel[]): Promise<AssetPanel> {
  registerAssetPanel(system, created);

  const tabId = system.shellSystem.listTabs()[0].id;

  await system.shellSystem.openPanelInTab(tabId, ASSET_PANEL_TYPE_ID);

  return created[0];
}

/**
 * 用空白标签再开一块素材面板（同一会话内的第二个实例）
 * @param system 已初始化的编辑器核心
 * @param created 收集面板实例的数组
 * @returns 新打开的面板实例
 */
async function openAnotherPanel(system: EditorCore, created: AssetPanel[]): Promise<AssetPanel> {
  const tabId = system.shellSystem.openBlankTab();

  await system.shellSystem.openPanelInTab(tabId, ASSET_PANEL_TYPE_ID);

  return created[created.length - 1];
}

/**
 * 渲染面板视图并返回其容器
 * @param panel 素材面板实例
 * @returns 渲染容器
 */
function renderPanel(panel: AssetPanel): HTMLElement {
  return render(createElement(panel.render())).container;
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

/**
 * 读卡片上的登记状态
 * @param card 卡片节点
 * @returns 卡片不存在时为空串；否则为 `true` / `false`
 */
function registeredOf(card: Element | null): string {
  return card === null ? '' : (card.getAttribute('data-registered') ?? '');
}

/**
 * 判断某元素是否处于禁用态
 * @param element 待判断的元素
 * @returns 元素存在且带 disabled 属性时为 true
 */
function isDisabled(element: Element | null): boolean {
  return element !== null && element.hasAttribute('disabled');
}

/**
 * 从磁盘读某份列表文件的正文
 * @param fs 内存文件系统替身
 * @param path 列表文件路径
 * @returns 列表文件正文
 */
function listBody(fs: FakeFileSystem, path: string): Promise<string> {
  return fs.readFile(path);
}

describe('素材自动保存', () => {
  // ① 新增自动落盘：不调 save()，图片（对象数组）与动画（字符串数组）的列表正文都已含新名字
  it('新增素材后列表当场落盘', async () => {
    const fs = new FakeFileSystem();

    fs.seed(TEXTURE_LIST_PATH, listText({ textures: [{ source: 'seed.png' }] }));
    fs.seed('content/texture/seed.png', new Uint8Array([1]));
    fs.seed(ANIMATION_LIST_PATH, listText(['idle']));
    fs.seed('content/animation/idle.anim', new Uint8Array([2]));

    const system = await createAssetHarness(fs);
    const created: AssetPanel[] = [];
    const panel = await openPanelTab(system, created);
    const container = renderPanel(panel);

    await panel.selectCategory('texture');
    await waitFor((): void => {
      expect(cardOf(container, 'seed.png')).not.toBeNull();
    });

    await panel.addAsset({ name: 'hero.png', bytes: new Uint8Array([3]) });

    expect(await listBody(fs, TEXTURE_LIST_PATH)).toContain('"source": "hero.png"');

    await panel.selectCategory('animation');
    await panel.addAsset({ name: 'run.anim', bytes: new Uint8Array([4]) });

    expect(await listBody(fs, ANIMATION_LIST_PATH)).toContain('"run"');
  });

  // ② 新增后第二个面板看到已登记：第二块面板经切回时从磁盘重读，卡片不是黄色「未登记」
  it('新增后第二个面板看到已登记', async () => {
    const fs = new FakeFileSystem();

    fs.seed(TEXTURE_LIST_PATH, listText({ textures: [{ source: 'hero.png' }] }));
    fs.seed('content/texture/hero.png', new Uint8Array([1]));

    const system = await createAssetHarness(fs);
    const created: AssetPanel[] = [];
    const panelA = await openPanelTab(system, created);
    const tabA = system.shellSystem.listTabs()[0].id;
    const panelB = await openAnotherPanel(system, created);
    const tabB = system.shellSystem.listTabs()[1].id;
    const containerA = renderPanel(panelA);
    const containerB = renderPanel(panelB);

    system.shellSystem.activateTab(tabA);
    await waitFor((): void => {
      expect(cardOf(containerA, 'hero.png')).not.toBeNull();
    });

    await panelA.addAsset({ name: 'new.png', bytes: new Uint8Array([2]) });

    await waitFor((): void => {
      expect(cardOf(containerA, 'new.png')).not.toBeNull();
    });

    system.shellSystem.activateTab(tabB);

    await waitFor((): void => {
      expect(registeredOf(cardOf(containerB, 'new.png'))).toBe('true');
    });
  });

  // ③ 注册后自动落盘：不点保存列表已含该名字，第二个面板看到它是正常卡片
  it('注册后第二个面板看到已登记', async () => {
    const fs = new FakeFileSystem();

    fs.seed(TEXTURE_LIST_PATH, listText({ textures: [{ source: 'hero.png' }] }));
    fs.seed('content/texture/hero.png', new Uint8Array([1]));
    fs.seed('content/texture/extra.png', new Uint8Array([2]));

    const system = await createAssetHarness(fs);
    const created: AssetPanel[] = [];
    const panelA = await openPanelTab(system, created);
    const tabA = system.shellSystem.listTabs()[0].id;
    const panelB = await openAnotherPanel(system, created);
    const tabB = system.shellSystem.listTabs()[1].id;
    const containerA = renderPanel(panelA);
    const containerB = renderPanel(panelB);

    system.shellSystem.activateTab(tabA);
    await waitFor((): void => {
      expect(cardOf(containerA, 'extra.png')).not.toBeNull();
    });

    await panelA.registerAsset('extra.png');

    expect(await listBody(fs, TEXTURE_LIST_PATH)).toContain('"source": "extra.png"');

    system.shellSystem.activateTab(tabB);

    await waitFor((): void => {
      expect(registeredOf(cardOf(containerB, 'extra.png'))).toBe('true');
    });
  });

  // ④ 切出写盘：只在同一个面板里做的配置改动与注销改动，在切到别的标签页后一并落盘
  it('切出面板时写盘未落盘的改动', async () => {
    const fs = new FakeFileSystem();

    fs.seed(
      TEXTURE_LIST_PATH,
      listText({
        textures: [
          { source: 'hero.png', read: 0, usage: 0 },
          { source: 'foe.png', read: 0, usage: 0 },
        ],
      }),
    );
    fs.seed('content/texture/hero.png', new Uint8Array([1]));
    fs.seed('content/texture/foe.png', new Uint8Array([2]));

    const system = await createAssetHarness(fs);
    const created: AssetPanel[] = [];
    const panel = await openPanelTab(system, created);

    await panel.selectCategory('texture');
    await panel.openConfig('hero.png');
    panel.applyConfigEdit("['read']", 2);
    panel.closeConfig();
    await panel.unregisterAsset('foe.png');

    const blankTab = system.shellSystem.openBlankTab();

    system.shellSystem.activateTab(blankTab);

    await waitFor(async (): Promise<void> => {
      const body = await listBody(fs, TEXTURE_LIST_PATH);

      expect(body).toContain('"read": 2');
      expect(body).not.toContain('foe.png');
    });
  });

  // ⑤ 自动保存失败：保留未保存标记、给出失败提示、磁盘正文一字未变，手动保存可以补救
  it('自动保存失败时不装成功并保留未保存标记', async () => {
    const fs = new FakeFileSystem();
    const original = listText({ textures: [{ source: 'hero.png' }] });

    fs.seed(TEXTURE_LIST_PATH, original);
    fs.seed('content/texture/hero.png', new Uint8Array([1]));

    const system = await createAssetHarness(fs);
    const created: AssetPanel[] = [];
    const panel = await openPanelTab(system, created);

    await panel.selectCategory('texture');

    const container = renderPanel(panel);

    await waitFor((): void => {
      expect(cardOf(container, 'hero.png')).not.toBeNull();
    });

    // 必须先读完分类再让列表文件写失败，否则测到的是「读取失败」而不是「写盘失败」
    fs.failing.add(TEXTURE_LIST_PATH);

    const errors = vi.spyOn(message, 'error');

    await panel.addAsset({ name: 'new.png', bytes: new Uint8Array([2]) });

    expect(errors).toHaveBeenCalled();

    const bar = container.querySelector('[data-test-id="asset-panel-error"]');

    expect(bar?.textContent).toContain('保存失败');
    expect(isDisabled(container.querySelector('[data-test-id="asset-toolbar-save"]'))).toBe(false);

    fs.failing.delete(TEXTURE_LIST_PATH);

    expect(await listBody(fs, TEXTURE_LIST_PATH)).toBe(original);

    await panel.save();

    expect(await listBody(fs, TEXTURE_LIST_PATH)).toContain('"source": "new.png"');
  });

  // ⑥ 注销不自动写盘：只改内存，磁盘正文仍是原文，要等点保存或切出才写
  it('注销后不点保存时磁盘不变', async () => {
    const fs = new FakeFileSystem();
    const original = listText({ textures: [{ source: 'hero.png' }] });

    fs.seed(TEXTURE_LIST_PATH, original);
    fs.seed('content/texture/hero.png', new Uint8Array([1]));

    const system = await createAssetHarness(fs);
    const created: AssetPanel[] = [];
    const panel = await openPanelTab(system, created);

    await panel.selectCategory('texture');
    await panel.unregisterAsset('hero.png');

    expect(await listBody(fs, TEXTURE_LIST_PATH)).toBe(original);
  });

  // ⑦ 没成功读过的分类绝不写盘：读失败后新增与切出都不碰列表文件，并给出明确提示
  it('读失败后的分类新增与切出都不写盘', async () => {
    const fs = new FakeFileSystem();
    const original = listText({ textures: [{ source: 'hero.png' }] });

    fs.seed(TEXTURE_LIST_PATH, original);
    fs.seed('content/texture/hero.png', new Uint8Array([1]));
    fs.failing.add(TEXTURE_LIST_PATH);

    const system = await createAssetHarness(fs);
    const created: AssetPanel[] = [];
    const panel = await openPanelTab(system, created);
    const container = renderPanel(panel);

    await waitFor((): void => {
      expect(container.querySelector('[data-test-id="asset-state-error"]')).not.toBeNull();
    });

    const errors = vi.spyOn(message, 'error');
    const successes = vi.spyOn(message, 'success');

    await panel.addAsset({ name: 'orphan.png', bytes: new Uint8Array([2]) });

    expect(Array.from(await fs.readBinary('content/texture/orphan.png'))).toEqual([2]);
    expect(successes).not.toHaveBeenCalled();
    expect(errors).toHaveBeenCalled();
    expect(String(errors.mock.calls[0][0])).toContain('分类尚未读取');
    expect(isDisabled(container.querySelector('[data-test-id="asset-toolbar-save"]'))).toBe(false);

    await panel.onSwitchOut();

    expect(successes).not.toHaveBeenCalled();

    fs.failing.delete(TEXTURE_LIST_PATH);

    expect(await listBody(fs, TEXTURE_LIST_PATH)).toBe(original);
  });
});
