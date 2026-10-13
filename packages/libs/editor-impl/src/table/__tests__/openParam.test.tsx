import { act, cleanup, render, screen } from '@testing-library/react';
import { ResourceSystem, ShellSystem, UndoSystem } from '@motajs/editor-core';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { tableDataResourceId, tablePanelType, tableSchemaResourceId } from '..';
import { FakeResourceInjection } from './fixtures';

interface TestSystem {
  /** 外壳系统 */
  readonly shellSystem: ShellSystem;
  /** 资源系统 */
  readonly resourceSystem: ResourceSystem;
  /** 内存资源后端 */
  readonly injection: FakeResourceInjection;
}

// 每个用例结束后卸载已挂载的组件，避免 DOM 在用例之间累积
afterEach(() => {
  cleanup();
});

// 读取指定字段值单元格内文本域的当前文本（字段用连字符形态）
function inputValue(container: HTMLElement, field: string): string | undefined {
  const cell = container.querySelector(`[data-test-id="table-input-${field}"]`);
  const textarea = cell === null ? null : cell.querySelector('textarea');

  return textarea === null ? undefined : textarea.value;
}

// 组装一套已初始化的外壳 / 资源 / 撤回系统与内存后端
async function createSystem(): Promise<TestSystem> {
  const injection = new FakeResourceInjection();
  const resourceSystem = new ResourceSystem();
  await resourceSystem.initialize(injection);
  const undoSystem = new UndoSystem();
  await undoSystem.initialize({ maxUndoStep: 100 });
  const shellSystem = new ShellSystem(undoSystem, resourceSystem);
  await shellSystem.initialize();
  return { shellSystem, resourceSystem, injection };
}

// 预置一张带扁平字符串字段、嵌套 object 与数值字段的表格及其 schema
function seedSampleTable(system: TestSystem, name: string): void {
  system.injection.seed(tableDataResourceId(name), { name: 'hello', count: 42, nested: { inner: 'deep' } });
  system.injection.seed(tableSchemaResourceId(name), {
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
  });
}

describe('tablePanelType 经打开参数瞄准目标', () => {
  // 携带 target 打开参数时，面板在构造阶段即瞄准目标表并渲染 schema 驱动的行
  it('经打开参数一打开即瞄准目标表', async () => {
    const system = await createSystem();

    seedSampleTable(system, 'demo');
    system.shellSystem.registerPanelType(tablePanelType);

    const tabId = system.shellSystem.listTabs()[0].id;

    await act(async () => {
      await system.shellSystem.openPanelInTab(tabId, tablePanelType.id, {
        target: { data: tableDataResourceId('demo'), schema: tableSchemaResourceId('demo') },
      });
    });

    const { container } = render(createElement(system.shellSystem.render()));

    expect(screen.getByText('条目')).not.toBeNull();
    expect(screen.getByText('注释')).not.toBeNull();
    expect(screen.getByText('值')).not.toBeNull();
    expect(screen.getByText('操作')).not.toBeNull();
    expect(screen.getByText("['nested']")).not.toBeNull();
    expect(inputValue(container, 'name')).toBe('"hello"');
  });

  // 缺省打开参数时不瞄准，落回「尚未设置目标表」态，与旧行为一致
  it('缺省打开参数时不瞄准目标表', async () => {
    const system = await createSystem();

    seedSampleTable(system, 'demo');
    system.shellSystem.registerPanelType(tablePanelType);

    const tabId = system.shellSystem.listTabs()[0].id;

    await act(async () => {
      await system.shellSystem.openPanelInTab(tabId, tablePanelType.id);
    });

    render(createElement(system.shellSystem.render()));

    expect(screen.getByText('尚未设置目标表')).not.toBeNull();
    expect(screen.getByText('请先为该表格面板指定要编辑的表格。')).not.toBeNull();
  });
});
