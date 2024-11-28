import { useSyncExternalStoreFromMemo } from "@motajs/react-hooks";
import { editor } from "monaco-editor";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";

export const useEditorInstance = () => {
  const [editorInstance, getEditorInstance] = useState<editor.IStandaloneCodeEditor>();

  return {
    editorInstance,
    getEditorInstance,
  };
};

export const useEditorCursorPosition = (editor?: editor.IStandaloneCodeEditor) => {
  return useSyncExternalStoreFromMemo(useMemo(() => {
    if (!editor) return;
    let position = editor.getPosition() ?? void 0;

    return [
      (onStoreChange: () => void) => {
        const disposable = editor.onDidChangeCursorPosition((e) => {
          position = e.position;
          onStoreChange();
        });
        return () => disposable.dispose();
      },
      () => position,
    ];
  }, [editor]));
};

export const useModelOptions = (model: editor.ITextModel) => {
  return useSyncExternalStore(
    useCallback((onStoreChange) => {
      const disposable = model.onDidChangeOptions(onStoreChange);
      return () => disposable.dispose();
    }, [model]),
    () => model.getOptions(),
  );
};
