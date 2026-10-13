import { act, cleanup, render, screen } from '@testing-library/react';
import { createElement, FC } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { IEditorPanel, IEditorPanelFactoryParam } from '../../panel/types';
import { ResourceSystem } from '../../resource/resourceSystem';
import { IResourceIdentifier, IResourceInjection } from '../../resource/types';
import { UndoSystem } from '../../undo/undoSystem';
import { ShellSystem } from '../shellSystem';

// 每个用例结束后卸载已挂载的组件，避免 DOM 在用例之间累积
afterEach(() => {
  cleanup();
});

// 空的资源后端：本文件的面板不读资源，仅用于装配外壳
class EmptyInjection implements IResourceInjection {
  async requestResource<T>(): Promise<T> {
    return undefined as T;
  }

  async requestResourceList(): Promise<readonly IResourceIdentifier[]> {
    return [];
  }

  async writeResource(): Promise<void> {}

  async createResource(): Promise<void> {}

  async deleteResource(): Promise<void> {}
}

// 带按实例标题的面板：getTitle 返回构造时给定的标题
class TitlePanel implements IEditorPanel {
  readonly id: string;

  /** 该实例的显示标题；为 undefined 时模拟「未给出标题」 */
  private readonly title: string | undefined;

  private readonly component: FC;

  constructor(id: string, title: string | undefined) {
    this.id = id;
    this.title = title;
    this.component = () => createElement('div', null, this.id);
  }

  getTitle(): string | undefined {
    return this.title;
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

  async onUpdateResource<T>(): Promise<void> {}

  async onUpdateResourceList(): Promise<void> {}

  async undo<T>(): Promise<void> {}

  async redo<T>(): Promise<void> {}
}

// 无按实例标题的面板：不实现 getTitle，外壳应回退面板类型名
class PlainPanel implements IEditorPanel {
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

  async onUpdateResource<T>(): Promise<void> {}

  async onUpdateResourceList(): Promise<void> {}

  async undo<T>(): Promise<void> {}

  async redo<T>(): Promise<void> {}
}

// 组装一套已初始化的外壳系统
async function createShell(): Promise<ShellSystem> {
  const resourceSystem = new ResourceSystem();

  await resourceSystem.initialize(new EmptyInjection());

  const undoSystem = new UndoSystem();

  await undoSystem.initialize({ maxUndoStep: 100 });

  const shellSystem = new ShellSystem(undoSystem, resourceSystem);

  await shellSystem.initialize();
  return shellSystem;
}

// 注册一个面板类型并在空白标签页打开它
async function openType(
  shellSystem: ShellSystem,
  typeId: string,
  create: (param: IEditorPanelFactoryParam) => IEditorPanel,
): Promise<void> {
  shellSystem.registerPanelType({ id: typeId, name: '静态类型名', icon: null, create });

  const tabId = shellSystem.listTabs()[0].id;

  await act(async () => {
    await shellSystem.openPanelInTab(tabId, typeId);
  });
}

describe('外壳标签按实例标题', () => {
  // 面板实现 getTitle 时标签显示该实例标题而非静态类型名
  it('面板给出 getTitle 时标签显示实例标题', async () => {
    const shellSystem = await createShell();

    render(createElement(shellSystem.render()));

    await openType(shellSystem, 'titled', (param) => new TitlePanel(param.instanceId, '表格 table.demo'));

    expect(screen.getByText('表格 table.demo')).not.toBeNull();
    expect(screen.queryByText('静态类型名')).toBeNull();
  });

  // 面板未实现 getTitle 时标签回退到面板类型名
  it('面板未实现 getTitle 时标签回退类型名', async () => {
    const shellSystem = await createShell();

    render(createElement(shellSystem.render()));

    await openType(shellSystem, 'plain', (param) => new PlainPanel(param.instanceId));

    expect(screen.getByText('静态类型名')).not.toBeNull();
  });

  // 面板 getTitle 返回 undefined 时标签回退到面板类型名
  it('getTitle 返回 undefined 时标签回退类型名', async () => {
    const shellSystem = await createShell();

    render(createElement(shellSystem.render()));

    await openType(shellSystem, 'undef', (param) => new TitlePanel(param.instanceId, undefined));

    expect(screen.getByText('静态类型名')).not.toBeNull();
  });
});
