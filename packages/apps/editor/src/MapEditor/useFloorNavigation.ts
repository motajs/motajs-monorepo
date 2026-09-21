import { startTransition, useCallback } from 'react';
import { setCurrentFloorId } from '@/stores/editorState';
import { setCurrentLocFloorId } from '@/stores/locState';
import { MapEditorStore } from './MapEditorStore';

export function useFloorNavigation(currentFloorId: string, onFloorChange?: (floorId: string) => void) {
  const store = MapEditorStore.useStore();
  return useCallback(
    (nextFloorId: string) => {
      if (!nextFloorId || nextFloorId === currentFloorId) return;
      startTransition(() => {
        if (currentFloorId) store.pushRecentFloor(currentFloorId);
        store.setCurrentFloorId(nextFloorId);
        setCurrentFloorId(nextFloorId);
        setCurrentLocFloorId(nextFloorId);
        onFloorChange?.(nextFloorId);
      });
    },
    [currentFloorId, onFloorChange, store],
  );
}
