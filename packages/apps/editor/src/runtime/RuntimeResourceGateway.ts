import { FileHandlerManager } from "@/fs/FileHandlerManager";
import type { IContentHandler } from "@/fs/interfaces";
import { projectAssets } from "@/project/assets";
import { projectData } from "@/project/data/projectData";
import type { DataResource } from "@/project/data/DataResource";
import type { Content } from "@/fs/types";
import type { ProjectResourceChange } from "./protocol";

export interface RuntimeTextResource { revision: number; text: string }
export interface RuntimeBinaryResource { revision: number; bytes: Uint8Array }

function floorId(path: string): string | null {
  return /^project\/floors\/(.+)\.js$/.exec(path)?.[1] ?? null;
}

function dataResource(path: string): DataResource<unknown> | null {
  const floor = floorId(path);
  if (floor) return projectData.floor(floor);
  const entries: Array<[string, () => DataResource<unknown>]> = [
    ["project/data.js", () => projectData.tower()],
    ["project/items.js", () => projectData.items()],
    ["project/enemys.js", () => projectData.enemys()],
    ["project/maps.js", () => projectData.mapBlocks()],
    ["project/icons.js", () => projectData.icons()],
    ["project/functions.js", () => projectData.functions()],
    ["project/plugins.js", () => projectData.plugins()],
    ["project/events.js", () => projectData.events()],
  ];
  return entries.find(([candidate]) => candidate === path)?.[1]() ?? null;
}

async function loadedRaw(resource: DataResource<unknown>): Promise<IContentHandler<string>> {
  const raw = resource.raw();
  const current = raw.getContent();
  if (current.status === "idle" || current.status === "loading") {
    await FileHandlerManager.load(resource.path);
    await resource.waitForSettled();
  }
  return raw;
}

export class RuntimeResourceGateway {
  private revision = 0;
  private readonly watched = new Map<string, () => void>();
  private onChange: ((change: ProjectResourceChange) => void) | null = null;

  setChangeListener(listener: ((change: ProjectResourceChange) => void) | null): void {
    this.onChange = listener;
  }

  dispose(): void {
    for (const unsubscribe of this.watched.values()) unsubscribe();
    this.watched.clear();
    this.onChange = null;
  }

  private kind(path: string): ProjectResourceChange["kind"] {
    if (path.includes("/floors/")) return "floor";
    if (path.includes("/animates/")) return "animation";
    if (path.includes("/bgms/") || path.includes("/sounds/")) return "audio";
    if (path.includes("/fonts/")) return "font";
    if (/\.js$/i.test(path)) return "data";
    return "image";
  }

  private watch(path: string, subscribe: (listener: (content: Content<unknown>) => void) => () => void): void {
    if (this.watched.has(path)) return;
    let baseline = true;
    const unsubscribe = subscribe((content) => {
      if (baseline) { baseline = false; return; }
      if (content.status === "loading" || content.status === "idle") return;
      this.onChange?.({
        revision: ++this.revision,
        path,
        state: content.status === "loaded" ? "loaded" : content.status === "not-found" ? "deleted" : "error",
        kind: this.kind(path),
      });
    });
    this.watched.set(path, unsubscribe);
  }

  async readText(path: string): Promise<RuntimeTextResource> {
    if (!path.startsWith("project/")) throw new Error(`Runtime resource denied: ${path}`);
    const resource = dataResource(path);
    if (resource) {
      this.watch(path, (listener) => resource.subscribe(listener));
      const raw = await loadedRaw(resource);
      const content = raw.getContent();
      if (content.status !== "loaded") throw new Error(`Runtime resource unavailable: ${path}`);
      return { revision: ++this.revision, text: content.value };
    }
    const binary = await this.readBinary(path);
    return { revision: binary.revision, text: new TextDecoder().decode(binary.bytes) };
  }

  async readBinary(path: string): Promise<RuntimeBinaryResource> {
    if (!path.startsWith("project/")) throw new Error(`Runtime resource denied: ${path}`);
    const resource = projectAssets.image(path);
    this.watch(path, (listener) => resource.subscribe(listener));
    const current = resource.snapshot();
    if (current.status === "idle" || current.status === "loading") {
      await resource.reload();
      await resource.waitForSettled();
    }
    const content = resource.snapshot();
    if (content.status !== "loaded") throw new Error(`Runtime resource unavailable: ${path}`);
    return { revision: content.value.revision, bytes: new Uint8Array(content.value.bytes) };
  }
}
