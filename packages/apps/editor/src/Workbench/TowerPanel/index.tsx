/**
 * TowerPanel - 全塔属性编辑面板
 *
 * 使用 Suspense 架构，数据状态由 ContentBoundary 统一处理
 * 业务组件只写"数据已就绪"的逻辑
 */

import { useCallback, useMemo, useState, type FC } from "react";
import { ContentLeftTab } from "../components/ContentLeftTab";
import { Table, EditModeSegmented } from "@/components/Table";
import { useTableMetaEditor } from "@/components/Table/hooks";
import { useTowerDataSuspense, useTableMetaSuspense } from "@/hooks";
import { tableCommands } from "@/project/commands";
import { notifyCommandResult, notifyError } from "@/utils/notify";
import type { Action } from "@/utils/action";
import type { EditMode, TableAction } from "@/components/Table/types";
import type { CommentObject } from "@/components/Table";

/**
 * 处理 main 字段的 null 填充
 * 根据 commentObj 中定义的字段，对 data.main 进行处理
 */
function processMainFields(
  data: Record<string, unknown>,
  commentObj: CommentObject,
): Record<string, unknown> {
  const result = { ...data, main: {} };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mainCommentData = (commentObj as any)?._data?.main?._data;
  const dataMain = data.main as Record<string, unknown> | undefined;

  if (mainCommentData && typeof mainCommentData === "object") {
    const mainData: Record<string, unknown> = {};

    for (const key of Object.keys(mainCommentData)) {
      if (dataMain && key in dataMain) {
        mainData[key] = dataMain?.[key];
      } else {
        mainData[key] = null;
      }
    }

    result.main = mainData;
  }

  return result;
}

/**
 * TowerPanelContent - 内容组件（使用 Suspense hooks）
 *
 * 这个组件会在数据未就绪时 throw handler
 * 由 ContentLeftTab 捕获并显示恢复 UI
 */
interface TowerPanelContentProps {
  editMode: EditMode;
}

const TowerPanelContent: FC<TowerPanelContentProps> = ({ editMode }) => {
  // 使用 Suspense 版本的 hooks - 数据未就绪时会 throw
  const [tower] = useTowerDataSuspense();
  const meta = useTableMetaSuspense("dataComment");

  // 处理数据：应用 main 字段的 null 填充
  const data = useMemo(() => {
    const rawData = tower as unknown as Record<string, unknown>;
    return processMainFields(rawData, meta);
  }, [tower, meta]);

  // 统一的变更处理 - 即时保存
  const handleChange = useCallback(async (action: TableAction) => {
    try {
      const result = await tableCommands.patchTower([action as Action]);
      notifyCommandResult(result, "保存成功！");
    } catch (err) {
      notifyError(err);
    }
  }, []);

  return (
    <Table
      data={data}
      commentObj={meta}
      onChange={handleChange}
      editMode={editMode}
    />
  );
};

/**
 * TowerPanel - 面板组件
 *
 * 负责布局和 actions，不直接依赖数据
 * actions 始终显示，不受数据加载状态影响
 */
export const TowerPanel: FC = () => {
  // 在 Panel 层维护 editMode（不依赖数据）
  const [editMode, setEditMode] = useState<EditMode>("change");

  // 使用 useTableMetaEditor 获取编辑器打开函数
  const { openEditor } = useTableMetaEditor("dataComment");

  // 配置表格按钮点击处理
  const handleConfigure = useCallback(() => {
    openEditor();
  }, [openEditor]);

  // 操作按钮区域（始终显示）
  const actions = (
    <>
      <EditModeSegmented value={editMode} onChange={setEditMode} />
      &nbsp;&nbsp;
      <button onClick={handleConfigure}>配置表格</button>
    </>
  );

  return (
    <ContentLeftTab id="left5" testId="panel-tower" title="全塔属性" actions={actions}>
      <TowerPanelContent editMode={editMode} />
    </ContentLeftTab>
  );
};
