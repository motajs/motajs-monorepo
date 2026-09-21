import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ load: vi.fn(), replace: vi.fn() }));

vi.mock('@motajs/react-monaco-editor', () => ({
  MonacoLanguageLibraryScope: class {
    replace = mocks.replace;
    dispose = vi.fn();
  },
  setMonacoTheme: vi.fn(),
}));

vi.mock('@/runtime/RuntimeContext', () => ({ useRuntimePreview: vi.fn() }));
vi.mock('@/stores/EditorStore', () => ({ EditorStore: { useStore: vi.fn() } }));
vi.mock('@/fs/FileHandlerManager', () => ({ FileHandlerManager: { load: mocks.load } }));
vi.mock('@/project/data/projectData', () => ({
  projectData: {
    items: () => ({ snapshot: () => ({ status: 'loaded', value: {} }), subscribe: vi.fn(() => vi.fn()) }),
    enemys: () => ({ snapshot: () => ({ status: 'loaded', value: {} }), subscribe: vi.fn(() => vi.fn()) }),
    tower: () => ({ snapshot: () => ({ status: 'loaded', value: { main: {} } }), subscribe: vi.fn(() => vi.fn()) }),
    functions: () => ({ subscribe: vi.fn(() => vi.fn()) }),
    plugins: () => ({ subscribe: vi.fn(() => vi.fn()) }),
  },
}));
vi.mock('@/project/model/projectModel', () => ({
  projectModel: {
    flagUsage: () => ({
      ensureLoaded: vi.fn(async () => undefined),
      snapshot: () => ({ status: 'loaded', value: { flags: ['projectFlag'], usages: {} } }),
      subscribe: vi.fn(() => vi.fn()),
    }),
  },
}));

import type { RuntimePreviewCapability } from '@/runtime/RuntimeContext';

import {
  buildRuntimeCompatibilityDeclaration,
  composeCoreDeclaration,
  ProjectLanguageEnvironment,
} from '../projectLanguageEnvironment';

describe('project language environment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('augments runtime.d.ts instead of replacing its formal core type', () => {
    expect(composeCoreDeclaration('interface core {}\ndeclare let core: core;', ['__MotaTernCore'])).toContain(
      'declare let core: core & __MotaTernCore;',
    );
  });

  it('augments the project main global when runtime.d.ts declares it', () => {
    expect(
      composeCoreDeclaration('type main = {};\ndeclare let main: main;\ndeclare let core: core;', [
        'MotaRuntimeCompatibility',
      ]),
    ).toContain('declare let main: main & MotaMainRuntimeCompatibility;');
  });

  it('adds editor-only corrections without modifying runtime.d.ts', () => {
    const declaration = buildRuntimeCompatibilityDeclaration();
    expect(declaration).toContain('core: typeof core');
    expect(declaration).toContain('hero: typeof hero');
    expect(declaration).toContain('flags: typeof flags');
    expect(declaration).toContain('Sprite: any');
    expect(declaration).toContain('selectColor: string | number[]');
    expect(declaration).toContain('declare function parseInt(value: number');
    expect(declaration).toContain('declare const editor: any');
    expect(declaration).toContain('plugins_bb40132b_638b_4a9f_b028_d3fe47acc8d1');
  });

  it('makes defs declarations usable before optional runtime reflection finishes', async () => {
    let resolveSnapshot!: (value: Awaited<ReturnType<RuntimePreviewCapability['languageSnapshot']>>) => void;
    const snapshot = new Promise<Awaited<ReturnType<RuntimePreviewCapability['languageSnapshot']>>>((resolve) => {
      resolveSnapshot = resolve;
    });
    mocks.load.mockImplementation(async (path: string) => {
      if (path === 'runtime.d.ts') throw new Error('runtime.d.ts must not load when defs is valid');
      return {
        getContent: () => ({
          status: 'loaded',
          value: `var defs = [{
            "!name": "core",
            "!define": { "hero": {}, "flag": {} },
            "core": { "getFlag": "fn(name: string) -> ?" },
            "hero": { "!type": "heroStatus" },
            "flags": { "!type": "flag" }
          }];`,
        }),
      };
    });
    const environment = new ProjectLanguageEnvironment();
    const states: string[] = [];
    environment.subscribe((status) => states.push(status.state));
    const refresh = environment.refresh({
      state: { status: 'ready', instanceId: 1 },
      languageSnapshot: () => snapshot,
    } as unknown as RuntimePreviewCapability);

    await vi.waitFor(() => expect(states.at(-1)).toBe('ready'));
    expect(mocks.load).not.toHaveBeenCalledWith('runtime.d.ts');

    resolveSnapshot({ core: [], modules: {}, catalogs: {}, globals: { hero: [], flags: [] }, specials: [] });
    await refresh;
    expect(states.at(-1)).toBe('ready');
    const latest = mocks.replace.mock.calls.at(-1)?.[0] as Array<{ path: string; content: string }>;
    expect(latest.find(({ path }) => path.includes('tern-compatibility'))?.content).toContain('"projectFlag"');
    environment.dispose();
  });

  it('loads runtime.d.ts only when defs.js cannot be decoded', async () => {
    mocks.load.mockImplementation(async (path: string) => {
      if (path === '_server/CodeMirror/defs.js') throw new Error('broken defs');
      return { getContent: () => ({ status: 'loaded', value: 'interface core {}\ndeclare let core: core;' }) };
    });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const environment = new ProjectLanguageEnvironment();
    await environment.refresh({ state: { status: 'starting', instanceId: 1 } } as RuntimePreviewCapability);

    expect(mocks.load).toHaveBeenCalledWith('runtime.d.ts');
    const latest = mocks.replace.mock.calls.at(-1)?.[0] as Array<{ path: string; content: string }>;
    expect(latest.some(({ path }) => path.includes('runtime-fallback'))).toBe(true);
    environment.dispose();
  });
});
