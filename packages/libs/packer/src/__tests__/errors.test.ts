import { describe, it, expect } from 'vitest';
import {
  MotaBuilderError,
  ErrorCode,
  createError,
  createZipNotFoundError,
  createZipInvalidError,
  createZipCorruptedError,
  createRootNotFoundError,
  createConfigMissingError,
  createConfigInvalidError,
  createMinifyFailedError,
  createResourceTooLargeError,
  createImageProcessFailedError,
  createOutputFailedError,
} from '../errors';

describe('MotaBuilderError', () => {
  it('should create error with correct properties', () => {
    const error = new MotaBuilderError('测试错误', ErrorCode.ZIP_NOT_FOUND, { path: '/test.zip' });

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(MotaBuilderError);
    expect(error.name).toBe('MotaBuilderError');
    expect(error.message).toBe('测试错误');
    expect(error.code).toBe(ErrorCode.ZIP_NOT_FOUND);
    expect(error.details).toEqual({ path: '/test.zip' });
  });

  it('should work without details', () => {
    const error = new MotaBuilderError('简单错误', ErrorCode.ROOT_NOT_FOUND);

    expect(error.message).toBe('简单错误');
    expect(error.code).toBe(ErrorCode.ROOT_NOT_FOUND);
    expect(error.details).toBeUndefined();
  });
});

describe('createError', () => {
  it('should format error message with parameters', () => {
    const error = createError(ErrorCode.ZIP_NOT_FOUND, { path: '/test/game.zip' });

    expect(error.message).toBe('压缩文件不存在：/test/game.zip');
    expect(error.code).toBe(ErrorCode.ZIP_NOT_FOUND);
  });

  it('should handle missing parameters gracefully', () => {
    const error = createError(ErrorCode.CONFIG_INVALID, { file: 'main.js' });

    expect(error.message).toBe('配置文件格式错误：main.js，{reason}');
    expect(error.code).toBe(ErrorCode.CONFIG_INVALID);
  });

  it('should work without parameters', () => {
    const error = createError(ErrorCode.ROOT_NOT_FOUND);

    expect(error.message).toBe('找不到游戏根目录（缺少 main.js）');
    expect(error.code).toBe(ErrorCode.ROOT_NOT_FOUND);
  });
});

describe('convenience error creators', () => {
  it('should create ZIP not found error', () => {
    const error = createZipNotFoundError('/path/to/game.zip');

    expect(error.message).toBe('压缩文件不存在：/path/to/game.zip');
    expect(error.code).toBe(ErrorCode.ZIP_NOT_FOUND);
  });

  it('should create ZIP invalid error', () => {
    const error = createZipInvalidError('/path/to/invalid.zip');

    expect(error.message).toBe('不是有效的 ZIP 文件：/path/to/invalid.zip');
    expect(error.code).toBe(ErrorCode.ZIP_INVALID);
  });

  it('should create ZIP corrupted error', () => {
    const error = createZipCorruptedError('/path/to/corrupted.zip');

    expect(error.message).toBe('ZIP 文件已损坏：/path/to/corrupted.zip');
    expect(error.code).toBe(ErrorCode.ZIP_CORRUPTED);
  });

  it('should create root not found error', () => {
    const error = createRootNotFoundError();

    expect(error.message).toBe('找不到游戏根目录（缺少 main.js）');
    expect(error.code).toBe(ErrorCode.ROOT_NOT_FOUND);
  });

  it('should create config missing error', () => {
    const error = createConfigMissingError('data.js');

    expect(error.message).toBe('配置文件缺失：data.js');
    expect(error.code).toBe(ErrorCode.CONFIG_MISSING);
  });

  it('should create config invalid error', () => {
    const error = createConfigInvalidError('main.js', '语法错误');

    expect(error.message).toBe('配置文件格式错误：main.js，语法错误');
    expect(error.code).toBe(ErrorCode.CONFIG_INVALID);
  });

  it('should create minify failed error', () => {
    const error = createMinifyFailedError('project.js', '未定义的变量');

    expect(error.message).toBe('JS 压缩失败：project.js，未定义的变量');
    expect(error.code).toBe(ErrorCode.MINIFY_FAILED);
  });

  it('should create resource too large error', () => {
    const error = createResourceTooLargeError('images.zip', '10MB');

    expect(error.message).toBe('资源文件过大：images.zip（10MB），请启用分块压缩');
    expect(error.code).toBe(ErrorCode.RESOURCE_TOO_LARGE);
  });

  it('should create image process failed error', () => {
    const error = createImageProcessFailedError('tileset.png', '不支持的格式');

    expect(error.message).toBe('图片处理失败：tileset.png，不支持的格式');
    expect(error.code).toBe(ErrorCode.IMAGE_PROCESS_FAILED);
  });

  it('should create output failed error', () => {
    const error = createOutputFailedError('磁盘空间不足');

    expect(error.message).toBe('输出失败：磁盘空间不足');
    expect(error.code).toBe(ErrorCode.OUTPUT_FAILED);
  });
});

describe('ErrorCode enum', () => {
  it('should have all required error codes', () => {
    const expectedCodes = [
      'ZIP_NOT_FOUND',
      'ZIP_INVALID',
      'ZIP_CORRUPTED',
      'ROOT_NOT_FOUND',
      'CONFIG_MISSING',
      'CONFIG_INVALID',
      'MINIFY_FAILED',
      'RESOURCE_TOO_LARGE',
      'IMAGE_PROCESS_FAILED',
      'OUTPUT_FAILED',
    ];

    expectedCodes.forEach((code) => {
      expect(ErrorCode[code as keyof typeof ErrorCode]).toBeDefined();
    });
  });
});
