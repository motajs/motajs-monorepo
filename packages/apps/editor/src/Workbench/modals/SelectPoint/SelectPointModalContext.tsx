/* eslint-disable react-refresh/only-export-components -- Provider 与消费 hook 同模块导出是该 context 的既定形态，拆分属无关重构 */
import { createContext, useContext, type ReactNode } from 'react';
import type { SelectPointOptions, SelectPointResult } from '../shared/types';

export type SelectPointOpen = (options: SelectPointOptions) => Promise<SelectPointResult | null>;

const SelectPointModalContext = createContext<SelectPointOpen | null>(null);

export function useSelectPointModalAction(): SelectPointOpen {
  const open = useContext(SelectPointModalContext);
  if (!open) throw new Error('SelectPoint modal provider is missing');
  return open;
}

export function SelectPointModalActionProvider({ open, children }: { open: SelectPointOpen; children: ReactNode }) {
  return <SelectPointModalContext.Provider value={open}>{children}</SelectPointModalContext.Provider>;
}
