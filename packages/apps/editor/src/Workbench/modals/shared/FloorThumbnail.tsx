import { useMemo, type FC } from "react";
import { useModelResourceSuspense, useResourceSuspense } from "@/hooks/suspense";
import { projectData } from "@/project/data/projectData";
import { projectModel } from "@/project/model/projectModel";
import { MapPixiRenderer } from "@/MapEditor/rendering/MapPixiRenderer";

interface FloorThumbnailProps {
  floorId: string;
  style?: React.CSSProperties;
  bigmap?: boolean;
  viewportOffset?: readonly [number, number];
}

export const FloorThumbnail: FC<FloorThumbnailProps> = (props) => {
  const {
    floorId,
    style,
    bigmap = true,
    viewportOffset = [0, 0],
  } = props;
  const [floor] = useResourceSuspense(projectData.floor(floorId));
  const [tower] = useResourceSuspense(projectData.tower());
  const blockResource = useMemo(() => projectModel.blockRegistry(), []);
  const blocks = useModelResourceSuspense(blockResource);
  const spriteResource = useMemo(() => projectModel.spriteRegistry(), []);
  const sprites = useModelResourceSuspense(spriteResource);
  const tilesets = Array.isArray(tower.main.tilesets)
    ? tower.main.tilesets.filter((name): name is string => typeof name === "string")
    : [];
  const imageNameMap = tower.main.nameMap && typeof tower.main.nameMap === "object"
    ? tower.main.nameMap as Record<string, string>
    : {};

  return (
    <div style={{ position: "relative", width: 416, height: 416, marginLeft: -10, marginTop: 5, ...style }}>
      <MapPixiRenderer
        floor={floor}
        blockRegistry={blocks}
        spriteRegistry={sprites}
        tilesets={tilesets}
        imageNameMap={imageNameMap}
        activeLayer="map"
        bigmap={bigmap}
        viewportOffset={viewportOffset}
      />
    </div>
  );
};
