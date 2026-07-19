import type { CSSProperties, MouseEvent } from "react";
import type { GridPOD, LocPOD } from "@/utils/coordinate";

/**
 * 标记渲染器类型 - 纯函数
 * @param ctx - Canvas 2D 渲染上下文
 * @param pixelPos - 像素位置（网格左上角）
 * @param gridSize - 网格大小 [宽度, 高度]
 */
export type MarkerRenderer = (
  ctx: CanvasRenderingContext2D,
  pixelPos: LocPOD,
  gridSize: GridPOD,
) => void;

/**
 * 网格标记
 */
export interface GridMarker {
  /** 网格位置 */
  gridPos: LocPOD;
  /** 渲染函数 */
  render: MarkerRenderer;
}

/**
 * GridCanvas 组件属性
 */
export interface GridCanvasProps {
  /** 源图像 */
  source: CanvasImageSource | null;
  /** Canvas 宽度（像素） */
  width: number;
  /** Canvas 高度（像素） */
  height: number;
  /** 网格尺寸 */
  gridSize: GridPOD;
  /** 网格起始像素偏移（用于居中显示非方形地图） */
  offset?: LocPOD;
  /** 标记层 */
  markers?: GridMarker[];
  /** 是否显示棋盘格背景（用于透明图像） */
  showCheckboard?: boolean;
  /** 点击事件 */
  onClick?: (gridPos: LocPOD, event: MouseEvent<HTMLCanvasElement>) => void;
  /** 双击事件 */
  onDoubleClick?: (gridPos: LocPOD, event: MouseEvent<HTMLCanvasElement>) => void;
  /** 右键菜单事件 */
  onContextMenu?: (gridPos: LocPOD, event: MouseEvent<HTMLCanvasElement>) => void;
  /** 样式 */
  style?: CSSProperties;
  /** CSS 类名 */
  className?: string;
  /** 稳定的端到端测试定位符 */
  testId?: string;
}
