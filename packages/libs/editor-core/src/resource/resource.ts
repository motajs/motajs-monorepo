import { IResourceStore } from './store';
import { IResource, IResourceIdentifier } from './types';

export class Resource<T> implements IResource<T> {
  readonly identifier: IResourceIdentifier;

  private readonly store: IResourceStore;

  constructor(identifier: IResourceIdentifier, store: IResourceStore) {
    this.identifier = identifier;
    this.store = store;
  }

  async request(): Promise<T> {
    return this.store.readContent<T>(this.identifier);
  }

  async write(data: T): Promise<void> {
    await this.store.writeContent(this.identifier, data);
  }
}
