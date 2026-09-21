#!/usr/bin/env node
/**
 * Prettier 接入自检脚本（VERIFY-02）。
 *
 * 用法：node scripts/verify/prettier-setup.js
 *
 * 断言的是「人眼本来要逐个核对」的接入事实，而不是让脚本重新实现一个格式化器：
 *   1. 从仓库根解析出的 Prettier 配置，单引号是唯一引号风格，伴随选项与约定一致；
 *   2. `.prettierignore` 真的把 pnpm-lock.yaml、`.planning`、`packages/external`、
 *      styled-system、node_modules、dist 这些目录排除在外；
 *   3. 根 `package.json` 暴露 `format` 与 `format:check`，且指向 Prettier CLI；
 *   4. `pnpm-lock.yaml` 声明了三个新增 devDependency。
 *
 * 不访问网络、不导入任何 workspace 包；只用仓库自己的 node_modules 里的 Prettier。
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import prettier from "prettier";

// ==================== 常量 ====================

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");
const PRETTIER_CONFIG_PATH = path.join(REPO_ROOT, ".prettierrc.json");
const PRETTIER_IGNORE_PATH = path.join(REPO_ROOT, ".prettierignore");
const ROOT_PACKAGE_JSON_PATH = path.join(REPO_ROOT, "package.json");
const LOCKFILE_PATH = path.join(REPO_ROOT, "pnpm-lock.yaml");

/** `.prettierrc.json` 必须逐项等于的解析结果（单引号是唯一引号风格）。 */
const EXPECTED_OPTIONS = {
  singleQuote: true,
  jsxSingleQuote: false,
  semi: true,
  useTabs: false,
  tabWidth: 2,
  trailingComma: "all",
  printWidth: 120,
  arrowParens: "always",
  bracketSpacing: true,
  quoteProps: "as-needed",
  endOfLine: "lf",
};

/** 必须被 `.prettierignore` 排除的路径（标签仅用于报错信息）。 */
const MUST_BE_IGNORED = [
  ["pnpm-lock.yaml", path.join(REPO_ROOT, "pnpm-lock.yaml")],
  [".planning/**", path.join(REPO_ROOT, ".planning", "PROJECT.md")],
  ["packages/external/**", path.join(REPO_ROOT, "packages", "external", "mota-js", "index.html")],
  ["**/styled-system/**", path.join(REPO_ROOT, "packages", "apps", "editor", "styled-system", "helpers.mjs")],
  ["node_modules/**", path.join(REPO_ROOT, "node_modules", "prettier", "package.json")],
  ["**/dist/**", path.join(REPO_ROOT, "packages", "apps", "editor", "dist", "index.html")],
];

/** 本 plan 新增的三个 devDependency。 */
const NEW_DEV_DEPENDENCIES = ["prettier", "eslint-config-prettier", "eslint-plugin-prettier"];

// ==================== 断言工具 ====================

const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ==================== 断言：配置文件 ====================

function checkConfigFiles() {
  check(
    fs.existsSync(PRETTIER_CONFIG_PATH),
    "缺少 .prettierrc.json —— Prettier 没有唯一的配置文件",
  );
  check(
    fs.existsSync(PRETTIER_IGNORE_PATH),
    "缺少 .prettierignore —— 生成物/第三方/规划产物随时可能被改写",
  );
  for (const candidate of ["prettier.config.js", "prettier.config.mjs", "prettier.config.cjs", "prettier.config.ts", ".prettierrc", ".prettierrc.js", ".prettierrc.cjs", ".prettierrc.yaml", ".prettierrc.yml"]) {
    check(
      !fs.existsSync(path.join(REPO_ROOT, candidate)),
      `仓库根出现第二个 Prettier 配置 ${candidate} —— 必须只有 .prettierrc.json 一处配置`,
    );
  }
}

// ==================== 断言：解析出的配置 ====================

async function checkResolvedConfig() {
  const resolved = await prettier.resolveConfig(path.join(REPO_ROOT, "package.json"));
  if (!resolved) {
    failures.push("prettier.resolveConfig() 返回 null —— 从仓库根解析不到 .prettierrc.json");
    return;
  }
  for (const [key, expected] of Object.entries(EXPECTED_OPTIONS)) {
    if (resolved[key] !== expected) {
      failures.push(
        `解析出的 Prettier 选项 ${key} 是 ${JSON.stringify(resolved[key])}，期望 ${JSON.stringify(expected)}`,
      );
    }
  }
}

// ==================== 断言：忽略规则 ====================

async function checkIgnoreRules() {
  for (const [label, absolutePath] of MUST_BE_IGNORED) {
    const info = await prettier.getFileInfo(absolutePath, {
      ignorePath: PRETTIER_IGNORE_PATH,
      resolveConfig: false,
    });
    check(
      info.ignored === true,
      `${label} 未被 Prettier 忽略（${path.relative(REPO_ROOT, absolutePath).replace(/\\/g, "/")}）`,
    );
  }
}

// ==================== 断言：脚本文面 ====================

function checkScripts() {
  if (!fs.existsSync(ROOT_PACKAGE_JSON_PATH)) {
    failures.push("找不到根 package.json");
    return;
  }
  const rootPackage = JSON.parse(fs.readFileSync(ROOT_PACKAGE_JSON_PATH, "utf8"));
  const scripts = rootPackage.scripts ?? {};
  check(
    typeof scripts.format === "string" && /^prettier\s+--write\b/.test(scripts.format),
    `根 package.json 的 format 脚本应指向 Prettier 的 --write，实际是 ${JSON.stringify(scripts.format)}`,
  );
  check(
    typeof scripts["format:check"] === "string" && /^prettier\s+--check\b/.test(scripts["format:check"]),
    `根 package.json 的 format:check 脚本应指向 Prettier 的 --check，实际是 ${JSON.stringify(scripts["format:check"])}`,
  );
}

// ==================== 断言：lockfile 声明 ====================

function checkLockfile() {
  if (!fs.existsSync(LOCKFILE_PATH)) {
    failures.push("找不到 pnpm-lock.yaml");
    return;
  }
  const lockfile = fs.readFileSync(LOCKFILE_PATH, "utf8");
  for (const name of NEW_DEV_DEPENDENCIES) {
    const catalogEntry = new RegExp(`^    ${escapeRegExp(name)}:$`, "m");
    const packageEntry = new RegExp(`^  ${escapeRegExp(name)}@[^:\\n]+:$`, "m");
    check(
      catalogEntry.test(lockfile),
      `pnpm-lock.yaml 的 catalog 未声明 ${name}`,
    );
    check(
      packageEntry.test(lockfile),
      `pnpm-lock.yaml 未解析出 ${name} 的包条目`,
    );
  }
}

// ==================== 入口 ====================

async function main() {
  checkConfigFiles();
  await checkResolvedConfig();
  await checkIgnoreRules();
  checkScripts();
  checkLockfile();

  if (failures.length > 0) {
    for (const failure of failures) console.error(`prettier-setup: ${failure}`);
    process.exit(1);
  }
  console.log("prettier-setup: 全部断言通过");
}

await main();
