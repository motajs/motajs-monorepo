/**
 * 块定义统一注册模块
 *
 * 集中管理所有块的注册
 * 使用新的 Schema 架构
 */

import { registerFieldColour } from '@blockly/field-colour';
import { registerFieldAutocomplete } from '../fields/FieldAutocomplete';
import { registerFieldMultilineText } from '../fields/FieldMultilineText';
import { registerFieldTextInput } from '../fields/FieldTextInput';

import { registerAllExtensions } from '../extensions';
import { registerCustomFields } from '../fields';
import { blockRegistry } from '../registry';
import { registerAllSchemas } from '../schemas';

// 是否已注册
let blocksRegistered = false;

/**
 * 注册所有 MotaAction 相关的块
 *
 * 只会注册一次，多次调用无效
 */
export function registerAllBlocks(): void {
  registerFieldTextInput();
  registerFieldAutocomplete();
  if (blocksRegistered) {
    return;
  }

  // 注册自定义字段（需要在块定义之前）
  registerCustomFields();
  registerFieldMultilineText();
  registerFieldColour();

  // 注册自定义扩展（需要在块定义之前）
  registerAllExtensions();

  // 注册所有 Schema（新架构）
  registerAllSchemas();

  // 初始化注册表（将 schema 注册到 Blockly）
  blockRegistry.initialize();

  blocksRegistered = true;
  console.log('[Blockly] All MotaAction blocks registered via schema');
}

/**
 * 检查块是否已注册
 */
export function isBlocksRegistered(): boolean {
  return blocksRegistered;
}

// 导出 registry
export { blockRegistry } from '../registry';

// 导出 schemas
export * from '../schemas';
