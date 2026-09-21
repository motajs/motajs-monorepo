import * as Blockly from 'blockly';

export const blocklyLightTheme = Blockly.Themes.Classic;

export const blocklyDarkTheme = Blockly.Theme.defineTheme('motajs-dark', {
  name: 'motajs-dark',
  base: Blockly.Themes.Classic,
  componentStyles: {
    workspaceBackgroundColour: '#1f2024',
    toolboxBackgroundColour: '#292a2f',
    toolboxForegroundColour: '#d7d9df',
    flyoutBackgroundColour: '#303137',
    flyoutForegroundColour: '#f0f1f4',
    flyoutOpacity: 1,
    scrollbarColour: '#8b8d96',
    scrollbarOpacity: 0.55,
    insertionMarkerColour: '#ffffff',
    insertionMarkerOpacity: 0.35,
    markerColour: '#69a7ff',
    cursorColour: '#69a7ff',
    selectedGlowColour: '#69a7ff',
    selectedGlowOpacity: 0.35,
    replacementGlowColour: '#ffca5c',
    replacementGlowOpacity: 0.45,
  },
});
