import {
  IFileEntry,
  IResource,
  IResourceAccess,
  IResourceIdentifier,
  PendingChangeListener,
  ResourceContent,
} from '../resource';
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

  requestResource(id: IResourceIdentifier): Promise<IResource | null> {
    return this.resourceAccess.requestResource(id);
  }

  createResource(id: IResourceIdentifier, content: ResourceContent): Promise<IResource | null> {
    return this.resourceAccess.createResource(id, content);
  }

  deleteResource(id: IResourceIdentifier): Promise<void> {
    return this.resourceAccess.deleteResource(id);
  }

  moveResource(source: IResourceIdentifier, destination: IResourceIdentifier): Promise<void> {
    return this.resourceAccess.moveResource(source, destination);
  }

  listDirectory(path: string): Promise<readonly IFileEntry[]> {
    return this.resourceAccess.listDirectory(path);
  }

  flushResource(id: IResourceIdentifier): Promise<void> {
    return this.resourceAccess.flushContent(id);
  }

  discardPendingResource(id: IResourceIdentifier): void {
    this.resourceAccess.discardPendingContent(id);
  }

  watchPendingChange(listener: PendingChangeListener): () => void {
    return this.resourceAccess.watchPendingChange(listener);
  }

  addUndoContext(panel: IEditorPanel, context: IUndoContext<unknown>): void {
    this.undoSystem.addUndoContext(panel, context);
  }
}
