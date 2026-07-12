/**
 * BinaryFileHandler - 二进制文件处理器
 *
 * 用于加载图片文件，返回 HTMLImageElement
 * 只读，不支持写入
 */

import { signal, effect } from "alien-signals";
import { fs as defaultFs, type Fs } from "@/services/fs";
import { waitUntil } from "@/utils/base/signal";
import type { Content } from "./types";
import type { IContentView, ReadonlySignal } from "./interfaces";

export class BinaryFileHandler implements IContentView<HTMLImageElement> {
  private _content: ReturnType<typeof signal<Content<HTMLImageElement>>>;
  readonly content: ReadonlySignal<Content<HTMLImageElement>>;
  private fs: Fs;
  private path: string;

  constructor(path: string, fs?: Fs) {
    this.path = path;
    this._content = signal<Content<HTMLImageElement>>({ status: "idle" });
    this.content = this._content as ReadonlySignal<Content<HTMLImageElement>>;
    this.fs = fs || defaultFs;
  }

  // ==================== IContentView 接口 ====================

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

  getPath(): string {
    return this.path;
  }

  // ==================== 加载方法 ====================

  async load(): Promise<void> {
    if (this._content().status === "loading") {
      await waitUntil(() => this._content().status !== "loading");
      return;
    }

    this._content({ status: "loading" });

    try {
      const buffer = await this.fs.promises.readFileBinary(this.path);
      const blob = new Blob([buffer], { type: "image/png" });
      const url = URL.createObjectURL(blob);

      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(`Failed to load image: ${this.path}`));
        img.src = url;
      });

      this._content({ status: "loaded", value: img });
    } catch (err) {
      const error = err as Error;

      if (error.message && error.message.includes("not found")) {
        this._content({ status: "not-found" });
      } else {
        this._content({ status: "error", error });
      }
    }
  }

  /**
   * 等待图片加载完成
   */
  waitForLoaded(): Promise<void> {
    return waitUntil(() => this._content().status === "loaded");
  }

  /**
   * 等待状态 settled
   */
  waitForSettled(): Promise<void> {
    return waitUntil(() => {
      const status = this._content().status;
      return status !== "loading" && status !== "idle";
    });
  }

  /**
   * 检查是否已加载
   */
  isLoaded(): boolean {
    const status = this._content().status;
    return status !== "idle" && status !== "loading";
  }
}
