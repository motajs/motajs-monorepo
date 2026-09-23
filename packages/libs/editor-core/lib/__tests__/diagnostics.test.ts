// @vitest-environment node
/**
 * Phase 3 诊断总线契约测试（KERN-05）。
 *
 * 它把 D-05/D-06 的语义钉死：`DiagnosticBus.snapshot()` 读全部已发生的诊断（构造期诊断在构造返回后
 * 仍可读），`DiagnosticBus.subscribe()` 只收订阅之后的诊断且返回的 unsubscribe 立即生效；
 * 订阅者抛错被**隔离**——只追加一条 `diagnostic.subscriber-error` 历史（append-without-dispatch），
 * 不重入派发、不影响其它订阅者、也不让生产方失败；历史是追加式且在测试范围内无上限。
 *
 * 全部 fixture 使用引擎中性的 `acme.*`（RESEARCH Pitfall 15）。
 */
import { describe, expect, test } from 'vitest';
import { createDiagnosticBus, DIAGNOSTIC_CODES, type Diagnostic } from '../kernel/diagnostics';

describe('editor-core 诊断总线契约', () => {
  test('snapshot 按顺序返回全部历史，且返回的是不可变副本', () => {
    const bus = createDiagnosticBus();
    const first: Diagnostic = { severity: 'error', code: 'acme.first', message: 'first' };
    const second: Diagnostic = { severity: 'info', code: 'acme.second', message: 'second' };

    bus.push(first);
    bus.push(second);

    const snapshot = bus.snapshot();
    expect(snapshot).toEqual([first, second]);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(bus.snapshot()).not.toBe(snapshot);

    const alias = snapshot as Diagnostic[];
    expect(() => alias.push({ severity: 'info', code: 'acme.extra', message: 'extra' })).toThrow(TypeError);
    expect(bus.snapshot()).toHaveLength(2);
  });

  test('subscribe 只收后续诊断，unsubscribe 后不再收到', () => {
    const bus = createDiagnosticBus();
    bus.push({ severity: 'info', code: 'acme.before', message: 'before' });

    const received: Diagnostic[] = [];
    const unsubscribe = bus.subscribe((diagnostic) => received.push(diagnostic));

    expect(received).toHaveLength(0);
    expect(bus.snapshot()).toHaveLength(1);

    bus.push({ severity: 'info', code: 'acme.after', message: 'after' });
    expect(received.map((diagnostic) => diagnostic.code)).toEqual(['acme.after']);

    unsubscribe();
    bus.push({ severity: 'info', code: 'acme.post', message: 'post' });
    expect(received.map((diagnostic) => diagnostic.code)).toEqual(['acme.after']);
    expect(bus.snapshot()).toHaveLength(3);
  });

  test('抛错的订阅者被隔离：其它订阅者仍收到，且只留下一条 subscriber-error 历史', () => {
    const bus = createDiagnosticBus();
    let throwingCalls = 0;
    const received: Diagnostic[] = [];
    const thrownValue = new Error('subscriber boom');

    bus.subscribe(() => {
      throwingCalls += 1;
      throw thrownValue;
    });
    bus.subscribe((diagnostic) => received.push(diagnostic));

    const event: Diagnostic = { severity: 'error', code: 'acme.event', message: 'event' };
    bus.push(event);

    expect(throwingCalls).toBe(1);
    expect(received).toEqual([event]);

    const snapshot = bus.snapshot();
    expect(snapshot).toHaveLength(2);
    expect(snapshot[0]).toBe(event);
    expect(snapshot[1].code).toBe(DIAGNOSTIC_CODES.diagnosticSubscriberError);
    expect(snapshot[1].severity).toBe('warning');
    expect(snapshot[1].cause).toBe(thrownValue);

    // append-without-dispatch：这条内部诊断不会被再次派发，所以抛错订阅者的调用次数仍为 1。
    expect(throwingCalls).toBe(1);
  });

  test('DIAGNOSTIC_CODES 暴露恰好五个稳定机器码', () => {
    expect(Object.keys(DIAGNOSTIC_CODES).sort()).toEqual([
      'capabilityDuplicate',
      'capabilityKindInvalid',
      'capabilityRequiredMissing',
      'diagnosticSubscriberError',
      'lifecycleTeardownFailed',
    ]);
    expect(DIAGNOSTIC_CODES.capabilityDuplicate).toBe('capability.duplicate');
    expect(DIAGNOSTIC_CODES.capabilityKindInvalid).toBe('capability.kind-invalid');
    expect(DIAGNOSTIC_CODES.capabilityRequiredMissing).toBe('capability.required-missing');
    expect(DIAGNOSTIC_CODES.diagnosticSubscriberError).toBe('diagnostic.subscriber-error');
    expect(DIAGNOSTIC_CODES.lifecycleTeardownFailed).toBe('lifecycle.teardown-failed');
  });

  test('历史追加式且在本测试范围内无上限', () => {
    const bus = createDiagnosticBus();
    const count = 500;

    for (let index = 0; index < count; index += 1) {
      bus.push({ severity: 'info', code: 'acme.count', message: `#${index}` });
    }

    // D-05/D-06 刻意不设上限：Phase 3 的诊断是构造期低频事件；该 DoS 风险作为已知接受项记录（T-03-10）。
    expect(bus.snapshot()).toHaveLength(count);
    expect(bus.snapshot()[count - 1].message).toBe(`#${count - 1}`);
  });
});
