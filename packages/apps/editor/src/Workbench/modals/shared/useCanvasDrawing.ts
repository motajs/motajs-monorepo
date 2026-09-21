import { useEffect, type DependencyList } from 'react';

export const useCanvasDrawing = (draw: () => void, deps: DependencyList): void => {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- 依赖由调用方以 deps 显式传入，此处无法静态推断
  useEffect(() => {
    draw();
  }, deps);
};
