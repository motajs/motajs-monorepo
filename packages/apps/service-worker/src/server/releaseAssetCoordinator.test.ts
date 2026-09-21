import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReleaseAssetCoordinator } from './releaseAssetCoordinator';

class MemoryCache {
  private readonly values = new Map<string, Response>();
  writes = 0;

  async match(input: RequestInfo | URL): Promise<Response | undefined> {
    const key = input instanceof Request ? input.url : String(input);
    return this.values.get(key)?.clone();
  }

  async put(input: RequestInfo | URL, response: Response): Promise<void> {
    const key = input instanceof Request ? input.url : String(input);
    this.writes += 1;
    this.values.set(key, response.clone());
  }

  async delete(input: RequestInfo | URL): Promise<boolean> {
    const key = input instanceof Request ? input.url : String(input);
    return this.values.delete(key);
  }
}

describe('ReleaseAssetCoordinator', () => {
  let cachesByName: Map<string, MemoryCache>;

  beforeEach(() => {
    vi.unstubAllGlobals();
    cachesByName = new Map();
    vi.stubGlobal('caches', {
      open: vi.fn(async (name: string) => {
        let cache = cachesByName.get(name);
        if (!cache) {
          cache = new MemoryCache();
          cachesByName.set(name, cache);
        }
        return cache;
      }),
    });
  });

  it('shares one fetch, verification and cache write between page and offline download', async () => {
    const fetchMock = vi.fn(async () => new Response('shared'));
    const verify = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const coordinator = new ReleaseAssetCoordinator();
    const request = new Request('https://example.test/release/shared.js');

    const background = coordinator.acquire({ cacheName: 'release', request, priority: 'background', verify });
    const foreground = coordinator.acquire({ cacheName: 'release', request, priority: 'foreground', verify });
    expect(await (await background).text()).toBe('shared');
    expect(await (await foreground).text()).toBe('shared');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(verify).toHaveBeenCalledTimes(1);
    expect(cachesByName.get('release')?.writes).toBe(1);
  });

  it('reuses one content-addressed blob across editor releases', async () => {
    const fetchMock = vi.fn(async () => new Response('same-monaco-worker'));
    const verify = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const coordinator = new ReleaseAssetCoordinator();
    const shared = {
      cacheName: 'editor-blobs',
      request: new Request('https://example.test/static/editor/.blobs/deadbeef.js'),
    };

    const first = await coordinator.acquire({
      cacheName: 'release-a',
      request: new Request('https://example.test/releases/a/monaco.js'),
      priority: 'background',
      verify,
      shared,
    });
    expect(await first.text()).toBe('same-monaco-worker');

    const second = await coordinator.acquire({
      cacheName: 'release-b',
      request: new Request('https://example.test/releases/b/monaco.js'),
      priority: 'foreground',
      verify,
      shared,
    });

    expect(await second.text()).toBe('same-monaco-worker');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(verify).toHaveBeenCalledTimes(1);
    expect(cachesByName.get('editor-blobs')?.writes).toBe(1);
    expect(cachesByName.get('release-a')?.writes ?? 0).toBe(0);
    expect(cachesByName.get('release-b')?.writes ?? 0).toBe(0);
  });

  it('reserves the fourth transfer slot for a foreground request', async () => {
    const releases: Array<() => void> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      await new Promise<void>((resolve) => releases.push(resolve));
      return new Response(String(input instanceof Request ? input.url : input));
    });
    vi.stubGlobal('fetch', fetchMock);
    const coordinator = new ReleaseAssetCoordinator(4, 3);
    const acquire = (name: string, priority: 'foreground' | 'background') =>
      coordinator.acquire({
        cacheName: 'release',
        request: new Request(`https://example.test/release/${name}`),
        priority,
      });

    const background = [acquire('a', 'background'), acquire('b', 'background'), acquire('c', 'background')];
    const queued = acquire('d', 'background');
    await Promise.resolve();
    const foreground = acquire('page', 'foreground');
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    expect(fetchMock.mock.calls.map(([input]) => (input as Request).url)).toContain(
      'https://example.test/release/page',
    );
    expect(fetchMock.mock.calls.map(([input]) => (input as Request).url)).not.toContain(
      'https://example.test/release/d',
    );

    releases.splice(0).forEach((release) => release());
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5));
    releases.splice(0).forEach((release) => release());
    await Promise.all([...background, queued, foreground]);
  });
});
