// @vitest-environment node
import { describe, expect, expectTypeOf, test } from 'vitest';
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
  optional,
  parseFieldPath,
  patchResourceOperation,
  PersistenceMonitor,
  PersistExecutor,
  ResourceRegistry,
  setByFieldPath,
  waitUntil,
} from '../index';
import {
  Action,
  ActionType,
  Content,
  ExecutorStatus,
  FileContent,
  FileHandlerDependencies,
  IContentHandler,
  IContentView,
  IDataHandler,
  IFileHandlerManager,
  ILoadableResource,
  IPatchableResource,
  IPersistenceMonitor,
  IPersistExecutor,
  IRecoverableResource,
  IResourceRegistry,
  IResourceView,
  LoadableResource,
  PatchableResource,
  PersistFailure,
  PersistenceIntent,
  ReadonlySignal,
  RecoverableResource,
  ResourceRegistryEntry,
  ResourceView,
} from '../index';

describe('editor-impl 默认实现层公开面', () => {
  // 资源层与编辑层类都从根 `.` 导出（值面）
  test('资源层与编辑层类都从根 `.` 导出（值面）', () => {
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
      ComputedResource,
    ];
    for (const candidate of classes) expect(typeof candidate).toBe('function');
  });

  // 资源层与编辑层函数/常量对象都从根 `.` 导出（值面）
  test('资源层与编辑层函数/常量对象都从根 `.` 导出（值面）', () => {
    const functions = [
      isFileNotFoundError,
      waitUntil,
      computedResource,
      aggregateResource,
      optional,
      compositeOperation,
      patchResourceOperation,
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

  // 资源层与编辑层的类型名都从根 `.` 解析（编译期断言）
  test('资源层与编辑层的类型名都从根 `.` 解析（编译期断言）', () => {
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
    expectTypeOf<PatchableResource<string>>().not.toBeNever();
    expectTypeOf<Action>().not.toBeNever();
    expect(ActionType.Change).toBe(0);
    expect(ActionType.Add).toBe(1);
    expect(ActionType.Delete).toBe(2);
    expectTypeOf<ResourceRegistryEntry>().not.toBeNever();
    expectTypeOf<FileHandlerDependencies>().not.toBeNever();
  });

  // Plan 02 新增的默认实现层接口从根 `.` 解析（编译期断言）
  test('Plan 02 新增的默认实现层接口从根 `.` 解析（编译期断言）', () => {
    expectTypeOf<IResourceView<string>>().not.toBeNever();
    expectTypeOf<ILoadableResource<string>>().not.toBeNever();
    expectTypeOf<IPatchableResource<string>>().not.toBeNever();
    expectTypeOf<IRecoverableResource<string>>().not.toBeNever();
  });

  // Plan 07 新增的服务类契约从根 `.` 解析（编译期断言）
  test('Plan 07 新增的服务类契约从根 `.` 解析（编译期断言）', () => {
    expectTypeOf<IFileHandlerManager>().toBeObject();
    expectTypeOf<IPersistExecutor>().toBeObject();
    expectTypeOf<IPersistenceMonitor>().toBeObject();
    expectTypeOf<IResourceRegistry>().toBeObject();
  });
});
