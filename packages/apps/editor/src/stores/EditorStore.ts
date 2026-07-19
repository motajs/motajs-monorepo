import { createStore } from "@motajs/react-store";
import { useCallback, useState } from "react";
import { useConfigItem } from "./useEditorConfig";

type EditorTheme = "editor_color_light" | "editor_color_dark";
const THEME_STORAGE_KEY = "motajs-editor-theme";

function storedTheme(): EditorTheme {
  const value = typeof window === "undefined" ? null : window.localStorage.getItem(THEME_STORAGE_KEY);
  return value === "editor_color_dark" ? value : "editor_color_light";
}

const useEditorStore = () => {
  const [uiRatio, setUIRatio] = useState(1);

  const [theme, setConfigTheme] = useConfigItem<EditorTheme>("theme", storedTheme());
  const setTheme = useCallback((next: EditorTheme) => {
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
    setConfigTheme(next);
  }, [setConfigTheme]);

  return {
    uiRatio,
    setUIRatio,
    theme,
    setTheme,
  }
};

export const EditorStore = createStore(useEditorStore);
