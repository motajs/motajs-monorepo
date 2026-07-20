/** Text file state: memory first, persistence scheduled by normalized path. */

import { effect, signal } from "alien-signals";
import { fs as defaultFs, type Fs } from "@/services/fs";
import { waitUntil } from "@/utils/base/signal";
import type { Content } from "./types";
import type { IContentHandler, ReadonlySignal } from "./interfaces";
import { persistenceMonitor } from "./PersistenceMonitor";
import { isFileNotFoundError } from "./errors";

export class FileHandler implements IContentHandler<string> {
  private _content = signal<Content<string>>({ status: "idle" });
  readonly content = this._content as ReadonlySignal<Content<string>>;
  private readonly fs: Fs;
  private readonly path: string;
  private mutationVersion = 0;

  constructor(path: string, fs: Fs = defaultFs) {
    this.path = path;
    this.fs = fs;
  }

  getContent(): Content<string> {
    return this._content();
  }

  subscribe(listener: (content: Content<string>) => void): () => void {
    return effect(() => listener(this._content()));
  }

  async refetch(): Promise<void> {
    await this.load();
  }

  getPath(): string {
    return this.path;
  }

  update(value: string): void;
  update(transform: (current: string) => string): void;
  update(transform: (current: string) => Promise<string>): Promise<void>;
  update(valueOrTransform: string | ((current: string) => string | Promise<string>)): void | Promise<void> {
    if (typeof valueOrTransform === "string") {
      this.commit(valueOrTransform);
      return;
    }

    const current = this._content();
    if (current.status !== "loaded") {
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

  private commit(value: string): void {
    this.mutationVersion += 1;
    this._content({ status: "loaded", value });
    const path = this.path;
    const fs = this.fs;
    persistenceMonitor.schedule(path, {
      kind: "write",
      execute: () => fs.promises.writeFile(path, value, "utf-8"),
    });
  }

  waitForLoaded(): Promise<void> {
    return waitUntil(() => this._content().status === "loaded");
  }

  waitForSettled(): Promise<void> {
    return waitUntil(() => !["idle", "loading"].includes(this._content().status));
  }

  hasPendingWrites(): boolean {
    return persistenceMonitor.statusFor(this.path) === "persisting";
  }

  async delete(_force: boolean = true): Promise<void> {
    void _force;
    this.mutationVersion += 1;
    this._content({ status: "not-found" });
    const path = this.path;
    const fs = this.fs;
    persistenceMonitor.schedule(path, {
      kind: "delete",
      execute: async () => {
        try {
          await fs.promises.deleteFile(path);
        } catch (error) {
          const normalized = error instanceof Error ? error : new Error(String(error));
          if (!isFileNotFoundError(normalized)) throw normalized;
        }
      },
    });
  }

  async load(): Promise<void> {
    if (this._content().status === "loading") {
      await waitUntil(() => this._content().status !== "loading");
      return;
    }

    const version = this.mutationVersion;
    this._content({ status: "loading" });
    try {
      const content = await this.fs.promises.readFile(this.path, "utf-8");
      if (version === this.mutationVersion) this._content({ status: "loaded", value: content });
    } catch (error) {
      if (version !== this.mutationVersion) return;
      const normalized = error instanceof Error ? error : new Error(String(error));
      this._content(isFileNotFoundError(normalized)
        ? { status: "not-found" }
        : { status: "error", error: normalized });
    }
  }

  isLoaded(): boolean {
    return !["idle", "loading"].includes(this._content().status);
  }
}
