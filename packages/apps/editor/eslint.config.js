import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import eslintPluginPrettier from 'eslint-plugin-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['dist', '**/styled-system/**']),
  {
    files: ['**/*.{js,cjs,mjs,ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      // 必须放在最后：关闭与 Prettier 冲突的格式规则。
      eslintConfigPrettier,
    ],
    languageOptions: {
      ecmaVersion: 2024,
      globals: globals.browser,
    },
    plugins: {
      prettier: eslintPluginPrettier,
    },
    rules: {
      'prettier/prettier': 'error',
      // 仅把三个 context 模块导出的 4 个 hook 列入白名单（其余仍按 only-export-components 校验）；
      // 这是规则自身的选项，用于收窄既有的误报类别，不改动严重度。
      'react-refresh/only-export-components': [
        'error',
        {
          allowConstantExport: true,
          allowExportNames: [
            'useBlocklyInteractionCapabilities',
            'useEventEditor',
            'useEventEditorRegistration',
            'useCheckboxSetModalAction',
          ],
        },
      ],
      '@typescript-eslint/no-unused-vars': 'warn',
      'prefer-arrow-callback': 'warn',
      'object-shorthand': 'warn',
      'arrow-body-style': ['warn', 'as-needed'],
    },
  },
  {
    files: ['**/*.{cjs,mjs}'],
    languageOptions: {
      globals: globals.node,
    },
  },
]);
