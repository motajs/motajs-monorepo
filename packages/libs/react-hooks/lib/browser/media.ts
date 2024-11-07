import { useMemo } from "react";
import { useSyncExternalStoreFromMemo } from "@/core/common";

export function useMediaQuery(query: string) {
  return useSyncExternalStoreFromMemo(useMemo(() => {
    const mediaQueryList = window.matchMedia(query);

    return [
      (onStoreChange) => {
        mediaQueryList.addEventListener("change", onStoreChange);
        return () => mediaQueryList.removeEventListener("change", onStoreChange);
      },
      () => mediaQueryList.matches,
    ];
  }, [query]));
}
