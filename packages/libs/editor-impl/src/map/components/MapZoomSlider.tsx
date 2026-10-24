import { Slider } from 'antd';
import { ReactElement, useEffect, useState } from 'react';
import { MAP_ZOOM_DEFAULT, MAP_ZOOM_MAX, MAP_ZOOM_MIN, MAP_ZOOM_STEP } from '../constants';
import { IMapZoomSliderProps } from '../types';

// 缩放滑块：本地 state 驱动拇指位置，松手才把夹取后的值交给面板。
// 受控值来自面板 Store，若拖动中立刻发布会让拇指回弹，所以只有 onChangeComplete 才上报。

/**
 * 把缩放值夹到允许范围；非数时回退默认
 * @param value 滑块给出的缩放值
 * @returns 夹取后的缩放值
 */
function clampZoom(value: number): number {
  if (!Number.isFinite(value)) return MAP_ZOOM_DEFAULT;

  return Math.min(MAP_ZOOM_MAX, Math.max(MAP_ZOOM_MIN, value));
}

/**
 * 把缩放倍率显示成百分比文案
 * @param value 缩放倍率
 * @returns 百分比文案，例如 `150%`
 */
function formatZoom(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/**
 * 工具栏里的缩放滑块
 * @param props 滑块 props
 * @returns 滑块元素
 */
export function MapZoomSlider(props: IMapZoomSliderProps): ReactElement {
  const [draft, setDraft] = useState(() => clampZoom(props.value));

  useEffect((): void => {
    setDraft(clampZoom(props.value));
  }, [props.value]);

  return (
    <span className="emap-zoom" data-test-id="map-zoom">
      <span className="emap-zoom-label">缩放</span>
      <Slider
        className="emap-zoom-slider"
        min={MAP_ZOOM_MIN}
        max={MAP_ZOOM_MAX}
        step={MAP_ZOOM_STEP}
        disabled={props.disabled}
        value={draft}
        onChange={(value): void => setDraft(clampZoom(value))}
        onChangeComplete={(value): void => {
          const next = clampZoom(value);

          setDraft(next);
          props.onChangeComplete(next);
        }}
      />
      <span className="emap-zoom-value">{formatZoom(draft)}</span>
    </span>
  );
}
