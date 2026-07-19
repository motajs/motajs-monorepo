/**
 * 代码编辑器命令配置
 *
 * 包含快捷键映射、命令名称、注释文件路径等配置。
 */

import type { CommandsNameMap, CommentFilePathMap, ShortcutKey } from "../types/index";

/**
 * 命令名称映射
 * 快捷键 -> 中文描述
 */
export const commandsName: CommandsNameMap = {
  "Ctrl-/": "注释当前选中行（Ctrl+/）",
  "Ctrl-B": "跳转到定义（Ctrl+B）",
  "Ctrl-Q": "重命名变量（Ctrl+Q）",
  "Ctrl-F": "查找（Ctrl+F）",
  "Ctrl-R": "全部替换（Ctrl+R）",
  "Ctrl-D": "折叠或展开块（Ctrl+D）",
  "Ctrl-O": "打开API列表（Ctrl+O）",
  "Ctrl-P": "打开在线插件列表（Ctrl+P）",
};

/**
 * 获取所有快捷键列表
 */
export function getShortcutKeys(): ShortcutKey[] {
  return Object.keys(commandsName) as ShortcutKey[];
}

/** Keep the search dialog open so Enter advances to the next match. */
export const PERSISTENT_SEARCH_KEYS = {
  "Cmd-F": "findPersistent",
  "Ctrl-F": "findPersistent",
} as const;

/** A single completion candidate must still be confirmed by the user. */
export const CODEMIRROR_HINT_OPTIONS = {
  completeSingle: false,
} as const;

/**
 * 注释文件路径映射
 * 编辑模式 -> 对应的注释文件路径
 */
export const COMMENT_FILE_PATHS: CommentFilePathMap = {
  loc: "_server/table/comment.js",
  enemyitem: "_server/table/comment.js",
  floor: "_server/table/comment.js",
  tower: "_server/table/data.comment.js",
  functions: "_server/table/functions.comment.js",
  commonevent: "_server/table/events.comment.js",
  plugins: "_server/table/plugins.comment.js",
};

/**
 * CodeMirror 默认配置
 */
export const DEFAULT_CODEMIRROR_OPTIONS = {
  lineNumbers: true,
  matchBrackets: true,
  indentUnit: 4,
  tabSize: 4,
  indentWithTabs: true,
  smartIndent: true,
  mode: { name: "javascript", globalVars: true, localVars: true },
  lineWrapping: true,
  continueComments: "Enter",
  gutters: [
    "CodeMirror-lint-markers",
    "CodeMirror-linenumbers",
    "CodeMirror-foldgutter",
  ],
  lint: true,
  autocomplete: true,
  hintOptions: CODEMIRROR_HINT_OPTIONS,
  autoCloseBrackets: true,
  styleActiveLine: true,
  foldGutter: true,
  inputStyle: "textarea" as const,
  highlightSelectionMatches: { showToken: /\w/, annotateScrollbar: true },
};

/**
 * JSHint lint 配置
 */
export const JSHINT_OPTIONS = {
  /** Let typing and Tern completion settle before checking the whole document. */
  delay: 800,
  options: {
    esversion: 2021,
  },
};

/**
 * 默认字体大小
 */
export const DEFAULT_FONT_SIZE = 14;

/**
 * 字体大小配置键
 */
export const FONT_SIZE_CONFIG_KEY = "editor_multi.fontSize";

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
