import { act, cleanup, render } from '@testing-library/react';
import { createElement, FC } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { createCoreHarness, FakeFileSystem } from '../../__tests__/fixtures';
import { EditorCore } from '../../core';
import { IEditorPanel, IEditorPanelFactoryParam, IEditorPanelType } from '../../panel/types';

// 每个用例结束后卸载已挂载的组件，避免 DOM 在用例之间累积
afterEach(() => {
  cleanup();
});

class ProbePanel implements IEditorPanel {
  readonly id: string;

  private readonly component: FC;

  constructor(id: string) {
    this.id = id;
    this.component = () => createElement('div', null, this.id);
  }

  async initialize(): Promise<void> {}

  async dispose(): Promise<void> {}

  render(): FC {
    return this.component;
  }

  async onFocus(): Promise<void> {}

  async onBlur(): Promise<void> {}

  async onSwitchIn(): Promise<void> {}

  async onSwitchOut(): Promise<void> {}

  async onUpdateResource(): Promise<void> {}

  async undo(): Promise<void> {}

  async redo(): Promise<void> {}
}

// 装配一个已初始化、空文件系统的编辑器核心
async function createCore(): Promise<EditorCore> {
  return createCoreHarness(new FakeFileSystem());
}

// 造一个只声明基础能力（id / name / icon / create）的面板类型
function createPlainType(id: string): IEditorPanelType {
  return {
    id,
    name: '基础面板',
    icon: null,
    create: (param: IEditorPanelFactoryParam): IEditorPanel => new ProbePanel(param.instanceId),
  };
}

describe('面板类型的可选打开能力', () => {
  // 未声明打开能力的类型，listPanelTypes 原样带出的对象上 canOpen 与 createOpenParam 仍是 undefined
  it('未声明打开能力的类型不带 canOpen 与 createOpenParam', async () => {
    const core = await createCore();
    const type = createPlainType('plain');

    core.shellSystem.registerPanelType(type);
    const listed = core.shellSystem.listPanelTypes().find((entry) => entry.id === 'plain');

    expect(listed).toBe(type);
    expect(listed!.canOpen).toBeUndefined();
    expect(listed!.createOpenParam).toBeUndefined();
  });

  // 同时声明两个能力的类型被 listPanelTypes 以同一对象引用带出，两项能力可原样调用并返回预期值
  it('声明打开能力的类型原样透传并可调用', async () => {
    const core = await createCore();
    const type: IEditorPanelType = {
      ...createPlainType('openable'),
      canOpen: (path: string): boolean => path.endsWith('.jsonc'),
      createOpenParam: (path: string): Record<string, unknown> => ({ target: { dataPath: path } }),
    };

    core.shellSystem.registerPanelType(type);
    const listed = core.shellSystem.listPanelTypes().find((entry) => entry.id === 'openable');

    expect(listed).toBe(type);
    expect(listed!.canOpen!('tables/hero.jsonc')).toBe(true);
    expect(listed!.canOpen!('tables/hero.json')).toBe(false);
    expect(listed!.createOpenParam!('tables/hero.jsonc')).toEqual({ target: { dataPath: 'tables/hero.jsonc' } });
  });

  // createOpenParam 每次调用都返回新对象，两次结果值相等但不共享引用
  it('createOpenParam 每次返回新对象', async () => {
    const core = await createCore();
    const type: IEditorPanelType = {
      ...createPlainType('openable'),
      canOpen: (path: string): boolean => path.endsWith('.jsonc'),
      createOpenParam: (path: string): Record<string, unknown> => ({ target: { dataPath: path } }),
    };

    core.shellSystem.registerPanelType(type);
    const listed = core.shellSystem.listPanelTypes().find((entry) => entry.id === 'openable');
    const first = listed!.createOpenParam!('tables/hero.jsonc');
    const second = listed!.createOpenParam!('tables/hero.jsonc');

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
  });

  // 外壳把打开参数原样交给面板工厂，不解释其形状
  it('外壳把打开参数原样送达工厂', async () => {
    const core = await createCore();
    const captured: IEditorPanelFactoryParam[] = [];
    const type: IEditorPanelType = {
      ...createPlainType('opener'),
      canOpen: (path: string): boolean => path.endsWith('.jsonc'),
      createOpenParam: (path: string): Record<string, unknown> => ({ target: { dataPath: path } }),
    };

    core.shellSystem.registerPanelType({
      ...type,
      create: (param: IEditorPanelFactoryParam): IEditorPanel => {
        captured.push(param);
        return new ProbePanel(param.instanceId);
      },
    });
    render(createElement(core.shellSystem.render()));

    const listed = core.shellSystem.listPanelTypes().find((entry) => entry.id === 'opener');
    const openParam = listed!.createOpenParam!('tables/hero.jsonc');
    const tabId = core.shellSystem.listTabs()[0].id;

    await act(async () => {
      await core.shellSystem.openPanelInTab(tabId, 'opener', openParam);
    });

    expect(captured.length).toBe(1);
    expect(captured[0].openParam).toBe(openParam);
  });
});
