// @vitest-environment node
import { describe, expect, expectTypeOf, test } from 'vitest';
import {
  createDiagnosticBus,
  createEditorCore,
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

/**
 * 底层面公开面测试（KERN-05 / PORT-01，N-25；拆分自原 `coreApiSurface.test.ts`）。
 *
 * 两条互补的断言：
 * 1. **运行时**：从唯一可导入的公开面 `../index` 断言导出的常量、工厂、错误类与实例方法确实存在且形状正确
 *    （版本常量取值、五个诊断机器码、`EditorCore` 实例的注册表四件套 + `EditorCore.dispose` + `.diagnostics`
 *    的两个成员）。
 * 2. **编译期**：把内核三接口、四个 port 类型与撤销契约类型当**类型**从 `../index` 导入并做 `expectTypeOf`
 *    断言——`tsc` 会真正求值它，因此某个类型一旦不再从公开面导出，`pnpm --filter @motajs/editor-core typecheck`
 *    立刻失败。这是唯一诚实断言「类型级出口存在」的方式（运行时的 `import` 拿不到一个纯类型）。
 *
 * 默认实现面（`Content`/`FileHandler`/字段路径/…）已随内容迁入默认实现包，由该包的
 * `lib/__tests__/implApiSurface.test.ts` 断言。**底层面现在含 `UndoManager`**（Plan 04 Task 2 接入），
 * 并以值别名 `OperationHistory` 继续可用（D-18）。
 *
 * 环境：core 的 vitest 默认 jsdom（Phase 2 的 React 探针需要），本文件用文件级 docblock 切到 node。
 * fixture 纪律（D-22 的约定半边）：本文件不声明模块级 fixture 表；期望值直接写在用例内。
 */

describe('editor-core 底层面公开面', () => {
  test('版本常量与工厂/错误类是真实导出', () => {
    expect(EDITOR_CORE_API_VERSION).toBe('0.1.0');
    expect(typeof createEditorCore).toBe('function');
    expect(typeof createDiagnosticBus).toBe('function');
    expect(typeof EditorCoreStartupError).toBe('function');
  });

  test('EditorCoreStartupError 的实例形状', () => {
    const error = new EditorCoreStartupError([]);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(EditorCoreStartupError);
    expect(error.name).toBe('EditorCoreStartupError');
    expect(Array.isArray(error.diagnostics)).toBe(true);
    expect(error.diagnostics).toHaveLength(0);
  });

  test('DIAGNOSTIC_CODES 恰好是五个稳定机器码', () => {
    expect(DIAGNOSTIC_CODES).toEqual({
      capabilityDuplicate: 'capability.duplicate',
      capabilityKindInvalid: 'capability.kind-invalid',
      capabilityRequiredMissing: 'capability.required-missing',
      diagnosticSubscriberError: 'diagnostic.subscriber-error',
      lifecycleTeardownFailed: 'lifecycle.teardown-failed',
    });
  });

  test('createEditorCore({}) 暴露注册表四件套、dispose 与 diagnostics', () => {
    const editor = createEditorCore({});
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

  test('Phase 5 适配器契约的值都从根 `.` 导出（值面）', () => {
    expect(typeof defineEngine).toBe('function');
    expect(typeof isValidResourceId).toBe('function');
    expect(typeof resolvePreloadOrder).toBe('function');
    expect(typeof EngineDefinitionError).toBe('function');
    expect(typeof ENGINE_ADAPTER_API_VERSION).toBe('string');
  });

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

  test('内核三接口与四个 port 类型从公开面解析（编译期断言）', () => {
    expectTypeOf<CapabilityRegistrar>().toBeObject();
    expectTypeOf<EditorCoreConfig>().toBeObject();
    expectTypeOf<EditorCore>().toBeObject();
    // D-07 新名（带 `I` 前缀）与 D-18 旧名别名都必须从公开面解析。
    expectTypeOf<IEngineAdapter>().toBeObject();
    expectTypeOf<IFsPort>().toBeObject();
    expectTypeOf<IHostPort>().toBeObject();
    expectTypeOf<IPreviewAdapter>().toBeObject();
    expectTypeOf<EngineAdapter>().toBeObject();
    expectTypeOf<FsPort>().toBeObject();
    expectTypeOf<HostPort>().toBeObject();
    expectTypeOf<PreviewAdapter>().toBeObject();
  });

  test('内核登记/诊断类型从公开面解析（编译期断言）', () => {
    expectTypeOf<CapabilityRef>().not.toBeNever();
    expectTypeOf<RegisterCapabilityOptions>().not.toBeNever();
    expectTypeOf<RegisterCapabilityResult>().not.toBeNever();
    expectTypeOf<Diagnostic>().not.toBeNever();
    expectTypeOf<DiagnosticSeverity>().not.toBeNever();
    expectTypeOf<DiagnosticBus>().not.toBeNever();
    expectTypeOf<DiagnosticCode>().not.toBeNever();
  });

  test('Phase 5 适配器契约的类型名都从根 `.` 解析（编译期断言）', () => {
    expectTypeOf<ResourceDescriptor<unknown>>().not.toBeNever();
    expectTypeOf<ResourceDependencies>().not.toBeNever();
    expectTypeOf<EngineDescription>().not.toBeNever();
    expect(typeof PreloadStrategy).toBe('object');
  });

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
