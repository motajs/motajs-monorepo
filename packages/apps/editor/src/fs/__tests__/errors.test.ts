import { describe, expect, it } from 'vitest';
import { isFileNotFoundError } from '../errors';

describe('isFileNotFoundError', () => {
  it.each([
    'HTTP 404: file-not-found: File not found: project/floors/sample0.js',
    'error: File not found',
    'ENOENT: no such file or directory',
  ])('识别真实文件缺失: %s', (message) => {
    expect(isFileNotFoundError(new Error(message))).toBe(true);
  });

  it.each([
    'HTTP 404: project-not-found: Project not found [project/data.js]',
    'HTTP 403: project-permission-denied: Project access denied',
    'tilesetCatalog not found',
  ])('不把工程或派生资源错误当作文件缺失: %s', (message) => {
    expect(isFileNotFoundError(new Error(message))).toBe(false);
  });

  it('优先使用结构化错误码', () => {
    const fileError = Object.assign(new Error('missing'), { code: 'file-not-found' });
    const projectError = Object.assign(new Error('not found'), { code: 'project-not-found' });

    expect(isFileNotFoundError(fileError)).toBe(true);
    expect(isFileNotFoundError(projectError)).toBe(false);
  });
});
