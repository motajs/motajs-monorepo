/**
 * mota 引擎适配器（D-02）。
 *
 * 把编辑器里硬编码的 mota 资源路径表达为 core 的 `ResourceDescriptor`；所有 IO 地址、变量名与
 * 引擎词都留在本适配器侧，core 永不见路径 / 模板 / 引擎词。本文件是**本期的死代码**：没有任何
 * 入口 import 它，编辑器的 project-data 聚合模块也未被改动，故 `@motajs/editor` 行为不变（D-01）。
 * Phase 11 的组合根才会把本适配器接线进编辑器数据通路。
 */
import { defineEngine, FileResource } from '@motajs/editor-core';
import type { EngineAdapter, ResourceDependencies } from '@motajs/editor-core';
import { TowerDataHandler } from '@/services/tower/TowerDataHandler';
import type { TowerData } from '@/services/tower';
import { MOTA_RESOURCE_ADDRESSES } from './motaResources';

/**
 * mota 适配器：`defineEngine` 校验后返回的冻结 `EngineAdapter`，引擎 id 为 `mota-js`。
 *
 * 本文件当前仅含一个 tracer 描述符（`mota.tower`），其余九个固定描述符在下一个任务补齐。
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
  ],
});
