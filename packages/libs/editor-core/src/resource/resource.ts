import { IResource, IResourceIdentifier, IResourceStore, ResourceContent } from './types';

export class Resource implements IResource {
  readonly identifier: IResourceIdentifier;

  /** 资源内容读写的窄接缝，由资源系统提供 */
  private readonly store: IResourceStore;

  constructor(identifier: IResourceIdentifier, store: IResourceStore) {
    this.identifier = identifier;
    this.store = store;
  }

  request(): Promise<ResourceContent | undefined> {
    return this.store.readContent(this.identifier);
  }

  requestBinary(): Promise<Uint8Array | undefined> {
    return this.store.readBinary(this.identifier);
  }

  write(data: ResourceContent): Promise<void> {
    return this.store.writeContent(this.identifier, data);
  }
}
