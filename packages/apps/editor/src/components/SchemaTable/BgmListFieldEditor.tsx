import { useSelectMaterialModalAction } from "@/Workbench/modals/SelectMaterial";
import { Music } from "lucide-react";
import { type FC, useCallback, useEffect, useMemo, useState } from "react";
import { CollectionControl } from "./CollectionControl";
import { resolveReference } from "./reference";
import type { BlockResolution, FieldSchema, RawSlot, SchemaScope } from "./types";

interface BgmListFieldEditorProps {
  schema: FieldSchema;
  value: unknown;
  disabled: boolean;
  scope: SchemaScope;
  onCommit(value: unknown): Promise<void>;
}

function useRegistrySnapshot(
  schema: FieldSchema,
  scope: SchemaScope,
): BlockResolution<RawSlot<unknown>> {
  const descriptor = schema.editor;
  const source = useMemo(
    () => resolveReference(
      scope,
      descriptor.kind === "bgmList" ? descriptor.reference : { ref: "project:invalid" },
    ),
    [descriptor, scope],
  );
  const [snapshot, setSnapshot] = useState(() => source.snapshot());
  useEffect(() => source.subscribe(() => setSnapshot(source.snapshot())), [source]);
  useEffect(() => {
    if (source.snapshot().status === "loading") void source.ensureLoaded?.();
  }, [source]);
  return snapshot;
}

export const BgmListFieldEditor: FC<BgmListFieldEditorProps> = ({
  schema,
  value,
  disabled,
  scope,
  onCommit,
}) => {
  const descriptor = schema.editor;
  const selectMaterial = useSelectMaterialModalAction();
  const registry = useRegistrySnapshot(schema, scope);
  const directory = descriptor.kind === "bgmList" ? descriptor.directory : "project/bgms";
  const items = useMemo(
    () => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [],
    [value],
  );
  const blocked = disabled || registry.status !== "ready";

  const chooseOne = useCallback(async (current: string): Promise<string | undefined> => {
    const result = await selectMaterial({
      title: "替换背景音乐",
      value: current,
      directory,
      source: { kind: "directory", path: directory },
      multiple: false,
      transform: (name) => /\.(mp3|ogg|wav|m4a|flac)$/i.test(name) ? name : null,
    });
    return result?.[0];
  }, [directory, selectMaterial]);

  const chooseMany = useCallback(async (): Promise<string[] | undefined> => {
    const result = await selectMaterial({
      title: "添加背景音乐",
      directory,
      source: { kind: "directory", path: directory },
      multiple: true,
      transform: (name) => /\.(mp3|ogg|wav|m4a|flac)$/i.test(name) ? name : null,
    });
    return result ?? undefined;
  }, [directory, selectMaterial]);

  const replace = useCallback(async (index: number) => {
    const nextValue = await chooseOne(items[index]);
    if (!nextValue) return;
    const next = [...items];
    next[index] = nextValue;
    await onCommit(next);
  }, [chooseOne, items, onCommit]);

  if (descriptor.kind !== "bgmList") return null;
  return (
    <div className="schemaBgmList" data-source-status={registry.status} data-test-id="schema-bgm-list">
      <CollectionControl
        items={items}
        disabled={blocked}
        emptyText="未设置背景音乐"
        createLabel="添加音乐"
        reorderMode="drag"
        itemKey={(item, index) => `${index}:${item}`}
        renderItem={(item, index) => (
          <button
            type="button"
            className="schemaBgmItem"
            aria-label={`替换背景音乐 ${item}`}
            title="点击替换背景音乐"
            disabled={blocked}
            onClick={(event) => {
              event.stopPropagation();
              void replace(index);
            }}
          >
            <Music size={15} aria-hidden="true" />
            <span title={item}>{item}</span>
          </button>
        )}
        onCreate={() => {
          void chooseMany().then((selected) => {
            if (!selected?.length) return undefined;
            const existing = new Set(items);
            const additions = selected.filter((item) => !existing.has(item));
            return additions.length > 0 ? onCommit([...items, ...additions]) : undefined;
          });
        }}
        onRemove={(index) => void onCommit(items.filter((_item, itemIndex) => itemIndex !== index))}
        onMove={(index, nextIndex) => {
          const next = [...items];
          const [moved] = next.splice(index, 1);
          if (moved == null) return;
          next.splice(nextIndex, 0, moved);
          void onCommit(next);
        }}
      />
      {registry.status === "loading" ? <div className="schemaTableSkeleton" aria-label="loading" /> : null}
      {registry.status === "error" || registry.status === "type-mismatch"
        ? <div className="schemaTableError">{registry.error.message}</div>
        : null}
    </div>
  );
};
