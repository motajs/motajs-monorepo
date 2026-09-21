import * as Blockly from 'blockly';

export const PROJECT_EVENT_PASSTHROUGH_EXTENSION = 'mota_project_event_passthrough';
export const PROJECT_EVENT_RAW_STATE_KEY = 'motaProjectEventRaw';

type PassthroughBlock = Blockly.Block & {
  [PROJECT_EVENT_RAW_STATE_KEY]?: Record<string, unknown>;
};

function cloneRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return structuredClone(value as Record<string, unknown>);
}

export function readProjectEventRaw(block: Blockly.Block): Record<string, unknown> | undefined {
  return cloneRecord((block as PassthroughBlock)[PROJECT_EVENT_RAW_STATE_KEY]);
}

export function registerProjectEventPassthroughExtension(): void {
  if (Blockly.Extensions.isRegistered(PROJECT_EVENT_PASSTHROUGH_EXTENSION)) return;
  // Blockly treats saveExtraState/loadExtraState as mutator hooks even though
  // this state does not change block shape. Registering it as a plain mixin is
  // rejected when a block is instantiated.
  Blockly.Extensions.registerMutator(PROJECT_EVENT_PASSTHROUGH_EXTENSION, {
    saveExtraState(this: PassthroughBlock) {
      const raw = cloneRecord(this[PROJECT_EVENT_RAW_STATE_KEY]);
      return raw ? { raw } : null;
    },
    loadExtraState(this: PassthroughBlock, state: unknown) {
      const raw =
        state && typeof state === 'object' && !Array.isArray(state)
          ? cloneRecord((state as { raw?: unknown }).raw)
          : undefined;
      if (raw) this[PROJECT_EVENT_RAW_STATE_KEY] = raw;
      else delete this[PROJECT_EVENT_RAW_STATE_KEY];
    },
  });
}
