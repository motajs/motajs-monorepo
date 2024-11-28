import { useStatic } from "./state";

export const useOnCreate = (action: () => void) => {
  useStatic(action);
};
