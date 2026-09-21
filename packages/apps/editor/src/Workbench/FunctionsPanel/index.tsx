/**
 * FunctionsPanel - 脚本编辑面板
 *
 * 使用 Suspense 架构，数据状态由 ContentBoundary 统一处理
 * 业务组件只写"数据已就绪"的逻辑
 */

import { useCallback, useState, type FC } from 'react';
import { ContentLeftTab } from '../components/ContentLeftTab';
import { Table, EditModeSegmented } from '@/components/Table';
import { useTableMetaSuspense } from '@/hooks';
import { useResourceSuspense } from '@/hooks/suspense';
import { projectData } from '@/project/data/projectData';
import { tableCommands } from '@/project/commands';
import { notifyCommandResult, notifyError } from '@/utils/notify';
import type { EditMode, TableAction } from '@/components/Table/types';
import type { Action } from '@/utils/action';

/**
 * FunctionsPanelContent - 内容组件（使用 Suspense hooks）
 *
 * 这个组件会在数据未就绪时 throw handler
 * 由 ContentLeftTab 捕获并显示恢复 UI
 */
interface FunctionsPanelContentProps {
  editMode: EditMode;
}

const FunctionsPanelContent: FC<FunctionsPanelContentProps> = ({ editMode }) => {
  // 使用 Suspense 版本的 hooks - 数据未就绪时会 throw
  const [functions] = useResourceSuspense(projectData.functions());
  const meta = useTableMetaSuspense('functionsComment');

  // 统一的变更处理 - 即时保存
  const handleChange = useCallback(async (action: TableAction) => {
    try {
      const result = await tableCommands.patchFunctions([action as Action]);
      notifyCommandResult(result, '保存成功！');
    } catch (err) {
      notifyError(err);
    }
  }, []);

  return <Table data={functions} commentObj={meta} onChange={handleChange} editMode={editMode} />;
};

/**
 * FunctionsPanel - 面板组件
 *
 * 负责布局和 actions，不直接依赖数据
 * actions 始终显示，不受数据加载状态影响
 */
export const FunctionsPanel: FC = () => {
  // 在 Panel 层维护 editMode（不依赖数据）
  const [editMode, setEditMode] = useState<EditMode>('change');

  const actions = <EditModeSegmented value={editMode} onChange={setEditMode} />;

  return (
    <ContentLeftTab id="left8" testId="panel-functions" title="脚本编辑" actions={actions}>
      <FunctionsPanelContent editMode={editMode} />
    </ContentLeftTab>
  );
};
