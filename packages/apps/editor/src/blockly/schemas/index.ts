/**
 * Schemas 入口
 *
 * 导出并注册所有块 Schema
 */

import { blockRegistry } from '../registry';
import type { BlockSchema } from '../registry/types';

import { controlSchemas } from './control';
import { dataSchemas } from './data';
import { effectSchemas } from './effect';
import { entrySchemas } from './entry';
import { interactionSchemas } from './interaction';
import { mapSchemas } from './map';
import { miscSchemas } from './misc';
import { textSchemas } from './text';
import { unknownSchemas } from './unknown';
import { uiSchemas } from './ui';
import { projectEntrySchemas } from './projectEntries';

// ============================================
// 导出所有 Schema
// ============================================

export * from './text';
export * from './control';
export * from './data';
export * from './map';
export * from './interaction';
export * from './effect';
export * from './misc';
export * from './unknown';
export * from './entry';
export * from './ui';
export * from './dropdowns';
export * from './projectEntries';

/**
 * 所有内置 Schema
 */
export const allSchemas: BlockSchema[] = [
  ...textSchemas,
  ...controlSchemas,
  ...dataSchemas,
  ...mapSchemas,
  ...interactionSchemas,
  ...effectSchemas,
  ...miscSchemas,
  ...uiSchemas,
  ...unknownSchemas,
  ...entrySchemas,
  ...projectEntrySchemas,
];

/**
 * 注册所有内置块
 *
 * 应在应用初始化时调用
 */
export function registerAllSchemas(): void {
  const result = blockRegistry.registerPack(
    { id: 'mota-js:builtins', version: 1, blocks: allSchemas },
    { source: 'builtin' },
  );
  if (!result.ok) {
    throw new Error(result.diagnostics.map((item) => item.message).join('\n'));
  }
}

/**
 * 按分类获取 Schema
 */
export function getSchemasByCategory(category: string): BlockSchema[] {
  return allSchemas.filter((s) => s.category === category);
}
