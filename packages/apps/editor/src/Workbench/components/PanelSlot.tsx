/**
 * PanelSlot - 面板插槽组件
 *
 * 只挂载当前激活面板。
 *
 * 旧面板里仍有一些 runtime-only 全局依赖。Activity hidden 仍会构建子树，
 * 会让这些依赖在首屏启动时执行；迁移期先以启动隔离为优先。
 *
 * 使用方式：
 * <PanelSlot panelId="tower">
 *   <TowerPanel />
 * </PanelSlot>
 */

import { type ReactNode } from 'react';
import { useIsPanelActive, type PanelId } from '@/stores/PanelStore';
import { PanelErrorBoundary } from './PanelErrorBoundary';
import { ContentBoundary } from '@/components/ContentBoundary';

export interface PanelSlotProps {
  /** 面板 ID */
  panelId: PanelId;
  /** 子组件 */
  children: ReactNode;
}

export function PanelSlot({ panelId, children }: PanelSlotProps) {
  const isActive = useIsPanelActive(panelId);

  if (!isActive) return null;
  return (
    <PanelErrorBoundary panelId={panelId}>
      <ContentBoundary loadingUI={<></>}>
        {children}
      </ContentBoundary>
    </PanelErrorBoundary>
  );
}
