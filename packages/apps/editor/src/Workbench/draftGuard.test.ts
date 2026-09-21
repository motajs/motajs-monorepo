import { afterEach, describe, expect, it } from 'vitest';
import { persistenceMonitor } from '@/fs/PersistenceMonitor';
import {
  hasWorkspaceDrafts,
  resetWorkspaceDraftGuardForTests,
  setWorkspaceDraftDirty,
  shouldWarnBeforeWorkspaceUnload,
  suppressNextWorkspaceDraftWarning,
} from './draftGuard';

afterEach(() => {
  resetWorkspaceDraftGuardForTests();
  persistenceMonitor.resetForTests();
});

describe('workspace draft guard', () => {
  it('keeps dirty state independently for hidden workspaces', () => {
    setWorkspaceDraftDirty('scripts', true);
    setWorkspaceDraftDirty('common-events', false);
    expect(hasWorkspaceDrafts()).toBe(true);
    setWorkspaceDraftDirty('common-events', true);
    setWorkspaceDraftDirty('scripts', false);
    expect(hasWorkspaceDrafts()).toBe(true);
    setWorkspaceDraftDirty('common-events', false);
    expect(hasWorkspaceDrafts()).toBe(false);
  });

  it('can suppress the draft warning for one confirmed reload', () => {
    setWorkspaceDraftDirty('scripts', true);
    suppressNextWorkspaceDraftWarning();
    expect(shouldWarnBeforeWorkspaceUnload()).toBe(false);
    expect(shouldWarnBeforeWorkspaceUnload()).toBe(true);
  });

  it('warns while persistence is pending', async () => {
    let release!: () => void;
    persistenceMonitor.schedule('project/data.js', {
      kind: 'write',
      execute: () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    });

    expect(shouldWarnBeforeWorkspaceUnload()).toBe(true);
    release();
    await persistenceMonitor.whenQuiescent();
    expect(shouldWarnBeforeWorkspaceUnload()).toBe(false);
  });

  it('warns after persistence fails', async () => {
    persistenceMonitor.schedule('project/data.js', {
      kind: 'write',
      execute: async () => {
        throw new Error('disk unavailable');
      },
    });
    await persistenceMonitor.whenQuiescent();
    expect(shouldWarnBeforeWorkspaceUnload()).toBe(true);
  });
});
