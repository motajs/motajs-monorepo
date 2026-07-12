/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, type ReactNode } from "react";
import type { SelectMaterialOptions } from "../shared/types";

export type SelectMaterialOpen = (
  options: SelectMaterialOptions,
) => Promise<string[] | null>;

const SelectMaterialModalContext = createContext<SelectMaterialOpen | null>(null);

export function useSelectMaterialModalAction(): SelectMaterialOpen {
  const open = useContext(SelectMaterialModalContext);
  if (!open) throw new Error("SelectMaterial modal provider is missing");
  return open;
}

export function SelectMaterialModalActionProvider({
  open,
  children,
}: {
  open: SelectMaterialOpen;
  children: ReactNode;
}) {
  return (
    <SelectMaterialModalContext.Provider value={open}>
      {children}
    </SelectMaterialModalContext.Provider>
  );
}
