import { KeyboardEvent, ReactElement, useEffect, useRef } from 'react';

// 画布右键菜单：固定四项（复制选区 / 粘贴到此处 / 清空选区 / 取消选区），真实 role="menu" 与按钮菜单项。
// 位置用视口尺寸夹取 / 翻转，保证完整可见；打开即聚焦第一项，↑ / ↓ 在可用项之间移动，Enter 执行，Escape 关闭。
// 本阶段不出现任何事件相关项，也不出现图层设置项。

export interface IMapContextMenuProps {
  /** 指针在视口中的横坐标 */
  readonly x: number;
  /** 指针在视口中的纵坐标 */
  readonly y: number;
  /** 内部剪贴板是否非空 */
  readonly hasClipboard: boolean;
  /** 是否存在框选 */
  readonly hasSelection: boolean;
  /** 复制选区（无选区时复制指针格） */
  onCopy(): void;
  /** 以指针格为左上角粘贴 */
  onPaste(): void;
  /** 清空选区覆盖的格子 */
  onClear(): void;
  /** 只清除框选 */
  onCancelSelection(): void;
  /** 关闭菜单 */
  onClose(): void;
}

/** 菜单最小宽度（像素） */
const MENU_MIN_WIDTH = 160;

/** 菜单项高度（像素） */
const MENU_ITEM_HEIGHT = 32;

/** 菜单内边距（像素） */
const MENU_PADDING = 4;

/** 菜单项数量（本阶段固定四项） */
const MENU_ITEM_COUNT = 4;

/** 菜单高度估算（像素），用于靠近视口下边缘时翻转 */
const MENU_ESTIMATED_HEIGHT = MENU_ITEM_HEIGHT * MENU_ITEM_COUNT + MENU_PADDING * 2;

/** 菜单的最终视口坐标 */
interface IMapMenuPosition {
  /** 左边缘（像素） */
  readonly left: number;
  /** 上边缘（像素） */
  readonly top: number;
}

/** 一个菜单项的展示与行为 */
interface IMapMenuItem {
  /** 稳定的测试标识后缀 */
  readonly id: string;
  /** 展示文案，与 UI 契约逐字一致 */
  readonly label: string;
  /** 是否禁用 */
  readonly disabled: boolean;
  /** 点击后的动作 */
  readonly action: () => void;
}

/**
 * 算出菜单的最终位置：靠近右 / 下边缘时翻到指针另一侧，再夹到视口内
 * @param x 指针在视口中的横坐标
 * @param y 指针在视口中的纵坐标
 * @returns 菜单左上角的视口坐标
 */
function resolveMenuPosition(x: number, y: number): IMapMenuPosition {
  const flippedLeft = x + MENU_MIN_WIDTH > window.innerWidth ? x - MENU_MIN_WIDTH : x;
  const flippedTop = y + MENU_ESTIMATED_HEIGHT > window.innerHeight ? y - MENU_ESTIMATED_HEIGHT : y;

  return { left: Math.max(0, flippedLeft), top: Math.max(0, flippedTop) };
}

/**
 * 取焦点在菜单项里的下标
 * @param buttons 菜单项按钮
 * @param active 当前焦点元素
 * @returns 下标；焦点不在菜单项上时为 -1
 */
function resolveActiveIndex(buttons: readonly HTMLButtonElement[], active: Element | null): number {
  return buttons.findIndex((button) => button === active);
}

/**
 * 从某个下标开始找下一个可用（未禁用）的菜单项
 * @param buttons 菜单项按钮
 * @param from 起始下标
 * @param direction 1 向下、-1 向上
 * @returns 下一个可用项下标；全都不可用时为 -1
 */
function resolveEnabledIndex(buttons: readonly HTMLButtonElement[], from: number, direction: number): number {
  for (let offset = 1; offset <= buttons.length; offset += 1) {
    const index = (from + direction * offset + buttons.length) % buttons.length;

    if (!buttons[index].disabled) return index;
  }

  return -1;
}

/**
 * 右键菜单
 * @param props 菜单 props
 * @returns 菜单元素
 */
export function MapContextMenu(props: IMapContextMenuProps): ReactElement {
  const firstRef = useRef<HTMLButtonElement>(null);
  const position = resolveMenuPosition(props.x, props.y);
  const items: IMapMenuItem[] = [
    { id: 'copy', label: '复制选区', disabled: false, action: props.onCopy },
    { id: 'paste', label: '粘贴到此处', disabled: !props.hasClipboard, action: props.onPaste },
    { id: 'clear', label: '清空选区', disabled: !props.hasSelection, action: props.onClear },
    { id: 'cancel-selection', label: '取消选区', disabled: !props.hasSelection, action: props.onCancelSelection },
  ];

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  /**
   * 菜单键盘：↑ / ↓ 移动焦点，Enter 执行，Escape 关闭；不再向画布冒泡
   * @param event 键盘事件
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const buttons = Array.from(event.currentTarget.querySelectorAll('button'));

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      props.onClose();
      return;
    }

    if (event.key === 'Enter') {
      const active = buttons.find((button) => button === event.currentTarget.ownerDocument.activeElement);

      if (active !== undefined) {
        event.preventDefault();
        event.stopPropagation();
        active.click();
      }

      return;
    }

    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;

    event.preventDefault();
    event.stopPropagation();

    const active = resolveActiveIndex(buttons, event.currentTarget.ownerDocument.activeElement);
    const next = resolveEnabledIndex(buttons, active < 0 ? 0 : active, event.key === 'ArrowDown' ? 1 : -1);

    if (next >= 0) buttons[next].focus();
  };

  return (
    <div
      className="emap-menu"
      data-test-id="map-menu"
      role="menu"
      aria-label="地图操作"
      style={{ left: position.left, top: position.top, minWidth: MENU_MIN_WIDTH }}
      onKeyDown={handleKeyDown}
      onPointerDown={(event): void => event.stopPropagation()}
    >
      {items.map((item, index) => (
        <button
          key={item.id}
          ref={index === 0 ? firstRef : undefined}
          type="button"
          role="menuitem"
          className="emap-menu-item"
          data-test-id={`map-menu-${item.id}`}
          disabled={item.disabled}
          title={item.label}
          onClick={item.action}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
