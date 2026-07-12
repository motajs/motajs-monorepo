/**
 * ToolBar - 地图编辑器工具栏
 *
 * 包含画笔模式、图层切换、视口控制、楼层选择等控件
 */

import { useCallback, type FC, type ChangeEvent } from "react";
import { Button, Popover, Space, Tooltip } from "antd";
import { HistoryOutlined, RedoOutlined, UndoOutlined } from "@ant-design/icons";
import { useTowerDataSuspense } from "@/hooks/suspense";
import { operationHistory, useOperationHistory } from "@/project/history";
import { setCurrentFloorId } from "@/stores/editorState";
import { PanelStore, type PanelId } from "@/stores/PanelStore";
import { EditorStore } from "@/stores/EditorStore";
import { notifyError, notifyInfo, notifySuccess } from "@/utils/notify";
import { MapEditorStore, type BrushMod, type LayerMod } from "./MapEditorStore";
import { useSelectFloorModalAction } from "@/Workbench/modals/SelectFloor";
import { getEditorEnvironment } from "@/environment";

export interface ToolBarProps {
  /** 当前楼层 ID */
  floorId: string;
  /** 提示消息 */
  tipMessage: string;
  /** 提示样式类 */
  tipClass: string;
  /** 楼层切换回调 */
  onFloorChange?: (floorId: string) => void;
}

/**
 * ToolBar 组件
 */
export const ToolBar: FC<ToolBarProps> = ({
  floorId,
  tipMessage,
  tipClass,
  onFloorChange,
}) => {
  const [tower] = useTowerDataSuspense();
  const { activePanel, setActivePanel } = PanelStore.useStore();
  const { theme, setTheme } = EditorStore.useStore();
  const store = MapEditorStore.useStore();
  const { state } = store;

  const {
    brushMod,
    layerMod,
    bigmap,
    showMovable,
  } = state;
  const history = useOperationHistory();
  const openSelectFloor = useSelectFloorModalAction();

  const floorIds = (tower.main?.floorIds ?? []) as string[];

  // 面板切换
  const handlePanelChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      setActivePanel(e.target.value as PanelId);
    },
    [setActivePanel]
  );

  // 通行度切换
  const handleShowMovableChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      store.setShowMovable(e.target.checked);
      if (e.target.checked) {
        notifySuccess(
          "此模式下将显示每个点的不可通行状态。<br/>请注意，修改了图块属性的不可出入方向后需要刷新才会正确显示在地图上。"
        );
      }
    },
    [store]
  );

  // 主题切换
  const handleThemeChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      const newTheme = e.target.value;
      setTheme(newTheme);
    },
    [setTheme]
  );

  // 画笔模式切换
  const handleBrushModChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const mod = e.target.value as BrushMod;
      store.setBrushMod(mod);

      if (mod === "fill") {
        notifySuccess("填充模式下，将会用选中的素材替换所有和目标点联通的相同素材");
      } else if (mod === "tileset") {
        notifySuccess(
          "tileset平铺模式下可以按选中tileset素材，并在地图上拖动来一次绘制一个区域"
        );
      }
    },
    [store]
  );

  // 图层切换
  const handleLayerModChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      store.setLayerMod(e.target.value as LayerMod);
    },
    [store]
  );

  // 视口移动
  const handleViewportMove = useCallback(
    (dx: number, dy: number) => {
      store.moveViewport(dx, dy);
      notifyInfo("你可以按【大地图】（或F键）快捷切换大地图模式");
    },
    [store]
  );

  // 大地图切换
  const handleBigmapToggle = useCallback(() => {
    store.toggleBigmap();
    if (!bigmap) {
      notifySuccess("已进入大地图模式");
    } else {
      notifySuccess("已退出大地图模式");
    }
  }, [store, bigmap]);

  // 楼层选择
  const handleFloorSelect = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      const newFloorId = e.target.value;
      if (newFloorId === floorId) return;

      store.pushRecentFloor(floorId);
      store.setCurrentFloorId(newFloorId);
      setCurrentFloorId(newFloorId);
      onFloorChange?.(newFloorId);
    },
    [floorId, store, onFloorChange]
  );

  // 选层按钮
  const handleSelectFloorBtn = useCallback(() => {
    void openSelectFloor({ title: "选择楼层", initialFloorId: floorId }).then((nextFloorId) => {
      if (!nextFloorId || nextFloorId === floorId) return;
      store.pushRecentFloor(floorId);
      store.setCurrentFloorId(nextFloorId);
      setCurrentFloorId(nextFloorId);
      onFloorChange?.(nextFloorId);
    });
  }, [floorId, onFloorChange, openSelectFloor, store]);

  // 后退楼层
  const handleUndoFloor = useCallback(() => {
    const prevFloorId = store.popRecentFloor();
    if (prevFloorId && prevFloorId !== floorId) {
      store.setCurrentFloorId(prevFloorId);
      setCurrentFloorId(prevFloorId);
      onFloorChange?.(prevFloorId);
    }
  }, [store, floorId, onFloorChange]);

  const handleHistoryUndo = useCallback(() => {
    void operationHistory.undo().catch(notifyError);
  }, []);

  const handleHistoryRedo = useCallback(() => {
    void operationHistory.redo().catch(notifyError);
  }, []);

  const historyContent = (
    <div
      data-test-id="operation-history-list"
      style={{
        width: 560,
        maxWidth: "calc(100vw - 48px)",
        maxHeight: 360,
        overflowY: "auto",
      }}
    >
      {history.entries.length === 0 ? (
        <div style={{ color: "#888", padding: "8px 4px" }}>暂无可撤销操作</div>
      ) : (
        [...history.entries].map((entry, index) => ({ entry, index })).reverse().map(({ entry, index }) => (
          <div
            key={entry.id}
            data-test-id="operation-history-entry"
            style={{
              display: "grid",
              gridTemplateColumns: "14px minmax(120px, 180px) minmax(0, 1fr) 64px",
              alignItems: "center",
              gap: 8,
              padding: "7px 4px",
              borderBottom: "1px solid rgba(128,128,128,0.2)",
              opacity: index < history.current ? 1 : 0.5,
              fontSize: 12,
              whiteSpace: "nowrap",
            }}
          >
            <span aria-label={index < history.current ? "已应用" : "已撤销"}>
              {index < history.current ? "●" : "○"}
            </span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }} title={entry.label}>
              {entry.label}
            </span>
            <span
              title={entry.paths.join(", ")}
              style={{ color: "#888", overflow: "hidden", textOverflow: "ellipsis" }}
            >
              {entry.paths.join(", ")}
            </span>
            <span style={{ color: "#888", textAlign: "right" }}>
              {new Date(entry.timestamp).toLocaleTimeString("zh-CN", {
                hour12: false,
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          </div>
        ))
      )}
    </div>
  );

  // 打开帮助文档
  const handleOpenDoc = useCallback(() => {
    window.open(getEditorEnvironment().endpoints.docs, "_blank");
  }, []);

  // 前往游戏
  const handleGoToGame = useCallback(() => {
    window.open(getEditorEnvironment().endpoints.preview, "_blank");
  }, []);

  const handleBackToProject = useCallback(() => {
    window.location.assign(getEditorEnvironment().endpoints.project);
  }, []);

  return (
    <div className="tools">
      {/* 提示区域 */}
      <div id="tip">
        {tipMessage && (
          <p className={tipClass} dangerouslySetInnerHTML={{ __html: tipMessage }} />
        )}
      </div>

      {/* 面板选择 */}
      <select
        id="editModeSelect"
        data-test-id="edit-mode-select"
        style={{ fontSize: 12 }}
        value={activePanel}
        onChange={handlePanelChange}
      >
        <option value="map">地图编辑(Z)</option>
        <option value="loc">地图选点(X)</option>
        <option value="enemyitem">图块属性(C)</option>
        <option value="floor">楼层属性(V)</option>
        <option value="tower">全塔属性(B)</option>
        <option value="functions">脚本编辑(N)</option>
        <option value="appendpic">追加素材(M)</option>
        <option value="commonevent">公共事件(,)</option>
        <option value="plugins">插件编写(.)</option>
      </select>

      {/* 通行度 */}
      <span style={{ fontSize: 12 }}>
        <input
          type="checkbox"
          id="showMovable"
          data-test-id="show-passability"
          checked={showMovable}
          onChange={handleShowMovableChange}
          style={{ marginLeft: 0, marginRight: 2 }}
        />
        通行度
      </span>

      {/* 主题选择 */}
      <select
        id="editorTheme"
        value={theme}
        onChange={handleThemeChange}
        style={{ marginLeft: 0, fontSize: 11 }}
      >
        <option value="editor_color">默认白</option>
        <option value="editor_color_dark">夜间黑</option>
      </select>

      <br />

      {/* 画笔模式 */}
      <span style={{ fontSize: 12 }}>
        <input
          type="radio"
          name="brushMod"
          value="line"
          data-test-id="brush-line"
          checked={brushMod === "line"}
          onChange={handleBrushModChange}
        />
        线
        <input
          type="radio"
          name="brushMod"
          value="rectangle"
          data-test-id="brush-rectangle"
          checked={brushMod === "rectangle"}
          onChange={handleBrushModChange}
        />
        矩形
        <input
          type="radio"
          name="brushMod"
          value="tileset"
          data-test-id="brush-tileset"
          checked={brushMod === "tileset"}
          onChange={handleBrushModChange}
        />
        tile平铺
        <input
          type="radio"
          name="brushMod"
          value="fill"
          data-test-id="brush-fill"
          checked={brushMod === "fill"}
          onChange={handleBrushModChange}
        />
        填充
      </span>

      <br />

      {/* 图层选择 */}
      <span style={{ fontSize: 12 }}>
        <input
          type="radio"
          name="layerMod"
          value="bgmap"
          data-test-id="layer-mode-bgmap"
          checked={layerMod === "bgmap"}
          onChange={handleLayerModChange}
        />
        背景层
        <input
          type="radio"
          name="layerMod"
          value="map"
          data-test-id="layer-mode-map"
          checked={layerMod === "map"}
          onChange={handleLayerModChange}
          style={{ marginLeft: 5 }}
        />
        事件层
        <input
          type="radio"
          name="layerMod"
          value="fgmap"
          data-test-id="layer-mode-fgmap"
          checked={layerMod === "fgmap"}
          onChange={handleLayerModChange}
          style={{ marginLeft: 5 }}
        />
        前景层
      </span>

      <br />

      {/* 视口控制按钮 */}
      <div id="viewportButtons" style={{ marginBottom: 7 }}>
        <input
          type="button"
          value="←"
          onClick={() => handleViewportMove(-1, 0)}
        />
        <input
          type="button"
          value="↑"
          onClick={() => handleViewportMove(0, -1)}
        />
        <input
          type="button"
          value="↓"
          onClick={() => handleViewportMove(0, 1)}
        />
        <input
          type="button"
          value="→"
          onClick={() => handleViewportMove(1, 0)}
        />
        <input
          type="button"
          id="bigmapBtn"
          value="大地图"
          className={bigmap ? "highlight" : ""}
          onClick={handleBigmapToggle}
          style={{ marginLeft: 5 }}
        />
      </div>

      {/* 楼层选择 */}
      <select
        id="selectFloor"
        data-test-id="floor-select"
        value={floorId}
        onChange={handleFloorSelect}
        style={{ marginBottom: 5 }}
      >
        {floorIds.map((id) => (
          <option key={id} value={id}>
            {id}
          </option>
        ))}
      </select>
      <input
        type="button"
        value="选层"
        id="selectFloorBtn"
        data-test-id="open-floor-select"
        onClick={handleSelectFloorBtn}
      />
      <Space.Compact style={{ marginLeft: 4, verticalAlign: "middle" }}>
        <Tooltip title="撤销">
          <Button
            size="small"
            icon={<UndoOutlined />}
            data-test-id="operation-history-undo"
            disabled={history.busy || history.current === 0}
            onClick={handleHistoryUndo}
          />
        </Tooltip>
        <Popover content={historyContent} title="操作历史" trigger="click">
          <Button
            size="small"
            icon={<HistoryOutlined />}
            data-test-id="operation-history-open"
            disabled={history.entries.length === 0}
          >
            {history.current}/{history.entries.length}
          </Button>
        </Popover>
        <Tooltip title="重做">
          <Button
            size="small"
            icon={<RedoOutlined />}
            data-test-id="operation-history-redo"
            disabled={history.busy || history.current >= history.entries.length}
            onClick={handleHistoryRedo}
          />
        </Tooltip>
      </Space.Compact>
      <input
        type="button"
        value="楼层后退"
        title="返回上一次查看的楼层"
        id="undoFloor"
        onClick={handleUndoFloor}
        style={{ display: state.recentFloors.length > 0 ? "inline" : "none" }}
      />
      <input
        type="button"
        value="帮助文档"
        id="openDoc"
        onClick={handleOpenDoc}
      />
      <input
        type="button"
        value="前往游戏"
        onClick={handleGoToGame}
      />
      <input
        type="button"
        value="返回工程"
        data-test-id="back-to-project"
        onClick={handleBackToProject}
      />
    </div>
  );
};

export default ToolBar;
