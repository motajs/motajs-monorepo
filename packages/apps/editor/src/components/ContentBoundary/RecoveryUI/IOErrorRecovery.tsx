/**
 * IOErrorRecovery - IO 错误恢复 UI
 */

import type { FC } from "react";

export interface IOErrorRecoveryProps {
  /** 错误对象 */
  error: Error;
  /** 重试回调 */
  onRetry: () => void;
}

/**
 * IO 错误恢复 UI
 */
export const IOErrorRecovery: FC<IOErrorRecoveryProps> = ({
  error,
  onRetry,
}) => {
  return (
    <div className="leftTabError">
      <div>加载失败: {error.message}</div>
      <div style={{ marginTop: 8 }}>
        <button onClick={onRetry}>重试</button>
      </div>
    </div>
  );
};
