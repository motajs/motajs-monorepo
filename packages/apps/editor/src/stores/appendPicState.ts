import { Store } from "@tanstack/store";
import { useStore } from "@tanstack/react-store";
import type { PrefabInfo } from "@/services/prefab";

interface AppendPicState {
  template: PrefabInfo | null;
}

export const appendPicStateStore = new Store<AppendPicState>({
  template: null,
});

export function setAppendPicTemplate(template: PrefabInfo | null): void {
  appendPicStateStore.setState((state) => ({
    ...state,
    template,
  }));
}

export function consumeAppendPicTemplate(): PrefabInfo | null {
  const template = appendPicStateStore.state.template;
  setAppendPicTemplate(null);
  return template;
}

export function useAppendPicTemplate(): PrefabInfo | null {
  return useStore(appendPicStateStore, (state) => state.template);
}
