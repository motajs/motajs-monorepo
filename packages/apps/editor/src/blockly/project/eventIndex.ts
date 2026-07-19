import { projectData } from '@/project/data/projectData';
import type { DataResource } from '@/project/data/DataResource';
import { blockRegistry } from '../registry';

export interface ProjectEventSample {
  source: string;
  path: string;
  event: Record<string, unknown>;
}

export interface ProjectEventIndexFailure {
  source: string;
  path: string;
  error: Error;
}

export interface ProjectEventIndexResult {
  samples: ProjectEventSample[];
  failures: ProjectEventIndexFailure[];
  scannedSources: number;
}

export interface ProjectEventIndexOptions {
  signal?: AbortSignal;
  requireUnknown?: boolean;
  onProgress?: (completed: number, total: number, source: string) => void;
}

function abortIfNeeded(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('事件样本扫描已取消', 'AbortError');
}

function segment(key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)
    ? `.${key}`
    : `[${JSON.stringify(key)}]`;
}

function collectFromValue(
  value: unknown,
  type: string,
  source: string,
  path: string,
  output: ProjectEventSample[],
  seen: WeakSet<object>,
  signal?: AbortSignal,
): void {
  abortIfNeeded(signal);
  if (!value || typeof value !== 'object') return;
  if (seen.has(value)) return;
  seen.add(value);
  if (!Array.isArray(value) && (value as Record<string, unknown>).type === type) {
    output.push({ source, path, event: structuredClone(value as Record<string, unknown>) });
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectFromValue(item, type, source, `${path}[${index}]`, output, seen, signal));
  } else {
    Object.entries(value as Record<string, unknown>).forEach(([key, item]) => (
      collectFromValue(item, type, source, `${path}${segment(key)}`, output, seen, signal)
    ));
  }
}

/** Pure traversal used by the index and by schema tooling previews. */
export function collectEventSamplesInValue(
  value: unknown,
  type: string,
  source = 'value',
  signal?: AbortSignal,
): ProjectEventSample[] {
  const output: ProjectEventSample[] = [];
  collectFromValue(value, type, source, '$', output, new WeakSet(), signal);
  return output;
}

async function loadResource<T>(
  resource: DataResource<T>,
): Promise<T> {
  await resource.ensureLoaded();
  const snapshot = resource.snapshot();
  if (snapshot.status === 'loaded') return snapshot.value;
  if (snapshot.status === 'error') throw snapshot.error;
  throw new Error(`${resource.path} 无法从 ${snapshot.status} 状态读取`);
}

export async function collectProjectEventSamples(
  type: string,
  options: ProjectEventIndexOptions = {},
): Promise<ProjectEventIndexResult> {
  if (!type.trim()) throw new Error('事件 type 不能为空');
  if (options.requireUnknown && blockRegistry.hasEventType(type)) {
    throw new Error(`事件 ${type} 已经存在块定义`);
  }
  abortIfNeeded(options.signal);
  const samples: ProjectEventSample[] = [];
  const failures: ProjectEventIndexFailure[] = [];
  const towerResource = projectData.tower();
  let tower: Awaited<ReturnType<typeof loadResource<typeof towerResource extends DataResource<infer T> ? T : never>>> | undefined;
  try {
    tower = await loadResource(towerResource);
  } catch (cause) {
    failures.push({ source: 'tower', path: towerResource.path, error: cause instanceof Error ? cause : new Error(String(cause)) });
  }

  const resources: Array<{ source: string; resource: DataResource<unknown> }> = [
    { source: 'items', resource: projectData.items() },
    { source: 'enemys', resource: projectData.enemys() },
    { source: 'mapBlocks', resource: projectData.mapBlocks() },
    { source: 'commonEvents', resource: projectData.commonEvents() },
  ];
  const floorIds = tower && Array.isArray(tower.main?.floorIds)
    ? tower.main.floorIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : [];
  floorIds.forEach((id) => resources.push({ source: `floor:${id}`, resource: projectData.floor(id) }));
  const total = resources.length + (tower ? 1 : 0);
  let completed = 0;
  if (tower) {
    samples.push(...collectEventSamplesInValue(tower, type, 'tower', options.signal));
    completed += 1;
    options.onProgress?.(completed, total, 'tower');
  }
  for (const { source, resource } of resources) {
    abortIfNeeded(options.signal);
    try {
      const value = await loadResource(resource);
      samples.push(...collectEventSamplesInValue(value, type, source, options.signal));
    } catch (cause) {
      failures.push({ source, path: resource.path, error: cause instanceof Error ? cause : new Error(String(cause)) });
    }
    completed += 1;
    options.onProgress?.(completed, total, source);
  }
  const unique = new Map(samples.map((sample) => [`${sample.source}:${sample.path}`, sample]));
  return { samples: [...unique.values()], failures, scannedSources: completed };
}

export async function collectUnknownEventSamples(
  type: string,
  options: Omit<ProjectEventIndexOptions, 'requireUnknown'> = {},
): Promise<ProjectEventSample[]> {
  const result = await collectProjectEventSamples(type, { ...options, requireUnknown: true });
  if (result.failures.length) {
    throw new AggregateError(result.failures.map((item) => item.error), '部分工程事件来源读取失败');
  }
  return result.samples;
}
