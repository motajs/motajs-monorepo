const FORBIDDEN_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

export function parseDataPath(path: string): string[] {
  if (path === '$' || path === '') return [];

  const normalized = path.startsWith('$.') ? path.slice(2) : path;
  const segments: string[] = [];
  const pattern = /(?:^|\.)([^.[\]]+)|\[(?:"([^"]+)"|'([^']+)'|(\d+))\]/g;
  let consumed = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(normalized))) {
    if (match.index !== consumed) throw new Error(`Invalid data path: ${path}`);
    const segment = match[1] ?? match[2] ?? match[3] ?? match[4];
    if (!segment || FORBIDDEN_SEGMENTS.has(segment)) {
      throw new Error(`Unsafe data path: ${path}`);
    }
    segments.push(segment);
    consumed = pattern.lastIndex;
  }

  if (consumed !== normalized.length) throw new Error(`Invalid data path: ${path}`);
  return segments;
}

export function getAtPath(value: unknown, path: string): unknown {
  let current = value;
  for (const segment of parseDataPath(path)) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

export function setAtPath(target: unknown, path: string, value: unknown): unknown {
  const segments = parseDataPath(path);
  if (segments.length === 0) return value;
  if (target === null || typeof target !== 'object') {
    throw new Error(`Cannot write ${path} into a primitive template`);
  }

  let current = target as Record<string, unknown>;
  for (let index = 0; index < segments.length - 1; index++) {
    const segment = segments[index];
    const next = segments[index + 1];
    const existing = current[segment];
    if (existing === null || typeof existing !== 'object') {
      current[segment] = /^\d+$/.test(next) ? [] : {};
    }
    current = current[segment] as Record<string, unknown>;
  }
  current[segments.at(-1)!] = value;
  return target;
}

export function deleteAtPath(target: unknown, path: string): void {
  const segments = parseDataPath(path);
  if (segments.length === 0 || target === null || typeof target !== 'object') return;
  let current = target as Record<string, unknown>;
  for (const segment of segments.slice(0, -1)) {
    const next = current[segment];
    if (next === null || typeof next !== 'object') return;
    current = next as Record<string, unknown>;
  }
  delete current[segments.at(-1)!];
}

export function cloneJson<T>(value: T): T {
  return value === undefined ? value : structuredClone(value);
}
