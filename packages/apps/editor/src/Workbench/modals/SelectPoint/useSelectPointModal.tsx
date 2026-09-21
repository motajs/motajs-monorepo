import { Component, type ErrorInfo, type ReactNode, useCallback, useRef, useState } from 'react';
import type { SelectPointOptions, SelectPointResult, UseModalReturn } from '../shared/types';
import { SelectPointContent } from './SelectPointContent';
import { SelectPointShell } from './SelectPointShell';

interface SelectPointState extends SelectPointOptions {
  resolve: (value: SelectPointResult | null) => void;
}

class SelectPointErrorBoundary extends Component<
  {
    children: ReactNode;
    onClose: () => void;
  },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: unknown): { error: Error } {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('SelectPoint modal failed', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <SelectPointShell title="地图选点暂不可用" onClose={this.props.onClose}>
          <div id="uieventBody" role="alert" data-test-id="select-point-error" style={{ padding: 16 }}>
            {this.state.error.message}
          </div>
        </SelectPointShell>
      );
    }
    return this.props.children;
  }
}

export function useSelectPointModal(): UseModalReturn<SelectPointOptions, SelectPointResult> {
  const [state, setState] = useState<SelectPointState | null>(null);
  const [title, setTitle] = useState('地图选点');
  const resultRef = useRef<SelectPointResult>({ floorId: '', x: 0, y: 0 });

  const open = useCallback((options: SelectPointOptions) => {
    return new Promise<SelectPointResult | null>((resolve) => {
      setState({ ...options, resolve });
      setTitle(options.multiple ? '地图选点【右键多选】' : '地图选点');
    });
  }, []);

  const handleConfirm = useCallback(() => {
    state?.resolve(resultRef.current);
    setState(null);
  }, [state]);

  const handleCancel = useCallback(() => {
    state?.resolve(null);
    setState(null);
  }, [state]);

  const handleResultChange = useCallback((result: SelectPointResult) => {
    resultRef.current = result;
  }, []);

  const holder = state ? (
    <SelectPointErrorBoundary onClose={handleCancel}>
      <SelectPointShell title={title} onClose={handleCancel} onConfirm={handleConfirm}>
        <SelectPointContent
          initialFloorId={state.floorId}
          floorSelection={state.floorSelection}
          initialX={state.x}
          initialY={state.y}
          initialBigmap={state.bigmap}
          multiple={state.multiple}
          onTitleChange={setTitle}
          onResultChange={handleResultChange}
          onConfirm={handleConfirm}
        />
      </SelectPointShell>
    </SelectPointErrorBoundary>
  ) : null;

  return [open, holder];
}
