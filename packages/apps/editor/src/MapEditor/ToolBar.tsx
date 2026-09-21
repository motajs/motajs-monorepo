/**
 * ToolBar - 地图编辑器工具栏
 *
 * 包含画笔模式、图层切换、视口控制、楼层选择等控件
 */

import { useCallback, useEffect, type FC, type ChangeEvent } from 'react';
import { Segmented } from 'antd';
import { PaintBucket, PencilLine, Square } from 'lucide-react';
import { useTowerDataSuspense } from '@/hooks/suspense';
import { setCurrentFloorId } from '@/stores/editorState';
import { notifyInfo, notifySuccess } from '@/utils/notify';
import { MapEditorStore, type BrushMod, type LayerMod } from './MapEditorStore';
import { LayerSettingsButton } from './LayerSettingsButton';
import { useFloorNavigation } from './useFloorNavigation';
import { useMapLayerSettings } from '@/project/settings/mapLayerSettings';

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
export const ToolBar: FC<ToolBarProps> = ({ floorId, tipMessage, tipClass, onFloorChange }) => {
  const [tower] = useTowerDataSuspense();
  const store = MapEditorStore.useStore();
  const { state } = store;
  const layerSettings = useMapLayerSettings();

  const { brushMod, layerMod, bigmap, showMovable } = state;
  const navigateFloor = useFloorNavigation(floorId, onFloorChange);

  const floorIds = (tower.main?.floorIds ?? []) as string[];

  useEffect(() => {
    if (!layerSettings.layers.some((layer) => layer.property === layerMod)) {
      store.setLayerMod('map');
    }
  }, [layerMod, layerSettings.layers, store]);

  // 通行度切换
  const handleShowMovableChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      store.setShowMovable(e.target.checked);
      if (e.target.checked) {
        notifySuccess(
          '此模式下将显示每个点的不可通行状态。<br/>请注意，修改了图块属性的不可出入方向后需要刷新才会正确显示在地图上。',
        );
      }
    },
    [store],
  );

  // 画笔模式切换
  const handleBrushModChange = useCallback(
    (mod: string | number) => {
      const next = mod as BrushMod;
      store.setBrushMod(next);

      if (next === 'fill') {
        notifySuccess('填充模式下，将会用选中的素材替换所有和目标点联通的相同素材');
      }
    },
    [store],
  );

  // 图层切换
  const handleLayerModChange = useCallback(
    (layer: string | number) => {
      store.setLayerMod(layer as LayerMod);
    },
    [store],
  );

  // 视口移动
  const handleViewportMove = useCallback(
    (dx: number, dy: number) => {
      store.moveViewport(dx, dy);
      notifyInfo('你可以按【大地图】（或F键）快捷切换大地图模式');
    },
    [store],
  );

  // 大地图切换
  const handleBigmapToggle = useCallback(() => {
    store.toggleBigmap();
    if (!bigmap) {
      notifySuccess('已进入大地图模式');
    } else {
      notifySuccess('已退出大地图模式');
    }
  }, [store, bigmap]);

  // 楼层选择
  const handleFloorSelect = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      const newFloorId = e.target.value;
      navigateFloor(newFloorId);
    },
    [navigateFloor],
  );

  // 后退楼层
  const handleUndoFloor = useCallback(() => {
    const prevFloorId = store.popRecentFloor();
    if (prevFloorId && prevFloorId !== floorId) {
      store.setCurrentFloorId(prevFloorId);
      setCurrentFloorId(prevFloorId);
      onFloorChange?.(prevFloorId);
    }
  }, [store, floorId, onFloorChange]);

  return (
    <div className="tools">
      {/* 图层选择 */}
      <div className="map-layer-picker-row">
        <div className="map-layer-picker-scroll">
          <Segmented
            size="small"
            aria-label="图层选择"
            data-test-id="layer-mode"
            value={layerMod}
            onChange={handleLayerModChange}
            options={layerSettings.layers.map((layer) => ({
              value: layer.property,
              label: <span data-test-id={`layer-mode-${layer.property}`}>{layer.name}</span>,
            }))}
          />
        </div>
        <LayerSettingsButton settings={layerSettings} />
      </div>

      <div className="map-toolbar-body">
        <div className="map-toolbar-controls">
          {/* 通行度 */}
          <span className="map-passability-toggle">
            <input
              type="checkbox"
              id="showMovable"
              data-test-id="show-passability"
              checked={showMovable}
              onChange={handleShowMovableChange}
            />
            通行度
          </span>

          {/* 画笔模式 */}
          <Segmented
            size="small"
            aria-label="绘制模式"
            data-test-id="brush-mode"
            value={brushMod}
            onChange={handleBrushModChange}
            options={[
              {
                value: 'line',
                label: (
                  <span data-test-id="brush-line">
                    <PencilLine size={14} />线
                  </span>
                ),
              },
              {
                value: 'rectangle',
                label: (
                  <span data-test-id="brush-rectangle">
                    <Square size={14} />
                    矩形
                  </span>
                ),
              },
              {
                value: 'fill',
                label: (
                  <span data-test-id="brush-fill">
                    <PaintBucket size={14} />
                    填充
                  </span>
                ),
              },
            ]}
          />

          {/* 视口控制按钮 */}
          <div id="viewportButtons">
            <input type="button" value="←" onClick={() => handleViewportMove(-1, 0)} />
            <input type="button" value="↑" onClick={() => handleViewportMove(0, -1)} />
            <input type="button" value="↓" onClick={() => handleViewportMove(0, 1)} />
            <input type="button" value="→" onClick={() => handleViewportMove(1, 0)} />
            <input
              type="button"
              id="bigmapBtn"
              value="大地图"
              className={bigmap ? 'highlight' : ''}
              onClick={handleBigmapToggle}
            />
          </div>

          <div className="map-floor-controls">
            <select id="selectFloor" data-test-id="floor-select" value={floorId} onChange={handleFloorSelect}>
              {floorIds.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
            <input
              type="button"
              value="楼层后退"
              title="返回上一次查看的楼层"
              id="undoFloor"
              onClick={handleUndoFloor}
              style={{ display: state.recentFloors.length > 0 ? 'inline' : 'none' }}
            />
          </div>
        </div>

        {/* 提示区域从第二行开始，不占用图层选择的宽度。 */}
        <div id="tip">{tipMessage && <p className={tipClass} dangerouslySetInnerHTML={{ __html: tipMessage }} />}</div>
      </div>
    </div>
  );
};

export default ToolBar;
