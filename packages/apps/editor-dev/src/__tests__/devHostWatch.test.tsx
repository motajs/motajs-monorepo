import { act, cleanup, configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EditorCore, ShellSystem } from '@motajs/editor-core';
import { CapabilityProvider } from '@motajs/editor-impl/react';
import { TableEditKind, TablePanel, tablePanelType } from '@motajs/editor-impl/table';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryBackend } from '../backend/memoryBackend';
import {
  TABLE_DEMO_DATA,
  TABLE_DEMO_DATA_PATH,
  TABLE_DEMO_SCHEMA,
  TABLE_DEMO_SCHEMA_PATH,
} from '../demo/tableDemo';

// 开发宿主文件变化流的集成用例：两个标签打开同一张表，验证「一边保存 → 另一边自动刷新」与「另一边脏时弹冲突框」。
// 变化事件由 MemoryBackend.watch 真实投递，写盘经真实资源层；用例只在「A 保存」一步直接调用面板的 save，
// 因为切标签会自动保存脏栏，无法在 B 仍为活动标签时让 A 经界面保存。

configure({ testIdAttribute: 'data-test-id' });

/** 开发宿主的装配结果 */
interface IDevHost {
  /** 编辑器核心 */
  readonly core: EditorCore;
  /** 内存后端，供用例读回表格文件 */
  readonly backend: MemoryBackend;
}

// 每个用例结束后卸载已挂载的组件，避免 DOM 在用例之间累积
afterEach(() => {
  cleanup();
});

/**
 * 装配开发宿主：seed 演示表格与 schema，注册表格面板类型，再带着变化流初始化核心
 * @returns 核心与内存后端
 */
async function createHost(): Promise<IDevHost> {
  const core = new EditorCore();
  const backend = new MemoryBackend();

  backend.seed(TABLE_DEMO_DATA_PATH, TABLE_DEMO_DATA);
  backend.seed(TABLE_DEMO_SCHEMA_PATH, TABLE_DEMO_SCHEMA);
  core.shellSystem.registerPanelType(tablePanelType);

  await core.initialize({ fs: backend, maxUndoStep: backend.maxUndoStep });
  return { core, backend };
}

/**
 * 经真实外壳新开一个标签并打开同一张演示表
 * @param core 编辑器核心
 * @returns 表格标签的标识符
 */
async function openTableTab(core: EditorCore): Promise<string> {
  const tabId = core.shellSystem.openBlankTab();

  await act(async () => {
    await core.shellSystem.openPanelInTab(tabId, tablePanelType.id, { target: { dataPath: TABLE_DEMO_DATA_PATH } });
  });
  await act(async () => {});

  return tabId;
}

/**
 * 渲染外壳并注入表格能力包
 * @param core 编辑器核心
 */
function renderShell(core: EditorCore): void {
  render(createElement(CapabilityProvider, { children: createElement(core.shellSystem.render()) }));
}

/**
 * 等待外壳切到指定标签并完成切出保存
 * @param core 编辑器核心
 * @param tabId 标签标识符
 */
async function activateTab(core: EditorCore, tabId: string): Promise<void> {
  await act(async () => {
    await core.shellSystem.activateTab(tabId);
  });
  await act(async () => {});
}

/**
 * 取某个标签里的表格面板实例
 * @param core 编辑器核心
 * @param tabId 标签标识符
 * @returns 表格面板实例
 */
function panelOf(core: EditorCore, tabId: string): TablePanel {
  const tab = core.shellSystem.listTabs().find((candidate) => candidate.id === tabId);
  const instanceId = tab === undefined ? null : tab.instanceId;
  const instance =
    instanceId === null ? undefined : (core.shellSystem as ShellSystem)['instances'].get(instanceId);

  if (!(instance instanceof TablePanel)) throw new Error('表格面板实例缺失');

  return instance;
}

/**
 * 取当前活动表格的标题输入框
 * @returns 标题文本域
 */
function titleInput(): HTMLTextAreaElement {
  const cell = screen.getByTestId('table-input-title');
  const textarea = cell.querySelector('textarea');

  if (textarea === null) throw new Error('标题输入框缺失');

  return textarea;
}

/**
 * 在活动表格里修改标题并失焦提交
 * @param value 新标题
 */
async function commitTitle(value: string): Promise<void> {
  const textarea = titleInput();

  await act(async () => {
    fireEvent.change(textarea, { target: { value: JSON.stringify(value) } });
    fireEvent.blur(textarea);
  });
  await act(async () => {});
}

/**
 * 等变化流（下一宏任务）投递并让面板处理完成
 */
async function flushWatch(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
  });
  await act(async () => {});
}

/**
 * 点当前表格的「保存」并等变化流投递
 */
async function clickSave(): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByTestId('table-save'));
  });
  await act(async () => {});
  await flushWatch();
}

/**
 * 在非活动面板上改标题并保存，模拟另一个标签的保存
 * @param panel 非活动的表格面板
 * @param title 新标题
 */
async function saveFromBackground(panel: TablePanel, title: string): Promise<void> {
  panel.applyEdit(0, { kind: TableEditKind.Change, key: "['title']", value: title }, panel['currentDocument'](0));

  await act(async () => {
    await panel.save(0);
  });
  await flushWatch();
}

/**
 * 读回表格文件里的标题
 * @param backend 内存后端
 * @returns 标题字段；文件内容不是对象时为 undefined
 */
async function readTitle(backend: MemoryBackend): Promise<unknown> {
  const text = await backend.readFile(TABLE_DEMO_DATA_PATH);
  const parsed: unknown = JSON.parse(text);

  if (typeof parsed !== 'object' || parsed === null) return undefined;

  return Reflect.get(parsed, 'title');
}

describe('开发宿主两标签同步', () => {
  // A 保存后变化流到达 B，B 不脏时自动刷新且不弹冲突框；切到 B 能直接看到 A 的值
  it('A 保存后 B 自动刷新且不弹框', async () => {
    const { core } = await createHost();
    const tabA = await openTableTab(core);
    const tabB = await openTableTab(core);

    renderShell(core);
    await activateTab(core, tabA);

    const panelB = panelOf(core, tabB);
    const versionBefore = panelB['columns'][0].contentVersion;

    await commitTitle('A 保存的值');
    await clickSave();

    await waitFor(() => {
      expect(panelB['columns'][0].contentVersion).toBeGreaterThan(versionBefore);
    });
    expect(panelB['conflictStore'].state).toBeUndefined();
    expect(screen.queryByTestId('panel-conflict-dialog')).toBeNull();

    await activateTab(core, tabB);
    await waitFor(() => {
      expect(titleInput().value).toBe(JSON.stringify('A 保存的值'));
    });
    expect(screen.queryByTestId('panel-conflict-dialog')).toBeNull();
  }, 20000);

  // B 有未保存改动时 A 保存 → 弹冲突框；选「放弃」后 B 换成 A 的值并清掉脏标记
  it('B 脏时 A 保存弹冲突框，放弃后刷新为 A 的值', async () => {
    const { core, backend } = await createHost();
    const tabA = await openTableTab(core);
    const tabB = await openTableTab(core);

    renderShell(core);
    await activateTab(core, tabB);
    await commitTitle('B 的草稿');

    await saveFromBackground(panelOf(core, tabA), 'A 第二次保存');

    await waitFor(() => {
      expect(screen.getByTestId('panel-conflict-dialog')).not.toBeNull();
    });
    expect(titleInput().value).toBe(JSON.stringify('B 的草稿'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('panel-conflict-discard'));
    });
    await act(async () => {});

    expect(screen.queryByTestId('panel-conflict-dialog')).toBeNull();
    expect(titleInput().value).toBe(JSON.stringify('A 第二次保存'));
    expect(screen.queryByTestId('table-unsaved')).toBeNull();
    expect(await readTitle(backend)).toBe('A 第二次保存');
  }, 20000);

  // 选「保留」后 B 内容不变；下一次保存把草稿写回并覆盖外部内容
  it('B 脏时 A 保存弹冲突框，保留后 B 的下一次保存覆盖外部内容', async () => {
    const { core, backend } = await createHost();
    const tabA = await openTableTab(core);
    const tabB = await openTableTab(core);

    renderShell(core);
    await activateTab(core, tabB);
    await commitTitle('B 保留的草稿');

    await saveFromBackground(panelOf(core, tabA), 'A 第三次保存');

    await waitFor(() => {
      expect(screen.getByTestId('panel-conflict-dialog')).not.toBeNull();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('panel-conflict-keep'));
    });
    await act(async () => {});

    expect(screen.queryByTestId('panel-conflict-dialog')).toBeNull();
    expect(titleInput().value).toBe(JSON.stringify('B 保留的草稿'));

    await clickSave();

    expect(await readTitle(backend)).toBe('B 保留的草稿');
  }, 20000);
});
