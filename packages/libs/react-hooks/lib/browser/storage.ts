import { useState } from "react";
import { useDependentState, useSetStateWithOnChange } from "@/core/state";
import { State } from "../utils/type";
import { Optional } from "@motajs/utils";

export const useStorageItem = (storage: Storage, key: string, defaultValue?: string): State<Optional<string>> => {
  const [rawValue, setRawValue] = useDependentState(key, () => storage.getItem(key) ?? void 0);

  const setValue = useSetStateWithOnChange(setRawValue, (value) => {
    if (value === void 0) {
      storage.removeItem(key);
    } else {
      storage.setItem(key, value);
    }
  });

  return [rawValue ?? defaultValue, setValue];
};

export const useLocalStorageItem = (key: string, defaultValue?: string) => {
  return useStorageItem(localStorage, key, defaultValue);
};

export const createUseStorageItem = (storage: Storage, key: string, defaultValue?: string) => {
  const useStorageItem = (): State<Optional<string>> => {
    const [rawValue, setRawValue] = useState(() => storage.getItem(key) ?? void 0);

    const setValue = useSetStateWithOnChange(setRawValue, (value) => {
      if (value === void 0) {
        storage.removeItem(key);
      } else {
        storage.setItem(key, value);
      }
    });

    return [rawValue ?? defaultValue, setValue];
  };

  return useStorageItem;
};

export const createUseLocalStorageItem = (key: string, defaultValue?: string) => {
  return createUseStorageItem(localStorage, key, defaultValue);
};
