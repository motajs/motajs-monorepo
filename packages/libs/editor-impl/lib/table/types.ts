export enum ActionType {
  // 改值
  Change = 0,
  // 新增
  Add = 1,
  // 删除
  Delete = 2,
}

/** 一条表格动作：[操作类型, 字段路径字符串, 值]。 */
export type Action = [ActionType, string, unknown];
