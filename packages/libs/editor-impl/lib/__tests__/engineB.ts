import { EngineDescription, ResourceDescriptor, ResourceDependencies } from '@motajs/editor-core';
import { IResourceView } from '../resources/interfaces';
import { FileResource } from '../resources/fileResource';
import { FileHandler } from '../resources/fileHandler';
import { JsonDataHandler } from '../resources/jsonDataHandler';
import { computedResource } from '../resources/combinators';
import { ContentUtils } from '../resources/contentUtils';

/**
 * 假「engine B」夹具（PORT-08 / D-11，仅测试）。
 *
 * 这是一份**非**魔塔的 `EngineDescription`：它只使用 `engineB.*` 逻辑 id，其中
 * `engineB.notes` 是**非文件**资源（用 `computedResource` 现场构造），机械地证明通用描述符
 * 不假定「内容来自文件」（D-04）。文件支撑的三个描述符用 core 的通用 `JsonDataHandler` 子类
 * `EngineBJsonDataHandler` 读取注入的 `FileHandlerManager`，证明 core 的通用处理器足够（PORT-05 边界）。
 *
 * 本文件刻意放在 `lib/__tests__/`：它随每一条 core 测试一起运行，却绝不进入生产源码，
 * 因此 `scripts/verify/coreEngineNeutral.js` 的引擎标识门禁（排除 `__tests__`）不会把它当作泄漏。
 */

/** `engineB.catalog` 的数据形状。 */
interface EngineBCatalog {
  readonly entries: readonly string[];
}

/** `engineB.index` 的数据形状。 */
interface EngineBIndex {
  readonly sections: readonly string[];
}

/** `engineB.chapter` 的数据形状。 */
interface EngineBChapter {
  readonly body: string;
}

/** `engineB.notes` 的数据形状：完全由 `engineB.catalog` 派生。 */
interface EngineBNotes {
  readonly summary: string;
}

/**
 * `EngineBJsonDataHandler` —— 夹具自有的极薄 `JsonDataHandler` 子类。
 *
 * 它不做任何引擎特有的解析：只是把 core 的通用处理器具名化，证明一个非魔塔引擎可以仅靠
 * `JsonDataHandler<T>` 完成内容解码（PORT-05 边界），无需任何引擎格式处理器进入 core。
 */
class EngineBJsonDataHandler<T> extends JsonDataHandler<T> {
  constructor(file: FileHandler, resourceName: string) {
    super(file, resourceName);
  }
}

/** engine B 的 IO 地址（不透明字符串，夹具自定）。 */
const ENGINE_B_CATALOG_ADDRESS = 'catalog.json';
const ENGINE_B_INDEX_ADDRESS = 'index.json';
const ENGINE_B_CHAPTER_ADDRESS = 'chapter.json';

/** 构造一个文件支撑描述符：`create(deps)` 用注入的文件层读取不透明地址。 */
function fileBackedDescriptor<T>(
  id: string,
  address: string,
  options: Pick<ResourceDescriptor<IResourceView<T>>, 'preload' | 'preloadDependsOn'> = {},
): ResourceDescriptor<IResourceView<T>> {
  return {
    id,
    ...options,
    create: (deps: ResourceDependencies): IResourceView<T> =>
      new FileResource<T>(id, address, (file) => new EngineBJsonDataHandler<T>(file, id), deps),
  };
}

/**
 * `engineB.notes` 描述符：**非文件**资源。
 *
 * 它从 `engineB.catalog` 派生内容（`computedResource`），自身不持有任何 IO 地址——这正是
 * 「描述符与来源无关」的机械证明（T-05-09）。
 */
function notesDescriptor(): ResourceDescriptor<IResourceView<EngineBNotes>> {
  return {
    id: 'engineB.notes',
    preload: 'lazy',
    preloadDependsOn: ['engineB.catalog'],
    create: (deps: ResourceDependencies): IResourceView<EngineBNotes> => {
      const catalog = new FileResource<EngineBCatalog>(
        'engineB.catalog',
        ENGINE_B_CATALOG_ADDRESS,
        (file) => new EngineBJsonDataHandler<EngineBCatalog>(file, 'engineB.catalog'),
        deps,
      );
      return computedResource<EngineBNotes>('engineB.notes', [catalog], () =>
        ContentUtils.map(catalog.snapshot(), (value) => ({
          summary: `catalog has ${value.entries.length} entries`,
        })),
      );
    },
  };
}

/**
 * `engineBDescription` —— 非魔塔引擎的完整描述，id 为 `engineB`。
 *
 * 声明顺序即 `resources` 顺序：`catalog`（eager）→ `index`（依赖 catalog）→ `notes`（非文件，
 * 依赖 catalog）→ `chapter`（依赖 index）。多级 `preloadDependsOn` 图供 `resolvePreloadOrder` 验证。
 */
export const engineBDescription: EngineDescription = {
  id: 'engineB',
  resources: [
    fileBackedDescriptor<EngineBCatalog>('engineB.catalog', ENGINE_B_CATALOG_ADDRESS, { preload: 'eager' }),
    fileBackedDescriptor<EngineBIndex>('engineB.index', ENGINE_B_INDEX_ADDRESS, {
      preloadDependsOn: ['engineB.catalog'],
    }),
    notesDescriptor(),
    fileBackedDescriptor<EngineBChapter>('engineB.chapter', ENGINE_B_CHAPTER_ADDRESS, {
      preloadDependsOn: ['engineB.index'],
    }),
  ],
};

/**
 * 把 `engineBDescription` 的各描述符**预绑定**到注入的 `ResourceDependencies`，返回等价描述。
 *
 * 测试可据此把 `MemoryFsPort` 支撑的 manager 一次性接入整份描述，再直接 `create()` 取视图；
 * 函数不持有任何模块级可变容器（D-10）。
 */
export function createEngineBDescription(deps: ResourceDependencies): EngineDescription {
  return {
    id: engineBDescription.id,
    resources: engineBDescription.resources.map((descriptor) => ({
      ...descriptor,
      create: () => descriptor.create(deps),
    })),
  };
}
