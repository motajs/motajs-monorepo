import { useCallback, useEffect, useMemo, useRef, type FC, type MouseEvent } from "react";
import { Segmented } from "antd";
import { useImageAssetUrl } from "@/hooks/useImageAssetUrl";

export interface LastUsedItem {
  idnum: number;
  id: string;
  images: string;
  x: number;
  y: number;
  isTile?: boolean;
  materialPath?: string;
  recent: number;
  frequent: number;
  istop?: number;
}

export type SortType = "recent" | "frequent";

export interface RecentlyUsedPanelProps {
  items: LastUsedItem[];
  selectedIdnum?: number;
  sortType: SortType;
  onSortTypeChange: (type: SortType) => void;
  onSelect?: (item: LastUsedItem) => void;
  onToggleTop?: (item: LastUsedItem, istop: boolean) => void;
  onClear?: () => void;
}

function materialPath(item: LastUsedItem): string {
  if (item.materialPath) return item.materialPath;
  if (item.isTile) return `project/tilesets/${item.images}`;
  if (item.images === "autotile") return `project/autotiles/${item.id}.png`;
  return `project/materials/${item.images}.png`;
}

const RecentTile: FC<{
  item: LastUsedItem;
  selected: boolean;
  onSelect?: (item: LastUsedItem) => void;
  onToggleTop?: (item: LastUsedItem, istop: boolean) => void;
}> = ({ item, selected, onSelect, onToggleTop }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { url, revision } = useImageAssetUrl(materialPath(item));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !url) return;
    const image = new Image();
    image.onload = () => {
      const context = canvas.getContext("2d");
      if (!context) return;
      context.clearRect(0, 0, 32, 32);
      context.imageSmoothingEnabled = false;
      const sourceHeight = item.materialPath || item.isTile || item.images === "autotile"
        ? 32
        : item.images.endsWith("48") ? 48 : 32;
      const sourceX = item.materialPath ? item.x * 32 : item.isTile ? item.x * 32 : 0;
      const sourceY = item.materialPath ? item.y * sourceHeight : item.isTile ? item.y * 32 : item.images === "autotile" ? 0 : item.y * sourceHeight;
      context.drawImage(image, sourceX, sourceY, 32, sourceHeight, 0, 0, 32, 32);
    };
    image.src = url;
  }, [item, revision, url]);

  const handleMouseUp = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (event.button === 2) onToggleTop?.(item, !item.istop);
    else onSelect?.(item);
  };

  return (
    <button
      type="button"
      data-test-id={`recent-material-${item.idnum}`}
      title={`${item.id || item.idnum} (${item.idnum})`}
      onMouseUp={handleMouseUp}
      onContextMenu={(event) => event.preventDefault()}
      style={{
        position: "relative",
        width: 32,
        height: 32,
        padding: 0,
        border: 0,
        background: "transparent",
      }}
    >
      <canvas ref={canvasRef} width={32} height={32} style={{ display: "block" }} />
      {selected ? (
        <span
          aria-hidden="true"
          data-test-id={`recent-material-selection-${item.idnum}`}
          style={{
            position: "absolute",
            inset: 0,
            border: "3px solid rgba(255,128,0,0.85)",
            boxSizing: "border-box",
            pointerEvents: "none",
          }}
        />
      ) : null}
      {item.istop ? (
        <span style={{ position: "absolute", left: 0, bottom: 0, width: 8, height: 8, background: "red" }} />
      ) : null}
    </button>
  );
};

export const RecentlyUsedPanel: FC<RecentlyUsedPanelProps> = ({
  items,
  selectedIdnum,
  sortType,
  onSortTypeChange,
  onSelect,
  onToggleTop,
  onClear,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sortedItems = useMemo(
    () => [...items].sort((a, b) => {
      if ((a.istop || 0) !== (b.istop || 0)) return (b.istop || 0) - (a.istop || 0);
      return (b[sortType] || 0) - (a[sortType] || 0);
    }),
    [items, sortType],
  );

  const handleClear = useCallback(() => {
    if (!window.confirm("你确定要清理全部最近使用图块么？\n所有最近使用和最常使用图块（含置顶图块）都将被清除；此过程不可逆！")) return;
    onClear?.();
    containerRef.current?.scrollTo(0, 0);
  }, [onClear]);

  return (
    <div id="mid2">
      <div style={{ margin: 10 }}>
        <Segmented
          size="small"
          value={sortType}
          onChange={(value) => {
            onSortTypeChange(value as SortType);
            containerRef.current?.scrollTo(0, 0);
          }}
          options={[
            { label: "最近使用", value: "recent" },
            { label: "最常使用", value: "frequent" },
          ]}
        />
        <small>（右键置顶）</small>{" "}
        <button type="button" data-test-id="recent-material-clear" onClick={handleClear}>清除</button>
      </div>
      <div className="map" id="lastUsedDiv" ref={containerRef}>
        <div
          data-test-id="recent-material-grid"
          style={{ display: "grid", gridTemplateColumns: "repeat(12, 32px)", alignContent: "start" }}
        >
          {sortedItems.map((item) => (
            <RecentTile
              key={item.idnum}
              item={item}
              selected={item.idnum === selectedIdnum}
              onSelect={onSelect}
              onToggleTop={onToggleTop}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default RecentlyUsedPanel;
