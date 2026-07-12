import { useCallback, useState } from 'react';
import { createStore } from '@motajs/react-store';

/**
 * FoldStore - Manages fold/unfold state for table gap rows
 *
 * Provides state and methods for controlling which sections of the table
 * are collapsed or expanded.
 */

export interface FoldStoreValue {
  /** Set of currently folded field paths */
  foldedFields: Set<string>;
  /** Toggle fold state for a specific field */
  toggleFold: (field: string) => void;
  /** Fold all provided gap fields */
  foldAll: (gapFields: string[]) => void;
  /** Unfold all fields */
  unfoldAll: () => void;
}

function useFoldStore(): FoldStoreValue {
  const [foldedFields, setFoldedFields] = useState<Set<string>>(new Set());

  const toggleFold = useCallback((field: string) => {
    setFoldedFields((prev) => {
      const next = new Set(prev);
      if (next.has(field)) {
        next.delete(field);
      } else {
        next.add(field);
      }
      return next;
    });
  }, []);

  const foldAll = useCallback((gapFields: string[]) => {
    setFoldedFields(new Set(gapFields));
  }, []);

  const unfoldAll = useCallback(() => {
    setFoldedFields(new Set());
  }, []);

  return {
    foldedFields,
    toggleFold,
    foldAll,
    unfoldAll,
  };
}

export const FoldStore = createStore(useFoldStore);
