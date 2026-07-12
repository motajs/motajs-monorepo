import { useRef } from "react";

export const useRefFrom = <T>(source: T) => {
  const ref = useRef(source);
  // eslint-disable-next-line react-hooks/refs
  ref.current = source;
  return ref;
}
