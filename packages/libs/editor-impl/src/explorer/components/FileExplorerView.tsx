import { useStore } from '@tanstack/react-store';
import { ReactElement } from 'react';
import { FileBrowser } from '../../shared/fileBrowser';
import { IFileExplorerViewProps } from '../types';
import { PanelCandidateModal } from './PanelCandidateModal';
import '../explorer.css';

/**
 * 资源管理器视图：固定 32px 头部 + 共用文件浏览器，候选 ≥ 2 时叠加候选弹窗
 *
 * 头部只放图标与标题，不放任何按钮（重载属于浏览器，候选选择属于弹窗）；目录状态与文件行打开
 * 全部由面板提供的回调承担，本组件不 import 面板类。
 * @param props 面板提供的全部输入
 * @returns 资源管理器面板视图元素
 */
export function FileExplorerView(props: IFileExplorerViewProps): ReactElement {
  const state = useStore(props.store);
  const candidateTypeIds = state.candidateTypeIds ?? [];
  const candidates = props.candidates.filter((type) => candidateTypeIds.includes(type.id));

  return (
    <div className="efx-panel" data-test-id="explorer-panel">
      <div className="efx-header">
        <span className="efx-header-icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M1.5 4.5A1 1 0 0 1 2.5 3.5H6L7.5 5H13.5A1 1 0 0 1 14.5 6V12A1 1 0 0 1 13.5 13H2.5A1 1 0 0 1 1.5 12V4.5Z" />
          </svg>
        </span>
        <span className="efx-title" data-test-id="explorer-title" title="文件资源管理器">
          文件资源管理器
        </span>
      </div>
      <div className="efx-body">
        <FileBrowser
          testIdPrefix="explorer"
          directory={state.directory}
          loadChildren={props.loadChildren}
          filter={props.filterPath}
          onOpen={props.onOpen}
          reloadToken={state.reloadToken}
        />
      </div>
      {candidateTypeIds.length >= 2 ? (
        <PanelCandidateModal
          path={state.pendingPath ?? ''}
          candidates={candidates}
          onSelect={props.onSelectCandidate}
          onCancel={props.onCancelCandidate}
        />
      ) : null}
    </div>
  );
}
