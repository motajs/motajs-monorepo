import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type FC,
  type ReactNode,
} from 'react';

export interface EventEditorOpenRequest {
  contextId: string;
  entryType: string;
  initialValue: unknown;
  floorId?: string;
  position?: { x: number; y: number };
  onConfirm(value: unknown): void | Promise<void>;
  onDraftChange?(value: unknown): void;
  onCancel?(): void;
}

export interface EventEditorCapability {
  open(request: EventEditorOpenRequest): void;
}

type EventEditorOpener = (request: EventEditorOpenRequest) => void;

interface EventEditorContextValue extends EventEditorCapability {
  register(opener: EventEditorOpener): () => void;
}

const EventEditorContext = createContext<EventEditorContextValue | null>(null);

export const EventEditorProvider: FC<{ children?: ReactNode }> = ({ children }) => {
  const openerRef = useRef<EventEditorOpener | null>(null);
  const pendingRef = useRef<EventEditorOpenRequest | null>(null);

  const open = useCallback((request: EventEditorOpenRequest) => {
    if (openerRef.current) openerRef.current(request);
    else pendingRef.current = request;
  }, []);

  const register = useCallback((opener: EventEditorOpener) => {
    openerRef.current = opener;
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending) opener(pending);
    return () => {
      if (openerRef.current === opener) openerRef.current = null;
    };
  }, []);

  const value = useMemo(() => ({ open, register }), [open, register]);
  return <EventEditorContext.Provider value={value}>{children}</EventEditorContext.Provider>;
};

export function useEventEditor(): EventEditorCapability {
  const context = useContext(EventEditorContext);
  if (!context) throw new Error('EventEditorProvider is missing');
  return context;
}

export function useEventEditorRegistration(): EventEditorContextValue['register'] {
  const context = useContext(EventEditorContext);
  if (!context) throw new Error('EventEditorProvider is missing');
  return context.register;
}
