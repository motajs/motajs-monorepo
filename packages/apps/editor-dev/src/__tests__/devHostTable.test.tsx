import { act, cleanup, configure, fireEvent, render, screen } from '@testing-library/react';
import { EditorCore } from '@motajs/editor-core';
import { CapabilityProvider } from '@motajs/editor-impl/react';
import { tablePanelType } from '@motajs/editor-impl/table';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryBackend } from '../backend/memoryBackend';
import {
  createTablePanelOpener,
  openTableDemoPanel,
  TABLE_DEMO_DATA,
  TABLE_DEMO_MENU_ID,
  TABLE_DEMO_MENU_TITLE,
  TABLE_DEMO_SCHEMA,
  TABLE_DEMO_TARGET,
} from '../demo/tableDemo';

configure({ testIdAttribute: 'data-test-id' });

// 每个用例结束后卸载已挂载的组件，避免 DOM 在用例之间累积
afterEach(() => {
  cleanup();
});

// 装配开发宿主组合根：内存后端 seed demo 表资源、注册表格面板类型与「打开表格」菜单项
async function createHost(): Promise<EditorCore> {
  const core = new EditorCore();
  const backend = new MemoryBackend();

  backend.seed(TABLE_DEMO_TARGET.data, TABLE_DEMO_DATA);
  backend.seed(TABLE_DEMO_TARGET.schema, TABLE_DEMO_SCHEMA);
  core.shellSystem.registerPanelType(tablePanelType);
  core.shellSystem.registerMenuItem({
    id: TABLE_DEMO_MENU_ID,
    title: TABLE_DEMO_MENU_TITLE,
    onClick: (): void => {
      void openTableDemoPanel(core);
    },
  });

  await core.initialize(backend);
  return core;
}

// 读取某个字段值单元格内文本域的当前文本
function inputValue(container: HTMLElement, field: string): string | undefined {
  const cell = container.querySelector(`[data-test-id="table-input-${field}"]`);
  const textarea = cell === null ? null : cell.querySelector('textarea');

  return textarea === null ? undefined : textarea.value;
}

// 读取某个数字字段值单元格内数字输入的当前文本
function numberValue(container: HTMLElement, field: string): string | undefined {
  const cell = container.querySelector(`[data-test-id="table-input-${field}"]`);
  const input = cell === null ? null : cell.querySelector('input');

  return input === null ? undefined : input.value;
}

// 用能力 Provider 包裹外壳渲染根，注入开发宿主的表格面板打开器（对应 main.tsx 的接线）
function renderWithTableOpener(core: EditorCore): ReturnType<typeof render> {
  return render(
    createElement(CapabilityProvider, {
      capabilities: { tablePanel: createTablePanelOpener(core) },
      children: createElement(core.shellSystem.render()),
    }),
  );
}

describe('开发宿主表格接入', () => {
  // 经打开参数打开 demo 表格后，外壳渲染出 schema 驱动的嵌套分组行与叶子行
  it('经打开参数打开 demo 表格并渲染 schema 驱动行', async () => {
    const core = await createHost();

    await act(async () => {
      await openTableDemoPanel(core);
    });

    const { container } = render(
      createElement(CapabilityProvider, { children: createElement(core.shellSystem.render()) }),
    );

    expect(screen.getByText("['position']")).not.toBeNull();
    expect(screen.getByText('标题')).not.toBeNull();
    expect(screen.getByText('等级')).not.toBeNull();
    expect(screen.getByText('横坐标')).not.toBeNull();
    expect(screen.getByText('纵坐标')).not.toBeNull();
    expect(inputValue(container, 'title')).toBe(JSON.stringify('示例条目'));
    expect(numberValue(container, 'level')).toBe('3');
    expect(numberValue(container, 'position-x')).toBe('12');
    expect(numberValue(container, 'position-y')).toBe('34');
  });

  // 组合根接好线：已注册「打开表格」菜单项与表格面板类型
  it('已注册「打开表格」菜单项与表格面板类型', async () => {
    const core = await createHost();

    const matching = core.shellSystem.listMenuItems().filter((item) => item.id === TABLE_DEMO_MENU_ID);

    expect(matching.length).toBe(1);
    expect(matching[0].title).toBe(TABLE_DEMO_MENU_TITLE);
    expect(core.shellSystem.listPanelTypes().map((type) => type.id)).toContain('table');
  });

  // 注入表格打开器后，数据表格工具栏的「编辑 Schema」按钮存在且未被禁用
  it('注入表格打开器后「编辑 Schema」按钮可用', async () => {
    const core = await createHost();

    await act(async () => {
      await openTableDemoPanel(core);
    });

    const { container } = renderWithTableOpener(core);
    const button = container.querySelector('[data-test-id="table-edit-schema"]');

    expect(button).not.toBeNull();
    expect(button === null ? undefined : button.getAttribute('disabled')).toBeNull();
  });

  // 点击「编辑 Schema」后按 D-06 新开一个标签承载 schema 视图面板，且一打开即渲染 schema 提示条
  it('点击「编辑 Schema」新开 schema 视图面板', async () => {
    const core = await createHost();

    await act(async () => {
      await openTableDemoPanel(core);
    });

    const { container } = renderWithTableOpener(core);
    const tabsBefore = core.shellSystem.listTabs().length;

    await act(async () => {
      fireEvent.click(screen.getByTestId('table-edit-schema'));
    });

    expect(core.shellSystem.listTabs().length).toBe(tabsBefore + 1);
    expect(container.querySelector('[data-test-id="schema-banner"]')).not.toBeNull();
    expect(screen.getByText('正在编辑表格结构（Schema）')).not.toBeNull();
  });
});
