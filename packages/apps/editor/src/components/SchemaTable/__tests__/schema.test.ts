import { describe, expect, it } from "vitest";
import {
  createFieldSchemaRegistry,
  createGlobalFieldSchemaRegistry,
  parseFieldSchemaBundle as parseFieldSchemaBundleV1,
  parseUISchema as parseUISchemaV1,
} from "../schema";
import { fieldShapeIssues } from "../runtime";
import type { FieldSchema, UISchema, UINode } from "../types";
import mapBlockFieldsJson from "../builtin/map-block.fields.json";
import mapBlockPropertiesJson from "../builtin/map-block-properties.json";
import itemFieldsJson from "../builtin/item.fields.json";
import itemPropertiesJson from "../builtin/item-properties.json";
import floorFieldsJson from "../builtin/floor.fields.json";
import floorPropertiesJson from "../builtin/floor-properties.json";
import enemyFieldsJson from "../builtin/enemy.fields.json";
import enemyPropertiesJson from "../builtin/enemy-properties.json";
import towerFieldsJson from "../builtin/tower.fields.json";
import towerPropertiesJson from "../builtin/tower-properties.json";
import locFieldsJson from "../builtin/loc.fields.json";
import locPropertiesJson from "../builtin/loc-properties.json";

function parseFieldSchemaBundle(value: Record<string, unknown>) {
  if (value.kind === "field-bundle") return parseFieldSchemaBundleV1(value);
  const records = Object.fromEntries((value.fields as Array<Record<string, unknown>>).map((item) => {
    const { $id, ...definition } = item;
    return [$id, definition];
  }));
  return parseFieldSchemaBundleV1({
    kind: "field-bundle",
    formatVersion: 1,
    schemaId: value.schemaId,
    revision: value.version,
    fields: records,
  });
}

let generatedNodeId = 0;
function nodesV1(nodes: unknown[]): UINode[] {
  return nodes.map((value) => {
    const node = value as Record<string, unknown>;
    if (node.kind === "group") return { ...node, children: nodesV1(node.children as unknown[]) } as UINode;
    if (node.kind === "field") return { id: `test-field-${generatedNodeId++}`, ...node } as UINode;
    return node as unknown as UINode;
  });
}

function parseUISchema(value: Record<string, unknown>, fields: ReadonlyMap<string, FieldSchema>): UISchema {
  if (value.kind === "table-schema") return parseUISchemaV1(value, fields);
  return parseUISchemaV1({
    kind: "table-schema",
    formatVersion: 1,
    schemaId: value.schemaId,
    revision: value.version,
    nodes: nodesV1(value.nodes as unknown[]),
  }, fields);
}

const bundle = parseFieldSchemaBundle({
  schemaId: "test.fields",
  version: 1,
  fields: [{ $id: "test.name", type: "string", title: "Name", editor: { kind: "text" } }],
});
const fields = createFieldSchemaRegistry(bundle);

describe("SchemaTable schema parser", () => {
  it("accepts strict Field, Group and Rest schemas", () => {
    const schema = parseUISchema({
      schemaId: "test.ui",
      version: 1,
      nodes: [{
        kind: "group",
        id: "main",
        label: "Main",
        children: [{ kind: "field", fieldSchema: "test.name", source: { ref: "floor:name" } }],
      }, { kind: "rest", id: "rest", label: "Rest", path: { ref: "floor:" } }],
    }, fields);
    expect(schema.nodes.map((node) => node.kind)).toEqual(["group", "rest"]);
  });

  it("accepts the block editor primitive", () => {
    const parsed = parseFieldSchemaBundle({
      schemaId: "blocks.fields",
      version: 1,
      fields: [{ $id: "test.block", type: "string", title: "Block", editor: { kind: "block" } }],
    });
    expect(parsed.fields["test.block"].editor).toEqual({ kind: "block" });
  });

  it("accepts a combine editor with suggestion and number inputs", () => {
    const parsed = parseFieldSchemaBundle({
      schemaId: "combine.fields",
      version: 1,
      fields: [{
        $id: "test.weather",
        type: ["array", "null"],
        title: "Weather",
        editor: {
          kind: "combine",
          inputs: [{
            key: "type",
            editor: { kind: "suggestion", suggestions: [{ value: "rain", label: "Rain" }] },
          }, {
            key: "level",
            editor: { kind: "number", min: 1, max: 10, integer: true },
          }],
        },
      }],
    });
    expect(parsed.fields["test.weather"].editor).toMatchObject({
      kind: "combine",
      inputs: [{ key: "type", editor: { kind: "suggestion" } }, { key: "level", editor: { kind: "number" } }],
    });
  });

  it("accepts named BGM list and floor image editors", () => {
    const parsed = parseFieldSchemaBundle({
      schemaId: "collection.fields",
      version: 1,
      fields: [{
        $id: "test.bgms",
        type: ["null", "string", "array"],
        title: "BGM",
        editor: {
          kind: "bgmList",
          reference: { ref: "project:materials.bgms" },
          directory: "project/bgms",
        },
      }, {
        $id: "test.images",
        type: "array",
        title: "Images",
        editor: {
          kind: "floorImages",
          floorId: { ref: "params:floorId" },
        },
      }],
    });
    expect(Object.values(parsed.fields).map((item) => item.editor.kind)).toEqual(["bgmList", "floorImages"]);
  });

  it("parses the built-in map block schemas and their choice controls", () => {
    const parsedBundle = parseFieldSchemaBundle(mapBlockFieldsJson);
    const registry = createFieldSchemaRegistry(parsedBundle);
    const parsedUI = parseUISchema(mapBlockPropertiesJson, registry);
    expect(registry.get("mapBlock.trigger")?.editor.kind).toBe("select");
    expect(registry.get("mapBlock.passability")?.editor.kind).toBe("passability");
    expect(registry.get("mapBlock.name")?.type).toEqual(["string", "null"]);
    expect(registry.get("mapBlock.canPass")?.type).toEqual(["boolean", "null"]);
    expect(registry.get("mapBlock.canBreak")?.type).toEqual(["boolean", "null"]);
    const movement = parsedUI.nodes.find((item) => item.kind === "group" && item.id === "movement");
    expect(movement?.kind === "group" ? movement.children[0] : undefined).toMatchObject({
      sources: {
        cannotOut: { ref: "prefab:cannotOut" },
        cannotIn: { ref: "prefab:cannotIn" },
      },
    });
    expect(parsedUI.nodes.map((item) => item.kind)).toEqual(["group", "group", "group", "group", "rest"]);
  });

  it("parses item applicability conditions without executable schema strings", () => {
    const registry = createFieldSchemaRegistry(parseFieldSchemaBundle(itemFieldsJson));
    const parsedUI = parseUISchema(itemPropertiesJson, registry);
    expect(registry.get("item.cls")?.editor.kind).toBe("select");
    const pickup = parsedUI.nodes.find((item) => item.kind === "group" && item.id === "pickup");
    expect(pickup?.kind === "group" ? pickup.children[0].condition : undefined).toEqual({
      when: {
        operator: "eq",
        args: [{ ref: "prefab:cls" }, { literal: "items" }],
      },
      otherwise: "inactive",
    });
    const use = parsedUI.nodes.find((item) => item.kind === "group" && item.id === "use");
    expect(use?.kind === "group" ? use.children.map((item) => item.condition?.otherwise ?? "always") : [])
      .toEqual(["always", "inactive", "inactive", "inactive"]);
  });

  it("parses enemy registry choices and named applicability calls", () => {
    const registry = createFieldSchemaRegistry(parseFieldSchemaBundle(enemyFieldsJson));
    const parsedUI = parseUISchema(enemyPropertiesJson, registry);
    expect(registry.get("enemy.special")?.editor).toEqual({
      kind: "checkboxSet",
      reference: { ref: "project:enemySpecials" },
    });
    expect(registry.get("enemy.special")?.normalizer).toBe("numericScalarOrList");
    const specials = parsedUI.nodes.find((item) => item.kind === "group" && item.id === "specials");
    expect(specials?.kind === "group" ? specials.children.find((item) => (
      item.kind === "field" && item.fieldSchema === "enemy.n"
    ))?.condition : undefined).toEqual({
      when: {
        call: "enemy.hasSpecial",
        args: [{ ref: "prefab:special" }, { literal: 6 }],
      },
      otherwise: "inactive",
    });
  });

  it("parses the floor dimensions as one combined field", () => {
    const registry = createFieldSchemaRegistry(parseFieldSchemaBundle(floorFieldsJson));
    const parsedUI = parseUISchema(floorPropertiesJson, registry);
    expect(registry.get("floor.size")?.editor.kind).toBe("dimensions");
    const basic = parsedUI.nodes.find((item) => item.kind === "group" && item.id === "basic");
    expect(basic?.kind === "group" ? basic.children.find((item) => item.kind === "field" && item.fieldSchema === "floor.size") : undefined)
      .toMatchObject({
        sources: { width: { ref: "floor:width" }, height: { ref: "floor:height" } },
      });
  });

  it("parses loc event context, auto-event list and combined passability", () => {
    const registry = createFieldSchemaRegistry(parseFieldSchemaBundle(locFieldsJson));
    const parsedUI = parseUISchema(locPropertiesJson, registry);
    expect(registry.get("loc.events")?.editor).toMatchObject({
      kind: "event",
      entryType: "event",
      floorId: { ref: "params:floorId" },
      position: { ref: "params:position" },
    });
    expect(registry.get("loc.events")).toMatchObject({
      type: ["array", "object", "null"],
      normalizer: "optionalEvent",
      properties: { data: { type: ["array", "null"] } },
    });
    const locEvents = registry.get("loc.events")!;
    expect(fieldShapeIssues(locEvents, {
      present: true,
      value: { trigger: "action", enable: true, data: [{ type: "comment" }] },
    })).toEqual([]);
    expect(fieldShapeIssues(locEvents, {
      present: true,
      value: { trigger: "action", data: "invalid" },
    })).toMatchObject([{ path: ["data"], message: "Expected array | null" }]);
    expect(registry.get("loc.afterGetItem")).toMatchObject({
      type: ["array", "object", "null"],
      normalizer: "optionalEvent",
      properties: { data: { type: ["array", "null"] } },
    });
    for (const id of ["loc.beforeBattle", "loc.afterBattle", "loc.afterOpenDoor"] as const) {
      expect(registry.get(id)).toMatchObject({
        type: ["array", "null"],
        normalizer: "optionalEventList",
      });
    }
    expect(registry.get("loc.autoEvent")?.editor.kind).toBe("autoEventList");
    const passability = parsedUI.nodes.find((item) => item.kind === "group" && item.id === "passability");
    expect(passability?.kind === "group" ? passability.children[0] : undefined).toMatchObject({
      sources: {
        cannotOut: { ref: "loc:cannotMove" },
        cannotIn: { ref: "loc:cannotMoveIn" },
      },
    });
  });

  it("parses tower dynamic choices, string lists and initial position", () => {
    const registry = createFieldSchemaRegistry(parseFieldSchemaBundle(towerFieldsJson));
    const parsedUI = parseUISchema(towerPropertiesJson, registry);
    expect(registry.get("tower.hero.position")?.editor).toMatchObject({
      kind: "initialPosition",
      floors: { ref: "project:registry.floorIds" },
    });
    expect(registry.get("tower.equipName")?.editor.kind).toBe("orderedStringList");
    expect(registry.get("tower.hero.equipment")?.editor).toMatchObject({
      kind: "equipmentSlots",
      slots: { ref: "tower:main.equipName" },
      items: { ref: "project:registry.items" },
    });
    expect(registry.get("tower.hero.tools")?.editor).toMatchObject({
      kind: "itemCountRecord",
      category: "tools",
    });
    expect(registry.get("tower.nameMap")?.editor.kind).toBe("json");
    expect(registry.get("tower.startBgm")?.editor).toMatchObject({
      kind: "material",
      reference: { ref: "project:materials.bgms" },
    });
    expect(parsedUI.nodes.at(-1)).toMatchObject({ kind: "rest", id: "tower-rest" });
  });

  it("requires select editors to use exactly one option source", () => {
    const base = { $id: "test.choice", type: "string", title: "Choice" };
    expect(() => parseFieldSchemaBundle({
      schemaId: "choice.fields",
      version: 1,
      fields: [{ ...base, editor: { kind: "select" } }],
    })).toThrow("exactly one of options or reference");
    expect(() => parseFieldSchemaBundle({
      schemaId: "choice.fields",
      version: 1,
      fields: [{
        ...base,
        editor: {
          kind: "select",
          options: [{ value: "a" }],
          reference: { ref: "tower:main.floorIds" },
        },
      }],
    })).toThrow("exactly one of options or reference");
    expect(parseFieldSchemaBundle({
      schemaId: "choice.fields",
      version: 1,
      fields: [{
        ...base,
        editor: { kind: "select", reference: { ref: "tower:main.floorIds" } },
      }],
    }).fields["test.choice"].editor).toMatchObject({
      kind: "select",
      reference: { ref: "tower:main.floorIds" },
    });
  });

  it("requires exactly one single or named source binding for a field", () => {
    const base = { kind: "field", fieldSchema: "test.name" };
    expect(() => parseUISchema({ schemaId: "none", version: 1, nodes: [base] }, fields))
      .toThrow("exactly one of source or sources");
    expect(() => parseUISchema({
      schemaId: "both",
      version: 1,
      nodes: [{ ...base, source: { ref: "floor:name" }, sources: { other: { ref: "floor:other" } } }],
    }, fields)).toThrow("exactly one of source or sources");
  });

  it.each(["list", "record", "action"])("rejects unsupported %s nodes", (kind) => {
    expect(() => parseUISchema({
      schemaId: "test.ui",
      version: 1,
      nodes: [{ kind, id: "unsupported" }],
    }, fields)).toThrow(`Unsupported UI node kind: ${kind}`);
  });

  it("rejects unknown fields and malformed expressions", () => {
    expect(() => parseUISchema({
      schemaId: "test.ui",
      version: 1,
      nodes: [{ kind: "field", fieldSchema: "missing", source: { ref: "floor:name" } }],
    }, fields)).toThrow("Unknown Field Schema ID");
    expect(() => parseUISchema({
      schemaId: "test.ui",
      version: 1,
      nodes: [{
        kind: "field",
        fieldSchema: "test.name",
        source: { ref: "floor:name" },
        condition: { when: { operator: "eval", args: [] }, otherwise: "hidden" },
      }],
    }, fields)).toThrow("unsupported");
  });

  it("rejects the verification array format and slash references", () => {
    expect(() => parseFieldSchemaBundleV1({
      schemaId: "legacy.fields",
      version: 1,
      fields: [],
    })).toThrow("不支持的 Schema 格式");
    expect(() => parseUISchemaV1({
      kind: "table-schema",
      formatVersion: 1,
      schemaId: "bad-ref",
      revision: 1,
      nodes: [{ id: "bad", kind: "field", fieldSchema: "test.name", source: { ref: "floor:/name" } }],
    }, fields)).toThrow("unsupported v1 reference syntax");
  });

  it("accepts recursive static shape and diagnostic metadata", () => {
    const parsed = parseFieldSchemaBundleV1({
      kind: "field-bundle",
      formatVersion: 1,
      schemaId: "shape.fields",
      revision: 1,
      fields: {
        "shape.value": {
          type: "object",
          required: ["items"],
          properties: { items: { type: "array", items: { type: "string" } } },
          title: "Shape",
          editor: { kind: "json" },
          diagnostics: { "shape.invalid": "Shape is invalid" },
        },
      },
    });
    expect(parsed.fields["shape.value"].properties?.items.items?.type).toBe("string");
    expect(parsed.fields["shape.value"].diagnostics).toEqual({ "shape.invalid": "Shape is invalid" });
  });

  it("isolates duplicate global Field IDs as ambiguous", () => {
    const first = parseFieldSchemaBundleV1({
      kind: "field-bundle", formatVersion: 1, schemaId: "first", revision: 1,
      fields: { shared: { type: "string", title: "First", editor: { kind: "text" } } },
    });
    const second = parseFieldSchemaBundleV1({
      kind: "field-bundle", formatVersion: 1, schemaId: "second", revision: 1,
      fields: { shared: { type: "number", title: "Second", editor: { kind: "number" } } },
    });
    const registry = createGlobalFieldSchemaRegistry([first, second]);
    expect(registry.schemas.has("shared")).toBe(false);
    expect(registry.ambiguous.has("shared")).toBe(true);
    expect(() => parseUISchemaV1({
      kind: "table-schema", formatVersion: 1, schemaId: "ambiguous", revision: 1,
      nodes: [{ kind: "field", id: "shared", fieldSchema: "shared", source: { ref: "floor:shared" } }],
    }, registry.schemas, registry.ambiguous)).toThrow("Ambiguous Field Schema ID");
  });
});
