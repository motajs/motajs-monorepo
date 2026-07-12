import { useCallback, useEffect, useRef, type FC, type MouseEvent } from "react";
import { Grid, Loc } from "@/utils/coordinate";
import { clearCanvas } from "@/utils/canvas/clear";
import { drawCheckboard } from "@/utils/canvas/checkboard";
import type { GridCanvasProps } from "./types";

/**
 * 通用网格画布组件
 * 负责渲染源图像和标记层，并处理网格坐标的点击事件
 */
export const GridCanvas: FC<GridCanvasProps> = (props) => {
  const {
    source,
    width,
    height,
    gridSize,
    offset = Loc.ZERO,
    markers = [],
    showCheckboard = false,
    onClick,
    onContextMenu,
    style,
    className,
    testId,
  } = props;

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 渲染 canvas
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 1. 清空 canvas
    clearCanvas(ctx);

    // 2. 绘制棋盘格背景（如果启用）
    if (showCheckboard) {
      drawCheckboard(ctx);
    }

    // 3. 绘制 source（如果有）
    if (source) {
      ctx.drawImage(source, 0, 0);
    }

    // 4. 遍历 markers，按顺序调用 render
    // 像素位置 = 网格位置 * 网格尺寸 + 偏移
    markers.forEach((marker) => {
      const pixelPos = Loc.add(Grid.mapLoc(marker.gridPos, gridSize), offset);
      marker.render(ctx, pixelPos, gridSize);
    });
  }, [source, markers, gridSize, offset, showCheckboard]);

  // 当依赖变化时重新渲染
  useEffect(() => {
    render();
  }, [render]);

  // 处理点击事件
  const handleClick = useCallback(
    (event: MouseEvent<HTMLCanvasElement>) => {
      if (!onClick) return;

      const { offsetX, offsetY } = event.nativeEvent;
      // 网格位置 = (像素位置 - 偏移) / 网格尺寸
      const gridPos = Grid.unmapLoc([offsetX - offset[0], offsetY - offset[1]], gridSize);
      onClick(gridPos, event);
    },
    [onClick, gridSize, offset],
  );

  // 处理右键菜单事件
  const handleContextMenu = useCallback(
    (event: MouseEvent<HTMLCanvasElement>) => {
      if (!onContextMenu) return;

      event.preventDefault();
      const { offsetX, offsetY } = event.nativeEvent;
      // 网格位置 = (像素位置 - 偏移) / 网格尺寸
      const gridPos = Grid.unmapLoc([offsetX - offset[0], offsetY - offset[1]], gridSize);
      onContextMenu(gridPos, event);
    },
    [onContextMenu, gridSize, offset],
  );

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={style}
      className={className}
      data-test-id={testId}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    />
  );
};
