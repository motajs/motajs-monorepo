import { EditorCore } from '@motajs/editor-core';

/** 「撤销」菜单项的唯一标识符 */
export const DEV_UNDO_MENU_ID: string = 'dev-undo';

/** 「撤销」菜单项的显示标题 */
export const DEV_UNDO_MENU_TITLE: string = '撤销';

/** 「重做」菜单项的唯一标识符 */
export const DEV_REDO_MENU_ID: string = 'dev-redo';

/** 「重做」菜单项的显示标题 */
export const DEV_REDO_MENU_TITLE: string = '重做';

/**
 * 注册开发宿主的「撤销」「重做」菜单项：点击分别触发编辑器的撤销 / 重做，便于手动测试（P10）；
 * 仅存在于开发宿主，不进入生产路径，也不给外壳新增子菜单机制。
 * @param core 开发宿主的编辑器核心，经其外壳系统注册菜单项、经其撤销系统执行撤销 / 重做
 */
export function registerDevMenu(core: EditorCore): void {
  core.shellSystem.registerMenuItem({
    id: DEV_UNDO_MENU_ID,
    title: DEV_UNDO_MENU_TITLE,
    onClick: (): void => {
      void core.undoSystem.undo();
    },
  });
  core.shellSystem.registerMenuItem({
    id: DEV_REDO_MENU_ID,
    title: DEV_REDO_MENU_TITLE,
    onClick: (): void => {
      void core.undoSystem.redo();
    },
  });
}
