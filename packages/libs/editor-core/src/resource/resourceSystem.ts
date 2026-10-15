import { IEditorFileSystem } from '../fs';
import { Hookable, HookController, IHookController } from '../hook';
import { logger } from '../log';
import { Resource } from './resource';
import { IFileEntry, IResource, IResourceIdentifier, IResourceSystemAccess, IResourceSystemHooks, ResourceContent } from './types';

export class ResourceSystem extends Hookable<IResourceSystemHooks> implements IResourceSystemAccess {
  /** 宿主注入的文件系统实现，未初始化时为空 */
  private fs: IEditorFileSystem | null = null;

  protected createController(hook: Partial<IResourceSystemHooks>): IHookController<IResourceSystemHooks> {
    return new HookController(this, hook);
  }

  async initialize(fs: IEditorFileSystem): Promise<void> {
    this.fs = fs;
  }

  async requestResource(id: IResourceIdentifier): Promise<IResource | null> {
    if (!this.fs) {
      logger.error('system.notInitialized', 'Resource');
      return null;
    }

    return new Resource(id, this);
  }

  async readContent(id: IResourceIdentifier): Promise<ResourceContent | undefined> {
    if (!this.fs) {
      logger.error('system.notInitialized', 'Resource');
      return undefined;
    }

    return this.fs.readFile(id);
  }

  async writeContent(id: IResourceIdentifier, data: ResourceContent): Promise<void> {
    if (!this.fs) {
      logger.error('system.notInitialized', 'Resource');
      return;
    }

    if (typeof data === 'string') await this.fs.writeFile(id, data);
    else await this.fs.writeBinary(id, data);
  }

  async createResource(id: IResourceIdentifier, content: ResourceContent): Promise<IResource | null> {
    if (!this.fs) {
      logger.error('system.notInitialized', 'Resource');
      return null;
    }

    if (typeof content === 'string') await this.fs.writeFile(id, content);
    else await this.fs.writeBinary(id, content);

    return new Resource(id, this);
  }

  async deleteResource(id: IResourceIdentifier): Promise<void> {
    if (!this.fs) {
      logger.error('system.notInitialized', 'Resource');
      return;
    }

    await this.fs.deleteFile(id);
  }

  async moveResource(source: IResourceIdentifier, destination: IResourceIdentifier): Promise<void> {
    if (!this.fs) {
      logger.error('system.notInitialized', 'Resource');
      return;
    }

    await this.fs.moveFile(source, destination);
  }

  async listDirectory(path: string): Promise<readonly IFileEntry[]> {
    if (!this.fs) {
      logger.error('system.notInitialized', 'Resource');
      return [];
    }

    const entries = await this.fs.listDirectory(path);

    return entries.map((entry) => ({
      path: path === '' ? entry.name : `${path}/${entry.name}`,
      name: entry.name,
      kind: entry.kind,
    }));
  }

  async updateResource(id: IResourceIdentifier): Promise<void> {
    await Promise.all(
      this.forEachHook((hook) =>
        Promise.resolve()
          .then(() => hook.onUpdateResource?.(id))
          .catch((error: unknown) => {
            logger.error('resource.hookFailed', String(error));
          }),
      ),
    );
  }

  async dispose(): Promise<void> {
    this.fs = null;
  }
}
