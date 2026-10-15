import { CONTENT_CACHE_MAX_BYTES, IContentCache, ResourceContent } from './types';

// 内容缓存池：按路径缓存已读内容，设总字节上限并按 LRU 淘汰最久未用条目，写入同步、增删移失效。

interface IContentCacheEntry {
  /** 缓存内容原文或原始字节 */
  readonly content: ResourceContent;
  /** 内容占用的字节数 */
  readonly bytes: number;
}

/**
 * 计算内容的字节数：字符串按 UTF-8 编码计、字节数组取自身长度
 * @param content 缓存内容
 * @returns 内容占用的字节数
 */
function byteLengthOf(content: ResourceContent): number {
  if (typeof content === 'string') return new TextEncoder().encode(content).byteLength;

  return content.byteLength;
}

export class ContentCache implements IContentCache {
  /** 路径到缓存条目的映射，按最近使用序排列（最旧在前） */
  private readonly entries: Map<string, IContentCacheEntry> = new Map();
  /** 缓存内容的总字节上限 */
  private readonly maxBytes: number;
  /** 当前缓存内容的总字节数 */
  private totalBytes: number = 0;

  constructor(maxBytes: number = CONTENT_CACHE_MAX_BYTES) {
    this.maxBytes = maxBytes;
  }

  get(path: string): ResourceContent | undefined {
    const entry = this.entries.get(path);

    if (!entry) return undefined;

    this.entries.delete(path);
    this.entries.set(path, entry);

    return entry.content;
  }

  set(path: string, content: ResourceContent): void {
    const bytes = byteLengthOf(content);

    this.deleteEntry(path);

    // 单条内容超过总上限时不入缓存，避免一条就撑满并挤掉全部其它条目
    if (bytes > this.maxBytes) return;

    this.entries.set(path, { content, bytes });
    this.totalBytes += bytes;
    this.evictToLimit();
  }

  invalidate(path: string): void {
    this.deleteEntry(path);
  }

  clear(): void {
    this.entries.clear();
    this.totalBytes = 0;
  }

  /**
   * 删除一个缓存条目并同步总字节数
   * @param path 资源路径
   */
  private deleteEntry(path: string): void {
    const entry = this.entries.get(path);

    if (!entry) return;

    this.entries.delete(path);
    this.totalBytes -= entry.bytes;
  }

  /** 按 LRU 淘汰最旧条目，直到总字节数不超上限 */
  private evictToLimit(): void {
    while (this.totalBytes > this.maxBytes) {
      const oldest = this.entries.keys().next();

      if (oldest.done === true) return;

      this.deleteEntry(oldest.value);
    }
  }
}
