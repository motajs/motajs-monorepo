/**
 * FoldStore 单元测试
 *
 * 测试折叠状态管理 Store 的功能
 * **Property 5: Fold State Consistency**
 * **Validates: Requirements 4.2, 4.3, 4.4**
 *
 * @vitest-environment jsdom
 */

import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { FoldStore } from '../FoldStore';

// Wrapper component for providing FoldStore context
function wrapper({ children }: { children: ReactNode }) {
  return createElement(FoldStore.Provider, null, children);
}

describe('FoldStore', () => {
  describe('初始状态', () => {
    it('foldedFields 应该初始化为空 Set', () => {
      const { result } = renderHook(() => FoldStore.useStore(), { wrapper });

      expect(result.current.foldedFields).toBeInstanceOf(Set);
      expect(result.current.foldedFields.size).toBe(0);
    });
  });

  describe('toggleFold', () => {
    it('应该将未折叠的字段添加到 foldedFields', () => {
      const { result } = renderHook(() => FoldStore.useStore(), { wrapper });
      const field = "['main']['floorIds']";

      act(() => {
        result.current.toggleFold(field);
      });

      expect(result.current.foldedFields.has(field)).toBe(true);
      expect(result.current.foldedFields.size).toBe(1);
    });

    it('应该将已折叠的字段从 foldedFields 移除', () => {
      const { result } = renderHook(() => FoldStore.useStore(), { wrapper });
      const field = "['main']['floorIds']";

      // 先折叠
      act(() => {
        result.current.toggleFold(field);
      });
      expect(result.current.foldedFields.has(field)).toBe(true);

      // 再次切换应该展开
      act(() => {
        result.current.toggleFold(field);
      });
      expect(result.current.foldedFields.has(field)).toBe(false);
      expect(result.current.foldedFields.size).toBe(0);
    });

    it('应该支持多个字段独立切换', () => {
      const { result } = renderHook(() => FoldStore.useStore(), { wrapper });
      const field1 = "['main']";
      const field2 = "['data']";

      act(() => {
        result.current.toggleFold(field1);
      });
      act(() => {
        result.current.toggleFold(field2);
      });

      expect(result.current.foldedFields.has(field1)).toBe(true);
      expect(result.current.foldedFields.has(field2)).toBe(true);
      expect(result.current.foldedFields.size).toBe(2);

      // 只切换 field1
      act(() => {
        result.current.toggleFold(field1);
      });

      expect(result.current.foldedFields.has(field1)).toBe(false);
      expect(result.current.foldedFields.has(field2)).toBe(true);
      expect(result.current.foldedFields.size).toBe(1);
    });
  });

  describe('foldAll', () => {
    it('应该折叠所有提供的 gap 字段', () => {
      const { result } = renderHook(() => FoldStore.useStore(), { wrapper });
      const gapFields = ["['main']", "['data']", "['config']"];

      act(() => {
        result.current.foldAll(gapFields);
      });

      expect(result.current.foldedFields.size).toBe(3);
      gapFields.forEach((field) => {
        expect(result.current.foldedFields.has(field)).toBe(true);
      });
    });

    it('应该替换现有的折叠状态', () => {
      const { result } = renderHook(() => FoldStore.useStore(), { wrapper });

      // 先折叠一些字段
      act(() => {
        result.current.toggleFold("['old']");
      });
      expect(result.current.foldedFields.has("['old']")).toBe(true);

      // foldAll 应该替换
      const newFields = ["['new1']", "['new2']"];
      act(() => {
        result.current.foldAll(newFields);
      });

      expect(result.current.foldedFields.has("['old']")).toBe(false);
      expect(result.current.foldedFields.has("['new1']")).toBe(true);
      expect(result.current.foldedFields.has("['new2']")).toBe(true);
      expect(result.current.foldedFields.size).toBe(2);
    });

    it('应该处理空数组', () => {
      const { result } = renderHook(() => FoldStore.useStore(), { wrapper });

      // 先折叠一些字段
      act(() => {
        result.current.toggleFold("['field']");
      });

      act(() => {
        result.current.foldAll([]);
      });

      expect(result.current.foldedFields.size).toBe(0);
    });
  });

  describe('unfoldAll', () => {
    it('应该清空所有折叠状态', () => {
      const { result } = renderHook(() => FoldStore.useStore(), { wrapper });

      // 先折叠一些字段
      act(() => {
        result.current.toggleFold("['main']");
      });
      act(() => {
        result.current.toggleFold("['data']");
      });
      act(() => {
        result.current.toggleFold("['config']");
      });
      expect(result.current.foldedFields.size).toBe(3);

      act(() => {
        result.current.unfoldAll();
      });

      expect(result.current.foldedFields.size).toBe(0);
    });

    it('对空状态调用应该保持为空', () => {
      const { result } = renderHook(() => FoldStore.useStore(), { wrapper });

      expect(result.current.foldedFields.size).toBe(0);

      act(() => {
        result.current.unfoldAll();
      });

      expect(result.current.foldedFields.size).toBe(0);
    });
  });

  describe('状态一致性', () => {
    it('连续操作应该保持状态一致', () => {
      const { result } = renderHook(() => FoldStore.useStore(), { wrapper });
      const fields = ["['a']", "['b']", "['c']"];

      // foldAll -> toggleFold -> unfoldAll 序列
      act(() => {
        result.current.foldAll(fields);
      });
      expect(result.current.foldedFields.size).toBe(3);

      act(() => {
        result.current.toggleFold("['a']");
      });
      expect(result.current.foldedFields.size).toBe(2);
      expect(result.current.foldedFields.has("['a']")).toBe(false);

      act(() => {
        result.current.unfoldAll();
      });
      expect(result.current.foldedFields.size).toBe(0);
    });
  });
});
