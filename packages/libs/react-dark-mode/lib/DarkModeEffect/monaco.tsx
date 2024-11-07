import { DarkModeStore } from "@/store";
import { FC, useLayoutEffect } from "react";
import * as monaco from "monaco-editor";

const DarkModeEffectMonaco: FC = () => {
  const { isDarkMode } = DarkModeStore.useStore();

  useLayoutEffect(() => {
    if (isDarkMode) {
      monaco.editor.setTheme("dark-plus");
    } else {
      monaco.editor.setTheme("light-plus");
    }
  }, [isDarkMode]);

  return null;
};

export default DarkModeEffectMonaco;
