/**
 * ContentBoundary - 统一的数据加载边界
 *
 * 组合 Suspense + RecoveryUI，处理数据加载的所有状态
 *
 * 职责：
 * - 捕获 handler
 * - 显示 loading / error / not-found 等状态的 UI
 * - 提供恢复操作（retry, openAsText 等）
 */

import type { FC, ReactNode } from 'react';
import { SuspenseWithRecovery, type SuspenseWithRecoveryProps } from './SuspenseWithRecovery';

export interface ContentBoundaryProps extends SuspenseWithRecoveryProps {
  children: ReactNode;
}

/**
 * ContentBoundary - 统一的数据加载边界
 *
 * @example
 * // 基础用法
 * <ContentBoundary>
 *   <TowerPanel />
 * </ContentBoundary>
 *
 * @example
 * // 自定义 loading UI
 * <ContentBoundary loadingUI={<Spinner />}>
 *   <FloorPanel />
 * </ContentBoundary>
 *
 * @example
 * // 自定义恢复 UI（业务相关）
 * <ContentBoundary
 *   recoveryUI={(handler) => {
 *     const content = handler.content();
 *     if (content.status === 'not-found') {
 *       return (
 *         <NotFoundPanel
 *           path={handler.getPath()}
 *           onRetry={() => handler.refetch()}
 *           onCreate={() => floorCommands.create(...)}
 *         />
 *       );
 *     }
 *     return null; // 使用默认 UI
 *   }}
 * >
 *   <FloorPanel />
 * </ContentBoundary>
 */
export const ContentBoundary: FC<ContentBoundaryProps> = (props) => {
  return <SuspenseWithRecovery {...props}>{props.children}</SuspenseWithRecovery>;
};

// 导出相关类型和组件
export { SuspenseWithRecovery, type SuspenseWithRecoveryProps };
