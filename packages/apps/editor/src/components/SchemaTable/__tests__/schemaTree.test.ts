import { describe, expect, it } from "vitest";
import {
  moveNode,
  recoverBuiltinNode,
  removeNode,
  restoreGroupSubtree,
  restoreNodePosition,
  restoreNodeProperties,
} from "../schemaTree";
import type { UISchema } from "../types";

const builtin: UISchema = {
  kind: "table-schema",
  formatVersion: 1,
  schemaId: "test",
  revision: 1,
  nodes: [{
    kind: "group",
    id: "main",
    label: "Main",
    children: [
      { kind: "field", id: "a", fieldSchema: "test.a", source: { ref: "floor:a" } },
      { kind: "field", id: "b", fieldSchema: "test.b", source: { ref: "floor:b" } },
    ],
  }, { kind: "rest", id: "rest", label: "Rest", path: { ref: "floor:" } }],
};

describe("SchemaTable structure editing", () => {
  it("moves nodes across Group/root boundaries", () => {
    const moved = moveNode(builtin, "a", "rest", "before");
    expect(moved.nodes.map((node) => node.id)).toEqual(["main", "a", "rest"]);
    expect(moved.nodes[0].kind === "group" ? moved.nodes[0].children.map((node) => node.id) : []).toEqual(["b"]);
    const nested = moveNode(moved, "rest", "main", "inside");
    expect(nested.nodes.map((node) => node.id)).toEqual(["main", "a"]);
    expect(nested.nodes[0].kind === "group" ? nested.nodes[0].children.map((node) => node.id) : []).toEqual(["b", "rest"]);
  });

  it("restores properties independently from position", () => {
    const customized = moveNode({
      ...builtin,
      nodes: [{ ...builtin.nodes[0], label: "Custom" } as typeof builtin.nodes[0], builtin.nodes[1]],
    }, "b", "rest", "before");
    const properties = restoreNodeProperties(customized, builtin, "main");
    expect(properties.nodes[0].kind === "group" ? properties.nodes[0].label : "").toBe("Main");
    expect(properties.nodes.map((node) => node.id)).toEqual(["main", "b", "rest"]);
    const position = restoreNodePosition(properties, builtin, "b");
    expect(position.nodes[0].kind === "group" ? position.nodes[0].children.map((node) => node.id) : []).toEqual(["a", "b"]);
  });

  it("restores Group subtrees and recovers deleted built-in nodes", () => {
    const withoutA = removeNode(builtin, "a").schema;
    expect(recoverBuiltinNode(withoutA, builtin, "a").nodes[0]).toEqual(builtin.nodes[0]);
    const withoutB = removeNode(withoutA, "b").schema;
    expect(restoreGroupSubtree(withoutB, builtin, "main").nodes[0]).toEqual(builtin.nodes[0]);
  });
});
