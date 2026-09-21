import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { RuntimeContext, type RuntimeState, type RuntimeSurfaceLease } from './RuntimeContext';
import {
  RUNTIME_PROTOCOL_VERSION,
  type HostMessage,
  type HostRequest,
  type HostRequestPayload,
  type ProjectResourceChange,
  type RuntimeLanguageSnapshot,
  type RuntimeMessage,
  type RuntimeStatusBarRequest,
  type RuntimeUIPreviewRequest,
} from './protocol';
import { RuntimeResourceGateway } from './RuntimeResourceGateway';
import { getEditorEnvironment } from '@/environment';

const START_TIMEOUT = 20_000;
const REQUEST_TIMEOUT = 8_000;

export function RuntimeProvider({ children }: { children?: ReactNode }) {
  const [state, setState] = useState<RuntimeState>({ status: 'starting' });
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const hiddenRef = useRef<HTMLDivElement | null>(null);
  const portRef = useRef<MessagePort | null>(null);
  const gatewayRef = useRef(new RuntimeResourceGateway());
  const sequenceRef = useRef(0);
  const pendingRef = useRef(
    new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: number }>(),
  );
  const leaseRef = useRef<RuntimeSurfaceLease | null>(null);
  const automaticRetryRef = useRef(0);
  const changedResourcesRef = useRef(new Map<string, ProjectResourceChange>());
  const changeTimerRef = useRef<number | null>(null);
  const startGenerationRef = useRef(0);
  const previewGenerationRef = useRef(0);
  const previewQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    gatewayRef.current.setChangeListener((change) => {
      changedResourcesRef.current.set(change.path, change);
      if (changeTimerRef.current != null) return;
      changeTimerRef.current = window.setTimeout(() => {
        changeTimerRef.current = null;
        const changes = [...changedResourcesRef.current.values()];
        changedResourcesRef.current.clear();
        portRef.current?.postMessage({ type: 'resources-changed', changes } satisfies HostMessage);
      }, 300);
    });
    return () => {
      gatewayRef.current.dispose();
      if (changeTimerRef.current != null) window.clearTimeout(changeTimerRef.current);
    };
  }, []);

  const rejectPending = useCallback((error: Error) => {
    for (const pending of pendingRef.current.values()) {
      window.clearTimeout(pending.timer);
      pending.reject(error);
    }
    pendingRef.current.clear();
  }, []);

  const send = useCallback(
    <T,>(request: HostRequestPayload): Promise<T> => {
      const port = portRef.current;
      if (!port || state.status !== 'ready') return Promise.reject(new Error('Runtime unavailable'));
      const id = ++sequenceRef.current;
      return new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => {
          pendingRef.current.delete(id);
          reject(new Error('Runtime request timed out'));
        }, REQUEST_TIMEOUT);
        pendingRef.current.set(id, { resolve: (value) => resolve(value as T), reject, timer });
        port.postMessage({ ...request, id } satisfies HostRequest);
      });
    },
    [state.status],
  );

  const start = useCallback(async () => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const host = hiddenRef.current;
    if (host) {
      host.style.left = '-10000px';
      host.style.top = '0';
      host.style.pointerEvents = 'none';
      host.style.visibility = 'hidden';
    }
    setState({ status: 'starting' });
    rejectPending(new Error('Runtime restarted'));
    portRef.current?.close();
    portRef.current = null;
    const generation = ++startGenerationRef.current;
    const { runtime, preview } = getEditorEnvironment().endpoints;
    const runtimeUrl = new URL(runtime);
    runtimeUrl.searchParams.set('instance', String(Date.now()));
    iframe.src = runtimeUrl.href;
    await new Promise<void>((resolve, reject) => {
      let ready = false;
      const timer = window.setTimeout(() => {
        if (generation === startGenerationRef.current) reject(new Error('Runtime startup timed out'));
      }, START_TIMEOUT);
      iframe.onload = () => {
        if (generation !== startGenerationRef.current) return;
        const channel = new MessageChannel();
        portRef.current = channel.port1;
        channel.port1.onmessage = (event: MessageEvent<RuntimeMessage>) => {
          const message = event.data;
          if (message.type === 'ready') {
            window.clearTimeout(timer);
            if (message.version !== RUNTIME_PROTOCOL_VERSION) {
              reject(new Error('Runtime protocol mismatch'));
              return;
            }
            ready = true;
            setState({ status: 'ready', instanceId: message.instanceId });
            resolve();
            return;
          }
          if (message.type === 'fatal') {
            const error = new Error(message.message);
            window.clearTimeout(timer);
            rejectPending(error);
            leaseRef.current?.close();
            if (!ready) reject(error);
            else if (automaticRetryRef.current < 1) {
              automaticRetryRef.current += 1;
              // eslint-disable-next-line react-hooks/immutability -- 重试必须调用当前的 start 回调；改用 ref 打破该引用会改变握手重试的时序
              window.setTimeout(() => void start(), 0);
            } else setState({ status: 'error', error });
            return;
          }
          if (message.type === 'resource') {
            void (async () => {
              try {
                if (message.binary) {
                  const resource = await gatewayRef.current.readBinary(message.path);
                  const bytes = resource.bytes.slice().buffer;
                  channel.port1.postMessage(
                    {
                      type: 'resource-response',
                      id: message.id,
                      ok: true,
                      revision: resource.revision,
                      bytes,
                    } satisfies HostMessage,
                    [bytes],
                  );
                } else {
                  const resource = await gatewayRef.current.readText(message.path);
                  channel.port1.postMessage({
                    type: 'resource-response',
                    id: message.id,
                    ok: true,
                    revision: resource.revision,
                    text: resource.text,
                  } satisfies HostMessage);
                }
              } catch (error) {
                channel.port1.postMessage({
                  type: 'resource-response',
                  id: message.id,
                  ok: false,
                  error: error instanceof Error ? error.message : String(error),
                } satisfies HostMessage);
              }
            })();
            return;
          }
          if (message.type === 'response') {
            const pending = pendingRef.current.get(message.id);
            if (!pending) return;
            window.clearTimeout(pending.timer);
            pendingRef.current.delete(message.id);
            if (message.ok) {
              automaticRetryRef.current = 0;
              pending.resolve(message.payload ?? { width: message.width ?? 416, height: message.height ?? 416 });
            } else pending.reject(new Error(message.error ?? 'Runtime request failed'));
          }
        };
        channel.port1.start();
        iframe.contentWindow?.postMessage(
          {
            type: 'mota-runtime-connect',
            version: RUNTIME_PROTOCOL_VERSION,
            previewUrl: preview,
          },
          '*',
          [channel.port2],
        );
      };
    }).catch((error) => {
      const normalized = error instanceof Error ? error : new Error(String(error));
      if (automaticRetryRef.current < 1) {
        automaticRetryRef.current += 1;
        window.setTimeout(() => void start(), 0);
      } else setState({ status: 'error', error: normalized });
    });
  }, [rejectPending]);

  useEffect(() => {
    void start();
    return () => {
      rejectPending(new Error('RuntimeProvider unmounted'));
      portRef.current?.close();
    };
  }, [rejectPending, start]);

  const createLease = useCallback(
    (size: { width: number; height: number }): RuntimeSurfaceLease => {
      const iframe = iframeRef.current!;
      let stopPositioning: (() => void) | null = null;
      const lease: RuntimeSurfaceLease = {
        id: crypto.randomUUID(),
        width: size.width,
        height: size.height,
        attach(container) {
          const host = hiddenRef.current;
          if (!host) return;
          host.style.pointerEvents = 'auto';
          host.style.visibility = 'visible';
          const position = () => {
            const rect = container.getBoundingClientRect();
            host.style.left = `${rect.left}px`;
            host.style.top = `${rect.top}px`;
            host.style.width = `${size.width}px`;
            host.style.height = `${size.height}px`;
          };
          position();
          const observer = new ResizeObserver(position);
          observer.observe(container);
          window.addEventListener('resize', position);
          window.addEventListener('scroll', position, true);
          stopPositioning = () => {
            observer.disconnect();
            window.removeEventListener('resize', position);
            window.removeEventListener('scroll', position, true);
          };
          iframe.style.width = `${size.width}px`;
          iframe.style.height = `${size.height}px`;
        },
        close() {
          if (leaseRef.current !== lease) return;
          leaseRef.current = null;
          stopPositioning?.();
          stopPositioning = null;
          const host = hiddenRef.current;
          if (host) {
            host.style.left = '-10000px';
            host.style.top = '0';
            host.style.pointerEvents = 'none';
            host.style.visibility = 'hidden';
          }
          void send({ type: 'close-preview' }).catch(() => undefined);
        },
      };
      leaseRef.current = lease;
      return lease;
    },
    [send],
  );

  const queuePreview = useCallback(
    (request: HostRequestPayload): Promise<RuntimeSurfaceLease> => {
      const generation = ++previewGenerationRef.current;
      leaseRef.current?.close();
      const operation = previewQueueRef.current.then(async () => {
        if (generation !== previewGenerationRef.current) throw new DOMException('Preview superseded', 'AbortError');
        const size = await send<{ width: number; height: number }>(request);
        if (generation !== previewGenerationRef.current) throw new DOMException('Preview superseded', 'AbortError');
        return createLease(size);
      });
      previewQueueRef.current = operation.then(
        () => undefined,
        () => undefined,
      );
      return operation;
    },
    [createLease, send],
  );

  const capability = useMemo(
    () => ({
      state,
      previewUI: async (request: RuntimeUIPreviewRequest) => {
        try {
          return await queuePreview({ type: 'render-ui', payload: request });
        } catch (error) {
          if (!(error instanceof DOMException && error.name === 'AbortError')) {
            void send({ type: 'close-preview' }).catch(() => undefined);
          }
          throw error;
        }
      },
      previewStatusBar: async (request: RuntimeStatusBarRequest) => {
        try {
          return await queuePreview({ type: 'render-status-bar', payload: request });
        } catch (error) {
          if (!(error instanceof DOMException && error.name === 'AbortError')) {
            void send({ type: 'close-preview' }).catch(() => undefined);
          }
          throw error;
        }
      },
      languageSnapshot: () => send<RuntimeLanguageSnapshot>({ type: 'language-snapshot' }),
      retry: async () => {
        automaticRetryRef.current = 0;
        await start();
      },
    }),
    [queuePreview, send, start, state],
  );

  return (
    <RuntimeContext.Provider value={capability}>
      {children}
      <div
        ref={hiddenRef}
        data-test-id="runtime-host"
        data-runtime-status={state.status}
        data-runtime-instance-id={state.instanceId}
        data-runtime-error={state.error?.message}
        style={{
          position: 'fixed',
          left: -10000,
          top: 0,
          zIndex: 100000,
          width: 416,
          height: 416,
          overflow: 'hidden',
          pointerEvents: 'none',
          visibility: 'hidden',
        }}
      >
        <iframe
          ref={iframeRef}
          data-test-id="runtime-iframe"
          title="Mota runtime"
          sandbox="allow-scripts allow-same-origin"
          style={{ border: 0, width: 416, height: 416 }}
        />
      </div>
    </RuntimeContext.Provider>
  );
}
