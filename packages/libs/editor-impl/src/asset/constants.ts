/** 单个上传文件的字节上限 */
export const ASSET_MAX_UPLOAD_BYTES = 32 * 1024 * 1024;

/** 撤销命中屏障时对用户显示的文案 */
export const UNDO_BLOCKED_MESSAGE = '无法撤销';

/** 卡片框宽度滑块的默认值（px） */
export const DEFAULT_ASSET_CARD_WIDTH = 116;

/** 卡片框宽度滑块的最小值（px） */
export const ASSET_CARD_MIN_WIDTH = 96;

/** 卡片框宽度滑块的最大值（px） */
export const ASSET_CARD_MAX_WIDTH = 240;

/** 卡片框宽度滑块每次变化的步长（px） */
export const ASSET_CARD_WIDTH_STEP = 8;

/** 删除素材前说明会移除文件并指向「注销」 */
export const ASSET_DELETE_CONFIRM_TEXT = '删除会把该文件从工程目录移除，且无法找回。只想让它不进游戏，请改用「注销」。';

/** 注销素材第一步：说明只移除登记与配置、文件保留 */
export const ASSET_UNREGISTER_CONFIRM_TEXT =
  '注销只从列表里移除这条登记，并删除它的配置（无法找回）。文件本身会保留在分类文件夹里。';

/** 注销素材第二步：再次确认配置永久丢失 */
export const ASSET_UNREGISTER_FINAL_CONFIRM_TEXT = '再次确认：该素材的配置将永久丢失，无法恢复。确定注销？';
