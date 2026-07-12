/**
 * ParseErrorRecovery - 解析错误恢复 UI
 */

import type { FC } from "react";

export interface ParseErrorRecoveryProps {
  /** 错误对象 */
  error: Error;
  /** 重试回调 */
  onRetry: () => void;
  /** 可选：以文本方式打开回调 */
  onOpenAsText?: () => void;
}

/**
 * 解析错误恢复 UI
 */
export const ParseErrorRecovery: FC<ParseErrorRecoveryProps> = ({
  error,
  onRetry,
  onOpenAsText,
}) => {
  return (
    <div className="leftTabError">
      <div>解析失败: {error.message}</div>
      <div style={{ marginTop: 8 }}>
        <button onClick={onRetry}>重试</button>
        {onOpenAsText && (
          <button onClick={onOpenAsText} style={{ marginLeft: 8 }}>
            以文本方式打开
          </button>
        )}
      </div>
    </div>
  );
};
