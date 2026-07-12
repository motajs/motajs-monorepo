export interface BlocklyDiagnostic {
  code: string;
  message: string;
  severity: 'warning' | 'error';
  path: string;
}

const BRANCH_FIELDS: Record<string, string[]> = {
  if: ['true', 'false'],
  while: ['data'],
  dowhile: ['data'],
  confirm: ['yes', 'no'],
  previewUI: ['action'],
};

function scanList(events: unknown, path: string, diagnostics: BlocklyDiagnostic[]): boolean {
  if (!Array.isArray(events)) return false;
  let hasAsync = false;
  events.forEach((value, index) => {
    if (!value || typeof value !== 'object') return;
    const event = value as Record<string, unknown>;
    const eventPath = `${path}[${index}]`;
    for (const field of BRANCH_FIELDS[String(event.type)] ?? []) {
      if (scanList(event[field], `${eventPath}.${field}`, diagnostics)) hasAsync = true;
    }
    for (const field of ['choices', 'caseList', 'data']) {
      if (!Array.isArray(event[field])) continue;
      (event[field] as unknown[]).forEach((branch, branchIndex) => {
        if (branch && typeof branch === 'object'
          && scanList((branch as Record<string, unknown>).action, `${eventPath}.${field}[${branchIndex}].action`, diagnostics)) {
          hasAsync = true;
        }
      });
    }
    if (event.async && !['animate', 'function', 'text'].includes(String(event.type))) hasAsync = true;
    if (event.type === 'waitAsync' || event.type === 'stopAsync') hasAsync = false;
  });
  return hasAsync;
}

export function diagnoseBlocklyEvents(events: unknown): BlocklyDiagnostic[] {
  const diagnostics: BlocklyDiagnostic[] = [];
  if (scanList(events, '$', diagnostics)) diagnostics.push({
    code: 'async.unjoined',
    message: '存在未使用“等待所有异步事件处理完毕”收束的异步事件，可能影响录像检测。',
    severity: 'warning',
    path: '$',
  });
  return diagnostics;
}
