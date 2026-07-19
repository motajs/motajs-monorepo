import type { Diagnostic } from "@/components/SchemaTable";
import type { FloorData } from "@/types/game";
import { isValidFloorId } from "@/utils/string";

function diagnostic(
  source: string,
  code: string,
  message: string,
  severity: Diagnostic["severity"] = "error",
): Diagnostic {
  return { source, code, message, severity };
}

function validateSize(
  diagnostics: Diagnostic[],
  key: "width" | "height",
  value: unknown,
): void {
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 128) {
    diagnostics.push(diagnostic(`floor:${key}`, "floor.size.range", `${key} 必须是 1 到 128 的整数`));
  }
}

function validatePoint(
  diagnostics: Diagnostic[],
  floor: FloorData,
  key: "upFloor" | "downFloor" | "flyPoint",
): void {
  const value = floor[key];
  if (value == null) return;
  if (!Array.isArray(value) || value.length !== 2 || !value.every((item) => Number.isFinite(item))) {
    diagnostics.push(diagnostic(`floor:${key}`, "floor.point.shape", `${key} 必须是两个数字组成的点位`));
    return;
  }
  const [x, y] = value;
  if (x < 0 || y < 0 || x >= Number(floor.width) || y >= Number(floor.height)) {
    diagnostics.push(diagnostic(`floor:${key}`, "floor.point.bounds", `${key} 超出当前地图范围`));
  }
}

export function buildFloorDiagnostics(floor: FloorData, selectedFloorId: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  if (!isValidFloorId(floor.floorId)) {
    diagnostics.push(diagnostic("floor:floorId", "floor.id.invalid", "floorId 只能包含字母、数字和下划线，且不能以数字开头"));
  } else if (floor.floorId !== selectedFloorId) {
    diagnostics.push(diagnostic("floor:floorId", "floor.id.mismatch", `数据中的 floorId 与当前楼层 ${selectedFloorId} 不一致`, "warning"));
  }

  validateSize(diagnostics, "width", floor.width);
  validateSize(diagnostics, "height", floor.height);
  if (typeof floor.ratio !== "number" || !Number.isFinite(floor.ratio) || floor.ratio < 0) {
    diagnostics.push(diagnostic("floor:ratio", "floor.ratio.range", "宝石血瓶倍率必须是非负有限数字"));
  }
  validatePoint(diagnostics, floor, "upFloor");
  validatePoint(diagnostics, floor, "downFloor");
  validatePoint(diagnostics, floor, "flyPoint");

  if (floor.color != null) {
    const color = floor.color;
    const valid = Array.isArray(color)
      && (color.length === 3 || color.length === 4)
      && color.slice(0, 3).every((item) => typeof item === "number" && item >= 0 && item <= 255)
      && (color.length === 3 || (typeof color[3] === "number" && color[3] >= 0 && color[3] <= 1));
    if (!valid) diagnostics.push(diagnostic("floor:color", "floor.color.range", "色调必须是合法的 RGB 或 RGBA 数组"));
  }

  if (floor.weather != null) {
    const weather = floor.weather as unknown;
    if (
      !Array.isArray(weather)
      || weather.length !== 2
      || typeof weather[0] !== "string"
      || weather[0].length === 0
    ) {
      diagnostics.push(diagnostic("floor:weather", "floor.weather.shape", "天气必须是 [天气类型, 强度] 二元数组"));
    } else if (!Number.isInteger(weather[1]) || weather[1] < 1 || weather[1] > 10) {
      diagnostics.push(diagnostic("floor:weather", "floor.weather.level", "天气强度必须是 1 到 10 的整数"));
    }
  }

  if (floor.bgm != null) {
    const valid = typeof floor.bgm === "string"
      || (Array.isArray(floor.bgm) && floor.bgm.every((item) => typeof item === "string"));
    if (!valid) diagnostics.push(diagnostic("floor:bgm", "floor.bgm.shape", "背景音乐必须是文件名或文件名数组"));
  }
  return diagnostics;
}
