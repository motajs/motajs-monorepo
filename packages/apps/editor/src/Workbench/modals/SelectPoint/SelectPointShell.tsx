import { useEffect, type FC, type ReactNode } from 'react';
import { ContentBoundary } from '@/components/ContentBoundary';

/**
 * SelectPoint 专用外壳（布局与通用 ModalShell 不同）。
 * 独立成模块，使 useSelectPointModal.tsx 只导出 hook，保住 Fast Refresh 边界。
 */
export const SelectPointShell: FC<{
  title: string;
  onClose: () => void;
  onConfirm?: () => void;
  children: ReactNode;
}> = ({ title, onClose, onConfirm, children }) => {
  // ESC handled by ModalShell pattern, but we need custom implementation here
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.keyCode === 27) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div id="uieventDiv" data-test-id="select-point-modal" style={{ display: 'block' }}>
      <div id="uieventDialog" className="selectPointDialog">
        <div id="uieventHead">
          <span id="uieventTitle">{title}</span>
          <button id="uieventNo" data-test-id="select-point-cancel" onClick={onClose}>
            关闭
          </button>
          {onConfirm ? (
            <button id="uieventYes" data-test-id="select-point-confirm" onClick={onConfirm}>
              确定
            </button>
          ) : null}
        </div>
        <hr style={{ clear: 'both', marginTop: 0 }} />
        <ContentBoundary loadingUI={<></>}>{children}</ContentBoundary>
      </div>
    </div>
  );
};
