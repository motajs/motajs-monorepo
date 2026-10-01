// @vitest-environment node
import { describe, expect, expectTypeOf, test } from 'vitest';
import {
  DiagnosticBusImpl,
  EditorCoreKernel,
  defineEngine,
  DIAGNOSTIC_CODES,
  EDITOR_CORE_API_VERSION,
  ENGINE_ADAPTER_API_VERSION,
  EditorCoreStartupError,
  EngineDefinitionError,
  isValidResourceId,
  OperationHistory,
  resolvePreloadOrder,
  UndoManager,
} from '../index';
import {
  AppliedOperation,
  CapabilityRef,
  CapabilityRegistrar,
  Diagnostic,
  DiagnosticBus,
  DiagnosticCode,
  DiagnosticSeverity,
  EditorCore,
  EditorCoreConfig,
  EditorOperation,
  EngineAdapter,
  EngineDescription,
  FsPort,
  HostPort,
  IEditorOperation,
  IEngineAdapter,
  IFsPort,
  IHostPort,
  IPreviewAdapter,
  IUndoManager,
  OperationHistoryEntry,
  OperationHistoryState,
  OperationMeta,
  PreloadStrategy,
  PreviewAdapter,
  RegisterCapabilityOptions,
  RegisterCapabilityResult,
  ResourceDependencies,
  ResourceDescriptor,
} from '../index';

describe('editor-core 底层面公开面', () => {
  // 覆盖：版本常量与三个工厂/错误类是真实导出
  test('版本常量与工厂/错误类是真实导出', () => {
    expect(EDITOR_CORE_API_VERSION).toBe('0.1.0');
    expect(typeof EditorCoreKernel).toBe('function');
    expect(typeof DiagnosticBusImpl).toBe('function');
    expect(typeof EditorCoreStartupError).toBe('function');
  });

  // 覆盖：EditorCoreStartupError 是 Error 子类，diagnostics 为数组且可空
  test('EditorCoreStartupError 的实例形状', () => {
    const error = new EditorCoreStartupError([]);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(EditorCoreStartupError);
    expect(error.name).toBe('EditorCoreStartupError');
    expect(Array.isArray(error.diagnostics)).toBe(true);
    expect(error.diagnostics).toHaveLength(0);
  });

  // 覆盖：DIAGNOSTIC_CODES 的键与机器码取值恰好是五个
  test('DIAGNOSTIC_CODES 恰好是五个稳定机器码', () => {
    expect(DIAGNOSTIC_CODES).toEqual({
      capabilityDuplicate: 'capability.duplicate',
      capabilityKindInvalid: 'capability.kind-invalid',
      capabilityRequiredMissing: 'capability.required-missing',
      diagnosticSubscriberError: 'diagnostic.subscriber-error',
      lifecycleTeardownFailed: 'lifecycle.teardown-failed',
    });
  });

  // 覆盖：EditorCoreKernel({}) 暴露注册表四件套、dispose 与 diagnostics 两方法
  test('EditorCoreKernel({}) 暴露注册表四件套、dispose 与 diagnostics', () => {
    const editor = new EditorCoreKernel({});
    try {
      expect(typeof editor.registerCapability).toBe('function');
      expect(typeof editor.getCapability).toBe('function');
      expect(typeof editor.getCapabilityOrThrow).toBe('function');
      expect(typeof editor.snapshotCapabilities).toBe('function');
      expect(typeof editor.dispose).toBe('function');
      expect(typeof editor.diagnostics.snapshot).toBe('function');
      expect(typeof editor.diagnostics.subscribe).toBe('function');
    } finally {
      editor.dispose();
    }
  });

  // 覆盖：Phase 5 适配器契约的值都从根 `.` 导出
  test('Phase 5 适配器契约的值都从根 `.` 导出（值面）', () => {
    expect(typeof defineEngine).toBe('function');
    expect(typeof isValidResourceId).toBe('function');
    expect(typeof resolvePreloadOrder).toBe('function');
    expect(typeof EngineDefinitionError).toBe('function');
    expect(typeof ENGINE_ADAPTER_API_VERSION).toBe('string');
  });

  // 覆盖：UndoManager 与其旧名值别名 OperationHistory 都从根 `.` 导出且指向同一类
  test('撤销管理器与其旧名值别名都从根 `.` 导出（值面）', () => {
    expect(typeof UndoManager).toBe('function');
    expect(typeof OperationHistory).toBe('function');
    expect(OperationHistory).toBe(UndoManager);
    const manager = new UndoManager();
    expect(typeof manager.execute).toBe('function');
    expect(typeof manager.undo).toBe('function');
    expect(typeof manager.redo).toBe('function');
    expect(typeof manager.clear).toBe('function');
    expect(typeof manager.store.subscribe).toBe('function');
  });

  // 覆盖：内核三接口与四个 port 类型（含新旧名）从公开面解析
  test('内核三接口与四个 port 类型从公开面解析（编译期断言）', () => {
    expectTypeOf<CapabilityRegistrar>().toBeObject();
    expectTypeOf<EditorCoreConfig>().toBeObject();
    expectTypeOf<EditorCore>().toBeObject();
    // D-07 新名（带 `I` 前缀）与 D-18 旧名别名都必须从公开面解析
    expectTypeOf<IEngineAdapter>().toBeObject();
    expectTypeOf<IFsPort>().toBeObject();
    expectTypeOf<IHostPort>().toBeObject();
    expectTypeOf<IPreviewAdapter>().toBeObject();
    expectTypeOf<EngineAdapter>().toBeObject();
    expectTypeOf<FsPort>().toBeObject();
    expectTypeOf<HostPort>().toBeObject();
    expectTypeOf<PreviewAdapter>().toBeObject();
  });

  // 覆盖：能力登记与诊断类型从公开面解析
  test('内核登记/诊断类型从公开面解析（编译期断言）', () => {
    expectTypeOf<CapabilityRef>().not.toBeNever();
    expectTypeOf<RegisterCapabilityOptions>().not.toBeNever();
    expectTypeOf<RegisterCapabilityResult>().not.toBeNever();
    expectTypeOf<Diagnostic>().not.toBeNever();
    expectTypeOf<DiagnosticSeverity>().not.toBeNever();
    expectTypeOf<DiagnosticBus>().not.toBeNever();
    expectTypeOf<DiagnosticCode>().not.toBeNever();
  });

  // 覆盖：Phase 5 适配器契约的类型名都从根 `.` 解析，PreloadStrategy 成员取值仍是 0/1/2
  test('Phase 5 适配器契约的类型名都从根 `.` 解析（编译期断言）', () => {
    expectTypeOf<ResourceDescriptor<unknown>>().not.toBeNever();
    expectTypeOf<ResourceDependencies>().not.toBeNever();
    expectTypeOf<EngineDescription>().not.toBeNever();
    expect(PreloadStrategy.Eager).toBe(0);
    expect(PreloadStrategy.Lazy).toBe(1);
    expect(PreloadStrategy.OnDemand).toBe(2);
  });

  // 覆盖：Plan 01 的撤销契约类型都从根 `.` 解析
  test('Plan 01 的撤销契约类型都从根 `.` 解析（编译期断言）', () => {
    expectTypeOf<IEditorOperation>().not.toBeNever();
    expectTypeOf<AppliedOperation<number>>().not.toBeNever();
    expectTypeOf<OperationMeta>().not.toBeNever();
    expectTypeOf<IUndoManager>().not.toBeNever();
    expectTypeOf<OperationHistoryEntry>().not.toBeNever();
    expectTypeOf<OperationHistoryState>().not.toBeNever();
    expectTypeOf<EditorOperation>().not.toBeNever();
  });
});
