import { cleanup, configure, render } from '@testing-library/react';
import { EditorCore } from '@motajs/editor-core';
import { message } from 'antd';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ASSET_PANEL_TYPE_ID, AssetPanel } from '..';
import { AssetCategoryKind, AssetListFormat, IAssetCategory } from '../../react';
import { ASSET_TEST_CATEGORIES, ASSET_TEST_PREFIX, createAssetHarness, FakeFileSystem, listText } from './fixtures';

configure({ testIdAttribute: 'data-test-id' });

// 每个用例结束后卸载已挂载的组件并还原替身，避免 DOM 与调用记录在用例之间累积
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// 注册 / 注销用例使用的分类清单：沿用共享的四个测试分类，另追加一个带 defaults 的图片分类
const REGISTRATION_CATEGORIES: readonly IAssetCategory[] = [
  ...ASSET_TEST_CATEGORIES,
  {
    id: 'defaulted',
    label: '图片默认值',
    kind: AssetCategoryKind.Image,
    dir: 'content/defaulted',
    listPath: 'content/defaulted/.list.jsonc',
    listFormat: AssetListFormat.ObjectList,
    listKey: 'textures',
    defaultsPath: 'content/defaulted/defaults.jsonc',
  },
];

/**
 * 经外壳注册一个捕获具体实例的面板类型并打开，返回数据层面的素材面板
 * @param system 已初始化的编辑器核心
 * @returns 数据层面的素材面板实例
 */
async function openPanel(system: EditorCore): Promise<AssetPanel> {
  const created: AssetPanel[] = [];

  system.shellSystem.registerPanelType({
    id: ASSET_PANEL_TYPE_ID,
    name: '素材管理器',
    icon: createElement('div'),
    create: (param): AssetPanel => {
      const panel = new AssetPanel(param, { categories: REGISTRATION_CATEGORIES });
      created.push(panel);
      return panel;
    },
  });

  const tabId = system.shellSystem.listTabs()[0].id;

  await system.shellSystem.openPanelInTab(tabId, ASSET_PANEL_TYPE_ID);

  return created[0];
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
 * 取面板视图当前列出的卡片测试标记（保序）
 * @param container 渲染容器
 * @returns 卡片测试标记列表
 */
function entryNames(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('button[data-test-id^="asset-card-"]')).map(
    (element) => element.getAttribute('data-test-id') ?? '',
  );
}

/**
 * 取工具栏的保存按钮
 * @param container 渲染容器
 * @returns 保存按钮元素；未挂载时为 null
 */
function saveButton(container: HTMLElement): Element | null {
  return container.querySelector('[data-test-id="asset-toolbar-save"]');
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
 * 读某份列表文件的正文
 * @param system 已初始化的编辑器核心
 * @param path 列表文件路径
 * @returns 列表文件正文
 */
async function readListBody(system: EditorCore, path: string): Promise<string> {
  return String(await system.resourceSystem.readContent(path));
}

describe('未登记素材的注册与注销', () => {
  // ① 目录里未登记的文件成为卡片；不注册直接保存时列表正文仍只有已登记名字
  it('未登记文件出现在网格里且保存不会把它写进列表', async () => {
    const fs = new FakeFileSystem();

    fs.seed('content/texture/.list.jsonc', listText({ textures: [{ source: 'hero.png' }] }));
    fs.seed('content/texture/hero.png', new Uint8Array([1]));
    fs.seed('content/texture/extra.png', new Uint8Array([2]));

    const system = await createAssetHarness(fs);
    const panel = await openPanel(system);

    await panel.selectCategory('texture');

    const container = renderPanel(panel);

    expect(entryNames(container)).toEqual(['asset-card-hero.png', 'asset-card-extra.png']);

    await panel.save();

    const body = await readListBody(system, 'content/texture/.list.jsonc');

    expect(body).toContain('"source": "hero.png"');
    expect(body).not.toContain('extra.png');
  });

  // ② 注册未登记文件：该分类标记未保存，保存后名字进列表
  it('注册后标记未保存且保存写进列表', async () => {
    const fs = new FakeFileSystem();

    fs.seed('content/texture/.list.jsonc', listText({ textures: [] }));
    fs.seed('content/texture/extra.png', new Uint8Array([2]));

    const system = await createAssetHarness(fs);
    const panel = await openPanel(system);

    await panel.selectCategory('texture');
    await panel.registerAsset('extra.png');

    const container = renderPanel(panel);

    expect(isDisabled(saveButton(container))).toBe(false);
    expect(entryNames(container)).toEqual(['asset-card-extra.png']);

    await panel.save();

    const body = await readListBody(system, 'content/texture/.list.jsonc');

    expect(body).toContain('"source": "extra.png"');
  });

  // ③ 两种列表格式保存时都只写已登记名字
  it('保存时只写已登记名字（对象数组与字符串数组）', async () => {
    const fs = new FakeFileSystem();

    fs.seed('content/texture/.list.jsonc', listText({ textures: [{ source: 'hero.png' }] }));
    fs.seed('content/texture/hero.png', new Uint8Array([1]));
    fs.seed('content/texture/extra.png', new Uint8Array([2]));
    fs.seed('content/animation/.list.jsonc', listText(['walk']));
    fs.seed('content/animation/walk.anim', new Uint8Array([3]));
    fs.seed('content/animation/idle.anim', new Uint8Array([4]));
    fs.seed('content/animation/stray.png', new Uint8Array([5]));

    const system = await createAssetHarness(fs);
    const panel = await openPanel(system);

    await panel.selectCategory('texture');
    await panel.addAsset({ name: 'third.png', bytes: new Uint8Array([6]) });

    await panel.selectCategory('animation');
    await panel.addAsset({ name: 'run.anim', bytes: new Uint8Array([7]) });

    await panel.save();

    const textureBody = await readListBody(system, 'content/texture/.list.jsonc');

    expect(textureBody).toContain('"source": "hero.png"');
    expect(textureBody).toContain('"source": "third.png"');
    expect(textureBody).not.toContain('extra.png');

    const animationBody = await readListBody(system, 'content/animation/.list.jsonc');

    expect(animationBody).toContain('"walk"');
    expect(animationBody).toContain('"run"');
    expect(animationBody).not.toContain('idle');
  });

  // ④ 注销：条目退回未登记、保存后列表不再含它，但字节文件仍在
  it('注销后保存移除登记且字节文件保留', async () => {
    const fs = new FakeFileSystem();

    fs.seed('content/texture/.list.jsonc', listText({ textures: [{ source: 'hero.png' }] }));
    fs.seed('content/texture/hero.png', new Uint8Array([7, 8]));

    const system = await createAssetHarness(fs);
    const panel = await openPanel(system);

    await panel.selectCategory('texture');
    await panel.unregisterAsset('hero.png');

    const container = renderPanel(panel);

    expect(entryNames(container)).toEqual(['asset-card-hero.png']);

    await panel.save();

    const body = await readListBody(system, 'content/texture/.list.jsonc');
    const bytes = await fs.readBinary('content/texture/hero.png');

    expect(body).not.toContain('hero.png');
    expect(Array.from(bytes)).toEqual([7, 8]);
  });

  // ⑤ 注销后重新注册：配置来自 defaults，不是注销前的旧配置
  it('注销后重新注册得到 defaults 配置', async () => {
    const fs = new FakeFileSystem();

    fs.seed('content/defaulted/.list.jsonc', listText({ textures: [{ source: 'hero.png', read: 5, usage: 2 }] }));
    fs.seed('content/defaulted/defaults.jsonc', JSON.stringify({ read: 0, usage: 1 }));
    fs.seed('content/defaulted/hero.png', new Uint8Array([1]));

    const system = await createAssetHarness(fs);
    const panel = await openPanel(system);

    await panel.selectCategory('defaulted');
    await panel.unregisterAsset('hero.png');
    await panel.registerAsset('hero.png');
    await panel.save();

    const body = await readListBody(system, 'content/defaulted/.list.jsonc');
    const document: unknown = JSON.parse(body.slice(ASSET_TEST_PREFIX.length));

    expect(document).toEqual({ textures: [{ source: 'hero.png', read: 0, usage: 1 }] });
  });

  // ⑥ 正在配置的素材被注销：退出配置态，详情仍在
  it('注销正在配置的素材会退回浏览态', async () => {
    const fs = new FakeFileSystem();

    fs.seed('content/texture/.list.jsonc', listText({ textures: [{ source: 'hero.png', read: 0, usage: 0 }] }));
    fs.seed('content/texture/hero.png', new Uint8Array([1]));

    const system = await createAssetHarness(fs);
    const panel = await openPanel(system);

    await panel.selectCategory('texture');
    await panel.openConfig('hero.png');
    await panel.unregisterAsset('hero.png');

    const container = renderPanel(panel);

    expect(container.querySelector('[data-test-id="asset-config-view"]')).toBeNull();
    expect(container.querySelector('[data-test-id="asset-detail"]')).not.toBeNull();
  });

  // ⑦ 目录里已有未登记同名文件时新增同名素材被拒绝，既有字节不变
  it('目录里已有未登记同名文件时新增被拒绝', async () => {
    const fs = new FakeFileSystem();

    fs.seed('content/texture/.list.jsonc', listText({ textures: [] }));
    fs.seed('content/texture/extra.png', new Uint8Array([42]));

    const system = await createAssetHarness(fs);
    const panel = await openPanel(system);

    await panel.selectCategory('texture');

    const infos = vi.spyOn(message, 'info');

    await panel.addAsset({ name: 'extra.png', bytes: new Uint8Array([1, 2, 3]) });

    const bytes = await fs.readBinary('content/texture/extra.png');

    expect(infos).toHaveBeenCalledWith('同名素材已存在');
    expect(Array.from(bytes)).toEqual([42]);
  });
});
