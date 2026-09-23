// @vitest-environment node
/**
 * Phase 3 生命周期测试（KERN-02 / D-09 / D-21）。
 *
 * 它把 `EditorCore.dispose()` 的契约钉死在行为上：同步、`void`、**逆序**释放、**幂等**
 * （先置 `disposed` 再干活，重入是 no-op），并且**一项抛错不中断其余拆除**——抛出的钩子被隔离、
 * 不会重跑、也不会以 throw 逃逸；失败通过两条通道报告：追加一条 `lifecycle.teardown-failed`
 * `error` 诊断到同一条总线（可被测试断言），并打印一行带 `editor-core:` 前缀的 console 记录
 * （现场可见）。dispose 之后，构造期间与构造之后注册的能力都不可达，`EditorCore.snapshotCapabilities`
 * 为空。
 *
 * 全部 fixture 使用引擎中性的 `acme.*`：core 不认识任何引擎的词汇或文件结构（RESEARCH Pitfall 15）。
 */
import { describe, expect, test, vi } from 'vitest';
import { createEditorCore } from '../kernel/core';
import { DIAGNOSTIC_CODES } from '../kernel/diagnostics';

describe('editor-core 生命周期契约', () => {
  test('三个拆除钩子按创建逆序释放', () => {
    const labels: string[] = [];
    const editor = createEditorCore({
      install: (registrar) => {
        registrar.addTeardown(() => labels.push('first'));
        registrar.addTeardown(() => labels.push('second'));
        registrar.addTeardown(() => labels.push('third'));
      },
    });

    editor.dispose();

    expect(labels).toEqual(['third', 'second', 'first']);
  });

  test('dispose 幂等：二次调用不改变释放顺序、不新增诊断', () => {
    const labels: string[] = [];
    const thrownValue = new Error('idempotency boom');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const editor = createEditorCore({
        install: (registrar) => {
          registrar.addTeardown(() => labels.push('first'));
          registrar.addTeardown(() => {
            throw thrownValue;
          });
          registrar.addTeardown(() => labels.push('third'));
        },
      });

      editor.dispose();
      const labelsAfterFirst = [...labels];
      const diagnosticsAfterFirst = editor.diagnostics.snapshot().length;

      editor.dispose();

      expect(labels).toEqual(labelsAfterFirst);
      expect(editor.diagnostics.snapshot()).toHaveLength(diagnosticsAfterFirst);
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  test('抛出的拆除钩子被隔离：其余钩子照常运行，只追加一条 lifecycle.teardown-failed 诊断并打印一行 console', () => {
    const labels: string[] = [];
    const thrownValue = new Error('teardown boom');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const editor = createEditorCore({
        install: (registrar) => {
          registrar.addTeardown(() => labels.push('first'));
          registrar.addTeardown(() => {
            throw thrownValue;
          });
          registrar.addTeardown(() => labels.push('third'));
        },
      });

      const before = editor.diagnostics.snapshot().length;
      expect(() => editor.dispose()).not.toThrow();

      // 抛错的钩子不中断循环：它两侧的钩子都照常运行（逆序：third → 抛错 → first）。
      expect(labels).toEqual(['third', 'first']);

      const added = editor.diagnostics.snapshot().slice(before);
      expect(added).toHaveLength(1);
      expect(added[0].severity).toBe('error');
      expect(added[0].code).toBe(DIAGNOSTIC_CODES.lifecycleTeardownFailed);
      expect(added[0].cause).toBe(thrownValue);

      // D-21 的第二条通道：console 恰好一次，且带 `editor-core:` 前缀。
      expect(spy).toHaveBeenCalledTimes(1);
      expect(String(spy.mock.calls[0][0])).toContain('editor-core:');
    } finally {
      spy.mockRestore();
    }
  });

  test('构造期间注册的能力在 dispose 后不可达，snapshotCapabilities 为空', () => {
    const editor = createEditorCore({
      install: (registrar) => {
        registrar.register('acme.thing', 'alpha', 1);
      },
    });

    expect(editor.getCapability('acme.thing', 'alpha')).toBe(1);

    editor.dispose();

    expect(editor.getCapability('acme.thing', 'alpha')).toBeUndefined();
    expect(editor.snapshotCapabilities()).toHaveLength(0);
  });

  test('构造之后注册的能力同样被 dispose 释放', () => {
    const editor = createEditorCore({});

    editor.registerCapability('acme.thing', 'beta', 2);
    expect(editor.getCapability('acme.thing', 'beta')).toBe(2);

    editor.dispose();

    expect(editor.getCapability('acme.thing', 'beta')).toBeUndefined();
    expect(editor.snapshotCapabilities()).toHaveLength(0);
  });
});
