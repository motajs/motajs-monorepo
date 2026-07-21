/**
 * 代码编辑器命令配置
 *
 * 包含快捷键映射、命令名称、注释文件路径等配置。
 */

type ShortcutKey = keyof typeof commandsName;

/**
 * 命令名称映射
 * 快捷键 -> 中文描述
 */
export const commandsName = {
  "Ctrl-/": "注释当前选中行（Ctrl+/）",
  "Ctrl-B": "跳转到定义（Ctrl+B）",
  "Ctrl-Q": "重命名变量（Ctrl+Q）",
  "Ctrl-F": "查找（Ctrl+F）",
  "Ctrl-R": "全部替换（Ctrl+R）",
  "Ctrl-D": "折叠或展开块（Ctrl+D）",
  "Ctrl-O": "打开API列表（Ctrl+O）",
  "Ctrl-P": "打开在线插件列表（Ctrl+P）",
} as const;

/**
 * 获取所有快捷键列表
 */
export function getShortcutKeys(): ShortcutKey[] {
  return Object.keys(commandsName) as ShortcutKey[];
}


/**
 * 默认字体大小
 */
export const DEFAULT_FONT_SIZE = 14;

/**
 * 字体大小配置键
 */
export const FONT_SIZE_CONFIG_KEY = "editor_multi.fontSize";

/**
 * 字体粗细配置键
 */
export const FONT_BOLD_CONFIG_KEY = "editor_multi.fontBold";

/**
 * 插件默认模板
 */
export const PLUGIN_DEFAULT_TEMPLATE =
  '"function () {\\n\\t// 在此增加新插件\\n\\t\\n}"';

/**
 * API 文档 URL
 */
export const API_DOCS_PATH = "#api";

/**
 * 插件列表 URL
 */
export const PLUGINS_URL = "https://h5mota.com/plugins/";
