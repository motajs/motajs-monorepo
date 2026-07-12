import { produce } from "immer";
import { computed } from "alien-signals";
import type { Content } from "@/fs/types";
import type {
  IContentHandler,
  IDataHandler,
  ReadonlySignal,
  RecoverableResource,
} from "@/fs/interfaces";
import { ContentUtils } from "@/fs/ContentUtils";
import { applyActions, type Action } from "@/utils/action";

export type PersistStatus =
  | { status: "idle" }
  | { status: "persisting"; pending?: number }
  | { status: "error"; error: Error; pending?: number }
  | { status: "unknown" };

export interface DataResource<T> extends RecoverableResource<T> {
  readonly id: string;
  readonly path: string;

  snapshot(): Content<T>;
  value(): T;
  raw(): IContentHandler<string>;
  reload(): Promise<void>;
  set(next: T): Promise<void>;
  mutate(recipe: (draft: T) => void): Promise<void>;
  patch(actions: Action[]): Promise<void>;
  persistStatus(): PersistStatus;
}

export class HandlerDataResource<T> implements DataResource<T> {
  readonly content: ReadonlySignal<Content<T>>;
  readonly id: string;
  readonly path: string;
  private readonly handler: IDataHandler<T>;

  constructor(
    id: string,
    path: string,
    handler: IDataHandler<T>,
  ) {
    this.id = id;
    this.path = path;
    this.handler = handler;
    this.content = handler.content;
  }

  getContent(): Content<T> {
    return this.handler.getContent();
  }

  snapshot(): Content<T> {
    return this.getContent();
  }

  value(): T {
    return ContentUtils.unwrap(this.getContent(), this.id);
  }

  subscribe(listener: (content: Content<T>) => void): () => void {
    return this.handler.subscribe(listener);
  }

  async refetch(): Promise<void> {
    await this.handler.refetch();
  }

  async reload(): Promise<void> {
    await this.refetch();
  }

  getPath(): string {
    return this.path;
  }

  raw(): IContentHandler<string> {
    return this.handler.getFileHandler() as IContentHandler<string>;
  }

  recoverable(): RecoverableResource<T> {
    return this;
  }

  async waitForIdle(): Promise<void> {
    await this.handler.waitForIdle();
  }

  async waitForLoaded(): Promise<void> {
    await this.handler.waitForLoaded();
  }

  async waitForSettled(): Promise<void> {
    await this.handler.waitForSettled();
  }

  async set(next: T): Promise<void> {
    await Promise.resolve(this.handler.update(next));
  }

  update(value: T): void;
  update(transform: (current: T) => T): void;
  update(transform: (current: T) => Promise<T>): Promise<void>;
  update(valueOrTransform: T | ((current: T) => T | Promise<T>)): void | Promise<void> {
    if (typeof valueOrTransform === "function") {
      const transform = valueOrTransform as (current: T) => T | Promise<T>;
      return this.handler.update((current) => Promise.resolve(transform(current)));
    }
    return this.handler.update(valueOrTransform);
  }

  async mutate(recipe: (draft: T) => void): Promise<void> {
    await Promise.resolve(
      this.handler.update((current) =>
        produce(current, (draft) => {
          recipe(draft as T);
        }),
      ),
    );
  }

  async patch(actions: Action[]): Promise<void> {
    if (actions.length === 0) return;
    await this.mutate((draft) => {
      applyActions(draft as Record<string, unknown>, actions);
    });
  }

  persistStatus(): PersistStatus {
    const raw = this.raw() as IContentHandler<string> & {
      persistExecutor?: { status?: ReadonlySignal<{ status: string; error?: Error; pending?: number }> };
    };
    const status = raw.persistExecutor?.status?.();
    if (!status) return { status: "unknown" };
    if (status.status === "executing") {
      return { status: "persisting", pending: status.pending };
    }
    if (status.status === "error") {
      return { status: "error", error: status.error ?? new Error("Persist failed"), pending: status.pending };
    }
    return { status: "idle" };
  }
}

export class MappedDataResource<TParent, TChild> implements DataResource<TChild> {
  readonly content: ReadonlySignal<Content<TChild>>;
  readonly id: string;
  readonly path: string;
  private readonly parent: DataResource<TParent>;
  private readonly read: (parent: TParent) => TChild;
  private readonly write: (parent: TParent, child: TChild) => TParent;
  private readonly patchActions?: (actions: Action[]) => Action[];

  constructor(
    id: string,
    path: string,
    parent: DataResource<TParent>,
    read: (parent: TParent) => TChild,
    write: (parent: TParent, child: TChild) => TParent,
    patchActions?: (actions: Action[]) => Action[],
  ) {
    this.id = id;
    this.path = path;
    this.parent = parent;
    this.read = read;
    this.write = write;
    this.patchActions = patchActions;
    this.content = computed(() =>
      ContentUtils.map(this.parent.content(), (value) => this.read(value)),
    );
  }

  getContent(): Content<TChild> {
    return this.content();
  }

  snapshot(): Content<TChild> {
    return this.getContent();
  }

  value(): TChild {
    return ContentUtils.unwrap(this.getContent(), this.id);
  }

  subscribe(listener: (content: Content<TChild>) => void): () => void {
    return this.parent.subscribe(() => {
      listener(this.getContent());
    });
  }

  async refetch(): Promise<void> {
    await this.parent.refetch();
  }

  async reload(): Promise<void> {
    await this.parent.reload();
  }

  getPath(): string {
    return this.path;
  }

  raw(): IContentHandler<string> {
    return this.parent.raw();
  }

  recoverable(): RecoverableResource<TChild> {
    return this;
  }

  async waitForIdle(): Promise<void> {
    await this.parent.waitForIdle();
  }

  async waitForLoaded(): Promise<void> {
    await this.parent.waitForLoaded();
  }

  async waitForSettled(): Promise<void> {
    await this.parent.waitForSettled();
  }

  async set(next: TChild): Promise<void> {
    await this.parent.update((parent) => this.write(parent, next));
  }

  update(value: TChild): void;
  update(transform: (current: TChild) => TChild): void;
  update(transform: (current: TChild) => Promise<TChild>): Promise<void>;
  update(
    valueOrTransform: TChild | ((current: TChild) => TChild | Promise<TChild>),
  ): void | Promise<void> {
    if (typeof valueOrTransform !== "function") {
      void this.set(valueOrTransform);
      return;
    }

    const transform = valueOrTransform as (current: TChild) => TChild | Promise<TChild>;
    const current = this.value();
    const result = transform(current);
    if (result instanceof Promise) {
      return result.then((next) => this.set(next));
    }
    void this.set(result);
  }

  async mutate(recipe: (draft: TChild) => void): Promise<void> {
    await this.update((current) =>
      produce(current, (draft) => {
        recipe(draft as TChild);
      }),
    );
  }

  async patch(actions: Action[]): Promise<void> {
    if (actions.length === 0) return;
    if (this.patchActions) {
      await this.parent.patch(this.patchActions(actions));
      return;
    }
    await this.mutate((draft) => {
      applyActions(draft as Record<string, unknown>, actions);
    });
  }

  persistStatus(): PersistStatus {
    return this.parent.persistStatus();
  }
}
