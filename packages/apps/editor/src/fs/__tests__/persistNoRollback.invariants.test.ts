/**
 * 持久化失败不回滚编辑器状态的契约（真实资源路径，依赖 mota-js submodule）
 *
 * 本文件是整个特性化套件中唯一依赖 `packages/external/mota-js` 的文件：
 * 通过 `loadSampleProject()` 驱动真实资源，并用返回的 `MemoryFileSystem` 注入故障，
 * 而不是 mock fs facade。
 *
 * 冻结 `PersistExecutor` 模块文档写明的契约：持久化失败绝不回滚编辑器状态。
 * 两个可观察断言：写入失败后内存值仍是新值、磁盘内容仍是旧值；失败同时体现在
 * 资源的 persistStatus 与 monitor 的 failed 集合上。清除故障并重试后恢复为
 * idle，且磁盘写入新值。
 *
 * 所有期望值均以 observation-first 方式取得：先用故意错误的期望运行，
 * 从失败输出读出真实值后再固化，而不是从实现源码推导。
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FileHandlerManager } from '@/fs/FileHandlerManager';
import { persistenceMonitor } from '@/fs/PersistenceMonitor';
import { tableCommands } from '@/project/commands/tableCommands';
import { projectData } from '@/project/data/projectData';
import { loadSampleProject, type SampleProjectContext } from '@test/utils/sampleProject';

const TOWER_PATH = 'project/data.js';

describe('persistence never rolls editor state back', () => {
  let project: SampleProjectContext;

  beforeEach(async () => {
    project = await loadSampleProject();
  });

  afterEach(() => {
    project.fs.clearWriteError();
    project.fs.setWriteDelay(0);
    FileHandlerManager.clear();
    projectData.resetForTests();
  });

  it('keeps the in-memory value while the disk keeps the previous content, then recovers on retry', async () => {
    const tower = projectData.tower();
    await project.loadResource(tower);
    const originalDisk = project.readText(TOWER_PATH);

    project.fs.setWriteError(new Error('tower persist failed'));
    const result = await tableCommands.patchResource(tower, [
      ['change', "['firstData']['title']", 'No Rollback Title'],
    ]);

    // 编辑命令本身成功：失败发生在持久化边界，而不是编辑本身
    expect(result).toEqual({ ok: true });
    // 内存值保留新值（不回滚）
    expect(tower.value().firstData.title).toBe('No Rollback Title');

    await persistenceMonitor.whenQuiescent([tower.path]);

    // 失败同时体现在资源 persistStatus 与 monitor 的 failed 集合上
    expect(tower.persistStatus().status).toBe('error');
    expect(persistenceMonitor.failedFiles().map((failure) => failure.path)).toContain(tower.path);

    // 磁盘仍是编辑前的内容
    expect(project.readText(TOWER_PATH)).toBe(originalDisk);
    expect(project.readText(TOWER_PATH)).not.toContain('No Rollback Title');

    // 清除注入故障并重试：状态回到 idle，磁盘写入新值
    project.fs.clearWriteError();
    await persistenceMonitor.retryFailed();
    await persistenceMonitor.whenQuiescent([tower.path]);

    expect(tower.persistStatus().status).toBe('idle');
    expect(project.readText(TOWER_PATH)).toContain('No Rollback Title');
    expect(persistenceMonitor.failedFiles()).toEqual([]);
  });
});
