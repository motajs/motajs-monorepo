import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import stylistic from "@stylistic/eslint-plugin";
import betterExhaustiveDeps from "eslint-plugin-react-hooks-better-stable";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "node_modules",
    ],
  },
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      stylistic.configs.customize({
        indent: 2,
        quotes: "double",
        semi: true,
        jsx: true,
        braceStyle: "1tbs",
        arrowParens: true,
      }),
    ],
    files: [
      "**/*.{js,ts,tsx}",
    ],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "react-hooks-better-stable": betterExhaustiveDeps,
    },
    rules: {
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

      "@typescript-eslint/no-unused-vars": "off",
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
