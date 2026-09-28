/**
 * mota 引擎适配器（D-02）。
 *
 * 把编辑器里 10 条硬编码的 mota 资源路径表达为 core 的 `ResourceDescriptor`；所有 IO 地址、变量名与
 * 引擎词都留在本适配器侧，core 永不见路径 / 模板 / 引擎词。本文件是**本期的死代码**：没有任何
 * 入口 import 它，编辑器的 project-data 聚合模块也未被改动，故 `@motajs/editor` 行为不变（D-01）。
 * Phase 11 的组合根才会把本适配器接线进编辑器数据通路。
 *
 * 归属（仅注释，不做搬迁）：
 * - `@/fs/Json2xDataHandler` 与 `@/services/` 下各 `xxxDataHandler` 子类在概念上归适配器所有
 *   （PORT-05）；core 只保留通用的 `JsonDataHandler`。本期**不**把任何 handler 物理搬进 core（D-01）。
 * - 引擎格式迁移（`packages/apps/editor/src/project/migrations/airwallMigration.ts`）留在
 *   适配器侧原地不动，core 不 import 也不引用它（PORT-07 / D-10）。
 *
 * 本期**未**加入的资源（遵守锁定的 10 条计数，记录以免被误认为遗漏）：
 * - 五条 table-meta 路径与派生的 `commonEvents` 资源（`MappedDataResource`）不在本期
 *   `motaEngine.resources` 内；它们是适配器的后续工作，分别由 Phase 7（table 能力）/
 *   Phase 11（组合根切换）负责。
 * - 参数化的楼层族也不作为静态条目（见 `motaFloor.ts`，D-07）。
 */
import { defineEngine, FileResource, JsonDataHandler } from '@motajs/editor-core';
import type { EngineAdapter, ResourceDependencies } from '@motajs/editor-core';
import { Json2xDataHandler } from '@/fs/Json2xDataHandler';
import { TowerDataHandler } from '@/services/tower/TowerDataHandler';
import type { TowerData } from '@/services/tower';
import { ItemsDataHandler } from '@/services/item';
import type { ItemsData } from '@/services/item';
import { EnemysDataHandler } from '@/services/enemy';
import type { EnemysData } from '@/services/enemy';
import { MapsBlocksDataHandler } from '@/services/mapBlock';
import type { MapsBlocksData } from '@/services/mapBlock';
import { IconsDataHandler } from '@/services/icons';
import type { IconsData } from '@/services/icons';
import { FunctionsDataHandler } from '@/services/functions/FunctionsDataHandler';
import type { FunctionsData } from '@/services/functions';
import { PluginsDataHandler } from '@/services/plugins/PluginsDataHandler';
import type { PluginsData } from '@/services/plugins';
import type { EditorConfig } from '@/services/editorConfig/editorConfigService';
import { MOTA_RESOURCE_ADDRESSES } from './motaResources';
import type { EventsData } from './motaResources';

/**
 * mota 适配器：`defineEngine` 校验后返回的冻结 `EngineAdapter`，引擎 id 为 `mota-js`。
 *
 * 九个固定描述符——八条 `project/*.js` 路径 + 编辑器配置 `_server/config.json`；每条的
 * `create(deps)` 都用 core 的 `FileResource` 搭配原始编辑器里的领域 handler，惰性构造（D-05）。
 * 楼层族由 `motaFloorDescriptor(floorId)` 在适配器侧解析参数后产生具体描述符（D-07）。
 */
export const motaEngine: EngineAdapter = defineEngine({
  id: 'mota-js',
  resources: [
    {
      id: 'mota.tower',
      preload: 'eager',
      create: (deps: ResourceDependencies) =>
        new FileResource<TowerData>(
          'mota.tower',
          MOTA_RESOURCE_ADDRESSES.tower,
          (file) => new TowerDataHandler(file),
          deps,
        ),
    },
    {
      id: 'mota.items',
      preload: 'eager',
      create: (deps: ResourceDependencies) =>
        new FileResource<ItemsData>(
          'mota.items',
          MOTA_RESOURCE_ADDRESSES.items,
          (file) => new ItemsDataHandler(file),
          deps,
        ),
    },
    {
      id: 'mota.enemys',
      preload: 'eager',
      create: (deps: ResourceDependencies) =>
        new FileResource<EnemysData>(
          'mota.enemys',
          MOTA_RESOURCE_ADDRESSES.enemys,
          (file) => new EnemysDataHandler(file),
          deps,
        ),
    },
    {
      id: 'mota.maps',
      preload: 'eager',
      create: (deps: ResourceDependencies) =>
        new FileResource<MapsBlocksData>(
          'mota.maps',
          MOTA_RESOURCE_ADDRESSES.maps,
          (file) => new MapsBlocksDataHandler(file),
          deps,
        ),
    },
    {
      id: 'mota.icons',
      preload: 'eager',
      create: (deps: ResourceDependencies) =>
        new FileResource<IconsData>(
          'mota.icons',
          MOTA_RESOURCE_ADDRESSES.icons,
          (file) => new IconsDataHandler(file),
          deps,
        ),
    },
    {
      id: 'mota.functions',
      preload: 'eager',
      create: (deps: ResourceDependencies) =>
        new FileResource<FunctionsData>(
          'mota.functions',
          MOTA_RESOURCE_ADDRESSES.functions,
          (file) => new FunctionsDataHandler(file),
          deps,
        ),
    },
    {
      id: 'mota.plugins',
      preload: 'eager',
      create: (deps: ResourceDependencies) =>
        new FileResource<PluginsData>(
          'mota.plugins',
          MOTA_RESOURCE_ADDRESSES.plugins,
          (file) => new PluginsDataHandler(file),
          deps,
        ),
    },
    {
      id: 'mota.events',
      preload: 'eager',
      create: (deps: ResourceDependencies) =>
        new FileResource<EventsData>(
          'mota.events',
          MOTA_RESOURCE_ADDRESSES.events,
          (file) => new Json2xDataHandler<EventsData>(file, MOTA_RESOURCE_ADDRESSES.eventsVarName, 'Events Data'),
          deps,
        ),
    },
    {
      id: 'mota.editorConfig',
      preload: 'lazy',
      create: (deps: ResourceDependencies) =>
        new FileResource<EditorConfig>(
          'mota.editorConfig',
          MOTA_RESOURCE_ADDRESSES.editorConfig,
          (file) => new JsonDataHandler<EditorConfig>(file, 'Editor Config'),
          deps,
        ),
    },
  ],
});
