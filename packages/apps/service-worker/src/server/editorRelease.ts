import type { EditorHostStatus, EditorReleaseIdentity, EditorUpdateState } from '@/idl';
import { ReleaseAssetCoordinator, type ReleaseAssetPriority } from './releaseAssetCoordinator';

const EDITOR_MANIFEST_SCHEMA_VERSION = 2;
const EDITOR_ENVIRONMENT_PROTOCOL_VERSION = 1;
const EDITOR_CHANNEL_SCHEMA_VERSION = 1;
const RELEASE_CACHE_PREFIX = 'motajs-editor-release:';
const META_CACHE_NAME = 'motajs-editor-meta';
const BLOB_CACHE_NAME = 'motajs-editor-blobs';
const CACHE_STATE_VERSION = 2;
const UPDATE_CHECK_INTERVAL = 10 * 60_000;

export interface EditorArtifactFile {
  path: string;
  size: number;
  sha256: string;
}

export interface EditorArtifactManifest {
  schemaVersion: 2;
  environmentProtocolVersion: 1;
  runtimeProtocolVersion: number;
  editorVersion: string;
  buildId: string;
  entrypoints: { editor: 'index.html'; runtime: 'runtime.html' };
  files: EditorArtifactFile[];
}

export interface EditorChannelPointer {
  schemaVersion: 1;
  buildId: string;
  previousBuildId?: string;
}

export interface ResolvedEditorRelease {
  manifest: EditorArtifactManifest;
  html: string;
  releaseRoot: URL;
  source: 'network' | 'validated-cache' | 'cache';
}

interface EditorStagingState {
  buildId: string;
  generation: number;
  completedFiles: number;
  totalFiles: number;
  completedBytes: number;
  totalBytes: number;
  error?: string;
}

interface EditorCacheState {
  schemaVersion: 2;
  launch?: string;
  candidate?: string;
  staging?: EditorStagingState;
  runningBuilds?: Record<string, string>;
  lastCheckedAt?: number;
}

interface LegacyEditorCacheState {
  current?: string;
  previous?: string;
}

export class EditorReleaseError extends Error {
  constructor(
    public readonly reason: Extract<EditorHostStatus, { status: 'unavailable' }>['reason'],
    message: string,
  ) {
    super(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function isSafeArtifactPath(value: string): boolean {
  if (!value || value.includes('\0') || value.includes('\\') || value.startsWith('/')) return false;
  return value.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

function isBuildId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function assertBuildId(value: unknown): asserts value is string {
  if (!isBuildId(value)) throw new EditorReleaseError('invalid-artifact', 'Editor buildId is invalid');
}

export function parseEditorChannel(value: unknown): EditorChannelPointer {
  if (!isRecord(value) || value.schemaVersion !== EDITOR_CHANNEL_SCHEMA_VERSION) {
    throw new EditorReleaseError('invalid-artifact', 'Unsupported Editor channel schema');
  }
  assertBuildId(value.buildId);
  if (value.previousBuildId !== undefined) assertBuildId(value.previousBuildId);
  return {
    schemaVersion: 1,
    buildId: value.buildId,
    ...(typeof value.previousBuildId === 'string' ? { previousBuildId: value.previousBuildId } : {}),
  };
}

export function parseEditorManifest(value: unknown): EditorArtifactManifest {
  if (!isRecord(value) || value.schemaVersion !== EDITOR_MANIFEST_SCHEMA_VERSION) {
    throw new EditorReleaseError('invalid-artifact', 'Unsupported Editor artifact schema');
  }
  if (value.environmentProtocolVersion !== EDITOR_ENVIRONMENT_PROTOCOL_VERSION) {
    throw new EditorReleaseError(
      'incompatible-environment',
      `Editor environment protocol ${String(value.environmentProtocolVersion)} is not supported`,
    );
  }
  assertBuildId(value.buildId);
  if (typeof value.editorVersion !== 'string' || !value.editorVersion) {
    throw new EditorReleaseError('invalid-artifact', 'Editor version is missing');
  }
  if (typeof value.runtimeProtocolVersion !== 'number' || !Number.isInteger(value.runtimeProtocolVersion)) {
    throw new EditorReleaseError('invalid-artifact', 'Editor runtime protocol is invalid');
  }
  if (
    !isRecord(value.entrypoints) ||
    value.entrypoints.editor !== 'index.html' ||
    value.entrypoints.runtime !== 'runtime.html'
  ) {
    throw new EditorReleaseError('invalid-artifact', 'Editor entrypoints are incompatible');
  }
  if (!Array.isArray(value.files) || value.files.length === 0) {
    throw new EditorReleaseError('invalid-artifact', 'Editor artifact file list is missing');
  }
  const paths = new Set<string>();
  const files = value.files.map((item): EditorArtifactFile => {
    if (!isRecord(item) || typeof item.path !== 'string' || !isSafeArtifactPath(item.path)) {
      throw new EditorReleaseError('invalid-artifact', 'Editor artifact contains an unsafe file path');
    }
    if (paths.has(item.path)) throw new EditorReleaseError('invalid-artifact', `Duplicate Editor file: ${item.path}`);
    paths.add(item.path);
    if (!Number.isSafeInteger(item.size) || (item.size as number) < 0) {
      throw new EditorReleaseError('invalid-artifact', `Invalid Editor file size: ${item.path}`);
    }
    if (typeof item.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(item.sha256)) {
      throw new EditorReleaseError('invalid-artifact', `Invalid Editor file hash: ${item.path}`);
    }
    return { path: item.path, size: item.size as number, sha256: item.sha256 };
  });
  for (const required of ['index.html', 'runtime.html']) {
    if (!paths.has(required))
      throw new EditorReleaseError('invalid-artifact', `Editor artifact is missing ${required}`);
  }
  return {
    schemaVersion: 2,
    environmentProtocolVersion: 1,
    runtimeProtocolVersion: value.runtimeProtocolVersion,
    editorVersion: value.editorVersion,
    buildId: value.buildId,
    entrypoints: { editor: 'index.html', runtime: 'runtime.html' },
    files,
  };
}

function staticRoot(scopeUrl: URL): URL {
  return new URL('static/editor/', new URL('./', scopeUrl));
}

function releaseRoot(scopeUrl: URL, buildId: string): URL {
  return new URL(`releases/${buildId}/`, staticRoot(scopeUrl));
}

function releaseCacheName(buildId: string): string {
  return `${RELEASE_CACHE_PREFIX}${buildId}`;
}

function stateUrl(scopeUrl: URL): URL {
  return new URL('.host-state', staticRoot(scopeUrl));
}

function blobUrl(scopeUrl: URL, file: EditorArtifactFile): URL {
  const extension = file.path.includes('.') ? file.path.slice(file.path.lastIndexOf('.') + 1).toLowerCase() : 'bin';
  return new URL(`.blobs/${file.sha256}.${extension}`, staticRoot(scopeUrl));
}

async function responseJson(response: Response, label: string): Promise<unknown> {
  if (!response.ok) {
    const reason = response.status === 404 ? 'not-installed' : 'offline';
    throw new EditorReleaseError(reason, `${label} returned HTTP ${response.status}`);
  }
  try {
    return await response.json();
  } catch (error) {
    throw new EditorReleaseError(
      'invalid-artifact',
      `${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function sha256(content: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', content);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

function normalizeState(value: unknown): EditorCacheState {
  if (isRecord(value) && value.schemaVersion === CACHE_STATE_VERSION) {
    const runningBuilds = isRecord(value.runningBuilds)
      ? Object.fromEntries(
          Object.entries(value.runningBuilds).filter((entry): entry is [string, string] => isBuildId(entry[1])),
        )
      : undefined;
    const staging =
      isRecord(value.staging) && isBuildId(value.staging.buildId)
        ? {
            buildId: value.staging.buildId,
            generation: typeof value.staging.generation === 'number' ? value.staging.generation : 0,
            completedFiles: typeof value.staging.completedFiles === 'number' ? value.staging.completedFiles : 0,
            totalFiles: typeof value.staging.totalFiles === 'number' ? value.staging.totalFiles : 0,
            completedBytes: typeof value.staging.completedBytes === 'number' ? value.staging.completedBytes : 0,
            totalBytes: typeof value.staging.totalBytes === 'number' ? value.staging.totalBytes : 0,
            ...(typeof value.staging.error === 'string' ? { error: value.staging.error } : {}),
          }
        : undefined;
    return {
      schemaVersion: 2,
      ...(isBuildId(value.launch) ? { launch: value.launch } : {}),
      ...(isBuildId(value.candidate) ? { candidate: value.candidate } : {}),
      ...(staging ? { staging } : {}),
      ...(runningBuilds && Object.keys(runningBuilds).length > 0 ? { runningBuilds } : {}),
      ...(typeof value.lastCheckedAt === 'number' ? { lastCheckedAt: value.lastCheckedAt } : {}),
    };
  }
  const legacy = isRecord(value) ? (value as LegacyEditorCacheState) : {};
  const launch = isBuildId(legacy.current) ? legacy.current : isBuildId(legacy.previous) ? legacy.previous : undefined;
  return { schemaVersion: 2, ...(launch ? { launch } : {}) };
}

export class EditorReleaseManager {
  private readonly coordinator = new ReleaseAssetCoordinator();
  private stateQueue: Promise<unknown> = Promise.resolve();
  private checkTask?: Promise<void>;
  private readonly stageTasks = new Map<string, Promise<void>>();

  constructor(private readonly scopeUrl: URL) {}

  private async readState(): Promise<EditorCacheState> {
    const cache = await caches.open(META_CACHE_NAME);
    const response = await cache.match(stateUrl(this.scopeUrl));
    if (!response) return { schemaVersion: 2 };
    try {
      return normalizeState(await response.json());
    } catch {
      return { schemaVersion: 2 };
    }
  }

  private async writeState(state: EditorCacheState): Promise<void> {
    const cache = await caches.open(META_CACHE_NAME);
    await cache.put(stateUrl(this.scopeUrl), Response.json(state));
  }

  private mutateState<T>(mutate: (state: EditorCacheState) => T | Promise<T>): Promise<T> {
    const task = this.stateQueue.then(async () => {
      const state = await this.readState();
      const result = await mutate(state);
      await this.writeState(state);
      return result;
    });
    this.stateQueue = task.catch(() => undefined);
    void task.then(
      () => this.broadcastState(),
      () => undefined,
    );
    return task;
  }

  private async fetchChannel(): Promise<EditorChannelPointer> {
    let response: Response;
    try {
      response = await fetch(new URL('current.json', staticRoot(this.scopeUrl)), { cache: 'no-cache' });
    } catch (error) {
      throw new EditorReleaseError('offline', `Cannot load Editor channel: ${errorMessage(error)}`);
    }
    return parseEditorChannel(await responseJson(response, 'Editor channel'));
  }

  private async acquireManifest(buildId: string, priority: ReleaseAssetPriority): Promise<EditorArtifactManifest> {
    const root = releaseRoot(this.scopeUrl, buildId);
    const request = new Request(new URL('editor-manifest.json', root));
    const cacheName = releaseCacheName(buildId);
    const load = async () => {
      const response = await this.coordinator.acquire({
        cacheName,
        request,
        priority,
        verify: async (bytes) => {
          const value = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
          const manifest = parseEditorManifest(value);
          if (manifest.buildId !== buildId) {
            throw new EditorReleaseError('invalid-artifact', 'Editor manifest buildId does not match its release');
          }
        },
      });
      const manifest = parseEditorManifest(await response.json());
      if (manifest.buildId !== buildId) {
        throw new EditorReleaseError('invalid-artifact', 'Editor manifest buildId does not match its release');
      }
      return manifest;
    };
    try {
      return await load();
    } catch (error) {
      const cache = await caches.open(cacheName);
      if (!(await cache.match(request))) throw error;
      await cache.delete(request);
      return await load();
    }
  }

  private async acquireFile(
    manifest: EditorArtifactManifest,
    file: EditorArtifactFile,
    priority: ReleaseAssetPriority,
  ): Promise<Response> {
    const request = new Request(new URL(file.path, releaseRoot(this.scopeUrl, manifest.buildId)));
    return await this.coordinator.acquire({
      cacheName: releaseCacheName(manifest.buildId),
      request,
      priority,
      shared: {
        cacheName: BLOB_CACHE_NAME,
        request: new Request(blobUrl(this.scopeUrl, file)),
      },
      verify: async (bytes) => {
        if (bytes.byteLength !== file.size) throw new Error(`${file.path} has an unexpected size`);
        if ((await sha256(bytes)) !== file.sha256) throw new Error(`${file.path} failed SHA-256 validation`);
      },
    });
  }

  private async matchCachedFile(buildId: string, file: EditorArtifactFile): Promise<Response | undefined> {
    const sharedCache = await caches.open(BLOB_CACHE_NAME);
    const sharedRequest = new Request(blobUrl(this.scopeUrl, file));
    const shared = await sharedCache.match(sharedRequest);
    if (shared) return shared;

    // Migrate files written by the pre-content-addressed release cache without
    // downloading them again.
    const releaseCache = await caches.open(releaseCacheName(buildId));
    const legacyRequest = new Request(new URL(file.path, releaseRoot(this.scopeUrl, buildId)));
    const legacy = await releaseCache.match(legacyRequest);
    if (!legacy) return undefined;
    await sharedCache.put(sharedRequest, legacy.clone());
    await releaseCache.delete(legacyRequest);
    return legacy;
  }

  private async loadCachedBuild(buildId: string, requireComplete = false): Promise<ResolvedEditorRelease | null> {
    if (!isBuildId(buildId)) return null;
    const cache = await caches.open(releaseCacheName(buildId));
    const root = releaseRoot(this.scopeUrl, buildId);
    const manifestResponse = await cache.match(new URL('editor-manifest.json', root));
    if (!manifestResponse) return null;
    try {
      const manifest = parseEditorManifest(await manifestResponse.json());
      if (manifest.buildId !== buildId) return null;
      const index = manifest.files.find((file) => file.path === manifest.entrypoints.editor);
      if (!index) return null;
      const htmlResponse = await this.matchCachedFile(buildId, index);
      if (!htmlResponse) return null;
      if (requireComplete) {
        const files = await Promise.all(manifest.files.map((file) => this.matchCachedFile(buildId, file)));
        if (files.some((file) => !file)) return null;
      }
      return { manifest, html: await htmlResponse.text(), releaseRoot: root, source: 'cache' };
    } catch {
      return null;
    }
  }

  private async prepareNetworkRelease(
    buildId: string,
    schedule?: (task: Promise<unknown>) => void,
  ): Promise<ResolvedEditorRelease> {
    const manifest = await this.acquireManifest(buildId, 'foreground');
    const generation = await this.beginStaging(manifest);
    const index = manifest.files.find((file) => file.path === manifest.entrypoints.editor)!;
    const html = await (await this.acquireFile(manifest, index, 'foreground')).text();
    const stage = this.stageRelease(manifest, generation);
    if (schedule) {
      schedule(stage.catch((error) => console.warn('Failed to cache complete Editor release', error)));
    } else void stage.catch((error) => console.warn('Failed to cache complete Editor release', error));
    return {
      manifest,
      html,
      releaseRoot: releaseRoot(this.scopeUrl, buildId),
      source: 'network',
    };
  }

  private async beginStaging(manifest: EditorArtifactManifest): Promise<number> {
    return await this.mutateState((state) => {
      if (state.staging?.buildId === manifest.buildId && !state.staging.error) return state.staging.generation;
      const generation = Math.max(Date.now(), (state.staging?.generation ?? 0) + 1);
      state.staging = {
        buildId: manifest.buildId,
        generation,
        completedFiles: 0,
        totalFiles: manifest.files.length,
        completedBytes: 0,
        totalBytes: manifest.files.reduce((sum, file) => sum + file.size, 0),
      };
      return generation;
    });
  }

  private stageRelease(manifest: EditorArtifactManifest, generation: number): Promise<void> {
    const existing = this.stageTasks.get(manifest.buildId);
    if (existing) return existing;
    let completedFiles = 0;
    let completedBytes = 0;
    const task = Promise.all(
      manifest.files.map(async (file) => {
        await this.acquireFile(manifest, file, 'background');
        completedFiles += 1;
        completedBytes += file.size;
        await this.mutateState((state) => {
          if (state.staging?.buildId !== manifest.buildId || state.staging.generation !== generation) return;
          state.staging.completedFiles = completedFiles;
          state.staging.completedBytes = completedBytes;
          delete state.staging.error;
        });
      }),
    )
      .then(async () => {
        await this.mutateState((state) => {
          if (state.staging?.buildId !== manifest.buildId || state.staging.generation !== generation) return;
          if (!state.launch) state.launch = manifest.buildId;
          else if (state.launch !== manifest.buildId) state.candidate = manifest.buildId;
          delete state.staging;
        });
        await this.cleanupCaches();
      })
      .catch(async (error) => {
        await this.mutateState((state) => {
          if (state.staging?.buildId !== manifest.buildId || state.staging.generation !== generation) return;
          state.staging.error = errorMessage(error);
        });
        throw error;
      })
      .finally(() => {
        if (this.stageTasks.get(manifest.buildId) === task) this.stageTasks.delete(manifest.buildId);
      });
    this.stageTasks.set(manifest.buildId, task);
    return task;
  }

  async checkForUpdates(force = false): Promise<void> {
    if (this.checkTask) return await this.checkTask;
    const state = await this.readState();
    if (!force && state.lastCheckedAt && Date.now() - state.lastCheckedAt < UPDATE_CHECK_INTERVAL) return;
    const task = (async () => {
      await this.mutateState((current) => {
        current.lastCheckedAt = Date.now();
      });
      const pointer = await this.fetchChannel();
      const current = await this.readState();
      if (pointer.buildId === current.launch || pointer.buildId === current.candidate) {
        if (pointer.buildId === current.launch && current.candidate && current.candidate !== pointer.buildId) {
          await this.mutateState((next) => {
            delete next.candidate;
          });
          await this.cleanupCaches();
        }
        return;
      }
      const manifest = await this.acquireManifest(pointer.buildId, 'background');
      const generation = await this.beginStaging(manifest);
      await this.stageRelease(manifest, generation);
    })();
    this.checkTask = task.finally(() => {
      this.checkTask = undefined;
    });
    return await this.checkTask;
  }

  async resolveForNavigation(
    clientId?: string,
    schedule?: (task: Promise<unknown>) => void,
  ): Promise<ResolvedEditorRelease> {
    let state = await this.readState();
    if (state.candidate) {
      const candidate = await this.loadCachedBuild(state.candidate, true);
      if (candidate) {
        const buildId = state.candidate;
        await this.mutateState((next) => {
          if (next.candidate !== buildId) return;
          next.launch = buildId;
          delete next.candidate;
        });
        await this.cleanupCaches();
        state = await this.readState();
      } else {
        await this.mutateState((next) => {
          if (next.candidate === state.candidate) delete next.candidate;
        });
        state = await this.readState();
      }
    }

    for (const buildId of [state.launch]) {
      if (!buildId) continue;
      const cached = await this.loadCachedBuild(buildId);
      if (!cached) continue;
      if (clientId) await this.recordRunningBuild(clientId, buildId);
      const maintenance = Promise.all([
        this.checkForUpdates().catch((error) => console.debug('Editor update check failed', error)),
        this.cleanupCaches(),
      ]);
      if (schedule) schedule(maintenance);
      else void maintenance;
      return cached;
    }

    const pointer = await this.fetchChannel();
    const release = await this.prepareNetworkRelease(pointer.buildId, schedule);
    if (clientId) await this.recordRunningBuild(clientId, release.manifest.buildId);
    return release;
  }

  async activateCandidate(buildId: string): Promise<void> {
    const state = await this.readState();
    if (state.launch === buildId) return;
    if (state.candidate !== buildId || !(await this.loadCachedBuild(buildId, true))) {
      throw new EditorReleaseError('invalid-artifact', 'The requested Editor candidate is not ready');
    }
    await this.mutateState((next) => {
      if (next.candidate !== buildId) {
        throw new EditorReleaseError('invalid-artifact', 'The Editor candidate changed before activation');
      }
      next.launch = buildId;
      delete next.candidate;
    });
    await this.cleanupCaches();
  }

  async recordRunningBuild(clientId: string, buildId: string): Promise<void> {
    if (!clientId || !isBuildId(buildId)) return;
    await this.mutateState((state) => {
      state.runningBuilds = { ...state.runningBuilds, [clientId]: buildId };
    });
  }

  private async activeClientIds(): Promise<Set<string> | undefined> {
    const container = (globalThis as { clients?: Clients }).clients;
    if (!container) return undefined;
    const active = await container.matchAll({ type: 'window', includeUncontrolled: true });
    return new Set(active.map((client) => client.id));
  }

  async cleanupCaches(): Promise<void> {
    const clientIds = await this.activeClientIds();
    const retained = await this.mutateState((state) => {
      if (clientIds && state.runningBuilds) {
        state.runningBuilds = Object.fromEntries(
          Object.entries(state.runningBuilds).filter(([clientId]) => clientIds.has(clientId)),
        );
        if (Object.keys(state.runningBuilds).length === 0) delete state.runningBuilds;
      }
      return new Set(
        [state.launch, state.candidate, state.staging?.buildId, ...Object.values(state.runningBuilds ?? {})].filter(
          (value): value is string => Boolean(value),
        ),
      );
    });
    const names = await caches.keys();
    await Promise.all(
      names
        .filter(
          (name) => name.startsWith(RELEASE_CACHE_PREFIX) && !retained.has(name.slice(RELEASE_CACHE_PREFIX.length)),
        )
        .map((name) => caches.delete(name)),
    );
    await this.cleanupBlobs(retained);
  }

  private async cleanupBlobs(retainedBuilds: ReadonlySet<string>): Promise<void> {
    const manifests = await Promise.all([...retainedBuilds].map((buildId) => this.acquireCachedManifest(buildId)));
    const referenced = new Set(
      manifests.flatMap((manifest) => manifest?.files.map((file) => blobUrl(this.scopeUrl, file).href) ?? []),
    );
    if (referenced.size === 0) {
      await caches.delete(BLOB_CACHE_NAME);
      return;
    }
    const cache = await caches.open(BLOB_CACHE_NAME);
    const requests = await cache.keys();
    await Promise.all(
      requests.filter((request) => !referenced.has(request.url)).map((request) => cache.delete(request)),
    );
  }

  private async identity(buildId: string | undefined): Promise<EditorReleaseIdentity | undefined> {
    if (!buildId) return undefined;
    const release = await this.loadCachedBuild(buildId);
    return release ? { buildId, version: release.manifest.editorVersion } : undefined;
  }

  async getUpdateState(): Promise<EditorUpdateState> {
    const state = await this.readState();
    const [launch, candidate, stagingManifest] = await Promise.all([
      this.identity(state.launch),
      this.identity(state.candidate),
      state.staging ? this.acquireCachedManifest(state.staging.buildId) : undefined,
    ]);
    return {
      protocolVersion: 2,
      status: 'ready',
      ...(launch ? { launch } : {}),
      ...(candidate ? { candidate } : {}),
      ...(state.staging
        ? {
            staging: {
              buildId: state.staging.buildId,
              ...(stagingManifest ? { version: stagingManifest.editorVersion } : {}),
              completedFiles: state.staging.completedFiles,
              totalFiles: state.staging.totalFiles,
              completedBytes: state.staging.completedBytes,
              totalBytes: state.staging.totalBytes,
              ...(state.staging.error ? { error: state.staging.error } : {}),
            },
          }
        : {}),
      ...(state.lastCheckedAt ? { lastCheckedAt: state.lastCheckedAt } : {}),
    };
  }

  private async acquireCachedManifest(buildId: string): Promise<EditorArtifactManifest | undefined> {
    const cache = await caches.open(releaseCacheName(buildId));
    const response = await cache.match(new URL('editor-manifest.json', releaseRoot(this.scopeUrl, buildId)));
    if (!response) return undefined;
    try {
      return parseEditorManifest(await response.json());
    } catch {
      return undefined;
    }
  }

  async serveAsset(request: Request): Promise<Response> {
    const pathname = new URL(request.url).pathname;
    const relative = pathname.slice(staticRoot(this.scopeUrl).pathname.length);
    const match = /^releases\/([a-f0-9]{64})\/(.+)$/.exec(relative);
    if (!match || !isSafeArtifactPath(match[2]!)) return fetch(request);
    const [buildId, path] = [match[1]!, match[2]!];
    try {
      const manifest = await this.acquireManifest(buildId, 'foreground');
      if (path === 'editor-manifest.json') {
        const cache = await caches.open(releaseCacheName(buildId));
        return (await cache.match(request)) ?? Response.json(manifest);
      }
      const file = manifest.files.find((candidate) => candidate.path === path);
      if (!file) {
        return new Response('Editor release does not contain this asset', {
          status: 404,
          headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
        });
      }
      return await this.acquireFile(manifest, file, 'foreground');
    } catch (error) {
      console.warn(`Failed to restore Editor release ${buildId} asset ${path}`, error);
      return new Response(
        'Editor cache is incomplete and the missing asset could not be restored. Reconnect and reload the Editor.',
        {
          status: 503,
          headers: {
            'content-type': 'text/plain; charset=utf-8',
            'cache-control': 'no-store',
            'x-motajs-editor-cache': 'repair-failed',
          },
        },
      );
    }
  }

  private async broadcastState(): Promise<void> {
    const container = (globalThis as { clients?: Clients }).clients;
    if (!container) return;
    const state = await this.getUpdateState();
    const active = await container.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of active) client.postMessage({ type: 'motajs-editor-release-state', state });
  }
}

const managers = new Map<string, EditorReleaseManager>();

export function getEditorReleaseManager(scopeUrl: URL): EditorReleaseManager {
  const key = new URL('./', scopeUrl).href;
  let manager = managers.get(key);
  if (!manager) {
    manager = new EditorReleaseManager(new URL(key));
    managers.set(key, manager);
  }
  return manager;
}

export function resetEditorReleaseManagersForTest(): void {
  managers.clear();
}

export async function resolveEditorRelease(
  scopeUrl: URL,
  schedule?: (task: Promise<unknown>) => void,
  clientId?: string,
): Promise<ResolvedEditorRelease> {
  return await getEditorReleaseManager(scopeUrl).resolveForNavigation(clientId, schedule);
}

export async function getEditorHostStatus(scopeUrl: URL): Promise<EditorHostStatus> {
  try {
    const release = await resolveEditorRelease(scopeUrl);
    return {
      status: 'ready',
      buildId: release.manifest.buildId,
      editorVersion: release.manifest.editorVersion,
      source: release.source,
    };
  } catch (error) {
    if (error instanceof EditorReleaseError) {
      return { status: 'unavailable', reason: error.reason, message: error.message };
    }
    return { status: 'unavailable', reason: 'offline', message: errorMessage(error) };
  }
}

export async function serveEditorReleaseAsset(request: Request, scopeUrl: URL): Promise<Response> {
  return await getEditorReleaseManager(scopeUrl).serveAsset(request);
}
