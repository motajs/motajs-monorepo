import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import stylistic from "@stylistic/eslint-plugin";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import eslintPluginPrettier from "eslint-plugin-prettier";
import betterExhaustiveDeps from "eslint-plugin-react-hooks-better-stable";
import editorConfig from "./packages/apps/editor/eslint.config.js";

const rootConfig = tseslint.config(
  {
    ignores: [
      "**/dist/",
      "**/styled-system/",
      "packages/external/",
    ],
  },
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      stylistic.configs.customize({
        indent: 2,
        quotes: "single",
        semi: true,
        jsx: true,
        braceStyle: "1tbs",
        arrowParens: true,
      }),
      // 必须放在最后：flat config 后者胜出，这一条关闭与 Prettier 冲突的格式规则。
      eslintConfigPrettier,
    ],
    files: [
      "**/*.{js,ts,tsx}",
    ],
    ignores: [
      "packages/apps/editor/**",
    ],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "react-hooks-better-stable": betterExhaustiveDeps,
      prettier: eslintPluginPrettier,
    },
    rules: {
      // 格式由 Prettier 独占：ESLint 只负责把差异报成 error。
      "prettier/prettier": "error",
      "react-hooks/rules-of-hooks": "error",
      "react-refresh/only-export-components": ["warn", {
        allowConstantExport: true,
      }],
      "react-hooks-better-stable/exhaustive-deps": ["warn", {
        markStableValuesAsUnnecessary: true,
        checkReactiveFunctionOutputIsStable: true,
        stableHooks: {
          useStatic: true,
          useRefFrom: true,
          useCurrentFn: true,
          useForceUpdate: true,
          useStorageItem: [false, true],
        },
      }],

      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",

      "@stylistic/multiline-ternary": ["error", "always-multiline", { ignoreJSX: true }],
      "@stylistic/jsx-one-expression-per-line": ["error", { allow: "single-line" }],
      "@stylistic/padded-blocks": ["off"],

      "no-constant-condition": ["error", { checkLoops: "none" }],
    },
  },
);

export default [
  ...rootConfig,
  ...editorConfig.map((block) => ({ ...block, basePath: "packages/apps/editor" })),
];
