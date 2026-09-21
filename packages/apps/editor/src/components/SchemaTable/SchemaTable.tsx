import { ColorInput } from '@/components/Table/components/inputs';
import { BlockPickerField } from '@/components/BlockPicker/BlockPickerField';
import { notifyError, notifySuccess } from '@/utils/notify';
import { useCodeEditor } from '@/Workbench/CodeEditor/CodeEditorContext';
import { useEventEditor } from '@/Workbench/EventsEditor/EventEditorContext';
import { useSelectMaterialModalAction } from '@/Workbench/modals/SelectMaterial';
import { useSelectPointModalAction } from '@/Workbench/modals/SelectPoint';
import { useCheckboxSetModalAction } from '@/Workbench/modals/CheckboxSet';
import { AutoComplete, InputNumber, Modal, Select, Tooltip } from 'antd';
import { Copy, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import {
  type FC,
  Fragment,
  type HTMLAttributes,
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { evaluateExpression } from './expression';
import { BgmListFieldEditor } from './BgmListFieldEditor';
import { AutoEventListFieldEditor } from './AutoEventListFieldEditor';
import { CollectionControl } from './CollectionControl';
import { FloorImagesFieldEditor } from './FloorImagesFieldEditor';
import { ImageAssetPickerModal } from './ImageAssetPickerModal';
import { PassabilityFieldEditor } from './PassabilityFieldEditor';
import { builtinNormalizers } from './normalizers';
import {
  appendReferencePath,
  createBoundSchemaScope,
  isWritableValueSource,
  resolveCombinedReferences,
  resolveReference,
  resolveReferencePath,
} from './reference';
import {
  collectReferencedPaths,
  collectRestEntries,
  extendReferenceBindings,
  fieldExpectedDescription,
  fieldShapeIssues,
  formatReferencedPath,
  resolveBoundReference,
  type FieldShapeIssue,
  type ReferenceBindings,
  type RestEntry,
} from './runtime';
import type {
  BlockResolution,
  Condition,
  DataReference,
  Diagnostic,
  Expression,
  FieldNode,
  FieldSchema,
  Normalizer,
  NormalizerRegistry,
  RawSlot,
  RestNode,
  SchemaScope,
  UINode,
  UISchema,
  ValueSource,
} from './types';
import './schema-table.css';

export interface SchemaTableProps {
  fieldSchemas: ReadonlyMap<string, FieldSchema>;
  uiSchema: UISchema;
  scope: SchemaScope;
  diagnostics?: Diagnostic[];
  normalizers?: NormalizerRegistry;
  fieldActions?: ReadonlyMap<string, ReactNode>;
  /** 仅影响 renderer 的响应式布局，不进入 UI Schema。 */
  columns?: 1 | 2 | 3;
  customization?: SchemaTableCustomization;
}

export interface SchemaTableCustomization {
  selectedNodeId?: string;
  onSelect(nodeId: string): void;
  onMove(sourceNodeId: string, targetNodeId: string, placement: 'before' | 'inside'): void;
  onDelete(nodeId: string): void;
}

interface RuntimeProps extends SchemaTableProps {
  references: ReturnType<typeof collectReferencedPaths>;
  bindings: ReferenceBindings;
  inheritedDisabled?: boolean;
  inheritedInactive?: boolean;
}

type ConditionPresentation = 'normal' | 'hidden' | 'disabled' | 'inactive';

function fieldNodeReferences(node: FieldNode) {
  return node.source ? [node.source] : Object.values(node.sources ?? {});
}

function customizationRowAttributes(
  nodeId: string,
  customization: SchemaTableCustomization | undefined,
): HTMLAttributes<HTMLTableRowElement> & { draggable?: boolean; 'data-schema-node-id'?: string } {
  if (!customization) return {};
  return {
    className: `schemaTableCustomizable${customization.selectedNodeId === nodeId ? ' selected' : ''}`,
    'data-schema-node-id': nodeId,
    draggable: true,
    onClick: (event) => {
      event.stopPropagation();
      customization.onSelect(nodeId);
    },
    onDragStart: (event) => {
      event.stopPropagation();
      event.dataTransfer.setData('application/x-schema-node', nodeId);
      event.dataTransfer.effectAllowed = 'move';
    },
    onDragOver: (event) => event.preventDefault(),
    onDrop: (event) => {
      event.preventDefault();
      event.stopPropagation();
      const source = event.dataTransfer.getData('application/x-schema-node');
      if (source && source !== nodeId) customization.onMove(source, nodeId, 'before');
    },
  };
}

function NodeMenuButton({ nodeId, customization }: { nodeId: string; customization?: SchemaTableCustomization }) {
  if (!customization) return null;
  return (
    <span className="schemaNodeMenu" onClick={(event) => event.stopPropagation()}>
      <button type="button" className="schemaTableIconButton schemaNodeMenuButton" aria-label={`节点菜单 ${nodeId}`}>
        <MoreHorizontal size={14} />
      </button>
      <span className="schemaNodeMenuPopup">
        <button type="button" onClick={() => customization.onSelect(nodeId)}>
          编辑节点
        </button>
        <button type="button" className="danger" onClick={() => customization.onDelete(nodeId)}>
          删除节点
        </button>
      </span>
    </span>
  );
}

const copyableEditorKinds = new Set(['json', 'event', 'code', 'point', 'color', 'material', 'floorImages']);

function useSourceSnapshot(source: ValueSource<unknown>): BlockResolution<RawSlot<unknown>> {
  const [snapshot, setSnapshot] = useState(() => source.snapshot());
  useEffect(() => source.subscribe(() => setSnapshot(source.snapshot())), [source]);
  useEffect(() => {
    if (source.snapshot().status === 'loading') void source.ensureLoaded?.();
  }, [source]);
  return isWritableValueSource(source) ? source.snapshot() : snapshot;
}

function conditionPresentation(
  condition: Condition | undefined,
  scope: SchemaScope,
  slot?: RawSlot<unknown>,
): BlockResolution<ConditionPresentation> {
  if (!condition) return { status: 'ready', value: 'normal' };
  const result = evaluateExpression(condition.when, scope, '$condition.when');
  if (result.status !== 'ready') return result;
  if (typeof result.value !== 'boolean') {
    return {
      status: 'type-mismatch',
      rawValue: result.value,
      error: new Error('Condition must resolve to boolean'),
    };
  }
  if (result.value) return { status: 'ready', value: 'normal' };
  if (condition.otherwise === 'hidden') return { status: 'ready', value: 'hidden' };
  if (condition.otherwise === 'hidden-if-empty') {
    const empty = !slot?.present || slot.value == null;
    return { status: 'ready', value: empty ? 'hidden' : 'normal' };
  }
  return { status: 'ready', value: condition.otherwise };
}

function expressionReferences(expression: Expression): DataReference[] {
  if ('ref' in expression) return [expression];
  if ('literal' in expression) return [];
  return (expression.args ?? []).flatMap(expressionReferences);
}

function useConditionPresentation(
  condition: Condition | undefined,
  scope: SchemaScope,
  slot?: RawSlot<unknown>,
): BlockResolution<ConditionPresentation> {
  const sources = useMemo(() => {
    if (!condition) return [];
    const unique = new Map(expressionReferences(condition.when).map((reference) => [reference.ref, reference]));
    return [...unique.values()].map((reference) => resolveReference(scope, reference));
  }, [condition, scope]);
  const slotState = !slot?.present ? 'missing' : slot.value == null ? 'empty' : 'present';
  const [update, setUpdate] = useState<{
    condition: Condition | undefined;
    scope: SchemaScope;
    slotState: string;
    presentation: BlockResolution<ConditionPresentation>;
  }>();
  useEffect(() => {
    const refresh = () =>
      setUpdate({
        condition,
        scope,
        slotState,
        presentation: conditionPresentation(condition, scope, slot),
      });
    const dispose = sources.map((source) => source.subscribe(refresh));
    for (const source of sources) if (source.snapshot().status === 'loading') void source.ensureLoaded?.();
    return () => dispose.forEach((unsubscribe) => unsubscribe());
  }, [condition, scope, slot, slotState, sources]);
  if (update && update.condition === condition && update.scope === scope && update.slotState === slotState) {
    return update.presentation;
  }
  return conditionPresentation(condition, scope, slot);
}

function valueSummary(value: unknown): string {
  if (value === undefined) return '未设置';
  if (value === null) return '未设定';
  if (typeof value === 'string') return value || '空字符串';
  try {
    const text = JSON.stringify(value) ?? 'undefined';
    return text.length > 80 ? `${text.slice(0, 77)}...` : text;
  } catch {
    return String(value);
  }
}

function FieldLabel({ schema, sourceKey }: { schema: FieldSchema; sourceKey: string }) {
  const descriptions = [schema.description, ...Object.values(schema.diagnostics ?? {})].filter(
    (line, index, lines): line is string => Boolean(line) && lines.indexOf(line) === index,
  );
  const label = <strong className="schemaTableFieldName hasHelp">{schema.title}</strong>;
  return (
    <Tooltip
      placement="right"
      title={
        <div className="schemaTableFieldTooltip">
          <div className="schemaTableFieldKey">{sourceKey}</div>
          {descriptions.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      }
    >
      {label}
    </Tooltip>
  );
}

function BlockRow({
  resolution,
  label,
  nodeId,
  customization,
}: {
  resolution: Exclude<BlockResolution<unknown>, { status: 'ready' }>;
  label: string;
  nodeId?: string;
  customization?: SchemaTableCustomization;
}) {
  const row = nodeId ? customizationRowAttributes(nodeId, customization) : {};
  return (
    <tr {...row} data-test-id={`schema-block-${label}`}>
      <td>
        <div className="schemaNodeLabel">
          <span>{label}</span>
          {nodeId ? <NodeMenuButton nodeId={nodeId} customization={customization} /> : null}
        </div>
      </td>
      <td>
        {resolution.status === 'loading' ? (
          <div className="schemaTableSkeleton" aria-label="loading" />
        ) : (
          <div className="schemaTableError">{resolution.error.message}</div>
        )}
      </td>
    </tr>
  );
}

function HiddenFieldRow({
  node,
  label,
  customization,
}: {
  node: FieldNode;
  label: string;
  customization: SchemaTableCustomization;
}) {
  const row = customizationRowAttributes(node.id, customization);
  return (
    <tr
      {...row}
      className={`schemaTableInactive ${row.className ?? ''}`}
      data-test-id={`schema-hidden-field-${node.id}`}
    >
      <td>
        <div className="schemaNodeLabel">
          <strong>{label}</strong>
          <NodeMenuButton nodeId={node.id} customization={customization} />
        </div>
      </td>
      <td>
        <span className="schemaTableMuted">Condition 当前为 hidden；结构编辑模式仍保留节点。</span>
      </td>
    </tr>
  );
}

function JsonEditor({
  value,
  disabled,
  onCommit,
}: {
  value: unknown;
  disabled?: boolean;
  onCommit(value: unknown): void | Promise<void>;
}) {
  const serialized = JSON.stringify(value, null, 2) ?? 'null';
  const [draft, setDraft] = useState(() => ({
    source: serialized,
    text: serialized,
    error: undefined as string | undefined,
  }));
  const current = draft.source === serialized ? draft : { source: serialized, text: serialized, error: undefined };
  const commit = useCallback(async () => {
    try {
      const parsed = JSON.parse(current.text);
      await onCommit(parsed);
      setDraft((state) => (state.source === serialized ? { ...state, error: undefined } : state));
    } catch (reason) {
      const error = reason instanceof Error ? reason.message : String(reason);
      setDraft((state) => (state.source === serialized ? { ...state, error } : state));
    }
  }, [current.text, onCommit, serialized]);
  return (
    <div className="schemaTableJsonEditor">
      <textarea
        disabled={disabled}
        value={current.text}
        onChange={(event) => setDraft({ source: serialized, text: event.target.value, error: undefined })}
        onBlur={() => void commit()}
      />
      {current.error ? <div className="schemaTableError">{current.error}</div> : null}
    </div>
  );
}

function TextEditor({
  value,
  disabled,
  numericType,
  onCommit,
}: {
  value: unknown;
  disabled?: boolean;
  numericType?: 'number' | 'integer';
  onCommit(value: unknown): void | Promise<void>;
}) {
  const serialized = value == null ? '' : String(value);
  const [draft, setDraft] = useState(() => ({
    source: serialized,
    text: serialized,
    error: undefined as string | undefined,
  }));
  const current = draft.source === serialized ? draft : { source: serialized, text: serialized, error: undefined };
  const commit = useCallback(async () => {
    const next = numericType ? Number(current.text) : current.text;
    if (numericType && (current.text.trim() === '' || !Number.isFinite(next))) {
      setDraft((state) => (state.source === serialized ? { ...state, error: '请输入有效数字' } : state));
      return;
    }
    if (numericType === 'integer' && !Number.isInteger(next)) {
      setDraft((state) => (state.source === serialized ? { ...state, error: '请输入整数' } : state));
      return;
    }
    try {
      await onCommit(next);
      setDraft((state) => (state.source === serialized ? { ...state, error: undefined } : state));
    } catch (reason) {
      const error = reason instanceof Error ? reason.message : String(reason);
      setDraft((state) => (state.source === serialized ? { ...state, error } : state));
    }
  }, [current.text, numericType, onCommit, serialized]);
  return (
    <div>
      <input
        type={numericType ? 'number' : 'text'}
        step={numericType === 'integer' ? 1 : numericType === 'number' ? 'any' : undefined}
        disabled={disabled}
        value={current.text}
        onChange={(event) => setDraft({ source: serialized, text: event.target.value, error: undefined })}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') void commit();
        }}
      />
      {current.error ? <div className="schemaTableError">{current.error}</div> : null}
    </div>
  );
}

function RawFallback({
  source,
  rawValue,
  error,
  label,
  disabled,
  diagnostics,
  nodeId,
  customization,
}: {
  source: ValueSource<unknown>;
  rawValue: unknown;
  error: Error;
  label: string;
  disabled?: boolean;
  diagnostics?: Diagnostic[];
  nodeId?: string;
  customization?: SchemaTableCustomization;
}) {
  const writable = isWritableValueSource(source) && !disabled;
  const [commitError, setCommitError] = useState<string>();
  const commit = useCallback(
    async (value: unknown) => {
      if (!writable) return;
      try {
        await source.set(value);
        setCommitError(undefined);
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : String(reason);
        setCommitError(message);
        notifyError(message);
        throw reason;
      }
    },
    [source, writable],
  );
  const row = nodeId ? customizationRowAttributes(nodeId, customization) : {};
  return (
    <tr
      {...row}
      className={`schemaTableMismatch${row.className ? ` ${row.className}` : ''}`}
      data-test-id={`schema-raw-fallback-${label}`}
    >
      <td>
        <div className="schemaNodeLabel">
          <span>{label}</span>
          {nodeId ? <NodeMenuButton nodeId={nodeId} customization={customization} /> : null}
        </div>
        <div className="schemaTableError">{error.message}</div>
        {diagnostics?.map((diagnostic) => (
          <div
            key={`${diagnostic.code}:${diagnostic.message}`}
            className={`schemaTableDiagnostic ${diagnostic.severity}`}
          >
            {diagnostic.message}
          </div>
        ))}
      </td>
      <td>
        <div className="schemaTableValueCell">
          <div className="schemaTableValueControl">
            <JsonEditor value={rawValue} disabled={!writable} onCommit={commit} />
            {commitError ? <div className="schemaTableError">{commitError}</div> : null}
          </div>
          <span className="schemaTableRawLabel">Raw JSON</span>
        </div>
      </td>
    </tr>
  );
}

function RawCollectionFallback({
  source,
  rawValue,
  issues,
  label,
  disabled,
  diagnostics,
  nodeId,
  customization,
}: {
  source: ValueSource<unknown>;
  rawValue: unknown;
  issues: FieldShapeIssue[];
  label: string;
  disabled?: boolean;
  diagnostics?: Diagnostic[];
  nodeId?: string;
  customization?: SchemaTableCustomization;
}) {
  const writable = isWritableValueSource(source) && !disabled;
  const issueByKey = new Map(
    issues.filter((issue) => issue.path.length > 0).map((issue) => [String(issue.path[0]), issue]),
  );
  const entries = Array.isArray(rawValue)
    ? rawValue.map((value, index) => [String(index), value] as const)
    : Object.entries(rawValue as Record<string, unknown>);
  const update = async (key: string, value: unknown) => {
    if (!writable) return;
    const next = Array.isArray(rawValue) ? [...rawValue] : { ...(rawValue as Record<string, unknown>) };
    if (Array.isArray(next)) next[Number(key)] = value;
    else next[key] = value;
    await source.set(next);
  };
  const row = nodeId ? customizationRowAttributes(nodeId, customization) : {};
  return (
    <tr
      {...row}
      className={`schemaTableMismatch${row.className ? ` ${row.className}` : ''}`}
      data-test-id={`schema-raw-collection-fallback-${label}`}
    >
      <td>
        <div className="schemaNodeLabel">
          <span>{label}</span>
          {nodeId ? <NodeMenuButton nodeId={nodeId} customization={customization} /> : null}
        </div>
        <div className="schemaTableError">集合中有 {issues.length} 个值不符合静态 shape</div>
        {diagnostics?.map((diagnostic) => (
          <div
            key={`${diagnostic.code}:${diagnostic.message}`}
            className={`schemaTableDiagnostic ${diagnostic.severity}`}
          >
            {diagnostic.message}
          </div>
        ))}
      </td>
      <td>
        <div className="schemaRawCollectionFallback">
          {entries.map(([key, value]) => {
            const issue = issueByKey.get(key);
            return (
              <div key={key} className={issue ? 'invalid' : undefined}>
                <code>{key}</code>
                {issue ? (
                  <JsonEditor value={value} disabled={!writable} onCommit={(next) => update(key, next)} />
                ) : (
                  <span>{valueSummary(value)}</span>
                )}
                {issue ? (
                  <small>
                    {issue.message}
                    {issue.path.length > 1 ? ` · ${issue.path.slice(1).join('.')}` : ''}
                  </small>
                ) : null}
              </div>
            );
          })}
        </div>
      </td>
    </tr>
  );
}

interface FieldEditorProps {
  fieldSchemaId: string;
  schema: FieldSchema;
  value: unknown;
  disabled: boolean;
  scope: SchemaScope;
  onCommit(value: unknown): Promise<void>;
}

const ExternalFieldEditor: FC<FieldEditorProps> = ({ fieldSchemaId, schema, value, disabled, scope, onCommit }) => {
  const codeEditor = useCodeEditor();
  const eventEditor = useEventEditor();
  const selectPoint = useSelectPointModalAction();
  const descriptor = schema.editor;
  const open = () => {
    if (disabled) return;
    if (descriptor.kind === 'event') {
      const floorIdResult = descriptor.floorId ? evaluateExpression(descriptor.floorId, scope) : undefined;
      const positionResult = descriptor.position ? evaluateExpression(descriptor.position, scope) : undefined;
      const floorId =
        floorIdResult?.status === 'ready' && typeof floorIdResult.value === 'string' ? floorIdResult.value : undefined;
      const positionValue = positionResult?.status === 'ready' ? positionResult.value : undefined;
      const positionRecord =
        positionValue && typeof positionValue === 'object' && !Array.isArray(positionValue)
          ? (positionValue as Record<string, unknown>)
          : undefined;
      const position =
        positionRecord && Number.isFinite(positionRecord.x) && Number.isFinite(positionRecord.y)
          ? { x: Number(positionRecord.x), y: Number(positionRecord.y) }
          : undefined;
      eventEditor.open({
        contextId: `schema-table:${fieldSchemaId}`,
        entryType: descriptor.entryType,
        initialValue: value ?? [],
        floorId,
        position,
        onConfirm: onCommit,
      });
      return;
    }
    if (descriptor.kind === 'code') {
      codeEditor.open({
        contextId: `schema-table:${fieldSchemaId}`,
        initialValue: typeof value === 'string' ? value : (descriptor.template ?? ''),
        lint: descriptor.lint,
        onConfirm: onCommit,
      });
      return;
    }
    if (descriptor.kind === 'point') {
      const floorIdResult = descriptor.floorId ? evaluateExpression(descriptor.floorId, scope) : undefined;
      const floorId =
        floorIdResult?.status === 'ready' && typeof floorIdResult.value === 'string' ? floorIdResult.value : undefined;
      const point = Array.isArray(value) ? value : [];
      void selectPoint({
        floorId,
        floorSelection: floorId ? 'fixed' : 'selectable',
        x: Number(point[0]) || 0,
        y: Number(point[1]) || 0,
        bigmap: false,
      }).then((result) => (result ? onCommit([Number(result.x), Number(result.y)]) : undefined));
    }
  };
  return (
    <div className="schemaTableExternalValue">
      <span>{valueSummary(value)}</span>
      <button disabled={disabled} onClick={open}>
        编辑
      </button>
    </div>
  );
};

const MaterialFieldEditor: FC<FieldEditorProps> = ({ schema, value, disabled, scope, onCommit }) => {
  const selectMaterial = useSelectMaterialModalAction();
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const descriptor = schema.editor;
  const registrySource = useMemo(
    () => resolveReference(scope, descriptor.kind === 'material' ? descriptor.reference : { ref: 'project:invalid' }),
    [descriptor, scope],
  );
  const registry = useSourceSnapshot(registrySource);
  if (descriptor.kind !== 'material') return null;
  const blocked = disabled || registry.status !== 'ready';
  const usesImagePicker = descriptor.selection === 'single' && descriptor.directory.includes(':images');
  const open = () => {
    if (blocked) return;
    if (usesImagePicker) {
      setImagePickerOpen(true);
      return;
    }
    void selectMaterial({
      title: schema.title,
      value: Array.isArray(value) ? (value as string[]) : typeof value === 'string' ? value : undefined,
      directory: descriptor.directory,
      source: { kind: 'directory', path: descriptor.directory },
      multiple: descriptor.selection === 'multiple',
      transform: null,
    }).then((result) => {
      if (!result) return undefined;
      return descriptor.selection === 'single' ? onCommit(result[0] ?? null) : onCommit(result);
    });
  };
  return (
    <>
      <div data-source-status={registry.status}>
        <div className="schemaTableExternalValue">
          <span>{valueSummary(value)}</span>
          <button disabled={blocked} onClick={open}>
            编辑
          </button>
        </div>
        {registry.status === 'loading' ? <div className="schemaTableSkeleton" aria-label="loading" /> : null}
        {registry.status === 'error' || registry.status === 'type-mismatch' ? (
          <div className="schemaTableError">{registry.error.message}</div>
        ) : null}
      </div>
      {imagePickerOpen ? (
        <Suspense
          fallback={
            <Modal title={schema.title} open footer={null} onCancel={() => setImagePickerOpen(false)} destroyOnHidden>
              <div className="floorImageAssetLoading">正在读取图片资源...</div>
            </Modal>
          }
        >
          <ImageAssetPickerModal
            title={schema.title}
            initial={typeof value === 'string' ? { name: value } : undefined}
            includeLogical
            accept={(entry) => /\.png$/i.test(entry.name)}
            onClose={() => setImagePickerOpen(false)}
            onConfirm={(selection) => {
              void onCommit(selection.name).then(
                () => setImagePickerOpen(false),
                () => undefined,
              );
            }}
          />
        </Suspense>
      ) : null}
    </>
  );
};

function referencedChoiceOptions(value: unknown): Array<{ value: string | number; label?: string }> {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (typeof item === 'string' || typeof item === 'number') {
        return [{ value: item, label: String(item) }];
      }
      if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
      const record = item as Record<string, unknown>;
      const optionValue = record.value ?? record.id;
      if (typeof optionValue !== 'string' && typeof optionValue !== 'number') return [];
      return [
        {
          value: optionValue,
          label:
            typeof record.label === 'string'
              ? record.label
              : typeof record.name === 'string'
                ? record.name
                : String(optionValue),
        },
      ];
    });
  }
  if (!value || typeof value !== 'object') return [];
  const entries = (value as { entries?: unknown }).entries;
  return Array.isArray(entries) ? referencedChoiceOptions(entries) : [];
}

type SelectEditorDescriptor = Extract<FieldSchema['editor'], { kind: 'select' }>;
type SourceStatus = BlockResolution<RawSlot<unknown>>['status'];

const SelectControl: FC<{
  descriptor: SelectEditorDescriptor;
  nullable: boolean;
  value: unknown;
  disabled?: boolean;
  options: Array<{ value: string | number | boolean | null; label?: string }>;
  status?: SourceStatus;
  error?: Error;
  onCommit(value: unknown): Promise<void>;
}> = ({ descriptor, nullable, value, disabled, options, status = 'ready', error, onCommit }) => {
  const dynamic = descriptor.reference != null;
  const encoded = JSON.stringify(value);
  return (
    <div data-source-status={dynamic ? status : 'ready'}>
      <select
        className="schemaTableSelect"
        disabled={disabled || (dynamic && status !== 'ready')}
        value={encoded}
        onChange={(event) => void onCommit(JSON.parse(event.target.value))}
      >
        {nullable ? <option value={JSON.stringify(null)}>未设定</option> : null}
        {options.map((option) => {
          const optionValue = JSON.stringify(option.value);
          return (
            <option key={optionValue} value={optionValue}>
              {option.label ?? String(option.value)}
            </option>
          );
        })}
      </select>
      {dynamic && status === 'loading' ? <div className="schemaTableSkeleton" aria-label="loading" /> : null}
      {dynamic && (status === 'error' || status === 'type-mismatch') && error ? (
        <div className="schemaTableError">{error.message}</div>
      ) : null}
    </div>
  );
};

const ReferencedSelectFieldEditor: FC<FieldEditorProps & { descriptor: SelectEditorDescriptor }> = ({
  schema,
  descriptor,
  value,
  disabled,
  scope,
  onCommit,
}) => {
  const optionSource = useMemo(() => resolveReference(scope, descriptor.reference!), [descriptor.reference, scope]);
  const referenced = useSourceSnapshot(optionSource);
  const options =
    referenced.status === 'ready' && referenced.value.present ? referencedChoiceOptions(referenced.value.value) : [];
  return (
    <SelectControl
      descriptor={descriptor}
      nullable={(Array.isArray(schema.type) ? schema.type : [schema.type]).includes('null')}
      disabled={disabled}
      error={referenced.status === 'error' || referenced.status === 'type-mismatch' ? referenced.error : undefined}
      onCommit={onCommit}
      options={options}
      status={referenced.status}
      value={value}
    />
  );
};

const SelectFieldEditor: FC<FieldEditorProps> = (props) => {
  const descriptor = props.schema.editor;
  if (descriptor.kind !== 'select') return null;
  if (descriptor.reference) return <ReferencedSelectFieldEditor {...props} descriptor={descriptor} />;
  const nullable = (Array.isArray(props.schema.type) ? props.schema.type : [props.schema.type]).includes('null');
  return <SelectControl {...props} descriptor={descriptor} nullable={nullable} options={descriptor.options ?? []} />;
};

const StringListFieldEditor: FC<FieldEditorProps> = ({ schema, value, disabled, onCommit }) => {
  const descriptor = schema.editor;
  if (descriptor.kind !== 'stringList') return null;
  const values = Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  return (
    <Select
      className="schemaStringListEditor"
      mode="tags"
      disabled={disabled}
      value={values}
      placeholder={descriptor.placeholder}
      tokenSeparators={[',', '，']}
      onChange={(next) => void onCommit(next)}
      options={values.map((item) => ({ value: item, label: item }))}
    />
  );
};

const OrderedStringListFieldEditor: FC<FieldEditorProps> = ({ schema, value, disabled, onCommit }) => {
  const descriptor = schema.editor;
  if (descriptor.kind !== 'orderedStringList') return null;
  const values = Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  const move = (index: number, nextIndex: number) => {
    const next = [...values];
    const [item] = next.splice(index, 1);
    next.splice(nextIndex, 0, item);
    void onCommit(next);
  };
  return (
    <CollectionControl
      items={values}
      disabled={disabled}
      createLabel={descriptor.createLabel ?? '添加一项'}
      emptyText="暂无项目"
      reorderMode="drag"
      renderItem={(item, index) => (
        <TextEditor
          value={item}
          disabled={disabled}
          onCommit={(nextValue) => {
            const next = [...values];
            next[index] = String(nextValue ?? '');
            return onCommit(next);
          }}
        />
      )}
      onCreate={() => void onCommit([...values, ''])}
      onMove={move}
      onRemove={(index) => void onCommit(values.filter((_item, itemIndex) => itemIndex !== index))}
    />
  );
};

interface ItemOption {
  id: string;
  label: string;
  equipType?: number;
  cls?: string;
  equipment: boolean;
}

function itemOptions(value: unknown): ItemOption[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.entries(value).flatMap(([id, raw]) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
    const item = raw as Record<string, unknown>;
    const equip =
      item.equip && typeof item.equip === 'object' && !Array.isArray(item.equip)
        ? (item.equip as Record<string, unknown>)
        : undefined;
    const name = typeof item.name === 'string' && item.name ? item.name : id;
    return [
      {
        id,
        label: `${name} (${id})`,
        cls: typeof item.cls === 'string' ? item.cls : undefined,
        equipType: typeof equip?.type === 'number' ? equip.type : undefined,
        equipment: Boolean(equip),
      },
    ];
  });
}

const EquipmentSlotsFieldEditor: FC<FieldEditorProps> = ({ schema, value, disabled, scope, onCommit }) => {
  const descriptor = schema.editor;
  const slotsSource = useMemo(
    () => resolveReference(scope, descriptor.kind === 'equipmentSlots' ? descriptor.slots : { ref: 'project:invalid' }),
    [descriptor, scope],
  );
  const itemsSource = useMemo(
    () => resolveReference(scope, descriptor.kind === 'equipmentSlots' ? descriptor.items : { ref: 'project:invalid' }),
    [descriptor, scope],
  );
  const slotsSnapshot = useSourceSnapshot(slotsSource);
  const itemsSnapshot = useSourceSnapshot(itemsSource);
  if (descriptor.kind !== 'equipmentSlots') return null;
  const slots =
    slotsSnapshot.status === 'ready' && slotsSnapshot.value.present && Array.isArray(slotsSnapshot.value.value)
      ? slotsSnapshot.value.value.filter((item): item is string => typeof item === 'string')
      : [];
  const options =
    itemsSnapshot.status === 'ready' && itemsSnapshot.value.present ? itemOptions(itemsSnapshot.value.value) : [];
  const values = Array.isArray(value) ? [...value] : [];
  const blocked = disabled || slotsSnapshot.status !== 'ready' || itemsSnapshot.status !== 'ready';
  return (
    <div className="schemaEquipmentSlots">
      {slots.length === 0 ? (
        <span className="schemaTableMuted">请先定义装备孔</span>
      ) : (
        slots.map((slot, index) => {
          const current = typeof values[index] === 'string' ? (values[index] as string) : undefined;
          const candidates = options.filter((item) => item.equipType === index);
          const selectOptions = [
            ...candidates.map((item) => ({ value: item.id, label: item.label })),
            ...(current && !candidates.some((item) => item.id === current)
              ? [{ value: current, label: `未知或类型不符：${current}` }]
              : []),
          ];
          return (
            <label key={`${slot}:${index}`}>
              <span>{slot}</span>
              <Select
                allowClear
                disabled={blocked}
                placeholder="未装备"
                value={current}
                options={selectOptions}
                onChange={(nextValue) => {
                  const next = Array.from({ length: slots.length }, (_item, itemIndex) =>
                    typeof values[itemIndex] === 'string' ? values[itemIndex] : null,
                  );
                  next[index] = nextValue ?? null;
                  while (next.at(-1) == null) next.pop();
                  void onCommit(next);
                }}
              />
            </label>
          );
        })
      )}
      {slotsSnapshot.status === 'loading' || itemsSnapshot.status === 'loading' ? (
        <div className="schemaTableSkeleton" aria-label="loading" />
      ) : null}
    </div>
  );
};

const ItemCountRecordFieldEditor: FC<FieldEditorProps> = ({ schema, value, disabled, scope, onCommit }) => {
  const descriptor = schema.editor;
  const source = useMemo(
    () =>
      resolveReference(scope, descriptor.kind === 'itemCountRecord' ? descriptor.items : { ref: 'project:invalid' }),
    [descriptor, scope],
  );
  const snapshot = useSourceSnapshot(source);
  if (descriptor.kind !== 'itemCountRecord') return null;
  const record = editingRecord(value);
  const allOptions = snapshot.status === 'ready' && snapshot.value.present ? itemOptions(snapshot.value.value) : [];
  const candidates = allOptions.filter((item) =>
    descriptor.category === 'equips' ? item.equipment || item.cls === 'equips' : item.cls === descriptor.category,
  );
  const rows = Object.entries(record).filter(([, count]) => typeof count === 'number');
  const blocked = disabled || snapshot.status !== 'ready';
  const commit = (next: Record<string, unknown>) => void onCommit(next);
  return (
    <div className="schemaItemCountRecord" data-source-status={snapshot.status}>
      {rows.length === 0 ? <span className="schemaTableMuted">暂无道具</span> : null}
      {rows.map(([id, count]) => {
        const options = [
          ...candidates.map((item) => ({ value: item.id, label: item.label })),
          ...(!candidates.some((item) => item.id === id) ? [{ value: id, label: `未知或分类不符：${id}` }] : []),
        ];
        return (
          <div className="schemaItemCountRow" key={id}>
            <Select
              showSearch
              disabled={blocked}
              value={id}
              options={options}
              optionFilterProp="label"
              onChange={(nextId) => {
                if (nextId === id || Object.prototype.hasOwnProperty.call(record, nextId)) return;
                const next = { ...record, [nextId]: count };
                delete next[id];
                commit(next);
              }}
            />
            <InputNumber
              min={0}
              precision={0}
              disabled={blocked}
              value={count as number}
              onChange={(nextCount) => commit({ ...record, [id]: nextCount ?? 0 })}
            />
            <button
              type="button"
              className="schemaTableIconButton danger"
              aria-label={`删除 ${id}`}
              disabled={blocked}
              onClick={() => {
                const next = { ...record };
                delete next[id];
                commit(next);
              }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        );
      })}
      <button
        type="button"
        className="schemaCollectionCreate"
        disabled={blocked || candidates.every((item) => Object.prototype.hasOwnProperty.call(record, item.id))}
        onClick={() => {
          const candidate = candidates.find((item) => !Object.prototype.hasOwnProperty.call(record, item.id));
          if (candidate) commit({ ...record, [candidate.id]: 1 });
        }}
      >
        <Plus size={14} />
        添加道具
      </button>
      {snapshot.status === 'loading' ? <div className="schemaTableSkeleton" aria-label="loading" /> : null}
      {snapshot.status === 'error' || snapshot.status === 'type-mismatch' ? (
        <div className="schemaTableError">{snapshot.error.message}</div>
      ) : null}
    </div>
  );
};

function checkboxSetOptions(value: unknown): Array<{ value: string | number; label?: string }> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const entries = (value as { entries?: unknown }).entries;
  if (!Array.isArray(entries)) return [];
  return entries.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const item = entry as { id?: unknown; name?: unknown };
    if (typeof item.id !== 'string' && typeof item.id !== 'number') return [];
    return [{ value: item.id, label: typeof item.name === 'string' ? item.name : String(item.id) }];
  });
}

const CheckboxSetFieldEditor: FC<FieldEditorProps> = ({ fieldSchemaId, schema, value, disabled, scope, onCommit }) => {
  const descriptor = schema.editor;
  if (descriptor.kind !== 'checkboxSet') return null;
  if (descriptor.reference) {
    return (
      <ReferencedCheckboxSetFieldEditor
        fieldSchemaId={fieldSchemaId}
        schema={schema}
        value={value}
        disabled={disabled}
        scope={scope}
        onCommit={onCommit}
      />
    );
  }
  const selected = Array.isArray(value) ? value : [];
  const options = [
    ...(descriptor.options ?? []),
    ...selected
      .filter(
        (item): item is string | number =>
          (typeof item === 'string' || typeof item === 'number') &&
          !(descriptor.options ?? []).some((option) => Object.is(option.value, item)),
      )
      .map((item) => ({ value: item, label: `未知：${String(item)}` })),
  ];
  return (
    <div className="schemaTableCheckboxSet">
      {options.map((option) => {
        const checked = selected.some((item) => Object.is(item, option.value));
        return (
          <label key={JSON.stringify(option.value)}>
            <input
              type="checkbox"
              disabled={disabled}
              checked={checked}
              onChange={(event) => {
                const next = event.target.checked
                  ? [...selected, option.value]
                  : selected.filter((item) => !Object.is(item, option.value));
                void onCommit(next);
              }}
            />
            <span>{option.label ?? String(option.value)}</span>
          </label>
        );
      })}
    </div>
  );
};

const ReferencedCheckboxSetFieldEditor: FC<FieldEditorProps> = ({ schema, value, disabled, scope, onCommit }) => {
  const openCheckboxSet = useCheckboxSetModalAction();
  const descriptor = schema.editor;
  const registrySource = useMemo(
    () =>
      resolveReference(
        scope,
        descriptor.kind === 'checkboxSet' && descriptor.reference ? descriptor.reference : { ref: 'project:invalid' },
      ),
    [descriptor, scope],
  );
  const registry = useSourceSnapshot(registrySource);
  if (descriptor.kind !== 'checkboxSet' || !descriptor.reference) return null;
  const selected = Array.isArray(value)
    ? value.filter((item): item is string | number => typeof item === 'string' || typeof item === 'number')
    : [];
  const options = registry.status === 'ready' && registry.value.present ? checkboxSetOptions(registry.value.value) : [];
  const labels = selected.map((item) => options.find((option) => Object.is(option.value, item))?.label ?? String(item));
  const blocked = disabled || registry.status !== 'ready';
  const open = () => {
    if (blocked) return;
    void openCheckboxSet({
      title: schema.title,
      value: selected,
      comments: {
        key: options.map((option) => option.value),
        prefix: options.map((option) => `${option.label ?? String(option.value)} (${String(option.value)})`),
      },
    }).then((result) => (result ? onCommit(result) : undefined));
  };
  return (
    <div data-source-status={registry.status}>
      <div className="schemaTableExternalValue">
        <span>{labels.length > 0 ? labels.join('、') : '无'}</span>
        <button data-test-id="schema-checkbox-set-open" disabled={blocked} onClick={open}>
          选择
        </button>
      </div>
      {registry.status === 'loading' ? <div className="schemaTableSkeleton" aria-label="loading" /> : null}
      {registry.status === 'error' || registry.status === 'type-mismatch' ? (
        <div className="schemaTableError">{registry.error.message}</div>
      ) : null}
    </div>
  );
};

function editingRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

const CombineFieldEditor: FC<FieldEditorProps> = ({ schema, value, disabled, onCommit }) => {
  const descriptor = schema.editor;
  const initial = editingRecord(value);
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string>();
  const draftRef = useRef(initial);
  const committedRef = useRef(JSON.stringify(initial));
  if (descriptor.kind !== 'combine') return null;

  const update = (key: string, nextValue: unknown): Record<string, unknown> => {
    const next = { ...draftRef.current, [key]: nextValue };
    draftRef.current = next;
    setDraft(next);
    return next;
  };
  const commit = async (next = draftRef.current): Promise<void> => {
    const signature = JSON.stringify(next);
    if (signature === committedRef.current) return;
    try {
      await onCommit(next);
      committedRef.current = signature;
      setError(undefined);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  return (
    <div className="schemaCombineEditor">
      {descriptor.inputs.map((input) => {
        const label = input.label ?? input.key;
        if (input.editor.kind === 'suggestion') {
          const current = typeof draft[input.key] === 'string' ? (draft[input.key] as string) : '';
          return (
            <AutoComplete
              key={input.key}
              className="schemaCombineInput suggestion"
              aria-label={label}
              title={label}
              disabled={disabled}
              value={current}
              placeholder={label}
              options={input.editor.suggestions.map((option) => ({
                value: option.value,
                label: option.label ?? option.value,
              }))}
              filterOption={(query, option) =>
                String(option?.value ?? '')
                  .toLowerCase()
                  .includes(query.toLowerCase())
              }
              onChange={(next) => update(input.key, next)}
              onSelect={(next) => void commit(update(input.key, next))}
              onBlur={() => void commit()}
            />
          );
        }
        const current = typeof draft[input.key] === 'number' ? (draft[input.key] as number) : null;
        return (
          <InputNumber
            key={input.key}
            className="schemaCombineInput number"
            aria-label={label}
            title={label}
            disabled={disabled}
            value={current}
            placeholder={label}
            min={input.editor.min}
            max={input.editor.max}
            step={input.editor.step}
            precision={input.editor.integer ? 0 : undefined}
            onChange={(next) => update(input.key, next)}
            onBlur={() => void commit()}
            onPressEnter={() => void commit()}
          />
        );
      })}
      {error ? <div className="schemaTableError">{error}</div> : null}
    </div>
  );
};

const DEFAULT_DIRECTIONS = [
  { value: 'up', label: '上' },
  { value: 'down', label: '下' },
  { value: 'left', label: '左' },
  { value: 'right', label: '右' },
];

const InitialPositionFieldEditor: FC<FieldEditorProps> = ({ schema, value, disabled, scope, onCommit }) => {
  const selectPoint = useSelectPointModalAction();
  const descriptor = schema.editor;
  const floorSource = useMemo(
    () =>
      resolveReference(scope, descriptor.kind === 'initialPosition' ? descriptor.floors : { ref: 'project:invalid' }),
    [descriptor, scope],
  );
  const floors = useSourceSnapshot(floorSource);
  if (descriptor.kind !== 'initialPosition') return null;
  const record = editingRecord(value);
  const blocked = disabled || floors.status !== 'ready';
  const commitKey = (key: string, next: unknown) => void onCommit({ ...record, [key]: next });
  return (
    <div className="schemaInitialPosition" data-source-status={floors.status}>
      <button
        type="button"
        className="schemaInitialPointButton"
        disabled={blocked}
        onClick={() => {
          void selectPoint({
            floorId: typeof record.floorId === 'string' ? record.floorId : undefined,
            floorSelection: 'selectable',
            x: typeof record.x === 'number' ? record.x : 0,
            y: typeof record.y === 'number' ? record.y : 0,
            multiple: false,
          }).then((result) =>
            result
              ? onCommit({
                  ...record,
                  floorId: result.floorId,
                  x: Number(result.x),
                  y: Number(result.y),
                })
              : undefined,
          );
        }}
      >
        {String(record.floorId ?? '未设楼层')} · ({String(record.x ?? 0)}, {String(record.y ?? 0)})<span>选点</span>
      </button>
      <select
        aria-label="初始朝向"
        className="schemaTableSelect direction"
        disabled={disabled}
        value={JSON.stringify(record.direction ?? 'down')}
        onChange={(event) => commitKey('direction', JSON.parse(event.target.value))}
      >
        {(descriptor.directions ?? DEFAULT_DIRECTIONS).map((option) => (
          <option key={JSON.stringify(option.value)} value={JSON.stringify(option.value)}>
            {option.label ?? String(option.value)}
          </option>
        ))}
      </select>
      {floors.status === 'loading' ? <div className="schemaTableSkeleton" aria-label="loading" /> : null}
      {floors.status === 'error' || floors.status === 'type-mismatch' ? (
        <div className="schemaTableError">{floors.error.message}</div>
      ) : null}
    </div>
  );
};

const FieldEditor: FC<FieldEditorProps> = (props) => {
  const { schema, value, disabled, onCommit } = props;
  const descriptor = schema.editor;
  if (descriptor.kind === 'readonly') {
    return <span className="schemaTableReadonly">{valueSummary(value)}</span>;
  }
  if (descriptor.kind === 'text') return <TextEditor value={value} disabled={disabled} onCommit={onCommit} />;
  if (descriptor.kind === 'number') {
    return (
      <TextEditor
        value={value}
        disabled={disabled}
        numericType={schema.type === 'integer' ? 'integer' : 'number'}
        onCommit={onCommit}
      />
    );
  }
  if (descriptor.kind === 'checkbox') {
    return (
      <input
        type="checkbox"
        disabled={disabled}
        checked={Boolean(value)}
        onChange={(event) => void onCommit(event.target.checked)}
      />
    );
  }
  if (descriptor.kind === 'select') return <SelectFieldEditor {...props} />;
  if (descriptor.kind === 'stringList') return <StringListFieldEditor {...props} />;
  if (descriptor.kind === 'orderedStringList') return <OrderedStringListFieldEditor {...props} />;
  if (descriptor.kind === 'checkboxSet') return <CheckboxSetFieldEditor {...props} />;
  if (descriptor.kind === 'passability') {
    const block = descriptor.block ? evaluateExpression(descriptor.block, props.scope) : undefined;
    const blockValue =
      block?.status === 'ready' && (typeof block.value === 'number' || typeof block.value === 'string')
        ? block.value
        : undefined;
    return <PassabilityFieldEditor value={value} block={blockValue} disabled={disabled} onCommit={onCommit} />;
  }
  if (descriptor.kind === 'dimensions') {
    const record =
      value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
    const width = typeof record.width === 'number' ? record.width : '?';
    const height = typeof record.height === 'number' ? record.height : '?';
    return (
      <span className="schemaTableDimensions">
        {width} × {height}
      </span>
    );
  }
  if (descriptor.kind === 'initialPosition') return <InitialPositionFieldEditor {...props} />;
  if (descriptor.kind === 'equipmentSlots') return <EquipmentSlotsFieldEditor {...props} />;
  if (descriptor.kind === 'itemCountRecord') return <ItemCountRecordFieldEditor {...props} />;
  if (descriptor.kind === 'json') return <JsonEditor value={value} disabled={disabled} onCommit={onCommit} />;
  if (descriptor.kind === 'color') {
    return <ColorInput value={value} disabled={disabled} onChange={(next) => void onCommit(next)} />;
  }
  if (descriptor.kind === 'block') {
    return <BlockPickerField value={value} disabled={disabled} onCommit={onCommit} />;
  }
  if (descriptor.kind === 'combine') return <CombineFieldEditor {...props} />;
  if (descriptor.kind === 'bgmList') return <BgmListFieldEditor {...props} />;
  if (descriptor.kind === 'autoEventList') return <AutoEventListFieldEditor {...props} />;
  if (descriptor.kind === 'floorImages') return <FloorImagesFieldEditor {...props} />;
  if (descriptor.kind === 'material') return <MaterialFieldEditor {...props} />;
  return <ExternalFieldEditor {...props} />;
};

interface ReadyFieldRowProps {
  node: FieldNode;
  runtime: RuntimeProps;
  schema: FieldSchema;
  source: ValueSource<unknown>;
  slot: RawSlot<unknown>;
  editingValue: unknown;
  normalizer: Normalizer<unknown, unknown>;
  presentation: ConditionPresentation;
}

const ReadyFieldRow: FC<ReadyFieldRowProps> = ({
  node,
  runtime,
  schema,
  source,
  slot,
  editingValue,
  normalizer,
  presentation,
}) => {
  const writable = isWritableValueSource(source);
  const [saving, setSaving] = useState(false);
  const [commitError, setCommitError] = useState<string>();
  const commit = useCallback(
    async (value: unknown) => {
      if (!writable || saving) return;
      setSaving(true);
      try {
        const raw = normalizer.toRaw(value, slot);
        if (raw.present) await source.set(raw.value);
        else await source.unset();
        setCommitError(undefined);
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : String(reason);
        setCommitError(message);
        notifyError(message);
        throw reason;
      } finally {
        setSaving(false);
      }
    },
    [normalizer, saving, slot, source, writable],
  );
  const schemaTypes = schema.type == null ? [] : Array.isArray(schema.type) ? schema.type : [schema.type];
  const clearable = schemaTypes.includes('null');
  const canClear = clearable && slot.present && slot.value != null;
  const copyable = copyableEditorKinds.has(schema.editor.kind);
  const references = fieldNodeReferences(node);
  const resolvedReferences = references.map((reference) => resolveBoundReference(reference, runtime.bindings));
  const referenceIds = new Set(resolvedReferences.map(formatReferencedPath));
  const diagnostics = runtime.diagnostics?.filter((item) => referenceIds.has(item.source)) ?? [];
  const disabled = !writable || saving || runtime.inheritedDisabled || presentation === 'disabled';
  const inactive = !runtime.inheritedInactive && presentation === 'inactive';
  const parsedReferences = resolvedReferences;
  const dataField = parsedReferences.map((reference) => reference.path.join('-')).join('-');
  const sourceKey = parsedReferences
    .map((reference, index) => reference.path.at(-1) ?? references[index].ref)
    .join(' + ');
  const fieldAction =
    (node.source && resolvedReferences[0]
      ? runtime.fieldActions?.get(formatReferencedPath(resolvedReferences[0]))
      : undefined) ?? runtime.fieldActions?.get(node.fieldSchema);
  const hasActions = canClear || copyable || fieldAction != null;
  const row = customizationRowAttributes(node.id, runtime.customization);
  return (
    <tr
      {...row}
      className={`${inactive ? 'schemaTableInactive' : ''}${row.className ? ` ${row.className}` : ''}` || undefined}
      data-test-id={`schema-field-${dataField}`}
    >
      <td>
        <div className="schemaNodeLabel">
          <FieldLabel schema={schema} sourceKey={sourceKey} />
          <NodeMenuButton nodeId={node.id} customization={runtime.customization} />
        </div>
        {diagnostics.map((diagnostic) => (
          <div
            key={`${diagnostic.code}:${diagnostic.message}`}
            className={`schemaTableDiagnostic ${diagnostic.severity}`}
          >
            {diagnostic.message}
          </div>
        ))}
      </td>
      <td data-test-id={`schema-input-${dataField}`}>
        <div className="schemaTableValueCell">
          <div className="schemaTableValueControl">
            <FieldEditor
              fieldSchemaId={node.fieldSchema}
              schema={schema}
              value={editingValue}
              disabled={disabled}
              scope={runtime.scope}
              onCommit={commit}
            />
          </div>
          {hasActions ? (
            <div className="schemaTableActions">
              {canClear ? (
                <button disabled={disabled} onClick={() => void commit(null)}>
                  清空
                </button>
              ) : null}
              {copyable ? (
                <button
                  type="button"
                  className="schemaTableIconButton"
                  aria-label={`复制${schema.title}`}
                  title="复制 JSON 值"
                  disabled={editingValue === undefined}
                  onClick={() => {
                    void navigator.clipboard.writeText(JSON.stringify(editingValue) ?? '').then(
                      () => notifySuccess('复制成功！'),
                      (reason) => notifyError(reason instanceof Error ? reason.message : '复制失败'),
                    );
                  }}
                >
                  <Copy size={15} strokeWidth={1.8} aria-hidden="true" />
                </button>
              ) : null}
              {fieldAction}
            </div>
          ) : null}
        </div>
        {commitError ? <div className="schemaTableError">{commitError}</div> : null}
      </td>
    </tr>
  );
};

function FieldRow({ node, runtime }: { node: FieldNode; runtime: RuntimeProps }) {
  const schema = runtime.fieldSchemas.get(node.fieldSchema);
  const source = useMemo(
    () =>
      node.source
        ? resolveReference(runtime.scope, node.source)
        : resolveCombinedReferences(runtime.scope, node.sources ?? {}),
    [node.source, node.sources, runtime.scope],
  );
  const snapshot = useSourceSnapshot(source);
  const presentation = useConditionPresentation(
    node.condition,
    runtime.scope,
    snapshot.status === 'ready' ? snapshot.value : undefined,
  );
  const referenceIds = new Set(
    fieldNodeReferences(node).map((reference) =>
      formatReferencedPath(resolveBoundReference(reference, runtime.bindings)),
    ),
  );
  const diagnostics = runtime.diagnostics?.filter((item) => referenceIds.has(item.source)) ?? [];
  if (!schema) {
    return (
      <BlockRow
        nodeId={node.id}
        customization={runtime.customization}
        label={node.fieldSchema}
        resolution={{ status: 'error', error: new Error(`Missing schema ${node.fieldSchema}`) }}
      />
    );
  }
  if (snapshot.status === 'loading' || snapshot.status === 'error') {
    return (
      <BlockRow nodeId={node.id} customization={runtime.customization} label={schema.title} resolution={snapshot} />
    );
  }
  if (snapshot.status === 'type-mismatch') {
    return (
      <RawFallback
        source={source}
        label={schema.title}
        rawValue={snapshot.rawValue}
        error={snapshot.error}
        disabled={runtime.inheritedDisabled}
        diagnostics={diagnostics}
        nodeId={node.id}
        customization={runtime.customization}
      />
    );
  }
  if (presentation.status !== 'ready') {
    if (presentation.status === 'type-mismatch') {
      return (
        <RawFallback
          source={source}
          label={schema.title}
          rawValue={presentation.rawValue}
          error={presentation.error}
          disabled
          diagnostics={diagnostics}
          nodeId={node.id}
          customization={runtime.customization}
        />
      );
    }
    return (
      <BlockRow nodeId={node.id} customization={runtime.customization} label={schema.title} resolution={presentation} />
    );
  }
  if (presentation.value === 'hidden') {
    return runtime.customization ? (
      <HiddenFieldRow node={node} label={schema.title} customization={runtime.customization} />
    ) : null;
  }
  const issues = fieldShapeIssues(schema, snapshot.value);
  if (issues.length > 0) {
    const issue = issues[0];
    const issuePath = issue?.path.length ? ` at ${issue.path.map(String).join('.')}` : '';
    const rawValue = snapshot.value.present ? snapshot.value.value : undefined;
    const supportsItemRepair =
      issues.every((item) => item.path.length > 0) &&
      (Array.isArray(rawValue) || (rawValue != null && typeof rawValue === 'object'));
    if (supportsItemRepair) {
      return (
        <RawCollectionFallback
          source={source}
          label={schema.title}
          rawValue={rawValue}
          issues={issues}
          disabled={runtime.inheritedDisabled || presentation.value === 'disabled'}
          diagnostics={diagnostics}
          nodeId={node.id}
          customization={runtime.customization}
        />
      );
    }
    return (
      <RawFallback
        source={source}
        label={schema.title}
        rawValue={snapshot.value.present ? snapshot.value.value : undefined}
        error={new Error(issue ? `${issue.message}${issuePath}` : `Expected ${fieldExpectedDescription(schema)}`)}
        disabled={runtime.inheritedDisabled || presentation.value === 'disabled'}
        diagnostics={diagnostics}
        nodeId={node.id}
        customization={runtime.customization}
      />
    );
  }
  const normalizerName = schema.normalizer ?? 'identity';
  const normalizer = runtime.normalizers?.[normalizerName] ?? builtinNormalizers[normalizerName];
  if (!normalizer) {
    return (
      <BlockRow
        nodeId={node.id}
        customization={runtime.customization}
        label={schema.title}
        resolution={{ status: 'error', error: new Error(`Unknown normalizer ${normalizerName}`) }}
      />
    );
  }
  let editingValue: unknown;
  try {
    editingValue = normalizer.toEdit(snapshot.value);
  } catch (reason) {
    return (
      <RawFallback
        source={source}
        label={schema.title}
        rawValue={snapshot.value.present ? snapshot.value.value : undefined}
        error={reason instanceof Error ? reason : new Error(String(reason))}
        disabled={runtime.inheritedDisabled || presentation.value === 'disabled'}
        diagnostics={diagnostics}
        nodeId={node.id}
        customization={runtime.customization}
      />
    );
  }
  return (
    <ReadyFieldRow
      node={node}
      runtime={runtime}
      schema={schema}
      source={source}
      slot={snapshot.value}
      editingValue={editingValue}
      normalizer={normalizer}
      presentation={presentation.value}
    />
  );
}

function RestAdd({
  baseRef,
  path,
  runtime,
  disabled,
}: {
  baseRef: DataReference;
  path: string[];
  runtime: RuntimeProps;
  disabled?: boolean;
}) {
  const [key, setKey] = useState('');
  const [value, setValue] = useState('null');
  const [error, setError] = useState<string>();
  const add = async () => {
    const name = key.trim();
    if (disabled) return;
    if (!name || name.includes('/') || name.includes("'")) {
      setError('字段名不能为空且不能包含 / 或单引号');
      return;
    }
    const source = resolveReferencePath(runtime.scope, appendReferencePath(baseRef, [...path, name]));
    if (!isWritableValueSource(source)) {
      setError('当前对象只读');
      return;
    }
    const current = source.snapshot();
    if (current.status === 'ready' && current.value.present) {
      setError('字段已经存在');
      return;
    }
    try {
      await source.set(JSON.parse(value));
      setKey('');
      setValue('null');
      setError(undefined);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };
  return (
    <div className="schemaTableRestAdd">
      <input
        disabled={disabled}
        aria-label="字段名"
        placeholder="字段名"
        value={key}
        onChange={(event) => setKey(event.target.value)}
      />
      <input
        disabled={disabled}
        aria-label="JSON 值"
        placeholder="JSON 值"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <button disabled={disabled} onClick={() => void add()}>
        新增
      </button>
      {error ? <div className="schemaTableError">{error}</div> : null}
    </div>
  );
}

function RestRows({
  entries,
  baseRef,
  runtime,
  disabled,
}: {
  entries: RestEntry[];
  baseRef: DataReference;
  runtime: RuntimeProps;
  disabled?: boolean;
}): ReactNode {
  return entries.map((entry) => {
    const source = resolveReferencePath(runtime.scope, appendReferencePath(baseRef, entry.path));
    const writable = isWritableValueSource(source) && !disabled;
    const remove = async () => {
      if (!writable) return;
      try {
        await source.unset();
      } catch (reason) {
        notifyError(reason);
      }
    };
    if (entry.children) {
      return (
        <Fragment key={entry.path.join('.')}>
          <tr className="schemaTableRestObject">
            <td>{entry.path.join('.')}</td>
            <td>
              <div className="schemaTableActions schemaTableRestActions">
                <button disabled={!writable} onClick={() => void remove()}>
                  删除
                </button>
              </div>
            </td>
          </tr>
          {RestRows({ entries: entry.children, baseRef, runtime, disabled })}
          <tr>
            <td colSpan={2}>
              <RestAdd baseRef={baseRef} path={entry.path} runtime={runtime} disabled={disabled} />
            </td>
          </tr>
        </Fragment>
      );
    }
    return (
      <tr key={entry.path.join('.')} data-test-id={`schema-rest-${entry.path.join('-')}`}>
        <td>{entry.path.join('.')}</td>
        <td>
          <div className="schemaTableValueCell">
            <div className="schemaTableValueControl">
              <JsonEditor
                value={entry.value}
                disabled={!writable}
                onCommit={(next) => (writable ? source.set(next) : undefined)}
              />
            </div>
            <div className="schemaTableActions">
              <button disabled={!writable} onClick={() => void remove()}>
                删除
              </button>
            </div>
          </div>
        </td>
      </tr>
    );
  });
}

function RestSection({ node, runtime }: { node: RestNode; runtime: RuntimeProps }) {
  const source = useMemo(() => resolveReference(runtime.scope, node.path), [node.path, runtime.scope]);
  const snapshot = useSourceSnapshot(source);
  const presentation = useConditionPresentation(
    node.condition,
    runtime.scope,
    snapshot.status === 'ready' ? snapshot.value : undefined,
  );
  if (presentation?.status === 'ready' && presentation.value === 'hidden' && !runtime.customization) return null;
  if (snapshot.status !== 'ready') {
    const resolution =
      snapshot.status === 'type-mismatch' ? { status: 'error' as const, error: snapshot.error } : snapshot;
    return (
      <section className="schemaTableGroup">
        <table>
          <tbody>
            <BlockRow label={node.label} resolution={resolution} />
          </tbody>
        </table>
      </section>
    );
  }
  const ownDisabled = presentation?.status === 'ready' && presentation.value === 'disabled';
  const disabled = runtime.inheritedDisabled || ownDisabled;
  const inactive =
    runtime.inheritedInactive ||
    (presentation?.status === 'ready' && (presentation.value === 'inactive' || presentation.value === 'hidden'));
  if (
    !snapshot.value.present ||
    !snapshot.value.value ||
    typeof snapshot.value.value !== 'object' ||
    Array.isArray(snapshot.value.value)
  ) {
    return (
      <section className="schemaTableGroup">
        <table>
          <tbody>
            <RawFallback
              source={source}
              label={node.label}
              rawValue={snapshot.value.present ? snapshot.value.value : undefined}
              error={new Error('Rest path must point to an object')}
              disabled={disabled}
            />
          </tbody>
        </table>
      </section>
    );
  }
  const root = resolveBoundReference(node.path, runtime.bindings);
  const entries = collectRestEntries(
    snapshot.value.value as Record<string, unknown>,
    root,
    runtime.references,
    node.hide ?? [],
  );
  return (
    <details
      id={node.id}
      className={`schemaTableGroup schemaTableRest${inactive ? ' schemaTableInactive' : ''}${runtime.customization ? ' schemaTableCustomizable' : ''}${runtime.customization?.selectedNodeId === node.id ? ' selected' : ''}`}
      data-schema-node-id={node.id}
      data-test-id={`schema-rest-${node.id}`}
      draggable={Boolean(runtime.customization)}
      onClick={
        runtime.customization
          ? (event) => {
              event.stopPropagation();
              runtime.customization?.onSelect(node.id);
            }
          : undefined
      }
      onDragStart={
        runtime.customization
          ? (event) => {
              event.stopPropagation();
              event.dataTransfer.setData('application/x-schema-node', node.id);
            }
          : undefined
      }
      onDragOver={runtime.customization ? (event) => event.preventDefault() : undefined}
      onDrop={
        runtime.customization
          ? (event) => {
              event.preventDefault();
              event.stopPropagation();
              const source = event.dataTransfer.getData('application/x-schema-node');
              if (source && source !== node.id) runtime.customization?.onMove(source, node.id, 'before');
            }
          : undefined
      }
    >
      <summary>
        {node.label} <span>({entries.length})</span>
        <NodeMenuButton nodeId={node.id} customization={runtime.customization} />
      </summary>
      <table>
        <thead>
          <tr>
            <th>路径</th>
            <th>JSON 值与操作</th>
          </tr>
        </thead>
        <tbody>
          {RestRows({ entries, baseRef: node.path, runtime, disabled })}
          <tr>
            <td colSpan={2}>
              <RestAdd baseRef={node.path} path={[]} runtime={runtime} disabled={disabled} />
            </td>
          </tr>
        </tbody>
      </table>
    </details>
  );
}

function GroupSection({ node, runtime }: { node: Extract<UINode, { kind: 'group' }>; runtime: RuntimeProps }) {
  const boundScope = useMemo(() => createBoundSchemaScope(runtime.scope, node.bind), [node.bind, runtime.scope]);
  const childBindings = useMemo(
    () => extendReferenceBindings(runtime.bindings, node.bind),
    [node.bind, runtime.bindings],
  );
  const presentation = useConditionPresentation(node.condition, boundScope);
  if (presentation.status === 'ready' && presentation.value === 'hidden' && !runtime.customization) return null;
  if (presentation.status !== 'ready') {
    const resolution =
      presentation.status === 'type-mismatch' ? { status: 'error' as const, error: presentation.error } : presentation;
    return (
      <section className="schemaTableGroup">
        <table>
          <tbody>
            <BlockRow label={node.label} resolution={resolution} />
          </tbody>
        </table>
      </section>
    );
  }
  const childRuntime: RuntimeProps = {
    ...runtime,
    scope: boundScope,
    bindings: childBindings,
    inheritedDisabled: runtime.inheritedDisabled || presentation.value === 'disabled',
    inheritedInactive:
      runtime.inheritedInactive || presentation.value === 'inactive' || presentation.value === 'hidden',
  };
  return (
    <details
      id={node.id}
      className={`schemaTableGroup${childRuntime.inheritedInactive ? ' schemaTableInactive' : ''}${runtime.customization ? ' schemaTableCustomizable' : ''}${runtime.customization?.selectedNodeId === node.id ? ' selected' : ''}`}
      data-schema-node-id={node.id}
      data-test-id={`schema-group-${node.id}`}
      draggable={Boolean(runtime.customization)}
      onClick={
        runtime.customization
          ? (event) => {
              event.stopPropagation();
              runtime.customization?.onSelect(node.id);
            }
          : undefined
      }
      onDragStart={
        runtime.customization
          ? (event) => {
              event.stopPropagation();
              event.dataTransfer.setData('application/x-schema-node', node.id);
            }
          : undefined
      }
      onDragOver={runtime.customization ? (event) => event.preventDefault() : undefined}
      onDrop={
        runtime.customization
          ? (event) => {
              event.preventDefault();
              event.stopPropagation();
              const source = event.dataTransfer.getData('application/x-schema-node');
              if (source && source !== node.id) runtime.customization?.onMove(source, node.id, 'before');
            }
          : undefined
      }
      open
    >
      <summary
        onDragOver={
          runtime.customization
            ? (event) => {
                event.preventDefault();
                event.stopPropagation();
              }
            : undefined
        }
        onDrop={
          runtime.customization
            ? (event) => {
                event.preventDefault();
                event.stopPropagation();
                const source = event.dataTransfer.getData('application/x-schema-node');
                if (source && source !== node.id) runtime.customization?.onMove(source, node.id, 'inside');
              }
            : undefined
        }
      >
        {node.label}
        <NodeMenuButton nodeId={node.id} customization={runtime.customization} />
      </summary>
      <table>
        <tbody>
          {node.children.map((child) =>
            child.kind === 'field' ? (
              <FieldRow key={child.id} node={child} runtime={childRuntime} />
            ) : (
              <tr key={child.kind === 'group' ? child.id : child.id} className="schemaTableNestedBlock">
                <td colSpan={2}>{renderNode(child, childRuntime)}</td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </details>
  );
}

function renderNode(node: UINode, runtime: RuntimeProps): ReactNode {
  if (node.kind === 'field') {
    return (
      <table>
        <tbody>
          <FieldRow node={node} runtime={runtime} />
        </tbody>
      </table>
    );
  }
  if (node.kind === 'rest') return <RestSection node={node} runtime={runtime} />;
  return <GroupSection node={node} runtime={runtime} />;
}

export const SchemaTable: FC<SchemaTableProps> = (props) => {
  const references = useMemo(() => collectReferencedPaths(props.uiSchema), [props.uiSchema]);
  const bindings = useMemo<ReferenceBindings>(() => new Map(), []);
  const runtime: RuntimeProps = { ...props, references, bindings };
  return (
    <div
      className={`schemaTable schemaTableColumns${props.columns ?? 1}`}
      data-test-id="schema-table"
      data-columns={props.columns ?? 1}
    >
      {props.uiSchema.nodes.map((node) => (
        <Fragment key={node.id}>{renderNode(node, runtime)}</Fragment>
      ))}
    </div>
  );
};
