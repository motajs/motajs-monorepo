/**
 * LeftTab - 可复用的左侧面板组件
 *
 * 提供统一的 leftTab 结构，包含标题栏、操作按钮区域和内容区域。
 * 内置 loading 和 error 状态处理。
 */

import type { FC, ReactNode } from 'react';

export interface LeftTabProps {
  /** 面板 ID，如 "left5" */
  id: string;
  /** 标题文本 */
  title: string;
  /** 标题栏右侧的操作按钮 */
  actions?: ReactNode;
  /** 面板内容 */
  children: ReactNode;
  /** 是否加载中 */
  loading?: boolean;
  /** 错误信息 */
  error?: string | null;
}

export const LeftTab: FC<LeftTabProps> = (props) => {
  const {
    id,
    title,
    actions,
    children,
    loading = false,
    error = null,
  } = props;

  // 渲染内容
  const renderContent = () => {
    if (loading) {
      return <div className="leftTabLoading">加载中...</div>;
    }
    if (error) {
      return <div className="leftTabError">加载失败: {error}</div>;
    }
    return children;
  };

  return (
    <div id={id} className="leftTab">
      <h3 className="leftTabHeader">
        {title}
        {actions && <>&nbsp;&nbsp;{actions}</>}
      </h3>
      <div className="leftTabContent">{renderContent()}</div>
    </div>
  );
};
