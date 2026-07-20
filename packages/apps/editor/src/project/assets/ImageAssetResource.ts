import { effect, signal } from "alien-signals";
import { ContentUtils } from "@/fs/ContentUtils";
import { persistenceMonitor } from "@/fs/PersistenceMonitor";
import type { ReadonlySignal } from "@/fs/interfaces";
import type { Content } from "@/fs/types";
import type { PersistStatus } from "@/project/data/DataResource";
import { fs as defaultFs, type Fs } from "@/services/fs";
import { waitUntil } from "@/utils/base/signal";
import type { ImageAssetResourceLike, ImageAssetSnapshot } from "./types";
import { isFileNotFoundError } from "@/fs/errors";

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
  private readonly mutableContent = signal<Content<ImageAssetSnapshot>>({ status: "idle" });
  private readonly fs: Fs;
  private revision = 0;
  private mutationVersion = 0;

  constructor(path: string, fs: Fs = defaultFs) {
    this.id = `image:${path}`;
    this.path = path;
    this.fs = fs;
    this.content = this.mutableContent as ReadonlySignal<Content<ImageAssetSnapshot>>;
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
    const version = this.mutationVersion;
    this.mutableContent({ status: "loading" });
    try {
      const bytes = new Uint8Array(await this.fs.promises.readFileBinary(this.path));
      if (version !== this.mutationVersion) return;
      this.revision += 1;
      this.mutableContent({ status: "loaded", value: { bytes, revision: this.revision } });
    } catch (error) {
      if (version !== this.mutationVersion) return;
      const normalized = toError(error);
      this.mutableContent(isFileNotFoundError(normalized)
        ? { status: "not-found" }
        : { status: "error", error: normalized });
    }
  }

  async ensureLoaded(): Promise<void> {
    const content = this.mutableContent();
    if (content.status === "idle") await this.reload();
    else if (content.status === "loading") await this.waitForSettled();
  }

  async waitForSettled(): Promise<void> {
    await waitUntil(() => !["idle", "loading"].includes(this.mutableContent().status));
  }

  persistStatus(): PersistStatus {
    const status = persistenceMonitor.statusFor(this.path);
    if (status === "persisting") return { status: "persisting" };
    if (status === "error") return { status: "error", error: persistenceMonitor.errorFor(this.path) ?? new Error("Persist failed") };
    return { status: "idle" };
  }

  setBytes(bytes: Uint8Array): void {
    const current = this.mutableContent();
    if (current.status === "error") {
      throw new Error(`Cannot update image ${this.path}: current status is ${current.status}`);
    }
    const immutableBytes = new Uint8Array(bytes);
    const encoded = encodeBase64(immutableBytes);
    this.mutationVersion += 1;
    this.revision += 1;
    this.mutableContent({
      status: "loaded",
      value: { bytes: immutableBytes, revision: this.revision },
    });
    const path = this.path;
    const fs = this.fs;
    persistenceMonitor.schedule(path, {
      kind: "write",
      execute: () => fs.promises.writeFile(path, encoded, "base64"),
    });
  }

  async delete(): Promise<void> {
    this.mutationVersion += 1;
    this.revision += 1;
    this.mutableContent({ status: "not-found" });
    const path = this.path;
    const fs = this.fs;
    persistenceMonitor.schedule(path, {
      kind: "delete",
      execute: async () => {
        try {
          await fs.promises.deleteFile(path);
        } catch (error) {
          const normalized = toError(error);
          if (!isFileNotFoundError(normalized)) throw normalized;
        }
      },
    });
  }
}
