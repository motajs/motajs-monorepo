// @vitest-environment node
/**
 * Phase 3 tracer 测试（KERN-01 / KERN-06）。
 *
 * 第一个用例把内核整条路径走一遍真实公开面：`createEditorCore` → `install` 注册一个能力并登记两个
 * 拆除钩子 → 实例读回 → `EditorCore.snapshotCapabilities` 的扁平冻结形状 → `EditorCore.dispose`
 * 逆序释放。它不触碰任何内部实现，因此任何一层断链都会在这里暴露，而不是留到后续 plan。
 *
 * 第二个用例证明「两个实例互不干扰」：A 的注册 B 看不到、A/B 的诊断历史互不可见、dispose A 之后
 * B 仍能正常注册/读回/拆除。
 *
 * 全部 fixture 使用引擎中性的 `acme.*`：core 不认识任何引擎的词汇或文件结构（RESEARCH Pitfall 15）。
 */
import { describe, expect, test } from 'vitest';
import { createEditorCore } from '../kernel/core';

describe('editor-core 内核 tracer 与实例隔离', () => {
  test('create → install → 读回 → snapshot → 逆序 dispose', () => {
    const released: string[] = [];

    const editor = createEditorCore({
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

  test('两个实例互不干扰', () => {
    const editorA = createEditorCore({});
    const editorB = createEditorCore({});

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
