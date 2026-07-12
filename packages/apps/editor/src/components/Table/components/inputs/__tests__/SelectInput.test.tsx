/**
 * SelectInput 组件单元测试
 *
 * 测试下拉选择输入组件的功能
 *
 * @vitest-environment jsdom
 */

import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SelectInput } from '../SelectInput';

// 每个测试后清理 DOM
afterEach(() => {
  cleanup();
});

describe('SelectInput', () => {
  describe('渲染', () => {
    it('应该渲染一个 select 元素', () => {
      const onChange = vi.fn();
      render(<SelectInput value="a" options={['a', 'b', 'c']} onChange={onChange} />);

      const select = screen.getByRole('combobox');
      expect(select).toBeDefined();
    });

    it('应该渲染所有选项', () => {
      const onChange = vi.fn();
      const options = ['option1', 'option2', 'option3'];
      render(<SelectInput value="option1" options={options} onChange={onChange} />);

      const optionElements = screen.getAllByRole('option');
      expect(optionElements.length).toBe(3);
    });

    it('字符串选项应该直接显示文本', () => {
      const onChange = vi.fn();
      render(<SelectInput value="hello" options={['hello', 'world']} onChange={onChange} />);

      expect(screen.getByText('hello')).toBeDefined();
      expect(screen.getByText('world')).toBeDefined();
    });

    it('非字符串选项应该显示 JSON 序列化结果', () => {
      const onChange = vi.fn();
      const options = [{ id: 1 }, { id: 2 }];
      render(<SelectInput value={options[0]} options={options} onChange={onChange} />);

      expect(screen.getByText('{"id":1}')).toBeDefined();
      expect(screen.getByText('{"id":2}')).toBeDefined();
    });

    it('当前值应该被选中', () => {
      const onChange = vi.fn();
      render(<SelectInput value="b" options={['a', 'b', 'c']} onChange={onChange} />);

      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('"b"');
    });

    it('当 disabled 为 true 时应该禁用选择框', () => {
      const onChange = vi.fn();
      render(<SelectInput value="a" options={['a', 'b']} onChange={onChange} disabled={true} />);

      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.disabled).toBe(true);
    });
  });

  describe('交互', () => {
    it('选择新选项时应该调用 onChange 并传入解析后的值', () => {
      const onChange = vi.fn();
      render(<SelectInput value="a" options={['a', 'b', 'c']} onChange={onChange} />);

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: '"b"' } });

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith('b');
    });

    it('选择数字选项时应该传入数字类型', () => {
      const onChange = vi.fn();
      render(<SelectInput value={1} options={[1, 2, 3]} onChange={onChange} />);

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: '2' } });

      expect(onChange).toHaveBeenCalledWith(2);
    });

    it('选择对象选项时应该传入对象', () => {
      const onChange = vi.fn();
      const options = [{ id: 1 }, { id: 2 }];
      render(<SelectInput value={options[0]} options={options} onChange={onChange} />);

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: '{"id":2}' } });

      expect(onChange).toHaveBeenCalledWith({ id: 2 });
    });
  });
});
