import { cleanup, configure, render } from '@testing-library/react';
import { EditorCore } from '@motajs/editor-core';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { ASSET_MAX_UPLOAD_BYTES, ASSET_PANEL_TYPE_ID, AssetPanel } from '..';
import { AssetCategoryKind, AssetListFormat, IAssetCategory } from '../../react';
import { ASSET_TEST_CATEGORIES, createAssetHarness, FakeFileSystem, listText } from './fixtures';

configure({ testIdAttribute: 'data-test-id' });

// 每个用例结束后卸载已挂载的组件，避免 DOM 在用例之间累积
afterEach(() => {
  cleanup();
});

// 生命周期集成用例使用的分类清单：沿用共享的四个测试分类，另追加一个带 defaults 的图片分类（用例 ⑨）
const LIFECYCLE_CATEGORIES: readonly IAssetCategory[] = [
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
      const panel = new AssetPanel(param, { categories: LIFECYCLE_CATEGORIES });
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

describe('素材字节生命周期', () => {
  // ① 新增一张图片：字节文件立即落盘、内存条目多一条、该分类标记未保存
  it('新增素材立即写入字节并追加内存条目', async () => {
    const fs = new FakeFileSystem();

    fs.seed('content/texture/.list.jsonc', listText({ textures: [] }));

    const system = await createAssetHarness(fs);
    const panel = await openPanel(system);

    await panel.selectCategory('texture');
    await panel.addAsset({ name: 'hero.png', bytes: new Uint8Array([1, 2, 3]) });

    const bytes = await fs.readBinary('content/texture/hero.png');

    expect(Array.from(bytes)).toEqual([1, 2, 3]);

    const container = renderPanel(panel);

    expect(entryNames(container)).toEqual(['asset-card-hero.png']);
    expect(isDisabled(saveButton(container))).toBe(false);
  });

  // ② 新增后保存：列表正文含新名字，且系统前缀逐字保留在首行
  it('新增后保存写回列表并逐字保留系统前缀', async () => {
    const fs = new FakeFileSystem();

    fs.seed('content/texture/.list.jsonc', listText({ textures: [] }));

    const system = await createAssetHarness(fs);
    const panel = await openPanel(system);

    await panel.selectCategory('texture');
    await panel.addAsset({ name: 'hero.png', bytes: new Uint8Array([1]) });
    await panel.save();

    const text = await system.resourceSystem.readContent('content/texture/.list.jsonc');

    expect(typeof text).toBe('string');
    expect(String(text).startsWith('// --- SYSTEM PREFIX END --- //')).toBe(true);
    expect(String(text)).toContain('"source": "hero.png"');
  });

  // ③ 同名再新增：被拒绝，既有字节不变、列表不重复
  it('同名素材新增被拒绝且不覆盖既有字节', async () => {
    const fs = new FakeFileSystem();

    fs.seed('content/texture/.list.jsonc', listText({ textures: [{ source: 'hero.png' }] }));
    fs.seed('content/texture/hero.png', new Uint8Array([9]));

    const system = await createAssetHarness(fs);
    const panel = await openPanel(system);

    await panel.selectCategory('texture');
    await panel.addAsset({ name: 'hero.png', bytes: new Uint8Array([1, 2, 3]) });

    const bytes = await fs.readBinary('content/texture/hero.png');

    expect(Array.from(bytes)).toEqual([9]);

    const container = renderPanel(panel);

    expect(entryNames(container)).toEqual(['asset-card-hero.png']);
  });

  // ④ 文件名含 `..`：被拒绝，工程内不出现任何新文件
  it('非法文件名被拒绝且不产生任何写入', async () => {
    const fs = new FakeFileSystem();

    const system = await createAssetHarness(fs);
    const panel = await openPanel(system);

    await panel.selectCategory('texture');
    await panel.addAsset({ name: '../evil.png', bytes: new Uint8Array([1]) });

    const entries = await fs.listDirectory('content/texture');

    expect(entries.length).toBe(0);
  });

  // ⑤ 字节超限：被拒绝，目标路径不存在
  it('超限文件被拒绝且目标路径不存在', async () => {
    const fs = new FakeFileSystem();

    const system = await createAssetHarness(fs);
    const panel = await openPanel(system);

    await panel.selectCategory('texture');
    await panel.addAsset({ name: 'huge.png', bytes: new Uint8Array(ASSET_MAX_UPLOAD_BYTES + 1) });

    await expect(fs.readBinary('content/texture/huge.png')).rejects.toThrow();
  });

  // ⑥ 替换：该路径字节变为新值，且撤销被屏障挡住（返回 false）
  it('替换更新字节且撤销被屏障挡住', async () => {
    const fs = new FakeFileSystem();

    fs.seed('content/texture/.list.jsonc', listText({ textures: [{ source: 'hero.png' }] }));
    fs.seed('content/texture/hero.png', new Uint8Array([1]));

    const system = await createAssetHarness(fs);
    const panel = await openPanel(system);

    await panel.selectCategory('texture');
    await panel.replaceAsset('hero.png', new Uint8Array([7, 8]));

    const bytes = await fs.readBinary('content/texture/hero.png');

    expect(Array.from(bytes)).toEqual([7, 8]);
    expect(await system.undoSystem.undo()).toBe(false);
  });

  // ⑦ 删除：字节文件消失、内存条目消失、该分类标记未保存
  it('删除移除字节与条目并标记未保存', async () => {
    const fs = new FakeFileSystem();

    fs.seed('content/texture/.list.jsonc', listText({ textures: [{ source: 'hero.png' }] }));
    fs.seed('content/texture/hero.png', new Uint8Array([1]));

    const system = await createAssetHarness(fs);
    const panel = await openPanel(system);

    await panel.selectCategory('texture');
    await panel.deleteAsset('hero.png');

    await expect(fs.readBinary('content/texture/hero.png')).rejects.toThrow();

    const container = renderPanel(panel);

    expect(container.querySelector('[data-test-id="asset-panel"]')?.getAttribute('data-status')).toBe('empty');
    expect(isDisabled(saveButton(container))).toBe(false);
  });

  // ⑧ 删除后撤销：屏障挡住，连续两次都返回 false
  it('删除后连续两次撤销都被屏障挡住', async () => {
    const fs = new FakeFileSystem();

    fs.seed('content/texture/.list.jsonc', listText({ textures: [{ source: 'hero.png' }] }));
    fs.seed('content/texture/hero.png', new Uint8Array([1]));

    const system = await createAssetHarness(fs);
    const panel = await openPanel(system);

    await panel.selectCategory('texture');
    await panel.deleteAsset('hero.png');

    expect(await system.undoSystem.undo()).toBe(false);
    expect(await system.undoSystem.undo()).toBe(false);
  });

  // ⑨ 对象列表分类新增时，defaults 里的字段出现在新条目配置里
  it('对象列表分类新增时合并 defaults 字段', async () => {
    const fs = new FakeFileSystem();

    fs.seed('content/defaulted/.list.jsonc', listText({ textures: [] }));
    fs.seed('content/defaulted/defaults.jsonc', JSON.stringify({ read: 0, usage: 1 }));

    const system = await createAssetHarness(fs);
    const panel = await openPanel(system);

    await panel.selectCategory('defaulted');
    await panel.addAsset({ name: 'tile.png', bytes: new Uint8Array([1]) });
    await panel.save();

    const text = await system.resourceSystem.readContent('content/defaulted/.list.jsonc');
    const body = String(text);

    expect(body).toContain('"source": "tile.png"');
    expect(body).toContain('"read": 0');
    expect(body).toContain('"usage": 1');
  });
});
