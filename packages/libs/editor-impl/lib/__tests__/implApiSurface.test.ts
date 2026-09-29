// @vitest-environment node
/**
 * 默认实现层公开面测试（拆分自原 `coreApiSurface.test.ts`；T-05.1-10）。
 *
 * 断言 `@motajs/editor-impl` 的根 `.` 重新导出承接了原 `@motajs/editor-core` 根 `.` 的
 * 资源层 / 编辑层公开名（值 + 类型）。底层面（内核 + 端口 + 撤销契约）由
 * `editor-core/lib/__tests__/coreApiSurface.test.ts` 断言。
 *
 * 环境：impl 的 vitest 默认 jsdom（React 探针需要），本文件用文件级 docblock 切到 node。
 * fixture 纪律（D-22 的约定半边）：不声明模块级 fixture 表；期望值直接写在用例内。
 */
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
import type {
  Action,
  ActionType,
  Content,
  ExecutorStatus,
  FileContent,
  FileHandlerDependencies,
  IContentHandler,
  IContentView,
  IDataHandler,
  ILoadableResource,
  IPatchableResource,
  IRecoverableResource,
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
    expectTypeOf<ActionType>().not.toBeNever();
    expectTypeOf<ResourceRegistryEntry>().not.toBeNever();
    expectTypeOf<FileHandlerDependencies>().not.toBeNever();
  });

  test('Plan 02 新增的默认实现层接口从根 `.` 解析（编译期断言）', () => {
    expectTypeOf<IResourceView<string>>().not.toBeNever();
    expectTypeOf<ILoadableResource<string>>().not.toBeNever();
    expectTypeOf<IPatchableResource<string>>().not.toBeNever();
    expectTypeOf<IRecoverableResource<string>>().not.toBeNever();
  });
});
