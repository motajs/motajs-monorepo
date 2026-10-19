import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SelectInput } from '../components/inputs/SelectInput';
import { IEnumTitleMap, ITableSchemaNode } from '../types';

// 枚举标签契约：schema 可携带 `x-enum-titles` 映射，下拉先接受 `titles`。
// 本文件只钉住「映射可写入并可读出」与「传入标签时渲染仍保持原值」两态；
// 标签真正参与渲染属于 03-21，届时这里的「原值」断言会改成「整图」。
const schema: ITableSchemaNode = {
  type: 'number',
  enum: [0, 1],
  'x-enum-titles': { '0': '整图', '1': '网格' },
};

const titles: IEnumTitleMap = { '0': '整图' };

describe('enum titles 契约', () => {
  // schema 字面量可携带 x-enum-titles，并按枚举值字符串键读出标签
  it('schema 可携带并按字符串键读出枚举标签', () => {
    expect(schema['x-enum-titles']!['0']).toBe('整图');
    expect(schema['x-enum-titles']!['1']).toBe('网格');
  });

  // 传入 titles 但当前实现尚未使用，选中项文本仍为原值 0（03-21 之前的行为基线）
  it('传入标签时选中项仍显示原值', () => {
    render(createElement(SelectInput, { value: 0, options: [0, 1], titles, onChange: vi.fn() }));

    expect(screen.getByTitle('0').textContent).toBe('0');
  });
});
