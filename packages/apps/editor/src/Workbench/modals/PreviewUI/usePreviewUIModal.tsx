import { useCallback, useEffect, useState } from 'react';
import { buildRuntimePreviewContext, RuntimeSurface, useRuntimePreview, type RuntimeSurfaceLease } from '@/runtime';
import { ModalShell, type ModalShellSelectOption } from '../shared/ModalShell';
import type { PreviewUIOptions, UseModalReturn } from '../shared/types';
import { PreviewUIContent } from './PreviewUIContent';

interface PreviewUIState extends PreviewUIOptions {
  resolve: (value: null) => void;
}

const PREVIEW_OPTIONS: ModalShellSelectOption[] = [
  { value: 'thumbnail', label: '缩略图' },
  { value: '#000000', label: '黑色' },
  { value: '#FFFFFF', label: '白色' },
];

export function usePreviewUIModal(): UseModalReturn<PreviewUIOptions, null> {
  const [state, setState] = useState<PreviewUIState | null>(null);
  const [background, setBackground] = useState('thumbnail');
  const [lease, setLease] = useState<RuntimeSurfaceLease | null>(null);
  const [runtimeError, setRuntimeError] = useState<Error | null>(null);
  const [previewRevision, setPreviewRevision] = useState(0);
  const runtime = useRuntimePreview();

  const open = useCallback((options: PreviewUIOptions) => {
    return new Promise<null>((resolve) => {
      setRuntimeError(null);
      setState({ ...options, resolve });
      setBackground('thumbnail');
    });
  }, []);

  const handleClose = useCallback(() => {
    lease?.close();
    setLease(null);
    setRuntimeError(null);
    state?.resolve(null);
    setState(null);
  }, [lease, state]);

  useEffect(() => {
    if (!state || runtime.state.status !== 'ready') return;
    let active = true;
    void buildRuntimePreviewContext()
      .then((context) => runtime.previewUI({ list: state.runtimeList ?? state.list, background, context }))
      .then((nextLease) => {
        if (!active) nextLease.close();
        else {
          setRuntimeError(null);
          setLease(nextLease);
        }
      })
      .catch((error) => {
        if (!active) return;
        setLease(null);
        setRuntimeError(error instanceof Error ? error : new Error(String(error)));
      });
    return () => {
      active = false;
    };
  }, [background, previewRevision, runtime, state]);

  useEffect(() => {
    if (runtime.state.status !== 'error' || !lease) return;
    lease.close();
    queueMicrotask(() => setLease((current) => (current === lease ? null : current)));
  }, [lease, runtime.state.status]);

  const runtimeUnavailable = runtime.state.status === 'error';
  const previewFailed = !runtimeUnavailable && runtimeError != null;

  const holder = state ? (
    <ModalShell
      testId="preview-ui-modal"
      title="UI绘制预览"
      onClose={handleClose}
      selectOptions={PREVIEW_OPTIONS}
      selectValue={background}
      onSelectChange={(value) => {
        setRuntimeError(null);
        setBackground(value);
      }}
    >
      {lease ? <RuntimeSurface lease={lease} testId="runtime-ui-preview" /> : null}
      {!lease && runtime.state.status !== 'error' && !runtimeError ? (
        <div data-test-id="runtime-ui-preview-loading" style={{ width: 416, height: 416 }} />
      ) : null}
      {!lease && (runtimeUnavailable || previewFailed) ? (
        <div
          data-test-id="runtime-ui-preview-fallback"
          data-runtime-error={runtime.state.error?.message ?? runtimeError?.message}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <div>{runtimeUnavailable ? 'Runtime 不可用，当前为静态预览' : 'Runtime 绘制失败，当前为静态预览'}</div>
              <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>
                {runtime.state.error?.message ?? runtimeError?.message}
              </div>
            </div>
            <button
              data-test-id="runtime-retry"
              onClick={() => {
                if (runtimeUnavailable) void runtime.retry();
                else {
                  setRuntimeError(null);
                  setPreviewRevision((revision) => revision + 1);
                }
              }}
            >
              重试
            </button>
          </div>
          <PreviewUIContent list={state.list} background={background} />
        </div>
      ) : null}
    </ModalShell>
  ) : null;

  return [open, holder];
}
