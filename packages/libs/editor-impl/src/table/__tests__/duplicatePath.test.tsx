import { act, cleanup, configure, render } from '@testing-library/react';
import { EditorCore, IEditorPanel, IEditorPanelFactoryParam } from '@motajs/editor-core';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ITablePanelTarget, tablePanelType, TablePanel } from '..';
import { createTableHarness, FakeFileSystem } from './fixtures';

configure({ testIdAttribute: 'data-test-id' });

// 一栏一条路径：同一个表格面板内不许两栏指向同一个数据文件，另一个标签已经持有这条路径时本栏不改目标。
// 这里钉住两种落点——同面板另一栏持有则让那一栏闪一下边框，另一个标签持有则切到那个标签；以及仍然
// 合法的「数据栏 + 它的 schema 栏」组合里的联动刷新与兄弟 schema 栏写盘不被记成外部冲突。

// 用例开始前的原始窗口宽度，供 afterEach 复位
const ORIGINAL_INNER_WIDTH = window.innerWidth;

// 在 jsdom 下按窗口宽度驱动可视栏数：改写 window.innerWidth，视图据此铺出多栏
function setWindowWidth(value: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value });
}

// 每个用例前把窗口宽度复位为足够宽的值，使缺省渲染能铺出两栏
beforeEach(() => {
  setWindowWidth(1000);
});

// 每个用例结束后卸载已挂载组件、恢复真定时器与替身并复位窗口宽度
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  setWindowWidth(ORIGINAL_INNER_WIDTH);
});

// 数据文件路径（`xxx.json`）
function tableDataPath(name: string): string {
  return `${name}.json`;
}

// 数据表目标：数据文件路径按 `xxx.json` 约定
function dataTarget(name: string): ITablePanelTarget {
  return { dataPath: tableDataPath(name) };
}

// 以文本预置一张表的数据与 schema
function seed(fs: FakeFileSystem, name: string, data: unknown, schema: unknown): void {
  fs.seed(tableDataPath(name), JSON.stringify(data));
  fs.seed(`${name}.schema.json`, JSON.stringify(schema));
}

/**
 * 装配一个已初始化的编辑器核心，并注册一个捕获表格面板实例的类型
 * @param fs 内存文件系统替身
 * @returns 编辑器核心与按创建顺序收集的面板实例
 */
async function createTableSystem(fs: FakeFileSystem): Promise<{ system: EditorCore; created: TablePanel[] }> {
  const system = await createTableHarness(fs);
  const created: TablePanel[] = [];

  system.shellSystem.registerPanelType({
    id: tablePanelType.id,
    name: tablePanelType.name,
    icon: tablePanelType.icon,
    create: (param: IEditorPanelFactoryParam): IEditorPanel => {
      const panel = new TablePanel(param);

      created.push(panel);
      return panel;
    },
  });

  return { system, created };
}

// 让已排队的资源读取与外壳切换微任务全部落定，再冲刷 React 更新
async function flush(): Promise<void> {
  await act(async (): Promise<void> => {
    await new Promise<unknown>((resolve): void => {
      setTimeout(resolve, 0);
    });
  });
}

describe('另一个标签已持有该路径（D-28）', () => {
  // 标签 B 想打开标签 A 已经持有的文件：B 的目标保持不变，外壳切回 A，文件没有被写盘
  it('本栏不改目标、切到持有者标签、不写盘', async () => {
    const fs = new FakeFileSystem();

    seed(fs, 'a', { value: '1' }, { type: 'object', properties: { value: { type: 'string' } } });

    const seedText = await fs.readFile(tableDataPath('a'));
    const { system, created } = await createTableSystem(fs);

    const firstTab = system.shellSystem.listTabs()[0].id;

    await act(async () => {
      await system.shellSystem.openPanelInTab(
        firstTab,
        tablePanelType.id,
        undefined,
        tableDataPath('a'),
      );
    });

    created[0].setTable(dataTarget('a'), 0);
    await flush();

    const secondTab = system.shellSystem.openBlankTab();

    await act(async () => {
      await system.shellSystem.openPanelInTab(secondTab, tablePanelType.id);
    });

    await act(async () => {
      await system.shellSystem.activateTab(secondTab);
    });

    const { container } = render(createElement(system.shellSystem.render()));

    await act(async () => {
      created[1].setTable(dataTarget('a'), 0);
    });
    await flush();

    expect(created[1]['columns'][0].target).toBeNull();

    const activeTabs = container.querySelectorAll('.editor-shell-tab.is-active');

    expect(activeTabs.length).toBe(1);
    expect(container.querySelector('.editor-shell-content')?.textContent).toContain('value');
    expect(await fs.readFile(tableDataPath('a'))).toBe(seedText);
  });
});
