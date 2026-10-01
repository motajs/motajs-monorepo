import { effect, signal } from 'alien-signals';
import { IFsPort } from '@motajs/editor-core';
import { waitUntil } from './waitUntil';
import { Content } from './types';
import { FileHandlerDependencies, IContentHandler, IPersistenceMonitor, ReadonlySignal } from './types';
import { isFileNotFoundError } from './errors';

export class FileHandler implements IContentHandler<string> {
  /** 五态文本内容，真实来源；对外只以只读信号暴露。 */
  private contentSignal: ReturnType<typeof signal<Content<string>>> = signal<Content<string>>({ status: 'idle' });
  /** 只读内容信号。 */
  readonly content: ReadonlySignal<Content<string>> = this.contentSignal as ReadonlySignal<Content<string>>;
  /** 宿主文件读写能力。 */
  private readonly fs: IFsPort;
  /** 项目级持久化监视器。 */
  private readonly persistenceMonitor: IPersistenceMonitor;
  /** 本处理器绑定的路径。 */
  private readonly path: string;
  /** 内存改动版本号，用于丢弃过期的读写结果。 */
  private mutationVersion: number = 0;

  constructor(path: string, deps: FileHandlerDependencies) {
    this.path = path;
    this.fs = deps.fs;
    this.persistenceMonitor = deps.persistenceMonitor;
  }

  getContent(): Content<string> {
    return this.contentSignal();
  }

  subscribe(listener: (content: Content<string>) => void): () => void {
    return effect(() => listener(this.contentSignal()));
  }

  async refetch(): Promise<void> {
    await this.load();
  }

  async ensureLoaded(): Promise<void> {
    const status = this.contentSignal().status;
    if (status === 'idle') await this.load();
    else if (status === 'loading') await this.waitForSettled();
  }

  getPath(): string {
    return this.path;
  }

  update(value: string): void;
  update(transform: (current: string) => string): void;
  update(transform: (current: string) => Promise<string>): Promise<void>;
  update(valueOrTransform: string | ((current: string) => string | Promise<string>)): void | Promise<void> {
    if (typeof valueOrTransform === 'string') {
      this.commit(valueOrTransform);
      return;
    }

    const current = this.contentSignal();
    if (current.status !== 'loaded') {
      throw new Error(`Cannot update file: current status is ${current.status}`);
    }
    const result = valueOrTransform(current.value);
    if (result instanceof Promise) {
      const version = this.mutationVersion;
      return result.then((value) => {
        if (version !== this.mutationVersion) return;
        this.commit(value);
      });
    }
    this.commit(result);
  }

  /**
   * 提交一份新文本：更新内存版本与内容，并排程异步写盘。
   *
   * @param value 要写入并落盘的新文本。
   */
  private commit(value: string): void {
    this.mutationVersion += 1;
    this.contentSignal({ status: 'loaded', value });
    const path = this.path;
    const fs = this.fs;
    this.persistenceMonitor.schedule(path, {
      kind: 'write',
      execute: () => fs.writeFile(path, value, 'utf-8'),
    });
  }

  waitForLoaded(): Promise<void> {
    return waitUntil(() => this.contentSignal().status === 'loaded');
  }

  waitForSettled(): Promise<void> {
    return waitUntil(() => !['idle', 'loading'].includes(this.contentSignal().status));
  }

  /**
   * 该路径是否存在排程中的写入。
   */
  hasPendingWrites(): boolean {
    return this.persistenceMonitor.statusFor(this.path) === 'persisting';
  }

  /**
   * 删除磁盘文件并置为 not-found；文件本就不存在时视为删除成功。
   */
  async delete(): Promise<void> {
    this.mutationVersion += 1;
    this.contentSignal({ status: 'not-found' });
    const path = this.path;
    const fs = this.fs;
    this.persistenceMonitor.schedule(path, {
      kind: 'delete',
      execute: async () => {
        try {
          await fs.deleteFile(path);
        } catch (error) {
          const normalized = error instanceof Error ? error : new Error(String(error));
          if (!isFileNotFoundError(normalized)) throw normalized;
        }
      },
    });
  }

  /**
   * 读取磁盘内容并写入五态；读取期间被内存编辑取代时丢弃磁盘结果。
   */
  async load(): Promise<void> {
    if (this.contentSignal().status === 'loading') {
      await waitUntil(() => this.contentSignal().status !== 'loading');
      return;
    }

    const version = this.mutationVersion;
    this.contentSignal({ status: 'loading' });
    try {
      const content = await this.fs.readFile(this.path, 'utf-8');
      if (version === this.mutationVersion) this.contentSignal({ status: 'loaded', value: content });
    } catch (error) {
      if (version !== this.mutationVersion) return;
      const normalized = error instanceof Error ? error : new Error(String(error));
      this.contentSignal(isFileNotFoundError(normalized) ? { status: 'not-found' } : { status: 'error', error: normalized });
    }
  }

  /**
   * 该处理器是否已结束加载（loaded / not-found / error）。
   */
  isLoaded(): boolean {
    return !['idle', 'loading'].includes(this.contentSignal().status);
  }
}
