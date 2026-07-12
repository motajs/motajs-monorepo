import { useMemo, useState, type FC } from "react";
import { FloorThumbnail } from "../shared/FloorThumbnail";
import { useModelResourceSuspense } from "@/hooks/suspense";
import { projectModel } from "@/project/model/projectModel";

interface SelectFloorContentProps {
  value: string;
  onChange: (floorId: string) => void;
}

export const SelectFloorContent: FC<SelectFloorContentProps> = ({ value, onChange }) => {
  const [filterValue, setFilterValue] = useState("");
  const [previewFloorId, setPreviewFloorId] = useState<string | null>(null);
  const floorListResource = useMemo(() => projectModel.floorList(), []);
  const floorList = useModelResourceSuspense(floorListResource);

  const floors = useMemo(() => {
    return floorList.filter((floor) => {
      const one = floor.id;
      if (!filterValue) return true;
      return one.includes(filterValue)
        || (floor.title || "").includes(filterValue)
        || (floor.name || "").includes(filterValue);
    });
  }, [filterValue, floorList]);

  const togglePreview = (floorId: string) => {
    setPreviewFloorId((prev) => (prev === floorId ? null : floorId));
  };

  return (
    <div id="uieventExtraBody" style={{ display: "block", marginTop: "-10px" }}>
      <p style={{ marginLeft: 10, lineHeight: "25px" }}>
        搜索楼层：
        <input
          type="text"
          placeholder="楼层ID或楼层名..."
          data-test-id="floor-search"
          style={{ verticalAlign: "text-bottom" }}
          value={filterValue}
          onChange={(event) => setFilterValue(event.target.value)}
        />
        <br />
        <span id="selectFloor_floorList">
          {floors.map((floor) => {
            const one = floor.id;
            const checked = one === value;
            const isPreviewing = previewFloorId === one;
            return (
              <div key={one} data-test-id={`floor-option-${one}`}>
                <input
                  type="radio"
                  name="uievent_selectFloor"
                  checked={checked}
                  onChange={() => onChange(one)}
                />
                <span
                  style={{ cursor: "default" }}
                  onClick={() => onChange(one)}
                >
                  {one}（{floor.title ?? floor.name ?? ""}）
                </span>
                <button
                  style={{ marginLeft: 10 }}
                  data-test-id={`floor-preview-${one}`}
                  onClick={() => togglePreview(one)}
                >
                  {isPreviewing ? "收起" : "预览"}
                </button>
                {isPreviewing && (
                  <span style={{ display: "inline" }}>
                    <FloorThumbnail floorId={one} />
                  </span>
                )}
                <br />
              </div>
            );
          })}
        </span>
      </p>
    </div>
  );
};
