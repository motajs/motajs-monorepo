import { IResource, IResourceIdentifier, IResourceStore } from './types';

export class Resource<T> implements IResource<T> {
  readonly identifier: IResourceIdentifier;

  /** 资源内容读写的窄接缝，由资源系统提供 */
  private readonly store: IResourceStore;

  constructor(identifier: IResourceIdentifier, store: IResourceStore) {
    this.identifier = identifier;
    this.store = store;
  }

  request(): Promise<T | undefined> {
    return this.store.readContent<T>(this.identifier);
  }

  write(data: T): Promise<void> {
    return this.store.writeContent(this.identifier, data);
  }
}
