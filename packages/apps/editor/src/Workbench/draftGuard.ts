import { persistenceMonitor } from "@/fs/PersistenceMonitor";

const dirtyDraftScopes = new Set<string>();
let suppressNextUnloadWarning = false;

export function setWorkspaceDraftDirty(scope: string, dirty: boolean): void {
  if (dirty) dirtyDraftScopes.add(scope);
  else dirtyDraftScopes.delete(scope);
}

export function hasWorkspaceDrafts(): boolean {
  return dirtyDraftScopes.size > 0;
}

export function suppressNextWorkspaceDraftWarning(): void {
  suppressNextUnloadWarning = true;
}

export function shouldWarnBeforeWorkspaceUnload(): boolean {
  const persistenceUnsafe = persistenceMonitor.hasUnsavedChanges()
    || persistenceMonitor.hasPersistErrors();
  if (suppressNextUnloadWarning) {
    suppressNextUnloadWarning = false;
    return persistenceUnsafe;
  }
  return hasWorkspaceDrafts() || persistenceUnsafe;
}

export function resetWorkspaceDraftGuardForTests(): void {
  dirtyDraftScopes.clear();
  suppressNextUnloadWarning = false;
}
