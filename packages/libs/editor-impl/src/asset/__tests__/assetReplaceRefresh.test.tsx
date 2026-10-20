import { act, cleanup, configure, render, waitFor } from '@testing-library/react';
import { EditorCore } from '@motajs/editor-core';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ASSET_PANEL_TYPE_ID, AssetPanel } from '..';
import { ASSET_TEST_CATEGORIES, createAssetHarness, FakeFileSystem, listText } from './fixtures';

// jsdom 没有实现 `URL.createObjectURL`，预览组件却要靠它把字节变成地址；这里补上两个静态方法，
// 并让地址随调用递增，使「重新读取」必然产出与上一次不同的地址。

/** 已创建的 `blob:` 地址计数，用例之间由 beforeEach 归零 */
let objectUrlCount = 0;

/**
 * 造一个随调用递增的 `blob:` 地址，保证每次读取都拿到不同的地址
 * @returns 本次的 `blob:` 地址
 */
function nextObjectUrl(): string {
  objectUrlCount += 1;
  return `blob:asset-${objectUrlCount}`;
}

/** `URL.createObjectURL` 的替身，调用次数用于判断预览是否真的重新读取了字节 */
const createObjectUrl = vi.fn((): string => nextObjectUrl());

/** `URL.revokeObjectURL` 的替身，用于判断旧地址是否被回收 */
const revokeObjectUrl = vi.fn();

Object.defineProperty(URL, 'createObjectURL', { value: createObjectUrl, configurable: true });
Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectUrl, configurable: true });

configure({ testIdAttribute: 'data-test-id' });

// 每个用例开始前清掉地址计数与调用记录，避免沿用上一个用例的地址
beforeEach(() => {
  objectUrlCount = 0;
  createObjectUrl.mockClear();
  revokeObjectUrl.mockClear();
});

// 每个用例结束后卸载已挂载的组件，避免 DOM 在用例之间累积
afterEach(() => {
  cleanup();
});

/** 面板实例与已挂载的视图容器 */
interface ITexturePanelFixture {
  /** 数据层面的素材面板实例 */
  readonly panel: AssetPanel;
  /** 已挂载的面板视图容器 */
  readonly container: HTMLElement;
}

/**
 * 造一段带 PNG 签名与 `IHDR` 块头的字节
 * @param width 宽（像素）
 * @param height 高（像素）
 * @returns 可被解析的最小 PNG 头
 */
function createPng(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(29);

  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0x00, 0x00, 0x00, 0x0d], 8);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);

  const view = new DataView(bytes.buffer);

  view.setUint32(16, width, false);
  view.setUint32(20, height, false);

  return bytes;
}

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
 * 打开图片分类、选中指定素材并渲染面板视图
 * @param system 已初始化的编辑器核心
 * @param assetName 要选中的素材名
 * @returns 面板实例与渲染容器
 */
async function mountTexturePanel(system: EditorCore, assetName: string): Promise<ITexturePanelFixture> {
  const panel = await openPanel(system);

  await panel.selectCategory('texture');
  panel.setTarget({ assetName });

  return { panel, container: render(createElement(panel.render())).container };
}

/**
 * 取某张卡片缩略图的地址
 * @param container 渲染容器
 * @param name 素材名
 * @returns 缩略图的 `src`；未渲染时为 null
 */
function cardSrc(container: HTMLElement, name: string): string | null {
  const node = container.querySelector(
    `button[data-test-id="asset-card-${name}"] [data-test-id="asset-card-preview-image"]`,
  );

  return node === null ? null : node.getAttribute('src');
}

/**
 * 取详情预览里图片的地址
 * @param container 渲染容器
 * @returns 预览图片的 `src`；未渲染时为 null
 */
function detailSrc(container: HTMLElement): string | null {
  const node = container.querySelector('img.asset-preview-image');

  return node === null ? null : node.getAttribute('src');
}

/**
 * 取详情尺寸行的文本
 * @param container 渲染容器
 * @returns 尺寸文本；未渲染时为空串
 */
function detailSize(container: HTMLElement): string {
  const node = container.querySelector('[data-test-id="asset-detail-size"]');

  return node === null ? '' : (node.textContent ?? '');
}

describe('素材替换后的预览刷新', () => {
  // 同路径替换字节：卡片缩略图、详情预览与尺寸行同时换成新内容，全程不切换选中、不重开分类
  it('同路径替换后卡片、详情预览与尺寸行同时更新', async () => {
    const fs = new FakeFileSystem();

    fs.seed('content/texture/.list.jsonc', listText({ textures: [{ source: 'hero' }] }));
    fs.seed('content/texture/hero', createPng(192, 128));

    const system = await createAssetHarness(fs);
    const fixture = await mountTexturePanel(system, 'hero');

    await waitFor(() => {
      expect(cardSrc(fixture.container, 'hero')).not.toBeNull();
      expect(detailSrc(fixture.container)).not.toBeNull();
      expect(detailSize(fixture.container)).toBe('192 × 128');
    });

    const cardBefore = cardSrc(fixture.container, 'hero');
    const detailBefore = detailSrc(fixture.container);
    const createdBefore = createObjectUrl.mock.calls.length;

    await act(async () => {
      await fixture.panel.replaceAsset('hero', createPng(64, 32));
    });

    await waitFor(() => {
      expect(cardSrc(fixture.container, 'hero')).not.toBe(cardBefore);
      expect(detailSrc(fixture.container)).not.toBe(detailBefore);
      expect(detailSize(fixture.container)).toBe('64 × 32');
    });

    // 地址确实重新创建过：替换后新增了卡片与详情两处读取
    expect(createObjectUrl.mock.calls.length).toBe(createdBefore + 2);

    // 旧地址在版本变化时被回收，避免 `blob:` 泄漏
    expect(revokeObjectUrl).toHaveBeenCalledWith(cardBefore);
    expect(revokeObjectUrl).toHaveBeenCalledWith(detailBefore);
  });

  // 替换只重读被替换的那一个素材：另一张卡片的地址保持不变
  it('替换只让被替换的素材重新读取字节', async () => {
    const fs = new FakeFileSystem();

    fs.seed('content/texture/.list.jsonc', listText({ textures: [{ source: 'hero' }, { source: 'tile' }] }));
    fs.seed('content/texture/hero', createPng(192, 128));
    fs.seed('content/texture/tile', createPng(32, 16));

    const system = await createAssetHarness(fs);
    const fixture = await mountTexturePanel(system, 'hero');

    await waitFor(() => {
      expect(cardSrc(fixture.container, 'hero')).not.toBeNull();
      expect(cardSrc(fixture.container, 'tile')).not.toBeNull();
      expect(detailSrc(fixture.container)).not.toBeNull();
      expect(detailSize(fixture.container)).toBe('192 × 128');
    });

    const heroBefore = cardSrc(fixture.container, 'hero');
    const tileBefore = cardSrc(fixture.container, 'tile');
    const createdBefore = createObjectUrl.mock.calls.length;

    await act(async () => {
      await fixture.panel.replaceAsset('hero', createPng(64, 32));
    });

    await waitFor(() => {
      expect(cardSrc(fixture.container, 'hero')).not.toBe(heroBefore);
    });

    expect(cardSrc(fixture.container, 'tile')).toBe(tileBefore);
    expect(createObjectUrl.mock.calls.length).toBe(createdBefore + 2);
  });
});
