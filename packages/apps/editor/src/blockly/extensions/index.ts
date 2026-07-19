/**
 * Blockly 扩展模块
 *
 * 统一管理和注册所有自定义扩展
 */

import { registerChangeFloorVisibilityExtension } from './changeFloorVisibility';
import { registerProjectEventPassthroughExtension } from './projectEventPassthrough';

export { CHANGE_FLOOR_VISIBILITY_EXTENSION } from './changeFloorVisibility';
export {
  PROJECT_EVENT_PASSTHROUGH_EXTENSION,
  PROJECT_EVENT_RAW_STATE_KEY,
  readProjectEventRaw,
} from './projectEventPassthrough';

/**
 * 注册所有扩展
 */
export function registerAllExtensions(): void {
  registerChangeFloorVisibilityExtension();
  registerProjectEventPassthroughExtension();
}
