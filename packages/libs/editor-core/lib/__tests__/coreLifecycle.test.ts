// @vitest-environment node
import { describe, expect, test, vi } from 'vitest';
import { EditorCoreKernel } from '../kernel/core';
import { DIAGNOSTIC_CODES } from '../kernel/diagnostics';
import { DiagnosticSeverity } from '../kernel/types';

describe('editor-core 生命周期契约', () => {
  // 覆盖：三个拆除钩子按创建逆序释放
  test('三个拆除钩子按创建逆序释放', () => {
    const labels: string[] = [];
    const editor = new EditorCoreKernel({
      install: (registrar) => {
        registrar.addTeardown(() => labels.push('first'));
        registrar.addTeardown(() => labels.push('second'));
        registrar.addTeardown(() => labels.push('third'));
      },
    });

    editor.dispose();

    expect(labels).toEqual(['third', 'second', 'first']);
  });

  // 覆盖：dispose 幂等，二次调用不改变释放顺序、不新增诊断
  test('dispose 幂等：二次调用不改变释放顺序、不新增诊断', () => {
    const labels: string[] = [];
    const thrownValue = new Error('idempotency boom');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const editor = new EditorCoreKernel({
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

  // 覆盖：抛出的拆除钩子被隔离，其余钩子照常运行，只追加一条诊断并打印一行 console
  test('抛出的拆除钩子被隔离：其余钩子照常运行，只追加一条 lifecycle.teardown-failed 诊断并打印一行 console', () => {
    const labels: string[] = [];
    const thrownValue = new Error('teardown boom');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const editor = new EditorCoreKernel({
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

      // 抛错的钩子不中断循环：它两侧的钩子都照常运行（逆序：third → 抛错 → first）
      expect(labels).toEqual(['third', 'first']);

      const added = editor.diagnostics.snapshot().slice(before);
      expect(added).toHaveLength(1);
      expect(added[0].severity).toBe(DiagnosticSeverity.Error);
      expect(added[0].code).toBe(DIAGNOSTIC_CODES.lifecycleTeardownFailed);
      expect(added[0].cause).toBe(thrownValue);

      // D-21 的第二条通道：console 恰好一次，且带 `editor-core:` 前缀
      expect(spy).toHaveBeenCalledTimes(1);
      expect(String(spy.mock.calls[0][0])).toContain('editor-core:');
    } finally {
      spy.mockRestore();
    }
  });

  // 覆盖：构造期间注册的能力在 dispose 后不可达，snapshotCapabilities 为空
  test('构造期间注册的能力在 dispose 后不可达，snapshotCapabilities 为空', () => {
    const editor = new EditorCoreKernel({
      install: (registrar) => {
        registrar.register('acme.thing', 'alpha', 1);
      },
    });

    expect(editor.getCapability('acme.thing', 'alpha')).toBe(1);

    editor.dispose();

    expect(editor.getCapability('acme.thing', 'alpha')).toBeUndefined();
    expect(editor.snapshotCapabilities()).toHaveLength(0);
  });

  // 覆盖：构造之后注册的能力同样被 dispose 释放
  test('构造之后注册的能力同样被 dispose 释放', () => {
    const editor = new EditorCoreKernel({});

    editor.registerCapability('acme.thing', 'beta', 2);
    expect(editor.getCapability('acme.thing', 'beta')).toBe(2);

    editor.dispose();

    expect(editor.getCapability('acme.thing', 'beta')).toBeUndefined();
    expect(editor.snapshotCapabilities()).toHaveLength(0);
  });
});
