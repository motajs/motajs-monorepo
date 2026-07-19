/**
 * PrefabPanel - 图块属性编辑面板
 *
 * 使用 Suspense 架构，数据状态由 ContentBoundary 统一处理
 * 业务组件只写"数据已就绪"的逻辑
 */

import { useCallback, useMemo, useState, type FC } from "react";
import { Button, Input, Modal, Segmented, Tooltip } from "antd";
import { ImagePlus, Pencil, Trash2 } from "lucide-react";
import { ContentLeftTab } from "../components/ContentLeftTab";
import {
  ContentValueSource,
  ObjectReferenceRoot,
  ProjectSchemaTable,
  RegistryReferenceRoot,
  SchemaCustomizationButton,
  type ReferenceUpdate,
  type SchemaScope,
  type ValueSource,
} from "@/components/SchemaTable";
import {
  enemySchemaDefinition,
  itemSchemaDefinition,
  mapBlockSchemaDefinition,
} from "@/components/SchemaTable/builtinSchemas";
import { Table, EditModeSegmented } from "@/components/Table";
import { useTableMetaSuspense } from "@/hooks";
import { useResourceSuspense } from "@/hooks/suspense";
import { materialCommands, prefabCommands } from "@/project/commands";
import { projectModel } from "@/project/model/projectModel";
import { buildFieldPath } from "@/utils/fieldPath";
import { notifyCommandResult, notifyError, notifySuccess } from "@/utils/notify";
import { type PrefabInfo } from "@/services/prefab";
import { PanelStore } from "@/stores/PanelStore";
import { setAppendPicTemplate } from "@/stores/appendPicState";
import { setCurrentPrefabSelection, useCurrentPrefabSelection } from "@/stores/prefabState";
import {
  canCopyPastePrefab,
  getPrefabComment,
  getPrefabItemData,
  resolvePrefabTarget,
  type PrefabTarget,
} from "@/project/model/prefabModel";
import type { Action } from "@/utils/action";
import type { EditMode, TableAction } from "@/components/Table/types";
import type { ClearPrefabTemplates, PrefabClipboardData } from "@/project/commands/prefabCommands";
import type { CommentObject } from "@/components/Table";

type PrefabTableVersion = "schema" | "legacy";

function getClearPrefabTemplates(meta: CommentObject): ClearPrefabTemplates {
  const metaData = (meta as { _data?: { enemys_template?: Record<string, unknown> } })._data;
  return {
    enemy: metaData?.enemys_template,
  };
}

async function removeMaterialWithConfirmation(info: PrefabInfo): Promise<boolean> {
  const result = await materialCommands.remove(info);
  if (!result.ok && result.canForce && result.usages?.length) {
    const sample = result.usages.slice(0, 3)
      .map((usage) => `${usage.floorId} ${usage.layer}[${usage.x},${usage.y}]`)
      .join("\n");
    const force = confirm(
      `该素材仍在 ${result.usages.length} 个地图位置使用：\n${sample}\n\n仍要强制删除并保留这些失效数字吗？`,
    );
    if (!force) {
      notifyError(result.error);
      return false;
    }
    const forced = await materialCommands.remove(info, { force: true });
    if (!notifyCommandResult(forced, "删除此素材成功！")) return false;
  } else if (!notifyCommandResult(result, "删除此素材成功！")) {
    return false;
  }
  setCurrentPrefabSelection(null);
  alert("删除此素材成功！");
  return true;
}

// ==================== 未注册图块区域 ====================

interface NewIdIdnumSectionProps {
  info: PrefabInfo;
}

const NewIdIdnumSection: FC<NewIdIdnumSectionProps> = ({ info }) => {
  const [newId, setNewId] = useState("");
  const [newIdnum, setNewIdnum] = useState("");

  const handleAddIdIdnum = useCallback(async () => {
    if (newId && newIdnum) {
      const id = newId;
      const idnum = parseInt(newIdnum);
      if (Number.isNaN(idnum)) {
        notifyError("不合法的idnum");
        return;
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(id)) {
        notifyError("不合法的id，请使用字母、数字或下划线，且不能以数字开头");
        return;
      }
      if (id === "hero" || id === "this" || id === "none" || id === "airwall") {
        notifyError("不得使用保留关键字作为id！");
        return;
      }
      if (projectModel.hasStatusBarIcon(id)) {
        alert(
          "警告！此ID在状态栏图标中被注册；仍然允许使用，但是\\i[]等绘制可能出现冲突。",
        );
      }
      const result = await materialCommands.changeIdAndIdnum(id, idnum, info);
      notifyCommandResult(result, "添加id和idnum成功");
    } else {
      notifyError("请输入id和idnum");
    }
  }, [newId, newIdnum, info]);

  const handleAutoRegister = useCallback(async () => {
    const bindFaceIds = (info.images === "npc48" || info.images === "enemy48")
      && confirm("你想绑定图块的朝向么？\n如果是，则会将最后四个注册图块的faceIds进行自动绑定。");
    const result = await materialCommands.register(info, { bindFaceIds });
    notifyCommandResult(result, "该列所有剩余项全部自动注册成功");
  }, [info]);

  return (
    <div id="newIdIdnum">
      <input
        placeholder="新id（唯一标识符）"
        value={newId}
        onChange={(e) => setNewId(e.target.value)}
      />
      <input
        placeholder="新idnum（10000以内数字）"
        value={newIdnum}
        onChange={(e) => setNewIdnum(e.target.value)}
      />
      <button onClick={handleAddIdIdnum}>确定</button>
      <br />
      <button onClick={handleAutoRegister} style={{ marginTop: 10 }}>
        自动注册
      </button>
    </div>
  );
};

// ==================== 图块属性表格区域 ====================

interface EnemyItemTableSectionProps {
  target: PrefabTarget;
  editMode: EditMode;
}

const EnemyItemTableSection: FC<EnemyItemTableSectionProps> = ({
  target,
  editMode,
}) => {
  const { info } = target;
  // 使用 Suspense hooks
  const [allData] = useResourceSuspense(target.resource);
  const meta = useTableMetaSuspense("comment");

  // 获取当前图块的数据项
  const itemData = useMemo(
    () => getPrefabItemData(allData as Record<string, unknown>, target),
    [allData, target],
  );

  // 获取对应的 commentObj
  const commentObj = useMemo(
    () => getPrefabComment(meta, target),
    [meta, target],
  );

  // 统一的变更处理 - 即时保存
  const handleChange = useCallback(
    async (action: TableAction) => {
      try {
        const result = await prefabCommands.patch(info, [action as Action]);
        notifyCommandResult(result, "保存成功！");
      } catch (err) {
        notifyError(err);
      }
    },
    [info],
  );

  // 复制/粘贴/清空功能
  // 剪贴板数据前缀，用于识别是否为编辑器数据
  const CLIPBOARD_PREFIX = "mota-prefab:";

  const handleCopyEnemyItem = useCallback(async () => {
    const result = prefabCommands.getClipboardData(info, allData as Record<string, unknown>);
    if (!result.ok || !result.data) {
      notifyCommandResult(result, "");
      return;
    }
    await navigator.clipboard.writeText(CLIPBOARD_PREFIX + JSON.stringify(result.data));
    notifySuccess(`${result.data.type === "enemy" ? "怪物" : "道具"}属性已复制到剪贴板`);
  }, [info, allData]);

  const handlePasteEnemyItem = useCallback(async () => {
    const prefabType = target.type;
    if (!prefabType || prefabType === "mapBlock") return;

    try {
      const text = await navigator.clipboard.readText();
      if (!text.startsWith(CLIPBOARD_PREFIX)) {
        notifyError("剪贴板内容不是有效的图块数据");
        return;
      }

      const clipboard = JSON.parse(text.slice(CLIPBOARD_PREFIX.length)) as PrefabClipboardData;
      if (clipboard.type !== prefabType) {
        notifyError(`类型不匹配：剪贴板中是${clipboard.type === "enemy" ? "怪物" : "道具"}数据`);
        return;
      }

      if (prefabType === "enemy") {
        if (!confirm("你确定要覆盖此怪物的全部属性么？这是个不可逆操作！")) return;
        const result = await prefabCommands.replaceFromClipboard(info, clipboard, allData as Record<string, unknown>);
        notifyCommandResult(result, "怪物属性粘贴成功");
      } else {
        if (!confirm("你确定要覆盖此道具的全部属性么？这是个不可逆操作！")) return;
        const result = await prefabCommands.replaceFromClipboard(info, clipboard, allData as Record<string, unknown>);
        notifyCommandResult(result, "道具属性粘贴成功");
      }
    } catch {
      notifyError("剪贴板内容解析失败");
    }
  }, [target, info, allData]);

  const handleClearEnemyItem = useCallback(async () => {
    const templates = getClearPrefabTemplates(meta);
    if (target.type === "enemy") {
      if (confirm("你确定要清空本怪物的全部属性么？这是个不可逆操作！")) {
        const result = await prefabCommands.clear(info, templates, allData as Record<string, unknown>);
        notifyCommandResult(result, "怪物属性清空成功");
      }
    } else if (target.type === "item") {
      if (confirm("你确定要清空本道具的全部属性么？这是个不可逆操作！")) {
        const result = await prefabCommands.clear(info, templates, allData as Record<string, unknown>);
        notifyCommandResult(result, "道具属性清空成功");
      }
    }
  }, [target, info, meta, allData]);

  const handleClearAllEnemyItem = useCallback(async () => {
    const templates = getClearPrefabTemplates(meta);
    if (target.type === "enemy") {
      if (
        confirm(
          "你确定要批量清空【全塔怪物】的全部属性么？这是个不可逆操作！",
        )
      ) {
        const result = await prefabCommands.clearAll(info, templates, allData as Record<string, unknown>);
        notifyCommandResult(result, "全塔全部怪物属性清空成功！");
      }
    } else if (target.type === "item") {
      if (
        confirm(
          "你确定要批量清空【全塔所有自动注册且未修改ID的道具】的全部属性么？这是个不可逆操作！",
        )
      ) {
        const result = await prefabCommands.clearAll(info, templates, allData as Record<string, unknown>);
        notifyCommandResult(result, "全塔全部道具属性清空成功！");
      }
    }
  }, [target, info, meta, allData]);

  // 显示复制/粘贴按钮（仅对 enemy 和 item 类型）
  const showCopyPasteButtons = canCopyPastePrefab(target);

  if (!itemData || !commentObj) {
    return <div>无数据</div>;
  }

  return (
    <div id="enemyItemTable">
      <Table
        data={itemData}
        commentObj={commentObj}
        onChange={handleChange}
        editMode={editMode}
      />
      {showCopyPasteButtons && (
        <div style={{ marginTop: "-10px", marginBottom: 10 }}>
          <button id="copyEnemyItem" onClick={handleCopyEnemyItem}>
            复制属性
          </button>
          <button id="pasteEnemyItem" onClick={handlePasteEnemyItem}>
            粘贴属性
          </button>
          <button id="clearEnemyItem" onClick={handleClearEnemyItem}>
            清空属性
          </button>
          <button id="clearAllEnemyItem" onClick={handleClearAllEnemyItem}>
            批量清空属性
          </button>
        </div>
      )}
    </div>
  );
};

const MapBlockSchemaSection: FC<{ target: PrefabTarget; onRename: () => void }> = ({ target, onRename }) => {
  const [allData] = useResourceSuspense(target.resource);
  const itemData = useMemo(
    () => getPrefabItemData(allData as Record<string, unknown>, target),
    [allData, target],
  );
  const schemaData = useMemo<Record<string, unknown>>(() => ({
    ...(itemData ?? {}),
    id: itemData?.id ?? target.displayId,
    idnum: itemData?.idnum ?? Number(target.dataKey),
  }), [itemData, target.dataKey, target.displayId]);
  const imageResource = useMemo(() => projectModel.projectImageCatalog(), []);
  const imageSource = useMemo(() => new ContentValueSource(
    "project:materials.images",
    () => imageResource.snapshot(),
    (listener) => imageResource.subscribe(() => listener()),
    () => imageResource.reload(),
  ), [imageResource]);
  const scope = useMemo<SchemaScope>(() => {
    const writePrefabBatch = async (updates: readonly ReferenceUpdate[]) => {
      const actions: Action[] = updates.map(({ path, slot }) => {
        if (path.length === 0) throw new Error("不能直接替换整个图块对象");
        return slot.present
          ? ["change", buildFieldPath([...path]), slot.value]
          : ["delete", buildFieldPath([...path]), undefined];
      });
      if (actions.length === 0) return;
      const result = await prefabCommands.patch(target.info, actions);
      if (!result.ok) throw new Error(`${result.stage}: ${result.error.message}`);
      notifySuccess("保存成功！");
    };
    const writePrefab = (path: readonly string[], slot: ReferenceUpdate["slot"]) => (
      writePrefabBatch([{ path, slot }])
    );
    return {
      roots: {
        prefab: new ObjectReferenceRoot("prefab", () => schemaData, writePrefab, writePrefabBatch),
        params: new ObjectReferenceRoot("params", () => ({ prefabIdnum: Number(target.dataKey) })),
        project: new RegistryReferenceRoot(new Map([["materials.images", imageSource]])),
      },
    };
  }, [imageSource, schemaData, target.dataKey, target.info]);
  const fieldActions = useMemo(() => new Map([
    [
      "prefab:id",
      <button key="rename" type="button" data-test-id="prefab-rename-open" onClick={onRename}>修改</button>,
    ],
  ]), [onRename]);

  if (!itemData) return <div>无数据</div>;
  return (
    <ProjectSchemaTable
      definition={mapBlockSchemaDefinition}
      scope={scope}
      fieldActions={fieldActions}
    />
  );
};

const ItemSchemaSection: FC<{ target: PrefabTarget; onRename: () => void }> = ({ target, onRename }) => {
  const [allData] = useResourceSuspense(target.resource);
  const itemData = useMemo(
    () => getPrefabItemData(allData as Record<string, unknown>, target),
    [allData, target],
  );
  const schemaData = useMemo<Record<string, unknown>>(() => ({
    ...(itemData ?? {}),
    id: target.displayId,
  }), [itemData, target.displayId]);
  const scope = useMemo<SchemaScope>(() => {
    const writeItem = async (
      path: readonly string[],
      slot: ReferenceUpdate["slot"],
    ) => {
      if (path.length === 0) throw new Error("不能直接替换整个道具对象");
      const action: Action = slot.present
        ? ["change", buildFieldPath([...path]), slot.value]
        : ["delete", buildFieldPath([...path]), undefined];
      const result = await prefabCommands.patch(target.info, [action]);
      if (!result.ok) throw new Error(`${result.stage}: ${result.error.message}`);
      notifySuccess("保存成功！");
    };
    return {
      roots: {
        prefab: new ObjectReferenceRoot("prefab", () => schemaData, writeItem),
      },
    };
  }, [schemaData, target.info]);
  const fieldActions = useMemo(() => new Map([
    [
      "prefab:id",
      <button key="rename" type="button" data-test-id="prefab-rename-open" onClick={onRename}>修改</button>,
    ],
  ]), [onRename]);

  if (!itemData) return <div>无数据</div>;
  return (
    <ProjectSchemaTable
      definition={itemSchemaDefinition}
      scope={scope}
      fieldActions={fieldActions}
    />
  );
};

function enemyHasSpecial(raw: unknown, expected: unknown): boolean {
  if (typeof expected !== "number" && typeof expected !== "string") return false;
  if (Array.isArray(raw)) return raw.some((item) => Object.is(item, expected));
  return Object.is(raw, expected);
}

function enemyHasAnySpecial(raw: unknown): boolean {
  if (Array.isArray(raw)) return raw.length > 0;
  return raw !== 0 && raw != null;
}

const EnemySchemaSection: FC<{ target: PrefabTarget; onRename: () => void }> = ({ target, onRename }) => {
  const [allData] = useResourceSuspense(target.resource);
  const itemData = useMemo(
    () => getPrefabItemData(allData as Record<string, unknown>, target),
    [allData, target],
  );
  const schemaData = useMemo<Record<string, unknown>>(() => ({
    ...(itemData ?? {}),
    id: target.displayId,
  }), [itemData, target.displayId]);
  const specialResource = useMemo(() => projectModel.enemySpecialCatalog(), []);
  const imageResource = useMemo(() => projectModel.projectImageCatalog(), []);
  const specialSource = useMemo(() => new ContentValueSource(
    "project:enemySpecials",
    () => specialResource.snapshot(),
    (listener) => specialResource.subscribe(() => listener()),
    () => specialResource.reload(),
  ), [specialResource]);
  const imageSource = useMemo(() => new ContentValueSource(
    "project:materials.images",
    () => imageResource.snapshot(),
    (listener) => imageResource.subscribe(() => listener()),
    () => imageResource.reload(),
  ), [imageResource]);
  const scope = useMemo<SchemaScope>(() => {
    const writeEnemy = async (
      path: readonly string[],
      slot: ReferenceUpdate["slot"],
    ) => {
      if (path.length === 0) throw new Error("不能直接替换整个怪物对象");
      const action: Action = slot.present
        ? ["change", buildFieldPath([...path]), slot.value]
        : ["delete", buildFieldPath([...path]), undefined];
      const result = await prefabCommands.patch(target.info, [action]);
      if (!result.ok) throw new Error(`${result.stage}: ${result.error.message}`);
      notifySuccess("保存成功！");
    };
    const registry = new Map<string, ValueSource<unknown>>([
      ["enemySpecials", specialSource],
      ["materials.images", imageSource],
    ]);
    return {
      roots: {
        prefab: new ObjectReferenceRoot("prefab", () => schemaData, writeEnemy),
        project: new RegistryReferenceRoot(registry),
      },
      calls: {
        "enemy.hasSpecial": enemyHasSpecial,
        "enemy.hasAnySpecial": enemyHasAnySpecial,
      },
    };
  }, [imageSource, schemaData, specialSource, target.info]);
  const fieldActions = useMemo(() => new Map([
    [
      "prefab:id",
      <button key="rename" type="button" data-test-id="prefab-rename-open" onClick={onRename}>修改</button>,
    ],
  ]), [onRename]);

  if (!itemData) return <div>无数据</div>;
  return (
    <ProjectSchemaTable
      definition={enemySchemaDefinition}
      scope={scope}
      fieldActions={fieldActions}
    />
  );
};

// ==================== 主内容组件 ====================

interface PrefabPanelContentProps {
  editMode: EditMode;
  tableVersion: PrefabTableVersion;
  onRename: () => void;
}

const PrefabPanelContent: FC<PrefabPanelContentProps> = ({ editMode, tableVersion, onRename }) => {
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
  return (
    <>
      {tableVersion === "schema" && target.type === "mapBlock"
        ? <MapBlockSchemaSection target={target} onRename={onRename} />
        : tableVersion === "schema" && target.type === "item"
          ? <ItemSchemaSection target={target} onRename={onRename} />
          : tableVersion === "schema" && target.type === "enemy"
            ? <EnemySchemaSection target={target} onRename={onRename} />
            : <EnemyItemTableSection target={target} editMode={editMode} />}
    </>
  );
};

// ==================== 面板组件 ====================

/**
 * PrefabPanel - 面板组件
 *
 * 负责布局和 actions，不直接依赖数据
 * actions 始终显示，不受数据加载状态影响
 */
export const PrefabPanel: FC = () => {
  // 在 Panel 层维护 editMode（不依赖数据）
  const [editMode, setEditMode] = useState<EditMode>("change");
  const [tableVersion, setTableVersion] = useState<PrefabTableVersion>("schema");
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);
  const selection = useCurrentPrefabSelection();
  const info = selection?.info;
  const target = useMemo(() => resolvePrefabTarget(info), [info]);
  const schemaAvailable = target?.registered === true
    && (target.type === "mapBlock" || target.type === "item" || target.type === "enemy");
  const schemaDefinition = target?.type === "mapBlock"
    ? mapBlockSchemaDefinition
    : target?.type === "item"
      ? itemSchemaDefinition
      : target?.type === "enemy"
        ? enemySchemaDefinition
        : undefined;
  const showingLegacy = !schemaAvailable || tableVersion === "legacy";
  const { setActivePanel } = PanelStore.useStore();

  const openRename = useCallback(() => {
    if (!info?.id) return;
    if (info.images === "autotile") {
      notifyError("自动元件不可修改 ID！");
      return;
    }
    if (info.idnum !== undefined && info.idnum >= 10000) {
      notifyError("额外素材不可修改 ID！");
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
      notifyError("请输入要修改到的 ID");
      return;
    }
    if (id === info.id) {
      setRenameOpen(false);
      return;
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(id)) {
      notifyError("不合法的 ID，请使用字母、数字或下划线，且不能以数字开头");
      return;
    }
    if (id === "hero" || id === "this" || id === "none" || id === "airwall") {
      notifyError("不得使用保留关键字作为 ID！");
      return;
    }
    if (projectModel.hasStatusBarIcon(id)) {
      alert("警告！此 ID 在状态栏图标中被注册；仍然允许使用，但是\\i[]等绘制可能出现冲突。");
    }

    setRenameSaving(true);
    try {
      const result = await materialCommands.changeIdAndIdnum(id, null, info);
      if (notifyCommandResult(result, "修改图块 ID 成功")) {
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
      notifyError("额外素材不可删除！");
      return;
    }
    if (!confirm("警告！你确定要删除此素材吗？此过程不可逆！")) return;
    await removeMaterialWithConfirmation(info);
  }, [info]);

  const handleAppendMaterial = useCallback(() => {
    if (!info) return;
    if (info.isTile) {
      notifyError("额外素材不支持此功能！");
      return;
    }
    setAppendPicTemplate(info);
    setActivePanel("appendpic");
  }, [info, setActivePanel]);

  // 操作按钮区域（始终显示）
  const actions = (
    <>
      {schemaAvailable ? (
        <Segmented
          size="small"
          data-test-id="prefab-table-version"
          value={tableVersion}
          onChange={(value) => setTableVersion(value as PrefabTableVersion)}
          options={[
            { label: "新版", value: "schema" },
            { label: "旧版", value: "legacy" },
          ]}
        />
      ) : null}
      {info ? (
        <>
          {schemaAvailable ? <>&nbsp;</> : null}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
            {showingLegacy && target?.registered ? (
              <Tooltip title="修改图块 ID">
                <Button
                  type="text"
                  size="small"
                  aria-label="修改图块 ID"
                  data-test-id="prefab-rename-open"
                  icon={<Pencil size={14} />}
                  onClick={openRename}
                />
              </Tooltip>
            ) : null}
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
                data-test-id={target?.registered ? "prefab-remove-registered" : "prefab-remove-unregistered"}
                icon={<Trash2 size={14} />}
                onClick={() => void handleRemoveMaterial()}
              >
                删除
              </Button>
            </Tooltip>
          </span>
        </>
      ) : null}
      {showingLegacy ? (
        <>
          {schemaAvailable ? <>&nbsp;&nbsp;</> : null}
          <EditModeSegmented value={editMode} onChange={setEditMode} testId="prefab-edit-mode" />
        </>
      ) : schemaDefinition ? <SchemaCustomizationButton definition={schemaDefinition} /> : null}
    </>
  );

  return (
    <>
      <ContentLeftTab id="left3" testId="panel-prefab" title="图块属性" actions={actions}>
        <PrefabPanelContent editMode={editMode} tableVersion={tableVersion} onRename={openRename} />
      </ContentLeftTab>
      <Modal
        title="修改图块 ID"
        open={renameOpen}
        okText="确定"
        cancelText="取消"
        confirmLoading={renameSaving}
        onCancel={closeRename}
        onOk={() => void handleRename()}
        okButtonProps={{ "data-test-id": "prefab-rename-submit" }}
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
