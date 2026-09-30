/**
 * `OperationHistory`（core 的无快照撤销管理器）在编辑器侧的集成测试。
 *
 * **D-19（已确认的行为变化）：** 撤销一次数据改动**不再连带恢复地图视口**。旧实现把视口注册成快照
 * 系统，`execute`/`undo` 前后会 `capture`/`restore` 每个系统；无快照改造（D-05）删掉了那套机制，
 * 因此本文件的主用例被改写为「记录新行为」——视口保持调用时设置的值，而不是被恢复到操作前。
 * 视口恢复改由地图编辑将来自己作为一个「操作」处理。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileHandlerManager } from '@/fs/FileHandlerManager';
import { persistenceMonitor } from '@/fs/PersistenceMonitor';
import { projectData } from '@/project/data/projectData';
import { tableCommands } from '@/project/commands/tableCommands';
import { ActionType } from '@/utils/action';
import { operationHistory } from '../operationHistory';
import { compositeOperation, type EditorOperation } from '../operations';
import { registerEditorViewportProvider, type EditorViewport } from '../viewport';
import { loadSampleProject, type SampleProjectContext } from '@test/utils/sampleProject';

function viewport(floorId: string): EditorViewport {
  return {
    activePanel: 'floor',
    floorId,
    map: {
      pos: [2, 3],
      layer: 'map',
      brush: 'line',
      bigmap: false,
      bigmapInfo: { top: 0, left: 0, size: 32 },
      offset: [0, 0],
      selectedArea: null,
      tileSize: [1, 1],
      showMovable: false,
    },
    locSelection: null,
    prefabSelection: null,
  };
}

describe('OperationHistory', () => {
  let project: SampleProjectContext;
  let currentViewport: EditorViewport;
  let disposeViewport: () => void;

  beforeEach(async () => {
    operationHistory.clear();
    project = await loadSampleProject();
    currentViewport = viewport('sample0');
    disposeViewport = registerEditorViewportProvider({
      capture: () => structuredClone(currentViewport),
      restore: (next) => {
        currentViewport = structuredClone(next);
      },
    });
  });

  afterEach(() => {
    disposeViewport();
    operationHistory.clear();
    FileHandlerManager.clear();
    projectData.resetForTests();
  });

  it('uses inverse actions for undo and redo without touching the map viewport', async () => {
    const floor = await project.loadResource(projectData.floor('sample0'));
    const originalTitle = floor.title;

    expect(await tableCommands.patchFloor('sample0', [[ActionType.Change, "['title']", 'History title']])).toEqual({
      ok: true,
    });
    expect(projectData.floor('sample0').value().title).toBe('History title');

    currentViewport = viewport('sample1');
    await operationHistory.undo();
    expect(projectData.floor('sample0').value().title).toBe(originalTitle);
    // D-19：撤销数据改动不再连带恢复视口——视口保持调用时设置的值（此时是 sample1）。
    expect(currentViewport.floorId).toBe('sample1');

    currentViewport = viewport('sample1');
    await operationHistory.redo();
    expect(projectData.floor('sample0').value().title).toBe('History title');
    expect(currentViewport.floorId).toBe('sample1');
  });

  it('finishes memory history before persistence and allows undo while a write is pending', async () => {
    const floorResource = projectData.floor('sample0');
    const floor = await project.loadResource(floorResource);
    const originalTitle = floor.title;
    project.fs.setWriteDelay(80);

    expect(await tableCommands.patchFloor('sample0', [[ActionType.Change, "['title']", 'Memory first title']])).toEqual(
      {
        ok: true,
      },
    );

    expect(floorResource.value().title).toBe('Memory first title');
    expect(persistenceMonitor.hasUnsavedChanges()).toBe(true);

    await operationHistory.undo();
    expect(floorResource.value().title).toBe(originalTitle);
    await persistenceMonitor.flush([floorResource.path]);
    expect(project.readText(floorResource.path)).not.toContain('Memory first title');
  });

  it('leaves no history behind when apply throws (D-19: no snapshot rollback)', async () => {
    // 旧用例「restores the temporary checkpoint when apply fails after a mutation」依赖已删除的
    // 快照目标机制（`targets`/`OperationTarget`，D-05）。现改为记录新行为：apply 抛错的操作不入历史，
    // 随后的 undo 是空操作，不产生额外效果（也不再有任何 checkpoint 回滚）。
    const floorResource = projectData.floor('sample0');
    await project.loadResource(floorResource);
    const operation: EditorOperation = {
      meta: { label: '失败操作', stage: 'failing-operation' },
      apply: async () => {
        await floorResource.patch([[ActionType.Change, "['title']", 'Partial title']]);
        throw new Error('intentional failure');
      },
    };

    await expect(operationHistory.execute(operation)).rejects.toThrow('intentional failure');
    const titleAfterFailure = floorResource.value().title;
    await operationHistory.undo();
    expect(floorResource.value().title).toBe(titleAfterFailure);
  });

  it('uses semantic inverses to recover completed children when a composite operation fails', async () => {
    let value = 0;
    const counterOperation = (delta: number): EditorOperation<unknown> => ({
      meta: { label: 'counter', stage: 'counter' },
      apply: async () => {
        value += delta;
        return {
          value,
          inverse: counterOperation(-delta),
          changed: delta !== 0,
        };
      },
    });
    const failingOperation: EditorOperation<unknown> = {
      meta: { label: 'failure', stage: 'composite-child' },
      apply: async () => {
        throw new Error('composite failure');
      },
    };

    await expect(
      operationHistory.execute(
        compositeOperation([counterOperation(1), failingOperation], { label: 'composite', stage: 'composite' }),
      ),
    ).rejects.toMatchObject({ commandStage: 'composite-child' });
    expect(value).toBe(0);
  });
});
