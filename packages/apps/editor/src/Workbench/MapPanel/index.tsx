import { useEffect, useMemo, type FC, useRef, useState } from "react";
import { floorCommands, mapCommands } from "@/project/commands";
import { formatMapMatrixText, parseMapMatrixText } from "@/project/commands/mapMatrix";
import { projectModel } from "@/project/model/projectModel";
import {
  useFloorDataSuspense,
  useModelResourceSuspense,
  useTowerDataSuspense,
} from "@/hooks/suspense";
import { setCurrentFloorId, useCurrentFloorId } from "@/stores/editorState";
import { notifyCommandResult, notifyError, notifySuccess } from "@/utils/notify";
import { isValidFloorId } from "@/utils/string";
import { BatchCreateMapsForm } from "./BatchCreateMapsForm";

export const MapPanel: FC = () => {
  const [tower] = useTowerDataSuspense();
  const currentFloorId = useCurrentFloorId();
  const floorId = currentFloorId ?? tower.firstData?.floorId ?? tower.main.floorIds[0] ?? "MT0";
  const [floor] = useFloorDataSuspense(floorId);
  const blockRegistryResource = useMemo(() => projectModel.blockRegistry(), []);
  const blockRegistry = useModelResourceSuspense(blockRegistryResource);
  const [poutValue, setPoutValue] = useState("");
  const [newMapWidth, setNewMapWidth] = useState("13");
  const [newMapHeight, setNewMapHeight] = useState("13");
  const [newFileName, setNewFileName] = useState("");
  const [newMapStatus, setNewMapStatus] = useState(true);
  const [batchCreateMapsFormVisible, setBatchCreateMapsFormVisible] = useState(false);

  const poutRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!currentFloorId && floorId) {
      setCurrentFloorId(floorId);
    }
  }, [currentFloorId, floorId]);

  const width = floor.width ?? floor.map?.[0]?.length ?? 13;
  const height = floor.height ?? floor.map?.length ?? 13;

  const exportMap = () => {
    try {
      const filestr = formatMapMatrixText(floor.map ?? []);
      setPoutValue(filestr);
      if (poutRef.current) {
        poutRef.current.value = filestr;
        poutRef.current.focus();
        poutRef.current.setSelectionRange(0, filestr.length);
        document.execCommand("Copy");
      }
      notifySuccess("导出并复制成功！");
    } catch (error) {
      notifyError(error);
    }
  };

  const importMap = async () => {
    try {
      const mapArray = parseMapMatrixText(poutValue, { width, height });
      for (let y = 0; y < mapArray.length; y += 1) {
        for (let x = 0; x < mapArray[y].length; x += 1) {
          const idnum = mapArray[y][x];
          if (!blockRegistry.has(idnum)) {
            notifyError("当前有未定义ID（在地图区域显示红块），请用有效的图块进行覆盖！");
            return;
          }
        }
      }
      const result = await mapCommands.replaceLayer(floorId, "map", mapArray);
      notifyCommandResult(result, "地图导入成功！");
    } catch (error) {
      notifyError(error instanceof Error ? `格式错误！${error.message}` : error);
    }
  };

  const clearMap = async () => {
    if (!confirm("你确定要清除地图上所有内容么？此过程不可逆！")) return;
    const result = await mapCommands.clearFloorMap(floorId);
    notifyCommandResult(result, "地图清除成功");
  };

  const deleteMap = async () => {
    if (!confirm("你确定要删除此地图么？此过程不可逆！")) return;
    const result = await floorCommands.delete(floorId);
    if (notifyCommandResult(result, "删除成功")) {
      const remaining = tower.main.floorIds.filter((id) => id !== floorId);
      setCurrentFloorId(remaining[0] ?? "");
    }
  };

  const createNewMap = async () => {
    if (!newFileName) return;

    if (tower.main.floorIds.some((id) => id.toLowerCase() === newFileName.toLowerCase())) {
      notifyError("同名楼层已存在！(不区分大小写)");
      return;
    }

    if (!isValidFloorId(newFileName)) {
      notifyError("楼层名不合法！请使用字母、数字、下划线，且不能以数字开头！");
      return;
    }

    const nextWidth = parseInt(newMapWidth, 10);
    const nextHeight = parseInt(newMapHeight, 10);
    if (Number.isNaN(nextWidth) || Number.isNaN(nextHeight) || nextWidth > 128 || nextHeight > 128) {
      notifyError("新建地图的宽高都不得大于128");
      return;
    }

    const result = await floorCommands.create(newFileName, {
      title: newMapStatus ? undefined : newFileName,
      name: newMapStatus ? undefined : newFileName,
      width: nextWidth,
      height: nextHeight,
    });
    if (notifyCommandResult(result, "新建成功")) {
      setCurrentFloorId(newFileName);
    }
  };

  const toggleBatchCreateMapsForm = () => {
    setBatchCreateMapsFormVisible(!batchCreateMapsFormVisible);
  };

  return (
    <div id="left" className="leftTab" data-test-id="panel-map">
      {/* map */}
      <div id="arrEditor">
        <table className="col" id="arrColMark" />
        <table className="row" id="arrRowMark" />
        <div id="mapEditArea">
          <textarea
            ref={poutRef}
            cols={10}
            rows={10}
            id="pout"
            data-test-id="map-panel-textarea"
            value={poutValue}
            onChange={(e) => setPoutValue(e.target.value)}
          />
        </div>
        <div id="editTip">
          <input type="button" defaultValue="新建空白地图" onClick={createNewMap} data-test-id="map-create-submit" />
          <input
            id="newFileName"
            data-test-id="map-create-id"
            placeholder="新楼层id"
            style={{ width: 70 }}
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
          />
          <span style={{ verticalAlign: "bottom" }}>宽</span>
          <input
            id="newMapWidth"
            data-test-id="map-create-width"
            style={{ width: 20 }}
            value={newMapWidth}
            onChange={(e) => setNewMapWidth(e.target.value)}
          />
          <span style={{ verticalAlign: "bottom" }}>高</span>
          <input
            id="newMapHeight"
            data-test-id="map-create-height"
            style={{ width: 20 }}
            value={newMapHeight}
            onChange={(e) => setNewMapHeight(e.target.value)}
          />
          <input
            type="checkbox"
            id="newMapStatus"
            checked={newMapStatus}
            onChange={(e) => setNewMapStatus(e.target.checked)}
            style={{ verticalAlign: "bottom" }}
          />
          <span style={{ verticalAlign: "bottom", marginLeft: "-4px" }}>
            保留楼层属性
          </span>
        </div>
        <div id="editBtns">
          <input type="button" defaultValue="导出并复制地图" id="exportMap" onClick={exportMap} data-test-id="map-export-submit" />
          <input type="button" defaultValue="从框中导入地图" id="importMap" onClick={importMap} data-test-id="map-import-submit" />
          <input type="button" defaultValue="清除地图" id="clearMapButton" onClick={clearMap} data-test-id="map-clear-submit" />
          <input type="button" defaultValue="删除地图" id="deleteMap" onClick={deleteMap} data-test-id="map-delete-submit" />
        </div>
        <input type="button" defaultValue="批量创建空白地图 ↓" id="newMaps" onClick={toggleBatchCreateMapsForm} data-test-id="map-batch-toggle" />
        <BatchCreateMapsForm visible={batchCreateMapsFormVisible} />
      </div>
    </div>
  );
};
