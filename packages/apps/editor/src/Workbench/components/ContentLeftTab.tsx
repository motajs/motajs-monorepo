/**
 * ContentLeftTab - LeftTab + ContentBoundary 组合组件
 *
 * 组合 LeftTab 和 ContentBoundary，提供统一的数据加载面板
 *
 * 特点：
 * - 标题栏和 actions 始终可见（不受 loading/error 影响）
 * - content 区域使用 ContentBoundary 处理数据状态
 * - 使用 LeftTab 的样式显示 loading/error
 */

import type { FC, ReactNode } from "react";
import {
  ContentBoundary,
  type SuspenseWithRecoveryProps,
} from "@/components/ContentBoundary";
import type { IContentHandler } from "@/fs/interfaces";

export interface ContentLeftTabProps {
  /** 面板 ID，如 "left5" */
  id: string;
  /** 稳定测试 ID */
  testId?: string;
  /** 标题文本 */
  title: string;
  /** 标题栏右侧的操作按钮（始终显示） */
  actions?: ReactNode;
  /** 面板内容（使用 Suspense hooks） */
  children: ReactNode;

  /**
   * 自定义恢复 UI（核心 API）
   *
   * 组件层通过这个 prop 定义业务相关的恢复操作
   * 返回 null 表示使用默认 UI
   */
  recoveryUI?: (handler: IContentHandler<unknown>) => ReactNode | null;

  /** 可选：简化的 loading UI */
  loadingUI?: ReactNode;

  /** 可选：默认恢复策略 - 自动重试 */
  autoRetry?: boolean;

  /** 可选：自动重试延迟（毫秒） */
  autoRetryDelay?: number;
}

/**
 * ContentLeftTab 组件
 *
 * @example
 * // 基础用法
 * <ContentLeftTab id="left5" title="全塔属性">
 *   <TowerPanelContent />
 * </ContentLeftTab>
 *
 * @example
 * // 带 actions
 * <ContentLeftTab
 *   id="left5"
 *   title="全塔属性"
 *   actions={<EditModeSegmented />}
 * >
 *   <TowerPanelContent />
 * </ContentLeftTab>
 *
 * @example
 * // 自定义恢复 UI
 * <ContentLeftTab
 *   id="left5"
 *   title="全塔属性"
 *   recoveryUI={(handler) => {
 *     if (handler.content().status === 'not-found') {
 *       return <CreatePanel onCreate={...} />;
 *     }
 *     return null;
 *   }}
 * >
 *   <TowerPanelContent />
 * </ContentLeftTab>
 */
export const ContentLeftTab: FC<ContentLeftTabProps> = (props) => {
  const {
    id,
    testId,
    title,
    actions,
    children,
    recoveryUI,
    loadingUI,
  } = props;

  // 构建 ContentBoundary props
  const boundaryProps: Omit<SuspenseWithRecoveryProps, "children"> = {
    recoveryUI,
    loadingUI: loadingUI ?? <></>,
  };

  return (
    <div id={id} className="leftTab leftTabLayout" data-test-id={testId}>
      <h3 className="leftTabHeader" data-test-id={testId ? `${testId}-header` : undefined}>
        {title}
        {actions && <>&nbsp;&nbsp;{actions}</>}
      </h3>
      <div className="leftTabContent" data-test-id={testId ? `${testId}-content` : undefined}>
        <ContentBoundary {...boundaryProps}>{children}</ContentBoundary>
      </div>
    </div>
  );
};
