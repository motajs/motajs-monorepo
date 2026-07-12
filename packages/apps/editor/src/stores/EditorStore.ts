import { createStore } from "@motajs/react-store";
import { useState } from "react";
import { useConfigItem } from "./useEditorConfig";

const useEditorStore = () => {
  const [uiRatio, setUIRatio] = useState(1);

  const [theme, setTheme] = useConfigItem("theme", "editor_color_light");

  return {
    uiRatio,
    setUIRatio,
    theme,
    setTheme,
  }
};

export const EditorStore = createStore(useEditorStore);
