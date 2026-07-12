/**
 * LocPanel - 地图选点编辑面板
 *
 * 使用 Suspense 架构，数据状态由 ContentBoundary 统一处理
 * 业务组件只写"数据已就绪"的逻辑
 */

import { useCallback, useMemo, useState, type FC } from "react";
import { ContentLeftTab } from "../components/ContentLeftTab";
import { EditModeSegmented } from "@/components/Table";
import { useTableMetaEditor } from "@/components/Table/hooks";
import { useLocTableMetaSuspense } from "@/hooks/suspense/useLocTableMetaSuspense";
import { useCurrentLocSelection } from "@/stores/locState";
import { useCurrentFloorId } from "@/stores/editorState";
import { useResourceSuspense } from "@/hooks/suspense";
import { projectData } from "@/project/data/projectData";
import { locCommands } from "@/project/commands/locCommands";
import { resolveLocTarget } from "@/project/model/locModel";
import { notifyCommandResult, notifyError, notifySuccess } from "@/utils/notify";
import { LocTable } from "./LocTable";
import type { EditMode } from "@/components/Table/types";
import type { CommentObject } from "@/components/Table";

// ==================== 主内容组件 ====================

interface LocPanelContentProps {
  editMode: EditMode;
  floorId?: string;
}

const LocPanelContent: FC<LocPanelContentProps> = ({ editMode, floorId }) => {
  const selection = useCurrentLocSelection();
  const target = useMemo(
    () => resolveLocTarget(selection, floorId),
    [selection, floorId]
  );
  const meta = useLocTableMetaSuspense();

  // 如果没有选中位置，显示空状态
  if (!selection) {
    return <div data-test-id="loc-empty-state">请选择一个位置</div>;
  }

  // 如果没有当前楼层，显示空状态
  if (!target) {
    return <div data-test-id="loc-empty-state">请先选择一个楼层</div>;
  }

  return (
    <LocTable
      target={target}
      meta={meta as CommentObject}
      editMode={editMode}
    />
  );
};

// ==================== 面板组件 ====================

/**
 * LocPanel - 面板组件
 *
 * 负责布局和 actions，不直接依赖数据
 * actions 始终显示，不受数据加载状态影响
 */
export const LocPanel: FC = () => {
  const selection = useCurrentLocSelection();
  const [tower] = useResourceSuspense(projectData.tower());
  const floorId = useCurrentFloorId() ?? tower.firstData?.floorId ?? tower.main.floorIds[0];
  const target = useMemo(
    () => resolveLocTarget(selection, floorId),
    [selection, floorId]
  );

  // 在 Panel 层维护 editMode（不依赖数据）
  const [editMode, setEditMode] = useState<EditMode>("change");

  // 使用 useTableMetaEditor 获取编辑器打开函数
  const { openEditor } = useTableMetaEditor("comment");

  // 保存按钮点击处理
  const handleSave = useCallback(async () => {
    if (!floorId) {
      notifyError("请先选择一个楼层");
      return;
    }
    await projectData.floor(floorId).waitForIdle();
    notifySuccess("保存完成");
  }, [floorId]);

  // 添加自动事件页
  const handleAddAutoEvent = useCallback(async () => {
    if (!target) {
      notifyError("请先选择一个位置");
      return;
    }

    try {
      const result = await locCommands.addAutoEventPage(target.floorId, target.pos);
      if (result.ok) {
        notifySuccess(`添加自动事件页 ${result.pageId} 成功`);
      } else {
        notifyCommandResult(result, "");
      }
    } catch (err) {
      notifyError(err);
    }
  }, [target]);

  // 配置表格按钮点击处理
  const handleConfigure = useCallback(() => {
    openEditor();
  }, [openEditor]);

  // 操作按钮区域（始终显示）
  const actions = (
    <>
      <button onClick={handleSave}>保存</button>
      &nbsp;&nbsp;
      <EditModeSegmented value={editMode} onChange={setEditMode} />
      &nbsp;&nbsp;
      <button onClick={handleAddAutoEvent}>添加自动事件页</button>
      &nbsp;&nbsp;
      <button onClick={handleConfigure}>配置表格</button>
    </>
  );

  return (
    <ContentLeftTab id="left2" testId="panel-loc" title="地图选点" actions={actions}>
      <LocPanelContent editMode={editMode} floorId={floorId} />
    </ContentLeftTab>
  );
};
