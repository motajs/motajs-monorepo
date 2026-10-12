import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EditorCore } from '@motajs/editor-core';
import { MemoryBackend } from '../backend/memoryBackend';
import { DEMO_PANEL_TYPE, DEMO_RESOURCE_ID, DEMO_SAMPLE_CONTENT } from '../demo/demoPanel';

describe('开发宿主端到端冒烟', () => {
  // 启动：initialize 解析为 void，外壳自动开出一个空白标签页（typeId 为 null）
  it('启动后生成默认空白标签页', async () => {
    const core = new EditorCore();
    const backend = new MemoryBackend();

    backend.seed(DEMO_RESOURCE_ID, DEMO_SAMPLE_CONTENT);

    await expect(core.initialize(backend)).resolves.toBeUndefined();

    const tabs = core.shellSystem.listTabs();

    expect(tabs.length).toBe(1);
    expect(tabs[0].typeId).toBeNull();
  });

  // 注册 / 打开 / 关闭：注册演示面板后可开实例，关闭后外壳自动补一个空白标签页
  it('可注册演示面板、开实例并关闭', async () => {
    const core = new EditorCore();
    const backend = new MemoryBackend();

    backend.seed(DEMO_RESOURCE_ID, DEMO_SAMPLE_CONTENT);
    await core.initialize(backend);

    expect(core.shellSystem.registerPanelType(DEMO_PANEL_TYPE)).toBe(true);

    const tabId = core.shellSystem.listTabs()[0].id;
    const opened = await core.shellSystem.openPanelInTab(tabId, DEMO_PANEL_TYPE.id);

    expect(opened).toBe(true);
    expect(core.shellSystem.listTabs()[0].typeId).toBe(DEMO_PANEL_TYPE.id);

    await core.shellSystem.closeTab(tabId);

    const tabs = core.shellSystem.listTabs();

    expect(tabs.length).toBe(1);
    expect(tabs[0].typeId).toBeNull();
  });

  // 读内存数据：外壳渲染后演示面板经 context.requestResource 读到内存后端预置内容
  it('演示面板渲染出内存后端内容', async () => {
    const core = new EditorCore();
    const backend = new MemoryBackend();

    backend.seed(DEMO_RESOURCE_ID, DEMO_SAMPLE_CONTENT);
    await core.initialize(backend);
    core.shellSystem.registerPanelType(DEMO_PANEL_TYPE);

    const tabId = core.shellSystem.listTabs()[0].id;

    await core.shellSystem.openPanelInTab(tabId, DEMO_PANEL_TYPE.id);

    render(createElement(core.shellSystem.render()));

    expect(await screen.findByText(DEMO_SAMPLE_CONTENT)).toBeTruthy();
  });
});
