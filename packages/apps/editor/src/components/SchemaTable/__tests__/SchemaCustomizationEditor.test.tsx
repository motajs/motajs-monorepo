/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectReferenceRoot } from "../reference";
import { SchemaCustomizationEditor } from "../SchemaCustomizationEditor";
import { setSchemaCustomizationState } from "../schemaCustomizationState";
import type { BuiltinSchemaDefinition, ProjectSchemaResolution } from "../projectSchema";

const mocks = vi.hoisted(() => ({
  saveSchemaSources: vi.fn(async () => undefined),
  openCodeEditor: vi.fn(),
  resolution: undefined as ProjectSchemaResolution | undefined,
}));

vi.mock("../schemaOverrideCommands", async (importOriginal) => ({
  ...await importOriginal<typeof import("../schemaOverrideCommands")>(),
  saveSchemaSources: mocks.saveSchemaSources,
  loadSchemaOverrideDraft: vi.fn(async () => "{}"),
  saveSchemaOverride: vi.fn(async () => undefined),
}));
vi.mock("../projectSchema", async (importOriginal) => ({
  ...await importOriginal<typeof import("../projectSchema")>(),
  useProjectSchema: () => mocks.resolution,
}));
vi.mock("@/Workbench/CodeEditor/CodeEditorContext", () => ({ useCodeEditor: () => ({ open: mocks.openCodeEditor }) }));
vi.mock("@/Workbench/EventsEditor/EventEditorContext", () => ({ useEventEditor: () => ({ open: vi.fn() }) }));
vi.mock("@/Workbench/modals/SelectMaterial", () => ({ useSelectMaterialModalAction: () => vi.fn() }));
vi.mock("@/Workbench/modals/SelectPoint", () => ({ useSelectPointModalAction: () => vi.fn() }));

const fieldSource = {
  kind: "field-bundle" as const,
  formatVersion: 1 as const,
  schemaId: "test.fields",
  revision: 1,
  fields: { value: { type: "string" as const, title: "Value", editor: { kind: "text" as const } } },
};
const uiSource = {
  kind: "table-schema" as const,
  formatVersion: 1 as const,
  schemaId: "test-table",
  revision: 1,
  nodes: [{ kind: "field" as const, id: "value-node", fieldSchema: "value", source: { ref: "floor:value" } }],
};
const definition: BuiltinSchemaDefinition = {
  fieldSource,
  uiSource,
  fieldBundle: fieldSource,
  fieldSchemas: new Map(Object.entries(fieldSource.fields)),
  uiSchema: uiSource,
};
const ready: Extract<ProjectSchemaResolution, { status: "ready" }> = {
  status: "ready",
  fieldBundle: fieldSource,
  fieldSchemas: definition.fieldSchemas,
  ambiguousFieldIds: new Set(),
  fieldOwners: new Map([["value", definition]]),
  uiSchema: uiSource,
  fieldSource,
  uiSource,
  hasFieldOverride: false,
  hasUiOverride: false,
};

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  mocks.resolution = ready;
  mocks.saveSchemaSources.mockClear();
  setSchemaCustomizationState("test-table", { enabled: true, selectedNodeId: "value-node" });
});

afterEach(() => {
  cleanup();
  setSchemaCustomizationState("test-table", { enabled: false });
  vi.unstubAllGlobals();
});

describe("SchemaTable inline customization", () => {
  it("partitions the Field drawer and saves the current Field without opening the whole Bundle", async () => {
    render(<SchemaCustomizationEditor
      definition={definition}
      resolution={ready}
      scope={{ roots: { floor: new ObjectReferenceRoot("floor", () => ({ value: "old" })) } }}
    />);
    expect(screen.getByRole("heading", { name: "表格节点" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "字段定义" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /打开完整 Field Bundle/ })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "Renamed" } });
    fireEvent.click(screen.getByRole("button", { name: /确\s*认/ }));
    await waitFor(() => expect(mocks.saveSchemaSources).toHaveBeenCalled());
    const changes = mocks.saveSchemaSources.mock.calls[0][1] as { field: typeof fieldSource };
    expect(changes.field.fields.value.title).toBe("Renamed");
    expect(mocks.openCodeEditor).not.toHaveBeenCalled();
  });
});
