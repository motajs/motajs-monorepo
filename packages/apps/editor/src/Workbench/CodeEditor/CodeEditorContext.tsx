import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type FC,
  type ReactNode,
} from "react";

export interface CodeEditorOpenRequest {
  contextId: string;
  initialValue: string;
  lint?: boolean;
  preview?: unknown;
  onPreview?(value: string): void | Promise<void>;
  scrollTop?: number;
  onConfirm(value: string): void | Promise<void>;
  onCancel?(): void;
}

export interface CodeEditorCapability {
  open(request: CodeEditorOpenRequest): void;
}

type CodeEditorOpener = (request: CodeEditorOpenRequest) => void;

interface CodeEditorContextValue extends CodeEditorCapability {
  register(opener: CodeEditorOpener): () => void;
  registerPreview(previewer: (mode: unknown, value: string) => void | Promise<void>): () => void;
}

const CodeEditorContext = createContext<CodeEditorContextValue | null>(null);

export const CodeEditorProvider: FC<{ children?: ReactNode }> = ({ children }) => {
  const openerRef = useRef<CodeEditorOpener | null>(null);
  const pendingRef = useRef<CodeEditorOpenRequest | null>(null);
  const previewerRef = useRef<((mode: unknown, value: string) => void | Promise<void>) | null>(null);

  const open = useCallback((request: CodeEditorOpenRequest) => {
    const normalized = request.preview && !request.onPreview && previewerRef.current
      ? { ...request, onPreview: (value: string) => previewerRef.current?.(request.preview, value) }
      : request;
    const opener = openerRef.current;
    if (opener) {
      opener(normalized);
      return;
    }
    pendingRef.current = normalized;
  }, []);

  const register = useCallback((opener: CodeEditorOpener) => {
    openerRef.current = opener;
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending) opener(pending);

    return () => {
      if (openerRef.current === opener) openerRef.current = null;
    };
  }, []);

  const registerPreview = useCallback((previewer: (mode: unknown, value: string) => void | Promise<void>) => {
    previewerRef.current = previewer;
    return () => {
      if (previewerRef.current === previewer) previewerRef.current = null;
    };
  }, []);

  const value = useMemo(() => ({ open, register, registerPreview }), [open, register, registerPreview]);
  return <CodeEditorContext.Provider value={value}>{children}</CodeEditorContext.Provider>;
};

export function useCodeEditor(): CodeEditorCapability {
  const context = useContext(CodeEditorContext);
  if (!context) throw new Error("CodeEditorProvider is missing");
  return context;
}

export function useCodeEditorRegistration(): CodeEditorContextValue["register"] {
  const context = useContext(CodeEditorContext);
  if (!context) throw new Error("CodeEditorProvider is missing");
  return context.register;
}

export function useCodeEditorPreviewRegistration(): CodeEditorContextValue["registerPreview"] {
  const context = useContext(CodeEditorContext);
  if (!context) throw new Error("CodeEditorProvider is missing");
  return context.registerPreview;
}
