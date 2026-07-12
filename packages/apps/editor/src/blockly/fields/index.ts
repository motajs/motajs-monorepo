/**
 * 自定义 Blockly 字段注册模块
 *
 * 集中管理所有自定义字段的注册
 */

import { registerFieldPoint } from './FieldPoint';

/**
 * 注册所有自定义字段
 *
 * 需要在块定义之前调用
 */
export function registerCustomFields(): void {
  registerFieldPoint();
}

// 导出所有字段类型
export * from './FieldPoint';
