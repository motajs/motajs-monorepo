/**
 * 游戏数据类型定义
 * 这些类型用于描述游戏核心对象和相关数据结构
 */

// ============== Core 相关类型 ==============

/** 简化的 core.material 类型 */
export interface CoreMaterial {
  enemys: Record<string, { name?: string }>;
  bgms: Record<string, unknown>;
  sounds: Record<string, unknown>;
  animates: Record<string, unknown>;
  images: Record<string, unknown>;
  items: Record<string, { name?: string }>;
}

/** 简化的 core.status 类型 */
export interface CoreStatus {
  maps: Record<string, { title?: string }>;
  shops: Record<string, { textInList?: string }>;
  textAttribute: Record<string, unknown>;
  bgmaps: Record<string, unknown>;
  fgmaps: Record<string, unknown>;
}

/** 楼层数据类型 */
export interface FloorData {
  floorId: string;
  title?: string;
  name?: string;
  width?: number;
  height?: number;
  map?: number[][];
  bgmap?: number[][];
  fgmap?: number[][];
  images?: FloorImageData[];
  events?: Record<string, unknown>;
  beforeBattle?: Record<string, unknown>;
  afterBattle?: Record<string, unknown>;
  afterGetItem?: Record<string, unknown>;
  afterOpenDoor?: Record<string, unknown>;
  changeFloor?: Record<string, unknown>;
  autoEvent?: Record<string, unknown>;
  cannotMove?: Record<string, unknown>;
  cannotMoveIn?: Record<string, unknown>;
  upFloor?: [number, number] | null;
  downFloor?: [number, number] | null;
  flyPoint?: [number, number] | null;
  [key: string]: unknown;
}

export interface FloorImageData {
  canvas?: "bg" | "auto" | "fg";
  name: string;
  x?: number;
  y?: number;
  reverse?: ":x" | ":y" | ":o";
  disabled?: boolean;
  disable?: boolean;
  sx?: number;
  sy?: number;
  w?: number;
  h?: number;
  frame?: number;
}

/** 简化的 core 类型 */
export interface CoreType {
  material: CoreMaterial;
  status: CoreStatus;
  canvas: Record<string, CanvasRenderingContext2D>;
  values: Record<string, unknown>;
  flags: Record<string, unknown>;
  floors: Record<string, FloorData>;
  floorIds: string[];

  // 尺寸常量
  __SIZE__: number;
  __PIXELS__: number;
  __HALF_SIZE__: number;

  // 工具方法
  calValue: (value: string) => number;

  // 绘图方法
  drawThumbnail: (
    floorId: string,
    heroLoc: unknown,
    options: {
      ctx: CanvasRenderingContext2D | string;
      centerX?: number;
      centerY?: number;
      all?: boolean;
    },
  ) => void;

  [key: string]: unknown;
}

// ============== Functions 相关类型 ==============

/** 简化的 functions 类型 */
export interface FunctionsType {
  enemys: {
    getSpecials: () => Array<[number, string | ((arg: unknown) => string)]>;
  };
  [key: string]: unknown;
}

// ============== Data Comment 相关类型 ==============

/** 简化的 data_comment 类型 */
export interface DataCommentType {
  _data: {
    values: {
      _data: Record<string, { _data: string } | undefined>;
    };
    flags: {
      _data: Record<string, { _data: string } | undefined>;
    };
  };
}
