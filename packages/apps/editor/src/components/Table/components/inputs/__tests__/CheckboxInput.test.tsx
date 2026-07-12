/**
 * CheckboxInput 组件单元测试
 *
 * 测试复选框输入组件的功能
 *
 * @vitest-environment jsdom
 */

import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CheckboxInput } from '../CheckboxInput';

// 每个测试后清理 DOM
afterEach(() => {
  cleanup();
});

describe('CheckboxInput', () => {
  describe('渲染', () => {
    it('应该渲染一个 checkbox 输入框', () => {
      const onChange = vi.fn();
      render(<CheckboxInput value={false} onChange={onChange} />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeDefined();
    });

    it('当 value 为 true 时应该显示选中状态', () => {
      const onChange = vi.fn();
      render(<CheckboxInput value={true} onChange={onChange} />);

      const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
    });

    it('当 value 为 false 时应该显示未选中状态', () => {
      const onChange = vi.fn();
      render(<CheckboxInput value={false} onChange={onChange} />);

      const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
      expect(checkbox.checked).toBe(false);
    });

    it('当 disabled 为 true 时应该禁用输入框', () => {
      const onChange = vi.fn();
      render(<CheckboxInput value={false} onChange={onChange} disabled={true} />);

      const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
      expect(checkbox.disabled).toBe(true);
    });
  });

  describe('交互', () => {
    it('点击时应该调用 onChange 并传入相反的值', () => {
      const onChange = vi.fn();
      render(<CheckboxInput value={false} onChange={onChange} />);

      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(true);
    });

    it('从选中状态点击应该传入 false', () => {
      const onChange = vi.fn();
      render(<CheckboxInput value={true} onChange={onChange} />);

      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      expect(onChange).toHaveBeenCalledWith(false);
    });

    it('禁用状态下复选框应该被禁用', () => {
      const onChange = vi.fn();
      render(<CheckboxInput value={false} onChange={onChange} disabled={true} />);

      const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
      // 验证复选框被禁用（浏览器会阻止禁用元素的交互）
      expect(checkbox.disabled).toBe(true);
    });
  });
});
