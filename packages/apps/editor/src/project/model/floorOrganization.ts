export type FloorPartition = [string, string];

export type FloorOrganizationToken =
  | { kind: "floor"; floorId: string }
  | { kind: "boundary"; partition: number; edge: "start" | "end" };

export interface FloorOrganizationValidation {
  valid: boolean;
  partitions: FloorPartition[];
  diagnostics: string[];
}

export interface SearchableFloor {
  id: string;
  title?: string;
  name?: string;
}

export function floorMatchesQuery(floor: SearchableFloor, query: string): boolean {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return true;
  return [floor.id, floor.title, floor.name]
    .some((value) => value?.toLocaleLowerCase().includes(normalized));
}

function duplicateValues(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

export function validateFloorOrganization(
  floorIds: readonly string[],
  rawPartitions: unknown,
): FloorOrganizationValidation {
  const diagnostics: string[] = [];
  const duplicates = duplicateValues(floorIds);
  if (duplicates.length) diagnostics.push(`楼层 ID 重复：${duplicates.join("、")}`);

  if (rawPartitions == null) {
    return { valid: diagnostics.length === 0, partitions: [], diagnostics };
  }
  if (!Array.isArray(rawPartitions)) {
    return { valid: false, partitions: [], diagnostics: [...diagnostics, "floorPartitions 必须是数组或 null"] };
  }

  const index = new Map(floorIds.map((floorId, position) => [floorId, position]));
  const partitions: FloorPartition[] = [];
  let previousEnd = -1;

  rawPartitions.forEach((raw, partitionIndex) => {
    if (
      !Array.isArray(raw)
      || raw.length !== 2
      || typeof raw[0] !== "string"
      || typeof raw[1] !== "string"
    ) {
      diagnostics.push(`分区 ${partitionIndex + 1} 必须是 [起始楼层, 结束楼层]`);
      return;
    }
    const partition: FloorPartition = [raw[0], raw[1]];
    partitions.push(partition);
    const start = index.get(partition[0]);
    const end = index.get(partition[1]);
    if (start == null || end == null) {
      diagnostics.push(`分区 ${partitionIndex + 1} 引用了不存在的楼层`);
      return;
    }
    if (start > end) {
      diagnostics.push(`分区 ${partitionIndex + 1} 的起始楼层位于结束楼层之后`);
      return;
    }
    if (start <= previousEnd) {
      diagnostics.push(`分区 ${partitionIndex + 1} 与前一个分区重叠或顺序错误`);
      return;
    }
    previousEnd = end;
  });

  return { valid: diagnostics.length === 0, partitions, diagnostics };
}

export function buildFloorOrganizationTokens(
  floorIds: readonly string[],
  partitions: readonly FloorPartition[],
): FloorOrganizationToken[] {
  const index = new Map(floorIds.map((floorId, position) => [floorId, position]));
  const starts = new Map<number, number[]>();
  const ends = new Map<number, number[]>();
  partitions.forEach(([startFloorId, endFloorId], partition) => {
    const start = index.get(startFloorId);
    const end = index.get(endFloorId);
    if (start == null || end == null) return;
    starts.set(start, [...(starts.get(start) ?? []), partition]);
    ends.set(end + 1, [...(ends.get(end + 1) ?? []), partition]);
  });

  const result: FloorOrganizationToken[] = [];
  for (let offset = 0; offset <= floorIds.length; offset += 1) {
    for (const partition of ends.get(offset) ?? []) {
      result.push({ kind: "boundary", partition, edge: "end" });
    }
    for (const partition of starts.get(offset) ?? []) {
      result.push({ kind: "boundary", partition, edge: "start" });
    }
    if (offset < floorIds.length) result.push({ kind: "floor", floorId: floorIds[offset] });
  }
  return result;
}

export function organizationFromTokens(tokens: readonly FloorOrganizationToken[]): {
  floorIds: string[];
  floorPartitions: FloorPartition[];
  diagnostics: string[];
} {
  const floorIds = tokens.flatMap((token) => token.kind === "floor" ? [token.floorId] : []);
  const diagnostics: string[] = [];
  const active = new Map<number, string[]>();
  const completed = new Map<number, FloorPartition>();
  let openPartition: number | undefined;

  for (const token of tokens) {
    if (token.kind === "floor") {
      if (openPartition != null) active.get(openPartition)?.push(token.floorId);
      continue;
    }
    if (token.edge === "start") {
      if (openPartition != null) {
        diagnostics.push("分区边界不能交叉或嵌套");
        continue;
      }
      openPartition = token.partition;
      active.set(token.partition, []);
      continue;
    }
    if (openPartition !== token.partition) {
      diagnostics.push("分区结束边界没有对应的开始边界");
      continue;
    }
    const members = active.get(token.partition) ?? [];
    if (members.length > 0) completed.set(token.partition, [members[0], members.at(-1)!]);
    openPartition = undefined;
  }
  if (openPartition != null) diagnostics.push("分区开始边界没有对应的结束边界");

  const floorPartitions = [...completed.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, partition]) => partition);
  const validation = validateFloorOrganization(floorIds, floorPartitions);
  diagnostics.push(...validation.diagnostics);
  return { floorIds, floorPartitions, diagnostics: [...new Set(diagnostics)] };
}

export function moveFloorOrganizationToken(
  tokens: readonly FloorOrganizationToken[],
  from: number,
  to: number,
): FloorOrganizationToken[] {
  if (from < 0 || from >= tokens.length || to < 0 || to >= tokens.length || from === to) return [...tokens];
  const next = [...tokens];
  const [token] = next.splice(from, 1);
  next.splice(to, 0, token);
  return next;
}

export function partitionContainingFloor(
  floorIds: readonly string[],
  partitions: readonly FloorPartition[],
  floorId: string,
): number | undefined {
  const floorIndex = floorIds.indexOf(floorId);
  if (floorIndex < 0) return undefined;
  const partition = partitions.findIndex(([startId, endId]) => {
    const start = floorIds.indexOf(startId);
    const end = floorIds.indexOf(endId);
    return start >= 0 && end >= start && floorIndex >= start && floorIndex <= end;
  });
  return partition >= 0 ? partition : undefined;
}
