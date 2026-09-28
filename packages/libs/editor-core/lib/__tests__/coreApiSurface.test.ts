// @vitest-environment node
/**
 * Phase 3 公开面测试（KERN-05 / PORT-01，N-25）。
 *
 * 两条互补的断言：
 * 1. **运行时**：从唯一可导入的公开面 `../index` 断言导出的常量、工厂、错误类与实例方法确实存在且形状正确
 *    （版本常量取值、五个诊断机器码、`EditorCore` 实例的注册表四件套 + `EditorCore.dispose` + `.diagnostics`
 *    的两个成员）。
 * 2. **编译期**：把四个 port 类型当**类型**从 `../index` 导入并做 `expectTypeOf` 断言——`tsc` 会真正求值它，
 *    因此某个 port 类型一旦不再从公开面导出，`pnpm --filter @motajs/editor-core typecheck` 立刻失败。
 *    这是唯一诚实断言「类型级 port 存在」的方式（运行时的 `import` 拿不到一个纯类型）。
 *
 * 环境：core 的 vitest 默认 jsdom（Phase 2 的 React 探针需要），本文件用文件级 docblock 切到 node。
 * fixture 纪律（D-22 的约定半边）：本文件不声明模块级 fixture 表；期望值直接写在用例内。
 */
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
  resolvePreloadOrder,
} from '../index';
import type {
  EngineAdapter,
  EngineDescription,
  FsPort,
  HostPort,
  PreloadStrategy,
  PreviewAdapter,
  ResourceDependencies,
  ResourceDescriptor,
} from '../index';
import {
  aggregateResource,
  applyAction,
  applyActions,
  applyActionsWithInverse,
  BinaryFileHandler,
  buildFieldPath,
  compositeOperation,
  ComputedResource,
  computedResource,
  ContentUtils,
  DataHandler,
  deleteByFieldPath,
  fieldToDataAttr,
  FileHandler,
  FileHandlerManager,
  FileResource,
  getByFieldPath,
  getParentField,
  getParentFieldPath,
  getShortField,
  isFileNotFoundError,
  JsonDataHandler,
  OperationHistory,
  operationPathTarget,
  optional,
  parseFieldPath,
  patchResourceOperation,
  PersistenceMonitor,
  PersistExecutor,
  ResourceRegistry,
  setByFieldPath,
  waitUntil,
} from '../index';
import type {
  Action,
  ActionType,
  AppliedOperation,
  Content,
  EditorOperation,
  ExecutorStatus,
  FileContent,
  FileHandlerDependencies,
  IContentHandler,
  IContentView,
  IDataHandler,
  LoadableResource,
  OperationMeta,
  OperationTarget,
  PatchableResource,
  PersistFailure,
  PersistenceIntent,
  ReadonlySignal,
  RecoverableResource,
  ResourceRegistryEntry,
  ResourceView,
  UndoSystem,
} from '../index';

describe('editor-core 公开面', () => {
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

  test('四个 port 类型从公开面解析（编译期断言）', () => {
    expectTypeOf<EngineAdapter>().toBeObject();
    expectTypeOf<FsPort>().toBeObject();
    expectTypeOf<HostPort>().toBeObject();
    expectTypeOf<PreviewAdapter>().toBeObject();
  });

  test('Phase 4 搬入的四个资源层类与三个编辑层类都从根 `.` 导出（值面）', () => {
    const classes = [
      FileHandlerManager,
      FileHandler,
      FileResource,
      DataHandler,
      JsonDataHandler,
      BinaryFileHandler,
      PersistenceMonitor,
      PersistExecutor,
      ResourceRegistry,
      OperationHistory,
      ComputedResource,
    ];
    for (const candidate of classes) expect(typeof candidate).toBe('function');
  });

  test('Phase 4 搬入的函数与常量对象都从根 `.` 导出（值面）', () => {
    const functions = [
      isFileNotFoundError,
      waitUntil,
      computedResource,
      aggregateResource,
      optional,
      compositeOperation,
      patchResourceOperation,
      operationPathTarget,
      applyAction,
      applyActions,
      applyActionsWithInverse,
      parseFieldPath,
      getShortField,
      buildFieldPath,
      getParentField,
      getParentFieldPath,
      getByFieldPath,
      setByFieldPath,
      deleteByFieldPath,
      fieldToDataAttr,
    ];
    for (const candidate of functions) expect(typeof candidate).toBe('function');
    expect(typeof ContentUtils).toBe('object');
    expect(typeof ContentUtils.map).toBe('function');
  });

  test('Phase 4 搬入的类型名都从根 `.` 解析（编译期断言）', () => {
    expectTypeOf<Content<number>>().not.toBeNever();
    expectTypeOf<FileContent>().not.toBeNever();
    expectTypeOf<ReadonlySignal<number>>().not.toBeNever();
    expectTypeOf<IContentView<string>>().not.toBeNever();
    expectTypeOf<IContentHandler<string>>().not.toBeNever();
    expectTypeOf<IDataHandler<string>>().not.toBeNever();
    expectTypeOf<RecoverableResource<string>>().not.toBeNever();
    expectTypeOf<PersistenceIntent>().not.toBeNever();
    expectTypeOf<ExecutorStatus>().not.toBeNever();
    expectTypeOf<PersistFailure>().not.toBeNever();
    expectTypeOf<ResourceView<string>>().not.toBeNever();
    expectTypeOf<LoadableResource<string>>().not.toBeNever();
    expectTypeOf<EditorOperation>().not.toBeNever();
    expectTypeOf<OperationTarget>().not.toBeNever();
    expectTypeOf<OperationMeta>().not.toBeNever();
    expectTypeOf<AppliedOperation>().not.toBeNever();
    expectTypeOf<PatchableResource<string>>().not.toBeNever();
    expectTypeOf<Action>().not.toBeNever();
    expectTypeOf<ActionType>().not.toBeNever();
    expectTypeOf<UndoSystem>().not.toBeNever();
    expectTypeOf<ResourceRegistryEntry>().not.toBeNever();
    expectTypeOf<FileHandlerDependencies>().not.toBeNever();
  });

  test('Phase 5 适配器契约的值都从根 `.` 导出（值面）', () => {
    expect(typeof defineEngine).toBe('function');
    expect(typeof isValidResourceId).toBe('function');
    expect(typeof resolvePreloadOrder).toBe('function');
    expect(typeof EngineDefinitionError).toBe('function');
    expect(typeof ENGINE_ADAPTER_API_VERSION).toBe('string');
  });

  test('Phase 5 适配器契约的类型名都从根 `.` 解析（编译期断言）', () => {
    expectTypeOf<ResourceDescriptor<unknown>>().not.toBeNever();
    expectTypeOf<ResourceDependencies>().not.toBeNever();
    expectTypeOf<EngineDescription>().not.toBeNever();
    expectTypeOf<PreloadStrategy>().not.toBeNever();
  });
});
