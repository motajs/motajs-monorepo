import { cleanup, configure } from '@testing-library/react';
import { Ajv2020 } from 'ajv/dist/2020';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildSchemaTree } from '../../shared/schemaForm/model/schemaPresentation';
import { buildTableTree } from '../../shared/schemaForm/model/traversal';
import { validateValue } from '../../shared/schemaForm/model/validation';

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

describe('行树按输入引用缓存（P23）', () => {
  // 数据表：同一 (schema, data) 引用连续两次调用返回同一数组
  it('数据表同一输入引用复用同一行树', () => {
    const schema = { type: 'object', properties: { a: { type: 'string' } } };
    const data = { a: '1' };

    const first = buildTableTree(schema, data);
    const second = buildTableTree(schema, data);

    expect(second).toBe(first);
  });

  // 数据表：换成新的 data 对象后重算，返回新引用且内容反映新输入
  it('数据表数据对象变更后重算', () => {
    const schema = { type: 'object', properties: { a: { type: 'string' }, b: { type: 'string' } } };
    const data1 = { a: '1' };
    const data2 = { a: '1', b: '2' };

    const first = buildTableTree(schema, data1);
    const second = buildTableTree(schema, data2);

    expect(second).not.toBe(first);
    expect(second.some((row) => row.key === "['b']")).toBe(true);
  });

  // schema 表：同 schema 引用复用同一行树，换成新 schema 对象后重算
  it('schema 表按引用复用并随 schema 变更重算', () => {
    const schema1 = { type: 'object', properties: { a: { type: 'string' } } };
    const schema2 = { type: 'object', properties: { a: { type: 'string' }, b: { type: 'number' } } };

    const first = buildSchemaTree(schema1);
    const again = buildSchemaTree(schema1);
    const changed = buildSchemaTree(schema2);
    const propertiesRow = changed.find((row) => row.key === "['properties']");
    const children = propertiesRow === undefined ? [] : (propertiesRow.children ?? []);

    expect(again).toBe(first);
    expect(changed).not.toBe(first);
    expect(children.some((row) => row.key === "['properties']['b']")).toBe(true);
  });

  // schema 非对象时行树为空（不缓存，行为与改造前一致）
  it('schema 非对象时返回空数组', () => {
    expect(buildTableTree(undefined, {})).toEqual([]);
    expect(buildTableTree('x', {})).toEqual([]);
    expect(buildSchemaTree(null)).toEqual([]);
  });
});
