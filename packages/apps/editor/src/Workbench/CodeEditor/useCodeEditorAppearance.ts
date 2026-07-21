import { useConfigItem } from "@/stores/useEditorConfig";
import {
  DEFAULT_FONT_SIZE,
  FONT_BOLD_CONFIG_KEY,
  FONT_SIZE_CONFIG_KEY,
} from "./config/commands";

export interface CodeEditorAppearance {
  fontSize: number;
  fontBold: boolean;
  setFontSize(value: number): void;
  setFontBold(value: boolean): void;
}

export function useCodeEditorAppearance(): CodeEditorAppearance {
  const [fontSize, setFontSize] = useConfigItem(FONT_SIZE_CONFIG_KEY, DEFAULT_FONT_SIZE);
  const [fontBold, setFontBold] = useConfigItem(FONT_BOLD_CONFIG_KEY, false);
  return {
    fontSize,
    fontBold,
    setFontSize: (value) => setFontSize(Math.max(10, Math.min(32, Math.round(value)))),
    setFontBold,
  };
}
