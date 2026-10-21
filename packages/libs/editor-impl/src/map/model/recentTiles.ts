// 最近使用图块：只做纯列表运算——过滤、去重、置顶、截断。
// 不读文档、不碰文件；面板负责从项目内约定文件取回原始值，并把目录里存在的编号集合传进来。

/**
 * 判断一个值是否为正整数
 * @param value 待判断的值
 * @returns 是正整数时为 true
 */
function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/**
 * 把任意输入归一化成可用的最近使用列表
 *
 * 输入可能来自被手工改坏的文件：只接受数组，逐项丢掉非正整数与目录里没有的编号，
 * 同一编号只留第一次出现的位置，最后按上限截断。任何非法输入都退化为空数组，不抛错。
 * @param raw 任意原始输入
 * @param knownNumbers 图块目录里存在的编号集合
 * @param limit 条目上限
 * @returns 过滤后的列表；没有可用条目时为空数组
 */
export function normalizeRecentTiles(
  raw: unknown,
  knownNumbers: ReadonlySet<number>,
  limit: number,
): readonly number[] {
  if (!Array.isArray(raw) || limit <= 0) return [];

  const result: number[] = [];
  const seen: Set<number> = new Set();

  for (const item of raw) {
    if (result.length >= limit) break;
    if (!isPositiveInteger(item)) continue;
    if (!knownNumbers.has(item)) continue;
    if (seen.has(item)) continue;

    seen.add(item);
    result.push(item);
  }

  return result;
}

/**
 * 把本次笔画的主图块移到最近使用列表首位
 *
 * 同一编号只留一条：已在列表里时先移除再插到最前；新编号直接插到最前。
 * 非正整数不改变列表（原样返回入参）。
 * @param list 当前列表
 * @param tileNumber 本次笔画的主图块编号
 * @param limit 条目上限
 * @returns 更新后的新列表
 */
export function updateRecentTiles(list: readonly number[], tileNumber: number, limit: number): readonly number[] {
  if (!isPositiveInteger(tileNumber)) return list;
  if (limit <= 0) return [];

  const result: number[] = [tileNumber];
  const seen: Set<number> = new Set(result);

  for (const item of list) {
    if (result.length >= limit) break;
    if (!isPositiveInteger(item) || seen.has(item)) continue;

    seen.add(item);
    result.push(item);
  }

  return result;
}
