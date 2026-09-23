import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import eslintPluginPrettier from 'eslint-plugin-prettier';
import betterExhaustiveDeps from 'eslint-plugin-react-hooks-better-stable';
import editorConfig from './packages/apps/editor/eslint.config.js';

const rootConfig = tseslint.config(
  {
    ignores: ['**/dist/', '**/styled-system/', 'packages/external/'],
  },
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      stylistic.configs.customize({
        indent: 2,
        quotes: 'single',
        semi: true,
        jsx: true,
        braceStyle: '1tbs',
        arrowParens: true,
      }),
      // 必须放在最后：flat config 后者胜出，这一条关闭与 Prettier 冲突的格式规则。
      eslintConfigPrettier,
    ],
    files: ['**/*.{js,ts,tsx}'],
    ignores: ['packages/apps/editor/**'],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'react-hooks-better-stable': betterExhaustiveDeps,
      prettier: eslintPluginPrettier,
    },
    rules: {
      // 格式由 Prettier 独占：ESLint 只负责把差异报成 error。
      'prettier/prettier': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-refresh/only-export-components': [
        'warn',
        {
          allowConstantExport: true,
        },
      ],
      'react-hooks-better-stable/exhaustive-deps': [
        'warn',
        {
          markStableValuesAsUnnecessary: true,
          checkReactiveFunctionOutputIsStable: true,
          stableHooks: {
            useStatic: true,
            useRefFrom: true,
            useCurrentFn: true,
            useForceUpdate: true,
            useStorageItem: [false, true],
          },
        },
      ],

      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',

      '@stylistic/multiline-ternary': ['error', 'always-multiline', { ignoreJSX: true }],
      '@stylistic/jsx-one-expression-per-line': ['error', { allow: 'single-line' }],
      '@stylistic/padded-blocks': ['off'],

      'no-constant-condition': ['error', { checkLoops: 'none' }],
    },
  },
);

/**
 * Block A —— PORT-02（D-15）：core 不得直接触达平台（网络 / DOM / 环境变量）。
 *
 * `tsconfig.lib.base.json` 开着 `DOM`/`DOM.Iterable`，所以 `window`/`document`/`fetch` 在 core 里
 * 类型检查完全通过——`tsc` 无法守住 PORT-02，这条作用域规则是唯一的静态强制。适配器**可以**用
 * `fetch`（HTTP 传输是它的职责），因此本块只匹配 `packages/libs/editor-core/**`。
 *
 * 本块**刻意不写 `ignores`**：`lib/__tests__/**` 也要覆盖——测试里出现被禁全局同样是真问题。
 * 而 `lib/kernel/core.ts`（组合根）必须继续受 PORT-02 约束，所以它**不能**被本块忽略，
 * 组合根的豁免只属于下面的 Block B。
 */
const corePort02Config = {
  files: ['packages/libs/editor-core/**/*.{ts,tsx}'],
  rules: {
    'no-restricted-globals': [
      'error',
      { name: 'fetch', message: 'editor-core 不得直接 fetch：HTTP 传输属于适配器，请注入 port（D-15/PORT-02）。' },
      {
        name: 'window',
        message: 'editor-core 不得触碰 DOM（window）：宿主能力必须经注入的 port 取得（D-15/PORT-02）。',
      },
      {
        name: 'document',
        message: 'editor-core 不得触碰 DOM（document）：宿主能力必须经注入的 port 取得（D-15/PORT-02）。',
      },
      {
        name: 'navigator',
        message: 'editor-core 不得读取 navigator：宿主信息必须经注入的 port 取得（D-15/PORT-02）。',
      },
      {
        name: 'localStorage',
        message: 'editor-core 不得触碰存储（localStorage）：持久化必须经注入的 port 完成（D-15/PORT-02）。',
      },
      {
        name: 'XMLHttpRequest',
        message: 'editor-core 不得使用 XMLHttpRequest：HTTP 传输属于适配器，请注入 port（D-15/PORT-02）。',
      },
    ],
    'no-restricted-properties': [
      'error',
      {
        object: 'process',
        property: 'env',
        message: 'editor-core 不得读取 process.env：配置必须经注入的 port 传入（D-15/PORT-02）。',
      },
    ],
    // `import.meta.env` 是 `MetaProperty` 而不是 `Identifier`，`no-restricted-properties` 结构上匹配不到它
    // ——该遗漏由 03-RESEARCH.md 的实测探针证实，因此必须用 `no-restricted-syntax` 选择器补齐。
    'no-restricted-syntax': [
      'error',
      {
        selector: 'MemberExpression[object.type="MetaProperty"][property.name="env"]',
        message: 'editor-core 不得读取 import.meta.env：配置必须经注入的 port 传入（D-15/PORT-02）。',
      },
    ],
  },
};

/**
 * Block B —— module state（KERN-06 的结构半边 / D-10 + D-22 细化）：core 生产源码不得有模块级可变绑定。
 *
 * `ignores` 恰好两项，都是有意的：
 *   - `lib/kernel/core.ts` —— 组合根拥有拆除栈与 `disposed` 标志，是 D-10 唯一豁免的生产文件；
 *   - `lib/__tests__/**` —— D-22 的有意识细化：测试不随产品发布，且合法地需要模块级 fixture 表。
 *     （测试侧的纪律作为约定保留，但不受机器强制；Block A 仍然覆盖这些文件。）
 *
 * ⚠️ 两个 flat-config 块的重复**不得**被「整理」掉。flat config 对**数组型**规则不做跨块合并——
 * 后匹配的块会**整体替换**先匹配块的 options。因此：
 *   - `import.meta.env` 选择器必须同时出现在 Block A 与 Block B；
 *   - Block B 必须携带**完整**的 module-state 选择器集合。
 * 否则：除 `core.ts` 外的每个 core 文件都会同时命中两块，`import.meta.env` 选择器会被 Block B 覆盖掉；
 * `core.ts` 只命中 Block A（globals/properties/env 选择器）；`lib/__tests__/**` 也只命中 Block A。
 *
 * `Object.freeze({...})` / `{...} as const` 结构上豁免：`>` 子组合子只匹配**直接子节点**，
 * 而这两种写法里的 `ObjectExpression`/`ArrayExpression` 的父节点是 `CallExpression`/`TSAsExpression`。
 */
const coreModuleStateConfig = {
  files: ['packages/libs/editor-core/**/*.{ts,tsx}'],
  ignores: ['packages/libs/editor-core/lib/kernel/core.ts', 'packages/libs/editor-core/lib/__tests__/**'],
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: 'Program > VariableDeclaration[kind=/^(let|var)$/]',
        message: 'core 生产源码不得有模块级可变绑定（`let`/`var`）：状态必须留在实例闭包或实例字段内（D-10/KERN-06）。',
      },
      {
        selector: 'Program > ExportNamedDeclaration > VariableDeclaration[kind=/^(let|var)$/]',
        message: 'core 生产源码不得导出模块级可变绑定（`let`/`var`）：它是事实上的全局单例（D-10/KERN-06）。',
      },
      {
        selector:
          ':matches(Program > VariableDeclaration, Program > ExportNamedDeclaration > VariableDeclaration)[kind="const"] > VariableDeclarator > :matches(NewExpression[callee.name=/^(Map|Set|WeakMap|WeakSet)$/], ArrayExpression, ObjectExpression)',
        message:
          'core 生产源码不得有模块级可变容器（Map/Set/WeakMap/WeakSet、数组或对象字面量）：请改为 `Object.freeze(...)` / `as const`，或把状态移入实例闭包（D-10/KERN-06）。',
      },
      {
        selector: 'MemberExpression[object.type="MetaProperty"][property.name="env"]',
        message: 'editor-core 不得读取 import.meta.env：配置必须经注入的 port 传入（D-15/PORT-02）。',
      },
    ],
  },
};

export default [
  ...rootConfig,
  corePort02Config,
  coreModuleStateConfig,
  ...editorConfig.map((block) => ({ ...block, basePath: 'packages/apps/editor' })),
];
