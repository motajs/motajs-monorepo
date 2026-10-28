import { createElement, ReactElement, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { ContentSaveStatus, IEditableContentHandle } from '../../shared/editable/types';
import { TableGrid, TablePanelStatus } from '../../shared/schemaForm/components/TableGrid';
import { buildSchemaTree } from '../../shared/schemaForm/model/schemaPresentation';
import { buildTableTree } from '../../shared/schemaForm/model/traversal';
import { ITableRowNode } from '../../shared/schemaForm/types';
import { ITableDocument, ITableEdit, ITableEditableProps, TableEditKind } from '../types';

// 表格每栏的可编辑组件：面板只分配内容与版本号，组件在挂载期间持有草稿并自己算行树（D-02 / D-39）。
// 组件不接收任何文件路径、不主动读文件，保存请求只经 props.onSave 发出（D-01 / D-04）。

/**
 * 判断一个值是否为普通对象：只用于判定「该栏有没有 schema」，决定空表落空态还是无 schema 态
 * @param value 待判断的值
 * @returns 是普通对象时为 true
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 按文档是否为 schema 视图算出呈现行树：schema 视图用 schema 树，数据视图用数据树
 * @param document 组件当前持有的文档
 * @returns 行树
 */
function buildRows(document: ITableDocument): readonly ITableRowNode[] {
  return document.schemaMode ? buildSchemaTree(document.data) : buildTableTree(document.schema, document.data);
}

/**
 * 在行树中按字段路径查找一个行节点，供编辑时取出该字段的行内配置
 * @param rows 行树节点列表
 * @param key 字段路径
 * @returns 命中的行节点；未命中时为 undefined
 */
function findRow(rows: readonly ITableRowNode[], key: string): ITableRowNode | undefined {
  for (const row of rows) {
    if (row.key === key) return row;

    const children = row.children;

    if (children === undefined) continue;

    const found = findRow(children, key);

    if (found !== undefined) return found;
  }

  return undefined;
}

/**
 * 把面板给的展示状态换算成本组件按自己草稿判定的状态
 *
 * 加载 / 错误原样透传；就绪 / 空 / 无 schema 三种按本组件算出的行树重新落定，
 * 保证本地编辑后状态与草稿一致，而不是等面板重发布。
 * @param status 面板发布的状态
 * @param rows 本组件算出的行树
 * @param document 本组件当前持有的文档
 * @returns 要交给表格网格的状态
 */
function resolveStatus(
  status: TablePanelStatus,
  rows: readonly ITableRowNode[],
  document: ITableDocument,
): TablePanelStatus {
  if (status === TablePanelStatus.Loading) return TablePanelStatus.Loading;
  if (status === TablePanelStatus.Error) return TablePanelStatus.Error;
  if (rows.length > 0) return TablePanelStatus.Ready;
  if (document.schemaMode) return TablePanelStatus.EmptySchema;

  return isRecord(document.schema) ? TablePanelStatus.Empty : TablePanelStatus.EmptySchema;
}

/**
 * 表格每栏的可编辑组件：持有草稿、自己算行树、用 ref 暴露四项能力、按版本号重置草稿
 *
 * 行树的唯一来源是本组件的草稿；面板不再发布行。只有 `contentVersion` 变化才采信 `content`
 * （引用变化不算），本地编辑因此不会被面板副本反复覆盖。脏标记同时镜像进 `dirtyRef`，
 * 使空依赖的 ref 句柄与卸载 cleanup 读到的都是**调用时刻**的值。
 * @param props 面板分配给本栏的内容、版本号、编辑落点与展示回调
 * @returns 表格网格元素
 */
export function EditableTable(props: ITableEditableProps): ReactElement {
  const draftRef = useRef<ITableDocument>(props.content);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const dirtyState = useState(false);
  const dirty = dirtyState[0];
  const setDirtyState = dirtyState[1];
  const savingState = useState(false);
  const saving = savingState[0];
  const setSavingState = savingState[1];

  const setDirty = (next: boolean): void => {
    dirtyRef.current = next;
    setDirtyState(next);
  };

  // 只认版本号：props.content 的引用在每次面板发布时都会换新，依赖引用会让本地草稿被反复覆盖（D-02 / §Q2.4）
  useEffect((): void => {
    draftRef.current = props.content;
    setDirty(false);
  }, [props.contentVersion]);

  // 句柄只建一次，四个方法一律读 ref 的当前值：闭包里读渲染态会被挂载首帧固定（D-03 / D-06）
  useImperativeHandle(
    props.ref,
    (): IEditableContentHandle<ITableDocument> => ({
      getData: (): ITableDocument => draftRef.current,
      setData: (next: ITableDocument): void => {
        draftRef.current = next;
        dirtyRef.current = false;
        setDirtyState(false);
      },
      isDirty: (): boolean => dirtyRef.current,
      markSaved: (): void => {
        dirtyRef.current = false;
        setDirtyState(false);
      },
    }),
    [],
  );

  // 只服务真正卸载的路径（关闭标签、不保存关闭、释放 core）：切标签的保存由面板在 onSwitchOut 里直接读 ref（B1）
  useLayoutEffect((): (() => void) => {
    return (): void => {
      props.onDraftChange?.(draftRef.current, dirtyRef.current);
    };
  }, [props.onDraftChange]);

  const draft = draftRef.current;
  const rows = buildRows(draft);
  const status = resolveStatus(props.status, rows, draft);

  const runEdit = (edit: ITableEdit): void => {
    const next = props.applyEdit(edit, draftRef.current);

    if (next === null) return;

    draftRef.current = next;
    setDirty(true);
    props.onDraftChange?.(next, true);
  };

  const handleChange = (key: string, value: unknown): void => {
    const row = findRow(rows, key);

    runEdit({ kind: TableEditKind.Change, key, value, config: row === undefined ? undefined : row.config });
  };

  const handleAdd = (anchorKey: string, name: string): void => {
    runEdit({ kind: TableEditKind.Add, key: anchorKey, anchorKey, name });
  };

  const handleDelete = (key: string): void => {
    runEdit({ kind: TableEditKind.Delete, key });
  };

  const handleSave = async (): Promise<void> => {
    const save = props.onSave;

    if (save === undefined) return;
    if (savingRef.current) return;

    savingRef.current = true;
    setSavingState(true);

    const result = await save(draftRef.current);

    if (result === ContentSaveStatus.Saved) setDirty(false);

    savingRef.current = false;
    setSavingState(false);
  };

  return createElement(TableGrid, {
    status,
    rows,
    message: props.message,
    error: props.error,
    schemaMode: draft.schemaMode,
    title: props.title,
    onRetry: props.onRetry,
    onChange: handleChange,
    onAdd: handleAdd,
    onDelete: handleDelete,
    onOpenSchema: props.onOpenSchema,
    onOpenInCodeEditor: props.onOpenInCodeEditor,
    onCloseColumn: props.onCloseColumn,
    unsaved: dirty,
    saving,
    onSave: handleSave,
  });
}
