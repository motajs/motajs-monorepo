/**
 * 表格层（默认实现）专属类型声明处（D-08）。
 *
 * 字符串字段路径与表格动作属于表格层、不属底层（用户反馈 #3）；这里只声明表格侧的
 * 类型落点，不接入 `./table` 的公开面（它仍是空 barrel）。
 */

/** 表格动作的三种类型：改值 / 新增 / 删除。 */
export type ActionType = 'change' | 'add' | 'delete';

/** 一条表格动作：[操作类型, 字段路径字符串, 值]。 */
export type Action = [ActionType, string, unknown];
