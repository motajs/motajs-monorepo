import { cleanup, configure, fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TableGrid, TablePanelStatus } from '../components/TableGrid';
import { buildTableTree } from '../model/traversal';
import { ITableRowNode } from '../types';

configure({ testIdAttribute: 'data-test-id' });

// 表单模式回归测试：只藏表格工具栏与 Schema 横幅，字段行 / 值控件 / 校验 / 字段路径一律照旧。
// 本文件不改任何既有表格用例的期望，只钉住新开关的行为。

afterEach(() => {
  cleanup();
});

/**
 * 造一份两字段（字符串 + 数字）的行树，供各用例共用
 * @returns 两个叶子行的行树
 */
function createRows(): readonly ITableRowNode[] {
  return buildTableTree(
    { type: 'object', properties: { name: { type: 'string' }, level: { type: 'number' } } },
    { name: 'a', level: 1 },
  );
}

describe('TableGrid 的表单模式', () => {
  // 缺省不是表单模式：工具栏与「保存」按钮照旧存在
  it('缺省时仍渲染表格工具栏', () => {
    render(createElement(TableGrid, { status: TablePanelStatus.Ready, rows: createRows() }));

    expect(screen.getByTestId('table-more')).not.toBeNull();
    expect(screen.getByTestId('table-save')).not.toBeNull();
  });

  // 表单模式为真：工具栏的各个动作与 Schema 横幅都不在 DOM
  it('表单模式下工具栏与 Schema 横幅都不在 DOM', () => {
    render(
      createElement(TableGrid, {
        status: TablePanelStatus.Ready,
        rows: createRows(),
        schemaMode: true,
        formMode: true,
        onCloseColumn: (): void => {},
      }),
    );

    expect(screen.queryByTestId('table-more')).toBeNull();
    expect(screen.queryByTestId('table-save')).toBeNull();
    expect(screen.queryByTestId('table-close-column')).toBeNull();
    expect(screen.queryByTestId('schema-banner')).toBeNull();
  });

  // 表单模式只藏动作：两个字段行仍在，改值仍经统一提交回调冒出去
  it('表单模式下字段行仍在且改值触发 onChange', () => {
    const changes: [string, unknown][] = [];
    const { container } = render(
      createElement(TableGrid, {
        status: TablePanelStatus.Ready,
        rows: createRows(),
        formMode: true,
        onChange: (key: string, value: unknown): void => {
          changes.push([key, value]);
        },
      }),
    );

    expect(container.querySelector('[data-test-id="table-row-name"]')).not.toBeNull();
    expect(container.querySelector('[data-test-id="table-row-level"]')).not.toBeNull();

    const textarea = container.querySelector('[data-test-id="table-input-name"] textarea');

    fireEvent.change(textarea as HTMLTextAreaElement, { target: { value: '"b"' } });
    fireEvent.blur(textarea as HTMLTextAreaElement);

    expect(changes).toEqual([["['name']", 'b']]);
  });

  // 表单模式不吞错误态：加载失败仍显示标题、说明与可点的「重试」
  it('表单模式下加载失败仍显示错误态与重试', () => {
    const onRetry = vi.fn();

    render(createElement(TableGrid, { status: TablePanelStatus.Error, rows: [], formMode: true, onRetry }));

    expect(screen.getByText('表格加载失败')).not.toBeNull();
    expect(screen.getByText('请检查该表格资源是否存在，或稍后重试。')).not.toBeNull();

    fireEvent.click(screen.getByText('重试'));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  // 表单模式不吞空态：无字段时沿用表格引擎的「尚未定义任何字段。」
  it('表单模式下空 Schema 显示尚未定义任何字段。', () => {
    render(createElement(TableGrid, { status: TablePanelStatus.EmptySchema, rows: [], formMode: true }));

    expect(screen.getByText('尚未定义任何字段。')).not.toBeNull();
  });
});
