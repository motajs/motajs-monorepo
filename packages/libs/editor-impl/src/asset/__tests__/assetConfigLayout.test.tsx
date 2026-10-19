import '../asset.css';
import { cleanup, configure, fireEvent, render } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AssetCategoryKind, AssetListFormat, IAssetCategory } from '../../react';
import { AssetPanelView } from '../components';
import { AssetPanelMode, AssetPanelStatus, IAssetPanelViewState } from '../types';

configure({ testIdAttribute: 'data-test-id' });

// 每个用例结束后卸载已挂载的组件，避免 DOM 在用例之间累积
afterEach(() => {
  cleanup();
});

/** 配置区布局用例使用的分类清单：图片与动画两类，够覆盖「配置态下分类导航仍可点」 */
const LAYOUT_CATEGORIES: readonly IAssetCategory[] = [
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
 * 配置布局用例的缺省字节读取：一律视为没有字节，避免在 jsdom 里触碰 `blob:` 地址
 * @returns 永为 undefined 的字节
 */
function noBytes(): Promise<Uint8Array | undefined> {
  return Promise.resolve(undefined);
}

/**
 * 渲染配置态的面板纯视图（不经 core），并透传返回与分类切换回调
 * @param onBack 返回素材列表回调
 * @param onSelectCategory 分类切换回调
 * @returns 渲染结果
 */
function renderConfigView(
  onBack: () => void,
  onSelectCategory: (categoryId: string) => void,
): ReturnType<typeof render> {
  const view: IAssetPanelViewState = {
    status: AssetPanelStatus.Ready,
    mode: AssetPanelMode.Configure,
    categories: LAYOUT_CATEGORIES,
    categoryId: 'texture',
    entries: [],
    rows: [],
    configErrors: [],
    unsaved: false,
    transcodeOpen: false,
    transcoding: false,
    transcodeCapable: true,
  };

  return render(createElement(AssetPanelView, { view, loadBytes: noBytes, onSelectCategory, onBack }));
}

describe('配置区布局', () => {
  // 配置态同时渲染出配置视图、分类导航与动画分类入口三个锚点
  it('配置态同时渲染配置视图与分类导航', () => {
    const { container } = renderConfigView(vi.fn(), vi.fn());

    expect(container.querySelector('[data-test-id="asset-config-view"]')).not.toBeNull();
    expect(container.querySelector('[data-test-id="asset-nav"]')).not.toBeNull();
    expect(container.querySelector('[data-test-id="asset-category-animation"]')).not.toBeNull();
  });

  // 配置表格的第一个定位祖先是 .asset-config-body，而不是整个面板或外壳
  it('配置表格的第一个定位祖先是配置主体', () => {
    const { container } = renderConfigView(vi.fn(), vi.fn());
    const body = container.querySelector<HTMLElement>('.asset-config-body');
    const etable = container.querySelector<HTMLElement>('.etable');

    expect(body).not.toBeNull();
    expect(etable).not.toBeNull();
    expect(window.getComputedStyle(body!).position).toBe('relative');

    let node: HTMLElement | null = etable!.parentElement;

    while (node !== null) {
      const position = window.getComputedStyle(node).position;

      if (position !== '' && position !== 'static') break;

      node = node.parentElement;
    }

    expect(node).toBe(body);
  });

  // 点「← 返回素材列表」触发一次 onBack
  it('点返回按钮触发一次 onBack', () => {
    const onBack = vi.fn();
    const { container } = renderConfigView(onBack, vi.fn());

    fireEvent.click(container.querySelector('[data-test-id="asset-config-back"]')!);

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  // 配置态点动画分类仍能驱动分类切换（导航未被表格吞掉）
  it('配置态点分类导航触发一次分类切换', () => {
    const onSelectCategory = vi.fn();
    const { container } = renderConfigView(vi.fn(), onSelectCategory);

    fireEvent.click(container.querySelector('[data-test-id="asset-category-animation"]')!);

    expect(onSelectCategory).toHaveBeenCalledTimes(1);
    expect(onSelectCategory).toHaveBeenCalledWith('animation');
  });
});
