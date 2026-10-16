import { describe, expect, it } from 'vitest';
import { parseTableText, serializeTableText, SYSTEM_PREFIX_END_MARKER, TableTextParseStatus } from '../model/tableText';

const sampleValue = { title: '示例', level: 3, position: { x: 1, y: 2 } };

describe('parseTableText', () => {
  // 一段严格 JSON（无注释、无前缀）判合规，前缀为空、值深等于解析对象
  it('无前缀的严格 JSON 判合规', () => {
    const text = JSON.stringify(sampleValue, null, 2);
    const result = parseTableText(text);

    expect(result.status).toBe(TableTextParseStatus.Conforming);
    expect(result.prefix).toBe('');
    expect(result.value).toEqual(sampleValue);
  });

  // 带系统前缀的合规文本：前缀逐字带回（含行尾换行），且 serializeTableText 能完整往返成原文
  it('系统前缀逐字往返', () => {
    const prefix = `// 系统前缀\n// 第二行\n${SYSTEM_PREFIX_END_MARKER}\n`;
    const text = prefix + JSON.stringify(sampleValue, null, 2);
    const result = parseTableText(text);

    expect(result.status).toBe(TableTextParseStatus.Conforming);
    expect(result.prefix).toBe(prefix);
    expect(result.value).toEqual(sampleValue);
    expect(serializeTableText(result.value, result.prefix)).toBe(text);
  });

  // 前缀内部与标记行后均用 CRLF 行尾时，系统前缀逐字保留 CRLF
  it('CRLF 行尾的系统前缀逐字保留', () => {
    const prefix = `// 系统前缀\r\n// 第二行\r\n${SYSTEM_PREFIX_END_MARKER}\r\n`;
    const text = prefix + JSON.stringify(sampleValue, null, 2);
    const result = parseTableText(text);

    expect(result.status).toBe(TableTextParseStatus.Conforming);
    expect(result.prefix).toBe(prefix);
    expect(serializeTableText(result.value, result.prefix)).toBe(text);
  });

  // 仅标记行后接 CRLF、前缀内部为 LF 时，系统前缀同样逐字保留
  it('标记行后接 CRLF 的系统前缀逐字保留', () => {
    const prefix = `// 系统前缀\n// 第二行\n${SYSTEM_PREFIX_END_MARKER}\r\n`;
    const text = prefix + JSON.stringify(sampleValue, null, 2);
    const result = parseTableText(text);

    expect(result.status).toBe(TableTextParseStatus.Conforming);
    expect(result.prefix).toBe(prefix);
  });

  // 含行注释、无标记行的文本经宽松解析判需剥离注释，前缀为空、值取宽松解析结果
  it('含注释且无标记行判需剥离注释', () => {
    const text = '{\n  // 注释行\n  "title": "示例"\n}\n';
    const result = parseTableText(text);

    expect(result.status).toBe(TableTextParseStatus.NeedsCommentStrip);
    expect(result.prefix).toBe('');
    expect(result.value).toEqual({ title: '示例' });
  });

  // 含尾逗号、无标记行的文本经宽松解析判需剥离注释，值正确
  it('含尾逗号且无标记行判需剥离注释', () => {
    const text = '{\n  "title": "示例",\n  "level": 2,\n}\n';
    const result = parseTableText(text);

    expect(result.status).toBe(TableTextParseStatus.NeedsCommentStrip);
    expect(result.prefix).toBe('');
    expect(result.value).toEqual({ title: '示例', level: 2 });
  });

  // 既非严格 JSON 也无法宽松解析的乱码判无效，前缀为空、无值且不抛异常
  it('无法解析的文本判无效且不抛异常', () => {
    let result: ReturnType<typeof parseTableText> | undefined;

    expect(() => {
      result = parseTableText('{oops');
    }).not.toThrow();

    expect(result === undefined ? undefined : result.status).toBe(TableTextParseStatus.Invalid);
    expect(result === undefined ? undefined : result.prefix).toBe('');
    expect(result === undefined ? undefined : result.value).toBeUndefined();
  });
});

describe('serializeTableText', () => {
  // 空前缀序列化只写格式化 JSON 正文，不含任何注释
  it('空前缀只写 JSON 正文', () => {
    const text = serializeTableText(sampleValue, '');

    expect(text).toBe(JSON.stringify(sampleValue, null, 2));
    expect(text).not.toContain('//');
  });

  // 非空前缀序列化逐字前置系统前缀注释块，再接格式化 JSON 正文
  it('非空前缀逐字前置注释块', () => {
    const prefix = `// 系统前缀\n${SYSTEM_PREFIX_END_MARKER}\n`;
    const text = serializeTableText(sampleValue, prefix);

    expect(text.startsWith(prefix)).toBe(true);
    expect(text.slice(prefix.length)).toBe(JSON.stringify(sampleValue, null, 2));
  });
});

describe('SYSTEM_PREFIX_END_MARKER', () => {
  // 结束标记行常量精确等于约定文本
  it('精确等于约定文本', () => {
    expect(SYSTEM_PREFIX_END_MARKER).toBe('// --- SYSTEM PREFIX END --- //');
  });
});
