// @vitest-environment node
/**
 * Phase 3 原子构造与启动失败测试（KERN-04）。
 *
 * 它把 D-07/D-08 的契约钉死在行为上：必需集合是 `config.requiredCapabilities` ∪ core 内置清单、
 * 判定粒度是具体 `kind:id`；构造末尾统一核对，任一未解析即**逆序释放**已创建的部分，然后抛出
 * `EditorCoreStartupError` 并携带**全部**诊断——绝不交出半成品。只有「必需项缺失」阻断启动；
 * 其它 error 级诊断（例如一次被拒的重复注册）随实例正常返回并留在总线历史里。
 *
 * 全部 fixture 使用引擎中性的 `acme.*`：core 不认识任何引擎的词汇或文件结构（RESEARCH Pitfall 15）。
 */
import { describe, expect, test } from 'vitest';
import { createEditorCore } from '../kernel/core';
import { DIAGNOSTIC_CODES } from '../kernel/diagnostics';
import { EditorCoreStartupError } from '../kernel/errors';

/** 运行构造并返回它抛出的启动错误；若没有抛出，就让测试失败而不是静默通过。 */
function captureStartupError(run: () => unknown): EditorCoreStartupError {
  try {
    run();
  } catch (error) {
    if (error instanceof EditorCoreStartupError) return error;
    throw error;
  }
  throw new Error('预期抛出 EditorCoreStartupError，但没有抛出');
}

describe('editor-core 原子构造与启动失败', () => {
  test('必需注册已满足时构造成功并暴露该能力', () => {
    const editor = createEditorCore({
      requiredCapabilities: ['acme.thing:alpha'],
      install: (registrar) => {
        registrar.register('acme.thing', 'alpha', { ready: true }, { owner: 'acme-installer' });
      },
    });

    expect(editor.getCapability('acme.thing', 'alpha')).toEqual({ ready: true });
    expect(editor.diagnostics.snapshot()).toHaveLength(0);

    editor.dispose();
  });

  test('必需注册未解析时抛出 EditorCoreStartupError 且不返回实例', () => {
    let returned: unknown;
    let thrown: unknown;

    try {
      returned = createEditorCore({ requiredCapabilities: ['acme.thing:alpha'] });
    } catch (error) {
      thrown = error;
    }

    expect(returned).toBeUndefined();
    expect(thrown).toBeInstanceOf(EditorCoreStartupError);
  });

  test('启动错误的 diagnostics 携带 capability.required-missing 与精确 target', () => {
    const thrown = captureStartupError(() => createEditorCore({ requiredCapabilities: ['acme.thing:alpha'] }));

    const missing = thrown.diagnostics.filter(
      (diagnostic) => diagnostic.code === DIAGNOSTIC_CODES.capabilityRequiredMissing,
    );
    expect(missing).toHaveLength(1);
    expect(missing[0].severity).toBe('error');
    expect(missing[0].target).toBe('acme.thing:alpha');
    expect(thrown.name).toBe('EditorCoreStartupError');
    expect(thrown.message).toContain('acme.thing:alpha');
  });

  test('启动失败路径逆序释放已创建的部分', () => {
    const released: string[] = [];

    captureStartupError(() =>
      createEditorCore({
        requiredCapabilities: ['acme.thing:alpha'],
        install: (registrar) => {
          registrar.addTeardown(() => released.push('first'));
          registrar.addTeardown(() => released.push('second'));
        },
      }),
    );

    expect(released).toEqual(['second', 'first']);
  });

  test('启动错误携带全部诊断（被拒的重复注册 + 必需缺失）', () => {
    const thrown = captureStartupError(() =>
      createEditorCore({
        requiredCapabilities: ['acme.other:beta'],
        install: (registrar) => {
          registrar.register('acme.thing', 'alpha', 1);
          registrar.register('acme.thing', 'alpha', 2);
        },
      }),
    );

    const codes = thrown.diagnostics.map((diagnostic) => diagnostic.code);
    expect(codes).toContain(DIAGNOSTIC_CODES.capabilityDuplicate);
    expect(codes).toContain(DIAGNOSTIC_CODES.capabilityRequiredMissing);
  });

  test('非阻断的 error 诊断不阻断构造，且可从 snapshot 读到', () => {
    const editor = createEditorCore({
      requiredCapabilities: ['acme.thing:alpha'],
      install: (registrar) => {
        registrar.register('acme.thing', 'alpha', 1);
        registrar.register('acme.thing', 'alpha', 2);
      },
    });

    expect(editor.getCapability('acme.thing', 'alpha')).toBe(1);

    const snapshot = editor.diagnostics.snapshot();
    expect(snapshot).toHaveLength(1);
    expect(snapshot[0].severity).toBe('error');
    expect(snapshot[0].code).toBe(DIAGNOSTIC_CODES.capabilityDuplicate);

    editor.dispose();
  });
});
