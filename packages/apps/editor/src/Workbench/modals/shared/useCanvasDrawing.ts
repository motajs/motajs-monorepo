import { useEffect, type DependencyList } from "react";

export const useCanvasDrawing = (draw: () => void, deps: DependencyList): void => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    draw();
  }, deps);
};
