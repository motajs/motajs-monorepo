import type { GridPOD, LocPOD } from "@/utils/coordinate";

/**
 * 绘制单个选择框
 * 实现三层边框效果：外层黑色 (3px) → 中间白色 (2px) → 内层黑色 (1px)
 * 可选择性地渲染带编号的标签
 *
 * @param ctx - Canvas 2D 渲染上下文
 * @param gridPos - 选择框网格位置
 * @param gridSize - 网格大小 [宽度, 高度]
 * @param label - 标签文本（可选）
 * @param labelOffset - 标签偏移位置 {top, left}，默认 {top: 0, left: 2}
 */
export function drawSelectionBox(
  ctx: CanvasRenderingContext2D,
  gridPos: LocPOD,
  gridSize: GridPOD,
  label?: string,
  labelOffset: { top: number; left: number } = { top: 0, left: 2 }
): void {
  const [gridX, gridY] = gridPos;
  const [gridWidth, gridHeight] = gridSize;
  const boxX = gridX * gridWidth;
  const boxY = gridY * gridHeight;

  // 原CSS：border: 1px solid #000; box-shadow: 0 0 0 2px #fff, 0 0 0 3px #000;
  // margin: 3px 0 0 3px; width/height: 26px (32px - 6px)
  ctx.save();

  const marginLeft = 3;
  const marginTop = 3;
  const adjustedX = boxX + marginLeft;
  const adjustedY = boxY + marginTop;
  const adjustedWidth = gridWidth - 6;
  const adjustedHeight = gridHeight - 6;

  ctx.globalAlpha = 0.8;

  // 绘制外层黑边 (box-shadow: 0 0 0 3px #000)
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 3;
  ctx.strokeRect(
    adjustedX - 1.5,
    adjustedY - 1.5,
    adjustedWidth + 3,
    adjustedHeight + 3
  );

  // 绘制中间白边 (box-shadow: 0 0 0 2px #fff)
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.strokeRect(
    adjustedX - 0.5,
    adjustedY - 0.5,
    adjustedWidth + 1,
    adjustedHeight + 1
  );

  // 绘制内层黑边 (border: 1px solid #000)
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;
  ctx.strokeRect(adjustedX, adjustedY, adjustedWidth, adjustedHeight);

  ctx.globalAlpha = 1;

  // 绘制数字标签（如果提供）
  if (label) {
    const labelX = adjustedX + labelOffset.left;
    const labelY = adjustedY + labelOffset.top;

    // 绘制文字描边
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.font = "bold 14px Arial";
    ctx.textBaseline = "top";
    ctx.strokeText(label, labelX, labelY);

    // 绘制文字填充
    ctx.fillStyle = "#fff";
    ctx.fillText(label, labelX, labelY);
  }

  ctx.restore();
}
