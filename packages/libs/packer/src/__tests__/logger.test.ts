import { describe, it, expect, vi } from 'vitest';
import { Logger, formatSize, formatTimestamp } from '../logger.js';

describe('Logger', () => {
  it('should output log messages', () => {
    const messages: string[] = [];
    const logger = new Logger((msg) => messages.push(msg));

    logger.log('test message');

    expect(messages).toContain('test message');
  });

  it('should output success messages with prefix', () => {
    const messages: string[] = [];
    const logger = new Logger((msg) => messages.push(msg));

    logger.success('build complete');

    expect(messages[0]).toContain('======>');
    expect(messages[0]).toContain('build complete');
  });

  it('should output warn messages with prefix', () => {
    const messages: string[] = [];
    const logger = new Logger((msg) => messages.push(msg));

    logger.warn('warning message');

    expect(messages[0]).toContain('⚠');
    expect(messages[0]).toContain('warning message');
  });

  it('should output error messages with prefix', () => {
    const messages: string[] = [];
    const logger = new Logger((msg) => messages.push(msg));

    logger.error('error message');

    expect(messages[0]).toContain('✖');
    expect(messages[0]).toContain('error message');
  });

  it('should manage indentation with group/groupEnd', () => {
    const messages: string[] = [];
    const logger = new Logger((msg) => messages.push(msg));

    logger.group('抽取源信息');
    logger.log('抽取 main.js');
    logger.log('抽取 project/data.js');
    logger.groupEnd();
    logger.success('所有核心文件已压缩');

    expect(messages[0]).toBe('[抽取源信息]');
    expect(messages[1]).toBe('  抽取 main.js');
    expect(messages[2]).toBe('  抽取 project/data.js');
    expect(messages[3]).toBe('======> 所有核心文件已压缩');
  });

  it('should handle nested groups', () => {
    const messages: string[] = [];
    const logger = new Logger((msg) => messages.push(msg));

    logger.group('Level 1');
    logger.group('Level 2');
    logger.log('nested message');
    logger.groupEnd();
    logger.log('back to level 1');
    logger.groupEnd();
    logger.log('root level');

    expect(messages[0]).toBe('[Level 1]');
    expect(messages[1]).toBe('  [Level 2]');
    expect(messages[2]).toBe('    nested message');
    expect(messages[3]).toBe('  back to level 1');
    expect(messages[4]).toBe('root level');
  });

  it('should not go below zero depth', () => {
    const messages: string[] = [];
    const logger = new Logger((msg) => messages.push(msg));

    logger.groupEnd();
    logger.groupEnd();
    logger.log('still at root');

    expect(messages[0]).toBe('still at root');
  });

  it('should use console.log by default', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = new Logger();

    logger.log('default output');

    expect(consoleSpy).toHaveBeenCalledWith('default output');
    consoleSpy.mockRestore();
  });
});

describe('formatSize', () => {
  it('should format bytes', () => {
    expect(formatSize(0)).toBe('0B');
    expect(formatSize(512)).toBe('512B');
    expect(formatSize(1023)).toBe('1023B');
  });

  it('should format kilobytes', () => {
    expect(formatSize(1024)).toBe('1.00KB');
    expect(formatSize(1536)).toBe('1.50KB');
    expect(formatSize(10240)).toBe('10.00KB');
  });

  it('should format megabytes', () => {
    expect(formatSize(1024 * 1024)).toBe('1.00MB');
    expect(formatSize(1.5 * 1024 * 1024)).toBe('1.50MB');
    expect(formatSize(256 * 1024)).toBe('256.00KB');
  });

  it('should format gigabytes', () => {
    expect(formatSize(1024 * 1024 * 1024)).toBe('1.00GB');
    expect(formatSize(2.5 * 1024 * 1024 * 1024)).toBe('2.50GB');
  });

  it('should handle negative values', () => {
    expect(formatSize(-100)).toBe('0B');
  });
});

describe('formatTimestamp', () => {
  it('should return timestamp in correct format', () => {
    const timestamp = formatTimestamp();

    // 格式应为 [YYYY-MM-DD HH:MM:SS]
    expect(timestamp).toMatch(/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]$/);
  });

  it('should contain current date components', () => {
    const now = new Date();
    const timestamp = formatTimestamp();

    expect(timestamp).toContain(now.getFullYear().toString());
  });
});
