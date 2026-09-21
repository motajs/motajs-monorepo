import { beforeEach, describe, expect, it, vi } from 'vitest';

const projectMocks = vi.hoisted(() => ({ accessProjectById: vi.fn() }));
const releaseMocks = vi.hoisted(() => ({
  resolveEditorRelease: vi.fn(),
  getEditorReleaseManager: vi.fn(),
}));
vi.mock('./project', () => projectMocks);
vi.mock('./editorRelease', () => releaseMocks);

import { createEditorShell, serveEditorUpdateStatus, serveProjectEditor } from './editorHost';

const scope = new URL('https://example.test/deploy/');
const buildId = 'a'.repeat(64);
const releaseRoot = new URL(`static/editor/releases/${buildId}/`, scope);
const html =
  '<!doctype html><html><head></head><body><script id="mota-editor-environment" type="application/json">{}</script></body></html>';

describe('editor host', () => {
  const stat = vi.fn();
  const getUpdateState = vi.fn();
  const checkForUpdates = vi.fn();
  const activateCandidate = vi.fn();

  beforeEach(() => {
    stat.mockResolvedValue({ isFile: () => true });
    projectMocks.accessProjectById.mockResolvedValue({ status: 'ready', fs: { promises: { stat } } });
    releaseMocks.resolveEditorRelease.mockResolvedValue({
      html,
      releaseRoot,
      source: 'network',
      manifest: {
        buildId,
        editorVersion: '2.0.0',
        entrypoints: { runtime: 'runtime.html' },
      },
    });
    getUpdateState.mockResolvedValue({
      protocolVersion: 2,
      status: 'ready',
      launch: { buildId, version: '2.0.0' },
    });
    checkForUpdates.mockResolvedValue(undefined);
    activateCandidate.mockResolvedValue(undefined);
    releaseMocks.getEditorReleaseManager.mockReturnValue({ getUpdateState, checkForUpdates, activateCandidate });
  });

  it('injects a scoped base and project-specific blind environment', () => {
    const output = createEditorShell({
      html: '<html><head></head><body><script id="mota-editor-environment" type="application/json">{}</script></body></html>',
      scopeUrl: scope,
      releaseRoot,
      runtimeEntrypoint: 'runtime.html',
      projectId: 1055,
      docsEndpoint: 'https://example.test/deploy/service/1055/preview/_docs/',
      release: { buildId, version: '2.0.0' },
    });
    expect(output).toContain(`<base href="https://example.test/deploy/static/editor/releases/${buildId}/">`);
    expect(output).toContain('"fs":"https://example.test/deploy/service/1055/api/fs/"');
    expect(output).toContain(`"runtime":"https://example.test/deploy/static/editor/releases/${buildId}/runtime.html"`);
    expect(output).toContain('"preview":"https://example.test/deploy/service/1055/preview/"');
    expect(output).toContain('"docs":"https://example.test/deploy/service/1055/preview/_docs/"');
    expect(output).toContain(`"release":{"buildId":"${buildId}","version":"2.0.0"}`);
    expect(output).toContain('"update":"https://example.test/deploy/service/1055/api/editor-update/"');
    expect(output.match(/mota-editor-environment/g)).toHaveLength(1);
  });

  it('omits the docs capability when the project has no documentation entrypoint', async () => {
    stat.mockRejectedValueOnce(Object.assign(new Error('missing'), { code: 'ENOENT' }));
    const request = new Request('https://example.test/deploy/service/1055/editor/');
    const response = await serveProjectEditor(
      request,
      scope,
      1055,
      'https://example.test/deploy/service/1055/project/',
    );
    expect(response.status).toBe(200);
    expect(await response.text()).not.toContain('"docs":');
  });

  it('serves an uncached shell only when project access is ready', async () => {
    const request = new Request('https://example.test/deploy/service/1055/editor/');
    const response = await serveProjectEditor(
      request,
      scope,
      1055,
      'https://example.test/deploy/service/1055/project/',
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.text()).toContain('mota-editor-environment');

    projectMocks.accessProjectById.mockResolvedValueOnce({ status: 'permission-required' });
    const denied = await serveProjectEditor(request, scope, 1055, 'https://example.test/deploy/service/1055/project/');
    expect(denied.status).toBe(302);
    expect(denied.headers.get('location')).toBe('https://example.test/deploy/service/1055/project/?reason=permission');
  });

  it('reports the available release without exposing host internals', async () => {
    const request = new Request('https://example.test/deploy/service/1055/api/editor-update/');
    const response = await serveEditorUpdateStatus(request, scope);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({
      protocolVersion: 2,
      status: 'ready',
      launch: { buildId, version: '2.0.0' },
    });

    const background: Promise<unknown>[] = [];
    const post = new Request(request.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'check' }),
    });
    expect((await serveEditorUpdateStatus(post, scope, (task) => background.push(task))).status).toBe(200);
    await Promise.all(background);
    expect(checkForUpdates).toHaveBeenCalledWith(false);
  });
});
