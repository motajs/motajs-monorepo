/** 面板类型标识，装配方引用它而不各写字符串 */
export const MAP_PANEL_TYPE_ID = 'map';

/** 一格在像素上的边长；仅用于地图文档没有声明格尺寸时的兜底 */
export const MAP_CELL_SIZE = 32;

/** 显示网格的基准格边长（像素）；画布 = 格数 × 它 × 缩放，与 `MAP_CELL_SIZE`（文档兜底）是两件事 */
export const MAP_DISPLAY_CELL_SIZE = 32;

/** 素材格 / 收藏格的显示边长（像素）；必须与 `map.css` 里 `.emap-material-cell` 与 `.emap-favorite-slot` 的 32px 同源，改这里就要同步改 CSS */
export const MAP_MATERIAL_CELL_SIZE = 32;

/** 行列标尺的厚度（像素）；地图区宽度 = 画布宽 + 它，画布用它定位标尺与可视区，两处必须同源（D-43） */
export const MAP_RULER_SIZE = 20;

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

/** 面板上「地图区宽 / 高」数字框允许的最小格数 */
export const MAP_VIEWPORT_MIN_COUNT = 1;

/** 面板上「地图区宽 / 高」数字框允许的最大格数 */
export const MAP_VIEWPORT_MAX_COUNT = 64;

/** 顶栏只读标签的前缀；完整格式为 `图格尺寸：{cellWidth}px * {cellHeight}px`，数字取自地图文档声明的格尺寸 */
export const MAP_CELL_SIZE_LABEL = '图格尺寸';

/** 允许的最小缩放倍率 */
export const MAP_ZOOM_MIN = 0.5;

/** 允许的最大缩放倍率 */
export const MAP_ZOOM_MAX = 2;

/** 上下文未覆盖时使用的缩放倍率 */
export const MAP_ZOOM_DEFAULT = 1;

/** 缩放滑块每动一格的步长 */
export const MAP_ZOOM_STEP = 0.05;

/** 右侧素材栏在缩放 1 时的基准宽度（像素）；只在量不到可用宽度时使用 */
export const MAP_PALETTE_BASE_WIDTH = 320;

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

/** 通行度箭头头部沿方向占的长度（像素）；按 32×32 格里四支箭头互不重叠取 6，不要凭手感改大 */
export const MAP_PASS_ARROW_HEAD_LENGTH = 6;

/** 通行度箭头头部的一半宽度（像素）；整头宽 5px，落在 4..6px 区间内 */
export const MAP_PASS_ARROW_HEAD_HALF_WIDTH = 2.5;
