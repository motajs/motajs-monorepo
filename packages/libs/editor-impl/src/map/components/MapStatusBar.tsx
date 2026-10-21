import { ReactElement } from 'react';
import { IMapCellPosition, IMapRect, IMapSize } from '../types';

// 画布下方的 24px 状态条：坐标 / 选区 / 地图 / 图层 / 模式五段。
// 纯展示；窄宽度时按优先级从右向左隐藏次要段，只保留坐标与选区。

export interface IMapStatusBarProps {
  /** 当前指针所在的格子；没有指针时为 undefined */
  readonly cursor?: IMapCellPosition;
  /** 当前框选矩形；没有选区时为 undefined */
  readonly selection?: IMapRect;
  /** 地图尺寸 */
  readonly mapSize: IMapSize;
  /** 当前图层显示名 */
  readonly layerName: string;
  /** 是否处于大地图模式 */
  readonly bigMap: boolean;
  /** 是否为窄布局；测试直接传 */
  readonly narrow: boolean;
}

/**
 * 状态条的各段都用单行省略，全文放在 title 上
 * @param props 状态条 props
 * @returns 状态条元素；地图尺寸缺失时不渲染
 */
export function MapStatusBar(props: IMapStatusBarProps): ReactElement | null {
  const mapSize = props.mapSize;

  if (mapSize.width <= 0 || mapSize.height <= 0) return null;

  const cursor = props.cursor ?? { x: 0, y: 0 };
  const coordinateText = `坐标 (${cursor.x}, ${cursor.y})`;
  const selectionText = props.selection === undefined ? '' : `选区 ${props.selection.width}×${props.selection.height}`;
  const mapText = `地图 ${mapSize.width}×${mapSize.height}`;
  const layerText = `图层 ${props.layerName}`;
  const modeText = `模式 ${props.bigMap ? '大地图' : '普通'}`;

  return (
    <div className="emap-status" data-test-id="map-status" data-width={props.narrow ? 'narrow' : 'wide'}>
      <span className="emap-status-item" title={coordinateText}>
        坐标&nbsp;
        <span className="emap-status-num">{`(${cursor.x}, ${cursor.y})`}</span>
      </span>
      {props.selection !== undefined ? (
        <span className="emap-status-item" title={selectionText}>
          选区&nbsp;
          <span className="emap-status-num">{`${props.selection.width}×${props.selection.height}`}</span>
        </span>
      ) : null}
      {props.narrow ? null : (
        <>
          <span className="emap-status-item" title={mapText}>
            地图&nbsp;
            <span className="emap-status-num">{`${mapSize.width}×${mapSize.height}`}</span>
          </span>
          <span className="emap-status-item" title={layerText}>
            {layerText}
          </span>
          <span className="emap-status-item" title={modeText}>
            {modeText}
          </span>
        </>
      )}
    </div>
  );
}
