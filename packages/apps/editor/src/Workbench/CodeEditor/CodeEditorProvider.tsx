import { useRef, type FC, type ReactNode } from 'react';
import {
  CodeEditorContext,
  requestCodeEditorHost,
  type CodeEditorContextValue,
  type CodeEditorOpenRequest,
  type CodeEditorOpener,
} from './CodeEditorContext';

export const CodeEditorProvider: FC<{ children?: ReactNode }> = ({ children }) => {
  const openerRef = useRef<CodeEditorOpener | null>(null);
  const pendingRef = useRef<CodeEditorOpenRequest | null>(null);
  const previewerRef = useRef<((mode: unknown, value: string) => void | Promise<void>) | null>(null);

  const valueRef = useRef<CodeEditorContextValue>(null);
  valueRef.current ??= {
    open(request) {
      requestCodeEditorHost();
      const normalized =
        request.preview && !request.onPreview && previewerRef.current
          ? { ...request, onPreview: (value: string) => previewerRef.current?.(request.preview, value) }
          : request;
      const opener = openerRef.current;
      if (opener) opener(normalized);
      else pendingRef.current = normalized;
    },
    register(opener) {
      openerRef.current = opener;
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (pending) opener(pending);
      return () => {
        if (openerRef.current === opener) openerRef.current = null;
      };
    },
    registerPreview(previewer) {
      previewerRef.current = previewer;
      return () => {
        if (previewerRef.current === previewer) previewerRef.current = null;
      };
    },
  };
  return <CodeEditorContext.Provider value={valueRef.current}>{children}</CodeEditorContext.Provider>;
};
