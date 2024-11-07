import { DarkModeStore } from "@/store";
import { FC, useLayoutEffect } from "react";

const ATTRIBUTE_NAME = "theme-mode";

const DarkModeEffectSemi: FC = () => {
  const { isDarkMode } = DarkModeStore.useStore();

  useLayoutEffect(() => {
    const body = document.body;
    if (isDarkMode) {
      body.setAttribute(ATTRIBUTE_NAME, "dark");
    } else {
      body.removeAttribute(ATTRIBUTE_NAME);
    }
  }, [isDarkMode]);

  return null;
};

export default DarkModeEffectSemi;
