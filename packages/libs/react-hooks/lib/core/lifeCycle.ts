import { useStatic } from "./common";

export const useOnCreate = (action: () => void) => {
  useStatic(action);
};
