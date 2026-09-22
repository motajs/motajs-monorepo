/**
 * editor-core 依赖边界规则集（VERIFY-05 / D-14 / D-16 / D-17 / D-20）。
 *
 * 只写 `forbidden` 规则，且全部 `severity: 'error'`：门禁只能更严，不能更松。
 * 刻意不写 `allowed`/`required` 规则、不设 `options.tsConfig`、不写 blanket 的
 * not-to-unresolvable —— core 的包内导入是相对路径（D-06 修订），DAG 规则是纯路径规则，
 * 不需要 TypeScript 感知解析；而 `@styled-system/*` 是消费方生成的路径、不是真实包，
 * 一旦要求「必须可解析」就会假红（Pitfall 6）。
 *
 * 由 scripts/verify/coreBoundaries.js 通过 --config 显式加载，cruise 目标只有
 * packages/libs/editor-core/lib（D-14：不做全仓 cruise）。
 */
module.exports = {
  forbidden: [
    {
      name: 'core-must-not-import-consumers',
      comment: 'editor-core 是下层：不得 import editor、宿主（service-worker）或引擎（external/mota-js）。',
      severity: 'error',
      from: { path: '^packages/libs/editor-core/lib/.+' },
      to: { path: '^(packages/apps/editor|packages/apps/service-worker|packages/external/mota-js)/.+' },
    },
    {
      name: 'kernel-must-not-import-capabilities',
      comment: 'D-06：`.`（内核）不依赖任何能力 subpath。',
      severity: 'error',
      from: { path: '^packages/libs/editor-core/lib/(index\\.ts|kernel/.*)$' },
      to: { path: '^packages/libs/editor-core/lib/(code|table|map|asset)/.+' },
    },
    {
      name: 'react-and-shell-must-not-import-capabilities',
      comment: 'D-06：`./react` 与 `./shell` 只依赖 `.`。',
      severity: 'error',
      from: { path: '^packages/libs/editor-core/lib/(react|shell)/.+' },
      to: { path: '^packages/libs/editor-core/lib/(code|table|map|asset)/.+' },
    },
    {
      name: 'capabilities-must-not-import-each-other',
      comment: 'D-06：四大能力之间互不依赖（$1 为 from 捕获到的能力目录）。',
      severity: 'error',
      from: { path: '^packages/libs/editor-core/lib/(code|table|map|asset)/.+' },
      to: {
        path: '^packages/libs/editor-core/lib/(code|table|map|asset)/.+',
        pathNot: '^packages/libs/editor-core/lib/$1/.+',
      },
    },
    {
      name: 'no-circular',
      comment: '禁止环依赖。',
      severity: 'error',
      from: { pathNot: '^node_modules' },
      to: { circular: true },
    },
    {
      name: 'core-singletons-only-imported-by-composition-root',
      comment:
        'D-16 requireZero：core 的 6 个模块级 singleton 只允许 composition root（lib/kernel/core.ts）导入。' +
        '当前 core 尚无 singleton，规则天然通过（空集，D-17），Phase 3 引入后自动生效。' +
        '刻意用 forbidden（而非 required + module.numberOfDependentsLessThan，后者只在 forbidden 上下文可用，Pitfall 7）。',
      severity: 'error',
      from: { pathNot: '^packages/libs/editor-core/lib/kernel/core\\.ts$' },
      to: {
        path:
          '^packages/libs/editor-core/lib/(kernel|services)/' +
          '(projectData|projectModel|operationHistory|FileHandlerManager|persistenceMonitor|editorConfigService)[^/]*\\.ts$',
      },
    },
  ],
  options: {
    doNotFollow: { path: '^node_modules' },
  },
};
