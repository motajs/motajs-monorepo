import { cleanup, configure, render, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AssetCategoryKind } from '../../react';
import { AssetDetail } from '../components';
import { IAssetEntry } from '../types';

// jsdom 没有实现 `URL.createObjectURL`，详情预览却要在挂载后靠它把字节变成地址；只补这两个静态方法
Object.defineProperty(URL, 'createObjectURL', { value: vi.fn((): string => 'blob:test'), configurable: true });
Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });

configure({ testIdAttribute: 'data-test-id' });

// 每个用例结束后卸载已挂载的组件，避免 DOM 在用例之间累积
afterEach(() => {
  cleanup();
});

/** 192×128 的图片素材 */
const HERO_ENTRY: IAssetEntry = { name: 'hero.png', path: 'content/texture/hero.png', exists: true, registered: true };

/** 64×32 的另一张图片素材，用于验证切换后旧尺寸不残留 */
const TILE_ENTRY: IAssetEntry = { name: 'tile.png', path: 'content/texture/tile.png', exists: true, registered: true };

/** 缺失的图片素材 */
const MISSING_ENTRY: IAssetEntry = {
  name: 'ghost.png',
  path: 'content/texture/ghost.png',
  exists: false,
  registered: true,
};

/** 一段音频素材 */
const AUDIO_ENTRY: IAssetEntry = { name: 'bgm.wav', path: 'content/audio/bgm.wav', exists: true, registered: true };

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
 * 造一个永远返回固定字节的读取器
 * @param bytes 要返回的字节
 * @returns 按路径读取字节的回调
 */
function alwaysBytes(bytes: Uint8Array | undefined): (path: string) => Promise<Uint8Array | undefined> {
  return (): Promise<Uint8Array | undefined> => Promise.resolve(bytes);
}

/**
 * 造一个按路径返回不同字节的读取器
 * @param bytesByPath 路径到字节的映射
 * @returns 按路径读取字节的回调
 */
function bytesByPath(
  bytesByPathMap: ReadonlyMap<string, Uint8Array>,
): (path: string) => Promise<Uint8Array | undefined> {
  return (path: string): Promise<Uint8Array | undefined> => Promise.resolve(bytesByPathMap.get(path));
}

/**
 * 直接渲染详情栏
 * @param entry 要显示的素材条目
 * @param kind 素材的大分类
 * @param loadBytes 按路径读取字节的回调
 * @returns 渲染结果
 */
function renderDetail(
  entry: IAssetEntry,
  kind: AssetCategoryKind,
  loadBytes: (path: string) => Promise<Uint8Array | undefined>,
): ReturnType<typeof render> {
  return render(createElement(AssetDetail, { entry, kind, loadBytes }));
}

describe('素材详情尺寸', () => {
  // 图片素材：解析出 192×128 后显示「192 × 128」
  it('图片素材显示解析出的宽 × 高', async () => {
    const { container } = renderDetail(HERO_ENTRY, AssetCategoryKind.Image, alwaysBytes(createPng(192, 128)));

    await waitFor(() => {
      expect(container.querySelector('[data-test-id="asset-detail-size"]')?.textContent).toBe('192 × 128');
    });
  });

  // 音频素材：即使读到的是图片字节，也不显示尺寸行
  it('音频素材不显示尺寸', () => {
    const { container } = renderDetail(AUDIO_ENTRY, AssetCategoryKind.Audio, alwaysBytes(createPng(192, 128)));

    expect(container.querySelector('[data-test-id="asset-detail-size"]')).toBeNull();
  });

  // 图片素材但读不到字节：不显示尺寸行
  it('读不到字节时不显示尺寸', () => {
    const { container } = renderDetail(HERO_ENTRY, AssetCategoryKind.Image, alwaysBytes(undefined));

    expect(container.querySelector('[data-test-id="asset-detail-size"]')).toBeNull();
  });

  // 图片素材但字节无法解析：不显示尺寸行，也不抛错
  it('坏字节不显示尺寸且不抛错', () => {
    const loadBytes = alwaysBytes(new Uint8Array([1, 2, 3]));
    const { container } = renderDetail(HERO_ENTRY, AssetCategoryKind.Image, loadBytes);

    expect(container.querySelector('[data-test-id="asset-detail-size"]')).toBeNull();
  });

  // 字节文件缺失的图片素材：不显示尺寸行
  it('缺失文件不显示尺寸', () => {
    const { container } = renderDetail(MISSING_ENTRY, AssetCategoryKind.Image, alwaysBytes(createPng(192, 128)));

    expect(container.querySelector('[data-test-id="asset-detail-size"]')).toBeNull();
  });

  // 切换素材：旧尺寸清掉，换成新素材的 64 × 32
  it('切换素材后尺寸跟着更新', async () => {
    const reader = bytesByPath(
      new Map([
        [HERO_ENTRY.path, createPng(192, 128)],
        [TILE_ENTRY.path, createPng(64, 32)],
      ]),
    );
    const { container, rerender } = renderDetail(HERO_ENTRY, AssetCategoryKind.Image, reader);

    await waitFor(() => {
      expect(container.querySelector('[data-test-id="asset-detail-size"]')?.textContent).toBe('192 × 128');
    });

    rerender(createElement(AssetDetail, { entry: TILE_ENTRY, kind: AssetCategoryKind.Image, loadBytes: reader }));

    await waitFor(() => {
      expect(container.querySelector('[data-test-id="asset-detail-size"]')?.textContent).toBe('64 × 32');
    });
  });
});
