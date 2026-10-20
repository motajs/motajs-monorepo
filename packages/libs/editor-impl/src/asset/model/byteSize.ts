/** 相邻两级单位之间的进制：1024 字节为 1 KB，逐级向上 */
const BYTE_UNIT_STEP = 1024;

/** 单位后缀，按 1024 进制从小到大排列 */
const BYTE_UNITS: readonly string[] = Object.freeze(['B', 'KB', 'MB', 'GB']);

/**
 * 把字节数格式化成人类可读的文件大小
 *
 * 固定 1024 进制、单位后缀固定为 `B` / `KB` / `MB` / `GB`、数字与单位之间一个空格；
 * 不足 1 KB 输出整数字节，其余保留一位小数。非有限数与负数一律按 0 处理，保证总能返回字符串、不抛错。
 * @param byteLength 字节数
 * @returns 形如 `12.3 KB` 的文本
 */
export function formatAssetFileSize(byteLength: number): string {
  if (!Number.isFinite(byteLength) || byteLength <= 0) return '0 B';
  if (byteLength < BYTE_UNIT_STEP) return `${Math.floor(byteLength)} B`;

  let value = byteLength / BYTE_UNIT_STEP;
  let unitIndex = 1;

  while (value >= BYTE_UNIT_STEP && unitIndex < BYTE_UNITS.length - 1) {
    value /= BYTE_UNIT_STEP;
    unitIndex += 1;
  }

  return `${value.toFixed(1)} ${BYTE_UNITS[unitIndex]}`;
}
