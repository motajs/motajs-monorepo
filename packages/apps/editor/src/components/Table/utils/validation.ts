/**
 * Validation Utilities
 *
 * Functions for validating values and IDs in the table system.
 */

import type { FieldConfig } from '../types';
import { evaluateTableMetaExpression, getTableMetaContext } from '@/project/tableMeta/TableMetaEvaluator';

/**
 * Check if a value is within the allowed range defined by the field configuration.
 *
 * The _range property is a JavaScript expression string where 'thiseval' represents
 * the value being validated. The expression should return true if the value is valid.
 *
 * @param cobj - Field configuration object
 * @param value - Value to validate (referred to as 'thiseval' in the range expression)
 * @returns true if the value is valid, false otherwise
 *
 * @example
 * // Range validation
 * checkRange({ _range: 'thiseval > 0' }, 5) // true
 * checkRange({ _range: 'thiseval > 0' }, -1) // false
 *
 * // Select validation
 * checkRange({ _select: { values: [1, 2, 3] } }, 2) // true
 * checkRange({ _select: { values: [1, 2, 3] } }, 4) // false
 *
 * // No validation
 * checkRange({}, 'anything') // true
 */
export function checkRange(cobj: FieldConfig, value: unknown): boolean {
  // Check _range expression if defined
  if (cobj._range) {
    return evaluateTableMetaExpression(cobj._range, value, getTableMetaContext(cobj)).value ?? false;
  }

  // Check _select values if defined
  if (cobj._select) {
    return cobj._select.values.includes(value);
  }

  // No validation rules, value is valid
  return true;
}

/**
 * Result of ID validation
 */
export interface ValidateIdResult {
  /** Whether the ID is valid */
  valid: boolean;
  /** Error message if invalid */
  error?: string;
}

/**
 * Validate a new item ID for format and uniqueness.
 *
 * @param id - The ID to validate
 * @param existingKeys - Array of existing keys in the parent object
 * @param supportText - Whether to support Chinese/text IDs (for commonevent/plugins modes)
 * @returns Validation result with valid flag and optional error message
 *
 * @example
 * validateId('newItem', ['item1', 'item2'], false) // { valid: true }
 * validateId('item1', ['item1', 'item2'], false) // { valid: false, error: 'id已存在...' }
 * validateId('invalid-id', [], false) // { valid: false, error: 'id不符合规范...' }
 * validateId('中文ID', [], true) // { valid: true } (supportText mode)
 */
export function validateId(
  id: string | null | undefined,
  existingKeys: string[],
  supportText: boolean = false
): ValidateIdResult {
  // Check for empty ID
  if (id == null || id.length === 0) {
    return {
      valid: false,
      error: 'ID不能为空'
    };
  }

  // Check ID format (unless supportText mode is enabled)
  if (!supportText) {
    if (!/^[a-zA-Z0-9_]+$/.test(id)) {
      return {
        valid: false,
        error: 'id不符合规范, 请使用大小写字母数字下划线来构成'
      };
    }
  }

  // Check for duplicate ID
  if (existingKeys.includes(id)) {
    return {
      valid: false,
      error: 'id已存在, 请直接修改该项的值'
    };
  }

  return { valid: true };
}

/**
 * Check if a field allows null/deletion.
 *
 * @param cobj - Field configuration object
 * @returns true if null is allowed (deletion is permitted), false otherwise
 */
export function allowsNull(cobj: FieldConfig): boolean {
  return checkRange(cobj, null);
}

/**
 * Parse a JSON string value safely.
 *
 * @param value - String value to parse
 * @returns Parsed value or error
 */
export interface ParseResult {
  success: boolean;
  value?: unknown;
  error?: string;
}

export function parseJsonValue(value: string): ParseResult {
  try {
    // Handle empty string as null
    const trimmed = value.trim();
    if (trimmed === '') {
      return { success: true, value: null };
    }

    const parsed = JSON.parse(trimmed);
    return { success: true, value: parsed };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'JSON解析错误'
    };
  }
}
