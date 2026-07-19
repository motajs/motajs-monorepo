import type { UINode, UISchema } from "./types";

export interface NodeLocation {
  node: UINode;
  parentId?: string;
  index: number;
}

export function cloneSchema<T>(value: T): T {
  return structuredClone(value);
}

export function listNodeLocations(schema: UISchema): NodeLocation[] {
  const result: NodeLocation[] = [];
  const visit = (nodes: UINode[], parentId?: string): void => nodes.forEach((node, index) => {
    result.push({ node, parentId, index });
    if (node.kind === "group") visit(node.children, node.id);
  });
  visit(schema.nodes);
  return result;
}

export function findNodeLocation(schema: UISchema, id: string): NodeLocation | undefined {
  return listNodeLocations(schema).find((location) => location.node.id === id);
}

function childArray(schema: UISchema, parentId?: string): UINode[] {
  if (!parentId) return schema.nodes;
  const parent = findNodeLocation(schema, parentId)?.node;
  if (!parent || parent.kind !== "group") throw new Error(`Unknown Group node: ${parentId}`);
  return parent.children;
}

export function replaceNode(schema: UISchema, id: string, replacement: UINode): UISchema {
  const next = cloneSchema(schema);
  const location = findNodeLocation(next, id);
  if (!location) throw new Error(`Unknown UI node: ${id}`);
  childArray(next, location.parentId)[location.index] = replacement;
  return next;
}

export function removeNode(schema: UISchema, id: string): { schema: UISchema; removed: UINode; location: NodeLocation } {
  const next = cloneSchema(schema);
  const location = findNodeLocation(next, id);
  if (!location) throw new Error(`Unknown UI node: ${id}`);
  const [removed] = childArray(next, location.parentId).splice(location.index, 1);
  return { schema: next, removed, location };
}

export function insertNode(schema: UISchema, node: UINode, parentId?: string, index?: number): UISchema {
  if (findNodeLocation(schema, node.id)) throw new Error(`Duplicate UI node ID: ${node.id}`);
  const next = cloneSchema(schema);
  const children = childArray(next, parentId);
  children.splice(Math.min(index ?? children.length, children.length), 0, cloneSchema(node));
  return next;
}

function nodeContains(node: UINode, id: string): boolean {
  return node.id === id || (node.kind === "group" && node.children.some((child) => nodeContains(child, id)));
}

export function moveNode(
  schema: UISchema,
  sourceId: string,
  targetId: string,
  placement: "before" | "inside",
): UISchema {
  const source = findNodeLocation(schema, sourceId)?.node;
  const target = findNodeLocation(schema, targetId);
  if (!source || !target) throw new Error("拖拽节点不存在");
  if (sourceId === targetId || nodeContains(source, targetId)) throw new Error("不能把节点移动到自身子树中");
  if (placement === "inside" && target.node.kind !== "group") throw new Error("只有 Group 可以接收子节点");
  const removed = removeNode(schema, sourceId);
  if (placement === "inside") return insertNode(removed.schema, removed.removed, targetId);
  const nextTarget = findNodeLocation(removed.schema, targetId);
  if (!nextTarget) throw new Error(`目标节点 ${targetId} 不存在`);
  return insertNode(removed.schema, removed.removed, nextTarget.parentId, nextTarget.index);
}

export function restoreNodeProperties(current: UISchema, builtin: UISchema, id: string): UISchema {
  const currentNode = findNodeLocation(current, id)?.node;
  const builtinNode = findNodeLocation(builtin, id)?.node;
  if (!currentNode || !builtinNode || currentNode.kind !== builtinNode.kind) throw new Error("内置 Schema 中没有同类型节点");
  const restored = cloneSchema(builtinNode);
  if (restored.kind === "group" && currentNode.kind === "group") restored.children = cloneSchema(currentNode.children);
  return replaceNode(current, id, restored);
}

export function restoreNodePosition(current: UISchema, builtin: UISchema, id: string): UISchema {
  const baseline = findNodeLocation(builtin, id);
  if (!baseline || !findNodeLocation(current, id)) throw new Error("内置 Schema 中没有该节点");
  const removed = removeNode(current, id);
  const siblings = childArray(removed.schema, baseline.parentId);
  const builtinSiblings = childArray(cloneSchema(builtin), baseline.parentId);
  const preceding = builtinSiblings.slice(0, baseline.index).map((node) => node.id).reverse();
  const following = builtinSiblings.slice(baseline.index + 1).map((node) => node.id);
  const afterIndex = preceding.map((nodeId) => siblings.findIndex((node) => node.id === nodeId)).find((index) => index >= 0);
  const beforeIndex = following.map((nodeId) => siblings.findIndex((node) => node.id === nodeId)).find((index) => index >= 0);
  const index = afterIndex != null ? afterIndex + 1 : beforeIndex ?? siblings.length;
  return insertNode(removed.schema, removed.removed, baseline.parentId, index);
}

export function restoreGroupSubtree(current: UISchema, builtin: UISchema, id: string): UISchema {
  const node = findNodeLocation(builtin, id)?.node;
  if (!node || node.kind !== "group") throw new Error("内置 Schema 中没有该 Group");
  return replaceNode(current, id, cloneSchema(node));
}

export function recoverBuiltinNode(current: UISchema, builtin: UISchema, id: string): UISchema {
  const baseline = findNodeLocation(builtin, id);
  if (!baseline) throw new Error("内置 Schema 中没有该节点");
  if (findNodeLocation(current, id)) throw new Error("该节点尚未被删除");
  const parentMissing = baseline.parentId && !findNodeLocation(current, baseline.parentId);
  if (parentMissing) throw new Error(`请先找回父 Group：${baseline.parentId}`);
  const withNode = insertNode(current, baseline.node, baseline.parentId);
  return restoreNodePosition(withNode, builtin, id);
}

export function createUniqueNodeId(schema: UISchema, prefix: string): string {
  const used = new Set(listNodeLocations(schema).map((location) => location.node.id));
  let id = prefix;
  let suffix = 2;
  while (used.has(id)) id = `${prefix}-${suffix++}`;
  return id;
}
