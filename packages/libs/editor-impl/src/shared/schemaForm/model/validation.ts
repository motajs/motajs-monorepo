import { Ajv2020, SchemaObject, ValidateFunction } from 'ajv/dist/2020';
import { ITableSchemaNode } from '../types';

/** 共享的 ajv 实例：整个模块只建一次，`strict: false` 接受 `x-editor` / `x-control` 扩展键、`allErrors: true` 收集全部错误 */
const sharedAjv = new Ajv2020({ strict: false, allErrors: true });

/** 按 schema 引用缓存已编译校验器：同一 schema 节点只编译一次（`Object.freeze` 仅为通过模块级可变绑定门禁，冻结的 WeakMap 仍可 set / get） */
const validatorCache: WeakMap<object, ValidateFunction> = Object.freeze(new WeakMap<object, ValidateFunction>());

/** 「新字段名」校验的结果：是否合法，以及不合法时的中文错误信息 */
export interface ValidateIdResult {
  /** 字段名是否合法 */
  readonly valid: boolean;
  /** 不合法时的中文错误信息；合法时为 undefined */
  readonly error?: string;
}

/**
 * 校验一个「新字段名」能否写入数据对象：非空、字符集合规、且不与同级已有字段重名
 * @param id 待校验的字段名
 * @param existingKeys 同级已有的字段名列表
 * @param allowText 是否放行白名单字符集以外的名字（如中文），缺省为 false
 * @returns 校验结果；合法时为 { valid: true }
 */
export function validateId(
  id: string | null | undefined,
  existingKeys: readonly string[],
  allowText: boolean = false,
): ValidateIdResult {
  if (id == null || id.length === 0) return { valid: false, error: 'ID不能为空' };

  if (!allowText && !/^[a-zA-Z0-9_]+$/.test(id)) {
    return { valid: false, error: 'id不符合规范, 请使用大小写字母数字下划线来构成' };
  }

  if (existingKeys.includes(id)) return { valid: false, error: 'id已存在, 请直接修改该项的值' };

  return { valid: true };
}

/**
 * 取某个 schema 节点对应的 ajv 校验器：命中缓存直接复用，未命中才编译并写入缓存
 * @param schema 字段的 JSON Schema 节点
 * @returns 该 schema 对应的校验函数；同一 schema 引用只编译一次
 */
function getValidator(schema: ITableSchemaNode): ValidateFunction {
  const cached = validatorCache.get(schema);
  if (cached !== undefined) return cached;

  const validator = sharedAjv.compile(schema as SchemaObject);
  validatorCache.set(schema, validator);
  return validator;
}

/**
 * 用字段自身的标准 JSON Schema 节点声明式地校验一个值（ajv，Draft 2020-12）
 *
 * 校验完全交给 ajv，绝不对 schema 里的任何字符串做表达式求值（D-22）；`strict: false`
 * 让 `x-editor` / `x-control` 之类的扩展键被接受而非当作未知关键字报错。
 * schema 缺省时视为无约束，任何值都合法（默认文本兜底，D-29）。
 * @param schema 字段的 JSON Schema 节点；缺省时无约束
 * @param value 待校验的值
 * @returns 值满足 schema 时为 true
 */
export function validateValue(schema: ITableSchemaNode | undefined, value: unknown): boolean {
  if (schema === undefined) return true;

  const valid = getValidator(schema)(value);

  if (valid && schema.enum !== undefined) return schema.enum.includes(value);

  return valid;
}
