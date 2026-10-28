import { cleanup, configure, render } from '@testing-library/react';
import { EditorCore } from '@motajs/editor-core';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { ASSET_PANEL_TYPE_ID, AssetPanel, AssetUndoType, createAssetPanelType } from '..';
import { AssetCategoryKind, AssetListFormat, IAssetCategory } from '../../react';
import { ASSET_TEST_CATEGORIES, createAssetHarness, FakeFileSystem, listText } from './fixtures';

configure({ testIdAttribute: 'data-test-id' });

// 每个用例结束后卸载已挂载的组件，避免 DOM 在用例之间累积
afterEach(() => {
  cleanup();
});

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
      const panel = new AssetPanel(param, { categories: ASSET_TEST_CATEGORIES });
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
 * 取面板视图当前的数据状态标记
 * @param container 渲染容器
 * @returns 状态标记串；未挂载时为空串
 */
function panelStatus(container: HTMLElement): string {
  const node = container.querySelector('[data-test-id="asset-panel"]');

  return node === null ? '' : (node.getAttribute('data-status') ?? '');
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
 * 判断某条目的字节文件是否被标记为存在
 * @param container 渲染容器
 * @param name 素材名
 * @returns 该条目标记为存在时为 true
 */
function entryExists(container: HTMLElement, name: string): boolean {
  const node = container.querySelector(`button[data-test-id="asset-card-${name}"]`);

  return node !== null && node.getAttribute('data-exists') === 'true';
}

// 打开能力用例使用的分类清单：图片带 schema / 默认值文件，动画带 `.anim` 后缀，用来钉住「按分类 extension 去后缀」
const OPEN_CATEGORIES: readonly IAssetCategory[] = [
  {
    id: 'texture',
    label: '图片',
    kind: AssetCategoryKind.Image,
    dir: 'content/texture',
    listPath: 'content/texture/.list.jsonc',
    listFormat: AssetListFormat.ObjectList,
    listKey: 'textures',
    schemaPath: 'content/texture/.schema.jsonc',
    defaultsPath: 'content/texture/defaults.jsonc',
  },
  {
    id: 'animation',
    label: '动画',
    kind: AssetCategoryKind.Animation,
    dir: 'content/animation',
    listPath: 'content/animation/.list.jsonc',
    listFormat: AssetListFormat.StringList,
    extension: '.anim',
  },
];

describe('createAssetPanelType 打开能力', () => {
  // 分类目录之内的字节文件、清单文件、schema 文件、默认值文件都由该分类认领
  it('认领分类目录内文件与清单 / schema / 默认值文件', () => {
    const type = createAssetPanelType({ categories: OPEN_CATEGORIES });

    expect(type.canOpen?.('content/texture/hero.png')).toBe(true);
    expect(type.canOpen?.('content/texture/.list.jsonc')).toBe(true);
    expect(type.canOpen?.('content/texture/.schema.jsonc')).toBe(true);
    expect(type.canOpen?.('content/texture/defaults.jsonc')).toBe(true);
  });

  // 分类目录之外的路径不被认领：canOpen 为 false，打开参数交回 null 目标让别的面板认领
  it('不认领分类目录之外的路径', () => {
    const type = createAssetPanelType({ categories: OPEN_CATEGORIES });

    expect(type.canOpen?.('content/other/x.png')).toBe(false);
    expect(type.createOpenParam?.('content/other/x.png')).toEqual({ target: null });
  });

  // 每次都返回新对象，且没有 extension 的分类不去后缀：assetName 与素材条目的 name 一致
  it('每次返回新对象且无 extension 的分类保留后缀', () => {
    const type = createAssetPanelType({ categories: OPEN_CATEGORIES });
    const first = type.createOpenParam?.('content/texture/hero.png');
    const second = type.createOpenParam?.('content/texture/hero.png');

    expect(first).toEqual({ target: { categoryId: 'texture', assetName: 'hero.png' } });
    expect(second).toEqual({ target: { categoryId: 'texture', assetName: 'hero.png' } });
    expect(first).not.toBe(second);
  });

  // 配了 extension 的分类才去后缀：`.anim` 文件得到条目名 `slime`
  it('配了 extension 的分类去掉后缀', () => {
    const type = createAssetPanelType({ categories: OPEN_CATEGORIES });

    expect(type.createOpenParam?.('content/animation/slime.anim')).toEqual({
      target: { categoryId: 'animation', assetName: 'slime' },
    });
  });
});

describe('素材面板数据层', () => {
  // 有列表且目录里有字节：加载后状态就绪，条目数与名字正确
  it('读取分类得到就绪状态与正确条目', async () => {
    const fs = new FakeFileSystem();

    fs.seed(
      'content/texture/.list.jsonc',
      listText({
        textures: [
          { source: 'hero', read: 0 },
          { source: 'foe', read: 1 },
        ],
      }),
    );
    fs.seed('content/texture/hero', new Uint8Array([1, 2, 3]));
    fs.seed('content/texture/foe', new Uint8Array([4, 5, 6]));

    const system = await createAssetHarness(fs);
    const panel = await openPanel(system);

    await panel.selectCategory('texture');
    const container = renderPanel(panel);

    expect(panelStatus(container)).toBe('ready');
    expect(entryNames(container)).toEqual(['asset-card-hero', 'asset-card-foe']);
  });

  // 条目已登记但字节缺失：该条 exists 为 false，其余为 true
  it('标记字节缺失的条目', async () => {
    const fs = new FakeFileSystem();

    fs.seed('content/texture/.list.jsonc', listText({ textures: [{ source: 'hero' }, { source: 'ghost' }] }));
    fs.seed('content/texture/hero', new Uint8Array([1]));

    const system = await createAssetHarness(fs);
    const panel = await openPanel(system);

    await panel.selectCategory('texture');
    const container = renderPanel(panel);

    expect(entryExists(container, 'hero')).toBe(true);
    expect(entryExists(container, 'ghost')).toBe(false);
  });

  // 列表文件不存在：按空分类处理，状态为空而不是错误
  it('列表缺失时按空分类处理', async () => {
    const fs = new FakeFileSystem();

    const system = await createAssetHarness(fs);
    const panel = await openPanel(system);

    await panel.selectCategory('texture');
    const container = renderPanel(panel);

    expect(panelStatus(container)).toBe('empty');
  });

  // 列表正文非法：进错误态而不是静默空列表
  it('列表正文非法时进错误态', async () => {
    const fs = new FakeFileSystem();

    fs.seed('content/texture/.list.jsonc', '{oops');

    const system = await createAssetHarness(fs);
    const panel = await openPanel(system);

    await panel.selectCategory('texture');
    const container = renderPanel(panel);

    expect(panelStatus(container)).toBe('error');
  });

  // 改内存后保存：写回文本逐字保留系统前缀，正文含改动
  it('保存写回逐字保留系统前缀并含改动', async () => {
    const fs = new FakeFileSystem();

    fs.seed('content/texture/.list.jsonc', listText({ textures: [{ source: 'hero', read: 0 }] }));
    fs.seed('content/texture/hero', new Uint8Array([1]));

    const system = await createAssetHarness(fs);
    const panel = await openPanel(system);

    await panel.selectCategory('texture');
    await panel.redo({
      type: AssetUndoType.Config,
      data: { categoryId: 'texture', name: 'hero', path: "['read']", previous: 0, next: 2 },
    });
    await panel.save();

    const text = await system.resourceSystem.readContent('content/texture/.list.jsonc');

    expect(typeof text).toBe('string');
    expect(String(text).startsWith('// --- SYSTEM PREFIX END --- //')).toBe(true);
    expect(String(text)).toContain('"read": 2');
  });

  // 未保存时再次加载不会覆盖内存改动
  it('未保存时再次加载不覆盖内存改动', async () => {
    const fs = new FakeFileSystem();

    fs.seed('content/texture/.list.jsonc', listText({ textures: [{ source: 'hero', read: 0 }] }));
    fs.seed('content/texture/hero', new Uint8Array([1]));

    const system = await createAssetHarness(fs);
    const panel = await openPanel(system);

    await panel.selectCategory('texture');
    await panel.redo({
      type: AssetUndoType.Config,
      data: { categoryId: 'texture', name: 'hero', path: "['read']", previous: 0, next: 2 },
    });
    // 有未落盘改动时再读一次：应直接返回，不覆盖内存
    await panel.loadCategory('texture');
    await panel.save();

    const text = await system.resourceSystem.readContent('content/texture/.list.jsonc');

    expect(String(text)).toContain('"read": 2');
  });

  // 经工厂造出的面板类型注册后，可从外壳创建实例并渲染出面板容器
  it('经工厂注册的面板类型可创建并渲染', async () => {
    const fs = new FakeFileSystem();

    fs.seed('content/texture/.list.jsonc', listText({ textures: [] }));

    const system = await createAssetHarness(fs);

    system.shellSystem.registerPanelType(createAssetPanelType({ categories: ASSET_TEST_CATEGORIES }));

    const tabId = system.shellSystem.listTabs()[0].id;

    await system.shellSystem.openPanelInTab(tabId, ASSET_PANEL_TYPE_ID);
    const { container } = render(createElement(system.shellSystem.render()));

    expect(container.querySelector('[data-test-id="asset-panel"]')).not.toBeNull();
  });
});
