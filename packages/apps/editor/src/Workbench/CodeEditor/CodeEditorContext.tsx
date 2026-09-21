import { createContext, useContext, useSyncExternalStore } from 'react';

export interface CodeEditorOpenRequest {
  contextId: string;
  initialValue: string;
  lint?: boolean;
  language?: 'javascript' | 'json' | 'plaintext';
  preview?: unknown;
  onPreview?(value: string): void | Promise<void>;
  scrollTop?: number;
  onConfirm(value: string): void | Promise<void>;
  onCancel?(): void;
}

export interface CodeEditorCapability {
  open(request: CodeEditorOpenRequest): void;
}

export type CodeEditorOpener = (request: CodeEditorOpenRequest) => void;

export interface CodeEditorContextValue extends CodeEditorCapability {
  register(opener: CodeEditorOpener): () => void;
  registerPreview(previewer: (mode: unknown, value: string) => void | Promise<void>): () => void;
}

export const CodeEditorContext = createContext<CodeEditorContextValue | null>(null);
let codeEditorHostRequested = false;
const codeEditorHostListeners = new Set<() => void>();

export function requestCodeEditorHost(): void {
  if (codeEditorHostRequested) return;
  codeEditorHostRequested = true;
  for (const listener of codeEditorHostListeners) listener();
}

function subscribeCodeEditorHost(listener: () => void): () => void {
  codeEditorHostListeners.add(listener);
  return () => codeEditorHostListeners.delete(listener);
}

export function useCodeEditor(): CodeEditorCapability {
  const context = useContext(CodeEditorContext);
  if (!context) throw new Error('CodeEditorProvider is missing');
  return context;
}

export function useCodeEditorRegistration(): CodeEditorContextValue['register'] {
  const context = useContext(CodeEditorContext);
  if (!context) throw new Error('CodeEditorProvider is missing');
  return context.register;
}

export function useCodeEditorPreviewRegistration(): CodeEditorContextValue['registerPreview'] {
  const context = useContext(CodeEditorContext);
  if (!context) throw new Error('CodeEditorProvider is missing');
  return context.registerPreview;
}

export function useCodeEditorHostRequested(): boolean {
  return useSyncExternalStore(
    subscribeCodeEditorHost,
    () => codeEditorHostRequested,
    () => false,
  );
}
