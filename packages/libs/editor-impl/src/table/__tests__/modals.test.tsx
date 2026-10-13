import { act, cleanup, configure, fireEvent, render, screen } from '@testing-library/react';
import { createElement, ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CapabilityProvider,
  IMultiSelectOpener,
  IMultiSelectResult,
  IPointSelectResult,
  MultiSelectModal,
  PointPickerModal,
  useTableCapabilities,
} from '../../react';

configure({ testIdAttribute: 'data-test-id' });

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

globalThis.ResizeObserver = ResizeObserverStub;

/** 探针捕获当前注入的多选打开器 */
let capturedMultiSelect: IMultiSelectOpener | undefined;

/**
 * 读取上下文中的多选打开器并暴露给测试
 * @returns 空元素
 */
function CapabilityProbe(): ReactElement {
  capturedMultiSelect = useTableCapabilities().multiSelect;

  return <div data-test-id="probe" />;
}

// 每个用例结束后卸载已挂载的组件，避免 DOM 与浮层在用例之间累积
afterEach(() => {
  cleanup();
  capturedMultiSelect = undefined;
});

describe('通用多选弹窗', () => {
  // 有候选项时列出缩略图多选列表，确认时回调返回选中 id 列表
  it('有候选项时列出多选列表并确认选中 id', () => {
    const onConfirm = vi.fn();

    render(
      <MultiSelectModal
        open
        title="选择"
        items={[
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B', thumbnail: 'a.png' },
        ]}
        selectedIds={['a']}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByTestId('multiselect-list')).not.toBeNull();
    expect(screen.getAllByRole('checkbox').length).toBe(2);
    // 缩略图以候选项给定的字符串作为 img src
    expect(screen.getByTestId('multiselect-item-b').querySelector('.eimodal-thumb')?.getAttribute('src')).toBe('a.png');
    // 过长标签以 title 暴露全文
    expect(screen.getByTestId('multiselect-item-a').querySelector('.eimodal-label')?.getAttribute('title')).toBe('A');

    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    fireEvent.click(screen.getByTestId('multiselect-confirm'));

    expect(onConfirm).toHaveBeenCalledWith(['a', 'b']);
  });

  // 取消时不返回结果，仅回调 onCancel
  it('取消时回调 onCancel 且不确认', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <MultiSelectModal
        open
        title="选择"
        items={[{ id: 'a', label: 'A' }]}
        selectedIds={[]}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getByTestId('multiselect-cancel'));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  // 无候选项时显示空态
  it('无候选项时显示空态', () => {
    render(<MultiSelectModal open title="选择" items={[]} selectedIds={[]} onConfirm={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByTestId('multiselect-empty')).not.toBeNull();
  });

  // 加载中显示加载态
  it('加载中显示加载态', () => {
    render(
      <MultiSelectModal open title="选择" items={[]} selectedIds={[]} loading onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );

    expect(screen.getByTestId('multiselect-loading')).not.toBeNull();
  });

  // 失败时显示错误态且优先于其他状态
  it('失败时显示错误态', () => {
    render(
      <MultiSelectModal
        open
        title="选择"
        items={[{ id: 'a', label: 'A' }]}
        selectedIds={[]}
        error="候选项加载失败"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByTestId('multiselect-error').textContent).toBe('候选项加载失败');
  });
});

describe('坐标选择弹窗', () => {
  // 确认时以 2D 坐标回调
  it('确认时回调 2D 坐标', () => {
    const onConfirm = vi.fn<(point: IPointSelectResult) => void>();

    render(<PointPickerModal open title="坐标" x={3} y={4} onConfirm={onConfirm} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByTestId('point-confirm'));

    expect(onConfirm).toHaveBeenCalledWith({ x: 3, y: 4 });
  });

  // 取消时仅回调 onCancel
  it('取消时回调 onCancel 且不确认', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(<PointPickerModal open title="坐标" onConfirm={onConfirm} onCancel={onCancel} />);

    fireEvent.click(screen.getByTestId('point-cancel'));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('能力 Provider 的默认弹窗打开器', () => {
  // 未注入多选打开器时由 Provider 补齐默认打开器，确认时以选中 id resolve
  it('默认多选打开器确认时 resolve 选中 id', async () => {
    render(createElement(CapabilityProvider, { children: createElement(CapabilityProbe) }));

    const opener = capturedMultiSelect;

    if (opener === undefined) throw new Error('未捕获到默认多选打开器');

    let resolved: IMultiSelectResult | null = null;

    await act(async () => {
      void opener.open({ title: '选择', items: [{ id: 'a', label: 'A' }], selectedIds: [] }).then((result) => {
        resolved = result;
      });
    });

    expect(screen.getByTestId('multiselect-list')).not.toBeNull();

    await act(async () => {
      fireEvent.click(screen.getAllByRole('checkbox')[0]);
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('multiselect-confirm'));
    });

    expect(resolved).toEqual({ ids: ['a'] });
  });

  // 默认多选打开器取消时以 null resolve
  it('默认多选打开器取消时 resolve null', async () => {
    render(createElement(CapabilityProvider, { children: createElement(CapabilityProbe) }));

    const opener = capturedMultiSelect;

    if (opener === undefined) throw new Error('未捕获到默认多选打开器');

    let resolved: IMultiSelectResult | null = { ids: ['x'] };

    await act(async () => {
      void opener.open({ title: '选择', items: [{ id: 'a', label: 'A' }], selectedIds: [] }).then((result) => {
        resolved = result;
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('multiselect-cancel'));
    });

    expect(resolved).toBeNull();
  });
});
