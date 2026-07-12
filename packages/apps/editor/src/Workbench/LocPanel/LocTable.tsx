import { useCallback, useMemo, type FC } from "react";
import { Table } from "@/components/Table";
import { useResourceSuspense } from "@/hooks/suspense";
import { locCommands } from "@/project/commands/locCommands";
import { projectData } from "@/project/data/projectData";
import {
  getLocDataFromFloor,
  type LocData,
  type LocTarget,
} from "@/project/model/locModel";
import { notifyCommandResult, notifyError } from "@/utils/notify";
import type { EditMode, TableAction } from "@/components/Table/types";
import type { CommentObject } from "@/components/Table";

interface LocTableProps {
  target: LocTarget;
  meta: CommentObject;
  editMode: EditMode;
}

function hasChangeFloor(locData: LocData): locData is LocData & { changeFloor: Record<string, unknown> } {
  return !!locData.changeFloor && typeof locData.changeFloor === "object" && !Array.isArray(locData.changeFloor);
}

function describeChangeFloor(locData: LocData): string | null {
  if (!hasChangeFloor(locData)) return null;
  const floorId = typeof locData.changeFloor.floorId === "string" ? locData.changeFloor.floorId : "?";
  const stair = typeof locData.changeFloor.stair === "string" ? locData.changeFloor.stair : null;
  const loc = Array.isArray(locData.changeFloor.loc) ? locData.changeFloor.loc.join(",") : null;
  return [floorId, stair, loc].filter(Boolean).join(" / ");
}

export const LocTable: FC<LocTableProps> = ({ target, meta, editMode }) => {
  const [floorData] = useResourceSuspense(projectData.floor(target.floorId));

  const locData = useMemo(
    () => getLocDataFromFloor(floorData, target.pos),
    [floorData, target.pos]
  );
  const changeFloor = useMemo(() => describeChangeFloor(locData), [locData]);

  const handleChange = useCallback(
    async (action: TableAction) => {
      try {
        const result = await locCommands.patch(target.floorId, target.pos, [action]);
        notifyCommandResult(result, "保存成功！");
      } catch (err) {
        notifyError(err);
      }
    },
    [target]
  );

  return (
    <div id="locTable" data-test-id="loc-table">
      <section
        data-test-id="loc-summary"
        style={{ margin: "8px 15px 10px", fontSize: 13, lineHeight: 1.8 }}
      >
        <div>
          <strong>位置</strong>
          {" "}
          <span data-test-id="loc-selected-position">{target.pos.x},{target.pos.y}</span>
          {" "}
          <span style={{ color: "#666" }}>{target.floorId}</span>
        </div>
        {changeFloor ? (
          <div data-test-id="loc-change-floor-summary">楼层切换: {changeFloor}</div>
        ) : null}
      </section>
      <Table
        data={locData}
        commentObj={meta}
        onChange={handleChange}
        editMode={editMode}
      />
    </div>
  );
};
