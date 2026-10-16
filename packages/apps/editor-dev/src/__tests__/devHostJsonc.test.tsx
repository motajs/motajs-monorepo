import { act, cleanup, configure, fireEvent, render, screen } from '@testing-library/react';
import { EditorCore, IEditorPanel, IEditorPanelFactoryParam } from '@motajs/editor-core';
import { CapabilityProvider } from '@motajs/editor-impl/react';
import {
  parseTableText,
  SYSTEM_PREFIX_END_MARKER,
  TableTextParseStatus,
  tablePanelType,
} from '@motajs/editor-impl/table';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryBackend } from '../backend/memoryBackend';
import {
  createTablePanelOpener,
  TABLE_DEMO_COMMENTED_DATA,
  TABLE_DEMO_COMMENTED_DATA_PATH,
  TABLE_DEMO_COMMENTED_SCHEMA_PATH,
  TABLE_DEMO_SAMPLE_SCHEMA,
  TABLE_DEMO_SYSTEM_PREFIX_DATA,
  TABLE_DEMO_SYSTEM_PREFIX_DATA_PATH,
  TABLE_DEMO_SYSTEM_PREFIX_SCHEMA_PATH,
  TABLE_PRESETS,
} from '../demo/tableDemo';

configure({ testIdAttribute: 'data-test-id' });

// 每个用例结束后卸载已挂载的组件，避免 DOM 在用例之间累积
afterEach(() => {
  cleanup();
});

// 装配开发宿主组合根：内存文件系统 seed 两个 .jsonc 样本（数据 + 共用 schema），
// 注册捕获实例的表格面板类型（供「再次切入不重弹」断言取面板实例）
async function createHost(created: IEditorPanel[]): Promise<EditorCore> {
  const core = new EditorCore();
  const backend = new MemoryBackend();

  backend.seed(TABLE_DEMO_SYSTEM_PREFIX_DATA_PATH, TABLE_DEMO_SYSTEM_PREFIX_DATA);
  backend.seed(TABLE_DEMO_SYSTEM_PREFIX_SCHEMA_PATH, TABLE_DEMO_SAMPLE_SCHEMA);
  backend.seed(TABLE_DEMO_COMMENTED_DATA_PATH, TABLE_DEMO_COMMENTED_DATA);
  backend.seed(TABLE_DEMO_COMMENTED_SCHEMA_PATH, TABLE_DEMO_SAMPLE_SCHEMA);
  core.shellSystem.registerPanelType({
    id: tablePanelType.id,
    name: tablePanelType.name,
    icon: tablePanelType.icon,
    create: (param: IEditorPanelFactoryParam): IEditorPanel => {
      const panel = tablePanelType.create(param);
      created.push(panel);
      return panel;
    },
  });

  await core.initialize({ fs: backend, maxUndoStep: backend.maxUndoStep });
  return core;
}

// 直接瞄准某个数据路径打开表格面板（同 devHostTable 的 openDemoTable 形态）
async function openTargetTable(core: EditorCore, dataPath: string): Promise<void> {
  const tabId = core.shellSystem.openBlankTab();

  await core.shellSystem.openPanelInTab(tabId, tablePanelType.id, { target: { dataPath } });
}

// 用能力 Provider 包裹外壳渲染根，注入开发宿主的表格面板打开器与预设表（对应 main.tsx 的接线）
function renderWithTableOpener(core: EditorCore): ReturnType<typeof render> {
  return render(
    createElement(CapabilityProvider, {
      capabilities: { tablePanel: createTablePanelOpener(core), tablePresets: TABLE_PRESETS },
      children: createElement(core.shellSystem.render()),
    }),
  );
}

// 取面板第 index 栏的 DOM 元素：空栏控件与其 data-test-id 在多栏下重复，断言须限定到单栏
function columnAt(container: HTMLElement, index: number): Element | null {
  return container.querySelectorAll('.etable-column')[index] ?? null;
}

// 读取某个字段值单元格内文本域的当前文本域元素
function titleTextarea(container: HTMLElement): HTMLTextAreaElement | null {
  const column = columnAt(container, 0);
  const cell = column === null ? null : column.querySelector('[data-test-id="table-input-title"]');

  return cell === null ? null : cell.querySelector('textarea');
}

// 读取一个路径数据文件的原文（面板以文本写回）
async function readRaw(core: EditorCore, path: string): Promise<string> {
  const text = await core.resourceSystem.readContent(path);

  return typeof text === 'string' ? text : '';
}

describe('开发宿主 .jsonc 端到端', () => {
  // 合规样本：改一个字段后手动保存，系统前缀注释块逐字保留、只改动 JSON 正文
  it('合规样本保存后系统前缀逐字保留', async () => {
    const created: IEditorPanel[] = [];
    const core = await createHost(created);

    await act(async () => {
      await openTargetTable(core, TABLE_DEMO_SYSTEM_PREFIX_DATA_PATH);
    });

    const { container } = renderWithTableOpener(core);
    const textarea = titleTextarea(container);

    if (textarea === null) throw new Error('标题值文本域缺失');

    await act(async () => {
      fireEvent.change(textarea, { target: { value: JSON.stringify('改后标题') } });
      fireEvent.blur(textarea);
    });

    // 手动保存模型：读写回资源前先点「保存」落盘
    await act(async () => {
      fireEvent.click(screen.getByTestId('table-save'));
    });
    await act(async () => {});

    const raw = await readRaw(core, TABLE_DEMO_SYSTEM_PREFIX_DATA_PATH);
    const expectedPrefix = parseTableText(TABLE_DEMO_SYSTEM_PREFIX_DATA).prefix;
    const parsed = parseTableText(raw);

    expect(raw).toContain(SYSTEM_PREFIX_END_MARKER);
    expect(parsed.status).toBe(TableTextParseStatus.Conforming);
    expect(parsed.prefix).toBe(expectedPrefix);
    expect(parsed.value).toEqual({ title: '改后标题', level: 1 });
  });

  // 非合规样本：先弹确认框（内容尚未渲染），确认后按删注释打开；手动保存写回原文无注释；
  // 再次切入不再弹确认框、内容仍在（同一栏同一文件「只提示一次」）
  it('非合规样本确认后按删注释打开且再次切入不重弹', async () => {
    const created: IEditorPanel[] = [];
    const core = await createHost(created);

    await act(async () => {
      await openTargetTable(core, TABLE_DEMO_COMMENTED_DATA_PATH);
    });

    const { container } = renderWithTableOpener(core);

    expect(screen.getByTestId('table-strip-confirm')).not.toBeNull();
    expect(columnAt(container, 0)!.querySelector('[data-test-id="table-input-title"]')).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByTestId('table-strip-confirm'));
    });
    await act(async () => {});

    const textarea = titleTextarea(container);

    if (textarea === null) throw new Error('确认后标题值文本域缺失');

    await act(async () => {
      fireEvent.change(textarea, { target: { value: JSON.stringify('改后标题') } });
      fireEvent.blur(textarea);
    });

    // 手动保存模型：读写回资源前先点「保存」落盘
    await act(async () => {
      fireEvent.click(screen.getByTestId('table-save'));
    });
    await act(async () => {});

    const raw = await readRaw(core, TABLE_DEMO_COMMENTED_DATA_PATH);
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    expect(raw).not.toContain('//');
    expect(parsed.title).toBe('改后标题');

    // 外部把文件改写回原文（与确认时逐字相同）后再次切入：不再弹确认框且内容仍在
    await act(async () => {
      await core.resourceSystem.writeContent(TABLE_DEMO_COMMENTED_DATA_PATH, TABLE_DEMO_COMMENTED_DATA);
    });
    await act(async () => {
      await created[0].onSwitchIn();
    });
    await act(async () => {});

    expect(screen.queryByTestId('table-strip-confirm')).toBeNull();
    expect(titleTextarea(container)?.value).toBe(JSON.stringify('带注释示例'));
  });

  // 非合规样本：取消不打开，该栏回到未设目标态（空栏三按钮出现）且不崩溃
  it('非合规样本取消后不打开并回到空栏', async () => {
    const created: IEditorPanel[] = [];
    const core = await createHost(created);

    await act(async () => {
      await openTargetTable(core, TABLE_DEMO_COMMENTED_DATA_PATH);
    });

    const { container } = renderWithTableOpener(core);

    expect(screen.getByTestId('table-strip-cancel')).not.toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByTestId('table-strip-cancel'));
    });
    await act(async () => {});

    expect(columnAt(container, 0)!.querySelector('[data-test-id="table-input-title"]')).toBeNull();
    expect(columnAt(container, 0)!.querySelector('[data-test-id="table-empty-open"]')).not.toBeNull();
  });
});
