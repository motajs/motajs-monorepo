import { isEqual } from "es-toolkit";
import {
  Button,
  Checkbox,
  Drawer,
  Dropdown,
  Input,
  Modal,
  Select,
  Space,
  Tooltip,
  type MenuProps,
} from "antd";
import { Code2, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState, type FC } from "react";
import { useCodeEditor } from "@/Workbench/CodeEditor/CodeEditorContext";
import { notifyError, notifySuccess } from "@/utils/notify";
import { SchemaTable, type SchemaTableProps } from "./SchemaTable";
import {
  loadSchemaOverrideDraft,
  saveSchemaOverride,
  saveSchemaSources,
} from "./schemaOverrideCommands";
import {
  type BuiltinSchemaDefinition,
  type ProjectSchemaResolution,
  useProjectSchema,
} from "./projectSchema";
import {
  createUniqueNodeId,
  findNodeLocation,
  insertNode,
  listNodeLocations,
  moveNode,
  recoverBuiltinNode,
  removeNode,
  replaceNode,
  restoreGroupSubtree,
  restoreNodePosition,
  restoreNodeProperties,
} from "./schemaTree";
import {
  selectSchemaCustomizationNode,
  useSchemaCustomizationState,
} from "./schemaCustomizationState";
import type { FieldSchema, FieldSchemaBundle, UINode, UISchema } from "./types";

type ReadyResolution = Extract<ProjectSchemaResolution, { status: "ready" }>;

function JsonFragmentEditor({ value, onChange, label }: {
  value: unknown;
  onChange(value: unknown): void;
  label: string;
}) {
  const serialized = JSON.stringify(value, null, 2);
  const [state, setState] = useState({ source: serialized, text: serialized, error: "" });
  const current = state.source === serialized ? state : { source: serialized, text: serialized, error: "" };
  return (
    <div className="schemaCustomizationJson">
      <label>{label}</label>
      <textarea
        aria-label={label}
        value={current.text}
        onChange={(event) => {
          const text = event.target.value;
          try {
            const parsed = JSON.parse(text);
            setState({ source: serialized, text, error: "" });
            onChange(parsed);
          } catch (error) {
            setState({ source: serialized, text, error: error instanceof Error ? error.message : String(error) });
          }
        }}
      />
      {current.error ? <div className="schemaTableError">{current.error}</div> : null}
    </div>
  );
}

function impactConfirm(title: string, content: string, action: () => Promise<void>): void {
  Modal.confirm({
    title,
    content,
    okText: "确认应用",
    cancelText: "取消",
    onOk: action,
  });
}

interface NodeDrawerProps {
  definition: BuiltinSchemaDefinition;
  resolution: ReadyResolution;
  selectedNodeId?: string;
  onSelect(nodeId?: string): void;
}

const NodeDrawer: FC<NodeDrawerProps> = ({ definition, resolution, selectedNodeId, onSelect }) => {
  const codeEditor = useCodeEditor();
  const location = selectedNodeId ? findNodeLocation(resolution.uiSource, selectedNodeId) : undefined;
  const sourceNode = location?.node;
  const fieldOwner = sourceNode?.kind === "field"
    ? resolution.fieldOwners.get(sourceNode.fieldSchema) ?? definition
    : definition;
  const ownerResolution = useProjectSchema(fieldOwner);
  const sourceField = sourceNode?.kind === "field" && ownerResolution.status === "ready"
    ? ownerResolution.fieldSource.fields[sourceNode.fieldSchema]
    : undefined;
  const [nodeDraft, setNodeDraft] = useState<UINode | undefined>(sourceNode);
  const [fieldDraft, setFieldDraft] = useState<FieldSchema | undefined>(sourceField);
  const [saving, setSaving] = useState(false);
  const [restoreFieldsOpen, setRestoreFieldsOpen] = useState(false);
  const [restoreFieldIds, setRestoreFieldIds] = useState<string[]>([]);

  useEffect(() => {
    setNodeDraft(sourceNode ? structuredClone(sourceNode) : undefined);
    setFieldDraft(sourceField ? structuredClone(sourceField) : undefined);
  }, [selectedNodeId, sourceNode, sourceField]);

  const nodeDirty = Boolean(sourceNode && nodeDraft && !isEqual(sourceNode, nodeDraft));
  const fieldDirty = Boolean(sourceField && fieldDraft && !isEqual(sourceField, fieldDraft));
  const dirty = nodeDirty || fieldDirty;

  const save = useCallback(async () => {
    if (!sourceNode || !nodeDraft) return;
    setSaving(true);
    try {
      const changes: { field?: FieldSchemaBundle; ui?: UISchema } = {};
      if (nodeDirty) changes.ui = replaceNode(resolution.uiSource, sourceNode.id, nodeDraft);
      if (fieldDirty && sourceNode.kind === "field" && fieldDraft && ownerResolution.status === "ready") {
        changes.field = {
          ...ownerResolution.fieldSource,
          fields: { ...ownerResolution.fieldSource.fields, [sourceNode.fieldSchema]: fieldDraft },
        };
      }
      await saveSchemaSources(definition, changes, `编辑 Schema 节点 ${sourceNode.id}`, fieldOwner);
      notifySuccess("Schema 节点已保存");
      onSelect(nodeDraft.id);
    } finally {
      setSaving(false);
    }
  }, [definition, fieldDirty, fieldDraft, fieldOwner, nodeDraft, nodeDirty, onSelect, ownerResolution, resolution.uiSource, sourceNode]);

  const close = () => {
    if (!dirty) {
      onSelect(undefined);
      return;
    }
    Modal.confirm({
      title: "放弃未保存的节点修改？",
      content: "抽屉中的局部草稿尚未写入工程。",
      okText: "放弃",
      okButtonProps: { danger: true },
      cancelText: "继续编辑",
      onOk: () => onSelect(undefined),
    });
  };

  const openWholeLayer = async (layer: "field" | "ui") => {
    const target = layer === "field" ? fieldOwner : definition;
    const open = async () => {
      const initialValue = await loadSchemaOverrideDraft(target, layer);
      codeEditor.open({
        contextId: `project-schema:${layer}:${layer === "field" ? target.fieldBundle.schemaId : target.uiSchema.schemaId}`,
        initialValue,
        lint: false,
        onConfirm: async (text) => {
          await saveSchemaOverride(target, layer, text);
          notifySuccess(layer === "field" ? "完整 Field Bundle 已保存" : "完整 Table Schema 已保存");
        },
      });
    };
    if (!dirty) return open();
    Modal.confirm({
      title: "当前节点存在未保存修改",
      content: "可以先保存局部修改再打开完整源码，或放弃当前局部草稿直接打开。",
      okText: "保存并打开",
      cancelText: "放弃并打开",
      onOk: async () => { await save(); await open(); },
      onCancel: () => void open(),
    });
  };

  const builtinNode = selectedNodeId ? findNodeLocation(definition.uiSource, selectedNodeId)?.node : undefined;
  const builtinField = sourceNode?.kind === "field"
    ? fieldOwner.fieldSource.fields[sourceNode.fieldSchema]
    : undefined;

  const restoreFields = async () => {
    if (ownerResolution.status !== "ready" || restoreFieldIds.length === 0) return;
    const fields = { ...ownerResolution.fieldSource.fields };
    for (const id of restoreFieldIds) {
      const baseline = fieldOwner.fieldSource.fields[id];
      if (baseline) fields[id] = structuredClone(baseline);
    }
    await saveSchemaSources(definition, { field: { ...ownerResolution.fieldSource, fields } }, `还原 ${restoreFieldIds.length} 个 Field`, fieldOwner);
    setRestoreFieldsOpen(false);
    setRestoreFieldIds([]);
  };

  return (
    <>
      <Drawer
        className="schemaCustomizationDrawer"
        destroyOnHidden={false}
        open={Boolean(sourceNode)}
        title={sourceNode ? `编辑 ${sourceNode.kind} · ${sourceNode.id}` : "编辑 Schema 节点"}
        size={520}
        onClose={close}
        extra={<Button type="primary" loading={saving} disabled={!dirty} onClick={() => void save()}>确认</Button>}
      >
        {sourceNode && nodeDraft ? (
          <>
            <section>
              <h3>表格节点</h3>
              {nodeDraft.kind === "field" ? (
                <>
                  <label className="schemaCustomizationControl">Field Schema
                    <Select
                      showSearch
                      value={nodeDraft.fieldSchema}
                      options={[...resolution.fieldSchemas.entries()].map(([id, field]) => ({ value: id, label: `${id} · ${field.title}` }))}
                      onChange={(fieldSchema) => {
                        setNodeDraft({ ...nodeDraft, fieldSchema });
                        if (sourceNode.kind !== "field" || fieldSchema !== sourceNode.fieldSchema) setFieldDraft(undefined);
                      }}
                    />
                  </label>
                  <JsonFragmentEditor value={nodeDraft.source ?? nodeDraft.sources} label="数据来源" onChange={(value) => {
                    if (nodeDraft.source) setNodeDraft({ ...nodeDraft, source: value as { ref: string } });
                    else setNodeDraft({ ...nodeDraft, sources: value as Record<string, { ref: string }> });
                  }} />
                </>
              ) : (
                <label className="schemaCustomizationControl">显示名称
                  <Input value={nodeDraft.label} onChange={(event) => setNodeDraft({ ...nodeDraft, label: event.target.value })} />
                </label>
              )}
              {nodeDraft.kind === "rest" ? (
                <>
                  <label className="schemaCustomizationControl">Rest path
                    <Input value={nodeDraft.path.ref} onChange={(event) => setNodeDraft({ ...nodeDraft, path: { ref: event.target.value } })} />
                  </label>
                  <label className="schemaCustomizationControl">Hide dotted subtrees
                    <Input value={(nodeDraft.hide ?? []).join(", ")} onChange={(event) => setNodeDraft({ ...nodeDraft, hide: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} />
                  </label>
                </>
              ) : null}
              <JsonFragmentEditor value={nodeDraft} label="当前节点 JSON" onChange={(value) => setNodeDraft(value as UINode)} />
              <Space wrap>
                {builtinNode ? <Button icon={<RotateCcw size={14} />} onClick={() => impactConfirm(
                  "还原节点属性？",
                  "保留当前父级和顺序，只恢复内置节点属性。",
                  async () => saveSchemaSources(definition, { ui: restoreNodeProperties(resolution.uiSource, definition.uiSource, sourceNode.id) }, `还原节点属性 ${sourceNode.id}`),
                )}>还原属性</Button> : null}
                {builtinNode ? <Button onClick={() => impactConfirm(
                  "还原节点位置？",
                  "节点将回到内置父级和相对顺序，当前属性保持不变。",
                  async () => saveSchemaSources(definition, { ui: restoreNodePosition(resolution.uiSource, definition.uiSource, sourceNode.id) }, `还原节点位置 ${sourceNode.id}`),
                )}>还原位置</Button> : null}
                {builtinNode?.kind === "group" ? <Button onClick={() => impactConfirm(
                  "还原整个 Group 子树？",
                  "Group 的属性和全部后代将替换为当前编辑器内置版本。",
                  async () => saveSchemaSources(definition, { ui: restoreGroupSubtree(resolution.uiSource, definition.uiSource, sourceNode.id) }, `还原 Group ${sourceNode.id}`),
                )}>还原 Group 子树</Button> : null}
              </Space>
            </section>
            {sourceNode.kind === "field" ? (
              <section>
                <h3>字段定义</h3>
                {nodeDraft.kind === "field" && nodeDraft.fieldSchema !== sourceNode.fieldSchema
                  ? <div className="schemaTableMuted">先确认保存新的 Field Schema 引用，再编辑对应 Field 定义。</div>
                  : ownerResolution.status === "ready" && fieldDraft ? (
                  <>
                    <label className="schemaCustomizationControl">标题
                      <Input value={fieldDraft.title} onChange={(event) => setFieldDraft({ ...fieldDraft, title: event.target.value })} />
                    </label>
                    <label className="schemaCustomizationControl">说明
                      <Input.TextArea value={fieldDraft.description} onChange={(event) => setFieldDraft({ ...fieldDraft, description: event.target.value || undefined })} />
                    </label>
                    <JsonFragmentEditor value={fieldDraft} label="当前 Field JSON" onChange={(value) => setFieldDraft(value as FieldSchema)} />
                    <Space wrap>
                      {builtinField ? <Button icon={<RotateCcw size={14} />} onClick={() => impactConfirm(
                        "还原当前 Field？",
                        `${sourceNode.fieldSchema} 将恢复为当前编辑器的内置定义。`,
                        async () => saveSchemaSources(definition, { field: {
                          ...ownerResolution.fieldSource,
                          fields: { ...ownerResolution.fieldSource.fields, [sourceNode.fieldSchema]: structuredClone(builtinField) },
                        } }, `还原 Field ${sourceNode.fieldSchema}`, fieldOwner),
                      )}>还原当前 Field</Button> : null}
                      <Button onClick={() => setRestoreFieldsOpen(true)}>批量还原 Field</Button>
                      <Button icon={<Code2 size={14} />} onClick={() => void openWholeLayer("field")}>打开完整 Field Bundle</Button>
                      <Button onClick={() => impactConfirm(
                        "还原整个 Field Bundle？",
                        "该 Bundle 的全部工程自定义将被删除；Table override 不受影响。",
                        async () => saveSchemaSources(definition, { field: fieldOwner.fieldSource }, "还原整个 Field Bundle", fieldOwner),
                      )}>还原整个 Bundle</Button>
                    </Space>
                  </>
                ) : <div className="schemaTableError">Field Bundle 当前不可编辑，请先修复其 override。</div>}
              </section>
            ) : null}
          </>
        ) : null}
      </Drawer>
      <Modal
        open={restoreFieldsOpen}
        title="批量还原 Field"
        okText="还原所选"
        cancelText="取消"
        okButtonProps={{ disabled: restoreFieldIds.length === 0 }}
        onOk={() => void restoreFields()}
        onCancel={() => setRestoreFieldsOpen(false)}
      >
        <Checkbox.Group
          className="schemaCustomizationRestoreList"
          value={restoreFieldIds}
          options={Object.entries(fieldOwner.fieldSource.fields).map(([id, field]) => ({
            label: `${id} · ${field.title}`,
            value: id,
          }))}
          onChange={(values) => setRestoreFieldIds(values as string[])}
        />
      </Modal>
    </>
  );
};

interface AddNodeDraft {
  kind: "field" | "group" | "rest";
  fieldSchema?: string;
  source?: string;
  label?: string;
  path?: string;
}

export interface SchemaCustomizationEditorProps extends Omit<SchemaTableProps, "fieldSchemas" | "uiSchema" | "customization"> {
  definition: BuiltinSchemaDefinition;
  resolution: ReadyResolution;
}

export const SchemaCustomizationEditor: FC<SchemaCustomizationEditorProps> = ({ definition, resolution, ...props }) => {
  const codeEditor = useCodeEditor();
  const state = useSchemaCustomizationState(definition.uiSchema.schemaId);
  const [addDraft, setAddDraft] = useState<AddNodeDraft>();
  const [recoverOpen, setRecoverOpen] = useState(false);
  const [recoverId, setRecoverId] = useState<string>();
  const selected = state.selectedNodeId ? findNodeLocation(resolution.uiSource, state.selectedNodeId) : undefined;
  const missingBuiltinNodes = listNodeLocations(definition.uiSource).filter((location) => !findNodeLocation(resolution.uiSource, location.node.id));
  const defaultRootRef = (() => {
    for (const { node } of listNodeLocations(resolution.uiSource)) {
      const ref = node.kind === "field" ? node.source?.ref : node.kind === "rest" ? node.path.ref : undefined;
      if (ref?.includes(":")) return `${ref.slice(0, ref.indexOf(":") + 1)}`;
    }
    return "data:";
  })();

  const saveUi = async (ui: UISchema, label: string) => {
    await saveSchemaSources(definition, { ui }, label);
    notifySuccess(label);
  };

  const addNode = async () => {
    if (!addDraft) return;
    const parentId = selected?.node.kind === "group" ? selected.node.id : selected?.parentId;
    let node: UINode;
    if (addDraft.kind === "field") {
      if (!addDraft.fieldSchema || !addDraft.source) throw new Error("请选择 Field 并填写 source");
      node = {
        kind: "field",
        id: createUniqueNodeId(resolution.uiSource, addDraft.fieldSchema.replace(/[^A-Za-z0-9_-]+/g, "-")),
        fieldSchema: addDraft.fieldSchema,
        source: { ref: addDraft.source },
      };
    } else if (addDraft.kind === "group") {
      node = { kind: "group", id: createUniqueNodeId(resolution.uiSource, "custom-group"), label: addDraft.label || "新分组", children: [] };
    } else {
      node = { kind: "rest", id: createUniqueNodeId(resolution.uiSource, "custom-rest"), label: addDraft.label || "其他字段", path: { ref: addDraft.path || defaultRootRef } };
    }
    await saveUi(insertNode(resolution.uiSource, node, parentId), `新增 Schema 节点 ${node.id}`);
    selectSchemaCustomizationNode(definition.uiSchema.schemaId, node.id);
    setAddDraft(undefined);
  };

  const addItems: MenuProps["items"] = [
    { key: "field", label: "新增 Field 节点" },
    { key: "group", label: "新增 Group" },
    { key: "rest", label: "新增 Rest" },
  ];

  const openTableSource = async () => {
    const initialValue = await loadSchemaOverrideDraft(definition, "ui");
    codeEditor.open({
      contextId: `project-schema:ui:${definition.uiSchema.schemaId}`,
      initialValue,
      lint: false,
      onConfirm: async (text) => {
        await saveSchemaOverride(definition, "ui", text);
        notifySuccess("完整 Table Schema 已保存");
      },
    });
  };

  const confirmDeleteNode = (nodeId: string) => {
    const location = findNodeLocation(resolution.uiSource, nodeId);
    if (!location) return;
    Modal.confirm({
      title: `删除节点 ${nodeId}？`,
      content: location.node.kind === "group" ? "Group 的整个子树都会从 Table 中删除；Field 定义不会随节点删除。" : "Field 定义不会随节点删除。",
      okText: "删除",
      okButtonProps: { danger: true },
      cancelText: "取消",
      onOk: async () => {
        await saveUi(removeNode(resolution.uiSource, nodeId).schema, `删除 Schema 节点 ${nodeId}`);
        selectSchemaCustomizationNode(definition.uiSchema.schemaId, undefined);
      },
    });
  };

  return (
    <div className="schemaCustomizationMode" data-test-id="schema-customization-mode">
      <div className="schemaCustomizationToolbar" data-test-id="schema-customization-toolbar">
        <span>结构编辑模式</span>
        <Dropdown menu={{ items: addItems, onClick: ({ key }) => setAddDraft({ kind: key as AddNodeDraft["kind"] }) }}>
          <Button size="small" icon={<Plus size={14} />}>新增节点</Button>
        </Dropdown>
        <Button size="small" disabled={!selected} danger icon={<Trash2 size={14} />} onClick={() => selected ? confirmDeleteNode(selected.node.id) : undefined}>删除节点</Button>
        <Button size="small" disabled={missingBuiltinNodes.length === 0} icon={<RotateCcw size={14} />} onClick={() => setRecoverOpen(true)}>找回内置节点</Button>
        <Button size="small" icon={<Code2 size={14} />} onClick={() => void openTableSource()}>完整 Table 源码</Button>
        <Tooltip title="删除当前 Table override，Field Bundle 自定义保持不变">
          <Button size="small" onClick={() => impactConfirm(
            "还原整张 Table？",
            "布局、顺序和全部自定义节点将恢复为当前编辑器内置版本。",
            async () => saveUi(definition.uiSource, "还原整张 Table"),
          )}>还原整张 Table</Button>
        </Tooltip>
      </div>
      <SchemaTable
        {...props}
        fieldSchemas={resolution.fieldSchemas}
        uiSchema={resolution.uiSchema}
        customization={{
          selectedNodeId: state.selectedNodeId,
          onSelect: (nodeId) => selectSchemaCustomizationNode(definition.uiSchema.schemaId, nodeId),
          onMove: (source, target, placement) => {
            void saveUi(moveNode(resolution.uiSource, source, target, placement), `移动 Schema 节点 ${source}`)
              .catch(notifyError);
          },
          onDelete: confirmDeleteNode,
        }}
      />
      <NodeDrawer
        definition={definition}
        resolution={resolution}
        selectedNodeId={state.selectedNodeId}
        onSelect={(nodeId) => selectSchemaCustomizationNode(definition.uiSchema.schemaId, nodeId)}
      />
      <Modal
        open={Boolean(addDraft)}
        title={`新增 ${addDraft?.kind ?? "Schema"} 节点`}
        okText="新增并保存"
        cancelText="取消"
        onOk={() => void addNode().catch(notifyError)}
        onCancel={() => setAddDraft(undefined)}
      >
        {addDraft?.kind === "field" ? (
          <Space direction="vertical" style={{ width: "100%" }}>
            <Select
              showSearch
              style={{ width: "100%" }}
              placeholder="Field Schema"
              value={addDraft.fieldSchema}
              options={[...resolution.fieldSchemas.entries()].map(([id, field]) => ({ value: id, label: `${id} · ${field.title}` }))}
              onChange={(fieldSchema) => setAddDraft({ ...addDraft, fieldSchema })}
            />
            <Input placeholder="source，例如 floor:title" value={addDraft.source} onChange={(event) => setAddDraft({ ...addDraft, source: event.target.value })} />
          </Space>
        ) : null}
        {addDraft?.kind === "group" ? <Input placeholder="分组名称" value={addDraft.label} onChange={(event) => setAddDraft({ ...addDraft, label: event.target.value })} /> : null}
        {addDraft?.kind === "rest" ? (
          <Space direction="vertical" style={{ width: "100%" }}>
            <Input placeholder="显示名称" value={addDraft.label} onChange={(event) => setAddDraft({ ...addDraft, label: event.target.value })} />
            <Input placeholder={`path，例如 ${defaultRootRef}`} value={addDraft.path} onChange={(event) => setAddDraft({ ...addDraft, path: event.target.value })} />
          </Space>
        ) : null}
      </Modal>
      <Modal
        open={recoverOpen}
        title="找回已删除的内置节点"
        okText="找回并保存"
        cancelText="取消"
        okButtonProps={{ disabled: !recoverId }}
        onOk={() => {
          if (!recoverId) return;
          void saveUi(recoverBuiltinNode(resolution.uiSource, definition.uiSource, recoverId), `找回内置节点 ${recoverId}`).then(() => {
            setRecoverOpen(false);
            selectSchemaCustomizationNode(definition.uiSchema.schemaId, recoverId);
          }).catch(notifyError);
        }}
        onCancel={() => setRecoverOpen(false)}
      >
        <Select
          style={{ width: "100%" }}
          placeholder="选择内置节点"
          value={recoverId}
          options={missingBuiltinNodes.map(({ node }) => ({ value: node.id, label: `${node.id} · ${node.kind === "field" ? node.fieldSchema : node.label}` }))}
          onChange={setRecoverId}
        />
      </Modal>
    </div>
  );
};
