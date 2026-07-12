import { effect, signal } from "alien-signals";

import type { ReadonlySignal } from "@/fs/interfaces";
import type { Content } from "@/fs/types";
import type { Fs } from "@/services/fs";
import { waitUntil } from "@/utils/base/signal";
import type { AssetDirectoryResourceLike, AssetDirectorySnapshot } from "./types";

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export class AssetDirectoryResource implements AssetDirectoryResourceLike {
  readonly id: string;
  readonly path: string;
  readonly content: ReadonlySignal<Content<AssetDirectorySnapshot>>;
  private readonly mutableContent: ReturnType<typeof signal<Content<AssetDirectorySnapshot>>>;
  private readonly fs: Fs;
  private revision = 0;

  constructor(path: string, fs: Fs) {
    this.path = path.endsWith("/") ? path : `${path}/`;
    this.id = `asset-directory:${this.path}`;
    this.fs = fs;
    this.mutableContent = signal<Content<AssetDirectorySnapshot>>({ status: "idle" });
    this.content = this.mutableContent as ReadonlySignal<Content<AssetDirectorySnapshot>>;
  }

  snapshot(): Content<AssetDirectorySnapshot> {
    return this.mutableContent();
  }

  subscribe(listener: (content: Content<AssetDirectorySnapshot>) => void): () => void {
    return effect(() => listener(this.mutableContent()));
  }

  async reload(): Promise<void> {
    if (this.mutableContent().status === "loading") {
      await this.waitForSettled();
      return;
    }
    this.mutableContent({ status: "loading" });
    try {
      const entries = (await this.fs.promises.readdir(this.path))
        .filter((entry) => typeof entry === "string")
        .map((entry) => entry.replace(/^\.\//, "").replace(this.path, ""))
        .filter((entry) => entry.length > 0 && !entry.includes("/"))
        .sort((left, right) => left.localeCompare(right));
      this.revision += 1;
      this.mutableContent({ status: "loaded", value: { entries, revision: this.revision } });
    } catch (error) {
      const normalized = toError(error);
      if (normalized.message.includes("not found")) this.mutableContent({ status: "not-found" });
      else this.mutableContent({ status: "error", error: normalized });
    }
  }

  async waitForSettled(): Promise<void> {
    await waitUntil(() => !["idle", "loading"].includes(this.mutableContent().status));
  }
}
