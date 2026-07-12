import { useRef, type ButtonHTMLAttributes, type FC, type MouseEvent } from "react";

interface LongPressButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onMouseDown" | "onMouseUp"> {
  /** 点击或长按时触发的回调 */
  onPress: () => void;
  /** 长按检测延迟（毫秒），默认 500ms */
  delay?: number;
  /** 长按时重复触发的间隔（毫秒），默认 150ms */
  interval?: number;
}

/**
 * 支持长按的按钮组件
 *
 * - 单击：触发一次 onPress
 * - 长按（超过 delay）：以 interval 间隔持续触发 onPress
 */
export const LongPressButton: FC<LongPressButtonProps> = ({
  onPress,
  delay = 500,
  interval = 150,
  children,
  ...buttonProps
}) => {
  const timerRef = useRef<number | null>(null);

  const handleMouseDown = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      // 标记进入长按模式
      timerRef.current = -1;
      const loop = () => {
        if (timerRef.current != null) {
          onPress();
          setTimeout(loop, interval);
        }
      };
      loop();
    }, delay);
  };

  const handleMouseUp = () => {
    if (timerRef.current != null && timerRef.current > 0) {
      // 未进入长按模式，视为单击
      clearTimeout(timerRef.current);
      onPress();
    }
    timerRef.current = null;
  };

  const handleMouseLeave = () => {
    // 鼠标离开时取消长按
    if (timerRef.current != null && timerRef.current > 0) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = null;
  };

  return (
    <button
      type="button"
      {...buttonProps}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </button>
  );
};
