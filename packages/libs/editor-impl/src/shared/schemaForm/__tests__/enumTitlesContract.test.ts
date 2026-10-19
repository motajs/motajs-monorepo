import { cleanup, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SelectInput } from '../components/inputs/SelectInput';
import { IEnumTitleMap, ITableSchemaNode } from '../types';

// 枚举标签契约：schema 可携带 `x-enum-titles` 映射，下拉按映射显示标签，缺省时仍显示原值。
const schema: ITableSchemaNode = {
  type: 'number',
  enum: [0, 1],
  'x-enum-titles': { '0': '整图', '1': '网格' },
};

const titles: IEnumTitleMap = { '0': '整图' };

// 每个用例结束后卸载已挂载的组件，避免 DOM 与浮层在用例之间累积
afterEach(() => {
  cleanup();
});

describe('enum titles 契约', () => {
  // schema 字面量可携带 x-enum-titles，并按枚举值字符串键读出标签
  it('schema 可携带并按字符串键读出枚举标签', () => {
    expect(schema['x-enum-titles']!['0']).toBe('整图');
    expect(schema['x-enum-titles']!['1']).toBe('网格');
  });

  // 传入 titles 时选中项文本显示标签，而不是裸数字
  it('传入标签时选中项显示标签', () => {
    render(createElement(SelectInput, { value: 0, options: [0, 1], titles, onChange: vi.fn() }));

    expect(screen.getByTitle('整图').textContent).toBe('整图');
  });

  // 不传 titles 时仍保持新增标签之前的原值显示
  it('不传标签时选中项仍显示原值', () => {
    render(createElement(SelectInput, { value: 0, options: [0, 1], onChange: vi.fn() }));

    expect(screen.getByTitle('0').textContent).toBe('0');
  });
});
