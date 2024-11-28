import { createStore } from "@motajs/react-store";
import { createUseLocalStorageItem, useMediaQuery, withAsBoolean } from "@motajs/react-hooks";

const useDarkModeConfig = withAsBoolean(createUseLocalStorageItem("base.darkMode"));

export const DarkModeStore = createStore(() => {
  const systemPreference = useMediaQuery("(prefers-color-scheme: dark)");
  const [userConfig = systemPreference, setUserConfig] = useDarkModeConfig();

  const isDarkMode = userConfig ?? systemPreference;

  return {
    isDarkMode,
    setIsDarkMode: setUserConfig,
  };
});
