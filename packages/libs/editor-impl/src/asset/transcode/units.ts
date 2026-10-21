// 界面边界的单位换算：弹窗用 kbps / kHz 表达，内部转码契约仍收 bps / Hz，换算只发生在这里。

/** 千比特每秒与比特每秒之间的倍数 */
const BITS_PER_KILO = 1000;

/** 千赫兹与赫兹之间的倍数 */
const HERTZ_PER_KILO = 1000;

/**
 * 把小单位数值乘以倍数并四舍五入到整数
 * @param value 待换算的数值
 * @param scale 换算倍数
 * @returns 换算后的整数；非有限值或负数一律按 0 处理
 */
function multiplyAndRound(value: number, scale: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;

  return Math.round(value * scale);
}

/**
 * 把大单位数值除以倍数
 * @param value 待换算的数值
 * @param scale 换算倍数
 * @returns 换算后的数值；非有限值或负数一律按 0 处理
 */
function divideBy(value: number, scale: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;

  return value / scale;
}

/**
 * 把 kbps 换算成内部契约要的 bps
 * @param kbps 千比特每秒
 * @returns 比特每秒；非有限值或负数按 0 处理
 */
export function kbpsToBps(kbps: number): number {
  return multiplyAndRound(kbps, BITS_PER_KILO);
}

/**
 * 把 kHz 换算成内部契约要的 Hz
 * @param khz 千赫兹；44.1 这类小数按四舍五入处理
 * @returns 赫兹；非有限值或负数按 0 处理
 */
export function khzToHz(khz: number): number {
  return multiplyAndRound(khz, HERTZ_PER_KILO);
}

/**
 * 把内部契约的 bps 换算成界面上的 kbps
 * @param bps 比特每秒
 * @returns 千比特每秒；非有限值或负数按 0 处理
 */
export function bpsToKbps(bps: number): number {
  return divideBy(bps, BITS_PER_KILO);
}

/**
 * 把内部契约的 Hz 换算成界面上的 kHz
 * @param hz 赫兹
 * @returns 千赫兹；非有限值或负数按 0 处理
 */
export function hzToKHz(hz: number): number {
  return divideBy(hz, HERTZ_PER_KILO);
}
