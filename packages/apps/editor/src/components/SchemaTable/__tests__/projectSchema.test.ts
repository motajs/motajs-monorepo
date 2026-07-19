import { describe, expect, it } from "vitest";
import { floorSchemaDefinition } from "../builtinSchemas";
import { resolveProjectSchema, schemaOverridePath } from "../projectSchema";
import {
  createSchemaOverrideDraft,
  validateAndNormalizeSchemaOverride,
} from "../schemaOverrideCommands";

const missing = { status: "not-found" } as const;

describe("project SchemaTable overrides", () => {
  it("uses the built-in Field and UI schemas when no override exists", () => {
    const result = resolveProjectSchema(floorSchemaDefinition, missing, missing);
    expect(result).toMatchObject({
      status: "ready",
      hasFieldOverride: false,
      hasUiOverride: false,
    });
    if (result.status !== "ready") throw new Error("expected ready schema");
    expect(result.fieldBundle).toBe(floorSchemaDefinition.fieldBundle);
    expect(result.uiSchema.schemaId).toBe("floor-properties");
  });

  it("fully replaces both layers with strict JSON project overrides", () => {
    const fieldSource = {
      kind: "field-bundle",
      formatVersion: 1,
      schemaId: "floor.fields",
      revision: 17,
      fields: { "floor.custom": { type: "string", title: "自定义", editor: { kind: "text" } } },
    };
    const uiSource = {
      kind: "table-schema",
      formatVersion: 1,
      schemaId: "floor-properties",
      revision: 23,
      nodes: [{ kind: "field", id: "custom", fieldSchema: "floor.custom", source: { ref: "floor:custom" } }],
    };
    const result = resolveProjectSchema(
      floorSchemaDefinition,
      { status: "loaded", value: JSON.stringify(fieldSource) },
      { status: "loaded", value: JSON.stringify(uiSource) },
    );
    expect(result).toMatchObject({
      status: "ready",
      hasFieldOverride: true,
      hasUiOverride: true,
    });
    if (result.status !== "ready") throw new Error("expected ready schema");
    expect(result.fieldBundle.revision).toBe(17);
    expect(result.fieldSchemas.has("floor.title")).toBe(false);
    expect(result.uiSchema.nodes).toHaveLength(1);
  });

  it("surfaces a broken override instead of silently falling back", () => {
    const malformed = resolveProjectSchema(
      floorSchemaDefinition,
      { status: "loaded", value: "{ nope" },
      missing,
    );
    expect(malformed).toMatchObject({ status: "error", layer: "field" });

    const unknownField = resolveProjectSchema(
      floorSchemaDefinition,
      missing,
      {
        status: "loaded",
        value: JSON.stringify({
          kind: "table-schema",
          formatVersion: 1,
          schemaId: "floor-properties",
          revision: 1,
          nodes: [{ kind: "field", id: "missing", fieldSchema: "floor.missing", source: { ref: "floor:missing" } }],
        }),
      },
    );
    expect(unknownField).toMatchObject({ status: "error", layer: "ui" });
  });

  it("resolves Table fields through the global cross-Bundle registry", () => {
    const uiSource = {
      kind: "table-schema",
      formatVersion: 1,
      schemaId: "floor-properties",
      revision: 1,
      nodes: [{ kind: "field", id: "version", fieldSchema: "tower.version", source: { ref: "floor:version" } }],
    };
    const result = resolveProjectSchema(
      floorSchemaDefinition,
      missing,
      { status: "loaded", value: JSON.stringify(uiSource) },
    );
    expect(result.status).toBe("ready");
    if (result.status === "ready") expect(result.fieldOwners.get("tower.version")?.fieldBundle.schemaId).toBe("tower.fields");
  });

  it("forks the complete built-in source and records its origin", async () => {
    const draft = JSON.parse(await createSchemaOverrideDraft(floorSchemaDefinition, "ui")) as Record<string, unknown>;
    expect(draft.schemaId).toBe("floor-properties");
    expect(draft.nodes).toEqual(floorSchemaDefinition.uiSource.nodes);
    expect(draft.forkedFrom).toMatchObject({ revision: floorSchemaDefinition.uiSchema.revision });
    expect((draft.forkedFrom as { digest: string }).digest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(schemaOverridePath(floorSchemaDefinition, "ui"))
      .toBe(".metaphysics/schemas/ui/floor-properties.json");
  });

  it("normalizes metadata but rejects a schemaId from another table", async () => {
    const normalized = JSON.parse(await validateAndNormalizeSchemaOverride(
      floorSchemaDefinition,
      "field",
      JSON.stringify(floorSchemaDefinition.fieldSource),
    )) as Record<string, unknown>;
    expect(normalized.forkedFrom).toMatchObject({ revision: floorSchemaDefinition.fieldBundle.revision });
    expect((normalized.forkedFrom as { digest: string }).digest).toMatch(/^sha256:[a-f0-9]{64}$/);

    await expect(validateAndNormalizeSchemaOverride(
      floorSchemaDefinition,
      "field",
      JSON.stringify({ ...floorSchemaDefinition.fieldSource, schemaId: "other.fields" }),
    )).rejects.toThrow("schemaId 必须保持为 floor.fields");
  });
});
