/**
 * NotFoundRecovery - 文件不存在恢复 UI
 */

import type { FC } from 'react';

export interface NotFoundRecoveryProps {
  /** 文件路径 */
  path: string;
  /** 重试回调 */
  onRetry: () => void;
  /** 可选：创建回调（业务层提供） */
  onCreate?: () => void;
  /** 可选：从编辑历史恢复 */
  onRestore?: () => void;
  /** 可选：恢复按钮文案 */
  restoreLabel?: string;
  /** 可选：以文本方式打开回调 */
  onOpenAsText?: () => void;
}

/**
 * 文件不存在恢复 UI
 */
export const NotFoundRecovery: FC<NotFoundRecoveryProps> = ({
  path,
  onRetry,
  onCreate,
  onRestore,
  restoreLabel = '撤销导致缺失的操作',
  onOpenAsText,
}) => (
  <div className="leftTabError">
    <div>文件不存在: {path}</div>
    <div style={{ marginTop: 8 }}>
      <button onClick={onRetry}>重试</button>
      {onRestore && (
        <button onClick={onRestore} style={{ marginLeft: 8 }}>
          {restoreLabel}
        </button>
      )}
      {onCreate && (
        <button onClick={onCreate} style={{ marginLeft: 8 }}>
          创建文件
        </button>
      )}
      {onOpenAsText && (
        <button onClick={onOpenAsText} style={{ marginLeft: 8 }}>
          以文本方式打开
        </button>
      )}
    </div>
  </div>
);
