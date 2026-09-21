import type { CommentObject, FieldArgs } from '@/components/Table';
import { createTableMetaRuntimeContext, type TableMetaRuntimeContext } from './TableMetaRuntimeContext';

const DATA_VAR_NAME = 'data_a1e2fb4a_e986_4524_b0da_9b7ba7c0874d';
const FUNCTIONS_VAR_NAME = 'functions_d6ad677b_427a_4623_b50f_a445a3b0ef8a';
const TABLE_META_CONTEXT = Symbol('tableMetaContext');

export interface TableMetaDiagnostic {
  path: string;
  message: string;
  error?: Error;
}

export interface TableMetaEvalResult<T> {
  value?: T;
  diagnostics: TableMetaDiagnostic[];
}

export function bindTableMetaContext<T extends object>(value: T, context: TableMetaRuntimeContext): T {
  const seen = new Set<object>();
  const visit = (current: unknown): void => {
    if (!current || typeof current !== 'object' || seen.has(current as object)) return;
    seen.add(current as object);
    Object.defineProperty(current, TABLE_META_CONTEXT, {
      configurable: true,
      enumerable: false,
      value: context,
    });
    for (const child of Object.values(current as Record<string, unknown>)) visit(child);
  };
  visit(value);
  return value;
}

export function getTableMetaContext(value: unknown): TableMetaRuntimeContext | undefined {
  if (!value || typeof value !== 'object') return undefined;
  return (value as Record<symbol, TableMetaRuntimeContext>)[TABLE_META_CONTEXT];
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function contextArgs(context: TableMetaRuntimeContext): unknown[] {
  return [context.editor, context.core, context.main, context.data, context.functions, context.confirm];
}

function contextArgNames(): string[] {
  return ['editor', 'core', 'main', DATA_VAR_NAME, FUNCTIONS_VAR_NAME, 'confirm'];
}

export function parseTableMetaSource(
  text: string,
  varName: string,
  context = createTableMetaRuntimeContext(),
): CommentObject {
  const fn = new Function(
    ...contextArgNames(),
    `
      "use strict";
      ${text}
      return ${varName};
    `,
  );
  return bindTableMetaContext(fn(...contextArgs(context)) as CommentObject, context);
}

export function evaluateTableMetaExpression(
  expression: string,
  thiseval: unknown,
  context = createTableMetaRuntimeContext(),
): TableMetaEvalResult<boolean> {
  try {
    const fn = new Function('thiseval', ...contextArgNames(), `return (${expression});`);
    return {
      value: Boolean(fn(thiseval, ...contextArgs(context))),
      diagnostics: [],
    };
  } catch (error) {
    return {
      value: false,
      diagnostics: [
        {
          path: '$range',
          message: `Failed to evaluate tableMeta expression: ${expression}`,
          error: toError(error),
        },
      ],
    };
  }
}

export function callTableMetaFunctionString<T>(
  source: string,
  args: unknown[],
  context = createTableMetaRuntimeContext(),
): TableMetaEvalResult<T> {
  try {
    const fn = new Function(...contextArgNames(), `return (${source});`);
    const callable = fn(...contextArgs(context)) as (...args: unknown[]) => T;
    return {
      value: callable(...args),
      diagnostics: [],
    };
  } catch (error) {
    return {
      diagnostics: [
        {
          path: '$function',
          message: 'Failed to evaluate tableMeta function string',
          error: toError(error),
        },
      ],
    };
  }
}

export function resolveTableMetaFunction<T>(
  value: T | ((args: FieldArgs) => T) | undefined,
  args: FieldArgs,
  path: string,
  defaultValue: T,
): TableMetaEvalResult<T> {
  if (value === undefined) {
    return { value: defaultValue, diagnostics: [] };
  }
  if (typeof value !== 'function') {
    return { value, diagnostics: [] };
  }
  try {
    return {
      value: (value as (args: FieldArgs) => T)(args),
      diagnostics: [],
    };
  } catch (error) {
    return {
      value: defaultValue,
      diagnostics: [
        {
          path,
          message: 'Failed to resolve tableMeta dynamic function',
          error: toError(error),
        },
      ],
    };
  }
}
