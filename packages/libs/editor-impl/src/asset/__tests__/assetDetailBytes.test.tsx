import { act, cleanup, configure, render, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AssetCategoryKind } from '../../react';
import { AssetDetail, AssetFileInfo } from '../components';
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
const HERO_ENTRY: IAssetEntry = { name: 'hero.png', path: 'content/texture/hero.png', exists: true };

/** 同一素材，字节已被替换过一次 */
const HERO_REPLACED_ENTRY: IAssetEntry = {
  name: 'hero.png',
  path: 'content/texture/hero.png',
  exists: true,
  byteVersion: 1,
};

/** 一段音频素材 */
const AUDIO_ENTRY: IAssetEntry = { name: 'bgm.wav', path: 'content/audio/bgm.wav', exists: true };

/**
 * 造一段带 PNG 签名与 `IHDR` 块头的字节
 * @param width 宽（像素）
 * @param height 高（像素）
 * @param byteLength 总字节数，用来模拟不同体积的文件
 * @returns 可被解析的最小 PNG 头
 */
function createPng(width: number, height: number, byteLength: number = 29): Uint8Array {
  const bytes = new Uint8Array(byteLength);

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
 * 取某个 `data-test-id` 节点的文本
 * @param container 渲染容器
 * @param testId 要查找的测试 id
 * @returns 节点文本；节点不存在时为 null
 */
function textOf(container: HTMLElement, testId: string): string | null {
  return container.querySelector(`[data-test-id="${testId}"]`)?.textContent ?? null;
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

describe('素材详情文件大小', () => {
  // 图片素材：一次读取同时给出文件大小与 192 × 128 尺寸
  it('图片素材同时显示文件大小与尺寸', async () => {
    const { container } = renderDetail(HERO_ENTRY, AssetCategoryKind.Image, alwaysBytes(createPng(192, 128)));

    await waitFor(() => {
      expect(textOf(container, 'asset-detail-bytes')).toBe('29 B');
      expect(textOf(container, 'asset-detail-size')).toBe('192 × 128');
    });
  });

  // 音频素材：只显示文件大小，不出现尺寸行
  it('音频素材只显示文件大小', async () => {
    const { container } = renderDetail(AUDIO_ENTRY, AssetCategoryKind.Audio, alwaysBytes(createPng(192, 128)));

    await waitFor(() => {
      expect(textOf(container, 'asset-detail-bytes')).toBe('29 B');
    });
    expect(container.querySelector('[data-test-id="asset-detail-size"]')).toBeNull();
  });

  // 读不到字节：两行都不出现，也不显示 0 B
  it('读不到字节时两行都不显示', async () => {
    const loadBytes = vi.fn((): Promise<Uint8Array | undefined> => Promise.resolve(undefined));
    const { container } = renderDetail(HERO_ENTRY, AssetCategoryKind.Image, loadBytes);

    await act(async () => {
      await Promise.resolve();
    });

    expect(loadBytes).toHaveBeenCalled();
    expect(container.querySelector('[data-test-id="asset-detail-bytes"]')).toBeNull();
    expect(container.querySelector('[data-test-id="asset-detail-size"]')).toBeNull();
  });

  // 读取器抛错：不崩溃，两行都不出现
  it('读取失败时两行都不显示且不抛错', async () => {
    const loadBytes = vi.fn((): Promise<Uint8Array | undefined> => Promise.reject(new Error('读盘失败')));
    const { container } = renderDetail(AUDIO_ENTRY, AssetCategoryKind.Audio, loadBytes);

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelector('[data-test-id="asset-detail-bytes"]')).toBeNull();
    expect(container.querySelector('[data-test-id="asset-detail-size"]')).toBeNull();
  });

  // 字节版本变化：大小随新字节更新，不需要切走再切回
  it('字节版本变化后文件大小立即刷新', async () => {
    const { container, rerender } = renderDetail(HERO_ENTRY, AssetCategoryKind.Image, alwaysBytes(createPng(192, 128)));

    await waitFor(() => {
      expect(textOf(container, 'asset-detail-bytes')).toBe('29 B');
    });

    rerender(
      createElement(AssetDetail, {
        entry: HERO_REPLACED_ENTRY,
        kind: AssetCategoryKind.Image,
        loadBytes: alwaysBytes(createPng(192, 128, 60)),
      }),
    );

    await waitFor(() => {
      expect(textOf(container, 'asset-detail-bytes')).toBe('60 B');
    });
  });

  // 大小与尺寸共用一次读取：单独渲染文件信息组件时只调用一次读取器
  it('文件大小与尺寸只读取一次字节', async () => {
    const loadBytes = vi.fn((): Promise<Uint8Array | undefined> => Promise.resolve(createPng(192, 128)));
    const { container } = render(
      createElement(AssetFileInfo, {
        kind: AssetCategoryKind.Image,
        path: HERO_ENTRY.path,
        byteVersion: 0,
        loadBytes,
      }),
    );

    await waitFor(() => {
      expect(textOf(container, 'asset-detail-size')).toBe('192 × 128');
    });
    expect(loadBytes).toHaveBeenCalledTimes(1);
  });
});
