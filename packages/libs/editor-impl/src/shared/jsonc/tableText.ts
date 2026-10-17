import JSON5 from 'json5';

// `.jsonc`（含 `.schema.jsonc`）可带一段系统前缀注释块，由精确这一行终止：
// `// --- SYSTEM PREFIX END --- //`。该行及其之前的全部文本即系统前缀，其后是严格 JSON 正文；
// 完全没有注释即合规——标记行不是必需的。解析按内容判定，不看扩展名（D-08）。

/** `.jsonc` 系统前缀注释块的结束标记行：该行及其之前的全部文本即系统前缀 */
export const SYSTEM_PREFIX_END_MARKER = '// --- SYSTEM PREFIX END --- //';

/** 表格文本解析的三种结论 */
export const enum TableTextParseStatus {
  /** 合规：可直接打开，可能带系统前缀 */
  Conforming,
  /** 非合规：含注释或尾逗号，需先确认剥离注释才可打开 */
  NeedsCommentStrip,
  /** 无效：严格与宽松解析都失败 */
  Invalid,
}

export interface ITableTextParseResult {
  /** 解析结论 */
  readonly status: TableTextParseStatus;
  /** 记住的系统前缀原文，供写回时逐字还原；无前缀（含非合规 / 无效）时为 `''` */
  readonly prefix: string;
  /** 解析出的数据；`Invalid` 时缺省 */
  readonly value?: unknown;
}

/** 一次解析尝试的结果：成功标志与解析值 */
interface ITextParseAttempt {
  /** 是否解析成功 */
  readonly ok: boolean;
  /** 解析出的值；失败时缺省 */
  readonly value?: unknown;
}

/**
 * 尝试对一段文本做严格 JSON 解析
 * @param text 待解析文本
 * @returns 成功标志与解析值；失败时不抛穿
 */
function attemptStrict(text: string): ITextParseAttempt {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

/**
 * 尝试对一段文本做 json5 宽松解析（允许注释与尾逗号）
 * @param text 待解析文本
 * @returns 成功标志与解析值；失败时不抛穿
 */
function attemptLenient(text: string): ITextParseAttempt {
  try {
    return { ok: true, value: JSON5.parse(text) };
  } catch {
    return { ok: false };
  }
}

/**
 * 从第一处标记行拆出系统前缀：含标记行及其之前的全部文本与紧随的换行，逐字保留
 * @param text 原始文本
 * @param markerIndex 标记行在文本中的起始下标
 * @returns 系统前缀原文
 */
function extractSystemPrefix(text: string, markerIndex: number): string {
  const afterMarker = markerIndex + SYSTEM_PREFIX_END_MARKER.length;

  if (text.startsWith('\r\n', afterMarker)) return text.slice(0, afterMarker + 2);
  if (text.startsWith('\n', afterMarker)) return text.slice(0, afterMarker + 1);

  return text.slice(0, afterMarker);
}

/**
 * 按项目约定解析表格 / schema 文本：整段严格 JSON → 标记行拆分后正文严格解析 → json5 宽松回退
 * @param text 资源原文
 * @returns 解析结果：合规（可能带系统前缀） / 需剥离注释 / 无效
 */
export function parseTableText(text: string): ITableTextParseResult {
  const whole = attemptStrict(text);

  if (whole.ok) return { status: TableTextParseStatus.Conforming, prefix: '', value: whole.value };

  const markerIndex = text.indexOf(SYSTEM_PREFIX_END_MARKER);

  if (markerIndex !== -1) {
    const prefix = extractSystemPrefix(text, markerIndex);
    const body = attemptStrict(text.slice(prefix.length));

    if (body.ok) return { status: TableTextParseStatus.Conforming, prefix, value: body.value };
  }

  const lenient = attemptLenient(text);

  if (lenient.ok) return { status: TableTextParseStatus.NeedsCommentStrip, prefix: '', value: lenient.value };

  return { status: TableTextParseStatus.Invalid, prefix: '' };
}

/**
 * 把表格数据序列化为写回文本：有系统前缀时逐字写回前缀注释块，再写格式化 JSON 正文
 * @param value 表格数据
 * @param prefix 记住的系统前缀原文（可为空串）
 * @returns 写回文本；无系统前缀的 `.jsonc` 注释不被保留
 */
export function serializeTableText(value: unknown, prefix: string): string {
  const body = JSON.stringify(value, null, 2) ?? '';

  return prefix.length === 0 ? body : `${prefix}${body}`;
}
