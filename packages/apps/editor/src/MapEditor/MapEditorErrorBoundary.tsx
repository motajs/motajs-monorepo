import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class MapEditorErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return {
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Map editor failed", error, info.componentStack);
  }

  private retry = () => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div
          id="mid"
          data-test-id="map-editor-error"
          role="alert"
          style={{ padding: 16, color: "#b00020", whiteSpace: "pre-wrap" }}
        >
          <div>{`地图编辑区暂不可用：${this.state.error.message}`}</div>
          <button type="button" onClick={this.retry} style={{ marginTop: 12 }}>
            重新加载地图区
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
