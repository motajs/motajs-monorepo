import { IResourceIdentifier, IResourceSystemHooks } from '../resource';
import { IEditorPanel, IEditorPanelContext } from './types';

export class EditorPanelHooks implements IResourceSystemHooks {
  /** 钩子所属的面板 */
  private readonly panel: IEditorPanel;
  /** 面板侧上下文，用于重新申请资源 */
  private readonly context: IEditorPanelContext;

  constructor(panel: IEditorPanel, context: IEditorPanelContext) {
    this.panel = panel;
    this.context = context;
  }

  async onUpdateResource(id: IResourceIdentifier): Promise<void> {
    const resource = await this.context.requestResource(id);

    if (resource) {
      await this.panel.onUpdateResource(id, await resource.request());
    }
  }

  async onUpdateResourceList(type: number): Promise<void> {
    await this.panel.onUpdateResourceList(type, await this.context.requestResourceList(type));
  }
}
