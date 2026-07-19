/**
 * MaterialPanel - 素材面板组件
 *
 * 显示所有可用素材，支持点击选择
 */

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  type FC,
} from "react";
import { SettingOutlined } from "@ant-design/icons";
import { Button, InputNumber, Popover, Space, Tooltip } from "antd";
import { useModelResourceSuspense } from "@/hooks/suspense";
import {
  projectModel,
  type BlockRegistry,
  type MaterialCatalog,
  type RegistryBlockInfo,
  type TilesetCatalog,
  tilesetCellIdnum,
} from "@/project/model/projectModel";
import { MATERIAL_SHEET_IMAGES, materialRowHeight } from "@/project/assets";
import { useConfigItem } from "@/stores/useEditorConfig";
import { type LocPOD, type GridPOD } from "@/utils/coordinate";
import { MaterialImage } from "./MaterialImage";
import { TerrainMaterialGroup } from "./TerrainMaterialGroup";
import type { BlockInfo, MaterialPanelProps, SelectedBlock } from "./types";

/** 素材类型配置 */
const MATERIAL_TYPES = MATERIAL_SHEET_IMAGES
  .filter((name) => name !== "terrains")
  .map((name) => ({
    name,
    path: `project/materials/${name}.png`,
    grid: [32, materialRowHeight(name)] as GridPOD,
  }));

export const MaterialPanel: FC<MaterialPanelProps> = ({
  selectedBlock,
  onSelectedBlockChange,
  onTileSizeChange,
}) => {
  const iconLibRef = useRef<HTMLDivElement>(null);
  const blockRegistryResource = useMemo(() => projectModel.blockRegistry(), []);
  const blockRegistry = useModelResourceSuspense(blockRegistryResource);
  const materialCatalogResource = useMemo(() => projectModel.materialCatalog(), []);
  const materialCatalog = useModelResourceSuspense(materialCatalogResource);
  const tilesetCatalogResource = useMemo(() => projectModel.tilesetCatalog(), []);
  const tilesetCatalog = useModelResourceSuspense(tilesetCatalogResource);

  // 折叠状态（持久化）
  const [folded, setFolded] = useConfigItem("folded", false);
  const [foldPerCol, setFoldPerCol] = useConfigItem("foldPerCol", 50);

  const autotileFiles = (materialCatalog.byImages.get("autotile") ?? [])
    .flatMap((entry) => entry.slot.kind === "file" ? [`${entry.slot.name}.png`] : []);

  // 当前选中的素材 ID 和格子位置
  const [selection, setSelection] = useState<{
    id: string;
    gridLoc: LocPOD;
    size: GridPOD;
  } | null>(null);
  const previousCounts = useRef<Map<string, number> | null>(null);

  const displayedSelection = useMemo(() => {
    if (!selectedBlock || typeof selectedBlock !== "object") return selection;
    const next = selectedBlock.idnum === 17
      ? { id: "airwall", gridLoc: [0, 0] as LocPOD, size: [1, 1] as GridPOD }
      : selectedBlock.images === "autotile"
        ? { id: `autotile:${selectedBlock.id}.png`, gridLoc: [0, 0] as LocPOD, size: [1, 1] as GridPOD }
        : selectedBlock.isTile || selectedBlock.idnum >= 10000
          ? {
              id: `tileset:${selectedBlock.images}`,
              gridLoc: [selectedBlock.x ?? 0, selectedBlock.y] as LocPOD,
              size: [1, 1] as GridPOD,
            }
          : {
              id: selectedBlock.images,
              gridLoc: [0, selectedBlock.y] as LocPOD,
              size: [1, 1] as GridPOD,
            };
    return selection?.id === next.id
      && selection.gridLoc[0] === next.gridLoc[0]
      && selection.gridLoc[1] === next.gridLoc[1]
      ? selection
      : next;
  }, [selectedBlock, selection]);

  useEffect(() => {
    const counts = new Map(
      [...materialCatalog.byImages].map(([images, entries]) => [images, entries.length]),
    );
    const previous = previousCounts.current;
    previousCounts.current = counts;
    if (!previous || !selectedBlock || typeof selectedBlock !== "object") return;
    const before = previous.get(selectedBlock.images) ?? 0;
    const after = counts.get(selectedBlock.images) ?? 0;
    if (after < before) {
      let active = true;
      queueMicrotask(() => {
        if (!active) return;
        setSelection(null);
        onSelectedBlockChange(0);
      });
      return () => { active = false; };
    }
  }, [materialCatalog, onSelectedBlockChange, selectedBlock]);

  // 处理素材点击
  const handleMaterialClick = useCallback(
    (id: string, gridLoc: LocPOD, _grid: GridPOD, size: GridPOD) => {
      const info = resolveSelectedBlock(
        id,
        gridLoc,
        blockRegistry,
        materialCatalog,
        tilesetCatalog,
      );
      onSelectedBlockChange(info);
      onTileSizeChange?.(id.startsWith("tileset:") ? size : [1, 1]);
      setSelection({ id, gridLoc, size: id.startsWith("tileset:") ? size : [1, 1] });
    },
    [blockRegistry, materialCatalog, onSelectedBlockChange, onTileSizeChange, tilesetCatalog],
  );

  const handleClearSelect = useCallback(() => {
    onSelectedBlockChange(0);
    onTileSizeChange?.([1, 1]);
    setSelection({ id: "clear", gridLoc: [0, 0], size: [1, 1] });
  }, [onSelectedBlockChange, onTileSizeChange]);

  const handleToggleFold = useCallback(() => setFolded(!folded), [folded, setFolded]);

  const foldSettings = (
    <Space direction="vertical" size={4}>
      <span>每列行数</span>
      <InputNumber
        data-test-id="material-fold-rows"
        min={1}
        precision={0}
        value={foldPerCol}
        onChange={(value) => {
          if (typeof value === "number" && Number.isInteger(value) && value > 0) setFoldPerCol(value);
        }}
      />
    </Space>
  );

  return (
    <div id="right">
      <div id="iconLib" ref={iconLibRef} data-test-id="material-scroll-area">
        <div id="iconImages" style={{ display: "flex", alignItems: "flex-start", paddingBottom: 52 }}>
          {/* clear + airwall + terrains 纵向堆叠 */}
          <TerrainMaterialGroup
            folded={folded}
            foldPerCol={foldPerCol}
            selection={displayedSelection}
            onClear={handleClearSelect}
            onClick={handleMaterialClick}
            airwallPath={blockRegistry.get(17)?.materialPath}
          />

          {/* 其他素材类型 */}
          {MATERIAL_TYPES.map((mat) => (
            <MaterialImage
              key={mat.name}
              id={mat.name}
              path={mat.path}
              materialType={mat.name}
              grid={mat.grid}
              folded={folded}
              foldPerCol={foldPerCol}
              selection={displayedSelection}
              onClick={handleMaterialClick}
            />
          ))}

          {/* autotiles 纵向堆叠 */}
          {autotileFiles.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {autotileFiles.map((file) => (
                <MaterialImage
                  key={file}
                  id={`autotile:${file}`}
                  path={`project/autotiles/${file}`}
                  materialType="autotile"
                  grid={[32, 32]}
                  folded={folded}
                  foldPerCol={foldPerCol}
                  selection={displayedSelection}
                  layoutKind="single"
                  onClick={handleMaterialClick}
                />
              ))}
            </div>
          )}

          {tilesetCatalog.entries.map((entry) => (
            <MaterialImage
              key={entry.name}
              id={`tileset:${entry.name}`}
              path={entry.path}
              materialType={entry.name}
              grid={[32, 32]}
              folded={false}
              foldPerCol={foldPerCol}
              selection={displayedSelection}
              selectRegion
              layoutKind="spatial"
              onClick={handleMaterialClick}
            />
          ))}
        </div>
      </div>
      <Space.Compact style={{ position: "absolute", right: 20, bottom: 30, zIndex: 80 }}>
        <Button data-test-id="material-layout-toggle" onClick={handleToggleFold}>
          {folded ? "展开素材区" : "折叠素材区"}
        </Button>
        <Popover content={foldSettings} title="折叠设置" trigger="click">
          <Tooltip title="设置折叠行数">
            <Button data-test-id="material-layout-settings" icon={<SettingOutlined />} />
          </Tooltip>
        </Popover>
      </Space.Compact>
    </div>
  );
};

export default MaterialPanel;

function toBlockInfo(block: RegistryBlockInfo): BlockInfo {
  return {
    ...block,
    idnum: block.idnum,
    id: block.id ?? "",
    images: block.images ?? block.cls ?? "terrains",
    y: typeof block.y === "number" ? block.y : block.idnum,
    x: block.x,
    isTile: block.kind === "tileset" || block.isTile,
  };
}

function findBlockBySprite(
  registry: BlockRegistry,
  images: string,
  y: number,
  id?: string,
): BlockInfo | undefined {
  for (const block of registry.values()) {
    if ((block.images ?? block.cls) !== images) continue;
    if (id && block.id !== id) continue;
    if (typeof block.y === "number" && block.y === y) return toBlockInfo(block);
  }
  return undefined;
}

function resolveSelectedBlock(
  id: string,
  gridLoc: LocPOD,
  registry: BlockRegistry,
  catalog: MaterialCatalog,
  tilesets: TilesetCatalog,
): SelectedBlock {
  const [x, y] = gridLoc;

  if (id.startsWith("tileset:")) {
    const name = id.slice("tileset:".length);
    const entry = tilesets.byName.get(name);
    if (!entry) return 0;
    const idnum = tilesetCellIdnum(entry, x, y);
    return {
      idnum,
      id: `X${idnum}`,
      images: entry.name,
      x,
      y,
      isTile: true,
    };
  }

  if (id === "airwall") {
    const registered = registry.get(17);
    return registered ? toBlockInfo(registered) : {
      idnum: 17,
      id: "airwall",
      images: "terrains",
      y: 0,
      materialPath: "project/materials/airwall.png",
    };
  }

  if (id === "terrains") {
    return findBlockBySprite(registry, "terrains", y) ?? {
      idnum: 0,
      id: "",
      images: "terrains",
      y,
    };
  }

  if (id.startsWith("autotile:")) {
    const autotileId = id.slice("autotile:".length).replace(/\.png$/i, "");
    return findBlockBySprite(registry, "autotile", 0, autotileId) ?? {
      idnum: 0,
      id: autotileId,
      images: "autotile",
      y: 0,
    };
  }

  const physical = (catalog.byImages.get(id) ?? [])
    .find((entry) => entry.slot.kind === "sheet-row" && entry.slot.row === y);
  const registeredIdnum = physical?.registrations.find((registration) => registration.idnum != null)?.idnum;
  if (registeredIdnum != null) {
    const block = registry.get(registeredIdnum);
    if (block) return toBlockInfo(block);
  }

  return findBlockBySprite(registry, id, y) ?? {
    idnum: 0,
    id: "",
    images: id,
    y,
  };
}
