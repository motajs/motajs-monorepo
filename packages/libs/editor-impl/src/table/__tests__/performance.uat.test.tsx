import { cleanup, configure } from '@testing-library/react';
import { Ajv2020 } from 'ajv/dist/2020';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateValue } from '../model/validation';

configure({ testIdAttribute: 'data-test-id' });

// 每个用例结束后卸载已挂载组件并还原所有被替换的方法
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('值校验共享 ajv 与编译缓存（P23）', () => {
  // 同一 schema 对象被反复校验时只编译一次（共享实例 + 按引用缓存）
  it('同一 schema 对象只编译一次', () => {
    const schema = { type: 'number' };
    const compileSpy = vi.spyOn(Ajv2020.prototype, 'compile');

    expect(validateValue(schema, 1)).toBe(true);
    expect(validateValue(schema, 2)).toBe(true);
    expect(validateValue(schema, 3)).toBe(true);

    expect(compileSpy).toHaveBeenCalledTimes(1);
  });

  // 不同的 schema 对象各自编译一次
  it('不同 schema 对象各自编译', () => {
    const schemaA = { type: 'number' };
    const schemaB = { type: 'string' };
    const compileSpy = vi.spyOn(Ajv2020.prototype, 'compile');

    expect(validateValue(schemaA, 1)).toBe(true);
    expect(validateValue(schemaB, 'x')).toBe(true);

    expect(compileSpy).toHaveBeenCalledTimes(2);
  });

  // 引入共享缓存后校验语义不变：数值 / enum / 缺省 / 空 schema 与既有用例一致
  it('校验语义与既有用例一致', () => {
    expect(validateValue({ type: 'number' }, 5)).toBe(true);
    expect(validateValue({ type: 'number' }, 'x')).toBe(false);
    expect(validateValue({ enum: ['a', 'b'] }, 'a')).toBe(true);
    expect(validateValue({ enum: ['a', 'b'] }, 'c')).toBe(false);
    expect(validateValue(undefined, 'anything')).toBe(true);
    expect(validateValue({}, null)).toBe(true);
    expect(validateValue({ type: 'number' }, null)).toBe(false);
  });
});
