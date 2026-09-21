import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
// @ts-expect-error The staging CLI is intentionally a plain Node ESM module.
import { pruneEditorReleases, stageEditorArtifact } from '../../scripts/stage-editor.mjs';

const roots: string[] = [];

async function fixture(app = 'code'): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mota-editor-stage-input-'));
  roots.push(root);
  const files = new Map([
    ['index.html', 'editor'],
    ['runtime.html', 'runtime'],
    ['assets/app.js', app],
  ]);
  for (const [name, content] of files) {
    await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await fs.writeFile(path.join(root, name), content);
  }
  const buildHash = createHash('sha256');
  for (const [name, content] of [...files].sort(([a], [b]) => a.localeCompare(b))) {
    buildHash.update(name).update('\0').update(content).update('\0');
  }
  const buildId = buildHash.digest('hex');
  await fs.writeFile(
    path.join(root, 'editor-manifest.json'),
    JSON.stringify({
      schemaVersion: 2,
      environmentProtocolVersion: 1,
      runtimeProtocolVersion: 2,
      editorVersion: 'test',
      buildId,
      entrypoints: { editor: 'index.html', runtime: 'runtime.html' },
      files: [...files].map(([filePath, content]) => ({
        path: filePath,
        size: Buffer.byteLength(content),
        sha256: createHash('sha256').update(content).digest('hex'),
      })),
    }),
  );
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});
describe('Editor artifact staging', () => {
  it('stages an immutable release and updates the channel idempotently', async () => {
    const input = await fixture();
    const output = await fs.mkdtemp(path.join(os.tmpdir(), 'mota-editor-stage-output-'));
    roots.push(output);
    const first = await stageEditorArtifact(input, output);
    const second = await stageEditorArtifact(input, output);
    expect(second.buildId).toBe(first.buildId);
    expect(JSON.parse(await fs.readFile(path.join(output, 'current.json'), 'utf8'))).toEqual({
      schemaVersion: 1,
      buildId: first.buildId,
    });
    expect(await fs.readFile(path.join(first.destination, 'index.html'), 'utf8')).toBe('editor');
  });

  it('retains the previous release in the channel when a new build is staged', async () => {
    const firstInput = await fixture('first');
    const secondInput = await fixture('second');
    const output = await fs.mkdtemp(path.join(os.tmpdir(), 'mota-editor-stage-output-'));
    roots.push(output);
    const first = await stageEditorArtifact(firstInput, output);
    const second = await stageEditorArtifact(secondInput, output);
    expect(JSON.parse(await fs.readFile(path.join(output, 'current.json'), 'utf8'))).toEqual({
      schemaVersion: 1,
      buildId: second.buildId,
      previousBuildId: first.buildId,
    });
    await expect(fs.access(first.destination)).resolves.toBeUndefined();
    await expect(fs.access(second.destination)).resolves.toBeUndefined();
  });

  it('rejects modified files before changing the channel pointer', async () => {
    const input = await fixture();
    const output = await fs.mkdtemp(path.join(os.tmpdir(), 'mota-editor-stage-output-'));
    roots.push(output);
    await fs.writeFile(path.join(input, 'runtime.html'), 'modified');
    await expect(stageEditorArtifact(input, output)).rejects.toThrow('mismatch');
    await expect(fs.access(path.join(output, 'current.json'))).rejects.toThrow();
  });

  it('prunes only releases outside the current/previous set after the grace period', async () => {
    const output = await fs.mkdtemp(path.join(os.tmpdir(), 'mota-editor-stage-output-'));
    roots.push(output);
    const releases = path.join(output, 'releases');
    const [current, previous, stale, fresh] = ['a', 'b', 'c', 'd'].map((value) => value.repeat(64));
    await Promise.all(
      [current, previous, stale, fresh].map((name) => fs.mkdir(path.join(releases, name), { recursive: true })),
    );
    const now = Date.now();
    await fs.utimes(path.join(releases, stale), new Date(now - 9 * 86_400_000), new Date(now - 9 * 86_400_000));
    await fs.utimes(path.join(releases, fresh), new Date(now - 2 * 86_400_000), new Date(now - 2 * 86_400_000));
    await pruneEditorReleases(output, { buildId: current, previousBuildId: previous }, now);
    await expect(fs.access(path.join(releases, current))).resolves.toBeUndefined();
    await expect(fs.access(path.join(releases, previous))).resolves.toBeUndefined();
    await expect(fs.access(path.join(releases, stale))).rejects.toThrow();
    await expect(fs.access(path.join(releases, fresh))).resolves.toBeUndefined();
  });
});
