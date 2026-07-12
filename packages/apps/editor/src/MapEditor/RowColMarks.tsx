/**
 * RowColMarks - 行列标记组件
 *
 * 显示地图编辑器的行列坐标标记，并支持悬停高亮
 */

import { memo, type FC } from "react";
import { MapEditorStore } from "./MapEditorStore";
import { TILE_SIZE, GRID_COUNT } from "./utils/coordinate";

export interface RowColMarksProps {
  /** 地图宽度（格子数） */
  width?: number;
  /** 地图高度（格子数） */
  height?: number;
  /** X 偏移（大地图模式） */
  offsetX?: number;
  /** Y 偏移（大地图模式） */
  offsetY?: number;
}

/**
 * 列标记组件
 */
const ColMark: FC<{
  index: number;
  displayNum: number;
  isHighlighted: boolean;
}> = memo(({ index, displayNum, isHighlighted }) => (
  <td className={isHighlighted ? "highlight" : ""}>
    {displayNum}
    <div
      className="colBlock"
      style={{ left: `${index * TILE_SIZE + 1}px` }}
    />
  </td>
));

ColMark.displayName = "ColMark";

/**
 * 行标记组件
 */
const RowMark: FC<{
  index: number;
  displayNum: number;
  isHighlighted: boolean;
}> = memo(({ index, displayNum, isHighlighted }) => (
  <tr>
    <td className={isHighlighted ? "highlight" : ""}>
      {displayNum}
      <div
        className="rowBlock"
        style={{ top: `${index * TILE_SIZE + 1}px` }}
      />
    </td>
  </tr>
));

RowMark.displayName = "RowMark";

/**
 * RowColMarks 组件
 *
 * 显示列标记（上方）和行标记（左侧）
 */
export const RowColMarks: FC<RowColMarksProps> = ({
  width = GRID_COUNT,
  height = GRID_COUNT,
  offsetX = 0,
  offsetY = 0,
}) => {
  const store = MapEditorStore.useStore();
  const { hoverPos, bigmap } = store.state;

  // 大地图模式下不显示行列标记
  if (bigmap) {
    return (
      <>
        <table className="col" id="mapColMark" />
        <table className="row" id="mapRowMark" />
      </>
    );
  }

  // 生成列标记
  const colMarks = [];
  for (let i = 0; i < width; i++) {
    colMarks.push(
      <ColMark
        key={i}
        index={i}
        displayNum={i + offsetX}
        isHighlighted={hoverPos !== null && hoverPos[0] === i}
      />
    );
  }

  // 生成行标记
  const rowMarks = [];
  for (let i = 0; i < height; i++) {
    rowMarks.push(
      <RowMark
        key={i}
        index={i}
        displayNum={i + offsetY}
        isHighlighted={hoverPos !== null && hoverPos[1] === i}
      />
    );
  }

  return (
    <>
      <table className="col" id="mapColMark">
        <tbody>
          <tr>{colMarks}</tr>
        </tbody>
      </table>
      <table className="row" id="mapRowMark">
        <tbody>{rowMarks}</tbody>
      </table>
    </>
  );
};

export default RowColMarks;
