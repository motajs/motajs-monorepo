/**
 * MaterialImage - 素材图片组件
 *
 * 内部加载图片，处理点击事件，包含选中框
 */

import { useState, useEffect, useCallback, useMemo, useRef, type FC, type MouseEvent } from 'react';
import { useImageAssetUrl } from '@/hooks/useImageAssetUrl';
import { Grid, type GridPOD, type LocPOD } from '@/utils/coordinate';
import { createMaterialLayout } from './layout';
import type { MaterialImageProps } from './types';

export const MaterialImage: FC<MaterialImageProps> = ({
  id,
  path,
  materialType,
  grid,
  folded,
  foldPerCol,
  selection,
  selectRegion = false,
  layoutKind = 'rows',
  onClick,
}) => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [dragPreview, setDragPreview] = useState<{ start: LocPOD; end: LocPOD } | null>(null);
  const dragStart = useRef<LocPOD | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { url: imageSrc, revision } = useImageAssetUrl(path);

  useEffect(() => {
    if (!imageSrc) return;
    const next = new Image();
    next.onload = () => setImage(next);
    next.src = imageSrc;
  }, [imageSrc, revision]);

  const layout = useMemo(
    () =>
      createMaterialLayout({
        sourceSize: image ? [image.width, image.height] : [0, 0],
        cellSize: grid,
        mode: folded ? 'folded' : 'full',
        rowsPerColumn: foldPerCol,
        kind: layoutKind,
      }),
    [foldPerCol, folded, grid, image, layoutKind],
  );

  const renderFoldedCanvas = folded && layoutKind !== 'spatial';

  useEffect(() => {
    if (!renderFoldedCanvas || !image) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    canvas.width = layout.displaySize[0];
    canvas.height = layout.displaySize[1];
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = false;
    for (const { source, target } of layout.cells) {
      context.drawImage(
        image,
        source.x,
        source.y,
        source.width,
        source.height,
        target.x,
        target.y,
        target.width,
        target.height,
      );
    }
  }, [image, layout, renderFoldedCanvas, revision]);

  const eventGridLoc = useCallback(
    (e: MouseEvent<HTMLElement>): LocPOD | null => {
      if (!image) return null;
      const pixelLoc: LocPOD = [e.nativeEvent.offsetX, e.nativeEvent.offsetY];
      return layout.displayToSource(Grid.unmapLoc(pixelLoc, grid));
    },
    [grid, image, layout],
  );

  const imageGridSize = useMemo<GridPOD>(
    () => (image ? [Math.floor(image.width / grid[0]), Math.floor(image.height / grid[1])] : [0, 0]),
    [grid, image],
  );

  const handleMouseDown = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      const start = eventGridLoc(event);
      dragStart.current = start;
      if (selectRegion && start) setDragPreview({ start, end: start });
    },
    [eventGridLoc, selectRegion],
  );

  const handleMouseMove = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (!selectRegion || !dragStart.current) return;
      const end = eventGridLoc(event);
      if (end) setDragPreview({ start: dragStart.current, end });
    },
    [eventGridLoc, selectRegion],
  );

  const handleMouseUp = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      const end = eventGridLoc(event);
      if (!end) return;
      const start = selectRegion && dragStart.current ? dragStart.current : end;
      dragStart.current = null;
      setDragPreview(null);
      const x0 = Math.min(start[0], end[0]);
      const y0 = Math.min(start[1], end[1]);
      const x1 = Math.max(start[0], end[0]);
      const y1 = Math.max(start[1], end[1]);
      onClick(id, [x0, y0], grid, [x1 - x0 + 1, y1 - y0 + 1], imageGridSize);
    },
    [eventGridLoc, id, imageGridSize, grid, onClick, selectRegion],
  );

  useEffect(() => {
    if (!dragPreview) return;
    const cancelDrag = () => {
      dragStart.current = null;
      setDragPreview(null);
    };
    window.addEventListener('mouseup', cancelDrag);
    return () => window.removeEventListener('mouseup', cancelDrag);
  }, [dragPreview]);

  const handleContextMenu = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (!selectRegion) return;
      event.preventDefault();
      const start = eventGridLoc(event);
      if (!start) return;
      const value = window.prompt('请输入该额外素材区域绑定宽高，以逗号分隔', '1,1');
      if (!value || !/^\d+,\d+$/.test(value)) return;
      const [width, height] = value.split(',').map(Number);
      if (width <= 0 || height <= 0 || start[0] + width > imageGridSize[0] || start[1] + height > imageGridSize[1]) {
        window.alert('不合法的输入范围，已经越界');
        return;
      }
      onClick(id, start, grid, [width, height], imageGridSize);
    },
    [eventGridLoc, grid, id, imageGridSize, onClick, selectRegion],
  );

  if (!image || !imageSrc) {
    return null;
  }

  // 判断是否选中，计算选中框位置
  const isSelected = selection?.id === id;
  const selectionDisplayLoc = isSelected ? layout.sourceToDisplay(selection.gridLoc) : null;
  const selectionPixelLoc = selectionDisplayLoc ? Grid.mapLoc(selectionDisplayLoc, grid) : null;

  const sharedProps = {
    'data-test-id': `material-image-${id}`,
    draggable: false,
    onMouseDown: handleMouseDown,
    onMouseMove: handleMouseMove,
    onMouseUp: handleMouseUp,
    onContextMenu: handleContextMenu,
    style: { imageRendering: 'pixelated', display: 'block' } as const,
  };

  const dragRect = dragPreview
    ? {
        x: Math.min(dragPreview.start[0], dragPreview.end[0]),
        y: Math.min(dragPreview.start[1], dragPreview.end[1]),
        width: Math.abs(dragPreview.start[0] - dragPreview.end[0]) + 1,
        height: Math.abs(dragPreview.start[1] - dragPreview.end[1]) + 1,
      }
    : null;

  return (
    <div
      data-material-layout={folded ? 'folded' : 'full'}
      style={{ position: 'relative', width: layout.displaySize[0], height: layout.displaySize[1] }}
    >
      {renderFoldedCanvas ? (
        <canvas ref={canvasRef} title={materialType} {...sharedProps} />
      ) : (
        <img src={imageSrc} alt={materialType} {...sharedProps} />
      )}
      {selectRegion && dragRect ? (
        <div
          className="materialRegionPreview"
          data-test-id={`material-region-preview-${id}`}
          style={{
            left: dragRect.x * grid[0],
            top: dragRect.y * grid[1],
            width: dragRect.width * grid[0],
            height: dragRect.height * grid[1],
          }}
        />
      ) : null}
      {isSelected && selectionPixelLoc && (
        <div
          className="dataSelection"
          data-test-id={`material-selection-${id}`}
          style={{
            left: selectionPixelLoc[0],
            top: selectionPixelLoc[1],
            width: selection.size[0] * grid[0] - 6,
            height: selection.size[1] * grid[1] - 6,
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
};
