import * as Blockly from 'blockly';
import { Alert, Button, Checkbox, Input, InputNumber, Modal, Progress, Select, Tooltip } from 'antd';
import { Copy, GripVertical, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FC } from 'react';
import type { InputRef } from 'antd';
import { projectModel } from '@/project/model/projectModel';
import { buildBlocklyPreview } from '@/blockly/interactions';
import {
  collectProjectEventSamples,
  compileCustomBlockDraft,
  createBlankCustomBlockDraft,
  createEmptyProjectBlockPack,
  deleteProjectBlockPack,
  draftFromCustomBlock,
  inferCustomBlockDraft,
  loadProjectBlockPack,
  parseProjectBlockPack,
  projectBlockPackState,
  saveProjectBlockPack,
  validateCustomBlockRoundTrips,
  type CustomBlockControl,
  type CustomBlockDraft,
  type CustomBlockFieldDraft,
  type ProjectBlockPack,
  type ProjectEventIndexFailure,
  type ProjectEventSample,
} from '@/blockly/project';
import type {
  BlocklyCompletionSourceId,
  BlocklyPreviewAdapterId,
  DeclarativeBlockSchema,
  MaterialKind,
} from '@/blockly/registry';
import { notifyError, notifySuccess } from '@/utils/notify';
import { useBlocklyInteractionCapabilities } from './BlocklyCapabilitiesContext';
import './custom-block-manager.css';

export interface CustomBlockRegistrationSeed {
  raw: string;
  requestId: number;
}

interface CustomBlockManagerProps {
  open: boolean;
  registration?: CustomBlockRegistrationSeed | null;
  onClose(): void;
}

const CONTROL_OPTIONS: Array<{ value: CustomBlockControl; label: string }> = [
  { value: 'text', label: '文本' },
  { value: 'number', label: '数字' },
  { value: 'checkbox', label: '复选框' },
  { value: 'dropdown', label: '下拉框' },
  { value: 'multiline', label: '多行文本' },
  { value: 'json', label: 'JSON' },
  { value: 'colour', label: '颜色' },
  { value: 'value', label: '值块' },
  { value: 'statement', label: '事件列表' },
];

const COMPLETION_OPTIONS: Array<{ value: BlocklyCompletionSourceId; label: string }> = [
  { value: 'auto', label: '自动判断' },
  { value: 'contextual', label: '当前输入上下文' },
  { value: 'expression', label: '表达式标识符' },
  { value: 'id', label: '图块 ID' },
  { value: 'enemy', label: '怪物 ID' },
  { value: 'item', label: '道具 ID' },
  { value: 'floor', label: '楼层 ID' },
  { value: 'shop', label: '商店 ID' },
  { value: 'commonEvent', label: '公共事件名' },
  { value: 'image', label: '图片名' },
  { value: 'animate', label: '动画名' },
  { value: 'bgm', label: '背景音乐名' },
  { value: 'sound', label: '音效名' },
  { value: 'font', label: '字体名' },
  { value: 'color', label: '颜色值' },
  { value: 'flag', label: '变量名' },
  { value: 'status', label: '勇士属性名' },
  { value: 'core', label: 'Core API' },
  { value: 'textEscape', label: '文本转义标识符' },
];

const MATERIAL_OPTIONS: Array<{ value: MaterialKind; label: string }> = [
  { value: 'image', label: '图片' },
  { value: 'animate', label: '动画' },
  { value: 'bgm', label: '背景音乐' },
  { value: 'sound', label: '音效' },
  { value: 'tileset', label: '瓦片图集' },
  { value: 'autotile', label: '自动元件' },
  { value: 'hero', label: '勇士行走图' },
];

const PREVIEW_OPTIONS: Array<{ value: BlocklyPreviewAdapterId; label: string }> = [
  { value: 'event', label: '通用事件效果' },
  { value: 'text', label: '显示文字' },
  { value: 'textDrawing', label: '文本绘图指令' },
  { value: 'setText', label: '文字样式' },
  { value: 'waitRect', label: '等待区域' },
  { value: 'floorImage', label: '楼层贴图' },
];

function stateSource(state: ReturnType<typeof projectBlockPackState>): string {
  return state.status === 'error' && state.raw !== undefined ? state.raw : `${JSON.stringify(state.pack, null, 2)}\n`;
}

let previewSequence = 0;

const CustomBlockVisualPreview: FC<{ draft: CustomBlockDraft }> = ({ draft }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const lastValidSchemaRef = useRef<DeclarativeBlockSchema | null>(null);
  useEffect(() => {
    if (!hostRef.current) return undefined;
    let schema: DeclarativeBlockSchema;
    try {
      schema = compileCustomBlockDraft({
        ...draft,
        eventType: draft.eventType.trim() || '__preview__',
        title: draft.title.trim() || draft.eventType.trim() || '新自定义事件块',
      });
      lastValidSchemaRef.current = schema;
    } catch {
      if (!lastValidSchemaRef.current) return undefined;
      schema = lastValidSchemaRef.current;
    }
    const type = `__project_block_preview_${++previewSequence}`;
    const definition = { ...schema.definition, type };
    Blockly.common.defineBlocksWithJsonArray([definition]);
    const workspace = Blockly.inject(hostRef.current, {
      readOnly: true,
      move: { scrollbars: true, drag: true },
      zoom: { controls: false, wheel: false, startScale: 0.85 },
    });
    const block = workspace.newBlock(type) as Blockly.BlockSvg;
    block.initSvg();
    block.render();
    requestAnimationFrame(() => workspace.centerOnBlock(block.id));
    return () => {
      workspace.dispose();
      delete Blockly.Blocks[type];
    };
  }, [draft]);
  return <div className="customBlockVisualPreview" ref={hostRef} />;
};

function parseEvent(raw: string): Record<string, unknown> {
  const value = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('未知事件必须是 object');
  if (typeof value.type !== 'string' || !value.type.trim()) throw new Error('未知事件缺少非空 type');
  return value as Record<string, unknown>;
}

function combineSamples(clicked: Record<string, unknown>, samples: ProjectEventSample[]): ProjectEventSample[] {
  const clickedText = JSON.stringify(clicked);
  let skippedClickedOccurrence = false;
  return [
    { source: 'current', path: '$', event: structuredClone(clicked) },
    ...samples.filter((sample) => {
      if (!skippedClickedOccurrence && JSON.stringify(sample.event) === clickedText) {
        skippedClickedOccurrence = true;
        return false;
      }
      return true;
    }),
  ];
}

function updateAt<T>(list: T[], index: number, update: (value: T) => T): T[] {
  return list.map((value, current) => (current === index ? update(value) : value));
}

function defaultText(value: unknown): string {
  return value === undefined ? '' : JSON.stringify(value);
}

const FieldRow: FC<{
  field: CustomBlockFieldDraft;
  index: number;
  onChange(next: CustomBlockFieldDraft): void;
  onDelete(): void;
  onDragStart(): void;
  onDrop(): void;
}> = ({ field, index, onChange, onDelete, onDragStart, onDrop }) => (
  <div
    className="customBlockFieldRow"
    data-test-id={`custom-block-field-${index}`}
    draggable
    onDragStart={onDragStart}
    onDragOver={(event) => event.preventDefault()}
    onDrop={onDrop}
  >
    <GripVertical aria-hidden size={16} />
    <Input
      aria-invalid={!field.label.trim()}
      status={field.label.trim() ? undefined : 'error'}
      value={field.label}
      placeholder="显示名称（必填）"
      suffix={!field.label.trim() ? <span className="customBlockRequired">必填</span> : undefined}
      onChange={(event) => onChange({ ...field, label: event.target.value })}
    />
    <label className="customBlockPathInput">
      <Input
        aria-invalid={!field.path.trim()}
        status={field.path.trim() ? undefined : 'error'}
        value={field.path}
        placeholder="数据 path（必填）"
        suffix={!field.path.trim() ? <span className="customBlockRequired">必填</span> : undefined}
        onChange={(event) => onChange({ ...field, path: event.target.value })}
      />
    </label>
    <Select
      value={field.control}
      options={CONTROL_OPTIONS}
      onChange={(control) =>
        onChange({
          ...field,
          control,
          ...(control === 'text' ? {} : { completionSource: undefined, materialKind: undefined }),
          ...(control === 'dropdown' ? {} : { dropdownOptions: undefined }),
          ...(control === 'number' ? {} : { min: undefined, max: undefined, precision: undefined }),
        })
      }
    />
    <Input
      key={`${field.id}:${defaultText(field.defaultValue)}`}
      defaultValue={defaultText(field.defaultValue)}
      placeholder="默认值 JSON"
      onBlur={(event) => {
        const text = event.target.value.trim();
        if (!text) return onChange({ ...field, defaultValue: undefined });
        try {
          onChange({ ...field, defaultValue: JSON.parse(text) });
        } catch (cause) {
          notifyError(cause);
        }
      }}
    />
    <Checkbox
      aria-label="可选"
      checked={field.optional}
      onChange={(event) => onChange({ ...field, optional: event.target.checked })}
    />
    <Checkbox
      aria-label="省略默认"
      checked={field.omitWhenDefault}
      onChange={(event) => onChange({ ...field, omitWhenDefault: event.target.checked })}
    />
    <Tooltip title="删除字段">
      <Button danger icon={<Trash2 size={15} />} type="text" onClick={onDelete} />
    </Tooltip>
    {(field.control === 'text' || field.control === 'dropdown' || field.control === 'number') && (
      <div className="customBlockFieldAdvanced">
        {field.control === 'text' && (
          <>
            <label>
              补全源
              <Select
                allowClear
                value={field.completionSource}
                placeholder="不启用补全"
                options={COMPLETION_OPTIONS}
                onChange={(completionSource) => onChange({ ...field, completionSource })}
              />
            </label>
            <label>
              素材选择
              <Select
                allowClear
                value={field.materialKind}
                placeholder="不启用素材选择"
                options={MATERIAL_OPTIONS}
                onChange={(materialKind) => onChange({ ...field, materialKind })}
              />
            </label>
          </>
        )}
        {field.control === 'dropdown' && (
          <label>
            下拉选项 JSON
            <Input
              key={`${field.id}:options:${JSON.stringify(field.dropdownOptions)}`}
              defaultValue={JSON.stringify(field.dropdownOptions ?? [['选项', 'value']])}
              onBlur={(event) => {
                try {
                  const options = JSON.parse(event.target.value) as unknown;
                  if (
                    !Array.isArray(options) ||
                    options.some(
                      (item) =>
                        !Array.isArray(item) || item.length !== 2 || item.some((part) => typeof part !== 'string'),
                    )
                  ) {
                    throw new Error('下拉选项必须是 [["显示文本", "值"]]');
                  }
                  onChange({ ...field, dropdownOptions: options as Array<[string, string]> });
                } catch (cause) {
                  notifyError(cause);
                }
              }}
            />
          </label>
        )}
        {field.control === 'number' && (
          <>
            <label>
              最小值
              <InputNumber value={field.min} onChange={(min) => onChange({ ...field, min: min ?? undefined })} />
            </label>
            <label>
              最大值
              <InputNumber value={field.max} onChange={(max) => onChange({ ...field, max: max ?? undefined })} />
            </label>
            <label>
              步长
              <InputNumber
                min={0}
                value={field.precision}
                onChange={(precision) => onChange({ ...field, precision: precision ?? undefined })}
              />
            </label>
          </>
        )}
      </div>
    )}
  </div>
);

export const CustomBlockManager: FC<CustomBlockManagerProps> = ({ open, registration, onClose }) => {
  const capabilities = useBlocklyInteractionCapabilities();
  const [pack, setPack] = useState<ProjectBlockPack>(createEmptyProjectBlockPack);
  const [draft, setDraft] = useState<CustomBlockDraft>(createBlankCustomBlockDraft);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [samples, setSamples] = useState<ProjectEventSample[]>([]);
  const [failures, setFailures] = useState<ProjectEventIndexFailure[]>([]);
  const [pendingInference, setPendingInference] = useState<ProjectEventSample[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 1, source: '' });
  const [sourceMode, setSourceMode] = useState(false);
  const [sourceText, setSourceText] = useState('');
  const [loadingError, setLoadingError] = useState<Error | null>(null);
  const dragIndex = useRef<number | null>(null);
  const fieldDragIndex = useRef<number | null>(null);
  const scanController = useRef<AbortController | null>(null);
  const eventTypeInputRef = useRef<InputRef>(null);

  const startBlankDraft = () => {
    scanController.current?.abort();
    setDraft(createBlankCustomBlockDraft());
    setEditingIndex(null);
    setSamples([]);
    setFailures([]);
    setPendingInference(null);
    setSourceMode(false);
    requestAnimationFrame(() => eventTypeInputRef.current?.focus());
  };

  const selectSchema = async (index: number, sourcePack = pack) => {
    const schema = sourcePack.blocks[index];
    if (!schema) return;
    setEditingIndex(index);
    setDraft(draftFromCustomBlock(schema));
    setSamples([]);
    setFailures([]);
    setPendingInference(null);
    setSourceMode(false);
    try {
      const result = await collectProjectEventSamples(String(schema.event.match.equals));
      setSamples(result.samples);
      setFailures(result.failures);
    } catch (cause) {
      notifyError(cause);
    }
  };

  const applyInference = async (type: string, nextSamples: ProjectEventSample[]) => {
    const completions = projectModel.blocklyCompletions();
    try {
      await completions.ensureLoaded();
    } catch {
      // Registry suggestions are optional; value/shape inference still proceeds.
    }
    const snapshot = completions.snapshot();
    setDraft(inferCustomBlockDraft(type, nextSamples, snapshot.status === 'loaded' ? snapshot.value : undefined));
    setEditingIndex(null);
    setSamples(nextSamples);
    setPendingInference(null);
  };

  useEffect(() => {
    if (!open) return;
    void loadProjectBlockPack().then((next) => {
      setPack(next.pack);
      setSourceText(stateSource(next));
      setLoadingError(next.status === 'error' ? next.error : null);
      if (!registration && next.pack.blocks.length > 0) void selectSchema(0, next.pack);
      else if (!registration) {
        setDraft(createBlankCustomBlockDraft());
        setEditingIndex(null);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅在弹窗打开状态变化时重取注册信息，其余依赖由事件驱动
  }, [open]);

  useEffect(() => {
    if (!open || !registration) return;
    let clicked: Record<string, unknown>;
    try {
      clicked = parseEvent(registration.raw);
    } catch (cause) {
      notifyError(cause);
      return;
    }
    const type = String(clicked.type);
    scanController.current?.abort();
    const controller = new AbortController();
    scanController.current = controller;
    setScanning(true);
    setProgress({ completed: 0, total: 1, source: '' });
    void collectProjectEventSamples(type, {
      requireUnknown: true,
      signal: controller.signal,
      onProgress: (completed, total, source) => setProgress({ completed, total, source }),
    })
      .then(async (result) => {
        const combined = combineSamples(clicked, result.samples);
        setFailures(result.failures);
        if (result.failures.length) setPendingInference(combined);
        else await applyInference(type, combined);
      })
      .catch((cause) => {
        if ((cause as { name?: string }).name !== 'AbortError') notifyError(cause);
      })
      .finally(() => {
        if (scanController.current === controller) setScanning(false);
      });
    return () => controller.abort();
    // requestId is the stable identity for one registration action.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- requestId 是本次注册动作的稳定标识，故只依赖它
  }, [open, registration?.requestId]);

  const schema = useMemo(() => {
    try {
      return { value: compileCustomBlockDraft(draft), error: null };
    } catch (cause) {
      return { value: null, error: cause instanceof Error ? cause : new Error(String(cause)) };
    }
  }, [draft]);
  const differences = useMemo(
    () => (schema.value ? validateCustomBlockRoundTrips(schema.value, samples) : []),
    [samples, schema.value],
  );

  const refreshPack = () => {
    const next = projectBlockPackState();
    setPack(next.pack);
    setSourceText(stateSource(next));
    setLoadingError(next.status === 'error' ? next.error : null);
  };

  const saveDraft = async () => {
    if (!schema.value) return notifyError(schema.error ?? new Error('自定义块配置无效'));
    if (differences.length) return notifyError(`有 ${differences.length} 个工程样本无法无损 round-trip`);
    const blocks = [...pack.blocks];
    if (editingIndex == null) blocks.push(schema.value);
    else blocks[editingIndex] = schema.value;
    try {
      await saveProjectBlockPack({ ...pack, blocks });
      refreshPack();
      setEditingIndex(editingIndex ?? blocks.length - 1);
      notifySuccess('自定义事件块已保存');
    } catch (cause) {
      notifyError(cause);
    }
  };

  const removeBlock = async (index: number) => {
    const target = pack.blocks[index];
    if (!target) return;

    let scanReady = false;
    let cancelled = false;
    const confirm = Modal.confirm({
      title: '删除自定义事件块？',
      content: '正在统计受影响的工程事件……',
      okText: '删除',
      okButtonProps: { danger: true, disabled: true },
      cancelText: '取消',
      onCancel: () => {
        cancelled = true;
      },
      onOk: async () => {
        if (!scanReady) return;
        await saveProjectBlockPack({ ...pack, blocks: pack.blocks.filter((_, current) => current !== index) });
        refreshPack();
        setEditingIndex(null);
        setDraft(createBlankCustomBlockDraft());
      },
    });

    try {
      const result = await collectProjectEventSamples(String(target.event.match.equals));
      if (cancelled) return;
      scanReady = true;
      const impact = result.samples.length;
      const failed = result.failures.length;
      confirm.update({
        content: `${impact} 个工程事件将退回未知块；事件数据不会被删除。${failed ? `另有 ${failed} 个来源读取失败。` : ''}`,
        okButtonProps: { danger: true, disabled: false },
      });
    } catch (cause) {
      if (cancelled) return;
      scanReady = true;
      confirm.update({
        content: `无法完整统计影响范围：${cause instanceof Error ? cause.message : String(cause)}。删除定义仍不会删除事件数据，相关事件会退回未知块。`,
        okButtonProps: { danger: true, disabled: false },
      });
    }
  };

  const reorder = async (from: number, to: number) => {
    if (from === to) return;
    const blocks = [...pack.blocks];
    const [moved] = blocks.splice(from, 1);
    blocks.splice(to, 0, moved);
    try {
      await saveProjectBlockPack({ ...pack, blocks });
      refreshPack();
      setEditingIndex(to);
    } catch (cause) {
      notifyError(cause);
    }
  };

  const saveSource = async () => {
    try {
      const parsed = parseProjectBlockPack(JSON.parse(sourceText));
      await saveProjectBlockPack(parsed);
      refreshPack();
      setSourceMode(false);
      notifySuccess('自定义事件块 Pack 已保存');
    } catch (cause) {
      notifyError(cause);
    }
  };

  const addField = () =>
    setDraft((current) => ({
      ...current,
      fields: [
        ...current.fields,
        {
          id: `FIELD_${current.fields.length + 1}_${Date.now().toString(36)}`,
          label: '',
          path: '',
          control: 'text',
          optional: false,
          omitWhenDefault: false,
        },
      ],
    }));

  const fieldOptions = draft.fields.map((field) => ({
    value: field.id,
    label: `${field.label || '未命名字段'} · ${field.path || '未设置 path'}`,
  }));
  const previewSample = samples[0]?.event ?? (schema.value?.event.template as Record<string, unknown> | undefined);

  return (
    <Modal
      className="customBlockManagerModal"
      destroyOnHidden
      footer={null}
      onCancel={() => {
        scanController.current?.abort();
        onClose();
      }}
      open={open}
      title="自定义事件块"
      width="min(1680px, calc(100vw - 8px))"
    >
      {loadingError && (
        <Alert
          showIcon
          type="error"
          message="自定义事件块配置无法加载"
          description={loadingError.message}
          action={<Button onClick={() => setSourceMode(true)}>打开原始 JSON</Button>}
        />
      )}
      {scanning && (
        <div className="customBlockScanProgress">
          <Progress percent={Math.round((progress.completed / Math.max(1, progress.total)) * 100)} size="small" />
          <span>正在扫描 {progress.source || '工程事件'}…</span>
          <Button size="small" onClick={() => scanController.current?.abort()}>
            取消
          </Button>
        </div>
      )}
      {pendingInference && (
        <Alert
          showIcon
          type="warning"
          message={`有 ${failures.length} 个事件来源读取失败`}
          description={failures.map((item) => `${item.path}: ${item.error.message}`).join('\n')}
          action={
            <Button
              onClick={() => void applyInference(String(pendingInference[0]?.event.type ?? ''), pendingInference)}
            >
              使用已读取样本继续
            </Button>
          }
        />
      )}
      {!pendingInference && failures.length > 0 && (
        <Alert
          showIcon
          type="warning"
          message={`${failures.length} 个事件来源未参与当前 round-trip 校验`}
          description={failures.map((item) => `${item.path}: ${item.error.message}`).join('\n')}
          action={
            editingIndex == null ? undefined : <Button onClick={() => void selectSchema(editingIndex)}>重试扫描</Button>
          }
        />
      )}
      {sourceMode ? (
        <div className="customBlockSourceEditor">
          <Input.TextArea
            value={sourceText}
            onChange={(event) => setSourceText(event.target.value)}
            spellCheck={false}
          />
          <div className="customBlockManagerActions">
            <Button onClick={() => setSourceMode(false)}>返回表单</Button>
            <Button
              danger
              onClick={() =>
                void deleteProjectBlockPack().then(() => {
                  refreshPack();
                  setSourceMode(false);
                })
              }
            >
              删除工程配置
            </Button>
            <Button type="primary" icon={<Save size={15} />} onClick={() => void saveSource()}>
              保存 JSON
            </Button>
          </div>
        </div>
      ) : (
        <div className="customBlockManagerLayout">
          <aside className="customBlockList">
            <div className="customBlockListActions">
              <Button data-test-id="custom-block-new" icon={<Plus size={15} />} onClick={startBlankDraft}>
                新增
              </Button>
              <Button onClick={() => setSourceMode(true)}>完整 JSON</Button>
            </div>
            {editingIndex == null && (
              <div
                className="customBlockListItem customBlockDraftItem is-active"
                data-test-id="custom-block-unsaved-draft"
              >
                <Plus size={15} />
                <span>
                  <strong>{draft.eventType || draft.title || '新自定义事件块'}</strong>
                  <small>未保存草稿</small>
                </span>
              </div>
            )}
            {pack.blocks.map((block, index) => (
              <div
                className={`customBlockListItem${editingIndex === index ? ' is-active' : ''}`}
                draggable
                key={block.type}
                onClick={() => void selectSchema(index)}
                onDragStart={() => {
                  dragIndex.current = index;
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (dragIndex.current != null) void reorder(dragIndex.current, index);
                  dragIndex.current = null;
                }}
              >
                <GripVertical size={15} />
                <span>
                  <strong>{String(block.event.match.equals)}</strong>
                  <small>{block.type}</small>
                </span>
                <Button
                  danger
                  icon={<Trash2 size={14} />}
                  type="text"
                  onClick={(event) => {
                    event.stopPropagation();
                    void removeBlock(index);
                  }}
                />
              </div>
            ))}
          </aside>
          <section className="customBlockForm">
            <div className="customBlockFormGrid">
              <label>
                事件 type
                <Input
                  ref={eventTypeInputRef}
                  value={draft.eventType}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      eventType: event.target.value,
                      blockType: editingIndex == null ? '' : draft.blockType,
                    })
                  }
                />
              </label>
              <label>
                块标题
                <Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
              </label>
              <label>
                颜色
                <InputNumber
                  min={0}
                  max={360}
                  value={draft.colour}
                  onChange={(colour) => setDraft({ ...draft, colour: colour ?? 230 })}
                />
              </label>
              <label>
                事件效果预览
                <Select
                  allowClear
                  value={draft.previewAdapter}
                  options={PREVIEW_OPTIONS}
                  placeholder="不提供效果预览"
                  onChange={(previewAdapter) => setDraft({ ...draft, previewAdapter })}
                />
              </label>
              <label className="is-wide">
                Tooltip
                <Input
                  value={draft.tooltip}
                  onChange={(event) => setDraft({ ...draft, tooltip: event.target.value })}
                />
              </label>
            </div>
            <div className="customBlockFieldsHeader">
              <strong>字段</strong>
              <Button icon={<Plus size={14} />} onClick={addField}>
                新增字段
              </Button>
            </div>
            <div className="customBlockFields">
              <div className="customBlockFieldHeader" aria-hidden>
                <span />
                <span>名称</span>
                <span>Path</span>
                <span>控件</span>
                <span>默认值</span>
                <span>可选</span>
                <span>省略</span>
                <span />
              </div>
              {draft.fields.map((field, index) => (
                <FieldRow
                  field={field}
                  index={index}
                  key={field.id}
                  onChange={(next) => setDraft({ ...draft, fields: updateAt(draft.fields, index, () => next) })}
                  onDelete={() =>
                    setDraft({ ...draft, fields: draft.fields.filter((_, current) => current !== index) })
                  }
                  onDragStart={() => {
                    fieldDragIndex.current = index;
                  }}
                  onDrop={() => {
                    const from = fieldDragIndex.current;
                    if (from == null || from === index) return;
                    const fields = [...draft.fields];
                    const [moved] = fields.splice(from, 1);
                    fields.splice(index, 0, moved);
                    fieldDragIndex.current = null;
                    setDraft({ ...draft, fields });
                  }}
                />
              ))}
            </div>
            <div className="customBlockPointSettings">
              <Checkbox
                checked={Boolean(draft.pointInteraction)}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    pointInteraction: event.target.checked
                      ? { xField: fieldOptions[0]?.value ?? '', yField: fieldOptions[1]?.value ?? '' }
                      : undefined,
                  })
                }
              >
                为此块提供地图选点
              </Checkbox>
              {draft.pointInteraction && (
                <>
                  <label>
                    <span>回填 X</span>
                    <Select
                      value={draft.pointInteraction.xField}
                      options={fieldOptions}
                      placeholder="选择字段"
                      onChange={(xField) =>
                        setDraft({ ...draft, pointInteraction: { ...draft.pointInteraction!, xField } })
                      }
                    />
                  </label>
                  <label>
                    <span>回填 Y</span>
                    <Select
                      value={draft.pointInteraction.yField}
                      options={fieldOptions}
                      placeholder="选择字段"
                      onChange={(yField) =>
                        setDraft({ ...draft, pointInteraction: { ...draft.pointInteraction!, yField } })
                      }
                    />
                  </label>
                  <label>
                    <span>回填 floorId</span>
                    <Select
                      allowClear
                      value={draft.pointInteraction.floorField}
                      options={fieldOptions}
                      placeholder="可选"
                      onChange={(floorField) =>
                        setDraft({ ...draft, pointInteraction: { ...draft.pointInteraction!, floorField } })
                      }
                    />
                  </label>
                </>
              )}
              <small>选中这种事件块后，“地图选点”会把结果回填到上面指定的字段。</small>
            </div>
            <div className="customBlockManagerActions">
              {editingIndex != null && (
                <Button
                  danger
                  data-test-id="custom-block-delete"
                  icon={<Trash2 size={15} />}
                  onClick={() => void removeBlock(editingIndex)}
                >
                  删除
                </Button>
              )}
              {editingIndex != null && (
                <Button
                  icon={<Copy size={15} />}
                  onClick={() => {
                    setDraft({ ...structuredClone(draft), eventType: '', blockType: '', title: `${draft.title} 副本` });
                    setEditingIndex(null);
                    setSamples([]);
                  }}
                >
                  复制
                </Button>
              )}
              <Button
                icon={<RotateCcw size={15} />}
                onClick={() =>
                  editingIndex == null ? setDraft(createBlankCustomBlockDraft()) : void selectSchema(editingIndex)
                }
              >
                放弃修改
              </Button>
              <Button
                type="primary"
                icon={<Save size={15} />}
                disabled={scanning || Boolean(schema.error) || differences.length > 0}
                onClick={() => void saveDraft()}
              >
                保存
              </Button>
            </div>
          </section>
          <aside className="customBlockPreviewPane">
            <h4>积木预览</h4>
            <CustomBlockVisualPreview draft={draft} />
            <h4>Round-trip</h4>
            <div className={differences.length ? 'roundTripStatus is-error' : 'roundTripStatus is-ok'}>
              {samples.length === 0
                ? '暂无工程样本；将使用默认模板校验'
                : differences.length
                  ? `${differences.length}/${samples.length} 个样本发生变化`
                  : `${samples.length} 个样本保持无损`}
            </div>
            {differences[0] && (
              <pre>
                {JSON.stringify(
                  {
                    source: `${differences[0].sample.source}:${differences[0].sample.path}`,
                    input: differences[0].sample.event,
                    output: differences[0].output,
                  },
                  null,
                  2,
                )}
              </pre>
            )}
            <Button
              disabled={!draft.previewAdapter || !previewSample}
              onClick={() => {
                if (draft.previewAdapter && previewSample)
                  void capabilities.preview(buildBlocklyPreview(previewSample, draft.previewAdapter));
              }}
            >
              预览事件效果
            </Button>
            <small>仅调用编辑器内置安全 adapter，不执行工程插件。</small>
          </aside>
        </div>
      )}
    </Modal>
  );
};
