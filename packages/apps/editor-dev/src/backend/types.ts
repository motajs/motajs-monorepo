import { IEditorCoreInjection, IResourceIdentifier } from '@motajs/editor-core';

export interface IMemoryBackend extends IEditorCoreInjection {
  /** 向内存后端预置一个资源的初始内容，并同时登记其所属的资源列表 */
  seed(id: IResourceIdentifier, value: unknown): void;
}
