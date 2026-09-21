import type { Diagnostic } from '@/components/SchemaTable';
import type { LocData } from './locModel';
import { isLocValuePresent } from './locModel';

const directions = new Set(['up', 'down', 'left', 'right']);

function diagnostic(
  source: string,
  code: string,
  message: string,
  severity: Diagnostic['severity'] = 'error',
): Diagnostic {
  return { source, code, message, severity };
}

function validateDirections(diagnostics: Diagnostic[], source: 'cannotMove' | 'cannotMoveIn', value: unknown): void {
  if (value == null) return;
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !directions.has(item))) {
    diagnostics.push(diagnostic(`loc:${source}`, 'loc.passability.shape', `${source} 只能包含 up、down、left、right`));
  }
}

export function buildLocDiagnostics(loc: LocData): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  if (isLocValuePresent(loc.events) && isLocValuePresent(loc.changeFloor)) {
    const message = '普通事件与楼层转换同时存在；运行时普通事件会覆盖楼层转换';
    diagnostics.push(diagnostic('loc:events', 'loc.changeFloor.conflict', message, 'warning'));
    diagnostics.push(diagnostic('loc:changeFloor', 'loc.changeFloor.conflict', message, 'warning'));
  }
  validateDirections(diagnostics, 'cannotMove', loc.cannotMove);
  validateDirections(diagnostics, 'cannotMoveIn', loc.cannotMoveIn);
  return diagnostics;
}
