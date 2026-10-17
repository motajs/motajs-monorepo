import { act, cleanup, configure, fireEvent, render, screen } from '@testing-library/react';
import { EditorCore } from '@motajs/editor-core';
import { parseTableText, serializeTableText, SYSTEM_PREFIX_END_MARKER } from '@motajs/editor-impl/shared';
import { tablePanelType } from '@motajs/editor-impl/table';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryBackend } from '../backend/memoryBackend';
import { DevCodeEditorProvider } from '../demo/devCodeEditor';
import {
  createTablePanelOpener,
  TABLE_DEMO_SAMPLE_SCHEMA,
  TABLE_DEMO_SYSTEM_PREFIX_DATA,
  TABLE_DEMO_SYSTEM_PREFIX_DATA_PATH,
  TABLE_DEMO_SYSTEM_PREFIX_SCHEMA_PATH,
  TABLE_PRESETS,
} from '../demo/tableDemo';
import mainSource from '../main.tsx?raw';

configure({ testIdAttribute: 'data-test-id' });

// 每个用例结束后卸载已挂载的组件，避免 DOM 在用例之间累积
afterEach(() => {
  cleanup();
});

// 装配开发宿主组合根：内存文件系统 seed 合规系统前缀样本（数据 + 共用 schema），注册表格面板类型
async function createHost(): Promise<EditorCore> {
  const core = new EditorCore();
  const backend = new MemoryBackend();

  backend.seed(TABLE_DEMO_SYSTEM_PREFIX_DATA_PATH, TABLE_DEMO_SYSTEM_PREFIX_DATA);
  backend.seed(TABLE_DEMO_SYSTEM_PREFIX_SCHEMA_PATH, TABLE_DEMO_SAMPLE_SCHEMA);
  core.shellSystem.registerPanelType(tablePanelType);

  await core.initialize({ fs: backend, maxUndoStep: backend.maxUndoStep });
  return core;
}

// 直接瞄准系统前缀样本的数据路径打开表格面板（同 devHostJsonc 的 openTargetTable 形态）
async function openTargetTable(core: EditorCore): Promise<void> {
  const tabId = core.shellSystem.openBlankTab();

  await core.shellSystem.openPanelInTab(tabId, tablePanelType.id, {
    target: { dataPath: TABLE_DEMO_SYSTEM_PREFIX_DATA_PATH },
  });
}

// 用开发宿主代码编辑器 Provider 包裹外壳渲染根，注入表格面板打开器与预设表（对应 main.tsx 的接线）
function renderWithCodeEditor(core: EditorCore): ReturnType<typeof render> {
  return render(
    createElement(DevCodeEditorProvider, {
      capabilities: { tablePanel: createTablePanelOpener(core), tablePresets: TABLE_PRESETS },
      children: createElement(core.shellSystem.render()),
    }),
  );
}

// 读取一个路径数据文件的原文（面板以文本写回）
async function readRaw(core: EditorCore, path: string): Promise<string> {
  const text = await core.resourceSystem.readContent(path);

  return typeof text === 'string' ? text : '';
}

// 点击工具栏「更多」触发按钮展开下拉（「在代码编辑器中打开」收在此下拉内）
async function openToolbarMenu(): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByTestId('table-more'));
  });
}

// 取某菜单项的菜单容器（aria-disabled 断言用）
function menuItemOf(testId: string): Element | null {
  return screen.getByTestId(testId).closest('[role="menuitem"]');
}

// 系统前缀样本经解析 / 序列化往返后的原文：文本域应显示的初值（以上述纯函数重算，不硬编码前缀）
function sampleText(): string {
  const parsed = parseTableText(TABLE_DEMO_SYSTEM_PREFIX_DATA);

  return serializeTableText(parsed.value, parsed.prefix);
}

// 打开系统前缀样本表并点「在代码编辑器中打开」，返回代码编辑器文本域供断言初值 / 改写
async function launchCodeEditor(core: EditorCore): Promise<HTMLTextAreaElement> {
  await act(async () => {
    await openTargetTable(core);
  });

  renderWithCodeEditor(core);
  await openToolbarMenu();

  await act(async () => {
    fireEvent.click(screen.getByTestId('table-open-code'));
  });
  await act(async () => {});

  return screen.getByTestId<HTMLTextAreaElement>('dev-code-editor-text');
}

describe('开发宿主代码编辑器端到端', () => {
  // 注入 codeEditor 后「在代码编辑器中打开」菜单项存在且可用（未注入时该菜单项带 aria-disabled=true）
  it('注入 codeEditor 后「在代码编辑器中打开」菜单项可用', async () => {
    const core = await createHost();

    await act(async () => {
      await openTargetTable(core);
    });

    renderWithCodeEditor(core);
    await openToolbarMenu();

    expect(screen.getByTestId('table-open-code')).not.toBeNull();
    expect(menuItemOf('table-open-code')?.getAttribute('aria-disabled')).not.toBe('true');
  });

  // 打开代码编辑器看到文件原文（含系统前缀标记）；改一个字段值确认后经保存写回，前缀逐字保留、只改 JSON 正文
  it('打开显示文件原文并可编辑写回、保存后系统前缀逐字保留', async () => {
    const core = await createHost();
    const textarea = await launchCodeEditor(core);
    const parsedSample = parseTableText(TABLE_DEMO_SYSTEM_PREFIX_DATA);
    const edited = serializeTableText({ title: '改后标题', level: 1 }, parsedSample.prefix);

    expect(textarea.value).toBe(sampleText());
    expect(textarea.value).toContain(SYSTEM_PREFIX_END_MARKER);

    // 确定与改动分两个 act 提交，确保 Modal 的 onOk 闭包已拿到改动后的文本
    await act(async () => {
      fireEvent.change(textarea, { target: { value: edited } });
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('dev-code-editor-confirm'));
    });
    await act(async () => {});

    // 手动保存模型：写回资源前先点「保存」落盘
    await act(async () => {
      fireEvent.click(screen.getByTestId('table-save'));
    });
    await act(async () => {});

    const raw = await readRaw(core, TABLE_DEMO_SYSTEM_PREFIX_DATA_PATH);
    const parsed = parseTableText(raw);

    expect(raw).toContain(SYSTEM_PREFIX_END_MARKER);
    expect(parsed.prefix).toBe(parsedSample.prefix);
    expect(parsed.value).toEqual({ title: '改后标题', level: 1 });
  });

  // 取消不写回：Modal 关闭即 opener 的 Promise 以 null 解决；重开文本域仍是原样，未带上被取消的那次编辑
  it('取消不写回', async () => {
    const core = await createHost();
    const textarea = await launchCodeEditor(core);

    expect(screen.getByTestId('dev-code-editor')).not.toBeNull();

    await act(async () => {
      fireEvent.change(textarea, { target: { value: '{"title":"乱改","level":9}' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('dev-code-editor-cancel'));
    });
    await act(async () => {});

    expect(screen.queryByTestId('dev-code-editor')).toBeNull();

    // 再次展开下拉重新打开：文本域仍是原样（未带上被取消的编辑）
    await openToolbarMenu();
    await act(async () => {
      fireEvent.click(screen.getByTestId('table-open-code'));
    });
    await act(async () => {});

    const reopened = screen.getByTestId<HTMLTextAreaElement>('dev-code-editor-text');

    expect(reopened.value).toBe(sampleText());
  });

  // 组合根确实经 DevCodeEditorProvider 注入 codeEditor：读 main.tsx 原文断言导入与渲染根（tsc 观测不到接线）
  it('开发宿主组合根经 DevCodeEditorProvider 注入 codeEditor', () => {
    expect(mainSource).toMatch(/from '\.\/demo\/devCodeEditor'/);
    expect(mainSource).toMatch(/createElement\(\s*DevCodeEditorProvider/);
  });
});
