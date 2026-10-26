import { CSSProperties } from 'react';
import { resolveGroupAtlasRect } from '../model/tileAtlas';
import { IMapTileCrop, IMapTileGroup } from '../types';

// 一个源格贴进按钮的唯一算法：按整张图集的真实像素尺寸缩放，再用同一个倍数把这一格摆到按钮正中。
// 宽高必须共用一个倍数，否则 96×64 的长方形素材会被拉成正方形（U-21）；只画第 0 帧的矩形，
// 所以自动元件不会把相邻图块一起带进来（U-18）。

/**
 * 把像素值保留两位小数并带上 `px`；0 统一写成 `0px`，不出现 `-0px`
 * @param value 像素值
 * @returns 可直接写进 CSS 的像素串
 */
function roundPx(value: number): string {
  const rounded = Math.round(value * 100) / 100;

  return `${rounded === 0 ? 0 : rounded}px`;
}

/**
 * 求一个源格贴进正方形按钮的背景样式
 *
 * 显示倍数取「按钮宽 / 源格宽」与「按钮高 / 源格高」的较小值，宽高同一个倍数，矩形格因此仍是矩形；
 * 先在按钮内把这一格居中，再按它在整张图集里的位置负偏移。源格宽高或按钮非正时退回 1 倍。
 * @param url 该组图片的 blob 地址
 * @param group 图块所属素材组（用于取整张图集的真实像素尺寸）
 * @param rect 这一格在源图上的矩形
 * @param box 按钮的显示边长（像素）
 * @returns 内联样式：背景图、背景尺寸、背景定位与直角
 */
export function resolveTileBackgroundStyle(
  url: string,
  group: IMapTileGroup,
  rect: IMapTileCrop,
  box: number,
): CSSProperties {
  const atlas = resolveGroupAtlasRect(group);
  const scale = rect.width > 0 && rect.height > 0 && box > 0 ? Math.min(box / rect.width, box / rect.height) : 1;

  return {
    backgroundImage: `url("${url}")`,
    backgroundSize: `${roundPx(atlas.width * scale)} ${roundPx(atlas.height * scale)}`,
    backgroundPosition: `${roundPx((box - rect.width * scale) / 2 - rect.x * scale)} ${roundPx(
      (box - rect.height * scale) / 2 - rect.y * scale,
    )}`,
    borderRadius: 0,
  };
}
