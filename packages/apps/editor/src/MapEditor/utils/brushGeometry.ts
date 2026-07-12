import type { LocPOD } from "@/utils/coordinate";

export function walkOrthogonalPath(from: LocPOD, to: LocPOD): LocPOD[] {
  const result: LocPOD[] = [];
  let cursor = from;
  while (cursor[0] !== to[0] || cursor[1] !== to[1]) {
    const dx = to[0] - cursor[0];
    const dy = to[1] - cursor[1];
    cursor = Math.abs(dx) >= Math.abs(dy)
      ? [cursor[0] + Math.sign(dx), cursor[1]]
      : [cursor[0], cursor[1] + Math.sign(dy)];
    result.push(cursor);
  }
  return result;
}

export function rectanglePositions(from: LocPOD, to: LocPOD): LocPOD[] {
  const x0 = Math.min(from[0], to[0]);
  const y0 = Math.min(from[1], to[1]);
  const x1 = Math.max(from[0], to[0]);
  const y1 = Math.max(from[1], to[1]);
  const result: LocPOD[] = [];
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) result.push([x, y]);
  }
  return result;
}
