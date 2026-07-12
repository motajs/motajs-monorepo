import type { FloorImageData } from "@/types";

export type FloorImageLayer = "bg" | "fg";

export interface FloorImageTextureSize {
  width: number;
  height: number;
}

export interface FloorImagePart {
  key: string;
  path: string;
  layer: FloorImageLayer;
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
  x: number;
  y: number;
  reverse?: ":x" | ":y" | ":o";
}

export interface FloorImageResolution {
  parts: FloorImagePart[];
  diagnostics: string[];
}

export function mappedFloorImageName(
  name: string,
  nameMap: Readonly<Record<string, string>> = {},
): string {
  const mapped = nameMap[name];
  return typeof mapped === "string" && mapped.length > 0 ? mapped : name;
}

export function floorImagePath(
  image: FloorImageData,
  nameMap: Readonly<Record<string, string>> = {},
): string {
  return `project/images/${mappedFloorImageName(image.name, nameMap)}`;
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function positiveInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback;
}

export function collectFloorImagePaths(
  images: unknown,
  nameMap: Readonly<Record<string, string>> = {},
): string[] {
  if (!Array.isArray(images)) return [];
  const paths = new Set<string>();
  for (const value of images) {
    if (!value || typeof value !== "object") continue;
    const image = value as Partial<FloorImageData>;
    if (image.disabled || image.disable || typeof image.name !== "string" || image.name.length === 0) continue;
    paths.add(floorImagePath(image as FloorImageData, nameMap));
  }
  return [...paths];
}

export function resolveFloorImageParts(
  images: unknown,
  textureSizes: ReadonlyMap<string, FloorImageTextureSize>,
  nameMap: Readonly<Record<string, string>> = {},
  animationFrame = 0,
): FloorImageResolution {
  const parts: FloorImagePart[] = [];
  const diagnostics: string[] = [];
  if (!Array.isArray(images)) return { parts, diagnostics };

  images.forEach((value, index) => {
    if (!value || typeof value !== "object") {
      diagnostics.push(`Invalid floor image at index ${index}`);
      return;
    }
    const image = value as Partial<FloorImageData>;
    if (image.disabled || image.disable) return;
    if (typeof image.name !== "string" || image.name.length === 0) {
      diagnostics.push(`Missing floor image name at index ${index}`);
      return;
    }
    if (image.canvas !== "bg" && image.canvas !== "fg" && image.canvas !== "auto") {
      diagnostics.push(`Invalid floor image canvas: ${image.name}`);
      return;
    }

    const path = floorImagePath(image as FloorImageData, nameMap);
    const textureSize = textureSizes.get(path);
    if (!textureSize) return;

    const frameCount = positiveInteger(image.frame, 1);
    const totalWidth = finiteNumber(image.w, textureSize.width);
    const sourceWidth = Math.trunc(totalWidth / frameCount);
    const sourceHeight = finiteNumber(image.h, textureSize.height);
    const sourceX = finiteNumber(image.sx, 0) + (Math.abs(animationFrame) % frameCount) * sourceWidth;
    const sourceY = finiteNumber(image.sy, 0);
    const x = finiteNumber(image.x, 0);
    const y = finiteNumber(image.y, 0);

    if (sourceWidth <= 0 || sourceHeight <= 0) {
      diagnostics.push(`Invalid floor image size: ${image.name}`);
      return;
    }

    const addPart = (
      layer: FloorImageLayer,
      partSourceY: number,
      partSourceHeight: number,
      partY: number,
      suffix: string,
    ) => {
      if (partSourceHeight <= 0) return;
      parts.push({
        key: `floor-image:${index}:${suffix}`,
        path,
        layer,
        sourceX,
        sourceY: partSourceY,
        sourceWidth,
        sourceHeight: partSourceHeight,
        x,
        y: partY,
        reverse: image.reverse,
      });
    };

    if (image.canvas === "auto") {
      if (sourceHeight < 32) {
        diagnostics.push(`Floor image auto height must be at least 32: ${image.name}`);
        return;
      }
      addPart("fg", sourceY, sourceHeight - 32, y, "auto-fg");
      addPart("bg", sourceY + sourceHeight - 32, 32, y + sourceHeight - 32, "auto-bg");
      return;
    }

    addPart(image.canvas, sourceY, sourceHeight, y, image.canvas);
  });

  return { parts, diagnostics };
}
