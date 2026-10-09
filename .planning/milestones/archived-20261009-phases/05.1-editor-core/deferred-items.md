# Phase 05.1 — Deferred Items

Out-of-scope items discovered while executing phase 05.1. Not fixed here because the
owning plan forbids touching the file or the issue is unrelated to the current plan's
changes.

| # | Item | Owner / scope | Why deferred | Suggested fix |
|---|------|---------------|--------------|---------------|
| 1 | `packages/apps/editor/src/project/commands/animationCommands.ts` line 8 fails `prettier/prettier` (`pnpm lint` = 1 error, 107 warnings) | `@motajs/editor` (plan 05.1-08) | Plan 05.1-07 must **not** touch `packages/apps/editor`; the file was left unformatted by plan 05.1-08, which did not run `pnpm lint` (its verification only ran typecheck + tests). | One-line `prettier --write packages/apps/editor/src/project/commands/animationCommands.ts`, or fold it into Phase 11's editor work. |
