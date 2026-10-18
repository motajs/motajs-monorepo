import { cleanup, configure, fireEvent, render } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AssetCategoryKind, AssetListFormat, IAssetCategory } from '../../react';
import { AssetPanelView } from '../components';
import { AssetPanelMode, AssetPanelStatus, IAssetEntry, IAssetPanelViewState } from '../types';

configure({ testIdAttribute: 'data-test-id' });

// 每个用例结束后卸载已挂载的组件，避免 DOM 在用例之间累积
afterEach(() => {
  cleanup();
});

/** 视图测试沿用的一份分类清单：图片（对象数组）与动画（字符串数组），够覆盖转码开关该用哪一档 */
const VIEW_CATEGORIES: readonly IAssetCategory[] = [
  {
    id: 'texture',
    label: '图片',
    kind: AssetCategoryKind.Image,
    dir: 'content/texture',
    listPath: 'content/texture/.list.jsonc',
    listFormat: AssetListFormat.ObjectList,
    listKey: 'textures',
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

/**
 * 造一条素材条目
 * @param name 素材名
 * @param exists 字节文件是否存在
 * @returns 素材条目
 */
function entry(name: string, exists: boolean): IAssetEntry {
  return { name, path: `content/texture/${name}`, exists };
}

/**
 * 以缺省值补全一份面板视图状态
 * @param overrides 需要覆盖的字段
 * @returns 完整的面板视图状态
 */
function makeView(overrides: Partial<IAssetPanelViewState>): IAssetPanelViewState {
  const base: IAssetPanelViewState = {
    status: AssetPanelStatus.Ready,
    mode: AssetPanelMode.Browse,
    categories: VIEW_CATEGORIES,
    categoryId: 'texture',
    entries: [],
    rows: [],
    configErrors: [],
    unsaved: false,
  };

  return { ...base, ...overrides };
}

/**
 * 视图测试的缺省字节读取：一律视为没有字节，避免在 jsdom 里触碰 `blob:` 地址
 * @returns 永为 undefined 的字节
 */
function noBytes(): Promise<Uint8Array | undefined> {
  return Promise.resolve(undefined);
}

/** 视图测试的缺省分类选择回调：不做任何事 */
function noopSelect(): void {}

/**
 * 直接渲染纯视图组件（不经 core），并提供缺省回调
 * @param view 要渲染的面板视图状态
 * @param onRetry 可选的错误态重试回调
 * @returns 渲染结果
 */
function renderView(view: IAssetPanelViewState, onRetry?: () => void): ReturnType<typeof render> {
  return render(createElement(AssetPanelView, { view, loadBytes: noBytes, onSelectCategory: noopSelect, onRetry }));
}

describe('素材面板视图', () => {
  // 正常态：卡片数与条目数一致，每张卡片的 title 是完整的素材名
  it('正常态按条目渲染卡片与 title', () => {
    const view = makeView({ entries: [entry('hero', true), entry('foe', true)] });
    const { container } = renderView(view);
    const cards = container.querySelectorAll('button[data-test-id^="asset-card-"]');

    expect(cards.length).toBe(2);
    expect(cards[0].getAttribute('title')).toBe('hero');
    expect(cards[1].getAttribute('title')).toBe('foe');
  });

  // 选中的那一条卡片带 is-selected，未选中的不带
  it('选中卡片带 is-selected', () => {
    const view = makeView({ entries: [entry('hero', true), entry('foe', true)], selectedName: 'hero' });
    const { container } = renderView(view);

    expect(container.querySelector('[data-test-id="asset-card-hero"]')?.classList.contains('is-selected')).toBe(true);
    expect(container.querySelector('[data-test-id="asset-card-foe"]')?.classList.contains('is-selected')).toBe(false);
  });

  // 字节缺失的卡片带 is-missing，并显示缺失标记
  it('缺失卡片带 is-missing 与缺失标记', () => {
    const view = makeView({ entries: [entry('ghost', false)] });
    const { container } = renderView(view);

    expect(container.querySelector('[data-test-id="asset-card-ghost"]')?.classList.contains('is-missing')).toBe(true);
    expect(container.querySelector('[data-test-id="asset-card-missing-ghost"]')).not.toBeNull();
  });

  // 加载态：显示「正在加载素材…」，保存与新增按钮禁用
  it('加载态显示文案并禁用保存与新增', () => {
    const view = makeView({ status: AssetPanelStatus.Loading });
    const { container } = renderView(view);

    expect(container.textContent).toContain('正在加载素材…');
    expect(container.querySelector('[data-test-id="asset-toolbar-save"]')?.hasAttribute('disabled')).toBe(true);
    expect(container.querySelector('[data-test-id="asset-toolbar-add"]')?.hasAttribute('disabled')).toBe(true);
  });

  // 空态：显示标题与上传引导两句文案
  it('空态显示标题与正文', () => {
    const view = makeView({ status: AssetPanelStatus.Empty });
    const { container } = renderView(view);

    expect(container.textContent).toContain('暂无素材');
    expect(container.textContent).toContain('该分类下还没有素材，点击「新增素材」上传一个本地文件。');
  });

  // 错误态：显示标题与正文，点重试触发传入的回调
  it('错误态显示文案并触发重试', () => {
    const onRetry = vi.fn();
    const view = makeView({ status: AssetPanelStatus.Error });
    const { container } = renderView(view, onRetry);
    const retry = container.querySelector('[data-test-id="asset-state-retry"]');

    expect(container.textContent).toContain('素材加载失败');
    expect(container.textContent).toContain('请检查该分类的资源是否存在，或稍后重试。');
    expect(retry).not.toBeNull();

    fireEvent.click(retry!);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  // 未选中：详情栏显示「选择一个素材查看详情」
  it('未选中详情显示引导文案', () => {
    const view = makeView({ entries: [entry('hero', true)] });
    const { container } = renderView(view);

    expect(container.querySelector('[data-test-id="asset-detail-empty"]')?.textContent).toContain(
      '选择一个素材查看详情',
    );
  });

  // 选中：详情显示名称、路径与替换 / 删除 / 配置三个按钮
  it('选中详情显示名称路径与操作按钮', () => {
    const view = makeView({ entries: [entry('hero', true)], selectedName: 'hero' });
    const { container } = renderView(view);

    expect(container.querySelector('.asset-detail-title')?.textContent).toBe('hero');
    expect(container.querySelector('.asset-detail-path')?.textContent).toBe('content/texture/hero');
    expect(container.querySelector('[data-test-id="asset-detail-replace"]')).not.toBeNull();
    expect(container.querySelector('[data-test-id="asset-detail-delete"]')).not.toBeNull();
    expect(container.querySelector('[data-test-id="asset-detail-config"]')).not.toBeNull();
  });

  // 分类导航：当前项带 aria-current="true"，非当前项不带
  it('分类导航当前项带 aria-current', () => {
    const { container } = renderView(makeView({}));

    expect(container.querySelector('[data-test-id="asset-category-texture"]')?.getAttribute('aria-current')).toBe(
      'true',
    );
    expect(
      container.querySelector('[data-test-id="asset-category-animation"]')?.getAttribute('aria-current'),
    ).toBeNull();
  });

  // 转码开关：当前分类是动画（不可转码）时「瘦身转码」禁用
  it('动画或字体分类禁用转码', () => {
    const { container } = renderView(makeView({ categoryId: 'animation' }));

    expect(container.querySelector('[data-test-id="asset-toolbar-transcode"]')?.hasAttribute('disabled')).toBe(true);
  });

  // 分类未注入：分类导航显示「尚无可用分类」
  it('无分类时显示尚无可用分类', () => {
    const view = makeView({ status: AssetPanelStatus.NoCategory, categories: [], categoryId: undefined });
    const { container } = renderView(view);

    expect(container.textContent).toContain('尚无可用分类');
  });
});
