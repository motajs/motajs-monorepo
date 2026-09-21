import { useCallback, useState } from 'react';
import { ModalShell } from '../shared/ModalShell';
import type { CheckboxSetConfig, CheckboxSetOptions, UseModalReturn } from '../shared/types';
import { CheckboxSetContent } from './CheckboxSetContent';

interface CheckboxSetState extends CheckboxSetOptions {
  resolvedComments: CheckboxSetConfig;
  resolve: (value: Array<string | number> | null) => void;
}

const normalizeInitialValue = (value: unknown): Array<string | number> => {
  if (value == null || value === 0) return [];
  if (Array.isArray(value)) return value as Array<string | number>;
  return [value as string | number];
};

export function useCheckboxSetModal(): UseModalReturn<CheckboxSetOptions, Array<string | number>> {
  const [state, setState] = useState<CheckboxSetState | null>(null);
  const [selected, setSelected] = useState<Array<string | number>>([]);

  const open = useCallback((options: CheckboxSetOptions) => {
    return new Promise<Array<string | number> | null>((resolve) => {
      const resolvedComments = typeof options.comments === 'function' ? options.comments() : options.comments;
      setState({ ...options, resolvedComments, resolve });
      setSelected(normalizeInitialValue(options.value));
    });
  }, []);

  const handleConfirm = useCallback(() => {
    state?.resolve(selected);
    setState(null);
  }, [selected, state]);

  const handleCancel = useCallback(() => {
    state?.resolve(null);
    setState(null);
  }, [state]);

  const holder = state ? (
    <ModalShell
      testId="checkbox-set-modal"
      title={state.title}
      onClose={handleCancel}
      onConfirm={handleConfirm}
      overflow="auto"
    >
      <CheckboxSetContent value={selected} comments={state.resolvedComments} onChange={setSelected} />
    </ModalShell>
  ) : null;

  return [open, holder];
}
