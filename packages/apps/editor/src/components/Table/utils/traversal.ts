/**
 * Traversal Utilities
 *
 * Functions for traversing data and comment objects to build the table tree.
 */

import type { CommentObject, FieldArgs, FieldConfig, TableNode } from '../types';
import { getShortField } from '@/utils/fieldPath';
import {
  bindTableMetaContext,
  getTableMetaContext,
  resolveTableMetaFunction,
} from '@/project/tableMeta/TableMetaEvaluator';

/**
 * Default field configuration object.
 * Used when a field doesn't have explicit configuration in the comment object.
 */
export const defaultCobj: FieldConfig = {
  _type: 'textarea',
  _data: '',
  _string: (args: FieldArgs): boolean => {
    const thiseval = args.vobj;
    return typeof thiseval === 'string';
  },
  _leaf: (args: FieldArgs): boolean => {
    const thiseval = args.vobj;
    // null or undefined are leaf nodes
    if (thiseval == null) return true;
    // strings are leaf nodes
    if (typeof thiseval === 'string') return true;
    // empty objects/arrays are leaf nodes
    if (typeof thiseval === 'object' && Object.keys(thiseval as object).length === 0) return true;
    return false;
  },
};

/**
 * Resolve a potentially dynamic configuration value.
 * If the value is a function, call it with the args; otherwise return the value.
 */
function resolveConfigValue<T>(value: T | ((args: FieldArgs) => T) | undefined, args: FieldArgs, defaultValue: T): T {
  if (value === undefined) {
    return defaultValue;
  }
  if (typeof value === 'function') {
    return (
      resolveTableMetaFunction(value as (args: FieldArgs) => T, args, args.field, defaultValue).value ?? defaultValue
    );
  }
  return value;
}

/**
 * Build a merged configuration object from parent config and defaults.
 */
function buildFieldConfig(parentCobj: CommentObject | undefined, key: string, args: FieldArgs): FieldConfig {
  let rawConfig: FieldConfig | CommentObject | undefined;

  if (parentCobj?._data) {
    if (typeof parentCobj._data === 'function') {
      // _data is a function that returns config for a given key
      rawConfig = resolveTableMetaFunction(
        () => (parentCobj._data as (key: string) => FieldConfig)(key),
        args,
        args.cfield,
        {} as FieldConfig,
      ).value;
    } else {
      // _data is a record of configs
      rawConfig = parentCobj._data[key];
    }
  }

  // Extract only FieldConfig properties, excluding CommentObject-specific ones
  const fieldConfigProps: FieldConfig = {};
  if (rawConfig) {
    // Copy over valid FieldConfig properties
    if ('_leaf' in rawConfig) fieldConfigProps._leaf = rawConfig._leaf as FieldConfig['_leaf'];
    if ('_type' in rawConfig && rawConfig._type !== 'object') {
      fieldConfigProps._type = rawConfig._type as FieldConfig['_type'];
    }
    if ('_data' in rawConfig && typeof rawConfig._data === 'string') {
      fieldConfigProps._data = rawConfig._data;
    }
    if ('_docs' in rawConfig) fieldConfigProps._docs = rawConfig._docs;
    if ('_hide' in rawConfig) fieldConfigProps._hide = rawConfig._hide as FieldConfig['_hide'];
    if ('_range' in rawConfig) fieldConfigProps._range = rawConfig._range;
    if ('_string' in rawConfig) fieldConfigProps._string = rawConfig._string as FieldConfig['_string'];
    if ('_select' in rawConfig) fieldConfigProps._select = rawConfig._select;
    if ('_checkboxSet' in rawConfig) fieldConfigProps._checkboxSet = rawConfig._checkboxSet;
    if ('_event' in rawConfig) fieldConfigProps._event = rawConfig._event;
    if ('_directory' in rawConfig) fieldConfigProps._directory = rawConfig._directory;
    if ('_transform' in rawConfig) fieldConfigProps._transform = rawConfig._transform;
    if ('_onconfirm' in rawConfig) fieldConfigProps._onconfirm = rawConfig._onconfirm;
    if ('_lint' in rawConfig) fieldConfigProps._lint = rawConfig._lint;
    if ('_template' in rawConfig) fieldConfigProps._template = rawConfig._template;
    if ('_preview' in rawConfig) fieldConfigProps._preview = rawConfig._preview;
    if ('indent' in rawConfig) fieldConfigProps.indent = rawConfig.indent;
  }

  // Merge with defaults
  const mergedConfig: FieldConfig = { ...defaultCobj, ...fieldConfigProps };
  const tableMetaContext = getTableMetaContext(rawConfig) ?? getTableMetaContext(parentCobj);
  if (tableMetaContext) bindTableMetaContext(mergedConfig, tableMetaContext);

  // Resolve dynamic values
  const resolvedConfig: FieldConfig = { ...mergedConfig };
  if (tableMetaContext) bindTableMetaContext(resolvedConfig, tableMetaContext);

  // Don't resolve _data as it's the comment text or nested config
  for (const configKey of Object.keys(mergedConfig) as (keyof FieldConfig)[]) {
    if (configKey === '_data') continue;

    const value = mergedConfig[configKey];
    if (typeof value === 'function' && configKey !== '_checkboxSet') {
      // Resolve function values (except _checkboxSet which is handled differently)
      (resolvedConfig as Record<string, unknown>)[configKey] = resolveTableMetaFunction(
        value as (args: FieldArgs) => unknown,
        args,
        args.field,
        undefined,
      ).value;
    }
  }

  return resolvedConfig;
}

/**
 * Build a table tree from data and comment objects.
 *
 * @param data - The data object to display
 * @param commentObj - The comment configuration object
 * @returns Object containing root nodes and all gap field paths
 *
 * @example
 * const { rootNodes, gapFields } = buildTableTree(
 *   { main: { floorIds: ['MT0'], images: [] } },
 *   { _data: { main: { _data: { floorIds: { _leaf: true } } } } }
 * );
 */
export function buildTableTree(
  data: Record<string, unknown>,
  commentObj: CommentObject,
): { rootNodes: TableNode[]; gapFields: string[] } {
  const gapFields: string[] = [];

  /**
   * Recursively traverse and build nodes.
   */
  function traverse(
    parentField: string,
    parentCfield: string,
    parentVobj: Record<string, unknown>,
    parentCobj: CommentObject | undefined,
  ): TableNode[] {
    const nodes: TableNode[] = [];

    // Build ordered keys: first from comment config, then from data
    const keysForOrder: Record<string, symbol | unknown> = {};
    const voidMark = Symbol('void');

    // 1. Add keys from comment config first (for ordering)
    if (parentCobj?._data && typeof parentCobj._data !== 'function') {
      for (const key of Object.keys(parentCobj._data)) {
        keysForOrder[key] = voidMark;
      }
    }

    // 2. Add keys from data (overwriting void marks)
    Object.assign(keysForOrder, parentVobj);

    // 3. Process each key
    for (const key of Object.keys(keysForOrder)) {
      // Handle case where comment has key but data doesn't
      if (keysForOrder[key] === voidMark) {
        parentVobj[key] = null;
      }

      const field = `${parentField}['${key}']`;
      const cfield = `${parentCfield}['_data']['${key}']`;
      let vobj = parentVobj[key];

      // Build field config
      const args: FieldArgs = {
        field,
        cfield,
        vobj,
        cobj: {} as FieldConfig, // Will be filled below
      };

      const cobj = buildFieldConfig(parentCobj, key, args);
      args.cobj = cobj;

      // Execute _action if defined (can modify vobj)
      if (parentCobj?._data && typeof parentCobj._data !== 'function') {
        const fieldCommentObj = parentCobj._data[key] as CommentObject | undefined;
        if (fieldCommentObj?._action) {
          resolveTableMetaFunction(fieldCommentObj._action, args, cfield, undefined);
          vobj = args.vobj;
          parentVobj[key] = vobj;
        }
      }

      // Skip hidden fields
      const isHidden = resolveConfigValue(cobj._hide, args, false);
      if (isHidden) continue;

      // Determine if this is a leaf node
      const isLeaf = resolveConfigValue(cobj._leaf, args, false);

      const shortField = getShortField(field);
      const comment = typeof cobj._data === 'string' ? cobj._data : '';

      if (!isLeaf) {
        // Non-leaf node: create gap row with children
        gapFields.push(field);

        // Get nested comment object for children
        let nestedCobj: CommentObject | undefined;
        if (parentCobj?._data && typeof parentCobj._data !== 'function') {
          nestedCobj = parentCobj._data[key] as CommentObject | undefined;
        }

        const children = traverse(field, cfield, (vobj as Record<string, unknown>) || {}, nestedCobj);

        nodes.push({
          field,
          shortField,
          isGap: true,
          config: cobj,
          comment,
          shortComment: cobj._docs,
          children,
        });
      } else {
        // Leaf node: create editable row
        nodes.push({
          field,
          shortField,
          isGap: false,
          value: vobj,
          config: cobj,
          comment,
          shortComment: cobj._docs,
        });
      }
    }

    return nodes;
  }

  const rootNodes = traverse('', '', data, commentObj);

  return { rootNodes, gapFields };
}
