import {
  useLayoutEffect,
  useState,
} from "react";

export interface SchemaCustomizationState {
  enabled: boolean;
  selectedNodeId?: string;
}

export interface SchemaCustomizationViewport {
  tableSchemaId?: string;
  selectedNodeId?: string;
}

interface SharedSchemaCustomizationStore {
  states: Map<string, SchemaCustomizationState>;
  snapshot: number;
}

const sharedGlobal = globalThis as typeof globalThis & {
  __MOTA_SCHEMA_CUSTOMIZATION_STORE__?: SharedSchemaCustomizationStore;
};
const shared = sharedGlobal.__MOTA_SCHEMA_CUSTOMIZATION_STORE__ ??= {
  states: new Map<string, SchemaCustomizationState>(),
  snapshot: 0,
};
const SCHEMA_CUSTOMIZATION_EVENT = "motajs:schema-customization-change";

function emit(): void {
  shared.snapshot += 1;
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SCHEMA_CUSTOMIZATION_EVENT));
}

export function getSchemaCustomizationState(schemaId: string): SchemaCustomizationState {
  return shared.states.get(schemaId) ?? { enabled: false };
}

export function setSchemaCustomizationState(schemaId: string, state: SchemaCustomizationState): void {
  const current = getSchemaCustomizationState(schemaId);
  if (current.enabled === state.enabled && current.selectedNodeId === state.selectedNodeId) return;
  if (!state.enabled && !state.selectedNodeId) shared.states.delete(schemaId);
  else shared.states.set(schemaId, state);
  emit();
}

export function toggleSchemaCustomization(schemaId: string): void {
  const current = getSchemaCustomizationState(schemaId);
  setSchemaCustomizationState(schemaId, { enabled: !current.enabled });
}

export function selectSchemaCustomizationNode(schemaId: string, selectedNodeId?: string): void {
  setSchemaCustomizationState(schemaId, { enabled: true, selectedNodeId });
}

export function useSchemaCustomizationState(schemaId: string): SchemaCustomizationState {
  const [state, setState] = useState(() => getSchemaCustomizationState(schemaId));
  useLayoutEffect(() => {
    const update = () => setState(getSchemaCustomizationState(schemaId));
    update();
    window.addEventListener(SCHEMA_CUSTOMIZATION_EVENT, update);
    return () => window.removeEventListener(SCHEMA_CUSTOMIZATION_EVENT, update);
  }, [schemaId]);
  return state;
}

export function captureSchemaCustomizationViewport(): SchemaCustomizationViewport {
  for (const [tableSchemaId, state] of shared.states) {
    if (state.enabled) return { tableSchemaId, selectedNodeId: state.selectedNodeId };
  }
  return {};
}

export function restoreSchemaCustomizationViewport(viewport: SchemaCustomizationViewport | undefined): void {
  let changed = shared.states.size > 0;
  shared.states.clear();
  if (viewport?.tableSchemaId) {
    shared.states.set(viewport.tableSchemaId, { enabled: true, selectedNodeId: viewport.selectedNodeId });
    changed = true;
  }
  if (changed) emit();
}
