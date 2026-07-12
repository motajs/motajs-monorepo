import {
  createContext,
  useContext,
  type ReactNode,
} from 'react';
import type {
  MaterialKind,
} from '@/blockly/registry';
import type { BlocklyPreviewResult } from '@/blockly/interactions/previewModel';
import type {
  SelectPointOptions,
  SelectPointResult,
} from '@/Workbench/modals/shared/types';

export interface BlocklyTextEditRequest {
  contextId: string;
  value: string;
  lint?: boolean;
}

export interface BlocklyMaterialRequest {
  title: string;
  value?: string[];
  kind: MaterialKind;
  multiple?: boolean;
  transform?: 'strip-animate-extension';
  aliasPolicy?: 'preserve' | 'prefer-alias' | 'physical-name';
}

export interface BlocklyInteractionCapabilities {
  editText(request: BlocklyTextEditRequest): Promise<string | null>;
  selectPoint(options: SelectPointOptions): Promise<SelectPointResult | null>;
  selectMaterial(request: BlocklyMaterialRequest): Promise<string[] | null>;
  preview(result: BlocklyPreviewResult): Promise<void>;
  searchFlags(): Promise<void>;
  confirm(message: string): Promise<boolean>;
  report(message: string, level?: 'error' | 'warning' | 'info'): void;
}

const BlocklyCapabilitiesContext = createContext<BlocklyInteractionCapabilities | null>(null);

export function BlocklyCapabilitiesProvider({
  value,
  children,
}: {
  value: BlocklyInteractionCapabilities;
  children?: ReactNode;
}) {
  return (
    <BlocklyCapabilitiesContext.Provider value={value}>
      {children}
    </BlocklyCapabilitiesContext.Provider>
  );
}

export function useBlocklyInteractionCapabilities(): BlocklyInteractionCapabilities {
  const context = useContext(BlocklyCapabilitiesContext);
  if (!context) throw new Error('BlocklyCapabilitiesProvider is missing');
  return context;
}
