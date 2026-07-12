/**
 * Blockly 扩展模块
 *
 * 统一管理和注册所有自定义扩展
 */

import { registerChangeFloorVisibilityExtension } from './changeFloorVisibility';

export { CHANGE_FLOOR_VISIBILITY_EXTENSION } from './changeFloorVisibility';

/**
 * 注册所有扩展
 */
export function registerAllExtensions(): void {
  registerChangeFloorVisibilityExtension();
}
