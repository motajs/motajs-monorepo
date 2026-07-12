/**
 * EventOverlay - 事件标记覆盖层
 *
 * 在地图上绘制事件标记、选中位置等信息
 * 迁移自 editor.drawEventBlock() 和 editor.drawPosSelection()
 */

import { useEffect, useCallback, useMemo, type FC } from "react";
import { useNode } from "@motajs/react-hooks";
import { useFloorDataSuspense, useTowerDataSuspense } from "@/hooks/suspense";
import { MapEditorStore } from "./MapEditorStore";
import { useModelResourceSuspense } from "@/hooks/suspense";
import {
  canMove,
  OPPOSITE_DIRECTION,
  projectModel,
  type FloorPassability,
  type MapDirection,
} from "@/project/model/projectModel";

/** 事件颜色映射 */
const EVENT_COLORS = {
  events: "#FF0000", // 红色 - 事件
  autoEvent: "#FFA500", // 橙色 - 自动事件
  beforeBattle: "#0000FF", // 蓝色 - 战前事件
  afterBattle: "#FFFF00", // 黄色 - 战后事件
  changeFloor: "#00FF00", // 绿色 - 楼层传送
  afterGetItem: "#00FFFF", // 青色 - 获取物品后
  afterOpenDoor: "#FF00FF", // 紫色 - 开门后
} as const;

/** Canvas 尺寸常量 */
const CANVAS_SIZE = 416; // core.__PIXELS__ 默认值
const TILE_SIZE = 32;
const GRID_SIZE = 13; // core.__SIZE__ 默认值

export interface EventOverlayProps {
  /** 楼层 ID */
  floorId: string;
}

/**
 * 获取位置的事件颜色列表
 */
function getEventColors(
  loc: string,
  floorData: Record<string, unknown>
): string[] {
  const colors: string[] = [];

  if (floorData.events?.[loc as keyof typeof floorData.events]) {
    colors.push(EVENT_COLORS.events);
  }

  const autoEvent = floorData.autoEvent as Record<string, unknown> | undefined;
  if (autoEvent?.[loc]) {
    const x = autoEvent[loc] as Record<string, unknown>;
    for (const index in x) {
      if (x[index] && (x[index] as Record<string, unknown>).data) {
        colors.push(EVENT_COLORS.autoEvent);
        break;
      }
    }
  }

  if (
    (floorData.beforeBattle as Record<string, unknown> | undefined)?.[loc]
  ) {
    colors.push(EVENT_COLORS.beforeBattle);
  }

  if (
    (floorData.afterBattle as Record<string, unknown> | undefined)?.[loc]
  ) {
    colors.push(EVENT_COLORS.afterBattle);
  }

  if (
    (floorData.changeFloor as Record<string, unknown> | undefined)?.[loc]
  ) {
    colors.push(EVENT_COLORS.changeFloor);
  }

  if (
    (floorData.afterGetItem as Record<string, unknown> | undefined)?.[loc]
  ) {
    colors.push(EVENT_COLORS.afterGetItem);
  }

  if (
    (floorData.afterOpenDoor as Record<string, unknown> | undefined)?.[loc]
  ) {
    colors.push(EVENT_COLORS.afterOpenDoor);
  }

  return colors;
}

function drawEventBlockBigmap(
  ctx: CanvasRenderingContext2D,
  floor: Record<string, unknown>,
  floorWidth: number,
  floorHeight: number,
  info: { top: number; left: number; size: number },
): void {
  const { top, left, size } = info;
  const markerSize = size / 4;
  for (let x = 0; x < floorWidth; x += 1) {
    for (let y = 0; y < floorHeight; y += 1) {
      const colors = getEventColors(`${x},${y}`, floor);
      colors.forEach((color, index) => {
        ctx.fillStyle = color;
        ctx.fillRect(left + size * x + markerSize * index, top + size * (y + 1) - markerSize, markerSize, markerSize);
      });
    }
  }
}

function drawMovableOverlay(
  ctx: CanvasRenderingContext2D,
  model: FloorPassability,
  bigmap: boolean,
  bigmapInfo: { top: number; left: number; size: number },
  viewportOffset: readonly [number, number],
): void {
  const directions: Array<{
    direction: MapDirection;
    dx: number;
    dy: number;
    line: (x: number, y: number, size: number, full: boolean) => [number, number, number, number];
  }> = [
    { direction: "left", dx: -1, dy: 0, line: (x, y, size, full) => [x, y + size * (full ? 0.2 : 0.33), x, y + size * (full ? 0.8 : 0.67)] },
    { direction: "right", dx: 1, dy: 0, line: (x, y, size, full) => [x + size, y + size * (full ? 0.2 : 0.33), x + size, y + size * (full ? 0.8 : 0.67)] },
    { direction: "up", dx: 0, dy: -1, line: (x, y, size, full) => [x + size * (full ? 0.2 : 0.33), y, x + size * (full ? 0.8 : 0.67), y] },
    { direction: "down", dx: 0, dy: 1, line: (x, y, size, full) => [x + size * (full ? 0.2 : 0.33), y + size, x + size * (full ? 0.8 : 0.67), y + size] },
  ];
  const drawOneWayArrow = (
    direction: MapDirection,
    x: number,
    y: number,
    size: number,
  ) => {
    const points: Record<MapDirection, Array<[number, number]>> = {
      left: [
        [x + size * 0.25, y + size * 0.375],
        [x, y + size * 0.5],
        [x + size * 0.25, y + size * 0.625],
      ],
      right: [
        [x + size * 0.75, y + size * 0.375],
        [x + size, y + size * 0.5],
        [x + size * 0.75, y + size * 0.625],
      ],
      up: [
        [x + size * 0.375, y + size * 0.25],
        [x + size * 0.5, y],
        [x + size * 0.625, y + size * 0.25],
      ],
      down: [
        [x + size * 0.375, y + size * 0.75],
        [x + size * 0.5, y + size],
        [x + size * 0.625, y + size * 0.75],
      ],
    };
    const triangle = points[direction];
    ctx.beginPath();
    ctx.moveTo(triangle[0][0], triangle[0][1]);
    ctx.lineTo(triangle[1][0], triangle[1][1]);
    ctx.lineTo(triangle[2][0], triangle[2][1]);
    ctx.closePath();
    ctx.fillStyle = "#ff0000";
    ctx.fill();
  };
  const drawCell = (mapX: number, mapY: number, drawX: number, drawY: number, size: number) => {
    for (const item of directions) {
      if (canMove(model, mapX, mapY, item.direction)) continue;
      const bothBlocked = !canMove(model, mapX + item.dx, mapY + item.dy, OPPOSITE_DIRECTION[item.direction]);
      const [x0, y0, x1, y1] = item.line(drawX, drawY, size, bothBlocked);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.strokeStyle = "#ff0000";
      ctx.lineWidth = 2;
      ctx.stroke();
      if (!bothBlocked) drawOneWayArrow(item.direction, drawX, drawY, size);
    }
  };

  if (bigmap) {
    const { top, left, size } = bigmapInfo;
    for (let y = 0; y < model.height; y += 1) {
      for (let x = 0; x < model.width; x += 1) drawCell(x, y, left + x * size, top + y * size, size);
    }
    return;
  }
  const startX = Math.floor(viewportOffset[0] / TILE_SIZE);
  const startY = Math.floor(viewportOffset[1] / TILE_SIZE);
  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      drawCell(startX + x, startY + y, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE);
    }
  }
}

/**
 * EventOverlay 组件
 */
export const EventOverlay: FC<EventOverlayProps> = ({ floorId }) => {
  const [canvas, mountCanvas] = useNode<HTMLCanvasElement>();
  const [floor] = useFloorDataSuspense(floorId);
  const [tower] = useTowerDataSuspense();
  const passabilityResource = useMemo(() => projectModel.floorPassability(floorId), [floorId]);
  const passability = useModelResourceSuspense(passabilityResource);
  const { state } = MapEditorStore.useStore();

  const {
    pos,
    bigmap,
    bigmapInfo,
    viewportOffset,
    showMovable,
    bindSpecialDoor,
    selectedArea,
  } = state;

  // 绘制事件标记
  const drawEventBlock = useCallback(() => {
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    const floorWidth = (floor.width ?? GRID_SIZE) as number;
    const floorHeight = (floor.height ?? GRID_SIZE) as number;

    // 显示通行度模式
    if (showMovable) {
      drawMovableOverlay(ctx, passability, bigmap, bigmapInfo, viewportOffset);
      return;
    }

    // 大地图模式
    if (bigmap) {
      drawEventBlockBigmap(ctx, floor as Record<string, unknown>, floorWidth, floorHeight, bigmapInfo);
      return;
    }

    // 获取出生点信息
    const firstData = tower.firstData as
      | { floorId: string; hero: { loc: { x: number; y: number } } }
      | undefined;

    const [offsetX, offsetY] = viewportOffset;

    // 遍历可见区域绘制事件标记
    for (let i = 0; i < GRID_SIZE; i++) {
      for (let j = 0; j < GRID_SIZE; j++) {
        const x = i + Math.floor(offsetX / TILE_SIZE);
        const y = j + Math.floor(offsetY / TILE_SIZE);
        const loc = `${x},${y}`;

        // 绘制出生点标记 "S"
        if (
          firstData &&
          floorId === firstData.floorId &&
          loc === `${firstData.hero.loc.x},${firstData.hero.loc.y}`
        ) {
          ctx.textAlign = "center";
          ctx.font = "bold 30px Verdana";
          ctx.fillStyle = "#FFFFFF";
          ctx.strokeStyle = "#000000";
          ctx.lineWidth = 2;
          ctx.strokeText("S", TILE_SIZE * i + 16, TILE_SIZE * j + 28);
          ctx.fillText("S", TILE_SIZE * i + 16, TILE_SIZE * j + 28);
        }

        // 绘制事件颜色标记
        const colors = getEventColors(loc, floor as Record<string, unknown>);
        for (let k = 0; k < colors.length; k++) {
          ctx.fillStyle = colors[k];
          ctx.fillRect(
            TILE_SIZE * i + 8 * k,
            TILE_SIZE * j + TILE_SIZE - 8,
            8,
            8
          );
        }

        // 绘制机关门绑定的怪物编号
        const enemyIndex = bindSpecialDoor.enemys.indexOf(loc);
        if (enemyIndex >= 0) {
          ctx.textAlign = "right";
          ctx.font = "14px Verdana";
          ctx.fillStyle = "#FF7F00";
          ctx.strokeStyle = "#000000";
          ctx.lineWidth = 1;
          ctx.strokeText(
            String(enemyIndex + 1),
            TILE_SIZE * i + 28,
            TILE_SIZE * j + 15
          );
          ctx.fillText(
            String(enemyIndex + 1),
            TILE_SIZE * i + 28,
            TILE_SIZE * j + 15
          );
        }

        // 绘制楼梯标记
        let symbolOffset = 0;
        const upFloor = floor.upFloor as [number, number] | undefined;
        const downFloor = floor.downFloor as [number, number] | undefined;
        const flyPoint = (floor as Record<string, unknown>).flyPoint as
          | [number, number]
          | undefined;

        if (upFloor && `${upFloor[0]},${upFloor[1]}` === loc) {
          ctx.textAlign = "left";
          ctx.font = "8px Verdana";
          ctx.fillText("🔼", TILE_SIZE * i + symbolOffset, TILE_SIZE * j + 8);
          symbolOffset += 8;
        }

        if (downFloor && `${downFloor[0]},${downFloor[1]}` === loc) {
          ctx.textAlign = "left";
          ctx.font = "8px Verdana";
          ctx.fillText("🔽", TILE_SIZE * i + symbolOffset, TILE_SIZE * j + 8);
          symbolOffset += 8;
        }

        if (flyPoint && `${flyPoint[0]},${flyPoint[1]}` === loc) {
          ctx.textAlign = "left";
          ctx.font = "8px Verdana";
          ctx.fillText("🔃", TILE_SIZE * i + symbolOffset, TILE_SIZE * j + 8);
        }
      }
    }
  }, [
    canvas,
    floor,
    tower,
    floorId,
    bigmap,
    bigmapInfo,
    viewportOffset,
    showMovable,
    bindSpecialDoor,
    passability,
  ]);

  // 绘制位置选择框
  const drawPosSelection = useCallback(() => {
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.strokeStyle = "rgba(255,255,255,0.7)";

    if (selectedArea) {
      const x0 = Math.min(selectedArea[0][0], selectedArea[1][0]);
      const y0 = Math.min(selectedArea[0][1], selectedArea[1][1]);
      const x1 = Math.max(selectedArea[0][0], selectedArea[1][0]);
      const y1 = Math.max(selectedArea[0][1], selectedArea[1][1]);
      ctx.save();
      ctx.strokeStyle = "rgba(255,128,0,0.95)";
      ctx.lineWidth = 3;
      if (bigmap) {
        const { top, left, size } = bigmapInfo;
        ctx.strokeRect(left + x0 * size, top + y0 * size, (x1 - x0 + 1) * size, (y1 - y0 + 1) * size);
      } else {
        const [offsetX, offsetY] = viewportOffset;
        ctx.strokeRect(
          x0 * TILE_SIZE - offsetX + 2,
          y0 * TILE_SIZE - offsetY + 2,
          (x1 - x0 + 1) * TILE_SIZE - 4,
          (y1 - y0 + 1) * TILE_SIZE - 4,
        );
      }
      ctx.restore();
    }

    if (bigmap) {
      const { top, left, size } = bigmapInfo;
      const psize = size / 8;
      ctx.lineWidth = psize;
      ctx.strokeRect(
        left + pos[0] * size + psize,
        top + pos[1] * size + psize,
        size - 2 * psize,
        size - 2 * psize
      );
    } else {
      const [offsetX, offsetY] = viewportOffset;
      ctx.lineWidth = 4;
      ctx.strokeRect(
        TILE_SIZE * pos[0] - offsetX + 4,
        TILE_SIZE * pos[1] - offsetY + 4,
        24,
        24
      );
    }
  }, [canvas, pos, bigmap, bigmapInfo, viewportOffset, selectedArea]);

  // 合并绘制
  const draw = useCallback(() => {
    drawEventBlock();
    drawPosSelection();
  }, [drawEventBlock, drawPosSelection]);

  // 监听状态变化重绘
  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <canvas
      ref={mountCanvas}
      className="gameCanvas"
      id="efg"
      data-test-id="event-overlay"
      width={CANVAS_SIZE}
      height={CANVAS_SIZE}
      style={{ position: "absolute", zIndex: 50 }}
    />
  );
};

export default EventOverlay;
