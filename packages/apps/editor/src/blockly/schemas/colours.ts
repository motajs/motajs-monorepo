/**
 * Blockly 块颜色常量
 *
 * 与原 editor_blockly 保持一致，延续用户操作习惯
 * Blockly 使用 HSV 色相值 (0-360)
 */

export const BlockColours = {
  /** 入口块 - 紫色 */
  ENTRY: 250,

  /** 商店块 - 橙色 */
  SHOP: 70,

  /** 数据操作块 - 绿色 */
  DATA: 130,

  /** 文本/交互块 - 橙色（原始配置中"显示文字"分类的颜色） */
  TEXT: 70,

  /** UI/画面块 - 黄色 */
  UI: 359,

  /** 动画/视角块 - 红色 */
  ANIMATION: 220,

  /** 音效块 - 橙黄色 */
  SOUND: 20,

  /** 条件/循环块 - 红色 */
  CONTROL: 220,

  /** 循环控制块 (break/continue) - 绿色 */
  LOOP_CONTROL: 220,

  /** 其他杂项块 - 粉色 */
  MISC: 330,

  /** 游戏流程块 (win/lose/restart) - 橙色 */
  GAME_FLOW: 65,

  /** 注释块 - 紫色 */
  COMMENT: 285,

  /** 地图块 - 青绿色 */
  MAP: 175,

  /** 表达式块 - 蓝紫色 */
  EXPRESSION: 330,

  /** exit块 - 红色 */
  EXIT: 0,

  /** sleep块 - 青绿色 */
  SLEEP: 180,

  /** 子块 */
  CONTEXT: 250,
} as const;
