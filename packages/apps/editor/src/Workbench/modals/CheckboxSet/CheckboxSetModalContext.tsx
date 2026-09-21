import { createContext, useContext, type ReactNode } from 'react';
import type { CheckboxSetOptions } from '../shared/types';

export type CheckboxSetOpen = (options: CheckboxSetOptions) => Promise<Array<string | number> | null>;

const CheckboxSetModalContext = createContext<CheckboxSetOpen | null>(null);

export function useCheckboxSetModalAction(): CheckboxSetOpen {
  const open = useContext(CheckboxSetModalContext);
  if (!open) throw new Error('CheckboxSet modal provider is missing');
  return open;
}

export function CheckboxSetModalActionProvider({ open, children }: { open: CheckboxSetOpen; children: ReactNode }) {
  return <CheckboxSetModalContext.Provider value={open}>{children}</CheckboxSetModalContext.Provider>;
}
