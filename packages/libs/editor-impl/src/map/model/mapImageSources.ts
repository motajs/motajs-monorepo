import {
  IMapImageSourceStore,
  IMapImageSources,
  IMapTileGroup,
  IMapTileGroupUrls,
  MapImageBytesLoader,
  MapImageStatus,
} from '../types';

// 图块图片 blob 地址的生命周期：按图片路径读字节、按内容比较决定复用还是换新地址、释放时统一回收。
// 同一份缓存投影出两张各自键空间的快照——画布用图片路径键，素材区 / 底栏 / 收藏栏用 `group.id` 键。
// 本文件不触达文件系统：字节一律经调用方给的读取回调获得。

/** 一条图片路径的地址与内容缓存 */
interface IMapImageEntry {
  /** 该路径当前的 blob 地址；读取失败或尚未读到时为 undefined */
  readonly url?: string;

  /** 生成地址时用的字节，用来判断下次刷新是复用旧地址还是换新地址 */
  readonly bytes?: Uint8Array;

  /** 该路径的读取状态 */
  readonly status: MapImageStatus;
}

/**
 * 判断图片路径能否交给资源层：拒绝空路径、绝对路径与含 `..` 段的路径
 * @param path 图片相对项目根的路径
 * @returns 路径合法时为 true
 */
function isSafeImagePath(path: string): boolean {
  if (path.length === 0) return false;
  if (path.startsWith('/') || path.startsWith('\\')) return false;

  return !path.split(/[\\/]/).includes('..');
}

/**
 * 按扩展名推断图片的 MIME 类型
 * @param path 图片相对项目根的路径
 * @returns 可交给 Blob 的 MIME 类型；未知扩展名按 PNG 处理
 */
export function resolveImageMime(path: string): string {
  const lower = path.toLowerCase();

  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';

  return 'image/png';
}

/**
 * 判断两段字节是否逐字节相同：先比长度，长度相同再逐位比较
 * @param left 缓存里的旧字节；没有缓存时为 undefined
 * @param right 本次读到的字节
 * @returns 长度与每一位都相同时为 true
 */
function isSameBytes(left: Uint8Array | undefined, right: Uint8Array): boolean {
  if (left === undefined) return false;
  if (left.length !== right.length) return false;

  for (let index = 0; index < right.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }

  return true;
}

export class MapImageSourceStore implements IMapImageSourceStore {
  /** 地址表真正换代的次数；只有地址集合发生变化时才递增 */
  version: number = 0;

  /** 图片路径 → 地址与内容缓存 */
  private entries: Map<string, IMapImageEntry> = new Map();

  /** `group.id` → 地址与状态的分组表快照 */
  private groupUrls: IMapTileGroupUrls = { urls: {}, status: {} };

  /** 是否已释放；释放后刷新直接返回，不再创建任何地址 */
  private disposed: boolean = false;

  /**
   * 按当前文档重建两张地址表；同一路径内容未变时复用旧地址
   * @param imagePaths 本帧需要的图片路径集合
   * @param groups 当前文档的图块分组集合
   * @param loadBytes 按图片相对路径读字节的回调
   * @returns 重建完成后的异步结果
   */
  async refresh(
    imagePaths: readonly string[],
    groups: readonly IMapTileGroup[],
    loadBytes: MapImageBytesLoader,
  ): Promise<void> {
    if (this.disposed) return;

    const previous = this.entries;
    const next: Map<string, IMapImageEntry> = new Map();
    let changed = false;

    for (const path of imagePaths) {
      if (next.has(path)) continue;

      const entry = await this.readEntry(path, previous.get(path), loadBytes);

      if (entry !== previous.get(path)) changed = true;

      next.set(path, entry);
    }

    for (const path of previous.keys()) {
      if (next.has(path)) continue;

      const stale = previous.get(path);

      if (stale?.url !== undefined) URL.revokeObjectURL(stale.url);

      changed = true;
    }

    this.entries = next;
    this.groupUrls = this.projectGroups(groups, next);

    if (changed) this.version += 1;
  }

  /**
   * 取图片路径键的快照，给地图画布用
   * @returns 以图片相对路径为键的地址与状态表
   */
  getSources(): IMapImageSources {
    const urls: Record<string, string | undefined> = {};
    const status: Record<string, MapImageStatus> = {};

    for (const [path, entry] of this.entries) {
      urls[path] = entry.url;
      status[path] = entry.status;
    }

    return { urls, status };
  }

  /**
   * 取 `group.id` 键的快照，给素材区 / 底栏 / 收藏栏用
   * @returns 以分组标识为键的地址与状态表
   */
  getGroupUrls(): IMapTileGroupUrls {
    return { urls: { ...this.groupUrls.urls }, status: { ...this.groupUrls.status } };
  }

  /**
   * 回收全部 `blob:` 地址并清空两张表；面板释放时调用
   */
  dispose(): void {
    for (const entry of this.entries.values()) {
      if (entry.url !== undefined) URL.revokeObjectURL(entry.url);
    }

    this.entries = new Map();
    this.groupUrls = { urls: {}, status: {} };
    this.disposed = true;
  }

  /**
   * 读取一条路径的地址：路径不合法直接记失败；内容未变复用旧地址；内容变了换新地址并回收旧的
   * @param path 图片相对项目根的路径
   * @param cached 上一条缓存；没有缓存时为 undefined
   * @param loadBytes 按图片相对路径读字节的回调
   * @returns 这条路径刷新后的缓存
   */
  private async readEntry(
    path: string,
    cached: IMapImageEntry | undefined,
    loadBytes: MapImageBytesLoader,
  ): Promise<IMapImageEntry> {
    if (!isSafeImagePath(path)) {
      if (cached?.url !== undefined) URL.revokeObjectURL(cached.url);

      return { status: MapImageStatus.Error };
    }

    let bytes: Uint8Array | undefined;

    try {
      bytes = await loadBytes(path);
    } catch {
      bytes = undefined;
    }

    if (bytes === undefined) {
      if (cached?.url !== undefined) URL.revokeObjectURL(cached.url);

      return { status: MapImageStatus.Error };
    }

    if (cached !== undefined && cached.url !== undefined && isSameBytes(cached.bytes, bytes)) return cached;

    if (cached?.url !== undefined) URL.revokeObjectURL(cached.url);

    const copy = bytes.slice();
    const url = URL.createObjectURL(new Blob([copy], { type: resolveImageMime(path) }));

    return { url, bytes: copy, status: MapImageStatus.Ready };
  }

  /**
   * 把图片路径键的缓存投影成 `group.id` 键的分组表
   * @param groups 当前文档的图块分组
   * @param entries 图片路径键的缓存
   * @returns 以分组标识为键的地址与状态表
   */
  private projectGroups(groups: readonly IMapTileGroup[], entries: Map<string, IMapImageEntry>): IMapTileGroupUrls {
    const urls: Record<string, string | undefined> = {};
    const status: Record<string, MapImageStatus> = {};

    for (const group of groups) {
      const entry = entries.get(group.imagePath);

      urls[group.id] = entry?.url;
      status[group.id] = entry === undefined ? MapImageStatus.Loading : entry.status;
    }

    return { urls, status };
  }
}
