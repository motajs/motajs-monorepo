import { act, cleanup, configure, fireEvent, render, screen } from '@testing-library/react';
import { EditorCore, EditorFileChangeKind, IEditorTab, ShellSystem } from '@motajs/editor-core';
import { CapabilityProvider } from '@motajs/editor-impl/react';
import { TablePanel, tablePanelType } from '@motajs/editor-impl/table';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryBackend } from '../backend/memoryBackend';
import { TABLE_DEMO_DATA, TABLE_DEMO_DATA_PATH, TABLE_DEMO_SCHEMA, TABLE_DEMO_SCHEMA_PATH } from '../demo/tableDemo';

// 开发宿主同路径重复打开与文件变化流的集成用例。
// D-26 / D-27 之后，同一路径在同一页面最多只有一个可编辑标签：调用方把路径交给打开入口后，
// 第二次打开同一路径只会聚焦已有标签，不会出现第二个写者，因此「两个标签打开同一张表」的
// 跨标签冲突 / 静默覆盖在结构上已不存在，本文件据此改写；真正的「外部写入」冲突仍由 editor-impl 的
// externalChange.test.tsx 与 twoColumnsSameTable.test.tsx 覆盖，这里不重复造同一场景。
// 变化事件由 MemoryBackend.watch 真实投递，写盘经真实资源层；不 mock 资源层。

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
 * 经真实外壳新开一个标签并打开演示表；**只用于第一次打开**
 *
 * 这里必须把路径一并交给打开入口，外壳才会登记「标签 → 路径」，第二次打开才能命中去重。
 * 第二次打开不能先 `ShellSystem.openBlankTab` 再 `ShellSystem.openPanelInTab`：空白标签一建，
 * 外壳就会让它成为活动标签、让原来的表格切出并把草稿写进缓冲、紧接着打盘，
 * 「未提交草稿」这个前提当场消失，后面的断言就成了恒真。第二次打开请走 `focusTableTab`。
 * @param core 编辑器核心
 * @returns 表格标签的标识符
 */
async function openTableTab(core: EditorCore): Promise<string> {
  const tabId = core.shellSystem.openBlankTab();

  await act(async () => {
    await core.shellSystem.openPanelInTab(
      tabId,
      tablePanelType.id,
      { target: { dataPath: TABLE_DEMO_DATA_PATH } },
      TABLE_DEMO_DATA_PATH,
    );
  });
  await act(async () => {});

  return tabId;
}

/**
 * 模拟「用户再次打开同一条路径」：直接把路径交给已经开着这张表的那个标签
 *
 * 命中「本次 tabId 就是登记该路径的标签」这一支，只会 `ShellSystem.activateTab`；
 * 同一实例的切出在 `ShellSystem.departActiveInstance` 处短路，因此不会落盘、也不会重建实例。
 * @param core 编辑器核心
 * @param tabId 已经开着这张表的标签标识符
 */
async function focusTableTab(core: EditorCore, tabId: string): Promise<void> {
  await act(async () => {
    await core.shellSystem.openPanelInTab(
      tabId,
      tablePanelType.id,
      { target: { dataPath: TABLE_DEMO_DATA_PATH } },
      TABLE_DEMO_DATA_PATH,
    );
  });
  await act(async () => {});
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
  const instance = instanceId === null ? undefined : (core.shellSystem as ShellSystem)['instances'].get(instanceId);

  if (!(instance instanceof TablePanel)) throw new Error('表格面板实例缺失');

  return instance;
}

/**
 * 取外壳里所有承载表格面板的标签
 * @param core 编辑器核心
 * @returns 表格标签列表
 */
function tableTabs(core: EditorCore): readonly IEditorTab[] {
  return core.shellSystem.listTabs().filter((tab) => tab.typeId === tablePanelType.id);
}

/**
 * 取某个标签当前承载的面板实例标识符
 * @param core 编辑器核心
 * @param tabId 标签标识符
 * @returns 实例标识符；标签不存在或为空白标签时为 null
 */
function instanceIdOf(core: EditorCore, tabId: string): string | null {
  const tab = core.shellSystem.listTabs().find((candidate) => candidate.id === tabId);

  return tab === undefined ? null : tab.instanceId;
}

/**
 * 取外壳当前活动标签的标识符
 * @param core 编辑器核心
 * @returns 活动标签标识符；没有活动标签时为 null
 */
function activeTabIdOf(core: EditorCore): string | null {
  return (core.shellSystem as ShellSystem)['activeTabId'];
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

describe('开发宿主同路径重复打开', () => {
  // 同一路径第二次打开只聚焦已有标签：标签数、实例 id 与活动标签都不变，随后保存照常落盘且不弹冲突框
  it('同一路径第二次打开只聚焦已有标签，保存后磁盘是新值', async () => {
    const { core, backend } = await createHost();
    const tabId = await openTableTab(core);
    const instanceIdBefore = instanceIdOf(core, tabId);

    renderShell(core);
    await activateTab(core, tabId);

    await focusTableTab(core, tabId);

    expect(tableTabs(core)).toHaveLength(1);
    expect(tableTabs(core)[0].id).toBe(tabId);
    expect(instanceIdOf(core, tabId)).toBe(instanceIdBefore);
    expect(activeTabIdOf(core)).toBe(tabId);
    expect(screen.queryByTestId('panel-conflict-dialog')).toBeNull();

    await commitTitle('重复打开后保存的值');
    await clickSave();

    expect(await readTitle(backend)).toBe('重复打开后保存的值');
    expect(screen.queryByTestId('panel-conflict-dialog')).toBeNull();
  }, 20000);

  // 唯一标签里有未提交草稿时再次打开同一路径：草稿仍在、磁盘仍是旧值、不弹冲突框；保存后磁盘等于草稿
  it('同一路径重复打开不会冲掉未提交草稿，保存后磁盘等于草稿', async () => {
    const { core, backend } = await createHost();
    const tabId = await openTableTab(core);
    const instanceIdBefore = instanceIdOf(core, tabId);

    renderShell(core);
    await activateTab(core, tabId);

    const diskBefore = await readTitle(backend);

    await commitTitle('唯一标签里的草稿');

    expect(await readTitle(backend)).toBe(diskBefore);
    expect(screen.getByTestId('table-unsaved')).not.toBeNull();
    expect(titleInput().value).toBe(JSON.stringify('唯一标签里的草稿'));

    await focusTableTab(core, tabId);

    expect(tableTabs(core)).toHaveLength(1);
    expect(instanceIdOf(core, tabId)).toBe(instanceIdBefore);
    expect(screen.getByTestId('table-unsaved')).not.toBeNull();
    expect(titleInput().value).toBe(JSON.stringify('唯一标签里的草稿'));
    expect(panelOf(core, tabId)['conflictStore'].state).toBeUndefined();
    expect(screen.queryByTestId('panel-conflict-dialog')).toBeNull();
    expect(await readTitle(backend)).toBe(diskBefore);

    await clickSave();

    expect(await readTitle(backend)).toBe('唯一标签里的草稿');
  }, 20000);

  // 重复打开同一路径不会静默覆盖磁盘：仍是同一个实例、磁盘仍是原值；随后编辑并保存才写盘
  it('同一路径重复打开不会静默覆盖磁盘，随后保存才写盘', async () => {
    const { core, backend } = await createHost();
    const tabId = await openTableTab(core);
    const instanceIdBefore = instanceIdOf(core, tabId);
    const diskBefore = await readTitle(backend);

    await focusTableTab(core, tabId);

    expect(tableTabs(core)).toHaveLength(1);
    expect(instanceIdOf(core, tabId)).toBe(instanceIdBefore);
    expect(await readTitle(backend)).toBe(diskBefore);

    renderShell(core);
    await activateTab(core, tabId);

    await commitTitle('重复打开后写回的值');
    await clickSave();

    expect(await readTitle(backend)).toBe('重复打开后写回的值');
  }, 20000);
});

describe('开发宿主内存后端变化流', () => {
  // seed 静默；新建发 Add、覆盖发 Change、删除发 Delete、移动发 Delete + Add；退订后不再收到事件
  it('写入 / 删除 / 移动发出正确事件且 seed 静默', async () => {
    const backend = new MemoryBackend();
    const events: string[] = [];

    backend.seed('seed.txt', 'a');
    const unwatch = backend.watch((change) => events.push(`${change.kind}:${change.path}`));

    await backend.writeFile('new.txt', 'n');
    await backend.writeFile('new.txt', 'n2');
    await backend.writeBinary('bin.dat', new Uint8Array([1]));
    await backend.deleteFile('new.txt');
    await backend.moveFile('bin.dat', 'moved/bin.dat');
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });

    expect(events).toEqual([
      `${EditorFileChangeKind.Add}:new.txt`,
      `${EditorFileChangeKind.Change}:new.txt`,
      `${EditorFileChangeKind.Add}:bin.dat`,
      `${EditorFileChangeKind.Delete}:new.txt`,
      `${EditorFileChangeKind.Delete}:bin.dat`,
      `${EditorFileChangeKind.Add}:moved/bin.dat`,
    ]);

    unwatch();
    await backend.writeFile('after.txt', 'x');
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });

    expect(events).toHaveLength(6);
  }, 20000);
});
