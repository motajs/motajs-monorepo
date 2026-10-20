import { describe, expect, it } from 'vitest';
import { formatAssetFileSize } from '../byteSize';

describe('formatAssetFileSize', () => {
  // 0 字节：直接给出 0 B，不出现小数点
  it('0 字节输出 0 B', () => {
    expect(formatAssetFileSize(0)).toBe('0 B');
  });

  // 不足 1 KB：按整数字节输出，单位仍是 B
  it('1023 字节输出 1023 B', () => {
    expect(formatAssetFileSize(1023)).toBe('1023 B');
  });

  // 刚好 1 KB：进位到 KB 并保留一位小数
  it('1024 字节输出 1.0 KB', () => {
    expect(formatAssetFileSize(1024)).toBe('1.0 KB');
  });

  // 12595 字节：约 12.2998 KB，保留一位小数得 12.3 KB
  it('12595 字节输出 12.3 KB', () => {
    expect(formatAssetFileSize(12595)).toBe('12.3 KB');
  });

  // 5 MiB：连续跨过两级单位，落到 MB
  it('5 MiB 输出 5.0 MB', () => {
    expect(formatAssetFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
  });

  // 2 GiB：单位封顶在 GB，不再继续增加后缀
  it('2 GiB 输出 2.0 GB', () => {
    expect(formatAssetFileSize(2 * 1024 * 1024 * 1024)).toBe('2.0 GB');
  });

  // 负数与非有限值：一律按 0 处理，不抛错
  it('负数与非有限值按 0 B 处理', () => {
    expect(formatAssetFileSize(-1)).toBe('0 B');
    expect(formatAssetFileSize(Number.NaN)).toBe('0 B');
    expect(formatAssetFileSize(Number.POSITIVE_INFINITY)).toBe('0 B');
  });
});
