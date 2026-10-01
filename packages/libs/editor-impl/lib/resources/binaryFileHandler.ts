import { signal, effect } from 'alien-signals';
import { IFsPort } from '@motajs/editor-core';
import { waitUntil } from './waitUntil';
import { Content, IContentView, ReadonlySignal } from './types';
import { isFileNotFoundError } from './errors';

export class BinaryFileHandler implements IContentView<HTMLImageElement> {
  /** 五态内容信号（真实来源）。 */
  private _content: ReturnType<typeof signal<Content<HTMLImageElement>>>;

  /** 只读内容信号。 */
  readonly content: ReadonlySignal<Content<HTMLImageElement>>;

  /** 宿主文件读写能力。 */
  private fs: IFsPort;

  /** 本处理器绑定的路径。 */
  private path: string;

  constructor(path: string, fs: IFsPort) {
    this.path = path;
    this._content = signal<Content<HTMLImageElement>>({ status: 'idle' });
    this.content = this._content as ReadonlySignal<Content<HTMLImageElement>>;
    this.fs = fs;
  }

  //#region IContentView 接口

  getContent(): Content<HTMLImageElement> {
    return this._content();
  }

  subscribe(listener: (content: Content<HTMLImageElement>) => void): () => void {
    return effect(() => {
      listener(this._content());
    });
  }

  async refetch(): Promise<void> {
    await this.load();
  }

  async ensureLoaded(): Promise<void> {
    const status = this._content().status;
    if (status === 'idle') await this.load();
    else if (status === 'loading') await this.waitForSettled();
  }

  getPath(): string {
    return this.path;
  }

  //#endregion

  //#region 加载方法

  async load(): Promise<void> {
    if (this._content().status === 'loading') {
      await waitUntil(() => this._content().status !== 'loading');
      return;
    }

    this._content({ status: 'loading' });

    try {
      const buffer = await this.fs.readFileBinary(this.path);
      const blob = new Blob([buffer], { type: 'image/png' });
      const url = URL.createObjectURL(blob);

      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(`Failed to load image: ${this.path}`));
        img.src = url;
      });

      this._content({ status: 'loaded', value: img });
    } catch (err) {
      const error = err as Error;

      if (isFileNotFoundError(error)) {
        this._content({ status: 'not-found' });
      } else {
        this._content({ status: 'error', error });
      }
    }
  }

  waitForLoaded(): Promise<void> {
    return waitUntil(() => this._content().status === 'loaded');
  }

  waitForSettled(): Promise<void> {
    return waitUntil(() => {
      const status = this._content().status;
      return status !== 'loading' && status !== 'idle';
    });
  }

  isLoaded(): boolean {
    const status = this._content().status;
    return status !== 'idle' && status !== 'loading';
  }

  //#endregion
}
