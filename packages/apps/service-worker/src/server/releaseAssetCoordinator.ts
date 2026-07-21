export type ReleaseAssetPriority = "foreground" | "background";

export interface ReleaseAssetVerification {
  (bytes: ArrayBuffer, response: Response): void | Promise<void>;
}

interface AcquireOptions {
  cacheName: string;
  request: Request;
  priority: ReleaseAssetPriority;
  verify?: ReleaseAssetVerification;
  shared?: {
    cacheName: string;
    request: Request;
  };
}

interface PendingAsset {
  key: string;
  priority: ReleaseAssetPriority;
  state: "queued" | "running";
  run: () => Promise<Response>;
  resolve: (response: Response) => void;
  reject: (error: unknown) => void;
  promise: Promise<Response>;
}

const responseFromBytes = (bytes: ArrayBuffer, response: Response): Response => new Response(bytes, {
  status: response.status,
  statusText: response.statusText,
  headers: response.headers,
});

/**
 * Coordinates foreground release requests and complete-offline downloads.
 * A release URL has one cache lookup, network request, verification and cache
 * write even when the page and the background installer ask for it together.
 */
export class ReleaseAssetCoordinator {
  private readonly entries = new Map<string, PendingAsset>();
  private readonly foregroundQueue: PendingAsset[] = [];
  private readonly backgroundQueue: PendingAsset[] = [];
  private active = 0;
  private activeBackground = 0;

  constructor(
    private readonly maxTotal = 4,
    private readonly maxBackground = 3,
  ) {}

  acquire({ cacheName, request, priority, verify, shared }: AcquireOptions): Promise<Response> {
    const key = shared
      ? `${shared.cacheName}\0${shared.request.url}`
      : `${cacheName}\0${request.url}`;
    const existing = this.entries.get(key);
    if (existing) {
      if (priority === "foreground" && existing.priority === "background" && existing.state === "queued") {
        existing.priority = "foreground";
        const index = this.backgroundQueue.indexOf(existing);
        if (index >= 0) this.backgroundQueue.splice(index, 1);
        this.foregroundQueue.push(existing);
        this.pump();
      }
      return this.cloneResponse(existing.promise);
    }

    let resolve!: (response: Response) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<Response>((onResolve, onReject) => {
      resolve = onResolve;
      reject = onReject;
    });
    const entry: PendingAsset = {
      key,
      priority,
      state: "queued",
      resolve,
      reject,
      promise,
      run: async () => {
        const cache = await caches.open(cacheName);
        const cached = await cache.match(request);
        if (cached) {
          if (shared) {
            const sharedCache = await caches.open(shared.cacheName);
            if (!await sharedCache.match(shared.request)) await sharedCache.put(shared.request, cached.clone());
            await cache.delete(request);
          }
          return cached;
        }

        if (shared) {
          const sharedCache = await caches.open(shared.cacheName);
          const sharedResponse = await sharedCache.match(shared.request);
          if (sharedResponse) return sharedResponse;
        }

        const response = await fetch(request, { cache: "no-store" });
        if (!response.ok) throw new Error(`${new URL(request.url).pathname} returned HTTP ${response.status}`);
        const bytes = await response.arrayBuffer();
        await verify?.(bytes, response);
        const verified = responseFromBytes(bytes, response);
        if (shared) {
          const sharedCache = await caches.open(shared.cacheName);
          await sharedCache.put(shared.request, verified.clone());
        } else await cache.put(request, verified.clone());
        return verified;
      },
    };
    this.entries.set(key, entry);
    (priority === "foreground" ? this.foregroundQueue : this.backgroundQueue).push(entry);
    this.pump();
    return this.cloneResponse(promise);
  }

  private async cloneResponse(promise: Promise<Response>): Promise<Response> {
    return (await promise).clone();
  }

  private pump(): void {
    while (this.active < this.maxTotal) {
      let entry = this.foregroundQueue.shift();
      if (!entry && this.activeBackground < this.maxBackground) entry = this.backgroundQueue.shift();
      if (!entry) return;
      entry.state = "running";
      this.active += 1;
      if (entry.priority === "background") this.activeBackground += 1;
      void entry.run().then(entry.resolve, entry.reject).finally(() => {
        this.entries.delete(entry.key);
        this.active -= 1;
        if (entry.priority === "background") this.activeBackground -= 1;
        this.pump();
      });
    }
  }
}
