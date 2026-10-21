import { cleanup, configure, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IMapContextMenuProps, MapContextMenu } from '../components/MapContextMenu';

configure({ testIdAttribute: 'data-test-id' });

// 右键菜单的受控渲染测试：四项文案与顺序、启用条件、键盘操作与贴边夹取。
// 菜单只接 props，全部用例直接渲染；文案与 UI 契约逐字比对。

/**
 * 造一份菜单 props，可按用例覆盖个别字段
 * @param overrides 覆盖的 props
 * @returns 菜单 props
 */
function createMenuProps(overrides: Partial<IMapContextMenuProps> = {}): IMapContextMenuProps {
  return {
    x: 10,
    y: 10,
    hasClipboard: false,
    hasSelection: false,
    onCopy: vi.fn(),
    onPaste: vi.fn(),
    onClear: vi.fn(),
    onCancelSelection: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

/**
 * 取菜单项按钮
 * @returns 菜单项按钮数组
 */
function menuItems(): HTMLButtonElement[] {
  return screen.getAllByRole('menuitem') as HTMLButtonElement[];
}

/**
 * 取当前焦点元素
 * @param element 用于取得所属文档的元素
 * @returns 当前焦点元素
 */
function activeElementOf(element: Element): Element | null {
  return element.ownerDocument.activeElement;
}

beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1024 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 800 });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('地图右键菜单', () => {
  // 四项文案与顺序与 UI 契约逐字一致
  it('渲染四项且文案与顺序固定', () => {
    render(<MapContextMenu {...createMenuProps()} />);

    expect(menuItems().map((item) => item.textContent)).toEqual(['复制选区', '粘贴到此处', '清空选区', '取消选区']);
    expect(screen.getByTestId('map-menu').getAttribute('role')).toBe('menu');
  });

  // 没有剪贴板时「粘贴到此处」禁用
  it('没有剪贴板时粘贴项禁用', () => {
    render(<MapContextMenu {...createMenuProps({ hasClipboard: false })} />);

    expect(screen.getByTestId<HTMLButtonElement>('map-menu-paste').disabled).toBe(true);
  });

  // 没有选区时「清空选区」与「取消选区」都禁用
  it('没有选区时清空与取消选区禁用', () => {
    render(<MapContextMenu {...createMenuProps({ hasSelection: false })} />);

    expect(screen.getByTestId<HTMLButtonElement>('map-menu-clear').disabled).toBe(true);
    expect(screen.getByTestId<HTMLButtonElement>('map-menu-cancel-selection').disabled).toBe(true);
  });

  // 打开即聚焦第一项；↓ 移到第二项；Enter 执行第二项
  it('打开聚焦第一项，方向键移动焦点并用 Enter 执行', () => {
    const onPaste = vi.fn();

    render(<MapContextMenu {...createMenuProps({ hasClipboard: true, hasSelection: true, onPaste })} />);

    const items = menuItems();

    expect(activeElementOf(items[0])).toBe(items[0]);

    fireEvent.keyDown(screen.getByTestId('map-menu'), { key: 'ArrowDown' });

    expect(activeElementOf(items[0])).toBe(items[1]);

    fireEvent.keyDown(screen.getByTestId('map-menu'), { key: 'Enter' });

    expect(onPaste).toHaveBeenCalledTimes(1);
  });

  // Escape 关闭菜单且不执行任何动作
  it('Escape 关闭菜单且不执行动作', () => {
    const onCopy = vi.fn();
    const onClose = vi.fn();

    render(<MapContextMenu {...createMenuProps({ onCopy, onClose })} />);

    fireEvent.keyDown(screen.getByTestId('map-menu'), { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCopy).not.toHaveBeenCalled();
  });

  // 靠近视口右边缘时翻转，菜单完整可见
  it('靠近右边缘时向左翻转', () => {
    const x = 1014;

    render(<MapContextMenu {...createMenuProps({ x })} />);

    const left = Number.parseFloat(screen.getByTestId('map-menu').style.left);

    expect(left).toBeLessThan(x);
    expect(left).toBeGreaterThanOrEqual(0);
  });

  // 菜单里没有任何事件相关字样：四项文案完全等于契约句子
  it('菜单里没有事件相关项', () => {
    render(<MapContextMenu {...createMenuProps({ hasClipboard: true, hasSelection: true })} />);

    const labels = menuItems().map((item) => item.textContent ?? '');

    expect(labels).toEqual(['复制选区', '粘贴到此处', '清空选区', '取消选区']);
    expect(labels.some((label) => label.includes('事件'))).toBe(false);
  });
});
