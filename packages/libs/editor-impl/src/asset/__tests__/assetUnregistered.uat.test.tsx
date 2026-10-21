import { act, cleanup, configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EditorCore } from '@motajs/editor-core';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { ASSET_PANEL_TYPE_ID, AssetPanel } from '..';
import assetCss from '../asset.css?inline';
import { ASSET_DELETE_CONFIRM_TEXT } from '../constants';
import { ASSET_TEST_CATEGORIES, createAssetHarness, FakeFileSystem, listText } from './fixtures';

// jsdom 没有实现 `URL.createObjectURL`，卡片与详情预览却要在挂载后靠它把字节变成地址；只补这两个静态方法
Object.defineProperty(URL, 'createObjectURL', { value: (): string => 'blob:test', configurable: true });
Object.defineProperty(URL, 'revokeObjectURL', { value: (): void => undefined, configurable: true });

configure({ testIdAttribute: 'data-test-id' });

// 每个用例结束后卸载已挂载的组件，避免弹层与 DOM 在用例之间累积
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
 * 造一套「列表里只有 hero.png、目录里另有 extra.png」的工程并打开面板
 * @returns 内存文件系统与已加载图片分类的面板
 */
async function openTexturePanel(): Promise<{ fs: FakeFileSystem; system: EditorCore; panel: AssetPanel }> {
  const fs = new FakeFileSystem();

  fs.seed('content/texture/.list.jsonc', listText({ textures: [{ source: 'hero.png' }] }));
  fs.seed('content/texture/hero.png', new Uint8Array([1]));
  fs.seed('content/texture/extra.png', new Uint8Array([2, 3]));

  const system = await createAssetHarness(fs);
  const panel = await openPanel(system);

  await panel.selectCategory('texture');

  return { fs, system, panel };
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
 * 取某个素材的卡片节点
 * @param container 渲染容器
 * @param name 素材名
 * @returns 卡片节点；未渲染时为 null
 */
function cardOf(container: HTMLElement, name: string): Element | null {
  return container.querySelector(`[data-test-id="asset-card-${name}"]`);
}

/**
 * 从样式文本里取出某个选择器的规则块
 * @param css 样式全文
 * @param selector 选择器
 * @returns 规则块正文；未找到时为空串
 */
function ruleBody(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  const end = css.indexOf('}', start);

  if (start === -1 || end === -1) return '';

  return css.slice(start, end);
}

/**
 * 点某张卡片把它选中
 * @param container 渲染容器
 * @param name 素材名
 */
function selectCard(container: HTMLElement, name: string): void {
  fireEvent.click(cardOf(container, name)!);
}

/**
 * 点详情栏的「注销」并走完第一步，停在第二个确认框
 */
function openFinalUnregister(): void {
  fireEvent.click(screen.getByTestId('asset-detail-unregister'));
  fireEvent.click(screen.getByTestId('asset-unregister-next'));
}

describe('未登记素材的界面', () => {
  // ① 未登记卡片的缩略图底色是黄的：卡片带标记类与属性，样式规则只染缩略图
  it('未登记卡片带标记且缩略图使用黄色底色', async () => {
    const opened = await openTexturePanel();
    const container = renderPanel(opened.panel);
    const extra = cardOf(container, 'extra.png');
    const hero = cardOf(container, 'hero.png');

    expect(extra?.classList.contains('is-unregistered')).toBe(true);
    expect(extra?.getAttribute('data-registered')).toBe('false');
    expect(hero?.classList.contains('is-unregistered')).toBe(false);
    expect(hero?.getAttribute('data-registered')).toBe('true');

    const rule = ruleBody(assetCss, '.asset-card.is-unregistered .asset-card-thumb');

    expect(rule).toContain('--easset-unregistered-bg');
  });

  // ② 选中未登记素材时详情栏只给「注册到游戏」，不给「配置」与「注销」
  it('选中未登记素材只显示注册按钮', async () => {
    const opened = await openTexturePanel();
    const container = renderPanel(opened.panel);

    selectCard(container, 'extra.png');

    expect(container.querySelector('[data-test-id="asset-detail-register"]')).not.toBeNull();
    expect(container.querySelector('[data-test-id="asset-detail-config"]')).toBeNull();
    expect(container.querySelector('[data-test-id="asset-detail-unregister"]')).toBeNull();
  });

  // ③ 点「注册到游戏」后卡片变已登记、按钮互换，保存后列表正文含新名字
  it('注册后卡片变已登记且保存写进列表', async () => {
    const opened = await openTexturePanel();
    const container = renderPanel(opened.panel);

    selectCard(container, 'extra.png');
    fireEvent.click(container.querySelector('[data-test-id="asset-detail-register"]')!);

    await waitFor((): void => {
      expect(cardOf(container, 'extra.png')?.getAttribute('data-registered')).toBe('true');
    });

    expect(cardOf(container, 'extra.png')?.classList.contains('is-unregistered')).toBe(false);
    expect(container.querySelector('[data-test-id="asset-detail-unregister"]')).not.toBeNull();
    expect(container.querySelector('[data-test-id="asset-detail-register"]')).toBeNull();

    await act(async (): Promise<void> => {
      await opened.panel.save();
    });

    const text = String(await opened.system.resourceSystem.readContent('content/texture/.list.jsonc'));

    expect(text).toContain('extra.png');
  });

  // ④ 注销第一步点取消：仍是已登记，什么都没变
  it('注销第一个确认框取消后保持已登记', async () => {
    const opened = await openTexturePanel();
    const container = renderPanel(opened.panel);

    selectCard(container, 'extra.png');
    fireEvent.click(container.querySelector('[data-test-id="asset-detail-register"]')!);

    await waitFor((): void => {
      expect(cardOf(container, 'extra.png')?.getAttribute('data-registered')).toBe('true');
    });

    fireEvent.click(screen.getByTestId('asset-detail-unregister'));

    expect(screen.getByTestId('asset-unregister-next')).toBeDefined();

    fireEvent.click(screen.getByTestId('asset-unregister-cancel'));

    expect(cardOf(container, 'extra.png')?.getAttribute('data-registered')).toBe('true');
    expect(screen.queryByTestId('asset-unregister-next')).toBeNull();
  });

  // ⑤ 注销第二步点取消：仍是已登记，第二个框已出现
  it('注销第二个确认框取消后保持已登记', async () => {
    const opened = await openTexturePanel();
    const container = renderPanel(opened.panel);

    selectCard(container, 'extra.png');
    fireEvent.click(container.querySelector('[data-test-id="asset-detail-register"]')!);

    await waitFor((): void => {
      expect(cardOf(container, 'extra.png')?.getAttribute('data-registered')).toBe('true');
    });

    openFinalUnregister();

    expect(screen.getByTestId('asset-unregister-final-confirm')).toBeDefined();

    fireEvent.click(screen.getByTestId('asset-unregister-final-cancel'));

    expect(cardOf(container, 'extra.png')?.getAttribute('data-registered')).toBe('true');
    expect(screen.queryByTestId('asset-unregister-final-confirm')).toBeNull();
  });

  // ⑥ 完整注销链路：两次确认后回到黄卡，保存后列表去掉名字但文件字节仍在
  it('两次确认注销后保存只去掉登记，文件字节保留', async () => {
    const opened = await openTexturePanel();
    const container = renderPanel(opened.panel);

    selectCard(container, 'extra.png');
    fireEvent.click(container.querySelector('[data-test-id="asset-detail-register"]')!);

    await waitFor((): void => {
      expect(cardOf(container, 'extra.png')?.getAttribute('data-registered')).toBe('true');
    });

    openFinalUnregister();
    fireEvent.click(screen.getByTestId('asset-unregister-final-confirm'));

    await waitFor((): void => {
      expect(cardOf(container, 'extra.png')?.getAttribute('data-registered')).toBe('false');
    });

    expect(container.querySelector('[data-test-id="asset-detail-register"]')).not.toBeNull();
    expect(container.querySelector('[data-test-id="asset-detail-unregister"]')).toBeNull();

    await act(async (): Promise<void> => {
      await opened.panel.save();
    });

    const text = String(await opened.system.resourceSystem.readContent('content/texture/.list.jsonc'));
    const bytes = await opened.fs.readBinary('content/texture/extra.png');

    expect(text).not.toContain('extra.png');
    expect(Array.from(bytes)).toEqual([2, 3]);
  });

  // ⑦ 删除确认文案写明会移除文件并指向「注销」；取消后文件仍在
  it('删除确认文案与注销区分且取消不删文件', async () => {
    const opened = await openTexturePanel();
    const container = renderPanel(opened.panel);

    selectCard(container, 'hero.png');
    fireEvent.click(container.querySelector('[data-test-id="asset-detail-delete"]')!);

    expect(screen.getByText(ASSET_DELETE_CONFIRM_TEXT).textContent).toContain('移除');
    expect(screen.getByText(ASSET_DELETE_CONFIRM_TEXT).textContent).toContain('注销');

    fireEvent.click(screen.getByTestId('asset-delete-cancel'));

    const bytes = await opened.fs.readBinary('content/texture/hero.png');

    expect(Array.from(bytes)).toEqual([1]);
  });

  // ⑧ 未登记卡片带卡级「未登记」徽标，且徽标在缩略图之外，不会被不透明图片盖住
  it('未登记卡片带缩略图之外的未登记徽标', async () => {
    const opened = await openTexturePanel();
    const container = renderPanel(opened.panel);
    const badge = container.querySelector('[data-test-id="asset-card-unregistered-extra.png"]');

    expect(badge?.textContent).toBe('未登记');
    expect(container.querySelector('.asset-card-thumb [data-test-id^="asset-card-unregistered"]')).toBeNull();
  });

  // ⑨ 卡片自身有深黄边框与 2px 内描边；用内阴影而不是加粗边框，卡片外框尺寸不变
  it('未登记卡片规则含内描边与深黄变量', () => {
    const rule = ruleBody(assetCss, '.asset-card.is-unregistered');

    expect(rule).toContain('box-shadow');
    expect(rule).toContain('inset 0 0 0 2px');
    expect(rule).toContain('var(--easset-unregistered-strong)');
    expect(rule).not.toContain('border-width');
  });

  // ⑩ 徽标样式用同一份深黄
  it('未登记徽标样式用深黄变量', () => {
    const rule = ruleBody(assetCss, '.asset-card-unregistered');

    expect(rule).toContain('var(--easset-unregistered-strong)');
  });
});
