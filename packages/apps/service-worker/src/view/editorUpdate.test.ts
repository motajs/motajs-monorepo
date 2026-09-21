import { describe, expect, it } from 'vitest';
import { editorReleaseLabel, formatBytes, parseEditorUpdateState, stagingPercent } from './editorUpdate';

describe('project Editor update state', () => {
  it('parses live staging progress', () => {
    const state = parseEditorUpdateState({
      protocolVersion: 2,
      status: 'ready',
      launch: { buildId: 'a'.repeat(64), version: '1.0.0' },
      staging: {
        buildId: 'b'.repeat(64),
        version: '1.1.0',
        completedFiles: 3,
        totalFiles: 10,
        completedBytes: 400,
        totalBytes: 1000,
      },
    });
    expect(state.staging?.version).toBe('1.1.0');
    expect(stagingPercent(state.staging!)).toBe(40);
  });

  it('uses the build identity instead of displaying the placeholder version', () => {
    expect(editorReleaseLabel({ buildId: '1234567890abcdef', version: '0.0.0' })).toBe('Editor 构建 1234567890ab');
    expect(editorReleaseLabel({ buildId: '1234', version: '1.2.0' })).toBe('Editor 1.2.0');
  });

  it('formats cache byte counts', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(2 * 1024 ** 2)).toBe('2.0 MB');
  });
});
