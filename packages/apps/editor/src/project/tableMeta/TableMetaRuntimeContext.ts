export interface TableMetaRuntimeContext {
  editor: {
    mode: {
      checkFloorIds(value: unknown): boolean;
      checkImages(value: unknown, directory?: string): boolean;
      checkUnique(value: unknown): boolean;
    };
    core: {
      material: {
        images: Record<string, Record<string, unknown>>;
      };
    };
  };
  core: {
    material: {
      images: Record<string, Record<string, unknown>>;
    };
    subarray<T>(current: T[], previous: T[]): T[] | null;
  };
  main: Record<string, unknown>;
  data: {
    main: {
      floorIds: string[];
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  functions: {
    enemys: {
      getSpecials(): unknown[];
    };
    [key: string]: unknown;
  };
  confirm(message: string): boolean;
}

export interface TableMetaRuntimeContextOptions {
  data?: Record<string, unknown>;
  images?: Record<string, string[]>;
  specials?: Array<[string | number, string]>;
  confirm?: (message: string) => boolean;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function checkUnique(value: unknown): boolean {
  if (value == null) return true;
  if (!Array.isArray(value)) return false;
  return new Set(value).size === value.length;
}

function subarray<T>(current: T[], previous: T[]): T[] | null {
  if (current.length < previous.length) return null;
  for (let index = 0; index < previous.length; index += 1) {
    if (current[index] !== previous[index]) return null;
  }
  return current.slice(previous.length);
}

function createFallbackFunctions(specials: Array<[string | number, string]>): TableMetaRuntimeContext['functions'] {
  return {
    enemys: {
      getSpecials: () => specials.map(([id, name]) => [id, name]),
    },
  };
}

export function createTableMetaRuntimeContext(options: TableMetaRuntimeContextOptions = {}): TableMetaRuntimeContext {
  const imageGroups: Record<string, string[]> = {
    images: [],
    tilesets: [],
    animates: [],
    bgms: [],
    sounds: [],
    fonts: [],
    ...(options.images ?? {}),
  };
  const materialImages = Object.fromEntries(
    Object.entries(imageGroups).map(([key, names]) => [key, Object.fromEntries(names.map((name) => [name, {}]))]),
  );
  const data = options.data ?? {};
  const dataMain = data.main && typeof data.main === 'object' ? (data.main as Record<string, unknown>) : {};
  const floorIds = isStringArray(dataMain.floorIds) ? dataMain.floorIds : [];
  const normalizeDirectory = (directory?: string) =>
    directory
      ?.replace(/^\.\//, '')
      .replace(/^project\//, '')
      .replace(/\/$/, '')
      .split('/')
      .at(-1);
  const checkImages = (value: unknown, directory?: string): boolean => {
    if (value == null) return true;
    if (!isStringArray(value)) return false;
    const group = normalizeDirectory(directory);
    const available = group ? imageGroups[group] : undefined;
    return !available || value.every((name) => available.includes(name));
  };
  const checkFloorIds = (value: unknown): boolean =>
    isStringArray(value) &&
    value.length > 0 &&
    new Set(value).size === value.length &&
    (floorIds.length === 0 || value.every((id) => floorIds.includes(id)));
  const coreMaterial = { images: materialImages };

  const context: TableMetaRuntimeContext = {
    editor: {
      mode: {
        checkFloorIds,
        checkImages,
        checkUnique,
      },
      core: {
        material: coreMaterial,
      },
    },
    core: {
      material: coreMaterial,
      subarray,
    },
    main: {},
    data: {
      ...data,
      main: {
        ...dataMain,
        floorIds,
      },
    },
    functions: createFallbackFunctions(options.specials ?? []),
    confirm:
      options.confirm ??
      ((message) => {
        if (typeof window === 'undefined' || typeof window.confirm !== 'function') return true;
        return window.confirm(message);
      }),
  };
  return context;
}
