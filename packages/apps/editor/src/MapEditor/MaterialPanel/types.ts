/**
 * 素材面板类型定义
 */

import type { GridPOD, LocPOD } from "@/utils/coordinate";
import type { MaterialLayoutKind } from "./layout";

/** 清除块 */
export type ClearBlock = 0;

/** 素材信息 */
export interface BlockInfo {
  idnum: number;
  id: string;
  images: string;
  y: number;
  x?: number;
  isTile?: boolean;
  materialPath?: string;
}

/** 选中的素材 */
export type SelectedBlock = ClearBlock | BlockInfo;


/** 素材图片组件 props */
export interface MaterialImageProps {
  /** 唯一标识（用于判断选中状态） */
  id: string;
  /** 图片路径 */
  path: string;
  /** 素材类型名称 */
  materialType: string;
  /** 格子大小 */
  grid: GridPOD;
  /** 是否折叠模式 */
  folded: boolean;
  /** 折叠时每列个数 */
  foldPerCol: number;
  /** 当前选中的素材 ID 和格子位置 */
  selection: { id: string; gridLoc: LocPOD; size: GridPOD } | null;
  /** 是否允许拖拽选择一个矩形区域 */
  selectRegion?: boolean;
  /** 素材的逻辑布局类型 */
  layoutKind?: MaterialLayoutKind;
  /** 点击事件 */
  onClick: (
    id: string,
    gridLoc: LocPOD,
    grid: GridPOD,
    size: GridPOD,
    imageGridSize: GridPOD,
  ) => void;
}

/** 素材面板 props */
export interface MaterialPanelProps {
  /** 当前选中的素材 */
  selectedBlock: SelectedBlock | undefined;
  /** 选中变化时的回调 */
  onSelectedBlockChange: (block: SelectedBlock) => void;
  onTileSizeChange?: (size: GridPOD) => void;
}
