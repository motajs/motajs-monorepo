import { useCallback, useEffect, useState, type FC } from "react";
import { ContentLeftTab } from "../components/ContentLeftTab";
import { Table, EditModeSegmented } from "@/components/Table";
import { useTableMetaEditor } from "@/components/Table/hooks";
import { selectFloorMeta, useTableMetaSuspense } from "@/hooks";
import { useResourceSuspense } from "@/hooks/suspense";
import { projectData } from "@/project/data/projectData";
import { floorCommands } from "@/project/commands";
import { notifyCommandResult, notifyError } from "@/utils/notify";
import { useCurrentFloorId, setCurrentFloorId } from "@/stores/editorState";
import { isValidFloorId } from "@/utils/string";
import type { EditMode, TableAction } from "@/components/Table/types";
import type { Action } from "@/utils/action";

function getFallbackFloorId(tower: { firstData?: { floorId?: string }; main?: { floorIds?: string[] } }): string | undefined {
  return tower.firstData?.floorId || tower.main?.floorIds?.[0];
}

interface FloorPanelReadyProps {
  editMode: EditMode;
  floorId: string;
  floorIds: string[];
}

const FloorPanelReady: FC<FloorPanelReadyProps> = ({ editMode, floorId, floorIds }) => {
  const [floor] = useResourceSuspense(projectData.floor(floorId));
  const meta = selectFloorMeta(useTableMetaSuspense("comment"));
  const [floorIdValue, setFloorIdValue] = useState("");
  const [newWidth, setNewWidth] = useState("13");
  const [newHeight, setNewHeight] = useState("13");
  const [offsetX, setOffsetX] = useState("0");
  const [offsetY, setOffsetY] = useState("0");

  useEffect(() => {
    setNewWidth(String(floor.width ?? 13));
    setNewHeight(String(floor.height ?? 13));
  }, [floor.floorId, floor.width, floor.height]);

  const handleChange = useCallback(
    async (action: TableAction) => {
      try {
        const result = await floorCommands.patch(floorId, [action as Action]);
        notifyCommandResult(result, "保存成功！");
      } catch (err) {
        notifyError(err);
      }
    },
    [floorId],
  );

  const handleChangeFloorId = useCallback(async () => {
    const newFloorId = floorIdValue.trim();
    if (!newFloorId) {
      notifyError("请输入要修改到的 floorId");
      return;
    }
    if (newFloorId === floorId) {
      setFloorIdValue("");
      return;
    }
    if (!isValidFloorId(newFloorId)) {
      notifyError(`楼层名 ${newFloorId} 不合法！请使用字母、数字、下划线，且不能以数字开头！`);
      return;
    }
    if (floorIds.some((id) => id.toLowerCase() === newFloorId.toLowerCase())) {
      notifyError(`楼层名 ${newFloorId} 已存在！`);
      return;
    }

    const result = await floorCommands.rename(floorId, newFloorId);
    if (notifyCommandResult(result, "修改 floorId 成功！")) {
      setCurrentFloorId(newFloorId);
      setFloorIdValue("");
    }
  }, [floorId, floorIdValue, floorIds]);

  const handleChangeFloorSize = useCallback(async () => {
    const width = Number.parseInt(newWidth, 10);
    const height = Number.parseInt(newHeight, 10);
    let x = Number.parseInt(offsetX, 10);
    let y = Number.parseInt(offsetY, 10);

    if (!Number.isInteger(width) || !Number.isInteger(height) || !Number.isInteger(x) || !Number.isInteger(y)) {
      notifyError("参数错误！宽、高、偏移量都必须是整数");
      return;
    }
    if (width <= 0 || height <= 0 || width > 128 || height > 128) {
      notifyError("参数错误！宽高必须在 1 到 128 之间");
      return;
    }
    if (x < 0 || y < 0) {
      notifyError("参数错误！偏移量不得小于0");
      return;
    }

    const currentWidth = floor.width ?? 13;
    const currentHeight = floor.height ?? 13;
    if (width < currentWidth) x = -x;
    if (height < currentHeight) y = -y;

    const result = await floorCommands.resize(floorId, {
      width,
      height,
      offsetX: x,
      offsetY: y,
    });
    notifyCommandResult(result, "地图大小修改成功，请检查所有点的事件是否存在问题。");
  }, [floorId, floor, newWidth, newHeight, offsetX, offsetY]);

  return (
    <>
      <Table
        data={floor}
        commentObj={meta}
        onChange={handleChange}
        editMode={editMode}
      />

      <div id="changeFloorId" data-test-id="floor-rename">
        <input
          data-test-id="floor-rename-input"
          value={floorIdValue}
          onChange={(e) => setFloorIdValue(e.target.value)}
          placeholder="修改 floorId 为"
        />
        <button data-test-id="floor-rename-submit" onClick={handleChangeFloorId}>确定</button>
      </div>

      <div id="changeFloorSize" data-test-id="floor-resize" style={{ fontSize: 13 }}>
        修改地图大小：宽
        <input
          style={{ width: 25 }}
          value={newWidth}
          onChange={(e) => setNewWidth(e.target.value)}
        />
        ，高
        <input
          style={{ width: 25 }}
          value={newHeight}
          onChange={(e) => setNewHeight(e.target.value)}
        />
        ，偏移 x
        <input
          style={{ width: 25 }}
          value={offsetX}
          onChange={(e) => setOffsetX(e.target.value)}
        />
        y
        <input
          style={{ width: 25 }}
          value={offsetY}
          onChange={(e) => setOffsetY(e.target.value)}
        />
        <button onClick={handleChangeFloorSize}>确定</button>
      </div>
    </>
  );
};

export const FloorPanel: FC = () => {
  const [tower] = useResourceSuspense(projectData.tower());
  const currentFloorId = useCurrentFloorId();
  const floorId = currentFloorId ?? getFallbackFloorId(tower);

  const [editMode, setEditMode] = useState<EditMode>("change");
  const { openEditor } = useTableMetaEditor("comment");

  useEffect(() => {
    if (!currentFloorId && floorId) {
      setCurrentFloorId(floorId);
    }
  }, [currentFloorId, floorId]);

  const handleConfigure = useCallback(() => {
    openEditor();
  }, [openEditor]);

  const actions = (
    <>
      <EditModeSegmented value={editMode} onChange={setEditMode} />
      &nbsp;&nbsp;
      <button onClick={handleConfigure}>配置表格</button>
    </>
  );

  return (
    <ContentLeftTab id="left4" testId="panel-floor" title="楼层属性" actions={actions}>
      {!floorId ? (
        <div>请先选择一个楼层</div>
      ) : (
        <FloorPanelReady
          floorId={floorId}
          floorIds={tower.main.floorIds}
          editMode={editMode}
        />
      )}
    </ContentLeftTab>
  );
};
