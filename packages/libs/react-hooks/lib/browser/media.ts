import { useMemo } from "react";
import { useSyncExternalStoreFrom } from "@/core/common";

export function useMediaQuery(query: string) {
  return useSyncExternalStoreFrom(useMemo(() => {
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
