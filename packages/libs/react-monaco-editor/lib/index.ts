export { default as MonacoEditor, clearMonacoViewState } from "./MonacoEditor";
export type { IMonacoEditorProps } from "./MonacoEditor";
export { MonacoModelScope } from "./modelScope";
export type { MonacoModelDescriptor } from "./modelScope";
export {
  MonacoLanguageLibraryScope,
  attachMonacoTypeSemanticHighlighting,
  formatMonacoDocument,
  getMonacoDiagnostics,
  monaco,
  revealMonacoPosition,
  setMonacoTheme,
} from "./languageScope";
export type {
  MonacoEditorInstance,
  MonacoExtraLibrary,
  MonacoMarker,
  MonacoTextModel,
} from "./languageScope";
export { initializeMonaco, preloadMonacoRuntime } from "./setup";
export * from "./hook";
