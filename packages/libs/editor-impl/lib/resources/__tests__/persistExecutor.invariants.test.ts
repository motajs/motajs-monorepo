// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { PersistExecutor } from '../persistExecutor';
import { wait } from './testHelpers';

describe('PersistExecutor invariants', () => {
  // 失败后 retry 重新提交保留的意图，回到 idle 并清除失败
  it('retry after error re-submits the retained intent and returns to idle with the failure cleared', async () => {
    const executor = new PersistExecutor();
    let shouldFail = true;
    const attempts: string[] = [];

    executor.schedule({
      kind: 'write',
      execute: async () => {
        attempts.push('attempt');
        if (shouldFail) throw new Error('disk unavailable');
      },
    });
    await executor.whenQuiescent();

    expect(executor.status().status).toBe('error');
    expect(attempts).toHaveLength(1);

    shouldFail = false;
    executor.retry();
    await executor.whenQuiescent();

    expect(executor.status().status).toBe('idle');
    expect(attempts).toHaveLength(2);
    // 失败已被清除：终态不再是 error，flush() 不再抛出
    await expect(executor.flush()).resolves.toBeUndefined();
  });

  // 状态不是 error 时 retry 不重新提交
  it('does not re-submit while the status is not error', async () => {
    const executor = new PersistExecutor();
    let attempts = 0;

    executor.schedule({
      kind: 'write',
      execute: async () => {
        attempts += 1;
        await wait(20);
        throw new Error('still failing');
      },
    });
    // 状态为 executing 时 retry() 必须是 no-op
    executor.retry();
    await executor.whenQuiescent();

    expect(attempts).toBe(1);
    expect(executor.status().status).toBe('error');
  });

  // 只保留最新的待执行意图（latest-wins），丢弃被覆盖的那一个
  it('keeps only the newest pending intent (latest-wins) and discards the superseded one', async () => {
    const executor = new PersistExecutor();
    const results: string[] = [];

    executor.schedule({
      kind: 'write',
      execute: async () => {
        await wait(30);
        results.push('slow');
      },
    });
    executor.schedule({
      kind: 'write',
      execute: async () => {
        results.push('middle');
      },
    });
    executor.schedule({
      kind: 'write',
      execute: async () => {
        results.push('newest');
      },
    });

    await executor.whenQuiescent();

    // 执行中的 slow 无法取消；middle 被 newest 覆盖，从不执行
    expect(results).toEqual(['slow', 'newest']);
  });

  // 有更新的意图待执行时，失败不暴露为 error 状态
  it('does not surface a failure as the error status while a newer intent is pending', async () => {
    const executor = new PersistExecutor();
    const results: string[] = [];

    executor.schedule({
      kind: 'write',
      execute: async () => {
        await wait(20);
        throw new Error('superseded failure');
      },
    });
    executor.schedule({
      kind: 'write',
      execute: async () => {
        results.push('newer');
      },
    });

    await executor.whenQuiescent();

    // 失败的旧意图后面还有更新的意图，循环继续，由后者的结果决定最终状态
    expect(executor.status().status).toBe('idle');
    expect(results).toEqual(['newer']);
  });

  // executing 或 pending 时 hasPending() 为 true，静默后回到 false
  it('reports hasPending() while executing or pending and once again false once quiescent', async () => {
    const executor = new PersistExecutor();
    expect(executor.hasPending()).toBe(false);

    executor.schedule({
      kind: 'write',
      execute: async () => {
        await wait(30);
      },
    });
    executor.schedule({
      kind: 'write',
      execute: async () => {
        await wait(1);
      },
    });
    expect(executor.hasPending()).toBe(true);

    await executor.whenQuiescent();
    expect(executor.hasPending()).toBe(false);

    // 终态失败（无待执行意图）时同样不报告 pending
    const failing = new PersistExecutor();
    failing.schedule({
      kind: 'write',
      execute: async () => {
        throw new Error('terminal');
      },
    });
    await failing.whenQuiescent();
    expect(failing.status().status).toBe('error');
    expect(failing.hasPending()).toBe(false);
  });

  // flush() 以存储的失败 reject，而 whenQuiescent() resolve
  it('rejects flush() with the stored failure while whenQuiescent() resolves', async () => {
    const executor = new PersistExecutor();

    executor.schedule({
      kind: 'write',
      execute: async () => {
        throw new Error('terminal failure');
      },
    });

    await expect(executor.whenQuiescent()).resolves.toBeUndefined();
    expect(executor.status().status).toBe('error');
    await expect(executor.flush()).rejects.toThrow('terminal failure');
  });
});
