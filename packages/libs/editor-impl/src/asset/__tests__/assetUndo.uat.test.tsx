import { act, cleanup, configure, render } from '@testing-library/react';
import { EditorCore } from '@motajs/editor-core';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { ASSET_PANEL_TYPE_ID, AssetPanel } from '..';
import { AssetCategoryKind, AssetListFormat, IAssetCategory } from '../../react';
import { createAssetHarness, FakeFileSystem, listText } from './fixtures';

configure({ testIdAttribute: 'data-test-id' });

// 每个用例结束后卸载已挂载的组件，避免 DOM 在用例之间累积
afterEach(() => {
  cleanup();
});

// 配置 / 撤销 / schema 优先级集成用例用的分类：图片为对象数组，带一份 defaults 文件（用例 ⑧ 的 @required）
const UNDO_CATEGORIES: readonly IAssetCategory[] = [
  {
    id: 'texture',
    label: '图片',
    kind: AssetCategoryKind.Image,
    dir: 'content/texture',
    listPath: 'content/texture/.list.jsonc',
    listFormat: AssetListFormat.ObjectList,
    listKey: 'textures',
    defaultsPath: 'content/defaults/texture.jsonc',
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
      const panel = new AssetPanel(param, { categories: UNDO_CATEGORIES });
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
 * 取配置表单里某个字段当前的显示值
 * @param container 渲染容器
 * @param field 字段名（如 `read`）
 * @returns 字段当前的显示文本；字段不存在时为空串
 */
function fieldValue(container: HTMLElement, field: string): string {
  const cell = container.querySelector(`[data-test-id="table-input-${field}"]`);

  if (cell === null) return '';

  const selected = cell.querySelector('.ant-select-content-value, .ant-select-selection-item');

  if (selected !== null) return (selected.textContent ?? '').trim();

  const input = cell.querySelector('input');

  if (input instanceof HTMLInputElement) return input.value;

  return (cell.textContent ?? '').trim();
}

/**
 * 取配置视图的错误列表文本
 * @param container 渲染容器
 * @returns 错误列表文本；无错误列表时为空串
 */
function errorsText(container: HTMLElement): string {
  const node = container.querySelector('[data-test-id="asset-config-errors"]');

  return node === null ? '' : (node.textContent ?? '');
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

describe('素材配置编辑与撤销', () => {
  // ① 打开配置 → 行树含内置图片 schema 的 read / usage 字段
  it('打开配置后行树含内置 schema 的字段', async () => {
    const fs = new FakeFileSystem();

    fs.seed('content/texture/.list.jsonc', listText({ textures: [{ source: 'hero.png', read: 0, usage: 0 }] }));

    const system = await createAssetHarness(fs);
    const panel = await openPanel(system);

    await panel.selectCategory('texture');
    await panel.openConfig('hero.png');

    const container = renderPanel(panel);

    expect(container.querySelector('[data-test-id="asset-config-view"]')).not.toBeNull();
    expect(container.querySelector('[data-test-id="table-row-read"]')).not.toBeNull();
    expect(container.querySelector('[data-test-id="table-row-usage"]')).not.toBeNull();
  });

  // ② 改一个字段 → 内存配置变化、未保存、撤销返回 true，撤销后配置回到旧值
  it('配置改动可撤销且恢复旧值', async () => {
    const fs = new FakeFileSystem();

    fs.seed('content/texture/.list.jsonc', listText({ textures: [{ source: 'hero.png', read: 0, usage: 0 }] }));

    const system = await createAssetHarness(fs);
    const panel = await openPanel(system);

    await panel.selectCategory('texture');
    await panel.openConfig('hero.png');
    panel.applyConfigEdit("['read']", 2);

    const changed = renderPanel(panel);

    expect(fieldValue(changed, 'read')).toBe('逐行动画');
    expect(isDisabled(saveButton(changed))).toBe(false);

    cleanup();

    expect(await system.undoSystem.undo()).toBe(true);

    const reverted = renderPanel(panel);

    expect(fieldValue(reverted, 'read')).toBe('整图');
  });

  // ③ 撤销后紧接着重做 → 配置回到新值
  it('撤销后可重做回新值', async () => {
    const fs = new FakeFileSystem();

    fs.seed('content/texture/.list.jsonc', listText({ textures: [{ source: 'hero.png', read: 0, usage: 0 }] }));

    const system = await createAssetHarness(fs);
    const panel = await openPanel(system);

    await panel.selectCategory('texture');
    await panel.openConfig('hero.png');
    panel.applyConfigEdit("['read']", 2);

    expect(await system.undoSystem.undo()).toBe(true);
    expect(await system.undoSystem.redo()).toBe(true);

    const container = renderPanel(panel);

    expect(fieldValue(container, 'read')).toBe('逐行动画');
  });

  // ④ 配置改动后再做字节改动（屏障）：撤销返回 false，且配置停在改动后的状态，没有被继续回退
  it('字节改动成为屏障挡住撤销且不回退配置', async () => {
    const fs = new FakeFileSystem();

    fs.seed('content/texture/.list.jsonc', listText({ textures: [{ source: 'hero.png', read: 0, usage: 0 }] }));

    const system = await createAssetHarness(fs);
    const panel = await openPanel(system);

    await panel.selectCategory('texture');
    await panel.openConfig('hero.png');
    panel.applyConfigEdit("['read']", 2);
    await panel.addAsset({ name: 'new.png', bytes: new Uint8Array([1]) });

    expect(await system.undoSystem.undo()).toBe(false);

    const container = renderPanel(panel);

    expect(fieldValue(container, 'read')).toBe('逐行动画');
  });

  // ⑤ 工程内 schema 覆盖内置：种入含 customNote 的 .schema.jsonc 后，行树出现该字段（工程优先）
  it('工程内 schema 覆盖内置 schema', async () => {
    const fs = new FakeFileSystem();

    fs.seed('content/texture/.list.jsonc', listText({ textures: [{ source: 'hero.png' }] }));
    fs.seed(
      'content/texture/.schema.jsonc',
      JSON.stringify({ type: 'object', properties: { customNote: { type: 'string', description: '备注' } } }),
    );

    const system = await createAssetHarness(fs);
    const panel = await openPanel(system);

    await panel.selectCategory('texture');
    await panel.openConfig('hero.png');

    const container = renderPanel(panel);

    expect(container.querySelector('[data-test-id="table-row-customNote"]')).not.toBeNull();
  });

  // ⑥ 工程内 schema 非法 → 面板内出现可见错误条且模式仍是浏览态（不进入配置视图），重新加载分类后错误条消失
  it('非法工程 schema 时显示错误条并保持浏览态', async () => {
    const fs = new FakeFileSystem();

    fs.seed('content/texture/.list.jsonc', listText({ textures: [{ source: 'hero.png', read: 0, usage: 0 }] }));
    fs.seed('content/texture/.schema.jsonc', '{oops');

    const system = await createAssetHarness(fs);
    const panel = await openPanel(system);

    await panel.selectCategory('texture');
    await panel.openConfig('hero.png');

    const container = renderPanel(panel);
    const bar = container.querySelector('[data-test-id="asset-panel-error"]');

    expect(container.querySelector('[data-test-id="asset-config-view"]')).toBeNull();
    expect(container.querySelector('[data-test-id="asset-panel"]')?.getAttribute('data-status')).toBe('ready');
    expect(bar?.textContent).toContain('该素材的配置无法解析');
    // 面板仍可继续浏览：分类导航与素材网格都在
    expect(container.querySelector('[data-test-id="asset-category-texture"]')).not.toBeNull();
    expect(container.querySelector('[data-test-id="asset-grid"]')).not.toBeNull();

    // 重新加载分类后错误条消失，说明错误不是永久粘住的
    await act(async () => {
      await panel.selectCategory('texture');
    });

    expect(container.querySelector('[data-test-id="asset-panel-error"]')).toBeNull();
  });

  // ⑦ 配置改动后保存 → 列表正文含新值，且首行仍是系统前缀标记行
  it('配置改动保存后写回列表并保留系统前缀', async () => {
    const fs = new FakeFileSystem();

    fs.seed('content/texture/.list.jsonc', listText({ textures: [{ source: 'hero.png', read: 0, usage: 0 }] }));

    const system = await createAssetHarness(fs);
    const panel = await openPanel(system);

    await panel.selectCategory('texture');
    await panel.openConfig('hero.png');
    panel.applyConfigEdit("['read']", 3);
    await panel.save();

    const text = await system.resourceSystem.readContent('content/texture/.list.jsonc');

    expect(typeof text).toBe('string');
    expect(String(text).startsWith('// --- SYSTEM PREFIX END --- //')).toBe(true);
    expect(String(text)).toContain('"read": 3');
  });

  // ⑧ defaults 的 @required 一路走到界面：缺 read 时 configErrors 非空，补齐后清空
  it('defaults 的 @required 校验贯通到配置视图', async () => {
    const fs = new FakeFileSystem();

    fs.seed('content/texture/.list.jsonc', listText({ textures: [{ source: 'hero.png', usage: 0 }] }));
    fs.seed('content/defaults/texture.jsonc', JSON.stringify({ '@required': ['read'] }));

    const system = await createAssetHarness(fs);
    const panel = await openPanel(system);

    await panel.selectCategory('texture');
    await panel.openConfig('hero.png');

    const missing = renderPanel(panel);

    expect(errorsText(missing)).toContain('字段「read」为必填');

    cleanup();

    panel.applyConfigEdit("['read']", 0);

    const filled = renderPanel(panel);

    expect(filled.querySelector('[data-test-id="asset-config-errors"]')).toBeNull();
  });
});
