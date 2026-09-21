/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, type ReactNode } from 'react';
import type { SelectFloorOptions } from '../shared/types';

export type SelectFloorOpen = (options: SelectFloorOptions) => Promise<string | null>;

const SelectFloorModalContext = createContext<SelectFloorOpen | null>(null);

export function useSelectFloorModalAction(): SelectFloorOpen {
  const open = useContext(SelectFloorModalContext);
  if (!open) throw new Error('SelectFloor modal provider is missing');
  return open;
}

export function SelectFloorModalActionProvider({ open, children }: { open: SelectFloorOpen; children: ReactNode }) {
  return <SelectFloorModalContext.Provider value={open}>{children}</SelectFloorModalContext.Provider>;
}
