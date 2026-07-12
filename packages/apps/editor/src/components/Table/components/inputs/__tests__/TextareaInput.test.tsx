/**
 * TextareaInput 组件单元测试
 *
 * 测试文本域输入组件的功能
 *
 * @vitest-environment jsdom
 */

import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TextareaInput } from '../TextareaInput';

// 每个测试后清理 DOM
afterEach(() => {
  cleanup();
});

describe('TextareaInput', () => {
  describe('渲染', () => {
    it('应该渲染一个 textarea 元素', () => {
      const onChange = vi.fn();
      render(<TextareaInput value="test" onChange={onChange} />);

      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeDefined();
    });

    it('应该将值序列化为 JSON 显示', () => {
      const onChange = vi.fn();
      render(<TextareaInput value="hello" onChange={onChange} />);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value).toBe('"hello"');
    });

    it('应该正确显示数字值', () => {
      const onChange = vi.fn();
      render(<TextareaInput value={42} onChange={onChange} />);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value).toBe('42');
    });

    it('应该正确显示对象值', () => {
      const onChange = vi.fn();
      render(<TextareaInput value={{ key: 'value' }} onChange={onChange} />);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value).toBe('{"key":"value"}');
    });

    it('应该正确显示数组值', () => {
      const onChange = vi.fn();
      render(<TextareaInput value={[1, 2, 3]} onChange={onChange} />);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value).toBe('[1,2,3]');
    });

    it('应该支持缩进配置', () => {
      const onChange = vi.fn();
      render(<TextareaInput value={{ a: 1 }} onChange={onChange} indent={2} />);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value).toBe('{\n  "a": 1\n}');
    });

    it('当 disabled 为 true 时应该禁用输入框', () => {
      const onChange = vi.fn();
      render(<TextareaInput value="test" onChange={onChange} disabled={true} />);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.disabled).toBe(true);
    });

    it('当 readonly 为 true 时应该设置只读', () => {
      const onChange = vi.fn();
      render(<TextareaInput value="test" onChange={onChange} readonly={true} />);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.readOnly).toBe(true);
    });

    it('应该禁用拼写检查', () => {
      const onChange = vi.fn();
      render(<TextareaInput value="test" onChange={onChange} />);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.getAttribute('spellcheck')).toBe('false');
    });
  });

  describe('交互', () => {
    it('输入时应该更新显示值', () => {
      const onChange = vi.fn();
      render(<TextareaInput value="old" onChange={onChange} />);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: '"new"' } });

      expect(textarea.value).toBe('"new"');
    });

    it('失焦时应该解析 JSON 并调用 onChange', () => {
      const onChange = vi.fn();
      render(<TextareaInput value="old" onChange={onChange} />);

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: '"new"' } });
      fireEvent.blur(textarea);

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith('new');
    });

    it('失焦时如果 JSON 无效应该恢复原值', () => {
      const onChange = vi.fn();
      render(<TextareaInput value="original" onChange={onChange} />);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: 'invalid json' } });
      fireEvent.blur(textarea);

      expect(onChange).not.toHaveBeenCalled();
      expect(textarea.value).toBe('"original"');
    });

    it('应该正确解析数字输入', () => {
      const onChange = vi.fn();
      render(<TextareaInput value={0} onChange={onChange} />);

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: '123' } });
      fireEvent.blur(textarea);

      expect(onChange).toHaveBeenCalledWith(123);
    });

    it('应该正确解析对象输入', () => {
      const onChange = vi.fn();
      render(<TextareaInput value={{}} onChange={onChange} />);

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: '{"a":1,"b":2}' } });
      fireEvent.blur(textarea);

      expect(onChange).toHaveBeenCalledWith({ a: 1, b: 2 });
    });
  });
});
