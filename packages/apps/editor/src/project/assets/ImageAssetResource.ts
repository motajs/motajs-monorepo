import { effect, signal } from "alien-signals";
import { ContentUtils } from "@/fs/ContentUtils";
import { persistenceMonitor } from "@/fs/PersistenceMonitor";
import type { ReadonlySignal } from "@/fs/interfaces";
import type { Content } from "@/fs/types";
import type { PersistStatus } from "@/project/data/DataResource";
import { fs as defaultFs, type Fs } from "@/services/fs";
import { waitUntil } from "@/utils/base/signal";
import type { ImageAssetResourceLike, ImageAssetSnapshot } from "./types";

function encodeBase64(bytes: Uint8Array): string {
  const nodeBuffer = (globalThis as { Buffer?: { from: (input: Uint8Array) => { toString: (encoding: string) => string } } }).Buffer;
  if (nodeBuffer) return nodeBuffer.from(bytes).toString("base64");
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export class ImageAssetResource implements ImageAssetResourceLike {
  readonly id: string;
  readonly path: string;
  readonly content: ReadonlySignal<Content<ImageAssetSnapshot>>;
  private readonly mutableContent: ReturnType<typeof signal<Content<ImageAssetSnapshot>>>;
  private readonly fs: Fs;
  private readonly persistExecutor;
  private revision = 0;

  constructor(path: string, fs: Fs = defaultFs) {
    this.id = `image:${path}`;
    this.path = path;
    this.fs = fs;
    this.mutableContent = signal<Content<ImageAssetSnapshot>>({ status: "idle" });
    this.content = this.mutableContent as ReadonlySignal<Content<ImageAssetSnapshot>>;
    this.persistExecutor = persistenceMonitor.createExecutor(path, () => this.persist());
  }

  snapshot(): Content<ImageAssetSnapshot> {
    return this.mutableContent();
  }

  value(): ImageAssetSnapshot {
    return ContentUtils.unwrap(this.snapshot(), this.id);
  }

  subscribe(listener: (content: Content<ImageAssetSnapshot>) => void): () => void {
    return effect(() => listener(this.mutableContent()));
  }

  async reload(): Promise<void> {
    if (this.mutableContent().status === "loading") {
      await this.waitForSettled();
      return;
    }
    this.mutableContent({ status: "loading" });
    try {
      const bytes = new Uint8Array(await this.fs.promises.readFileBinary(this.path));
      this.revision += 1;
      this.mutableContent({ status: "loaded", value: { bytes, revision: this.revision } });
    } catch (error) {
      const normalized = toError(error);
      if (normalized.message.includes("not found")) this.mutableContent({ status: "not-found" });
      else this.mutableContent({ status: "error", error: normalized });
    }
  }

  async waitForSettled(): Promise<void> {
    await waitUntil(() => !["idle", "loading"].includes(this.mutableContent().status));
  }

  async waitForIdle(): Promise<void> {
    await this.persistExecutor.waitForIdle();
  }

  persistStatus(): PersistStatus {
    const status = this.persistExecutor.status();
    if (status.status === "executing") return { status: "persisting", pending: status.pending };
    if (status.status === "error") return { status: "error", error: status.error, pending: status.pending };
    return { status: "idle" };
  }

  setBytes(bytes: Uint8Array): void {
    const current = this.mutableContent();
    if (current.status === "loading" || current.status === "error") {
      throw new Error(`Cannot update image ${this.path}: current status is ${current.status}`);
    }
    if (this.persistExecutor.isDeletionPending()) {
      throw new Error(`Cannot update image ${this.path}: deletion pending`);
    }
    this.revision += 1;
    this.mutableContent({
      status: "loaded",
      value: { bytes: new Uint8Array(bytes), revision: this.revision },
    });
    this.persistExecutor.exec();
  }

  async delete(): Promise<void> {
    this.persistExecutor.markDeletionPending();
    await this.waitForIdle();
    try {
      await this.fs.promises.deleteFile(this.path);
    } catch (error) {
      const normalized = toError(error);
      if (!normalized.message.includes("not found")) throw normalized;
    }
    this.revision += 1;
    this.mutableContent({ status: "not-found" });
  }

  private async persist(): Promise<void> {
    const current = this.mutableContent();
    if (current.status !== "loaded") return;
    await this.fs.promises.writeFile(this.path, encodeBase64(current.value.bytes), "base64");
  }
}
