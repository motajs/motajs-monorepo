// @vitest-environment node
import { describe, expect, test } from 'vitest';
import { EditorCoreKernel } from '../kernel/core';

describe('editor-core 内核 tracer 与实例隔离', () => {
  // 覆盖：真实公开面走通 create → install → 读回 → snapshot → 逆序 dispose
  test('create → install → 读回 → snapshot → 逆序 dispose', () => {
    const released: string[] = [];

    const editor = new EditorCoreKernel({
      install: (registrar) => {
        registrar.register('acme.thing', 'alpha', 1, { owner: 'acme-tracer' });
        registrar.addTeardown(() => {
          released.push('first');
        });
        registrar.addTeardown(() => {
          released.push('second');
        });
      },
    });

    expect(editor.getCapability('acme.thing', 'alpha')).toBe(1);
    expect(editor.getCapability('acme.missing', 'nope')).toBeUndefined();
    expect(() => editor.getCapabilityOrThrow('acme.missing', 'nope')).toThrow('acme.missing:nope');

    const snapshot = editor.snapshotCapabilities();
    expect(snapshot).toHaveLength(1);
    expect(snapshot).toEqual([{ kind: 'acme.thing', id: 'alpha', value: 1, owner: 'acme-tracer' }]);
    expect(Object.isFrozen(snapshot)).toBe(true);

    const added = editor.registerCapability('acme.other', 'beta', 'value');
    expect(added.diagnostics).toHaveLength(0);
    expect(editor.snapshotCapabilities()).toHaveLength(2);

    editor.dispose();

    expect(released).toEqual(['second', 'first']);
    expect(editor.getCapability('acme.thing', 'alpha')).toBeUndefined();
    expect(editor.snapshotCapabilities()).toHaveLength(0);
  });

  // 覆盖：两个实例的注册表与诊断历史互不干扰，dispose A 后 B 仍可用
  test('两个实例互不干扰', () => {
    const editorA = new EditorCoreKernel({});
    const editorB = new EditorCoreKernel({});

    editorA.registerCapability('acme.thing', 'shared', 'A');
    editorB.registerCapability('acme.thing', 'shared', 'B');
    expect(editorA.getCapability('acme.thing', 'shared')).toBe('A');
    expect(editorB.getCapability('acme.thing', 'shared')).toBe('B');

    editorB.registerCapability('acme.only-b', 'x', 1);
    expect(editorA.getCapability('acme.only-b', 'x')).toBeUndefined();

    editorB.registerCapability('acme.thing', 'shared', 'B-again');
    expect(editorB.diagnostics.snapshot()).toHaveLength(1);
    expect(editorB.diagnostics.snapshot()[0].code).toBe('capability.duplicate');
    expect(editorA.diagnostics.snapshot()).toHaveLength(0);

    editorA.dispose();

    expect(editorB.registerCapability('acme.other', 'beta', 2).diagnostics).toHaveLength(0);
    expect(editorB.getCapability('acme.other', 'beta')).toBe(2);

    editorB.dispose();
    expect(editorB.getCapability('acme.thing', 'shared')).toBeUndefined();
  });
});
