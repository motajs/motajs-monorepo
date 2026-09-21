import { useCallback, useEffect, useMemo, useState } from 'react';
import { ModalShell, type ModalShellSelectOption } from '../shared/ModalShell';
import type { SearchFlagsOptions, UseModalReturn } from '../shared/types';
import { SearchFlagsContent } from './SearchFlagsContent';
import { projectModel } from '@/project/model/projectModel';
import { useSignal } from '@/hooks/useFs';

interface SearchFlagsState {
  resolve: (value: null) => void;
}

export function useSearchFlagsModal(): UseModalReturn<SearchFlagsOptions, null> {
  const [state, setState] = useState<SearchFlagsState | null>(null);
  const [selectedFlag, setSelectedFlag] = useState('');
  const resource = useMemo(() => projectModel.flagUsage(), []);
  const content = useSignal(resource.content);
  const index = content.status === 'loaded' ? content.value : undefined;

  const flagOptions = useMemo((): ModalShellSelectOption[] => {
    return (index?.flags ?? []).map((flag) => ({
      value: `flag:${flag}`,
      label: `flag:${flag}`,
    }));
  }, [index]);

  const open = useCallback(
    (_options: SearchFlagsOptions) => {
      return new Promise<null>((resolve) => {
        setState({ resolve });
        void resource.reload();
        if (index?.flags[0]) setSelectedFlag(`flag:${index.flags[0]}`);
      });
    },
    [index, resource],
  );

  useEffect(() => {
    if (state && !selectedFlag && index?.flags[0]) setSelectedFlag(`flag:${index.flags[0]}`);
  }, [index, selectedFlag, state]);

  const handleClose = useCallback(() => {
    state?.resolve(null);
    setState(null);
  }, [state]);

  const holder = state ? (
    <ModalShell
      testId="search-flags-modal"
      title="搜索变量"
      onClose={handleClose}
      selectOptions={flagOptions}
      selectValue={selectedFlag}
      onSelectChange={setSelectedFlag}
      overflow="auto"
    >
      <SearchFlagsContent selectedFlag={selectedFlag} index={index} />
    </ModalShell>
  ) : null;

  return [open, holder];
}
