export interface BlocklyViewport {
  x: number;
  y: number;
  scale: number;
}

export interface BlocklyEditorSessionState {
  contextId: string;
  entryType: string;
  sourceText: string;
  sourceRevision: number;
  workspaceRevision: number;
  parsedSourceRevision: number;
  viewport: BlocklyViewport;
  selectedBlockId?: string;
}

const DEFAULT_VIEWPORT: BlocklyViewport = { x: 0, y: 0, scale: 1 };

export class BlocklyEditorSession {
  private state: BlocklyEditorSessionState;

  constructor(contextId: string, entryType: string, sourceText: string) {
    this.state = {
      contextId,
      entryType,
      sourceText,
      sourceRevision: 0,
      workspaceRevision: 0,
      parsedSourceRevision: 0,
      viewport: { ...DEFAULT_VIEWPORT },
    };
  }

  snapshot(): BlocklyEditorSessionState {
    return structuredClone(this.state);
  }

  editSource(sourceText: string): void {
    if (sourceText === this.state.sourceText) return;
    this.state.sourceText = sourceText;
    this.state.sourceRevision += 1;
  }

  parseSucceeded(sourceText: string): void {
    this.state.sourceText = sourceText;
    this.state.parsedSourceRevision = this.state.sourceRevision;
    this.state.workspaceRevision += 1;
  }

  workspaceChanged(sourceText: string): boolean {
    this.state.workspaceRevision += 1;
    if (this.hasUnparsedSource()) return false;
    this.state.sourceText = sourceText;
    this.state.sourceRevision += 1;
    this.state.parsedSourceRevision = this.state.sourceRevision;
    return true;
  }

  hasUnparsedSource(): boolean {
    return this.state.sourceRevision !== this.state.parsedSourceRevision;
  }

  setViewport(viewport: BlocklyViewport, selectedBlockId?: string): void {
    this.state.viewport = { ...viewport };
    this.state.selectedBlockId = selectedBlockId;
  }
}

export class BlocklySessionStore {
  private readonly viewports = new Map<string, Pick<BlocklyEditorSessionState, 'viewport' | 'selectedBlockId'>>();

  restore(session: BlocklyEditorSession): void {
    const saved = this.viewports.get(this.key(session.snapshot()));
    if (saved) session.setViewport(saved.viewport, saved.selectedBlockId);
  }

  save(session: BlocklyEditorSession): void {
    const state = session.snapshot();
    this.viewports.set(this.key(state), { viewport: state.viewport, selectedBlockId: state.selectedBlockId });
  }

  private key(state: Pick<BlocklyEditorSessionState, 'contextId' | 'entryType'>): string {
    return `${state.contextId}:${state.entryType}`;
  }
}

export const blocklySessionStore = new BlocklySessionStore();
