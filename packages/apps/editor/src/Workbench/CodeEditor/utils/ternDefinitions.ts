/**
 * Tern 类型定义构建工具
 *
 * 从游戏运行时数据（core, functions, data_comment）构建 Tern.js 的类型定义，
 * 用于代码编辑器的智能提示和自动补全。
 */

import type {
  CoreType,
  DataCommentType,
  FunctionsType,
  TernCoreDef,
  TernTypeEntry,
} from "../types/index";

/**
 * 提取函数参数信息
 * @param fn - 函数对象
 * @returns Tern 格式的参数字符串，如 "arg1: ?, arg2: ?"
 */
export function extractFunctionParameters(fn: CallableFunction): string {
  const fnString = fn.toString();
  const parameterInfo = /^\s*function\s*[\w_$]*\(([\w_,$\s]*)\)\s*\{/.exec(
    fnString
  );
  if (parameterInfo === null) return "";

  return parameterInfo[1]
    .replace(/\s*/g, "")
    .replace(/,/g, ", ")
    .split(", ")
    .filter((one) => one.trim() !== "")
    .map((one) => one.trim() + ": ?")
    .join(", ");
}

/**
 * 获取图片类别的文档描述
 * @param name - 图片类别名称
 * @returns 文档描述字符串
 */
export function getImageCategoryDoc(name: string): string {
  switch (name) {
    case "autotile":
      return "自动元件";
    case "tilesets":
      return "额外素材";
    case "images":
      return "自定义图片";
    default:
      return "系统图片";
  }
}

/**
 * 构建 enemys 的 Tern 定义
 */
export function buildEnemysDef(
  coredef: TernCoreDef,
  enemys: Record<string, { name?: string }>
): void {
  Object.keys(enemys).forEach((name) => {
    coredef.core.material.enemys[name] = {
      "!type": "enemy",
      "!doc": enemys[name].name || "怪物",
    };
  });
}

/**
 * 构建 bgms 的 Tern 定义
 */
export function buildBgmsDef(
  coredef: TernCoreDef,
  bgms: Record<string, unknown>
): void {
  Object.keys(bgms).forEach((name) => {
    coredef.core.material.bgms[name] = {
      "!type": "audio",
      "!doc": "背景音乐",
    };
  });
}

/**
 * 构建 sounds 的 Tern 定义
 */
export function buildSoundsDef(
  coredef: TernCoreDef,
  sounds: Record<string, unknown>
): void {
  Object.keys(sounds).forEach((name) => {
    coredef.core.material.sounds[name] = {
      "!type": "audio",
      "!doc": "音效",
    };
  });
}

/**
 * 构建 animates 的 Tern 定义
 */
export function buildAnimatesDef(
  coredef: TernCoreDef,
  animates: Record<string, unknown>
): void {
  Object.keys(animates).forEach((name) => {
    coredef.core.material.animates[name] = {
      "!type": "animate",
      "!doc": "动画",
    };
  });
}

/**
 * 检查是否是 Image 实例
 * 兼容 Node.js 环境（Image 可能不存在）
 */
function isImageInstance(obj: unknown): boolean {
  return typeof Image !== "undefined" && obj instanceof Image;
}

/**
 * 构建 images 的 Tern 定义
 * 处理两种情况：直接是 Image 对象，或是包含多个 Image 的对象
 */
export function buildImagesDef(
  coredef: TernCoreDef,
  images: Record<string, unknown>
): void {
  Object.keys(images).forEach((name) => {
    const image = images[name];
    if (isImageInstance(image)) {
      coredef.core.material.images[name] = {
        "!type": "image",
        "!doc": "系统图片",
      };
    } else if (typeof image === "object" && image !== null) {
      coredef.core.material.images[name] = {
        "!doc": getImageCategoryDoc(name),
      };
      for (const v in image as Record<string, unknown>) {
        (coredef.core.material.images[name] as TernTypeEntry)[v] = {
          "!type": "image",
        };
      }
    }
  });
}

/**
 * 构建 items 的 Tern 定义
 */
export function buildItemsDef(
  coredef: TernCoreDef,
  items: Record<string, { name?: string | null }>
): void {
  Object.keys(items).forEach((name) => {
    coredef.core.material.items[name] = {
      "!type": "item",
      "!doc": items[name].name || "道具",
    };
  });
}

/**
 * 构建怪物特殊属性的文档
 */
export function buildSpecialsDef(
  coredef: TernCoreDef,
  functions: FunctionsType
): void {
  const specials = functions.enemys.getSpecials();
  specials.forEach((one) => {
    let name = one[1];
    if (typeof name === "function") {
      name = name({});
    }
    const hasSpecial = coredef.core.enemys.hasSpecial;
    hasSpecial["!doc"] = (hasSpecial["!doc"] || "") + name + "(" + one[0] + "); ";
  });
}

/**
 * 构建 canvas 的 Tern 定义
 */
export function buildCanvasDef(
  coredef: TernCoreDef,
  canvas: Record<string, CanvasRenderingContext2D>
): void {
  Object.keys(canvas).forEach((name) => {
    coredef.core.canvas[name] = {
      "!type": "CanvasRenderingContext2D",
      "!doc": "系统画布",
    };
  });
}

/**
 * 构建 maps 的 Tern 定义（包括 bgmaps 和 fgmaps）
 */
export function buildMapsDef(
  coredef: TernCoreDef,
  maps: Record<string, { title?: string }>
): void {
  Object.keys(maps).forEach((name) => {
    const title = maps[name].title || "";
    coredef.core.status.maps[name] = {
      "!type": "floor",
      "!doc": title,
    };
    coredef.core.status.bgmaps[name] = {
      "!type": "[[number]]",
      "!doc": title,
    };
    coredef.core.status.fgmaps[name] = {
      "!type": "[[number]]",
      "!doc": title,
    };
  });
}

/**
 * 构建 shops 的 Tern 定义
 */
export function buildShopsDef(
  coredef: TernCoreDef,
  shops: Record<string, { textInList?: string }>
): void {
  Object.keys(shops).forEach((id) => {
    coredef.core.status.shops[id] = {
      "!doc": shops[id].textInList || "全局商店",
    };
  });
}

/**
 * 构建 textAttribute 的 Tern 定义
 */
export function buildTextAttributeDef(
  coredef: TernCoreDef,
  textAttribute: Record<string, unknown>
): void {
  Object.keys(textAttribute).forEach((id) => {
    coredef.core.status.textAttribute[id] = {};
  });
}

/**
 * 构建转发函数的 Tern 定义
 * 将 core.xxx.funcName 转发到 core.funcName
 */
export function buildForwardFunctionsDef(
  coredef: TernCoreDef,
  core: CoreType,
  functions: FunctionsType
): void {
  for (const name in coredef.core) {
    const module = coredef.core[name];
    if (typeof module !== "object" || module === null) continue;

    // 处理已有定义的函数转发
    for (const funcname in module as Record<string, TernTypeEntry>) {
      const one = (module as Record<string, TernTypeEntry>)[funcname] || {};
      const type = one["!type"] || "";
      if (typeof type === "string" && type.startsWith("fn(")) {
        const forwardname =
          (functions[name] as Record<string, unknown> | undefined)?.[funcname]
            ? "脚本编辑"
            : name;
        (coredef.core as Record<string, TernTypeEntry>)[funcname] = {
          "!type": one["!type"],
          "!doc": (one["!doc"] || "") + "<br/>（转发到" + forwardname + "中）",
        };
        if (one["!url"]) {
          (coredef.core as Record<string, TernTypeEntry>)[funcname]["!url"] =
            one["!url"];
        }
      }
    }

    // 处理 core 中未在 coredef 中定义的函数
    const coreModule = core[name];
    if (typeof coreModule !== "object" || coreModule === null) continue;

    for (const funcname in coreModule as Record<string, unknown>) {
      const fn = (coreModule as Record<string, unknown>)[funcname];
      if (
        typeof fn !== "function" ||
        funcname.charAt(0) === "_" ||
        (module as Record<string, TernTypeEntry>)[funcname]
      ) {
        continue;
      }

      const parameters = extractFunctionParameters(fn as CallableFunction);
      const entry: TernTypeEntry = {
        "!type": "fn(" + parameters + ")",
      };
      (coredef.core as Record<string, TernTypeEntry>)[funcname] = entry;
      (module as Record<string, TernTypeEntry>)[funcname] = entry;
    }
  }
}

/**
 * 构建 values 的 Tern 定义
 */
export function buildValuesDef(
  coredef: TernCoreDef,
  values: Record<string, unknown>,
  dataComment: DataCommentType
): void {
  Object.keys(values).forEach((id) => {
    const one = dataComment._data.values._data[id];
    if (!one) return;
    coredef.core.values[id] = {
      "!type": "number",
      "!doc": one._data,
    };
  });
}

/**
 * 构建 flags 的 Tern 定义
 */
export function buildFlagsDef(
  coredef: TernCoreDef,
  flags: Record<string, unknown>,
  dataComment: DataCommentType
): void {
  Object.keys(flags).forEach((id) => {
    const one = dataComment._data.flags._data[id];
    if (!one) return;
    coredef.core.flags[id] = {
      "!type": id === "statusBarItems" ? "[string]" : "bool",
      "!doc": one._data,
    };
  });
}

/**
 * 构建完整的 Tern 定义
 *
 * 此函数从游戏运行时数据构建 Tern.js 所需的类型定义，
 * 会直接修改传入的 coredef 对象。
 *
 * @param coredef - Tern 定义对象（将被修改）
 * @param core - 游戏核心对象
 * @param functions - 游戏函数定义对象
 * @param dataComment - 数据注释对象
 */
export function buildTernDefinitions(
  coredef: TernCoreDef,
  core: CoreType,
  functions: FunctionsType,
  dataComment: DataCommentType
): void {
  // 构建 material 相关定义
  buildEnemysDef(coredef, core.material.enemys);
  buildBgmsDef(coredef, core.material.bgms);
  buildSoundsDef(coredef, core.material.sounds);
  buildAnimatesDef(coredef, core.material.animates);
  buildImagesDef(coredef, core.material.images);
  buildItemsDef(coredef, core.material.items);

  // 构建怪物特殊属性文档
  buildSpecialsDef(coredef, functions);

  // 构建 canvas 定义
  buildCanvasDef(coredef, core.canvas);

  // 构建 status 相关定义
  buildMapsDef(coredef, core.status.maps);
  buildShopsDef(coredef, core.status.shops);
  buildTextAttributeDef(coredef, core.status.textAttribute);

  // 构建转发函数定义
  buildForwardFunctionsDef(coredef, core, functions);

  // 构建 values 和 flags 定义
  buildValuesDef(coredef, core.values, dataComment);
  buildFlagsDef(coredef, core.flags, dataComment);
}
