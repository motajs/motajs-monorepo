import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MapImageSourceStore } from '../model/mapImageSources';
import { IMapTileGroup, MapImageStatus } from '../types';
import { createTileGroup } from './fixtures';

// 图块图片地址 store 的单元断言：复用 / 换代 / 回收 / 释放 / 两张表的键空间 / 路径守卫。
// 这里不渲染组件，只按调用约定驱动 store，因此可以精确断言 createObjectURL 与 revokeObjectURL 的次数。

/** 每建一个地址就递增的序号，保证每次拿到的地址字符串不同 */
let sequence = 0;

/** `URL.createObjectURL` 的可断言替身：返回带序号的假地址 */
const createObjectUrl = vi.fn((_blob: Blob): string => {
  sequence += 1;
  return `blob:map-image-${sequence}`;
});

/** `URL.revokeObjectURL` 的可断言替身 */
const revokeObjectUrl = vi.fn((_url: string): void => {});

Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: createObjectUrl });
Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: revokeObjectUrl });

/**
 * 造一个只关心标识与图片路径的图块分组
 * @param id 分组标识
 * @param imagePath 图片相对项目根的路径
 * @returns 图块分组
 */
function groupWith(id: string, imagePath: string): IMapTileGroup {
  return createTileGroup({ id, imagePath });
}

/**
 * 按路径返回固定字节的读取回调
 * @param table 路径 → 字节
 * @returns 读取回调
 */
function loaderFrom(table: Readonly<Record<string, Uint8Array>>): (path: string) => Promise<Uint8Array | undefined> {
  return async (path: string): Promise<Uint8Array | undefined> => table[path];
}

beforeEach(() => {
  sequence = 0;
  createObjectUrl.mockClear();
  revokeObjectUrl.mockClear();
});

describe('MapImageSourceStore：两张地址表与地址复用', () => {
  // 两个路径读到不同字节就生成两个地址；路径键查得到、group.id 键查得到，两张表互不串键
  it('按路径与按分组各查各的地址', async () => {
    const store = new MapImageSourceStore();
    const groups = [groupWith('group-a', 'content/map/a.png'), groupWith('group-b', 'content/map/b.png')];
    const paths = ['content/map/a.png', 'content/map/b.png'];
    const loader = loaderFrom({
      'content/map/a.png': Uint8Array.from([1, 2]),
      'content/map/b.png': Uint8Array.from([3]),
    });

    await store.refresh(paths, groups, loader);

    const sources = store.getSources();
    const groupUrls = store.getGroupUrls();

    expect(sources.urls['content/map/a.png']).toBe('blob:map-image-1');
    expect(sources.urls['content/map/b.png']).toBe('blob:map-image-2');
    expect(sources.status['content/map/a.png']).toBe(MapImageStatus.Ready);
    expect(groupUrls.urls['group-a']).toBe('blob:map-image-1');
    expect(groupUrls.urls['group-b']).toBe('blob:map-image-2');
    expect(sources.urls['group-a']).toBeUndefined();
    expect(groupUrls.urls['content/map/a.png']).toBeUndefined();
    expect(createObjectUrl.mock.calls[0][0].type).toBe('image/png');
  });

  // 同一路径内容没变：复用旧地址、版本不增、一个旧地址都不回收
  it('内容未变时复用旧地址且版本不增', async () => {
    const store = new MapImageSourceStore();
    const groups = [groupWith('group-a', 'content/map/a.png')];
    const loader = loaderFrom({ 'content/map/a.png': Uint8Array.from([1, 2]) });

    await store.refresh(['content/map/a.png'], groups, loader);

    const versionBefore = store.version;
    const urlBefore = store.getSources().urls['content/map/a.png'];

    await store.refresh(['content/map/a.png'], groups, loader);

    expect(store.version).toBe(versionBefore);
    expect(store.getSources().urls['content/map/a.png']).toBe(urlBefore);
    expect(createObjectUrl).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrl).not.toHaveBeenCalled();
  });

  // 同一路径内容变了：建新地址、回收旧地址、版本加一
  it('内容变化时换新地址并回收旧地址', async () => {
    const store = new MapImageSourceStore();
    const groups = [groupWith('group-a', 'content/map/a.png')];
    let bytes = Uint8Array.from([1, 2]);

    await store.refresh(['content/map/a.png'], groups, async () => bytes);

    const versionBefore = store.version;
    const urlBefore = store.getSources().urls['content/map/a.png'];

    bytes = Uint8Array.from([9, 9, 9]);
    await store.refresh(['content/map/a.png'], groups, async () => bytes);

    const urlAfter = store.getSources().urls['content/map/a.png'];

    expect(urlAfter).not.toBe(urlBefore);
    expect(store.version).toBe(versionBefore + 1);
    expect(revokeObjectUrl).toHaveBeenCalledWith(urlBefore);
  });

  // 释放后所有地址都被回收，再刷新不产生任何新地址
  it('释放后回收全部地址且再刷新不建地址', async () => {
    const store = new MapImageSourceStore();
    const groups = [groupWith('group-a', 'content/map/a.png'), groupWith('group-b', 'content/map/b.png')];
    const paths = ['content/map/a.png', 'content/map/b.png'];
    const loader = loaderFrom({
      'content/map/a.png': Uint8Array.from([1]),
      'content/map/b.png': Uint8Array.from([2]),
    });

    await store.refresh(paths, groups, loader);
    revokeObjectUrl.mockClear();
    createObjectUrl.mockClear();

    store.dispose();

    expect(revokeObjectUrl).toHaveBeenCalledTimes(2);

    await store.refresh(paths, groups, loader);

    expect(createObjectUrl).not.toHaveBeenCalled();
    expect(store.getSources().urls).toEqual({});
    expect(store.getGroupUrls().urls).toEqual({});
  });

  // 空路径、绝对路径与含 `..` 的路径被拒绝：不读字节、不建地址、状态记为失败
  it('拒绝不安全路径且不读字节', async () => {
    const store = new MapImageSourceStore();
    const groups = [groupWith('group-bad', '/etc/a.png')];
    const loader = vi.fn(async (_path: string): Promise<Uint8Array | undefined> => Uint8Array.from([1]));

    await store.refresh(['/etc/a.png', 'content/../../a.png', ''], groups, loader);

    expect(loader).not.toHaveBeenCalled();
    expect(createObjectUrl).not.toHaveBeenCalled();
    expect(store.getSources().status['/etc/a.png']).toBe(MapImageStatus.Error);
    expect(store.getSources().status['content/../../a.png']).toBe(MapImageStatus.Error);
    expect(store.getSources().status['']).toBe(MapImageStatus.Error);
    expect(store.getGroupUrls().status['group-bad']).toBe(MapImageStatus.Error);
  });
});
