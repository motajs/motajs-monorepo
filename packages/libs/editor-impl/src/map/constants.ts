/** 面板类型标识，装配方引用它而不各写字符串 */
export const MAP_PANEL_TYPE_ID = 'map';

/** 一格在像素上的边长 */
export const MAP_CELL_SIZE = 32;

/** 新建地图的默认宽度（格子数） */
export const MAP_DEFAULT_WIDTH = 32;

/** 新建地图的默认高度（格子数） */
export const MAP_DEFAULT_HEIGHT = 32;

/** 新建地图的默认初始图层名 */
export const MAP_DEFAULT_LAYER_NAME = '图层 1';

/** 最近使用图块的项目内约定文件路径 */
export const MAP_RECENT_TILES_PATH = '.editor/map-recent-tiles.json';

/** 最近使用文件的字段名 */
export const MAP_RECENT_TILES_KEY = 'tiles';

/** 最近使用条目的上限 */
export const MAP_RECENT_TILES_LIMIT = 24;

/** 大地图模式下格边长小于该值时，通行度改用红点 */
export const MAP_BIG_MAP_DOT_CELL = 16;

/** 大地图模式一次最多构建的图元数 */
export const MAP_BIG_MAP_MAX_SPRITES = 12000;

/** 高于当前层的图层统一不透明度的默认值 */
export const MAP_ABOVE_LAYER_DEFAULT_OPACITY = 0.3;

/** 保存成功后提示行显示的文案 */
export const MAP_SAVED_MESSAGE = '已保存';

/** 撤销命中屏障时对用户显示的文案 */
export const MAP_UNDO_BLOCKED_MESSAGE = '无法撤销';
