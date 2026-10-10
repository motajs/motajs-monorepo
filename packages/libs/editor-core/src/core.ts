import { logger } from './log';
import { IResourceSystemAccess, ResourceSystem } from './resource';
import { IShellSystem, ShellSystem } from './shell';
import { IEditorCore, IEditorCoreInjection } from './types';
import { IUndoSystem, UndoSystem } from './undo';

export class EditorCore implements IEditorCore {
  readonly version: string = '0.1.0';

  readonly undoSystem: IUndoSystem;
  readonly resourceSystem: IResourceSystemAccess;
  readonly shellSystem: IShellSystem;

  /** 是否已完成初始化，保证注入只生效一次 */
  private initialized: boolean = false;
  /** 是否已释放，释放后拒绝再次初始化 */
  private disposed: boolean = false;

  constructor() {
    this.undoSystem = new UndoSystem();
    this.resourceSystem = new ResourceSystem();
    this.shellSystem = new ShellSystem(this.undoSystem, this.resourceSystem);
  }

  async initialize(injection: IEditorCoreInjection): Promise<void> {
    if (this.disposed) {
      logger.error('core.initializeAfterDispose');
      return;
    }

    if (this.initialized) {
      logger.warn('core.duplicateInitialize');
      return;
    }

    this.initialized = true;

    const arr = [this.undoSystem.initialize(injection), this.resourceSystem.initialize(injection)];
    await Promise.all(arr);
    await this.shellSystem.initialize(injection);
  }

  async dispose(): Promise<void> {
    await this.shellSystem.dispose();
    await this.resourceSystem.dispose();
    await this.undoSystem.dispose();
    this.disposed = true;
  }
}
