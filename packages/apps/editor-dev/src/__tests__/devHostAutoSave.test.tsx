import { act, cleanup, configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EditorCore } from '@motajs/editor-core';
import { CapabilityProvider } from '@motajs/editor-impl/react';
import { tablePanelType } from '@motajs/editor-impl/table';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryBackend } from '../backend/memoryBackend';
import {
  createTableDemoData,
  TABLE_DEMO_DATA,
  TABLE_DEMO_DATA_PATH,
  TABLE_DEMO_ENTRY_COUNT,
  TABLE_DEMO_SCHEMA,
  TABLE_DEMO_SCHEMA_PATH,
} from '../demo/tableDemo';

// 开发宿主自动保存的端到端用例：真实编辑器核心 + 真实内存文件系统 + 真实表格面板，不 mock 资源层。
// 三条语义：不点保存要等 5 000 毫秒磁盘才变；切标签立刻写盘；关标签看得到「正在保存…」且关闭后磁盘是新值。
// 缓冲相关断言必须显式推进 5 000 毫秒：只推进一个 0 毫秒宏任务不会让 5 秒防抖到期。

configure({ testIdAttribute: 'data-test-id' });

/** 演示表数据里的原始标题，用来区分「磁盘还是旧值」与「磁盘已是新值」 */
const ORIGINAL_TITLE: string = String(createTableDemoData(TABLE_DEMO_ENTRY_COUNT).title);

/** 开发宿主的装配结果 */
interface IDevHost {
  /** 编辑器核心 */
  readonly core: EditorCore;
  /** 内存后端，供用例读回表格文件 */
  readonly backend: MemoryBackend;
}

// 每个用例结束后卸载已挂载的组件并恢复真定时器，避免用例之间累积
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/**
 * 装配开发宿主：seed 演示表格与 schema，注册表格面板类型，再带着真实内存文件系统初始化核心
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
 * 经真实外壳新开一个标签并打开演示表
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
 * @returns 渲染容器
 */
async function renderShell(core: EditorCore): Promise<HTMLElement> {
  const { container } = render(
    createElement(CapabilityProvider, { children: createElement(core.shellSystem.render()) }),
  );

  await act(async () => {});

  return container;
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
 * 在活动表格里修改标题并失焦确认（确认即写缓冲，不写磁盘）
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
 * 推进假定时器并冲刷一次 React 更新：缓冲到期写盘是一条异步链，要等它结算完
 * @param milliseconds 要推进的毫秒数
 */
async function advance(milliseconds: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(milliseconds);
  await act(async () => {});
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

describe('开发宿主自动保存', () => {
  // 改一格、不点保存：确认后磁盘仍是旧值，推进 5 000 毫秒后磁盘才是新值
  it('改一格不点保存：推进 5 000 毫秒后磁盘才是新值', async () => {
    const { core, backend } = await createHost();
    const tabId = await openTableTab(core);

    await renderShell(core);
    await activateTab(core, tabId);

    vi.useFakeTimers();

    await commitTitle('延迟落盘的值');

    expect(await readTitle(backend)).toBe(ORIGINAL_TITLE);

    await advance(5000);

    expect(await readTitle(backend)).toBe('延迟落盘的值');
  }, 20000);

  // 切标签：切出时外壳把缓冲打到磁盘，不推进任何定时器磁盘就必须已是新值
  it('切标签后磁盘立刻是新值', async () => {
    const { core, backend } = await createHost();
    const tabId = await openTableTab(core);
    const otherTabId = await openTableTab(core);

    await renderShell(core);
    await activateTab(core, tabId);
    await commitTitle('切标签立刻落盘的值');

    expect(await readTitle(backend)).toBe(ORIGINAL_TITLE);

    await activateTab(core, otherTabId);

    expect(await readTitle(backend)).toBe('切标签立刻落盘的值');
  }, 20000);

  // 关标签：有待写时弹三态框，点「保存并关闭」当场看得到「正在保存…」，关闭完成后磁盘是新值
  it('关标签时显示「正在保存…」且关闭后磁盘是新值', async () => {
    const { core, backend } = await createHost();
    const tabId = await openTableTab(core);
    const container = await renderShell(core);

    await activateTab(core, tabId);
    await commitTitle('关闭前落盘的值');

    expect(await readTitle(backend)).toBe(ORIGINAL_TITLE);

    // 初始化会先建一个空白标签，表格开在它后面的新标签里：只点「关闭「…」」那个，别点到空白标签的关闭按钮
    const closeButton = container.querySelector('[aria-label^="关闭「"]');

    if (closeButton === null) throw new Error('标签关闭按钮缺失');

    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.getByTestId('panel-close-dialog')).not.toBeNull();
    });

    // 点「保存并关闭」只把写盘排进异步链：不等它结算，「正在保存…」必须当场就看得见
    fireEvent.click(screen.getByTestId('panel-close-save'));

    expect(screen.getByTestId('panel-close-save').textContent).toContain('正在保存');

    await waitFor(() => {
      expect(core.shellSystem.listTabs()[0].typeId).toBeNull();
    });

    expect(screen.queryByTestId('panel-close-dialog')).toBeNull();
    expect(await readTitle(backend)).toBe('关闭前落盘的值');
  }, 20000);
});
