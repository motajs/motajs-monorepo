// @vitest-environment node
import { describe, expect, test } from 'vitest';
import { EditorCoreKernel } from '../kernel/core';

// 合法种类：单段与多段、camelCase 与连字符都要放行（D-17）
const VALID_KINDS = [
  'command',
  'keybinding',
  'code.language',
  'table.fieldEditor',
  'acme.anything',
  'acme.my-kind',
] as const;

// 非法种类：空串、前导数字、前导/尾随点、空段、空白与斜杠都要拒
const INVALID_KINDS = ['', '1command', '.acme', 'acme.', 'acme..thing', 'acme thing', 'acme/thing'] as const;

describe('editor-core capability registry 契约', () => {
  // 覆盖：合法种类全部通过且可读回，非法种类各产生一条 capability.kind-invalid
  test('kind 格式：合法种类通过、非法种类产生 capability.kind-invalid', () => {
    const editor = new EditorCoreKernel({});

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

  // 覆盖：重复注册被拒且无副作用，owner 指向现有占用者
  test('重复注册被拒且无副作用，owner 指向现有占用者', () => {
    const editor = new EditorCoreKernel({});

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

  // 覆盖：replaceable: true 才提交替换，旧 disposer 随之失效
  test('replaceable: true 才提交替换，旧 disposer 随之失效', () => {
    const editor = new EditorCoreKernel({});

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

  // 覆盖：失败的替换尝试保留旧值（非法 kind 与重复注册两种）
  test('失败的替换尝试保留旧值', () => {
    const editor = new EditorCoreKernel({});

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

  // 覆盖：getCapability 返回 undefined，getCapabilityOrThrow 抛错并带上 kind:id
  test('getCapability 返回 undefined，getCapabilityOrThrow 抛错并带上 kind:id', () => {
    const editor = new EditorCoreKernel({});

    expect(editor.getCapability('acme.thing', 'alpha')).toBeUndefined();
    expect(() => editor.getCapabilityOrThrow('acme.thing', 'alpha')).toThrow('acme.thing:alpha');
  });

  // 覆盖：snapshotCapabilities 跨两个 kind 返回扁平冻结数组（插入顺序）
  test('snapshotCapabilities 跨两个 kind 返回扁平冻结数组（插入顺序）', () => {
    const editor = new EditorCoreKernel({});

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

  // 覆盖：id 为 __proto__ / constructor 也能安全往返，且不污染 Object.prototype
  test('原型污染防护：id 为 __proto__ / constructor 也能安全往返', () => {
    const editor = new EditorCoreKernel({});

    editor.registerCapability('acme.pollution', '__proto__', { polluted: true });
    editor.registerCapability('acme.pollution', 'constructor', 'safe');

    expect(editor.getCapability('acme.pollution', '__proto__')).toEqual({ polluted: true });
    expect(editor.getCapability('acme.pollution', 'constructor')).toBe('safe');
    expect(Object.hasOwn(Object.prototype, 'polluted')).toBe(false);
    expect(({} as { polluted?: unknown }).polluted).toBeUndefined();
  });

  // 覆盖：disposer 幂等，二次调用与 dispose 后调用都不抛错
  test('disposer 幂等：二次调用与 dispose 后调用都不抛错', () => {
    const editor = new EditorCoreKernel({});

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
