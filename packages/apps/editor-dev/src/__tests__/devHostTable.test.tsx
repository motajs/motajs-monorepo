import { act, cleanup, render, screen } from '@testing-library/react';
import { EditorCore } from '@motajs/editor-core';
import { CapabilityProvider } from '@motajs/editor-impl/react';
import { tablePanelType } from '@motajs/editor-impl/table';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryBackend } from '../backend/memoryBackend';
import {
  openTableDemoPanel,
  TABLE_DEMO_DATA,
  TABLE_DEMO_MENU_ID,
  TABLE_DEMO_MENU_TITLE,
  TABLE_DEMO_SCHEMA,
  TABLE_DEMO_TARGET,
} from '../demo/tableDemo';

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
    expect(inputValue(container, 'level')).toBe('3');
    expect(inputValue(container, 'position-x')).toBe('12');
    expect(inputValue(container, 'position-y')).toBe('34');
  });

  // 组合根接好线：已注册「打开表格」菜单项与表格面板类型
  it('已注册「打开表格」菜单项与表格面板类型', async () => {
    const core = await createHost();

    const matching = core.shellSystem.listMenuItems().filter((item) => item.id === TABLE_DEMO_MENU_ID);

    expect(matching.length).toBe(1);
    expect(matching[0].title).toBe(TABLE_DEMO_MENU_TITLE);
    expect(core.shellSystem.listPanelTypes().map((type) => type.id)).toContain('table');
  });
});
