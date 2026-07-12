/**
 * editor_multi 模块类型定义
 */

// ============== 重新导出游戏数据类型（保持向后兼容） ==============
export type {
  CoreMaterial,
  CoreStatus,
  CoreType,
  FunctionsType,
  DataCommentType,
} from "@/types/game";

// ============== Tern 相关类型 ==============

/** Tern 定义中的单个条目 */
export interface TernTypeEntry {
  "!type"?: string;
  "!doc"?: string;
  "!url"?: string;
  [key: string]: TernTypeEntry | string | undefined;
}

/** Tern definitions 的 core 部分结构 */
export interface TernCoreDef {
  core: {
    material: {
      enemys: Record<string, TernTypeEntry>;
      bgms: Record<string, TernTypeEntry>;
      sounds: Record<string, TernTypeEntry>;
      animates: Record<string, TernTypeEntry>;
      images: Record<string, TernTypeEntry>;
      items: Record<string, TernTypeEntry>;
    };
    enemys: {
      hasSpecial: TernTypeEntry;
      [key: string]: TernTypeEntry;
    };
    canvas: Record<string, TernTypeEntry>;
    status: {
      maps: Record<string, TernTypeEntry>;
      bgmaps: Record<string, TernTypeEntry>;
      fgmaps: Record<string, TernTypeEntry>;
      shops: Record<string, TernTypeEntry>;
      textAttribute: Record<string, TernTypeEntry>;
      [key: string]: Record<string, TernTypeEntry> | TernTypeEntry;
    };
    values: Record<string, TernTypeEntry>;
    flags: Record<string, TernTypeEntry>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

// ============== 编辑器状态类型 ==============

/** 代码转换选项 */
export interface CodeTransformOptions {
  /** 缩进字符，默认 '\t' */
  indent?: string | number;
  /** GUID 生成函数 */
  guidGenerator?: () => string;
}

// ============== 命令配置类型 ==============

/** 快捷键名称 */
export type ShortcutKey =
  | "Ctrl-/"
  | "Ctrl-B"
  | "Ctrl-Q"
  | "Ctrl-F"
  | "Ctrl-R"
  | "Ctrl-D"
  | "Ctrl-O"
  | "Ctrl-P";

/** 命令名称映射 */
export type CommandsNameMap = Record<ShortcutKey, string>;

/** 注释文件路径映射 */
export type CommentFilePathMap = Record<string, string>;
