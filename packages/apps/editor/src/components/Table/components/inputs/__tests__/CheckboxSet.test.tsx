/**
 * CheckboxSet 组件单元测试
 *
 * 测试复选框组输入组件的功能
 *
 * @vitest-environment jsdom
 */

import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CheckboxSet } from '../CheckboxSet';

// 每个测试后清理 DOM
afterEach(() => {
  cleanup();
});

describe('CheckboxSet', () => {
  describe('渲染', () => {
    it('应该渲染所有复选框', () => {
      const onChange = vi.fn();
      render(
        <CheckboxSet
          value={[]}
          keys={['a', 'b', 'c']}
          prefixStrings={['A: ', 'B: ', 'C: ']}
          onChange={onChange}
        />,
      );

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBe(3);
    });

    it('选中的值应该显示为选中状态', () => {
      const onChange = vi.fn();
      render(
        <CheckboxSet
          value={['a', 'c']}
          keys={['a', 'b', 'c']}
          prefixStrings={['A: ', 'B: ', 'C: ']}
          onChange={onChange}
        />,
      );

      const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
      expect(checkboxes[0].checked).toBe(true);
      expect(checkboxes[1].checked).toBe(false);
      expect(checkboxes[2].checked).toBe(true);
    });

    it('当 disabled 为 true 时应该禁用所有复选框', () => {
      const onChange = vi.fn();
      render(
        <CheckboxSet
          value={[]}
          keys={['a', 'b']}
          prefixStrings={['A: ', 'B: ']}
          onChange={onChange}
          disabled={true}
        />,
      );

      const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
      checkboxes.forEach((checkbox) => {
        expect(checkbox.disabled).toBe(true);
      });
    });

    it('应该处理 null 值', () => {
      const onChange = vi.fn();
      render(
        <CheckboxSet
          value={null}
          keys={['a', 'b']}
          prefixStrings={['A: ', 'B: ']}
          onChange={onChange}
        />,
      );

      const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
      checkboxes.forEach((checkbox) => {
        expect(checkbox.checked).toBe(false);
      });
    });

    it('应该处理值为 0 的情况（视为空数组）', () => {
      const onChange = vi.fn();
      render(
        <CheckboxSet
          value={0}
          keys={['a', 'b']}
          prefixStrings={['A: ', 'B: ']}
          onChange={onChange}
        />,
      );

      const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
      checkboxes.forEach((checkbox) => {
        expect(checkbox.checked).toBe(false);
      });
    });

    it('应该动态添加未知选项', () => {
      const onChange = vi.fn();
      render(
        <CheckboxSet
          value={['a', 'unknown']}
          keys={['a', 'b']}
          prefixStrings={['A: ', 'B: ']}
          onChange={onChange}
        />,
      );

      // 应该有 3 个复选框（2 个已知 + 1 个未知）
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBe(3);
    });
  });

  describe('交互', () => {
    it('点击未选中的复选框应该添加到值数组', () => {
      const onChange = vi.fn();
      render(
        <CheckboxSet
          value={['a']}
          keys={['a', 'b', 'c']}
          prefixStrings={['A: ', 'B: ', 'C: ']}
          onChange={onChange}
        />,
      );

      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[1]); // 点击 'b'

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(['a', 'b']);
    });

    it('点击已选中的复选框应该从值数组移除', () => {
      const onChange = vi.fn();
      render(
        <CheckboxSet
          value={['a', 'b']}
          keys={['a', 'b', 'c']}
          prefixStrings={['A: ', 'B: ', 'C: ']}
          onChange={onChange}
        />,
      );

      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]); // 点击 'a'

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(['b']);
    });

    it('应该支持数字类型的 key', () => {
      const onChange = vi.fn();
      render(
        <CheckboxSet
          value={[1]}
          keys={[1, 2, 3]}
          prefixStrings={['一: ', '二: ', '三: ']}
          onChange={onChange}
        />,
      );

      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[1]); // 点击 2

      expect(onChange).toHaveBeenCalledWith([1, 2]);
    });
  });
});
