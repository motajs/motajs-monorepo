import { logger } from '../log';
import { IWriteBuffer, IWriteBufferEntry, PendingChangeListener, ResourceContent, WriteBufferWriter } from './types';

// 待写缓冲：按路径保存还没落盘的内容，写入只进缓冲，5 秒防抖到期后才真正写进磁盘。

/** 内容改动后最多等多久把待写内容写进磁盘 */
export const FLUSH_DEBOUNCE_MS = 5000;

/**
 * 判断两份资源内容是否相同：字符串按值比，字节数组按长度与逐字节比
 * @param left 第一份内容
 * @param right 第二份内容
 * @returns 两份内容相同时为 true
 */
export function isSameResourceContent(left: ResourceContent, right: ResourceContent): boolean {
  if (typeof left === 'string' || typeof right === 'string') return left === right;
  if (left.byteLength !== right.byteLength) return false;

  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }

  return true;
}

export class WriteBuffer implements IWriteBuffer {
  /** 路径到待写条目的映射；不设上限、不做淘汰 */
  private readonly entries: Map<string, IWriteBufferEntry> = new Map();
  /** 每条路径最近一次成功写出去的内容，用于识别宿主回声 */
  private readonly lastWritten: Map<string, ResourceContent> = new Map();
  /** 自增版本号，每次排入新内容时递增 */
  private version: number = 0;
  /** 把内容真正写进磁盘的回调 */
  private readonly writer: WriteBufferWriter;
  /** 待写集合变化时的回调 */
  private readonly onChange: PendingChangeListener;

  constructor(writer: WriteBufferWriter, onChange: PendingChangeListener) {
    this.writer = writer;
    this.onChange = onChange;
  }

  size(): number {
    return this.entries.size;
  }

  schedule(path: string, content: ResourceContent): void {
    const existing = this.entries.get(path);

    if (existing !== undefined) this.clearTimer(existing);

    this.version += 1;

    const entry: IWriteBufferEntry = {
      content,
      version: this.version,
      timer: null,
      inFlight: existing === undefined ? null : existing.inFlight,
      error: existing === undefined ? undefined : existing.error,
      externallyChanged: false,
    };

    this.entries.set(path, entry);
    this.armTimer(path, entry);
    this.onChange(this.paths());
  }

  flush(path: string): Promise<void> {
    const entry = this.entries.get(path);

    if (entry === undefined) return Promise.resolve();
    if (entry.inFlight !== null) return entry.inFlight;

    this.clearTimer(entry);

    const task = this.writeEntry(path, entry.content, entry.version, entry.externallyChanged);

    entry.inFlight = task;
    return task;
  }

  async flushAll(): Promise<void> {
    const keys = this.paths();
    let failure: unknown = undefined;
    let failed = false;

    for (const path of keys) {
      const entry = this.entries.get(path);

      // 冲突未表态的条目不能借全量写盘绕过：它们既不写盘也不抛错，继续留在待写里
      if (entry !== undefined && entry.externallyChanged) continue;

      try {
        await this.flush(path);
      } catch (error: unknown) {
        if (!failed) {
          failed = true;
          failure = error;
        }
      }
    }

    if (failed) throw failure;
  }

  has(path: string): boolean {
    return this.entries.has(path);
  }

  paths(): readonly string[] {
    return [...this.entries.keys()];
  }

  readPending(path: string): ResourceContent | undefined {
    const entry = this.entries.get(path);

    if (entry === undefined) return undefined;
    if (entry.externallyChanged) return undefined;

    return entry.content;
  }

  discard(path: string): void {
    const entry = this.entries.get(path);

    if (entry === undefined) return;

    this.clearTimer(entry);
    this.entries.delete(path);
    this.onChange(this.paths());
  }

  noteExternalWrite(path: string, diskContent: ResourceContent | undefined): void {
    const entry = this.entries.get(path);

    if (entry === undefined) return;

    const last = this.lastWritten.get(path);

    if (last !== undefined && diskContent !== undefined && isSameResourceContent(last, diskContent)) {
      // 自己写盘引起的宿主回声：已被外部变化标记的条目直接返回，不清标记、也不重排定时器，
      // 否则到点会走单路径写盘把冲突内容写出去，等于绕开「没表态就不写盘」
      if (entry.externallyChanged) return;

      // 未被标记时才重排一次防抖定时器：不改内容与版本号
      this.clearTimer(entry);
      this.armTimer(path, entry);
      return;
    }

    // 真外部变化：整条替换条目，保留内容、版本号、在途写盘与失败原因，只把标记置真并清掉定时器
    this.clearTimer(entry);
    this.entries.set(path, {
      content: entry.content,
      version: entry.version,
      timer: null,
      inFlight: entry.inFlight,
      error: entry.error,
      externallyChanged: true,
    });
  }

  clear(): void {
    for (const entry of this.entries.values()) this.clearTimer(entry);

    this.entries.clear();
    this.lastWritten.clear();
  }

  dispose(): void {
    this.clear();
  }

  /**
   * 执行一次写盘并按版本号结算条目：写盘期间又写入时保留条目，否则删除条目
   * @param path 资源标识（纯路径）
   * @param snapshot 本次写盘拍下的内容快照
   * @param snapshotVersion 拍下快照时的版本号
   * @param wasMarked 写盘开始时该条目是否已被外部写入挡住
   */
  private async writeEntry(
    path: string,
    snapshot: ResourceContent,
    snapshotVersion: number,
    wasMarked: boolean,
  ): Promise<void> {
    try {
      await this.writer(path, snapshot);
    } catch (error: unknown) {
      const current = this.entries.get(path);

      if (current !== undefined) {
        current.inFlight = null;
        current.error = String(error);
      }

      throw error;
    }

    this.lastWritten.set(path, snapshot);

    const current = this.entries.get(path);

    if (current === undefined) return;

    current.inFlight = null;
    current.error = undefined;

    // 外部变化正好落在这次写盘期间：标记优先，条目保留、定时器不重排
    if (!wasMarked && current.externallyChanged) return;

    if (current.version !== snapshotVersion) {
      this.clearTimer(current);

      const next: IWriteBufferEntry = {
        content: current.content,
        version: current.version,
        timer: null,
        inFlight: null,
        error: undefined,
        externallyChanged: false,
      };

      this.entries.set(path, next);
      this.armTimer(path, next);
      this.onChange(this.paths());
      return;
    }

    this.entries.delete(path);
    this.onChange(this.paths());
  }

  /**
   * 给一条条目装上 5 秒防抖定时器，到期后自己吞掉失败避免未处理拒绝
   * @param path 资源标识（纯路径）
   * @param entry 待写条目
   */
  private armTimer(path: string, entry: IWriteBufferEntry): void {
    entry.timer = setTimeout((): void => {
      entry.timer = null;
      void this.runScheduledFlush(path);
    }, FLUSH_DEBOUNCE_MS);
  }

  /**
   * 定时器到点后执行一次写盘；这条路径没有调用方，失败只记录日志
   * @param path 资源标识（纯路径）
   */
  private async runScheduledFlush(path: string): Promise<void> {
    try {
      await this.flush(path);
    } catch {
      // 失败原因已写进条目，定时器路径没有调用方，只记日志且绝不让异常逃逸成未处理拒绝
      logger.error('resource.flushFailed', path);
    }
  }

  /**
   * 清掉一条条目的防抖定时器
   * @param entry 待写条目
   */
  private clearTimer(entry: IWriteBufferEntry): void {
    if (entry.timer === null) return;

    clearTimeout(entry.timer);
    entry.timer = null;
  }
}
