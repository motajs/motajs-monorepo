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

/** 上下文未覆盖时，地图视口的默认横向格数 */
export const MAP_VIEWPORT_DEFAULT_COLUMNS = 13;

/** 上下文未覆盖时，地图视口的默认纵向格数 */
export const MAP_VIEWPORT_DEFAULT_ROWS = 13;

/** 允许的最小缩放倍率 */
export const MAP_ZOOM_MIN = 0.5;

/** 允许的最大缩放倍率 */
export const MAP_ZOOM_MAX = 2;

/** 上下文未覆盖时使用的缩放倍率 */
export const MAP_ZOOM_DEFAULT = 1;

/** 缩放滑块每动一格的步长 */
export const MAP_ZOOM_STEP = 0.05;

/** 右侧素材栏在缩放 1 时的基准宽度（像素） */
export const MAP_PALETTE_BASE_WIDTH = 240;

/** 右侧素材栏的最小可用宽度（像素） */
export const MAP_PALETTE_MIN_WIDTH = 160;

/** 右侧素材栏的最大宽度（像素） */
export const MAP_PALETTE_MAX_WIDTH = 360;

/** 上下文未覆盖时使用的动画帧速（毫秒 / 帧） */
export const MAP_FRAME_SPEED_DEFAULT = 300;

/** 单个图块允许的最大帧数 */
export const MAP_FRAME_LIMIT = 255;

/** 大地图缩略纹理的边长上限（像素，超出即降采样） */
export const MAP_THUMBNAIL_MAX_SIZE = 512;

/** 图块偏好的项目内约定文件路径 */
export const MAP_TILE_PREFS_PATH = '.editor/map-tiles.json';

/** 偏好文件里「最近使用」的字段名 */
export const MAP_TILE_PREFS_RECENT_KEY = 'recent';

/** 偏好文件里「使用次数」的字段名 */
export const MAP_TILE_PREFS_FREQUENT_KEY = 'frequent';

/** 偏好文件里「收藏」的字段名 */
export const MAP_TILE_PREFS_FAVORITES_KEY = 'favorites';

/** 收藏格数；`1` 键固定为擦除，不占数组位 */
export const MAP_FAVORITE_SLOT_COUNT = 9;

/** 「最常使用」写盘时保留的条目上限 */
export const MAP_FREQUENT_LIMIT = 200;

/** 通行度向上箭头的颜色 */
export const MAP_PASS_COLOR_UP = 0xe0523f;

/** 通行度向右箭头的颜色 */
export const MAP_PASS_COLOR_RIGHT = 0x2f6fed;

/** 通行度向下箭头的颜色 */
export const MAP_PASS_COLOR_DOWN = 0x2f9e44;

/** 通行度向左箭头的颜色 */
export const MAP_PASS_COLOR_LEFT = 0xb26bd8;
