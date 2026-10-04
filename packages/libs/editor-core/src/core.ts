import { IPanelSystem, PanelSystem } from './panel';
import { IResourceSystem, ResourceSystem } from './resource';
import { IEditorCore, IEditorCoreInjection } from './types';
import { IUndoSystem, UndoSystem } from './undo';

export class EditorCore implements IEditorCore {
  readonly version: string = '0.1.0';

  readonly undoSystem: IUndoSystem;
  readonly resourceSystem: IResourceSystem;
  readonly panelSystem: IPanelSystem;

  constructor() {
    this.undoSystem = new UndoSystem();
    this.resourceSystem = new ResourceSystem();
    this.panelSystem = new PanelSystem(this.undoSystem, this.resourceSystem);
  }

  async initialize(injection: IEditorCoreInjection): Promise<void> {
    await Promise.all([this.undoSystem.initialize(injection), this.resourceSystem.initialize(injection)]);
    await this.panelSystem.initialize(injection);
  }

  async dispose(): Promise<void> {
    await this.panelSystem.dispose();
    this.resourceSystem.dispose();
    this.undoSystem.dispose();
  }
}
