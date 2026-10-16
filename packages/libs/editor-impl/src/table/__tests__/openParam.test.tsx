import { act, cleanup, configure, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { deriveSchemaPath, tablePanelType } from '..';
import { createTableHarness, FakeFileSystem } from './fixtures';

configure({ testIdAttribute: 'data-test-id' });

// 每个用例结束后卸载已挂载的组件，避免 DOM 在用例之间累积
afterEach(() => {
  cleanup();
});

// 数据文件路径（`xxx.json`）
function tableDataPath(name: string): string {
  return `${name}.json`;
}

// schema 文件路径（按 `xxx.schema.json` 约定推导）
function tableSchemaPath(name: string): string {
  return deriveSchemaPath(tableDataPath(name));
}

// 读取指定字段值单元格内文本域的当前文本（字段用连字符形态）
function inputValue(container: HTMLElement, field: string): string | undefined {
  const cell = container.querySelector(`[data-test-id="table-input-${field}"]`);
  const textarea = cell === null ? null : cell.querySelector('textarea');

  return textarea === null ? undefined : textarea.value;
}

// 以文本预置一张带扁平字符串字段、嵌套 object 与数值字段的表格及其 schema
function seedSampleTable(fs: FakeFileSystem, name: string): void {
  fs.seed(tableDataPath(name), JSON.stringify({ name: 'hello', count: 42, nested: { inner: 'deep' } }));
  fs.seed(
    tableSchemaPath(name),
    JSON.stringify({
      type: 'object',
      properties: {
        name: { type: 'string', description: '名字' },
        count: { type: 'number', description: '数量' },
        nested: {
          type: 'object',
          description: '嵌套组',
          properties: { inner: { type: 'string', description: '内部字段' } },
        },
      },
    }),
  );
}

describe('tablePanelType 经打开参数瞄准目标', () => {
  // 携带 target 打开参数时，面板在构造阶段即瞄准目标表并渲染 schema 驱动的行
  it('经打开参数一打开即瞄准目标表', async () => {
    const fs = new FakeFileSystem();

    seedSampleTable(fs, 'demo');
    const system = await createTableHarness(fs);

    system.shellSystem.registerPanelType(tablePanelType);

    const tabId = system.shellSystem.listTabs()[0].id;

    await act(async () => {
      await system.shellSystem.openPanelInTab(tabId, tablePanelType.id, {
        target: { dataPath: tableDataPath('demo') },
      });
    });

    const { container } = render(createElement(system.shellSystem.render()));

    expect(screen.getByText('条目')).not.toBeNull();
    expect(screen.getByText('注释')).not.toBeNull();
    expect(screen.getByText('值')).not.toBeNull();
    expect(screen.getByText('操作')).not.toBeNull();
    expect(screen.getByTestId('gap-toggle-nested')).not.toBeNull();
    expect(screen.getByText('nested')).not.toBeNull();
    expect(inputValue(container, 'name')).toBe('"hello"');
  });

  // 缺省打开参数时不瞄准，落回空栏三按钮态，与旧行为一致（空栏呈现改为内联控件，G-02.1-1）
  it('缺省打开参数时不瞄准目标表', async () => {
    const fs = new FakeFileSystem();

    seedSampleTable(fs, 'demo');
    const system = await createTableHarness(fs);

    system.shellSystem.registerPanelType(tablePanelType);

    const tabId = system.shellSystem.listTabs()[0].id;

    await act(async () => {
      await system.shellSystem.openPanelInTab(tabId, tablePanelType.id);
    });

    const { container } = render(createElement(system.shellSystem.render()));
    const column = container.querySelectorAll('.etable-column')[0];

    expect(column.querySelector('[data-test-id="table-empty-open"]')).not.toBeNull();
    expect(column.querySelector('[data-test-id="table-empty-create"]')).not.toBeNull();
    expect(column.querySelector('[data-test-id="table-empty-delete"]')).not.toBeNull();
  });
});
