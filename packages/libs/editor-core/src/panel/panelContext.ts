import { IResource, IResourceAccess, IResourceIdentifier } from '../resource';
import { IUndoContext, IUndoSystem } from '../undo';
import { IEditorPanel, IEditorPanelContext } from './types';

export class PanelContext implements IEditorPanelContext {
  /** 面板侧资源读写口 */
  private readonly resourceAccess: IResourceAccess;
  /** 撤回系统 */
  private readonly undoSystem: IUndoSystem;

  constructor(resourceAccess: IResourceAccess, undoSystem: IUndoSystem) {
    this.resourceAccess = resourceAccess;
    this.undoSystem = undoSystem;
  }

  async requestResource<T>(id: IResourceIdentifier): Promise<IResource<T> | null> {
    return this.resourceAccess.requestResource<T>(id);
  }

  async requestResourceList(type: number): Promise<readonly IResourceIdentifier[]> {
    return this.resourceAccess.requestResourceList(type);
  }

  async createResource<T>(id: IResourceIdentifier, content: T): Promise<IResource<T>> {
    return this.resourceAccess.createResource<T>(id, content);
  }

  async deleteResource(id: IResourceIdentifier): Promise<void> {
    return this.resourceAccess.deleteResource(id);
  }

  addUndoContext(panel: IEditorPanel, context: IUndoContext<unknown>): void {
    this.undoSystem.addUndoContext(panel, context);
  }
}
