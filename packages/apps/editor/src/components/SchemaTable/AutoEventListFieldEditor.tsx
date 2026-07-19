import { useEventEditor } from "@/Workbench/EventsEditor/EventEditorContext";
import { Zap } from "lucide-react";
import { type FC, useMemo } from "react";
import { CollectionControl } from "./CollectionControl";
import { evaluateExpression } from "./expression";
import type { AutoEventEditingPage } from "./normalizers";
import type { DataReference, FieldSchema, SchemaScope } from "./types";

interface AutoEventListFieldEditorProps {
  fieldSchemaId: string;
  schema: FieldSchema;
  value: unknown;
  disabled: boolean;
  scope: SchemaScope;
  onCommit(value: unknown): Promise<void>;
}

function referencedValue(reference: DataReference | undefined, scope: SchemaScope): unknown {
  if (!reference) return undefined;
  const result = evaluateExpression(reference, scope);
  return result.status === "ready" ? result.value : undefined;
}

function eventPosition(value: unknown): { x: number; y: number } | undefined {
  if (Array.isArray(value) && value.length >= 2 && value.every(Number.isFinite)) {
    return { x: Number(value[0]), y: Number(value[1]) };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  return Number.isFinite(record.x) && Number.isFinite(record.y)
    ? { x: Number(record.x), y: Number(record.y) }
    : undefined;
}

function pageSummary(value: AutoEventEditingPage["value"]): string {
  if (value == null) return "未配置";
  const condition = typeof value.condition === "string" && value.condition
    ? value.condition
    : "无条件";
  const priority = typeof value.priority === "number" ? `优先级 ${value.priority}` : "优先级 0";
  return `${condition} · ${priority}`;
}

function renumber(pages: AutoEventEditingPage[]): AutoEventEditingPage[] {
  return pages.map((page, id) => ({ ...page, id }));
}

export const AutoEventListFieldEditor: FC<AutoEventListFieldEditorProps> = ({
  fieldSchemaId,
  schema,
  value,
  disabled,
  scope,
  onCommit,
}) => {
  const eventEditor = useEventEditor();
  const descriptor = schema.editor;
  const pages = useMemo(
    () => Array.isArray(value) ? value as AutoEventEditingPage[] : [],
    [value],
  );
  if (descriptor.kind !== "autoEventList") return null;

  const floorIdValue = referencedValue(descriptor.floorId, scope);
  const positionValue = referencedValue(descriptor.position, scope);
  const floorId = typeof floorIdValue === "string" ? floorIdValue : undefined;
  const position = eventPosition(positionValue);

  const editPage = (index: number) => {
    const page = pages[index];
    if (!page || disabled) return;
    eventEditor.open({
      contextId: `schema-table:${fieldSchemaId}:${page.id}`,
      entryType: "autoEvent",
      initialValue: page.value,
      floorId,
      position,
      onConfirm: async (nextValue) => {
        if (!nextValue || typeof nextValue !== "object" || Array.isArray(nextValue)) {
          throw new Error("自动事件编辑器必须返回一个自动事件对象");
        }
        const next = [...pages];
        next[index] = {
          ...page,
          value: nextValue as Record<string, unknown>,
        };
        await onCommit(next);
      },
    });
  };

  return (
    <div className="schemaAutoEventList" data-test-id="schema-auto-event-list">
      <CollectionControl
        items={pages}
        disabled={disabled}
        emptyText="未设置自动事件"
        createLabel="添加自动事件页"
        reorderMode="drag"
        itemKey={(page, index) => `${page.id}:${index}`}
        renderItem={(page, index) => (
          <button
            type="button"
            className="schemaAutoEventItem"
            disabled={disabled}
            aria-label={`编辑自动事件第 ${page.id} 页`}
            title="点击编辑自动事件"
            onClick={(event) => {
              event.stopPropagation();
              editPage(index);
            }}
          >
            <Zap size={15} aria-hidden="true" />
            <strong>第 {page.id} 页</strong>
            <span>{pageSummary(page.value)}</span>
          </button>
        )}
        onCreate={() => {
          const nextId = pages.reduce((max, page) => Math.max(max, page.id), -1) + 1;
          void onCommit([...pages, { id: nextId, value: null }]);
        }}
        onRemove={(index) => void onCommit(renumber(pages.filter((_page, pageIndex) => pageIndex !== index)))}
        onMove={(index, nextIndex) => {
          const next = [...pages];
          const [moved] = next.splice(index, 1);
          if (!moved) return;
          next.splice(nextIndex, 0, moved);
          void onCommit(renumber(next));
        }}
      />
    </div>
  );
};
