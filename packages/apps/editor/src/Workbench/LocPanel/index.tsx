/**
 * LocPanel - 地图选点编辑面板
 *
 * 使用 Suspense 架构，数据状态由 ContentBoundary 统一处理
 * 业务组件只写"数据已就绪"的逻辑
 */

import { useCallback, useMemo, useState, type FC } from "react";
import { Segmented } from "antd";
import { ContentLeftTab } from "../components/ContentLeftTab";
import { EditModeSegmented } from "@/components/Table";
import {
  ObjectReferenceRoot,
  ProjectSchemaTable,
  SchemaCustomizationButton,
  type ReferenceUpdate,
  type SchemaScope,
} from "@/components/SchemaTable";
import { locSchemaDefinition } from "@/components/SchemaTable/builtinSchemas";
import { useLocTableMetaSuspense } from "@/hooks/suspense/useLocTableMetaSuspense";
import { useCurrentLocSelection } from "@/stores/locState";
import { useCurrentFloorId } from "@/stores/editorState";
import { useResourceSuspense } from "@/hooks/suspense";
import { projectData } from "@/project/data/projectData";
import { locCommands } from "@/project/commands/locCommands";
import { buildLocDiagnostics } from "@/project/model/locDiagnostics";
import { getLocDataFromFloor, resolveLocTarget, type LocData, type LocTarget } from "@/project/model/locModel";
import { notifyCommandResult, notifyError, notifySuccess } from "@/utils/notify";
import { persistenceMonitor } from "@/fs/PersistenceMonitor";
import { buildFieldPath } from "@/utils/fieldPath";
import { LocTable } from "./LocTable";
import type { Action } from "@/utils/action";
import type { EditMode } from "@/components/Table/types";
import type { CommentObject } from "@/components/Table";
import "./loc-panel.css";

type LocTableVersion = "schema" | "legacy";

// ==================== 主内容组件 ====================

interface LocPanelContentProps {
  editMode: EditMode;
  floorId?: string;
  tableVersion: LocTableVersion;
}

const LocSummary: FC<{ target: LocTarget; locData: LocData }> = ({ target, locData }) => {
  const changeFloor = locData.changeFloor && typeof locData.changeFloor === "object" && !Array.isArray(locData.changeFloor)
    ? locData.changeFloor as Record<string, unknown>
    : undefined;
  const destination = changeFloor
    ? [
        typeof changeFloor.floorId === "string" ? changeFloor.floorId : "?",
        typeof changeFloor.stair === "string" ? changeFloor.stair : undefined,
        Array.isArray(changeFloor.loc) ? changeFloor.loc.join(",") : undefined,
      ].filter(Boolean).join(" / ")
    : undefined;
  return (
    <section className="locSchemaSummary" data-test-id="loc-summary">
      <div>
        <strong>位置</strong>
        {" "}
        <span data-test-id="loc-selected-position">{target.pos.x},{target.pos.y}</span>
        {" "}
        <span>{target.floorId}</span>
      </div>
      {destination ? <div data-test-id="loc-change-floor-summary">楼层切换: {destination}</div> : null}
    </section>
  );
};

const LocSchemaTable: FC<{ target: LocTarget }> = ({ target }) => {
  const [floor] = useResourceSuspense(projectData.floor(target.floorId));
  const locData = useMemo(() => getLocDataFromFloor(floor, target.pos), [floor, target.pos]);
  const rawBlockIdnum = floor.map?.[target.pos.y]?.[target.pos.x];
  const block = rawBlockIdnum === 0 && typeof floor.defaultGround === "string"
    ? floor.defaultGround
    : rawBlockIdnum;
  const scope = useMemo<SchemaScope>(() => {
    const writeLocBatch = async (updates: readonly ReferenceUpdate[]) => {
      const actions: Action[] = updates.map(({ path, slot }) => {
        if (path.length !== 1) throw new Error("地图选点字段只允许写入顶层点位属性");
        return slot.present
          ? ["change", buildFieldPath([...path]), slot.value]
          : ["delete", buildFieldPath([...path]), undefined];
      });
      if (actions.length === 0) return;
      const result = await locCommands.patch(target.floorId, target.pos, actions);
      if (!result.ok) throw new Error(`${result.stage}: ${result.error.message}`);
      notifySuccess("保存成功！");
    };
    const writeLoc = (path: readonly string[], slot: ReferenceUpdate["slot"]) => (
      writeLocBatch([{ path, slot }])
    );
    return {
      roots: {
        loc: new ObjectReferenceRoot("loc", () => locData, writeLoc, writeLocBatch),
        params: new ObjectReferenceRoot("params", () => ({
          floorId: target.floorId,
          position: target.pos,
          blockIdnum: block,
        })),
      },
    };
  }, [block, locData, target.floorId, target.pos]);
  const diagnostics = useMemo(() => buildLocDiagnostics(locData), [locData]);
  return (
    <>
      <LocSummary target={target} locData={locData} />
      <ProjectSchemaTable
        definition={locSchemaDefinition}
        scope={scope}
        diagnostics={diagnostics}
      />
    </>
  );
};

const LegacyLocPanelContent: FC<{ target: LocTarget; editMode: EditMode }> = ({ target, editMode }) => {
  const meta = useLocTableMetaSuspense();
  return <LocTable target={target} meta={meta as CommentObject} editMode={editMode} />;
};

const LocPanelContent: FC<LocPanelContentProps> = ({ editMode, floorId, tableVersion }) => {
  const selection = useCurrentLocSelection();
  const target = useMemo(
    () => resolveLocTarget(
      selection && floorId ? { ...selection, floorId } : selection,
      floorId,
    ),
    [selection, floorId],
  );

  // 如果没有选中位置，显示空状态
  if (!selection) {
    return <div data-test-id="loc-empty-state">请选择一个位置</div>;
  }

  // 如果没有当前楼层，显示空状态
  if (!target) {
    return <div data-test-id="loc-empty-state">请先选择一个楼层</div>;
  }

  return tableVersion === "schema"
    ? <LocSchemaTable target={target} />
    : <LegacyLocPanelContent target={target} editMode={editMode} />;
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
    () => resolveLocTarget(
      selection && floorId ? { ...selection, floorId } : selection,
      floorId,
    ),
    [selection, floorId],
  );

  // 在 Panel 层维护 editMode（不依赖数据）
  const [editMode, setEditMode] = useState<EditMode>("change");
  const [tableVersion, setTableVersion] = useState<LocTableVersion>("schema");

  // 保存按钮点击处理
  const handleSave = useCallback(async () => {
    if (!floorId) {
      notifyError("请先选择一个楼层");
      return;
    }
    try {
      await persistenceMonitor.flush([projectData.floor(floorId).path]);
      notifySuccess("保存完成");
    } catch {
      // The global persistence notification owns retry and error details.
    }
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

  // 操作按钮区域（始终显示）
  const actions = (
    <>
      <Segmented
        size="small"
        data-test-id="loc-table-version"
        value={tableVersion}
        onChange={(value) => setTableVersion(value as LocTableVersion)}
        options={[
          { label: "新版", value: "schema" },
          { label: "旧版", value: "legacy" },
        ]}
      />
      {tableVersion === "legacy" ? (
        <>
          &nbsp;&nbsp;
          <button onClick={handleSave}>保存</button>
          &nbsp;&nbsp;
          <EditModeSegmented value={editMode} onChange={setEditMode} />
          &nbsp;&nbsp;
          <button onClick={handleAddAutoEvent}>添加自动事件页</button>
        </>
      ) : <SchemaCustomizationButton definition={locSchemaDefinition} />}
    </>
  );

  return (
    <ContentLeftTab id="left2" testId="panel-loc" title="地图选点" actions={actions}>
      <LocPanelContent editMode={editMode} floorId={floorId} tableVersion={tableVersion} />
    </ContentLeftTab>
  );
};
