import { decodeGameData2x } from '@motajs/file2x';

type TernEntry = Record<string, unknown>;

export interface TernRuntimeMember {
  name: string;
  kind: 'function' | 'array' | 'object' | 'string' | 'number' | 'boolean' | 'unknown';
  parameters?: string[];
}

export interface TernDeclarationAugmentation {
  core?: readonly TernRuntimeMember[];
  modules?: Readonly<Record<string, readonly TernRuntimeMember[]>>;
  catalogs?: Readonly<Record<string, readonly TernRuntimeMember[]>>;
  globals?: {
    hero?: readonly TernRuntimeMember[];
    flags?: readonly TernRuntimeMember[];
  };
  specials?: ReadonlyArray<{ id: number; name: string }>;
  projectFlags?: readonly string[];
}

function safeName(name: string): string {
  return name.replace(/[^A-Za-z0-9_$]/g, '_').replace(/^[^A-Za-z_$]/, '_$&');
}

function splitTopLevel(source: string, separator: string): string[] {
  const result: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (['(', '[', '{'].includes(char)) depth += 1;
    else if ([')', ']', '}'].includes(char)) depth -= 1;
    else if (char === separator && depth === 0) {
      result.push(source.slice(start, index));
      start = index + 1;
    }
  }
  result.push(source.slice(start));
  return result;
}

function functionType(source: string, aliases: ReadonlySet<string>): string | undefined {
  if (!source.startsWith('fn(')) return undefined;
  let depth = 0;
  let close = -1;
  for (let index = 2; index < source.length; index += 1) {
    if (source[index] === '(') depth += 1;
    else if (source[index] === ')' && --depth === 0) {
      close = index;
      break;
    }
  }
  if (close < 0) return '(...args: any[]) => any';
  const parameters = splitTopLevel(source.slice(3, close), ',')
    .filter((item) => item.trim())
    .map((item, index) => {
      const colon = item.indexOf(':');
      // Tern also accepts anonymous parameters such as `fn(string|CanvasRenderingContext2D)`.
      // Treat the whole item as its type instead of silently dropping it to any.
      if (colon < 0) return `arg${index}: ${ternType(item.trim(), aliases)}`;
      const rawName = item.slice(0, colon).trim();
      const optional = rawName.endsWith('?');
      const rest = rawName.startsWith('...');
      const name = safeName(rawName.replace(/^\.\.\./, '').replace(/\?$/, '') || `arg${index}`);
      const type = ternType(item.slice(colon + 1).trim(), aliases);
      return `${rest ? '...' : ''}${name}${optional ? '?' : ''}: ${rest ? `${type}[]` : type}`;
    });
  const arrow = source.slice(close + 1).match(/^\s*->\s*(.+)$/);
  return `(${parameters.join(', ')}) => ${arrow ? ternType(arrow[1], aliases) : 'void'}`;
}

function ternType(source: string, aliases: ReadonlySet<string>): string {
  const normalized = source.trim();
  const fn = functionType(normalized, aliases);
  if (fn) return fn;
  const union = splitTopLevel(normalized, '|');
  if (union.length > 1)
    return union
      .map((item) => {
        const type = ternType(item, aliases);
        return type.includes('=>') ? `(${type})` : type;
      })
      .join(' | ');
  if (normalized.startsWith('[') && normalized.endsWith(']')) {
    const item = normalized.slice(1, -1).trim();
    return item ? `Array<${ternType(item, aliases)}>` : 'any[]';
  }
  if (normalized.startsWith('{') && normalized.endsWith('}')) {
    const fields = splitTopLevel(normalized.slice(1, -1), ',').filter((item) => item.trim());
    return `{ ${fields
      .map((field, index) => {
        const colon = field.indexOf(':');
        if (colon < 0) return `${JSON.stringify(`field${index}`)}: any`;
        const rawName = field.slice(0, colon).trim();
        const optional = rawName.endsWith('?');
        const name = rawName.replace(/\?$/, '');
        return `${JSON.stringify(name)}${optional ? '?' : ''}: ${ternType(field.slice(colon + 1), aliases)}`;
      })
      .join('; ')} }`;
  }
  const bare = normalized.replace(/^\+/, '');
  if (['?', 'any', 'unknown'].includes(bare)) return 'any';
  if (bare === 'bool') return 'boolean';
  if (['number', 'string', 'boolean', 'void', 'null', 'undefined', 'never'].includes(bare)) return bare;
  if (aliases.has(bare)) return `__MotaTern_${safeName(bare)}`;
  // The template still uses the historical public name `heroStatus` for the
  // global shortcut, while the actual structure is stored as `!define.hero`.
  if (bare === 'heroStatus' && aliases.has('hero')) return '__MotaTern_hero';
  if (['CanvasRenderingContext2D', 'Storage'].includes(bare) || /^[A-Z][\w$]*$/.test(bare)) return bare;
  return 'any';
}

function doc(entry: TernEntry, indent: string): string {
  if (typeof entry['!doc'] !== 'string' || !entry['!doc'].trim()) return '';
  const lines = entry['!doc']
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/\*\//g, '* /')
    .split('\n');
  return `${indent}/** ${lines.map((line) => line.trim()).join(`\n${indent} * `)} */\n`;
}

function entryType(entry: unknown, aliases: ReadonlySet<string>, indent = ''): string {
  if (typeof entry === 'string') return ternType(entry, aliases);
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return 'any';
  const object = entry as TernEntry;
  const declared = typeof object['!type'] === 'string' ? ternType(object['!type'], aliases) : undefined;
  const properties = Object.entries(object).filter(([key]) => !key.startsWith('!') && key !== 'prototype');
  if (properties.length === 0) return declared ?? 'Record<string, any>';
  const nextIndent = `${indent}  `;
  const body = properties
    .map(([key, value]) => {
      const child = value && typeof value === 'object' && !Array.isArray(value) ? (value as TernEntry) : {};
      return `${doc(child, nextIndent)}${nextIndent}${JSON.stringify(key)}: ${entryType(value, aliases, nextIndent)};`;
    })
    .join('\n');
  const shape = `{\n${body}\n${indent}}`;
  return declared ? `${declared} & ${shape}` : shape;
}

function cloneEntry<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function objectAtPath(root: TernEntry, path: readonly string[]): TernEntry {
  let current = root;
  for (const segment of path) {
    const value = current[segment];
    if (!value || typeof value !== 'object' || Array.isArray(value)) current[segment] = {};
    current = current[segment] as TernEntry;
  }
  return current;
}

function runtimeMemberEntry(member: TernRuntimeMember, forcedType?: string): TernEntry {
  if (forcedType) return { '!type': forcedType };
  if (member.kind === 'function') {
    const parameters =
      member.parameters
        ?.map((name, index) => `${/^[A-Za-z_$][\w$]*$/.test(name) ? name : `arg${index}`}: ?`)
        .join(', ') ?? '...args: ?';
    return { '!type': `fn(${parameters}) -> ?` };
  }
  if (member.kind === 'array') return { '!type': '[?]' };
  if (['string', 'number', 'boolean'].includes(member.kind)) {
    return { '!type': member.kind === 'boolean' ? 'bool' : member.kind };
  }
  return {};
}

function catalogMemberType(path: string, member: TernRuntimeMember): string | undefined {
  if (path === 'material.enemys') return 'enemy';
  if (path === 'material.items') return 'item';
  if (path === 'material.animates') return 'animate';
  if (['material.bgms', 'material.sounds'].includes(path)) return 'audio';
  if (path === 'material.images' && member.kind !== 'object') return 'image';
  if (path.startsWith('material.images.')) return 'image';
  if (path === 'canvas') return 'CanvasRenderingContext2D';
  if (path === 'status.maps') return 'floor';
  if (['status.bgmaps', 'status.fgmaps'].includes(path)) return '[[number]]';
  if (path === 'values') return 'number';
  if (path === 'flags') return member.name === 'statusBarItems' ? '[string]' : 'bool';
  return undefined;
}

function applyMembers(
  target: TernEntry,
  members: readonly TernRuntimeMember[] | undefined,
  forcedType?: (member: TernRuntimeMember) => string | undefined,
): void {
  for (const member of members ?? []) {
    if (!member.name || member.name.startsWith('_')) continue;
    if (target[member.name] === undefined) {
      target[member.name] = runtimeMemberEntry(member, forcedType?.(member));
    }
  }
}

function applyAugmentation(
  core: TernEntry,
  definitions: TernEntry,
  augmentation: TernDeclarationAugmentation | undefined,
): void {
  if (!augmentation) return;
  applyMembers(core, augmentation.core);
  for (const [moduleName, members] of Object.entries(augmentation.modules ?? {})) {
    applyMembers(objectAtPath(core, [moduleName]), members);
  }
  for (const [path, members] of Object.entries(augmentation.catalogs ?? {})) {
    const segments = path.split('.');
    applyMembers(objectAtPath(core, segments), members, (member) => catalogMemberType(path, member));
    // `core.status.hero` is declared through the historical `hero` alias. Add
    // reflected nested members to both views so the global and core shortcut
    // keep the same completion surface.
    if (path === 'status.hero' || path.startsWith('status.hero.')) {
      applyMembers(objectAtPath(definitions, ['hero', ...segments.slice(2)]), members);
    }
  }
  applyMembers(objectAtPath(definitions, ['hero']), augmentation.globals?.hero);
  applyMembers(objectAtPath(definitions, ['flag']), augmentation.globals?.flags);
  const flags = objectAtPath(definitions, ['flag']);
  for (const name of augmentation.projectFlags ?? []) {
    if (name && flags[name] === undefined) flags[name] = {};
  }
  if (augmentation.specials?.length) {
    const hasSpecial = objectAtPath(core, ['enemys', 'hasSpecial']);
    const suffix = augmentation.specials.map(({ id, name }) => `${name}(${id})`).join('; ');
    hasSpecial['!doc'] = `${typeof hasSpecial['!doc'] === 'string' ? hasSpecial['!doc'] : ''}${suffix}`;
  }

  // The old editor exposes every module function through `core` as well. Do
  // this after runtime augmentation so plugin-added functions get the same
  // signature and parameter names as their module member.
  for (const [moduleName, moduleValue] of Object.entries(core)) {
    if (!moduleValue || typeof moduleValue !== 'object' || Array.isArray(moduleValue)) continue;
    for (const [name, value] of Object.entries(moduleValue as TernEntry)) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
      const type = (value as TernEntry)['!type'];
      if (typeof type !== 'string' || !type.startsWith('fn(')) continue;
      const forwarded = cloneEntry(value as TernEntry);
      if (typeof forwarded['!doc'] === 'string') {
        forwarded['!doc'] = `${forwarded['!doc']}<br/>（转发到${moduleName}中）`;
      }
      core[name] = forwarded;
    }
  }
}

export interface TernDeclarationResult {
  declaration: string;
  diagnostics: string[];
}

export function buildTernDeclaration(
  source: string,
  augmentation?: TernDeclarationAugmentation,
): TernDeclarationResult {
  const decoded = decodeGameData2x<unknown[]>(source).data;
  const decodedDefinition = decoded.find(
    (value) => value && typeof value === 'object' && (value as TernEntry)['!name'] === 'core',
  ) as TernEntry | undefined;
  if (!decodedDefinition || !decodedDefinition.core) throw new Error('Tern core definition is missing');
  const coreDefinition = cloneEntry(decodedDefinition);
  const definitions =
    coreDefinition['!define'] && typeof coreDefinition['!define'] === 'object'
      ? (coreDefinition['!define'] as TernEntry)
      : {};
  applyAugmentation(coreDefinition.core as TernEntry, definitions, augmentation);
  const aliases = new Set(Object.keys(definitions));
  const diagnostics: string[] = [];
  const safeAliases = new Map<string, string>();
  for (const name of aliases) {
    const safe = safeName(name);
    const previous = safeAliases.get(safe);
    if (previous && previous !== name) diagnostics.push(`类型名 ${previous} 与 ${name} 转换后冲突`);
    else safeAliases.set(safe, name);
  }
  const parts = Object.entries(definitions).map(([name, entry]) => {
    const open = ['hero', 'flag'].includes(name) ? ' & Record<string, any>' : '';
    return `type __MotaTern_${safeName(name)} = ${entryType(entry, aliases)}${open};`;
  });
  parts.push(`type __MotaTernCore = ${entryType(coreDefinition.core, aliases)} & Record<string, any>;`);
  if (augmentation?.specials?.length) {
    parts.push(`type MotaEnemySpecialId = ${augmentation.specials.map(({ id }) => id).join(' | ')};`);
  }
  parts.push('declare let core: __MotaTernCore;');
  for (const [name, entry] of Object.entries(coreDefinition)) {
    if (name.startsWith('!') || name === 'core') continue;
    const declarationKind = ['hero', 'flags'].includes(name) ? 'let' : 'const';
    parts.push(
      `${doc(entry as TernEntry, '')}declare ${declarationKind} ${safeName(name)}: ${entryType(entry, aliases)};`,
    );
  }
  return { declaration: parts.join('\n\n'), diagnostics };
}
