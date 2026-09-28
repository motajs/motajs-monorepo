/**
 * editor-core / editor-impl 依赖边界规则集（VERIFY-05 / D-14 / D-16 / D-17 / D-20）。
 *
 * 只写 `forbidden` 规则，且全部 `severity: 'error'`：门禁只能更严，不能更松。
 * 刻意不写 `allowed`/`required` 规则、不设 `options.tsConfig`、不写 blanket 的
 * not-to-unresolvable —— 两个包的包内导入是相对路径（D-06 修订），DAG 规则是纯路径规则，
 * 不需要 TypeScript 感知解析；而 `@styled-system/*` 是消费方生成的路径、不是真实包，
 * 一旦要求「必须可解析」就会假红（Pitfall 6）。
 *
 * 由 scripts/verify/coreBoundaries.js 通过 --config 显式加载，cruise 目标只有
 * packages/libs/editor-core/lib 与 packages/libs/editor-impl/lib（D-14：不做全仓 cruise）。
 * 规则里的路径一律写 `packages/libs/...` 前缀形式（`@/` 别名不被解析，见 Pitfall 5）。
 */
module.exports = {
  forbidden: [
    {
      name: 'core-must-not-import-consumers',
      comment:
        'editor-core 与 editor-impl 都是下层：不得 import editor、宿主（service-worker）或引擎（external/mota-js）。' +
        '（原 `editor-impl-must-not-import-consumers` 的意图并入本规则。）',
      severity: 'error',
      from: { path: '^packages/libs/(editor-core|editor-impl)/lib/.+' },
      to: { path: '^(packages/apps/editor|packages/apps/service-worker|packages/external/mota-js)/.+' },
    },
    {
      name: 'editor-core-must-not-import-editor-impl',
      comment:
        'D-01 的单向依赖：底层（editor-core）绝不 import 默认实现（editor-impl）；反方向允许（impl → core）。' +
        '`to.path` 同时匹配**解析后的包内路径**（core 若声明了该依赖就会解析到 packages/libs/editor-impl/lib/…）' +
        '与**裸说明符**（core 未声明该依赖时 pnpm 严格 node_modules 使其 couldNotResolve，resolved 即说明符本身）——' +
        '两种形态都必须被拦下。',
      severity: 'error',
      from: { path: '^packages/libs/editor-core/lib/.+' },
      to: { path: '^(?:packages/libs/editor-impl/lib/.+|@motajs/editor-impl$)' },
    },
    {
      name: 'editor-impl-root-barrel-must-not-import-capabilities',
      comment:
        'D-06：editor-impl 的根 `.`（index.ts）只汇总 resources/edit/table，不由根 barrel 拉入能力 subpath' +
        '（code/map/asset/shell/react）。根 barrel 合法地再导出 `./table` 的公开名，故 Table 不在禁用之列。' +
        '本规则承接被删的 `kernel-must-not-import-capabilities` 对「根 barrel 不得 import 能力 subpath」的守卫。',
      severity: 'error',
      from: { path: '^packages/libs/editor-impl/lib/index\\.ts$' },
      to: { path: '^packages/libs/editor-impl/lib/(code|map|asset|shell|react)/.+' },
    },
    {
      name: 'react-and-shell-must-not-import-capabilities',
      comment: 'D-06：`./react` 与 `./shell` 只依赖 `.`（与 resources/edit），不依赖能力 subpath。',
      severity: 'error',
      from: { path: '^packages/libs/editor-impl/lib/(react|shell)/.+' },
      to: { path: '^packages/libs/editor-impl/lib/(code|table|map|asset)/.+' },
    },
    {
      name: 'capabilities-must-not-import-each-other',
      comment: 'D-06：四大能力之间互不依赖（$1 为 from 捕获到的能力目录）。',
      severity: 'error',
      from: { path: '^packages/libs/editor-impl/lib/(code|table|map|asset)/.+' },
      to: {
        path: '^packages/libs/editor-impl/lib/(code|table|map|asset)/.+',
        pathNot: '^packages/libs/editor-impl/lib/$1/.+',
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
      name: 'resources-edit-must-not-import-capabilities',
      comment:
        'D-06 单向 DAG：lib/resources 与 lib/edit 不得依赖四个能力目录（code/table/map/asset）。' +
        '它们随目录迁入 editor-impl，故 from/to 由 editor-core/lib 改指 editor-impl/lib。',
      severity: 'error',
      from: { path: '^packages/libs/editor-impl/lib/(resources|edit)/.+' },
      to: { path: '^packages/libs/editor-impl/lib/(code|table|map|asset)/.+' },
    },
    {
      name: 'singletons-only-imported-by-composition-root',
      comment:
        'D-16 requireZero（D-08 改指）：模块级 singleton 只允许 composition root 导入。' +
        'core 半边：Phase 4 已把 FileHandlerManager / persistenceMonitor / operationHistory 去单例化并移入 ' +
        'editor-impl 的 lib/resources、lib/edit——两个包内部都不再有模块级实例（由 eslint module-state 门禁加 ' +
        'scripts/verify/editorShims.js 的「唯一 new 点」断言共同保证），故本规则的 core 半边不再是主要守卫。' +
        'editor 半边：仍在 editor 的 3 个 singleton（projectData / projectModel / editorConfigService，' +
        'Phase 5/11 处理）按**导入说明符**匹配——本仓实测 dependency-cruiser 不解析 `@/` 别名，' +
        '按解析后路径写的规则是空转的（Pitfall 5）。coreBoundaries.js 目前只 cruise 两个包的 lib，' +
        '故 editor 半边处于「已就位、待生效」：Phase 11 组合根建立并把 editor 根加入 cruise 目标后自动生效；' +
        '本阶段由 scripts/verify/editorShims.js 承担真正可失败的守卫。' +
        '刻意用 forbidden（而非 required + module.numberOfDependentsLessThan，后者只在 forbidden 上下文可用，Pitfall 7）。',
      severity: 'error',
      from: { pathNot: '^packages/apps/editor/src/appInstances\\.ts$' },
      to: {
        path:
          '^(?:@/project/data/projectData|@/project/model/projectModel|@/services/editorConfig' +
          '|\\.{1,2}/.*(?:projectData|projectModel|editorConfigService))$',
      },
    },
  ],
  options: {
    doNotFollow: { path: '^node_modules' },
    // 让 enhanced-resolve 遵守包的 `exports` 映射：dependency-cruiser 默认把 `exportsFields` 置空
    // （为兼容 enhanced-resolve 4），于是纯 `exports` 包（无 `main`/`module`/`default` 条件）会
    // `couldNotResolve`。Phase 4 起资源层依赖 `alien-signals`，正是这种纯 `exports` 包，
    // 而 `scripts/verify/coreBoundaries.js` 只容忍 `@styled-system/*` 的未解析边。
    // 下面两项就是 dependency-cruiser `init-config` 模板自身推荐的取值（见其 config-template.mjs）。
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
    },
  },
};
