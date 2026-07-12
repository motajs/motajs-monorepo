/**
 * PrefabPanel - 图块属性编辑面板
 *
 * 使用 Suspense 架构，数据状态由 ContentBoundary 统一处理
 * 业务组件只写"数据已就绪"的逻辑
 */

import { useCallback, useMemo, useState, type FC } from "react";
import { ContentLeftTab } from "../components/ContentLeftTab";
import { Table, EditModeSegmented } from "@/components/Table";
import { useTableMetaEditor } from "@/components/Table/hooks";
import { useTableMetaSuspense } from "@/hooks";
import { useResourceSuspense } from "@/hooks/suspense";
import { materialCommands, prefabCommands } from "@/project/commands";
import { projectModel } from "@/project/model/projectModel";
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
  const { setActivePanel } = PanelStore.useStore();

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
          "警告！此ID在状态栏图标中被注册；仍然允许使用，但是\\i[]等绘制可能出现冲突。"
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

  const handleRemoveMaterial = useCallback(async () => {
    if (!confirm("警告！你确定要删除此素材吗？此过程不可逆！")) return;
    await removeMaterialWithConfirmation(info);
  }, [info]);

  const handleAppendMaterial = useCallback(() => {
    if (info.isTile) {
      notifyError("额外素材不支持此功能！");
      return;
    }
    setAppendPicTemplate(info);
    setActivePanel("appendpic");
  }, [info, setActivePanel]);

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
      <button
        data-test-id="prefab-remove-unregistered"
        onClick={handleRemoveMaterial}
        style={{ marginTop: 10, marginLeft: 5 }}
      >
        删除此素材
      </button>
      <button
        onClick={handleAppendMaterial}
        style={{ marginTop: 10, marginLeft: 5 }}
      >
        以此素材为模板追加
      </button>
    </div>
  );
};

// ==================== 修改 ID 区域 ====================

interface ChangeIdSectionProps {
  info: PrefabInfo;
}

const ChangeIdSection: FC<ChangeIdSectionProps> = ({ info }) => {
  const [changeIdValue, setChangeIdValue] = useState("");
  const { setActivePanel } = PanelStore.useStore();

  const handleChangeId = useCallback(async () => {
    const id = changeIdValue;
    if (id) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(id)) {
        notifyError("不合法的id，请使用字母、数字或下划线，且不能以数字开头");
        return;
      }
      if (id === "hero" || id === "this" || id === "none" || id === "airwall") {
        notifyError("不得使用保留关键字作为id！");
        return;
      }
      if (info.images === "autotile") {
        notifyError("自动元件不可修改id！");
        return;
      }
      if (info.idnum !== undefined && info.idnum >= 10000) {
        notifyError("额外素材不可修改id！");
        return;
      }
      if (projectModel.hasStatusBarIcon(id)) {
        alert(
          "警告！此ID在状态栏图标中被注册；仍然允许使用，但是\\i[]等绘制可能出现冲突。"
        );
      }
      const result = await materialCommands.changeIdAndIdnum(id, null, info);
      notifyCommandResult(result, "修改id成功");
    } else {
      notifyError("请输入要修改到的ID");
    }
  }, [changeIdValue, info]);

  const handleDeletePrefab = useCallback(async () => {
    if (info.isTile) {
      notifyError("额外素材不可删除！");
      return;
    }
    if (
      !confirm(
        "警告！你确定要删除此素材吗？此过程不可逆！\n请务必首先进行备份操作，并保证此素材没有在地图的任何位置使用，否则可能会出现不可知的后果！"
      )
    )
      return;
    await removeMaterialWithConfirmation(info);
  }, [info]);

  const handleAppendPrefab = useCallback(() => {
    if (info.isTile) {
      notifyError("额外素材不支持此功能！");
      return;
    }
    setAppendPicTemplate(info);
    setActivePanel("appendpic");
  }, [info, setActivePanel]);

  return (
    <div id="changeId">
      <input
        placeholder="修改图块id为"
        style={{ width: 100 }}
        value={changeIdValue}
        onChange={(e) => setChangeIdValue(e.target.value)}
      />
      <button onClick={handleChangeId}>确定</button>
      <button data-test-id="prefab-remove-registered" style={{ marginLeft: 5 }} onClick={handleDeletePrefab}>
        删除此素材
      </button>
      <button style={{ marginLeft: 5 }} onClick={handleAppendPrefab}>
        以此素材为模板追加
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
    [allData, target]
  );

  // 获取对应的 commentObj
  const commentObj = useMemo(
    () => getPrefabComment(meta, target),
    [meta, target]
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
    [info]
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
          "你确定要批量清空【全塔怪物】的全部属性么？这是个不可逆操作！"
        )
      ) {
        const result = await prefabCommands.clearAll(info, templates, allData as Record<string, unknown>);
        notifyCommandResult(result, "全塔全部怪物属性清空成功！");
      }
    } else if (target.type === "item") {
      if (
        confirm(
          "你确定要批量清空【全塔所有自动注册且未修改ID的道具】的全部属性么？这是个不可逆操作！"
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

// ==================== 主内容组件 ====================

interface PrefabPanelContentProps {
  editMode: EditMode;
}

const PrefabPanelContent: FC<PrefabPanelContentProps> = ({ editMode }) => {
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
    return (
      <>
        <div>无法加载数据</div>
        <ChangeIdSection info={info} />
      </>
    );
  }

  // 否则显示编辑区域
  return (
    <>
      <EnemyItemTableSection target={target} editMode={editMode} />
      <ChangeIdSection info={info} />
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

  // 使用 useTableMetaEditor 获取编辑器打开函数
  const { openEditor } = useTableMetaEditor("comment");

  // 配置表格按钮点击处理
  const handleConfigure = useCallback(() => {
    openEditor();
  }, [openEditor]);

  // 操作按钮区域（始终显示）
  const actions = (
    <>
      <EditModeSegmented value={editMode} onChange={setEditMode} testId="prefab-edit-mode" />
      &nbsp;&nbsp;
      <button onClick={handleConfigure}>配置表格</button>
    </>
  );

  return (
    <ContentLeftTab id="left3" testId="panel-prefab" title="图块属性" actions={actions}>
      <PrefabPanelContent editMode={editMode} />
    </ContentLeftTab>
  );
};
