import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SelectInput } from '../components/inputs/SelectInput';

// 每个用例结束后卸载已挂载的组件，避免 DOM 与浮层在用例之间累积
afterEach(() => {
  cleanup();
});

/**
 * 打开 antd 下拉的选项浮层
 * @param container 组件挂载容器
 */
function openSelect(container: HTMLElement): void {
  const content = container.querySelector('.ant-select-content');

  expect(content).not.toBeNull();
  fireEvent.mouseDown(content!);
}

/**
 * 取当前已渲染的选项文本节点
 * @param baseElement 渲染基准元素（含挂在 body 上的浮层）
 * @returns 选项文本节点列表
 */
function optionContents(baseElement: HTMLElement): readonly HTMLElement[] {
  return Array.from(baseElement.querySelectorAll<HTMLElement>('.ant-select-item-option-content'));
}

/**
 * 按显示文本点选一个选项
 * @param baseElement 渲染基准元素（含挂在 body 上的浮层）
 * @param label 选项的显示文本
 */
function clickOption(baseElement: HTMLElement, label: string): void {
  const option = optionContents(baseElement).find((item) => item.textContent === label);

  expect(option).toBeDefined();
  fireEvent.click(option!);
}

describe('SelectInput 枚举标签', () => {
  // 数字枚举带标签时下拉显示中文标签，点选「网格」提交的仍是数字 1
  it('数字枚举显示标签并按数字原值提交', () => {
    const onChange = vi.fn();
    const { container, baseElement } = render(
      <SelectInput value={0} options={[0, 1]} titles={{ '0': '整图', '1': '网格' }} onChange={onChange} />,
    );

    openSelect(container);

    expect(optionContents(baseElement).map((item) => item.textContent)).toEqual(['整图', '网格']);

    clickOption(baseElement, '网格');

    expect(onChange).toHaveBeenCalledWith(1);
  });

  // 字符串枚举带标签时显示标签，点选后提交字符串原值
  it('字符串枚举显示标签并按字符串原值提交', () => {
    const onChange = vi.fn();
    const { container, baseElement } = render(
      <SelectInput
        value="full"
        options={['full', 'grid']}
        titles={{ full: '整图', grid: '网格' }}
        onChange={onChange}
      />,
    );

    openSelect(container);

    expect(optionContents(baseElement).map((item) => item.textContent)).toEqual(['整图', '网格']);

    clickOption(baseElement, '网格');

    expect(onChange).toHaveBeenCalledWith('grid');
  });

  // 不传标签时选中项与选项都显示原值，点选后提交数字原值
  it('不传标签时显示原值', () => {
    const onChange = vi.fn();
    const { container, baseElement } = render(<SelectInput value={0} options={[0, 1]} onChange={onChange} />);

    expect(container.querySelector('.ant-select-content-value')!.textContent).toBe('0');

    openSelect(container);

    expect(optionContents(baseElement).map((item) => item.textContent)).toEqual(['0', '1']);

    clickOption(baseElement, '1');

    expect(onChange).toHaveBeenCalledWith(1);
  });
});
