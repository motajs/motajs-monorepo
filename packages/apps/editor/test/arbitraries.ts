/**
 * fast-check 自定义 Arbitrary 生成器
 *
 * 提供项目中常用的测试数据生成器
 */

import * as fc from 'fast-check';

/**
 * JavaScript 保留字列表
 * 包括关键字、未来保留字、字面量等
 */
const JS_RESERVED_WORDS = new Set([
  // 关键字
  'break', 'case', 'catch', 'continue', 'debugger', 'default', 'delete',
  'do', 'else', 'finally', 'for', 'function', 'if', 'in', 'instanceof',
  'new', 'return', 'switch', 'this', 'throw', 'try', 'typeof', 'var',
  'void', 'while', 'with',
  // ES6+ 关键字
  'class', 'const', 'enum', 'export', 'extends', 'import', 'super',
  // 严格模式保留字
  'implements', 'interface', 'let', 'package', 'private',
  'protected', 'public', 'static', 'yield',
  // 字面量
  'null', 'true', 'false',
]);

/**
 * 有效 JS 标识符首字符：小写字母和下划线
 */
const identifierFirstCharArb = fc.constantFrom(
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
  'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '_'
);

/**
 * 有效 JS 标识符后续字符：小写字母、数字和下划线
 */
const identifierRestCharArb = fc.constantFrom(
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
  'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '_'
);

export interface JsIdentifierOptions {
  /** 最小长度，默认 1 */
  minLength?: number;
  /** 最大长度，默认 20 */
  maxLength?: number;
}

/**
 * 生成有效的 JavaScript 标识符
 *
 * - 以字母或下划线开头
 * - 后续可以是字母、数字或下划线
 * - 自动排除 JavaScript 保留字
 *
 * @example
 * ```ts
 * fc.assert(
 *   fc.property(jsIdentifierArb(), (name) => {
 *     // name 是一个有效的 JS 变量名
 *   })
 * );
 * ```
 */
export function jsIdentifierArb(options: JsIdentifierOptions = {}): fc.Arbitrary<string> {
  const { minLength = 1, maxLength = 20 } = options;

  // 后续字符的长度范围（总长度减去首字符）
  const restMinLength = Math.max(0, minLength - 1);
  const restMaxLength = Math.max(0, maxLength - 1);

  return fc
    .tuple(
      identifierFirstCharArb,
      fc.array(identifierRestCharArb, {
        minLength: restMinLength,
        maxLength: restMaxLength,
      })
    )
    .map(([first, rest]) => first + rest.join(''))
    .filter((name) => !JS_RESERVED_WORDS.has(name));
}

/**
 * JavaScript 中不能作为普通对象键的特殊属性名
 * 这些属性在对象原型链中有特殊含义，序列化/反序列化时会出问题
 */
const UNSAFE_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * 生成安全的对象键（排除原型相关的特殊属性名）
 */
function safeObjectKeyArb(): fc.Arbitrary<string> {
  return fc.string().filter((key) => !UNSAFE_OBJECT_KEYS.has(key));
}

/**
 * 生成安全的 JSON 值（排除 __proto__ 等特殊键）
 *
 * 与 fc.jsonValue() 类似，但生成的对象不会包含 __proto__ 等
 * 在 JavaScript 中有特殊含义的键名，确保序列化/反序列化的正确性。
 *
 * @example
 * ```ts
 * fc.assert(
 *   fc.property(safeJsonValueArb(), (data) => {
 *     // data 是一个可以安全序列化的 JSON 值
 *   })
 * );
 * ```
 */
export function safeJsonValueArb(): fc.Arbitrary<unknown> {
  return fc.letrec((tie) => ({
    value: fc.oneof(
      fc.constant(null),
      fc.boolean(),
      fc.double({ noNaN: true, noDefaultInfinity: true }),
      fc.string(),
      fc.array(tie('value'), { maxLength: 5 }),
      fc.dictionary(safeObjectKeyArb(), tie('value'), { maxKeys: 5 })
    ),
  })).value;
}
