import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CheckboxInput } from '../components/inputs/CheckboxInput';
import { CheckboxSet } from '../components/inputs/CheckboxSet';
import { ColorInput } from '../components/inputs/ColorInput';
import { SelectInput } from '../components/inputs/SelectInput';
import { TextareaInput } from '../components/inputs/TextareaInput';
import { inferControlKind } from '../model/control';
import { TableControlKind } from '../types';

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

globalThis.ResizeObserver = ResizeObserverStub;

// 每个用例结束后卸载已挂载的组件，避免 DOM 与浮层在用例之间累积
afterEach(() => {
  cleanup();
});

// 打开 antd ColorPicker 的浮层并设置红色通道
function pickRed(container: HTMLElement): void {
  const trigger = container.querySelector('.ant-color-picker-trigger');

  if (trigger) fireEvent.click(trigger);

  const red = screen.getAllByRole('spinbutton')[0];

  fireEvent.change(red, { target: { value: '128' } });
  fireEvent.blur(red);
}

describe('TextareaInput', () => {
  // 值的 JSON 文本被显示在文本域中
  it('显示值的 JSON 文本', () => {
    render(<TextareaInput value={{ a: 1 }} onChange={vi.fn()} />);

    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('{"a":1}');
  });

  // 失焦时解析并提交解析后的值
  it('失焦时提交解析后的值', () => {
    const onChange = vi.fn();
    render(<TextareaInput value={{ a: 1 }} onChange={onChange} />);

    const textarea = screen.getByRole('textbox');

    fireEvent.change(textarea, { target: { value: '{"b":2}' } });
    fireEvent.blur(textarea);

    expect(onChange).toHaveBeenCalledWith({ b: 2 });
  });

  // 解析失败时恢复为最后一次合法值且不提交
  it('解析失败时恢复原值且不提交', () => {
    const onChange = vi.fn();
    render(<TextareaInput value="original" onChange={onChange} />);

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: '{not json' } });
    fireEvent.blur(textarea);

    expect(onChange).not.toHaveBeenCalled();
    expect(textarea.value).toBe('"original"');
  });

  // 空白文本提交为 null
  it('空白文本提交为 null', () => {
    const onChange = vi.fn();
    render(<TextareaInput value="x" onChange={onChange} />);

    const textarea = screen.getByRole('textbox');

    fireEvent.change(textarea, { target: { value: '   ' } });
    fireEvent.blur(textarea);

    expect(onChange).toHaveBeenCalledWith(null);
  });
});

describe('SelectInput', () => {
  // 选中一个 enum 选项时提交该选项的值
  it('选中选项后提交该选项的值', () => {
    const onChange = vi.fn();
    render(<SelectInput value="a" options={['a', 'b', 'c']} onChange={onChange} />);

    fireEvent.mouseDown(screen.getByRole('combobox'));

    const option = screen.getByTitle('b');

    fireEvent.click(option);

    expect(onChange).toHaveBeenCalledWith('b');
  });
});

describe('CheckboxInput', () => {
  // 勾选时提交 true
  it('勾选后提交布尔值', () => {
    const onChange = vi.fn();
    render(<CheckboxInput value={false} onChange={onChange} />);

    fireEvent.click(screen.getByRole('checkbox'));

    expect(onChange).toHaveBeenCalledWith(true);
  });

  // 取消勾选时提交 false
  it('取消勾选后提交 false', () => {
    const onChange = vi.fn();
    render(<CheckboxInput value={true} onChange={onChange} />);

    fireEvent.click(screen.getByRole('checkbox'));

    expect(onChange).toHaveBeenCalledWith(false);
  });
});

describe('CheckboxSet', () => {
  // 勾选一个成员时把它并入值数组
  it('勾选成员后并入值数组', () => {
    const onChange = vi.fn();
    render(<CheckboxSet value={['a']} keys={['a', 'b']} prefixStrings={['A: ', 'B: ']} onChange={onChange} />);

    fireEvent.click(screen.getAllByRole('checkbox')[1]);

    expect(onChange).toHaveBeenCalledWith(['a', 'b']);
  });

  // 值里的未知成员被保留为额外一项
  it('保留值中的未知成员', () => {
    const onChange = vi.fn();
    render(
      <CheckboxSet value={['a', 'unknown']} keys={['a', 'b']} prefixStrings={['A: ', 'B: ']} onChange={onChange} />,
    );

    expect(screen.getAllByRole('checkbox').length).toBe(3);

    fireEvent.click(screen.getAllByRole('checkbox')[1]);

    expect(onChange).toHaveBeenCalledWith(['a', 'unknown', 'b']);
  });

  // 取消勾选时把成员从值数组移除
  it('取消勾选后从值数组移除', () => {
    const onChange = vi.fn();
    render(<CheckboxSet value={['a', 'b']} keys={['a', 'b']} prefixStrings={['A: ', 'B: ']} onChange={onChange} />);

    fireEvent.click(screen.getAllByRole('checkbox')[0]);

    expect(onChange).toHaveBeenCalledWith(['b']);
  });
});

describe('ColorInput', () => {
  // 三通道源值回写三通道数组
  it('三通道源值回写三通道数组', () => {
    const onChange = vi.fn();
    const { container } = render(<ColorInput value={[255, 0, 0]} onChange={onChange} />);

    pickRed(container);

    expect(onChange).toHaveBeenLastCalledWith([128, 0, 0]);
  });

  // 四通道源值回写四通道数组并保留 alpha
  it('四通道源值回写四通道数组', () => {
    const onChange = vi.fn();
    const { container } = render(<ColorInput value={[255, 0, 0, 1]} onChange={onChange} />);

    pickRed(container);

    expect(onChange).toHaveBeenLastCalledWith([128, 0, 0, 1]);
  });
});

describe('inferControlKind', () => {
  // schema 缺省时回退为文本
  it('schema 缺省回退为文本', () => {
    expect(inferControlKind(undefined)).toBe(TableControlKind.Text);
  });

  // enum 推导为下拉
  it('enum 推导为下拉', () => {
    expect(inferControlKind({ enum: ['a', 'b'] })).toBe(TableControlKind.Select);
  });

  // boolean 推导为复选框
  it('boolean 推导为复选框', () => {
    expect(inferControlKind({ type: 'boolean' })).toBe(TableControlKind.Checkbox);
  });

  // array 推导为多选
  it('array 推导为多选', () => {
    expect(inferControlKind({ type: 'array' })).toBe(TableControlKind.MultiSelect);
  });

  // number / integer 推导为数字
  it('number 与 integer 推导为数字', () => {
    expect(inferControlKind({ type: 'number' })).toBe(TableControlKind.Number);
    expect(inferControlKind({ type: 'integer' })).toBe(TableControlKind.Number);
  });

  // 其余类型回退为文本
  it('其余类型回退为文本', () => {
    expect(inferControlKind({ type: 'string' })).toBe(TableControlKind.Text);
    expect(inferControlKind({ type: 'object' })).toBe(TableControlKind.Text);
  });

  // x-control 存在时优先于标准关键字
  it('x-control 优先于标准关键字', () => {
    expect(inferControlKind({ type: 'string', 'x-control': TableControlKind.Color })).toBe(TableControlKind.Color);
    expect(inferControlKind({ enum: ['a'], 'x-control': TableControlKind.Text })).toBe(TableControlKind.Text);
  });
});
