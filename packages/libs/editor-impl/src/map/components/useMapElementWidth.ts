import { RefObject, useEffect, useState } from 'react';

// 量一个元素的实际像素宽度：面板根元素由外壳决定宽度，素材区按「可用宽度 − 画布宽」拿剩余空间。
// 只量宽度：画布高度已经由「格数 × 32 × 缩放」决定。量不到（jsdom / 首次渲染）返回 0，调用方回退到基准宽度。

/**
 * 观察目标元素的像素宽度；宽度不变时不触发重渲染
 * @param ref 要测量的元素引用
 * @returns 当前宽度（像素）；量不到时为 0
 */
export function useMapElementWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);

  useEffect((): (() => void) | undefined => {
    const element = ref.current;

    if (element === null) return undefined;

    /**
     * 只在宽度变化时写状态
     * @param next 量到的宽度
     */
    const sync = (next: number): void => {
      setWidth((current) => (current === next ? current : next));
    };

    sync(element.getBoundingClientRect().width);

    if (typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver((entries): void => {
      const entry = entries[0];

      sync(entry === undefined ? element.getBoundingClientRect().width : entry.contentRect.width);
    });

    observer.observe(element);

    return (): void => observer.disconnect();
  }, [ref]);

  return width;
}
