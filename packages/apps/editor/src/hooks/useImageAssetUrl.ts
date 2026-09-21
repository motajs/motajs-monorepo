import { useEffect, useMemo, useState } from 'react';
import { projectAssets } from '@/project/assets';
import { useSignal } from './useFs';

export function useImageAssetUrl(path: string): { url: string | null; revision: number } {
  const resource = useMemo(() => projectAssets.image(path), [path]);
  const content = useSignal(resource.content);
  const [presentation, setPresentation] = useState<{ url: string | null; revision: number }>({
    url: null,
    revision: 0,
  });

  useEffect(() => {
    if (content.status === 'idle') void resource.ensureLoaded();
  }, [content.status, resource]);

  useEffect(() => {
    if (content.status !== 'loaded') return;
    const bytes = new Uint8Array(content.value.bytes);
    const url = URL.createObjectURL(new Blob([bytes.buffer], { type: 'image/png' }));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- object URL 的创建与 cleanup 中的 revoke 同属一个生命周期，url 无法在渲染期派生
    setPresentation({ url, revision: content.value.revision });
    return () => URL.revokeObjectURL(url);
  }, [content]);

  return presentation;
}
