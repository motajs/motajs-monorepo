import { describe, expect, it } from 'vitest';
import { validateId, validateValue } from '../../shared/schemaForm/model/validation';

describe('validateId', () => {
  // 空名字被拒绝并给出「ID不能为空」
  it('空名字被拒绝', () => {
    expect(validateId('', ['a'])).toEqual({ valid: false, error: 'ID不能为空' });
    expect(validateId(null, [])).toEqual({ valid: false, error: 'ID不能为空' });
    expect(validateId(undefined, [])).toEqual({ valid: false, error: 'ID不能为空' });
  });

  // 字符集不合规的名字被拒绝
  it('字符集不合规的名字被拒绝', () => {
    expect(validateId('a b', [])).toEqual({
      valid: false,
      error: 'id不符合规范, 请使用大小写字母数字下划线来构成',
    });
    expect(validateId('a-b', []).valid).toBe(false);
  });

  // 与同级已有字段重名的名字被拒绝
  it('与同级已有字段重名被拒绝', () => {
    expect(validateId('dup', ['dup', 'other'])).toEqual({
      valid: false,
      error: 'id已存在, 请直接修改该项的值',
    });
  });

  // 合规且不重名的名字返回合法
  it('合规且不重名的名字返回合法', () => {
    expect(validateId('newField_1', ['dup'])).toEqual({ valid: true });
  });

  // 放行文本时接受白名单字符集以外的名字
  it('放行文本时接受白名单以外的名字', () => {
    expect(validateId('中文名字', [], true)).toEqual({ valid: true });
    expect(validateId('中文名字', []).valid).toBe(false);
  });

  // 恶意名字（含原型污染字符）被字符集拦下
  it('恶意名字被字符集拦下', () => {
    expect(validateId('__proto__', []).valid).toBe(true);
    expect(validateId('constructor.prototype', []).valid).toBe(false);
    expect(validateId('a\u0000b', []).valid).toBe(false);
  });
});

describe('validateValue', () => {
  // 数值 schema 只接受数字
  it('数值 schema 只接受数字', () => {
    expect(validateValue({ type: 'number' }, 5)).toBe(true);
    expect(validateValue({ type: 'number' }, 'x')).toBe(false);
  });

  // enum schema 强制成员关系
  it('enum schema 强制成员关系', () => {
    expect(validateValue({ enum: ['a', 'b'] }, 'a')).toBe(true);
    expect(validateValue({ enum: ['a', 'b'] }, 'c')).toBe(false);
  });

  // 缺省 schema 视为无约束
  it('缺省 schema 视为无约束', () => {
    expect(validateValue(undefined, 'anything')).toBe(true);
    expect(validateValue(undefined, null)).toBe(true);
  });

  // 空 schema 允许删除（null 合法）
  it('空 schema 允许 null（可删除）', () => {
    expect(validateValue({}, null)).toBe(true);
  });

  // 数值 schema 拒绝 null（删除被拒）
  it('数值 schema 拒绝 null（删除被拒）', () => {
    expect(validateValue({ type: 'number' }, null)).toBe(false);
  });

  // 带 x-editor / x-control 扩展键的 schema 仍能编译校验
  it('带扩展键的 schema 仍能编译校验', () => {
    const schema = { type: 'number', minimum: 0, maximum: 10, 'x-control': 1 };
    expect(validateValue(schema, 5)).toBe(true);
    expect(validateValue(schema, 11)).toBe(false);
  });
});
