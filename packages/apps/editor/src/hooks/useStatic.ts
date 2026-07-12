import { useState } from "react";

export const useStatic = <T>(initializer: () => T) => {
  const [data] = useState(initializer);
  return data;
};
