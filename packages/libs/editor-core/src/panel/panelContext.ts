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

  requestResource<T>(id: IResourceIdentifier): Promise<IResource<T> | null> {
    return this.resourceAccess.requestResource<T>(id);
  }

  requestResourceList(type: number): Promise<readonly IResourceIdentifier[]> {
    return this.resourceAccess.requestResourceList(type);
  }

  createResource<T>(id: IResourceIdentifier, content: T): Promise<IResource<T> | null> {
    return this.resourceAccess.createResource<T>(id, content);
  }

  deleteResource(id: IResourceIdentifier): Promise<void> {
    return this.resourceAccess.deleteResource(id);
  }

  addUndoContext(panel: IEditorPanel, context: IUndoContext<unknown>): void {
    this.undoSystem.addUndoContext(panel, context);
  }
}
