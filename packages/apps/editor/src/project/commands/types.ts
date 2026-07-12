export type CommandResult =
  | { ok: true }
  | { ok: false; stage: string; error: Error };

export function commandOk(): CommandResult {
  return { ok: true };
}

export function commandError(stage: string, error: unknown): CommandResult {
  return {
    ok: false,
    stage,
    error: error instanceof Error ? error : new Error(String(error)),
  };
}
