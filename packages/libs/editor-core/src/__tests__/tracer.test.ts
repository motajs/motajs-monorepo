import { createElement, FC } from 'react';
import { describe, expect, it } from 'vitest';
import { IEditorPanel, IEditorPanelContext, IEditorPanelFactoryParam } from '../panel';
import { FakeFileSystem, createCoreHarness } from './fixtures';

// 最小探针面板：仅提供外壳渲染所需的空实现
class ProbePanel implements IEditorPanel {
  readonly id: string = 'probe';

  private readonly component: FC = () => createElement('div');

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

  async undo<T>(): Promise<void> {}

  async redo<T>(): Promise<void> {}
}

describe('editor-core 端到端 tracer', () => {
  // 注入内存文件系统后，面板经上下文按路径读取原文，写回后底层 fs 内该路径内容随之更新
  it('按路径读 / 写落到底层文件系统', async () => {
    const fs = new FakeFileSystem();

    fs.seed('tables/demo.json', '{"a":1}');

    const core = await createCoreHarness(fs);
    const contexts: IEditorPanelContext[] = [];

    core.shellSystem.registerPanelType({
      id: 'probe',
      name: '探针面板',
      icon: null,
      create: (param: IEditorPanelFactoryParam): IEditorPanel => {
        contexts.push(param.context);
        return new ProbePanel();
      },
    });

    const tabId = core.shellSystem.listTabs()[0].id;

    await core.shellSystem.openPanelInTab(tabId, 'probe');

    const resource = await contexts[0].requestResource('tables/demo.json');

    expect(resource).not.toBeNull();

    const first = await resource?.request();

    expect(first).toBe('{"a":1}');

    await resource?.write('{"a":2}');

    const second = await resource?.request();

    expect(second).toBe('{"a":2}');
    expect(await fs.readFile('tables/demo.json')).toBe('{"a":2}');
  });
});
