import type { Logger } from "./logger";

// ============================================
// 公开 API 类型
// ============================================

/**
 * 构建配置选项
 */
export interface BuildOptions {
  /** 输入的魔塔压缩包路径 */
  input: string;
  /** 输出目录 */
  output: string;
  /** 压缩选项 */
  options?: CompressOptions;
  /** 日志回调 */
  logger?: (message: string) => void;
}

/**
 * 压缩选项
 */
export interface CompressOptions {
  /** 是否压缩 JS 文件，默认 true */
  minify?: boolean;
  /** 是否压缩图片，默认 true */
  compressImages?: boolean;
  /** 是否启用分块压缩，默认 false */
  splitChunks?: boolean;
  /** 分块大小阈值（字节），默认 2MB */
  chunkThreshold?: number;
}

/**
 * 构建结果
 */
export interface BuildResult {
  /** 是否成功 */
  success: boolean;
  /** 输出目录 */
  outputDir: string;
  /** 错误信息（如果失败） */
  error?: string;
}

// ============================================
// 配置解析类型
// ============================================

/**
 * 从 main.js 解析出的配置
 */
export interface MainConfig {
  /** 核心库加载列表 */
  loadList: string[];
  /** 纯数据文件列表 */
  pureData: string[];
  /** 材质列表 */
  materials: string[];
  /** 是否启用分块压缩 */
  enableSplitChunks: boolean;
  /** 是否跳过资源打包 */
  skipResourcePackage: boolean;
}

/**
 * 从 data.js 解析出的游戏数据
 */
export interface GameData {
  /** 地图 ID 列表 */
  floorIds: string[];
  /** 图片列表 */
  images: string[];
  /** tileset 文件列表 */
  tilesets: string[];
  /** 动画列表 */
  animates: string[];
  /** 音效列表 */
  sounds: string[];
  /** BGM 列表 */
  bgms: string[];
  /** 游戏名称 */
  name: string;
}

/**
 * 从 icons.js 解析出的图标数据
 */
export interface IconsData {
  /** autotile 映射 */
  autotiles: string[];
}

// ============================================
// 内部使用类型
// ============================================

/**
 * 构建上下文（内部使用）
 * 包含构建过程中需要的所有状态和配置
 */
export interface BuildContext {
  /** 临时目录路径 */
  tempDir: string;
  /** 游戏根目录路径 */
  rootDir: string;
  /** main.js 配置 */
  mainConfig: MainConfig;
  /** 游戏数据 */
  gameData: GameData;
  /** 图标数据 */
  iconsData: IconsData;
  /** 日志记录器 */
  logger: Logger;
  /** 压缩选项 */
  options: CompressOptions;
}

/**
 * 文件条目（内部使用）
 * 用于 ZIP 打包时表示单个文件
 */
export interface FileEntry {
  /** 文件名（在 ZIP 中的路径） */
  name: string;
  /** 文件内容 */
  content: Buffer;
}
