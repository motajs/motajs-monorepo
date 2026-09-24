/**
 * operationHistory 资源响应性特性化测试（依赖真实 mota-js fixture，D-13 留在 editor）。
 *
 * 从 `operationHistory.invariants.test.ts` 拆出的第二个 describe，与纯内存不变量隔离，
 * 便于后续 fixture 重写时只需改这一处。
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileHandlerManager } from '@/fs/FileHandlerManager';
import { persistenceMonitor } from '@/fs/PersistenceMonitor';
import { tableCommands } from '@/project/commands/tableCommands';
import { projectData } from '@/project/data/projectData';
import { operationHistory } from '../operationHistory';
// Type-only import: erased at build time, so the pure describes below never evaluate
// the fixture module (whose `mota-root` import throws when the submodule is absent).
import type { SampleProjectContext } from '@test/utils/sampleProject';

describe('operationHistory resource reactivity', () => {
  let project: SampleProjectContext;

  beforeEach(async () => {
    operationHistory.clear();
    // Lazy import keeps the fixture (and its submodule-dependent `mota-root`) out of
    // the pure describes' module graph; only this describe pays for it.
    const { loadSampleProject } = await import('@test/utils/sampleProject');
    project = await loadSampleProject();
  });

  afterEach(() => {
    operationHistory.clear();
    FileHandlerManager.clear();
    projectData.resetForTests();
  });

  it('observes a history-routed patch immediately and reverts it on undo while the write is pending', async () => {
    const floorResource = projectData.floor('sample0');
    const floor = await project.loadResource(floorResource);
    const originalTitle = floor.title;
    project.fs.setWriteDelay(80);

    expect(await tableCommands.patchFloor('sample0', [['change', "['title']", 'Memory first title']])).toEqual({
      ok: true,
    });

    // The new value is observable on the resource itself within the same microtask
    // chain: no re-read, no timer wait, no effect flush.
    expect(floorResource.value().title).toBe('Memory first title');

    await operationHistory.undo();
    expect(floorResource.value().title).toBe(originalTitle);

    await persistenceMonitor.flush([floorResource.path]);
    expect(project.readText(floorResource.path)).not.toContain('Memory first title');
  });

  it('observes a direct resource.set immediately, before persistence flushes', async () => {
    const floorResource = projectData.floor('sample0');
    await project.loadResource(floorResource);
    project.fs.setWriteDelay(80);

    await floorResource.set({ ...floorResource.value(), title: 'Set direct title' });

    // A direct set does not flow through the history, yet it is memory-first in
    // exactly the same way: the value is observable before any persistence await,
    // while the delayed disk write is still outstanding.
    expect(floorResource.value().title).toBe('Set direct title');
    expect(project.readText(floorResource.path)).not.toContain('Set direct title');

    await persistenceMonitor.flush([floorResource.path]);
    expect(project.readText(floorResource.path)).toContain('Set direct title');
  });
});
