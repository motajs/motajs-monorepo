import { createContext, useContext } from "react";
import type { RuntimeStatus, RuntimeStatusBarRequest, RuntimeUIPreviewRequest } from "./protocol";

export interface RuntimeState { status: RuntimeStatus; error?: Error; instanceId?: string }

export interface RuntimeSurfaceLease {
  id: string;
  width: number;
  height: number;
  attach(container: HTMLElement): void;
  close(): void;
}

export interface RuntimePreviewCapability {
  state: RuntimeState;
  previewUI(request: RuntimeUIPreviewRequest): Promise<RuntimeSurfaceLease>;
  previewStatusBar(request: RuntimeStatusBarRequest): Promise<RuntimeSurfaceLease>;
  retry(): Promise<void>;
}

export const RuntimeContext = createContext<RuntimePreviewCapability | null>(null);

export function useRuntimePreview(): RuntimePreviewCapability {
  const value = useContext(RuntimeContext);
  if (!value) throw new Error("RuntimeProvider is missing");
  return value;
}
