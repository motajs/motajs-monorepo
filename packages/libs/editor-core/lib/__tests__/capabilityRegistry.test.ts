// @vitest-environment node
/**
 * Phase 3 registry 契约测试（KERN-03）。
 *
 * 它把 D-02/D-03/D-19 的每一条钉死在行为上：种类格式校验、重复注册被拒且**无副作用**、
 * `replaceable: true` 才允许替换、旧 disposer 失效、失败的替换尝试不动旧值、
 * `EditorCore.getCapability` 与 `EditorCore.getCapabilityOrThrow` 的差别、
 * `EditorCore.snapshotCapabilities` 的扁平冻结形状，以及用 `Map` 键控挡住的 `__proto__` 原型污染。
 *
 * 全部 fixture 使用引擎中性的 `acme.*`（RESEARCH Pitfall 15）。
 */
import { describe, expect, test } from 'vitest';
import { createEditorCore } from '../kernel/core';

/** 合法种类：单段与多段、camelCase 与连字符都要放行（D-17）。 */
const VALID_KINDS = [
  'command',
  'keybinding',
  'code.language',
  'table.fieldEditor',
  'acme.anything',
  'acme.my-kind',
] as const;

/** 非法种类：空串、前导数字、前导/尾随点、空段、空白与斜杠都要拒。 */
const INVALID_KINDS = ['', '1command', '.acme', 'acme.', 'acme..thing', 'acme thing', 'acme/thing'] as const;

describe('editor-core capability registry 契约', () => {
  test('kind 格式：合法种类通过、非法种类产生 capability.kind-invalid', () => {
    const editor = createEditorCore({});

    for (const [index, kind] of VALID_KINDS.entries()) {
      const result = editor.registerCapability(kind, `id-${index}`, kind);
      expect(result.diagnostics).toHaveLength(0);
      expect(editor.getCapability(kind, `id-${index}`)).toBe(kind);
    }

    const before = editor.snapshotCapabilities().length;
    for (const kind of INVALID_KINDS) {
      const result = editor.registerCapability(kind, 'target', 'value');
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0].code).toBe('capability.kind-invalid');
      expect(result.diagnostics[0].target).toBe(`${kind}:target`);
      expect(() => result.disposer()).not.toThrow();
    }
    expect(editor.snapshotCapabilities()).toHaveLength(before);
  });

  test('重复注册被拒且无副作用，owner 指向现有占用者', () => {
    const editor = createEditorCore({});

    editor.registerCapability('acme.thing', 'alpha', 1, { owner: 'first' });
    const duplicate = editor.registerCapability('acme.thing', 'alpha', 2, { owner: 'second' });

    expect(duplicate.diagnostics).toHaveLength(1);
    expect(duplicate.diagnostics[0].code).toBe('capability.duplicate');
    expect(duplicate.diagnostics[0].owner).toBe('first');
    expect(duplicate.diagnostics[0].target).toBe('acme.thing:alpha');
    expect(() => duplicate.disposer()).not.toThrow();

    expect(editor.getCapability('acme.thing', 'alpha')).toBe(1);
    expect(editor.snapshotCapabilities()).toHaveLength(1);
  });

  test('replaceable: true 才提交替换，旧 disposer 随之失效', () => {
    const editor = createEditorCore({});

    const first = editor.registerCapability('acme.thing', 'alpha', 1, { replaceable: true });
    expect(first.diagnostics).toHaveLength(0);

    const second = editor.registerCapability('acme.thing', 'alpha', 2, { owner: 'second' });
    expect(second.diagnostics).toHaveLength(0);
    expect(editor.getCapability('acme.thing', 'alpha')).toBe(2);

    first.disposer();
    expect(editor.getCapability('acme.thing', 'alpha')).toBe(2);

    second.disposer();
    expect(editor.getCapability('acme.thing', 'alpha')).toBeUndefined();
  });

  test('失败的替换尝试保留旧值', () => {
    const editor = createEditorCore({});

    editor.registerCapability('acme.thing', 'alpha', 1, { replaceable: true });
    const failed = editor.registerCapability('9bad.kind', 'alpha', 2);
    expect(failed.diagnostics).toHaveLength(1);
    expect(failed.diagnostics[0].code).toBe('capability.kind-invalid');
    expect(editor.getCapability('acme.thing', 'alpha')).toBe(1);
    expect(editor.snapshotCapabilities()).toHaveLength(1);

    editor.registerCapability('acme.other', 'beta', 'keep');
    const duplicate = editor.registerCapability('acme.other', 'beta', 'overwrite');
    expect(duplicate.diagnostics).toHaveLength(1);
    expect(editor.getCapability('acme.other', 'beta')).toBe('keep');
  });

  test('getCapability 返回 undefined，getCapabilityOrThrow 抛错并带上 kind:id', () => {
    const editor = createEditorCore({});

    expect(editor.getCapability('acme.thing', 'alpha')).toBeUndefined();
    expect(() => editor.getCapabilityOrThrow('acme.thing', 'alpha')).toThrow('acme.thing:alpha');
  });

  test('snapshotCapabilities 跨两个 kind 返回扁平冻结数组（插入顺序）', () => {
    const editor = createEditorCore({});

    editor.registerCapability('acme.a', 'one', 1, { owner: 'first' });
    editor.registerCapability('acme.a', 'two', 2);
    editor.registerCapability('acme.b', 'one', 3);

    const snapshot = editor.snapshotCapabilities();
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(snapshot).toHaveLength(3);
    expect(snapshot.map((entry) => `${entry.kind}:${entry.id}`)).toEqual(['acme.a:one', 'acme.a:two', 'acme.b:one']);
    expect(snapshot[0]).toEqual({ kind: 'acme.a', id: 'one', value: 1, owner: 'first' });
    expect(snapshot[1]).toEqual({ kind: 'acme.a', id: 'two', value: 2, owner: undefined });
  });

  test('原型污染防护：id 为 __proto__ / constructor 也能安全往返', () => {
    const editor = createEditorCore({});

    editor.registerCapability('acme.pollution', '__proto__', { polluted: true });
    editor.registerCapability('acme.pollution', 'constructor', 'safe');

    expect(editor.getCapability('acme.pollution', '__proto__')).toEqual({ polluted: true });
    expect(editor.getCapability('acme.pollution', 'constructor')).toBe('safe');
    expect(Object.hasOwn(Object.prototype, 'polluted')).toBe(false);
    expect(({} as { polluted?: unknown }).polluted).toBeUndefined();
  });

  test('disposer 幂等：二次调用与 dispose 后调用都不抛错', () => {
    const editor = createEditorCore({});

    const result = editor.registerCapability('acme.thing', 'alpha', 1);
    expect(() => {
      result.disposer();
      result.disposer();
    }).not.toThrow();

    expect(editor.getCapability('acme.thing', 'alpha')).toBeUndefined();

    const afterDispose = editor.registerCapability('acme.other', 'beta', 2);
    editor.dispose();
    expect(() => {
      afterDispose.disposer();
      editor.dispose();
    }).not.toThrow();
  });
});
