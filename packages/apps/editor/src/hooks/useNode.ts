import { useState } from 'react';

export const useNode = <T>() => {
  const [node, setNode] = useState<T | null>(null);

  const mount = (val: T) => {
    setNode(val);

    return () => setNode(null);
  };

  return [node, mount] as const;
};
