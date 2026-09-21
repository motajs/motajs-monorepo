/**
 * PersistenceMonitor 特性化测试（冻结不变量，不冻结实现结构）
 *
 * 只冻结 D-11 指定的不变量，不断言私有字段：
 * - 路径归一化：`./project\\data.js` 与 `project/data.js` 命中同一个 controller，按提交顺序执行
 * - 失败保留在 failed 集合，只有真正成功执行后才清除
 * - 重试进行中旧的失败仍然可见
 * - retryFailed() 只返回仍未恢复的路径
 * - flush() 在有失败路径时抛出带固定消息的 AggregateError，无失败时 resolve
 * - whenQuiescent() 在存在失败时也不 reject
 * - statusFor 优先级：error > persisting > idle
 *
 * 所有期望值均以 observation-first 方式取得：先用故意错误的期望运行，
 * 从失败输出读出真实值后再固化，而不是从实现源码推导。
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { PersistenceMonitor } from '../PersistenceMonitor';
import { wait } from '@test/utils/testHelpers';

describe('PersistenceMonitor invariants', () => {
  let monitor: PersistenceMonitor;

  beforeEach(() => {
    monitor = new PersistenceMonitor();
  });

  it('normalizes paths so a recreated resource path owns one controller in submission order', async () => {
    const values: string[] = [];
    monitor.schedule('./project\\data.js', {
      kind: 'write',
      execute: async () => {
        await wait(20);
        values.push('old resource');
      },
    });

    // `./project\data.js` 与 `project/data.js` 归一化后是同一个 controller
    expect(monitor.statusFor('project/data.js')).toBe('persisting');

    monitor.schedule('project/data.js', {
      kind: 'write',
      execute: async () => {
        values.push('new resource');
      },
    });

    await monitor.flush(['project/data.js']);
    expect(values).toEqual(['old resource', 'new resource']);
  });

  it('retains a failure until a genuinely successful execution clears it', async () => {
    monitor.schedule('project/data.js', {
      kind: 'write',
      execute: async () => {
        throw new Error('first failure');
      },
    });
    await monitor.whenQuiescent(['project/data.js']);

    expect(monitor.statusFor('project/data.js')).toBe('error');
    expect(monitor.failedFiles()).toHaveLength(1);
    expect(monitor.errorFor('project/data.js')?.message).toBe('first failure');

    monitor.schedule('project/data.js', {
      kind: 'write',
      execute: async () => {
        // 真正成功
      },
    });
    await monitor.whenQuiescent(['project/data.js']);

    expect(monitor.failedFiles()).toHaveLength(0);
    expect(monitor.statusFor('project/data.js')).toBe('idle');
  });

  it('keeps an existing failure visible while its retry is in progress', async () => {
    monitor.schedule('slow.js', {
      kind: 'write',
      execute: async () => {
        await wait(20);
        throw new Error('boom');
      },
    });
    await monitor.whenQuiescent(['slow.js']);
    expect(monitor.statusFor('slow.js')).toBe('error');

    monitor.schedule('slow.js', {
      kind: 'write',
      execute: async () => {
        await wait(40);
      },
    });

    // 重试执行中：failure 仍然在集合里，statusFor 仍报 error（error 胜过 persisting）
    expect(monitor.statusFor('slow.js')).toBe('error');
    expect(monitor.persistingFiles()).toContain('slow.js');
    expect(monitor.failedFiles()).toHaveLength(1);

    await monitor.whenQuiescent(['slow.js']);
    expect(monitor.statusFor('slow.js')).toBe('idle');
    expect(monitor.failedFiles()).toHaveLength(0);
  });

  it('returns only the still-failing paths from retryFailed()', async () => {
    let recoverFirst = false;
    monitor.schedule('first.js', {
      kind: 'write',
      execute: async () => {
        if (!recoverFirst) throw new Error('first failed');
      },
    });
    monitor.schedule('second.js', {
      kind: 'write',
      execute: async () => {
        throw new Error('second failed');
      },
    });
    await monitor.whenQuiescent();

    recoverFirst = true;
    const remaining = await monitor.retryFailed();

    expect(remaining.map((failure) => failure.path)).toEqual(['second.js']);
    expect(monitor.failedFiles().map((failure) => failure.path)).toEqual(['second.js']);
  });

  it('rejects flush() with the aggregate message when a listed path has failed', async () => {
    monitor.schedule('bad.js', {
      kind: 'write',
      execute: async () => {
        throw new Error('bad write');
      },
    });
    await monitor.whenQuiescent(['bad.js']);

    const thrown = await monitor.flush(['bad.js']).then(
      () => null,
      (error: unknown) => error,
    );
    expect(thrown).toBeInstanceOf(AggregateError);
    expect((thrown as Error).message).toBe('工程文件写入失败');

    const clean = new PersistenceMonitor();
    clean.schedule('ok.js', {
      kind: 'write',
      execute: async () => {
        // success
      },
    });
    await expect(clean.flush(['ok.js'])).resolves.toBeUndefined();
  });

  it('resolves whenQuiescent() even while a failure is present', async () => {
    monitor.schedule('bad.js', {
      kind: 'write',
      execute: async () => {
        throw new Error('bad write');
      },
    });

    await expect(monitor.whenQuiescent(['bad.js'])).resolves.toBeUndefined();
    expect(monitor.statusFor('bad.js')).toBe('error');
  });

  it('prefers error over persisting over idle in statusFor', async () => {
    const clean = new PersistenceMonitor();
    expect(clean.statusFor('fresh.js')).toBe('idle');

    clean.schedule('busy.js', {
      kind: 'write',
      execute: async () => {
        await wait(30);
      },
    });
    expect(clean.statusFor('busy.js')).toBe('persisting');

    clean.schedule('failed.js', {
      kind: 'write',
      execute: async () => {
        throw new Error('failed');
      },
    });
    await clean.whenQuiescent(['failed.js']);
    // 给失败路径安排一个仍在执行的意图：error 必须胜过 persisting
    clean.schedule('failed.js', {
      kind: 'write',
      execute: async () => {
        await wait(30);
      },
    });
    expect(clean.statusFor('failed.js')).toBe('error');

    await clean.whenQuiescent(['busy.js', 'failed.js']);
    expect(clean.statusFor('busy.js')).toBe('idle');
  });
});
