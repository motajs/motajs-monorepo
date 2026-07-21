import {
  ContentValueSource,
  ObjectReferenceRoot,
  ProjectSchemaTable,
  RegistryReferenceRoot,
  SchemaCustomizationButton,
  type SchemaScope,
} from "@/components/SchemaTable";
import { floorSchemaDefinition } from "@/components/SchemaTable/builtinSchemas";
import { EditModeSegmented, Table } from "@/components/Table";
import type { EditMode, TableAction } from "@/components/Table/types";
import type { Content } from "@/fs/types";
import { selectFloorMeta, useTableMetaSuspense } from "@/hooks";
import { useResourceSuspense } from "@/hooks/suspense";
import { projectAssets } from "@/project/assets";
import type { AssetDirectorySnapshot } from "@/project/assets";
import { floorCommands } from "@/project/commands";
import { projectData } from "@/project/data/projectData";
import { buildFloorDiagnostics } from "@/project/model/floorDiagnostics";
import { setCurrentFloorId, useCurrentFloorId } from "@/stores/editorState";
import type { FloorData } from "@/types";
import type { Action } from "@/utils/action";
import { buildFieldPath } from "@/utils/fieldPath";
import { notifyCommandResult, notifyError, notifySuccess } from "@/utils/notify";
import { isValidFloorId } from "@/utils/string";
import { Input, InputNumber, Modal, Segmented } from "antd";
import {
  type FC,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ContentLeftTab } from "../components/ContentLeftTab";
import { FloorThumbnail } from "../modals/shared/FloorThumbnail";
import "./floor-panel.css";

type FloorTableVersion = "schema" | "legacy";

function getFallbackFloorId(
  tower: { firstData?: { floorId?: string }; main?: { floorIds?: string[] } },
): string | undefined {
  return tower.firstData?.floorId || tower.main?.floorIds?.[0];
}

interface FloorPanelReadyProps {
  editMode: EditMode;
  floorId: string;
  floorIds: string[];
  tableVersion: FloorTableVersion;
}

const LegacyFloorTable: FC<{ floor: FloorData; floorId: string; editMode: EditMode }> = ({
  floor,
  floorId,
  editMode,
}) => {
  const meta = selectFloorMeta(useTableMetaSuspense("comment"));
  const handleChange = useCallback(async (action: TableAction) => {
    try {
      const result = await floorCommands.patch(floorId, [action as Action]);
      notifyCommandResult(result, "保存成功！");
    } catch (error) {
      notifyError(error);
    }
  }, [floorId]);
  return <Table data={floor} commentObj={meta} onChange={handleChange} editMode={editMode} />;
};

function mapBgmDirectory(content: Content<AssetDirectorySnapshot>): Content<string[]> {
  if (content.status !== "loaded") return content;
  return {
    status: "loaded",
    value: content.value.entries.filter((name) => /\.(mp3|ogg|wav|m4a|flac)$/i.test(name)),
  };
}

const FloorSchemaTable: FC<{ floor: FloorData; floorId: string; onRename: () => void; onResize: () => void }> = ({
  floor,
  floorId,
  onRename,
  onResize,
}) => {
  const bgmDirectory = useMemo(() => projectAssets.directory("project/bgms"), []);
  const bgmSource = useMemo(() =>
    new ContentValueSource<string[]>(
      "project:materials.bgms",
      () => mapBgmDirectory(bgmDirectory.snapshot()),
      (listener) => bgmDirectory.subscribe(() => listener()),
      () => bgmDirectory.ensureLoaded(),
      () => bgmDirectory.reload(),
    ), [bgmDirectory]);
  const scope = useMemo<SchemaScope>(() => {
    const writeFloor = async (
      path: readonly string[],
      slot: { present: true; value: unknown } | { present: false },
    ) => {
      if (path.length === 0) throw new Error("不能直接替换整个楼层对象");
      const action: Action = slot.present
        ? ["change", buildFieldPath([...path]), slot.value]
        : ["delete", buildFieldPath([...path]), undefined];
      const result = await floorCommands.patch(floorId, [action]);
      if (!result.ok) throw new Error(`${result.stage}: ${result.error.message}`);
      notifySuccess("保存成功！");
    };
    return {
      roots: {
        floor: new ObjectReferenceRoot("floor", () => floor, writeFloor),
        params: new ObjectReferenceRoot("params", () => ({ floorId })),
        project: new RegistryReferenceRoot(new Map([["materials.bgms", bgmSource]])),
      },
    };
  }, [bgmSource, floor, floorId]);
  const diagnostics = useMemo(() => buildFloorDiagnostics(floor, floorId), [floor, floorId]);
  const fieldActions = useMemo(() =>
    new Map<string, ReactNode>([
      [
        "floor:floorId",
        <button key="rename" type="button" data-test-id="floor-rename-open" onClick={onRename}>重命名</button>,
      ],
      [
        "floor.size",
        <button key="resize" type="button" data-test-id="floor-resize-open" onClick={onResize}>调整</button>,
      ],
    ]), [onRename, onResize]);
  return (
    <ProjectSchemaTable
      definition={floorSchemaDefinition}
      scope={scope}
      diagnostics={diagnostics}
      fieldActions={fieldActions}
    />
  );
};

const FloorResizeControls: FC<{ floor: FloorData; floorId: string }> = ({ floor, floorId }) => {
  const [newWidth, setNewWidth] = useState(String(floor.width ?? 13));
  const [newHeight, setNewHeight] = useState(String(floor.height ?? 13));
  const [offsetX, setOffsetX] = useState("0");
  const [offsetY, setOffsetY] = useState("0");
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

    const result = await floorCommands.resize(floorId, { width, height, offsetX: x, offsetY: y });
    notifyCommandResult(result, "地图大小修改成功，请检查所有点的事件是否存在问题。");
  }, [floor.height, floor.width, floorId, newHeight, newWidth, offsetX, offsetY]);
  return (
    <div id="changeFloorSize" data-test-id="floor-resize" style={{ fontSize: 13 }}>
      修改地图大小：宽
      <input style={{ width: 25 }} value={newWidth} onChange={(event) => setNewWidth(event.target.value)} />
      ，高
      <input style={{ width: 25 }} value={newHeight} onChange={(event) => setNewHeight(event.target.value)} />
      ，偏移 x
      <input style={{ width: 25 }} value={offsetX} onChange={(event) => setOffsetX(event.target.value)} />
      y
      <input style={{ width: 25 }} value={offsetY} onChange={(event) => setOffsetY(event.target.value)} />
      <button onClick={handleChangeFloorSize}>确定</button>
    </div>
  );
};

type ResizeDragHandle = "move" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

interface ResizeDragState {
  handle: ResizeDragHandle;
  pointerX: number;
  pointerY: number;
  scale: number;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

function clampFloorDimension(value: number): number {
  return Math.min(128, Math.max(1, value));
}

const FloorResizeModal: FC<{ floor: FloorData; floorId: string; onClose: () => void }> = ({
  floor,
  floorId,
  onClose,
}) => {
  const oldWidth = floor.width ?? 13;
  const oldHeight = floor.height ?? 13;
  const [newWidth, setNewWidth] = useState(oldWidth);
  const [newHeight, setNewHeight] = useState(oldHeight);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [saving, setSaving] = useState(false);
  const dragRef = useRef<ResizeDragState | undefined>(undefined);

  const newLeft = -offsetX;
  const newTop = -offsetY;
  const newRight = newLeft + newWidth;
  const newBottom = newTop + newHeight;
  const minX = Math.min(0, newLeft);
  const minY = Math.min(0, newTop);
  const maxX = Math.max(oldWidth, newRight);
  const maxY = Math.max(oldHeight, newBottom);
  const padding = 2;
  const stageWidth = maxX - minX + padding * 2;
  const stageHeight = maxY - minY + padding * 2;
  const scale = Math.min(20, 440 / Math.max(1, stageWidth), 280 / Math.max(1, stageHeight));
  const originX = (padding - minX) * scale;
  const originY = (padding - minY) * scale;
  // Flex centering otherwise shifts the grid by half a cell whenever its span changes by one.
  // Quantizing the correction keeps the grid origin on whole-cell steps while resizing.
  const stageTranslateX = stageWidth % 2 === 1 ? -scale / 2 : 0;
  const stageTranslateY = stageHeight % 2 === 1 ? -scale / 2 : 0;

  const startDrag = useCallback((handle: ResizeDragHandle, event: ReactPointerEvent<HTMLElement>) => {
    if (saving) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      handle,
      pointerX: event.clientX,
      pointerY: event.clientY,
      scale,
      width: newWidth,
      height: newHeight,
      offsetX,
      offsetY,
    };
  }, [newHeight, newWidth, offsetX, offsetY, saving, scale]);

  const updateDrag = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    event.stopPropagation();
    const deltaX = Math.round((event.clientX - drag.pointerX) / drag.scale);
    const deltaY = Math.round((event.clientY - drag.pointerY) / drag.scale);
    const startLeft = -drag.offsetX;
    const startTop = -drag.offsetY;

    if (drag.handle === "move") {
      setOffsetX(drag.offsetX - deltaX);
      setOffsetY(drag.offsetY - deltaY);
      return;
    }

    if (drag.handle.includes("e")) setNewWidth(clampFloorDimension(drag.width + deltaX));
    if (drag.handle.includes("s")) setNewHeight(clampFloorDimension(drag.height + deltaY));
    if (drag.handle.includes("w")) {
      const width = clampFloorDimension(drag.width - deltaX);
      setNewWidth(width);
      setOffsetX(-(startLeft + drag.width - width));
    }
    if (drag.handle.includes("n")) {
      const height = clampFloorDimension(drag.height - deltaY);
      setNewHeight(height);
      setOffsetY(-(startTop + drag.height - height));
    }
  }, []);

  const endDrag = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    event.stopPropagation();
    dragRef.current = undefined;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const submit = useCallback(async () => {
    if (
      !Number.isInteger(newWidth) || !Number.isInteger(newHeight)
      || newWidth < 1 || newWidth > 128 || newHeight < 1 || newHeight > 128
    ) {
      notifyError("宽和高必须是 1 到 128 之间的整数");
      return;
    }
    if (!Number.isInteger(offsetX) || !Number.isInteger(offsetY)) {
      notifyError("地图偏移必须是整数");
      return;
    }
    setSaving(true);
    try {
      const result = await floorCommands.resize(floorId, { width: newWidth, height: newHeight, offsetX, offsetY });
      const cropsExistingMap = newLeft > 0 || newTop > 0 || newRight < oldWidth || newBottom < oldHeight;
      const successMessage = cropsExistingMap
        ? "地图大小修改成功，请检查被裁切区域中的事件。"
        : "地图大小修改成功！";
      if (notifyCommandResult(result, successMessage)) onClose();
    } finally {
      setSaving(false);
    }
  }, [
    floorId,
    newHeight,
    newBottom,
    newLeft,
    newRight,
    newTop,
    newWidth,
    offsetX,
    offsetY,
    oldHeight,
    oldWidth,
    onClose,
  ]);

  return (
    <Modal
      title={`调整地图尺寸（当前 ${oldWidth} × ${oldHeight}）`}
      open
      width={600}
      okText="应用调整"
      cancelText="取消"
      confirmLoading={saving}
      onCancel={() => {
        if (!saving) onClose();
      }}
      onOk={() => void submit()}
      okButtonProps={{ "data-test-id": "floor-resize-submit" }}
      destroyOnHidden
    >
      <div className="floorResizeForm">
        <div className="floorResizeDimensions">
          <label data-test-id="floor-resize-width">
            目标宽度
            <InputNumber
              min={1}
              max={128}
              precision={0}
              value={newWidth}
              onChange={(value) => {
                if (value != null) setNewWidth(value);
              }}
            />
          </label>
          <span>×</span>
          <label data-test-id="floor-resize-height">
            目标高度
            <InputNumber
              min={1}
              max={128}
              precision={0}
              value={newHeight}
              onChange={(value) => {
                if (value != null) setNewHeight(value);
              }}
            />
          </label>
        </div>

        <div className="floorResizeEditor">
          <div className="floorResizeSectionTitle">拖拽调整</div>
          <div className="floorResizeHint">拖动蓝色边缘改变范围，拖动蓝色区域移动范围；每格代表一个图块。</div>
          <div className="floorResizeGrid" data-test-id="floor-resize-preview">
            <div
              className="floorResizeGridStage"
              data-test-id="floor-resize-grid-stage"
              style={{
                width: stageWidth * scale,
                height: stageHeight * scale,
                backgroundSize: `${scale}px ${scale}px`,
                transform: `translate(${stageTranslateX}px, ${stageTranslateY}px)`,
              }}
            >
              <div
                className="floorResizeOldMap"
                data-test-id="floor-resize-old-map"
                style={{
                  left: originX,
                  top: originY,
                  width: oldWidth * scale,
                  height: oldHeight * scale,
                }}
              >
                <FloorThumbnail
                  floorId={floorId}
                  bigmap
                  viewportSize={[oldWidth * scale, oldHeight * scale]}
                  style={{ position: "absolute", inset: 0, margin: 0, pointerEvents: "none" }}
                />
                <span>{oldWidth} × {oldHeight}</span>
              </div>
              <div
                className="floorResizeNewMap"
                data-test-id="floor-resize-new-map"
                style={{
                  left: originX + newLeft * scale,
                  top: originY + newTop * scale,
                  width: newWidth * scale,
                  height: newHeight * scale,
                }}
                onPointerDown={(event) => startDrag("move", event)}
                onPointerMove={updateDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              >
                <span>{newWidth} × {newHeight}</span>
                {(["n", "ne", "e", "se", "s", "sw", "w", "nw"] as const).map((handle) => (
                  <i
                    key={handle}
                    className={`floorResizeHandle ${handle}`}
                    data-test-id={`floor-resize-handle-${handle}`}
                    onPointerDown={(event) => startDrag(handle, event)}
                    onPointerMove={updateDrag}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="floorResizeLegend">
            <span><i className="old" />当前地图</span>
            <span><i className="next" />调整后范围</span>
          </div>
        </div>

        {(newLeft > 0 || newTop > 0 || newRight < oldWidth || newBottom < oldHeight)
          ? <div className="floorResizeWarning">调整后范围之外的图块与点位事件会被删除。</div>
          : null}
      </div>
    </Modal>
  );
};

const FloorPanelReady: FC<FloorPanelReadyProps> = ({ editMode, floorId, floorIds, tableVersion }) => {
  const [floor] = useResourceSuspense(projectData.floor(floorId));
  const [floorIdValue, setFloorIdValue] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameSaving, setRenameSaving] = useState(false);
  const [resizeOpen, setResizeOpen] = useState(false);

  const openRename = useCallback(() => {
    setFloorIdValue(floorId);
    setRenameOpen(true);
  }, [floorId]);

  const closeRename = useCallback(() => {
    if (!renameSaving) setRenameOpen(false);
  }, [renameSaving]);

  const handleChangeFloorId = useCallback(async () => {
    const newFloorId = floorIdValue.trim();
    if (!newFloorId) {
      notifyError("请输入要修改到的 floorId");
      return;
    }
    if (newFloorId === floorId) {
      setFloorIdValue("");
      setRenameOpen(false);
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

    setRenameSaving(true);
    try {
      const result = await floorCommands.rename(floorId, newFloorId);
      if (notifyCommandResult(result, "修改 floorId 成功！")) {
        setCurrentFloorId(newFloorId);
        setFloorIdValue("");
        setRenameOpen(false);
      }
    } finally {
      setRenameSaving(false);
    }
  }, [floorId, floorIdValue, floorIds]);

  return (
    <>
      {tableVersion === "schema"
        ? (
            <FloorSchemaTable
              floor={floor}
              floorId={floorId}
              onRename={openRename}
              onResize={() => setResizeOpen(true)}
            />
          )
        : <LegacyFloorTable floor={floor} floorId={floorId} editMode={editMode} />}

      {tableVersion === "legacy"
        ? (
            <div id="changeFloorId" data-test-id="floor-rename">
              <input
                data-test-id="floor-rename-input"
                value={floorIdValue}
                onChange={(event) => setFloorIdValue(event.target.value)}
                placeholder="修改 floorId 为"
              />
              <button data-test-id="floor-rename-submit" onClick={handleChangeFloorId}>确定</button>
            </div>
          )
        : null}

      <Modal
        title="重命名楼层"
        open={renameOpen}
        okText="确定"
        cancelText="取消"
        confirmLoading={renameSaving}
        onCancel={closeRename}
        onOk={() => void handleChangeFloorId()}
        okButtonProps={{ "data-test-id": "floor-rename-submit" }}
        destroyOnHidden
      >
        <Input
          autoFocus
          aria-label="新的楼层 ID"
          data-test-id="floor-rename-input"
          value={floorIdValue}
          onChange={(event) => setFloorIdValue(event.target.value)}
          onPressEnter={() => void handleChangeFloorId()}
        />
      </Modal>

      {resizeOpen ? <FloorResizeModal floor={floor} floorId={floorId} onClose={() => setResizeOpen(false)} /> : null}

      {tableVersion === "legacy"
        ? (
            <FloorResizeControls
              key={`${floorId}:${String(floor.width)}:${String(floor.height)}`}
              floor={floor}
              floorId={floorId}
            />
          )
        : null}
    </>
  );
};

export const FloorPanel: FC = () => {
  const [tower] = useResourceSuspense(projectData.tower());
  const currentFloorId = useCurrentFloorId();
  const floorId = currentFloorId ?? getFallbackFloorId(tower);

  const [editMode, setEditMode] = useState<EditMode>("change");
  const [tableVersion, setTableVersion] = useState<FloorTableVersion>("schema");

  useEffect(() => {
    if (!currentFloorId && floorId) {
      setCurrentFloorId(floorId);
    }
  }, [currentFloorId, floorId]);

  const actions = (
    <>
      <Segmented
        size="small"
        data-test-id="floor-table-version"
        value={tableVersion}
        onChange={(value) => setTableVersion(value as FloorTableVersion)}
        options={[
          { label: "新版", value: "schema" },
          { label: "旧版", value: "legacy" },
        ]}
      />
      {tableVersion === "legacy"
        ? <EditModeSegmented value={editMode} onChange={setEditMode} />
        : <SchemaCustomizationButton definition={floorSchemaDefinition} />}
    </>
  );

  return (
    <ContentLeftTab id="left4" testId="panel-floor" title="楼层属性" actions={actions}>
      {!floorId ? <div>请先选择一个楼层</div> : (
        <FloorPanelReady
          floorId={floorId}
          floorIds={tower.main.floorIds}
          editMode={editMode}
          tableVersion={tableVersion}
        />
      )}
    </ContentLeftTab>
  );
};
