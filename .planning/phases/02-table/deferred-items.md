# Phase 02 deferred items

Out-of-scope discoveries recorded during plan 02-08 execution (not fixed here).

## Pre-existing Prettier drift

- `packages/libs/editor-impl/src/table/__tests__/edit.test.tsx` — `prettier --check` fails (file not formatted). Last touched by plan 02-07; not in 02-08's scope.
- `packages/libs/editor-impl/src/table/components/TableRow.tsx` — `prettier --check` fails (file not formatted). Last touched by plan 02-07; not in 02-08's scope.

Both were committed unformatted before this plan and remain unmodified by 02-08. `pnpm exec prettier --write` on them would change unrelated files, so they were left alone (scope boundary). Recommended: a dedicated formatting sweep, or fold into plan 02-10 cleanup.
