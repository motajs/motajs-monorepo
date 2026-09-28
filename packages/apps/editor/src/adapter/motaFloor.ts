/**
 * 参数化的楼层描述符工厂（D-07）。
 *
 * 楼层族**刻意不作为** `motaEngine.resources` 的静态条目：通用描述符不含参数模板（D-04），
 * 参数在此处被解析为具体的 IO 地址与具体的逻辑 id，core 永不见模板。真实 `floorId` 可能不满足
 * 共享逻辑 id 语法（每段以字母 / `_` / `$` 开头，仅含字母数字 / `_` / `$`，以点分隔，见
 * `resourceRegistry.ts` 的 `LOGICAL_ID_PATTERN`）——此处用共享谓词 `isValidResourceId` 断言，
 * 失败即抛 `MotaFloorIdError`，**不擅自放宽**注册表语法。
 *
 * id 语法风险：真实楼层 id 可能含非 word 字符，选择「sanitize / 编码 id」还是「放宽语法」是可逆
 * 决策，被显式推迟到 Phase 11 / 用户决定，而不是在这里被默认做出（RESEARCH Open Question 1）。
 */
import { FileResource, isValidResourceId } from '@motajs/editor-core';
import type { ResourceDependencies, ResourceDescriptor } from '@motajs/editor-core';
import { FloorDataHandler } from '@/services/floor/FloorDataHandler';
import type { FloorData } from '@/types';
import { motaFloorAddress } from './motaResources';

/** 楼层逻辑 id 的固定前缀；具体 id 为 `mota.floor.<floorId>`。 */
const FLOOR_LOGICAL_ID_PREFIX = 'mota.floor.';

/**
 * `motaFloorDescriptor` 在由 `floorId` 推导出的逻辑 id 违反共享语法时抛出。
 *
 * 消息同时点名推导出的 id 与语法要求，便于定位是哪个真实楼层 id 触发了适配器侧的边界。
 */
export class MotaFloorIdError extends Error {
  constructor(floorId: string) {
    super(
      `楼层逻辑 id「${FLOOR_LOGICAL_ID_PREFIX}${floorId}」不满足共享逻辑 id 语法` +
        `（每段以字母/下划线/$ 开头，仅含字母数字/下划线/$，以点分隔）`,
    );
    this.name = 'MotaFloorIdError';
  }
}

/**
 * 由 `floorId` 构造一个**具体**的楼层资源描述符：id 与 IO 地址都在适配器侧解析。
 *
 * @param floorId - 真实楼层 id（用于推导逻辑 id 与拼接楼层文件地址）
 * @throws {MotaFloorIdError} 当推导出的 `mota.floor.<floorId>` 违反共享逻辑 id 语法时
 */
export function motaFloorDescriptor(floorId: string): ResourceDescriptor<FloorData> {
  const id = `${FLOOR_LOGICAL_ID_PREFIX}${floorId}`;
  if (!isValidResourceId(id)) throw new MotaFloorIdError(floorId);

  return {
    id,
    preload: 'on-demand',
    preloadDependsOn: ['mota.tower'],
    create: (deps: ResourceDependencies) =>
      new FileResource<FloorData>(id, motaFloorAddress(floorId), (file) => new FloorDataHandler(file, floorId), deps),
  };
}
