import { useCallback, useState } from 'react';
import { ModalShell } from '../shared/ModalShell';
import type { SelectMaterialOptions, UseModalReturn } from '../shared/types';
import { SelectMaterialContent } from './SelectMaterialContent';

interface SelectMaterialState extends SelectMaterialOptions {
  resolve: (value: string[] | null) => void;
}

const normalizeValue = (value: string | string[] | undefined): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
    if (parsed != null) return [parsed];
  } catch {
    // 忽略解析错误，直接使用原值
  }
  return [value];
};

export function useSelectMaterialModal(): UseModalReturn<SelectMaterialOptions, string[]> {
  const [state, setState] = useState<SelectMaterialState | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  const open = useCallback((options: SelectMaterialOptions) => {
    return new Promise<string[] | null>((resolve) => {
      setState({ ...options, resolve });
      setSelected(normalizeValue(options.value));
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
      testId="select-material-modal"
      title={state.title}
      onClose={handleCancel}
      onConfirm={handleConfirm}
      overflow="auto"
    >
      <SelectMaterialContent
        value={selected}
        directory={state.directory}
        source={state.source}
        multiple={state.multiple}
        transform={state.transform}
        onChange={setSelected}
      />
    </ModalShell>
  ) : null;

  return [open, holder];
}
