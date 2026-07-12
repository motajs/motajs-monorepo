import { afterEach, describe, expect, it, vi } from 'vitest';

import { createEditorBlocklyApi } from '@/blockly/api/editorBlockly';
import type { BlocklyWorkspaceRef } from '@/blockly/components/BlocklyWorkspace';

describe('EditorBlockly import lifecycle', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries against a fresh ref when the workspace is not mounted yet', () => {
    vi.useFakeTimers();
    const loadEntryData = vi.fn();
    let workspaceRef: BlocklyWorkspaceRef | null = null;
    const show = vi.fn();
    const api = createEditorBlocklyApi(() => workspaceRef, show, vi.fn());
    const value = [{ type: 'comment', text: 'ready later' }];

    api.import(value, { type: 'commonEvent' }, { onConfirm: vi.fn() });
    expect(show).toHaveBeenCalledOnce();
    expect(loadEntryData).not.toHaveBeenCalled();

    workspaceRef = {
      getApi: () => ({ isReady: true } as ReturnType<BlocklyWorkspaceRef['getApi']>),
      loadEventData: vi.fn(),
      loadEntryData,
      getTopBlockType: vi.fn(),
    };
    vi.advanceTimersByTime(50);

    expect(loadEntryData).toHaveBeenCalledWith(value, 'commonEvent');
  });

  it('lets a newer import supersede an older pending request', () => {
    vi.useFakeTimers();
    const loadEntryData = vi.fn();
    let workspaceRef: BlocklyWorkspaceRef | null = null;
    const api = createEditorBlocklyApi(() => workspaceRef, vi.fn(), vi.fn());
    const first = [{ type: 'comment', text: 'first' }];
    const second = [{ type: 'comment', text: 'second' }];

    api.import(first, { type: 'afterGetItem' }, { onConfirm: vi.fn() });
    api.import(second, { type: 'commonEvent' }, { onConfirm: vi.fn() });
    workspaceRef = {
      getApi: () => ({ isReady: true } as ReturnType<BlocklyWorkspaceRef['getApi']>),
      loadEventData: vi.fn(),
      loadEntryData,
      getTopBlockType: vi.fn(),
    };
    vi.advanceTimersByTime(50);

    expect(loadEntryData).toHaveBeenCalledTimes(1);
    expect(loadEntryData).toHaveBeenCalledWith(second, 'commonEvent');
  });

  it('opens the generic point picker when the selected block has no point interaction', async () => {
    const selectPoint = vi.fn().mockResolvedValue(undefined);
    const workspaceRef = {
      getApi: () => ({
        runSelectedPointInteraction: vi.fn().mockResolvedValue(false),
      } as unknown as ReturnType<BlocklyWorkspaceRef['getApi']>),
      loadEventData: vi.fn(),
      loadEntryData: vi.fn(),
      getTopBlockType: vi.fn(),
    } satisfies BlocklyWorkspaceRef;
    const api = createEditorBlocklyApi(
      () => workspaceRef,
      vi.fn(),
      vi.fn(),
      { selectPoint },
    );

    await api.selectPointFromButton();

    expect(selectPoint).toHaveBeenCalledOnce();
  });
});
