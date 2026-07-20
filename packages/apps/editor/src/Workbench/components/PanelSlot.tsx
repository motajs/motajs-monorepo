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

import { type ReactNode } from "react";
import { useIsPanelActive, type PanelId } from "@/stores/PanelStore";
import { PanelErrorBoundary } from "./PanelErrorBoundary";
import { ContentBoundary, NotFoundRecovery } from "@/components/ContentBoundary";
import type { IContentHandler } from "@/fs/interfaces";
import { operationHistory, useOperationHistory } from "@/project/history";
import { notifyError } from "@/utils/notify";

export interface PanelSlotProps {
  /** 面板 ID */
  panelId: PanelId;
  /** 子组件 */
  children: ReactNode;
}

function MissingPanelResource({ handler }: { handler: IContentHandler<unknown> }) {
  const history = useOperationHistory();
  const previous = history.current > 0 ? history.entries[history.current - 1] : undefined;
  const canRestore = previous?.paths.includes(handler.getPath()) === true;

  return (
    <NotFoundRecovery
      path={handler.getPath()}
      onRetry={() => { void handler.refetch(); }}
      onRestore={canRestore ? () => {
        void operationHistory.undo().catch(notifyError);
      } : undefined}
      restoreLabel={previous ? `撤销“${previous.label}”` : undefined}
    />
  );
}

export function PanelSlot({ panelId, children }: PanelSlotProps) {
  const isActive = useIsPanelActive(panelId);

  if (!isActive) return null;
  return (
    <div className="panelSlotBoundary" data-test-id={`panel-slot-${panelId}`}>
      <PanelErrorBoundary panelId={panelId}>
        <ContentBoundary
          loadingUI={<></>}
          recoveryUI={(handler) => handler.content().status === "not-found"
            ? <MissingPanelResource handler={handler} />
            : null}
        >
          {children}
        </ContentBoundary>
      </PanelErrorBoundary>
    </div>
  );
}
