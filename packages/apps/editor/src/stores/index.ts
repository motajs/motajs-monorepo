import { mergeStores } from "@motajs/react-store";
import { EditorStore } from "./EditorStore";
import { PanelStore } from "./PanelStore";

export const GlobalStore = mergeStores([
  EditorStore,
  PanelStore,
]);

// 导出独立的状态管理
export {
  prefabStateStore,
  setCurrentPrefabInfo,
  setCurrentPrefabSelection,
  useCurrentPrefabSelection,
  getCurrentPrefabSelection,
} from "./prefabState";
export {
  locStateStore,
  setCurrentLocPos,
  setCurrentLocFloorId,
  useCurrentLocSelection,
  getCurrentLocSelection,
} from "./locState";
export { editorStateStore, setCurrentFloorId, useCurrentFloorId } from "./editorState";
export {
  appendPicStateStore,
  consumeAppendPicTemplate,
  setAppendPicTemplate,
  useAppendPicTemplate,
} from "./appendPicState";
