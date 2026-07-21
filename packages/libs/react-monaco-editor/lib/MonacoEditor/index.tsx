import "../localization/zh-cn";
import { useEffect, useState, type CSSProperties, type FC } from "react";
import * as monaco from "monaco-editor";
import { setupMonacoTextmate } from "../setup";
import { noop } from "lodash-es";
import { useCurrentFn, useNodeAsEffect, useWatch } from "@motajs/react-hooks";

const viewStates = new WeakMap<monaco.editor.ITextModel, monaco.editor.ICodeEditorViewState>();

export interface IMonacoEditorProps {
  model?: monaco.editor.ITextModel;
  options?: monaco.editor.IEditorOptions & monaco.editor.IGlobalEditorOptions;
  style?: CSSProperties;
  className?: string;
  getEditorInstance?: (editor?: monaco.editor.IStandaloneCodeEditor) => void;
  onMount?: (editor: monaco.editor.IStandaloneCodeEditor) => void | (() => void);
}

const MonacoEditor: FC<IMonacoEditorProps> = (props) => {
  const { model, options, style, className, getEditorInstance = noop, onMount } = props;

  const [editorInstance, setEditorInstance] = useState<monaco.editor.IStandaloneCodeEditor>();

  useEffect(() => {
    getEditorInstance(editorInstance);
  }, [editorInstance, getEditorInstance]);

  const disposeEditor = useCurrentFn((editor: monaco.editor.IStandaloneCodeEditor) => {
    if (model) {
      const viewState = editor.saveViewState();
      if (viewState) {
        viewStates.set(model, viewState);
      }
    }
    setEditorInstance(void 0);
    editor.dispose();
  });

  const mountContainerDiv = useNodeAsEffect<HTMLDivElement>((containerDiv) => {
    const editor = monaco.editor.create(containerDiv, {
      model,
      ...options,
    });
    void setupMonacoTextmate(editor);
    const disposeMount = onMount?.(editor);

    setEditorInstance(editor);

    return () => {
      disposeMount?.();
      disposeEditor(editor);
    };
  });

  useWatch(model, (model, prevModel) => {
    if (!editorInstance) return;
    if (prevModel) {
      const viewState = editorInstance.saveViewState();
      if (viewState) {
        viewStates.set(prevModel, viewState);
      }
    }
    if (model) {
      editorInstance.setModel(model);
      editorInstance.restoreViewState(viewStates.get(model) ?? null);
    } else {
      editorInstance.setModel(null);
    }
  });

  useEffect(() => {
    if (editorInstance && options) {
      editorInstance.updateOptions(options);
    }
  }, [options, editorInstance]);

  return (
    <div
      className={className}
      style={{
        display: "flex",
        position: "relative",
        ...style,
      }}
    >
      <div style={{ width: "100%", textAlign: "left" }} ref={mountContainerDiv} />
    </div>
  );
};

export default MonacoEditor;

// Kept beside the WeakMap so model scopes can release view-state entries.
// eslint-disable-next-line react-refresh/only-export-components
export function clearMonacoViewState(model: monaco.editor.ITextModel): void {
  viewStates.delete(model);
}
