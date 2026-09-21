import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  calculateEditorBuildId,
  createEditorArtifactFiles,
  createEditorArtifactReport,
  editorArtifactPlugin,
} from './editor-artifact-plugin';

const roots: string[] = [];

async function artifact(files: Array<[string, string]>): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'editor-build-id-'));
  roots.push(root);
  for (const [name, content] of files) {
    await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await fs.writeFile(path.join(root, name), content);
  }
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe('editor artifact build id', () => {
  it('separates development assets from production artifact generation', () => {
    const plugins = editorArtifactPlugin('test');
    expect(plugins.map(({ name, apply }) => [name, apply])).toEqual([
      ['mota-editor-dev-assets', 'serve'],
      ['mota-editor-artifact', 'build'],
    ]);
  });

  it('is stable across creation order and ignores the manifest itself', async () => {
    const first = await artifact([
      ['index.html', 'editor'],
      ['assets/app.js', 'code'],
    ]);
    const second = await artifact([
      ['assets/app.js', 'code'],
      ['index.html', 'editor'],
      ['editor-manifest.json', 'old'],
    ]);
    expect(await calculateEditorBuildId(first)).toBe(await calculateEditorBuildId(second));
  });

  it('changes when artifact content changes', async () => {
    const first = await artifact([['index.html', 'one']]);
    const second = await artifact([['index.html', 'two']]);
    expect(await calculateEditorBuildId(first)).not.toBe(await calculateEditorBuildId(second));
  });

  it('describes every artifact file with deterministic size and content hash', async () => {
    const root = await artifact([
      ['index.html', 'editor'],
      ['assets/app.js', 'code'],
      ['editor-manifest.json', 'old'],
    ]);
    expect(await createEditorArtifactFiles(root)).toEqual([
      {
        path: 'assets/app.js',
        size: 4,
        sha256: '5694d08a2e53ffcae0c3103e5ad6f6076abd960eb1f8a56577040bc1028f702b',
      },
      {
        path: 'index.html',
        size: 6,
        sha256: '1553cc62ff246044c683a61e203e65541990e7fcd4af9443d22b9557ecc9ac54',
      },
    ]);
  });

  it('reports raw, gzip and brotli release sizes', async () => {
    const root = await artifact([
      ['index.html', 'editor'],
      ['assets/app.js', 'code'],
    ]);
    const files = await createEditorArtifactFiles(root);
    const report = await createEditorArtifactReport(root, files);
    expect(report).toMatchObject({ files: 2, rawBytes: 10 });
    expect(report.gzipBytes).toBeGreaterThan(0);
    expect(report.brotliBytes).toBeGreaterThan(0);
  });

  it('writes a manifest whose protocol constants are pinned to their current literals', async () => {
    // 驱动真实的 `mota-editor-artifact` 插件写出 manifest，而不是读源码字面量：
    // 伪造一个满足 `validateEditorArtifact` 的最小产物（恰好一个标准 ts.worker，
    // 没有 css/html worker），让 `closeBundle` 真正跑一遍。
    const root = await artifact([
      ['index.html', 'editor'],
      ['assets/ts.worker-abc.js', ''],
    ]);
    const plugin = editorArtifactPlugin('test').find(({ name }) => name === 'mota-editor-artifact')!;
    plugin.configResolved?.call(plugin, { build: { outDir: root } } as never);
    await plugin.closeBundle?.call(plugin);
    const manifest = JSON.parse(await fs.readFile(path.join(root, 'editor-manifest.json'), 'utf8')) as {
      schemaVersion: number;
      environmentProtocolVersion: number;
      runtimeProtocolVersion: number;
      entrypoints: unknown;
    };
    expect(manifest.schemaVersion).toBe(2);
    expect(manifest.environmentProtocolVersion).toBe(1);
    // manifest 的 runtimeProtocolVersion(3) 与 src/runtime/protocol.ts 的
    // RUNTIME_PROTOCOL_VERSION(4) 不一致：这是本期有意保留、不得「修复」的既有行为。
    // 两个值各自按自己的字面量断言，绝不断言 3 !== 4，也不断言两者的关系。
    expect(manifest.runtimeProtocolVersion).toBe(3);
    expect(manifest.entrypoints).toEqual({ editor: 'index.html', runtime: 'runtime.html' });
  }, 30_000);
});
