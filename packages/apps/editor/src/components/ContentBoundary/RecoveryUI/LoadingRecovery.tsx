/**
 * LoadingRecovery - 加载中恢复 UI
 */

import type { FC } from "react";

export interface LoadingRecoveryProps {
  /** 可选：自定义消息 */
  message?: string;
}

/**
 * 加载中恢复 UI
 */
export const LoadingRecovery: FC<LoadingRecoveryProps> = ({
  message = "加载中...",
}) => {
  return <div className="leftTabLoading">{message}</div>;
};
