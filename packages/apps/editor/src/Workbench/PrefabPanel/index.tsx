/**
 * PrefabPanel - 图块属性编辑面板
 *
 * 使用 Suspense 架构，数据状态由 ContentBoundary 统一处理
 * 业务组件只写"数据已就绪"的逻辑
 */

import { useCallback, useMemo, useState, type FC } from 'react';
import { Alert, Button, Dropdown, Input, Modal, Radio, Tooltip } from 'antd';
import { ClipboardPaste, Copy, Ellipsis, ImagePlus, RotateCcw, Trash2 } from 'lucide-react';
import { ContentLeftTab } from '../components/ContentLeftTab';
import {
  ContentValueSource,
  ObjectReferenceRoot,
  ProjectSchemaTable,
  RegistryReferenceRoot,
  SchemaCustomizationButton,
  type ReferenceUpdate,
  type SchemaScope,
  type ValueSource,
} from '@/components/SchemaTable';
import {
  enemySchemaDefinition,
  itemSchemaDefinition,
  mapBlockSchemaDefinition,
} from '@/components/SchemaTable/builtinSchemas';
import { useResourceSuspense } from '@/hooks/suspense';
import { materialCommands, prefabCommands } from '@/project/commands';
import { projectModel } from '@/project/model/projectModel';
import { buildFieldPath } from '@/utils/fieldPath';
import { notifyCommandResult, notifyError, notifySuccess } from '@/utils/notify';
import { type PrefabInfo } from '@/services/prefab';
import { PanelStore } from '@/stores/PanelStore';
import { setAppendPicTemplate } from '@/stores/appendPicState';
import { setCurrentPrefabSelection, useCurrentPrefabSelection } from '@/stores/prefabState';
import { getPrefabItemData, resolvePrefabTarget, type PrefabTarget } from '@/project/model/prefabModel';
import type { Action } from '@/utils/action';
import {
  parsePrefabClipboard,
  serializePrefabClipboard,
  type PrefabClipboardData,
  type PrefabPasteMode,
  type PrefabPastePreview,
} from '@/project/commands/prefabCommands';

async function removeMaterialWithConfirmation(info: PrefabInfo): Promise<boolean> {
  const result = await materialCommands.remove(info);
  if (!result.ok && result.canForce && result.usages?.length) {
    const sample = result.usages
      .slice(0, 3)
      .map((usage) => `${usage.floorId} ${usage.layer}[${usage.x},${usage.y}]`)
      .join('\n');
    const force = confirm(
      `该素材仍在 ${result.usages.length} 个地图位置使用：\n${sample}\n\n仍要强制删除并保留这些失效数字吗？`,
    );
    if (!force) {
      notifyError(result.error);
      return false;
    }
    const forced = await materialCommands.remove(info, { force: true });
    if (!notifyCommandResult(forced, '删除此素材成功！')) return false;
  } else if (!notifyCommandResult(result, '删除此素材成功！')) {
    return false;
  }
  setCurrentPrefabSelection(null);
  alert('删除此素材成功！');
  return true;
}

// ==================== 未注册图块区域 ====================

interface NewIdIdnumSectionProps {
  info: PrefabInfo;
}

const NewIdIdnumSection: FC<NewIdIdnumSectionProps> = ({ info }) => {
  const [newId, setNewId] = useState('');
  const [newIdnum, setNewIdnum] = useState('');

  const handleAddIdIdnum = useCallback(async () => {
    if (newId && newIdnum) {
      const id = newId;
      const idnum = parseInt(newIdnum);
      if (Number.isNaN(idnum)) {
        notifyError('不合法的idnum');
        return;
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(id)) {
        notifyError('不合法的id，请使用字母、数字或下划线，且不能以数字开头');
        return;
      }
      if (id === 'hero' || id === 'this' || id === 'none' || id === 'airwall') {
        notifyError('不得使用保留关键字作为id！');
        return;
      }
      if (projectModel.hasStatusBarIcon(id)) {
        alert('警告！此ID在状态栏图标中被注册；仍然允许使用，但是\\i[]等绘制可能出现冲突。');
      }
      const result = await materialCommands.changeIdAndIdnum(id, idnum, info);
      notifyCommandResult(result, '添加id和idnum成功');
    } else {
      notifyError('请输入id和idnum');
    }
  }, [newId, newIdnum, info]);

  const handleAutoRegister = useCallback(async () => {
    const bindFaceIds =
      (info.images === 'npc48' || info.images === 'enemy48') &&
      confirm('你想绑定图块的朝向么？\n如果是，则会将最后四个注册图块的faceIds进行自动绑定。');
    const result = await materialCommands.register(info, { bindFaceIds });
    notifyCommandResult(result, '该列所有剩余项全部自动注册成功');
  }, [info]);

  return (
    <div id="newIdIdnum">
      <input placeholder="新id（唯一标识符）" value={newId} onChange={(e) => setNewId(e.target.value)} />
      <input placeholder="新idnum（10000以内数字）" value={newIdnum} onChange={(e) => setNewIdnum(e.target.value)} />
      <button onClick={handleAddIdIdnum}>确定</button>
      <br />
      <button onClick={handleAutoRegister} style={{ marginTop: 10 }}>
        自动注册
      </button>
    </div>
  );
};

// ==================== 图块属性表格区域 ====================

function prefabLabel(type: PrefabTarget['type']): string {
  if (type === 'enemy') return '怪物';
  if (type === 'item') return '道具';
  return '图块';
}

function briefJson(value: unknown): string {
  const text = JSON.stringify(value);
  if (text == null) return '未设置';
  return text.length > 100 ? `${text.slice(0, 97)}...` : text;
}

interface PasteDialogState {
  clipboard: PrefabClipboardData;
  mode: PrefabPasteMode;
  preview: PrefabPastePreview;
}

const PropertyChangeList: FC<{ preview: PrefabPastePreview }> = ({ preview }) => (
  <div data-test-id="prefab-property-change-list" style={{ maxHeight: 280, overflow: 'auto' }}>
    {preview.changes.length === 0 ? <Alert type="info" showIcon message="粘贴后属性不会发生变化" /> : null}
    {preview.changes.map((change) => (
      <div
        key={change.key}
        style={{ display: 'grid', gridTemplateColumns: '100px 52px minmax(0, 1fr)', gap: 8, padding: '6px 0' }}
      >
        <code>{change.key}</code>
        <span>{change.kind === 'add' ? '新增' : change.kind === 'delete' ? '删除' : '修改'}</span>
        <span title={`${briefJson(change.before)} → ${briefJson(change.after)}`}>
          {change.kind === 'add'
            ? briefJson(change.after)
            : change.kind === 'delete'
              ? briefJson(change.before)
              : `${briefJson(change.before)} → ${briefJson(change.after)}`}
        </span>
      </div>
    ))}
  </div>
);

const PrefabPropertyActions: FC<{ target: PrefabTarget }> = ({ target }) => {
  const [allData] = useResourceSuspense(target.resource);
  const data = allData as Record<string, unknown>;
  const [paste, setPaste] = useState<PasteDialogState | null>(null);
  const [resetPreview, setResetPreview] = useState<PrefabPastePreview | null>(null);
  const [batchResetOpen, setBatchResetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const batchIds = prefabCommands.batchResetIds(target.info, data);
  const label = prefabLabel(target.type);

  const copyProperties = async () => {
    const result = prefabCommands.getClipboardData(target.info, data);
    if (!result.ok || !result.data) {
      notifyCommandResult(result, '');
      return;
    }
    try {
      await navigator.clipboard.writeText(serializePrefabClipboard(result.data));
      notifySuccess(`${label}属性已复制到剪贴板`);
    } catch (error) {
      notifyError(error);
    }
  };

  const openPaste = async () => {
    try {
      const clipboard = parsePrefabClipboard(await navigator.clipboard.readText());
      const mode: PrefabPasteMode = 'replace';
      setPaste({ clipboard, mode, preview: prefabCommands.previewPaste(target.info, clipboard, data, mode) });
    } catch (error) {
      notifyError(error);
    }
  };

  const changePasteMode = (mode: PrefabPasteMode) => {
    if (!paste) return;
    setPaste({
      ...paste,
      mode,
      preview: prefabCommands.previewPaste(target.info, paste.clipboard, data, mode),
    });
  };

  const confirmPaste = async () => {
    if (!paste) return;
    setSaving(true);
    try {
      const result = await prefabCommands.pasteFromClipboard(target.info, paste.clipboard, data, paste.mode);
      if (notifyCommandResult(result, `${label}属性粘贴成功`)) setPaste(null);
    } finally {
      setSaving(false);
    }
  };

  const openReset = () => {
    try {
      setResetPreview(prefabCommands.previewReset(target.info, data));
    } catch (error) {
      notifyError(error);
    }
  };

  const confirmReset = async () => {
    setSaving(true);
    try {
      const result = await prefabCommands.reset(target.info, data);
      if (notifyCommandResult(result, `${label}属性已重置`)) setResetPreview(null);
    } finally {
      setSaving(false);
    }
  };

  const confirmBatchReset = async () => {
    setSaving(true);
    try {
      const result = await prefabCommands.resetAll(target.info, data);
      if (notifyCommandResult(result, `已批量重置 ${batchIds.length} 个${label}`)) setBatchResetOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
        <Tooltip title={`复制${label}的原始属性`}>
          <Button
            size="small"
            data-test-id="prefab-copy-properties"
            icon={<Copy size={14} />}
            onClick={() => void copyProperties()}
          >
            复制
          </Button>
        </Tooltip>
        <Tooltip title="读取剪贴板并预览属性变化">
          <Button
            size="small"
            data-test-id="prefab-paste-properties"
            icon={<ClipboardPaste size={14} />}
            onClick={() => void openPaste()}
          >
            粘贴
          </Button>
        </Tooltip>
        <Tooltip title="恢复基础属性，可通过撤销找回">
          <Button
            size="small"
            data-test-id="prefab-reset-properties"
            icon={<RotateCcw size={14} />}
            onClick={openReset}
          >
            重置
          </Button>
        </Tooltip>
        {target.type !== 'mapBlock' ? (
          <Dropdown
            trigger={['click']}
            menu={{
              items: [{ key: 'batch-reset', danger: true, label: '批量重置属性', disabled: batchIds.length === 0 }],
              onClick: () => setBatchResetOpen(true),
            }}
          >
            <Button
              type="text"
              size="small"
              aria-label="更多属性操作"
              data-test-id="prefab-property-more"
              icon={<Ellipsis size={14} />}
            />
          </Dropdown>
        ) : null}
      </span>

      <Modal
        title={`粘贴${label}属性`}
        open={paste != null}
        width={720}
        okText="确认粘贴"
        cancelText="取消"
        confirmLoading={saving}
        okButtonProps={{ disabled: paste?.preview.changes.length === 0, 'data-test-id': 'prefab-paste-confirm' }}
        onCancel={() => !saving && setPaste(null)}
        onOk={() => void confirmPaste()}
        destroyOnHidden
      >
        {paste ? (
          <>
            <Alert
              type="info"
              showIcon
              message={`来源：${paste.clipboard.source.name ?? paste.clipboard.source.id}`}
              description={`固定保留目标字段：${paste.preview.preservedKeys.join('、')}`}
              style={{ marginBottom: 12 }}
            />
            <Radio.Group
              data-test-id="prefab-paste-mode"
              value={paste.mode}
              onChange={(event) => changePasteMode(event.target.value as PrefabPasteMode)}
              style={{ marginBottom: 12 }}
            >
              <Radio.Button value="replace">覆盖属性</Radio.Button>
              <Radio.Button value="merge">合并属性</Radio.Button>
            </Radio.Group>
            <PropertyChangeList preview={paste.preview} />
          </>
        ) : null}
      </Modal>

      <Modal
        title={`重置${label}属性`}
        open={resetPreview != null}
        okText="确认重置"
        cancelText="取消"
        confirmLoading={saving}
        okButtonProps={{
          danger: true,
          disabled: resetPreview?.changes.length === 0,
          'data-test-id': 'prefab-reset-confirm',
        }}
        onCancel={() => !saving && setResetPreview(null)}
        onOk={() => void confirmReset()}
        destroyOnHidden
      >
        <Alert
          type="warning"
          showIcon
          message="未保留的字段将恢复为基础值或被删除；本操作可以撤销。"
          style={{ marginBottom: 12 }}
        />
        {resetPreview ? <PropertyChangeList preview={resetPreview} /> : null}
      </Modal>

      <Modal
        title={`批量重置${label}属性`}
        open={batchResetOpen}
        okText={`重置 ${batchIds.length} 项`}
        cancelText="取消"
        confirmLoading={saving}
        okButtonProps={{ danger: true, disabled: batchIds.length === 0, 'data-test-id': 'prefab-batch-reset-confirm' }}
        onCancel={() => !saving && setBatchResetOpen(false)}
        onOk={() => void confirmBatchReset()}
        destroyOnHidden
      >
        <Alert
          type="warning"
          showIcon
          message={
            target.type === 'enemy'
              ? `将重置全部 ${batchIds.length} 个怪物。`
              : `将重置 ${batchIds.length} 个自动注册且未修改 ID 的道具。`
          }
          description="该操作作为一条历史记录提交，可以整体撤销。"
        />
      </Modal>
    </>
  );
};

const MapBlockSchemaSection: FC<{ target: PrefabTarget; onRename: () => void }> = ({ target, onRename }) => {
  const [allData] = useResourceSuspense(target.resource);
  const itemData = useMemo(() => getPrefabItemData(allData as Record<string, unknown>, target), [allData, target]);
  const schemaData = useMemo<Record<string, unknown>>(
    () => ({
      ...(itemData ?? {}),
      id: itemData?.id ?? target.displayId,
      idnum: itemData?.idnum ?? Number(target.dataKey),
    }),
    [itemData, target.dataKey, target.displayId],
  );
  const imageResource = useMemo(() => projectModel.projectImageCatalog(), []);
  const imageSource = useMemo(
    () =>
      new ContentValueSource(
        'project:materials.images',
        () => imageResource.snapshot(),
        (listener) => imageResource.subscribe(() => listener()),
        () => imageResource.ensureLoaded(),
        () => imageResource.reload(),
      ),
    [imageResource],
  );
  const scope = useMemo<SchemaScope>(() => {
    const writePrefabBatch = async (updates: readonly ReferenceUpdate[]) => {
      const actions: Action[] = updates.map(({ path, slot }) => {
        if (path.length === 0) throw new Error('不能直接替换整个图块对象');
        return slot.present
          ? ['change', buildFieldPath([...path]), slot.value]
          : ['delete', buildFieldPath([...path]), undefined];
      });
      if (actions.length === 0) return;
      const result = await prefabCommands.patch(target.info, actions);
      if (!result.ok) throw new Error(`${result.stage}: ${result.error.message}`);
      notifySuccess('保存成功！');
    };
    const writePrefab = (path: readonly string[], slot: ReferenceUpdate['slot']) => writePrefabBatch([{ path, slot }]);
    return {
      roots: {
        prefab: new ObjectReferenceRoot('prefab', () => schemaData, writePrefab, writePrefabBatch),
        params: new ObjectReferenceRoot('params', () => ({ prefabIdnum: Number(target.dataKey) })),
        project: new RegistryReferenceRoot(new Map([['materials.images', imageSource]])),
      },
    };
  }, [imageSource, schemaData, target.dataKey, target.info]);
  const fieldActions = useMemo(
    () =>
      new Map([
        [
          'prefab:id',
          <button key="rename" type="button" data-test-id="prefab-rename-open" onClick={onRename}>
            修改
          </button>,
        ],
      ]),
    [onRename],
  );

  if (!itemData) return <div>无数据</div>;
  return <ProjectSchemaTable definition={mapBlockSchemaDefinition} scope={scope} fieldActions={fieldActions} />;
};

const ItemSchemaSection: FC<{ target: PrefabTarget; onRename: () => void }> = ({ target, onRename }) => {
  const [allData] = useResourceSuspense(target.resource);
  const itemData = useMemo(() => getPrefabItemData(allData as Record<string, unknown>, target), [allData, target]);
  const schemaData = useMemo<Record<string, unknown>>(
    () => ({
      ...(itemData ?? {}),
      id: target.displayId,
    }),
    [itemData, target.displayId],
  );
  const scope = useMemo<SchemaScope>(() => {
    const writeItem = async (path: readonly string[], slot: ReferenceUpdate['slot']) => {
      if (path.length === 0) throw new Error('不能直接替换整个道具对象');
      const action: Action = slot.present
        ? ['change', buildFieldPath([...path]), slot.value]
        : ['delete', buildFieldPath([...path]), undefined];
      const result = await prefabCommands.patch(target.info, [action]);
      if (!result.ok) throw new Error(`${result.stage}: ${result.error.message}`);
      notifySuccess('保存成功！');
    };
    return {
      roots: {
        prefab: new ObjectReferenceRoot('prefab', () => schemaData, writeItem),
      },
    };
  }, [schemaData, target.info]);
  const fieldActions = useMemo(
    () =>
      new Map([
        [
          'prefab:id',
          <button key="rename" type="button" data-test-id="prefab-rename-open" onClick={onRename}>
            修改
          </button>,
        ],
      ]),
    [onRename],
  );

  if (!itemData) return <div>无数据</div>;
  return <ProjectSchemaTable definition={itemSchemaDefinition} scope={scope} fieldActions={fieldActions} />;
};

function enemyHasSpecial(raw: unknown, expected: unknown): boolean {
  if (typeof expected !== 'number' && typeof expected !== 'string') return false;
  if (Array.isArray(raw)) return raw.some((item) => Object.is(item, expected));
  return Object.is(raw, expected);
}

function enemyHasAnySpecial(raw: unknown): boolean {
  if (Array.isArray(raw)) return raw.length > 0;
  return raw !== 0 && raw != null;
}

const EnemySchemaSection: FC<{ target: PrefabTarget; onRename: () => void }> = ({ target, onRename }) => {
  const [allData] = useResourceSuspense(target.resource);
  const itemData = useMemo(() => getPrefabItemData(allData as Record<string, unknown>, target), [allData, target]);
  const schemaData = useMemo<Record<string, unknown>>(
    () => ({
      ...(itemData ?? {}),
      id: target.displayId,
    }),
    [itemData, target.displayId],
  );
  const specialResource = useMemo(() => projectModel.enemySpecialCatalog(), []);
  const imageResource = useMemo(() => projectModel.projectImageCatalog(), []);
  const specialSource = useMemo(
    () =>
      new ContentValueSource(
        'project:enemySpecials',
        () => specialResource.snapshot(),
        (listener) => specialResource.subscribe(() => listener()),
        () => specialResource.ensureLoaded(),
        () => specialResource.reload(),
      ),
    [specialResource],
  );
  const imageSource = useMemo(
    () =>
      new ContentValueSource(
        'project:materials.images',
        () => imageResource.snapshot(),
        (listener) => imageResource.subscribe(() => listener()),
        () => imageResource.ensureLoaded(),
        () => imageResource.reload(),
      ),
    [imageResource],
  );
  const scope = useMemo<SchemaScope>(() => {
    const writeEnemy = async (path: readonly string[], slot: ReferenceUpdate['slot']) => {
      if (path.length === 0) throw new Error('不能直接替换整个怪物对象');
      const action: Action = slot.present
        ? ['change', buildFieldPath([...path]), slot.value]
        : ['delete', buildFieldPath([...path]), undefined];
      const result = await prefabCommands.patch(target.info, [action]);
      if (!result.ok) throw new Error(`${result.stage}: ${result.error.message}`);
      notifySuccess('保存成功！');
    };
    const registry = new Map<string, ValueSource<unknown>>([
      ['enemySpecials', specialSource],
      ['materials.images', imageSource],
    ]);
    return {
      roots: {
        prefab: new ObjectReferenceRoot('prefab', () => schemaData, writeEnemy),
        project: new RegistryReferenceRoot(registry),
      },
      calls: {
        'enemy.hasSpecial': enemyHasSpecial,
        'enemy.hasAnySpecial': enemyHasAnySpecial,
      },
    };
  }, [imageSource, schemaData, specialSource, target.info]);
  const fieldActions = useMemo(
    () =>
      new Map([
        [
          'prefab:id',
          <button key="rename" type="button" data-test-id="prefab-rename-open" onClick={onRename}>
            修改
          </button>,
        ],
      ]),
    [onRename],
  );

  if (!itemData) return <div>无数据</div>;
  return <ProjectSchemaTable definition={enemySchemaDefinition} scope={scope} fieldActions={fieldActions} />;
};

// ==================== 主内容组件 ====================

interface PrefabPanelContentProps {
  onRename: () => void;
}

const PrefabPanelContent: FC<PrefabPanelContentProps> = ({ onRename }) => {
  const selection = useCurrentPrefabSelection();
  const info = selection?.info ?? null;
  const target = useMemo(() => resolvePrefabTarget(info), [info]);

  // 如果没有选中图块，显示空状态
  if (!info || Object.keys(info).length === 0) {
    return <div data-test-id="prefab-empty-state">请选择一个图块</div>;
  }

  // 如果没有 id，显示新建区域
  if (target && !target.registered) {
    return <NewIdIdnumSection info={info} />;
  }

  if (!target) {
    return <div>无法加载数据</div>;
  }

  // 否则显示编辑区域
  if (target.type === 'mapBlock') return <MapBlockSchemaSection target={target} onRename={onRename} />;
  if (target.type === 'item') return <ItemSchemaSection target={target} onRename={onRename} />;
  return <EnemySchemaSection target={target} onRename={onRename} />;
};

// ==================== 面板组件 ====================

/**
 * PrefabPanel - 面板组件
 *
 * 负责布局和 actions，不直接依赖数据
 * actions 始终显示，不受数据加载状态影响
 */
export const PrefabPanel: FC = () => {
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);
  const selection = useCurrentPrefabSelection();
  const info = selection?.info;
  const target = useMemo(() => resolvePrefabTarget(info), [info]);
  const schemaDefinition =
    target?.type === 'mapBlock'
      ? mapBlockSchemaDefinition
      : target?.type === 'item'
        ? itemSchemaDefinition
        : target?.type === 'enemy'
          ? enemySchemaDefinition
          : undefined;
  const { setActivePanel } = PanelStore.useStore();

  const openRename = useCallback(() => {
    if (!info?.id) return;
    if (info.images === 'autotile') {
      notifyError('自动元件不可修改 ID！');
      return;
    }
    if (info.idnum !== undefined && info.idnum >= 10000) {
      notifyError('额外素材不可修改 ID！');
      return;
    }
    setRenameValue(info.id);
    setRenameOpen(true);
  }, [info]);

  const closeRename = useCallback(() => {
    if (!renameSaving) setRenameOpen(false);
  }, [renameSaving]);

  const handleRename = useCallback(async () => {
    if (!info?.id || !selection) return;
    const id = renameValue.trim();
    if (!id) {
      notifyError('请输入要修改到的 ID');
      return;
    }
    if (id === info.id) {
      setRenameOpen(false);
      return;
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(id)) {
      notifyError('不合法的 ID，请使用字母、数字或下划线，且不能以数字开头');
      return;
    }
    if (id === 'hero' || id === 'this' || id === 'none' || id === 'airwall') {
      notifyError('不得使用保留关键字作为 ID！');
      return;
    }
    if (projectModel.hasStatusBarIcon(id)) {
      alert('警告！此 ID 在状态栏图标中被注册；仍然允许使用，但是\\i[]等绘制可能出现冲突。');
    }

    setRenameSaving(true);
    try {
      const result = await materialCommands.changeIdAndIdnum(id, null, info);
      if (notifyCommandResult(result, '修改图块 ID 成功')) {
        setCurrentPrefabSelection({ ...selection, info: { ...info, id } });
        setRenameOpen(false);
      }
    } finally {
      setRenameSaving(false);
    }
  }, [info, renameValue, selection]);

  const handleRemoveMaterial = useCallback(async () => {
    if (!info) return;
    if (info.isTile) {
      notifyError('额外素材不可删除！');
      return;
    }
    if (!confirm('警告！你确定要删除此素材吗？此过程不可逆！')) return;
    await removeMaterialWithConfirmation(info);
  }, [info]);

  const handleAppendMaterial = useCallback(() => {
    if (!info) return;
    if (info.isTile) {
      notifyError('额外素材不支持此功能！');
      return;
    }
    setAppendPicTemplate(info);
    setActivePanel('appendpic');
  }, [info, setActivePanel]);

  // 操作按钮区域（始终显示）
  const actions = (
    <>
      {target?.registered ? <PrefabPropertyActions target={target} /> : null}
      {info ? (
        <>
          {target?.registered ? <>&nbsp;</> : null}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
            <Tooltip title="以当前素材为模板追加">
              <Button
                size="small"
                aria-label="追加素材"
                data-test-id="prefab-append"
                icon={<ImagePlus size={14} />}
                onClick={handleAppendMaterial}
              >
                追加
              </Button>
            </Tooltip>
            <Tooltip title="删除当前素材">
              <Button
                danger
                size="small"
                aria-label="删除素材"
                data-test-id={target?.registered ? 'prefab-remove-registered' : 'prefab-remove-unregistered'}
                icon={<Trash2 size={14} />}
                onClick={() => void handleRemoveMaterial()}
              >
                删除
              </Button>
            </Tooltip>
          </span>
        </>
      ) : null}
      {schemaDefinition ? <SchemaCustomizationButton definition={schemaDefinition} /> : null}
    </>
  );

  return (
    <>
      <ContentLeftTab id="left3" testId="panel-prefab" title="图块属性" actions={actions}>
        <PrefabPanelContent onRename={openRename} />
      </ContentLeftTab>
      <Modal
        title="修改图块 ID"
        open={renameOpen}
        okText="确定"
        cancelText="取消"
        confirmLoading={renameSaving}
        onCancel={closeRename}
        onOk={() => void handleRename()}
        okButtonProps={{ 'data-test-id': 'prefab-rename-submit' }}
        destroyOnHidden
      >
        <Input
          autoFocus
          aria-label="新的图块 ID"
          data-test-id="prefab-rename-input"
          value={renameValue}
          onChange={(event) => setRenameValue(event.target.value)}
          onPressEnter={() => void handleRename()}
        />
      </Modal>
    </>
  );
};
