import { useEffect, type ChangeEvent, type FC, type ReactNode } from "react";

export interface ModalShellSelectOption {
  value: string;
  label: string;
}

interface ModalShellProps {
  testId?: string;
  title: string;
  onClose: () => void;
  onConfirm?: () => void;
  headerExtra?: ReactNode;
  selectOptions?: ModalShellSelectOption[];
  selectValue?: string;
  onSelectChange?: (value: string) => void;
  overflow?: "auto" | "hidden";
  children: ReactNode;
}

export const ModalShell: FC<ModalShellProps> = (props) => {
  const {
    title,
    onClose,
    onConfirm,
    headerExtra,
    selectOptions,
    selectValue,
    onSelectChange,
    overflow = "hidden",
    children,
    testId,
  } = props;

  // ESC 键关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.keyCode === 27) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleSelectChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onSelectChange?.(event.target.value);
  };

  const showSelect = selectOptions && selectOptions.length > 0;

  return (
    <div id="uieventDiv" data-test-id={testId} style={{ display: "block" }}>
      <div id="uieventDialog">
        <div id="uieventHead">
          <span id="uieventTitle">{title}</span>
          {showSelect && (
            <select
              id="uieventSelect"
              style={{ marginLeft: 20 }}
              value={selectValue}
              onChange={handleSelectChange}
            >
              {selectOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
          {headerExtra}
          <button id="uieventNo" data-test-id={testId ? `${testId}-cancel` : undefined} onClick={onClose}>关闭</button>
          {onConfirm && (
            <button id="uieventYes" data-test-id={testId ? `${testId}-confirm` : undefined} onClick={onConfirm}>确定</button>
          )}
        </div>
        <hr style={{ clear: "both", marginTop: 0 }} />
        <div id="uieventBody" style={{ overflow }}>
          {children}
        </div>
      </div>
    </div>
  );
};
