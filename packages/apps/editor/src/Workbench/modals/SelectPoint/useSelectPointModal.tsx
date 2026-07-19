import { ContentBoundary } from "@/components/ContentBoundary";
import { Component, type ErrorInfo, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import type { SelectPointOptions, SelectPointResult, UseModalReturn } from "../shared/types";
import { SelectPointContent } from "./SelectPointContent";

interface SelectPointState extends SelectPointOptions {
  resolve: (value: SelectPointResult | null) => void;
}

// Custom shell for SelectPoint (different layout from ModalShell)
const SelectPointShell: React.FC<{
  title: string;
  onClose: () => void;
  onConfirm?: () => void;
  children: React.ReactNode;
}> = ({ title, onClose, onConfirm, children }) => {
  // ESC handled by ModalShell pattern, but we need custom implementation here
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.keyCode === 27) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div id="uieventDiv" data-test-id="select-point-modal" style={{ display: "block" }}>
      <div id="uieventDialog" className="selectPointDialog">
        <div id="uieventHead">
          <span id="uieventTitle">{title}</span>
          <button id="uieventNo" data-test-id="select-point-cancel" onClick={onClose}>关闭</button>
          {onConfirm
            ? <button id="uieventYes" data-test-id="select-point-confirm" onClick={onConfirm}>确定</button>
            : null}
        </div>
        <hr style={{ clear: "both", marginTop: 0 }} />
        <ContentBoundary loadingUI={<></>}>
          {children}
        </ContentBoundary>
      </div>
    </div>
  );
};

class SelectPointErrorBoundary extends Component<{
  children: ReactNode;
  onClose: () => void;
}, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: unknown): { error: Error } {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("SelectPoint modal failed", error, info.componentStack);
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
  const [title, setTitle] = useState("地图选点");
  const resultRef = useRef<SelectPointResult>({ floorId: "", x: 0, y: 0 });

  const open = useCallback((options: SelectPointOptions) => {
    return new Promise<SelectPointResult | null>((resolve) => {
      setState({ ...options, resolve });
      setTitle(options.multiple ? "地图选点【右键多选】" : "地图选点");
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

  const holder = state
    ? (
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
    )
    : null;

  return [open, holder];
}
