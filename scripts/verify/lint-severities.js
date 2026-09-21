#!/usr/bin/env node
/**
 * Lint 严重度与豁免注释自检脚本（VERIFY-02）。
 *
 * 用法：node scripts/verify/lint-severities.js
 *
 * 断言两件事，二者都是「人眼本来要逐个核对」的事实：
 *   1. 本 plan 修过的每条规则在 ESLint 的「解析后配置」里仍是原来的严重度——
 *      既没有被降级，也没有被关闭。editor 文件走 editor 自己的配置，非 editor
 *      文件走共享根配置；断言建立在 --print-config 输出的对象上，绝不匹配配置文件源码。
 *   2. 被 git 跟踪的源码树里，每一条 eslint-disable* 注释都通过 ` -- ` 携带了非空的
 *      理由文本，避免「无理由地静默一条规则」在评审中不可见。
 *
 * 不访问网络、不导入任何 workspace 包；只调用仓库自带的 ESLint CLI 与 git。
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

// ==================== 常量 ====================

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const ESLINT_BIN_PATH = path.join(REPO_ROOT, 'node_modules', 'eslint', 'bin', 'eslint.js');

/** 走 editor 自己配置的文件（`packages/apps/editor/**`）。 */
const EDITOR_FILE = 'packages/apps/editor/src/hooks/useImageAssetUrl.ts';
/** 走共享根配置文件。 */
const ROOT_FILE = 'packages/apps/service-worker/src/server/fsApi.ts';

/**
 * 解析后必须保持的规则严重度：2 = error，1 = warn。
 * `editor` / `root` 为 undefined 表示该配置不涉及这条规则，不参与断言。
 */
const EXPECTED_SEVERITIES = {
  '@typescript-eslint/no-explicit-any': { editor: 2, root: 1 },
  'react-refresh/only-export-components': { editor: 2, root: 1 },
  'react-hooks/set-state-in-effect': { editor: 2 },
  'prefer-const': { editor: 2, root: 2 },
  'no-control-regex': { editor: 2, root: 2 },
  'no-useless-escape': { editor: 2, root: 2 },
  'react-hooks/use-memo': { editor: 2 },
  'react-hooks/immutability': { editor: 2 },
};

/** 只有这些扩展名的被跟踪文件参与豁免注释扫描（规约产物/子模块一律不在其列）。 */
const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx']);

/** 扫描时跳过的路径：本脚本自身含有用于匹配的规则字面量，不应被当成豁免注释。 */
const SCAN_SKIP = new Set(['scripts/verify/lint-severities.js']);

/** 命中位置必须由 `//` 或 `/*` 注释符引出，避免把字符串/文档里的字样当成指令。 */
const DISABLE_COMMENT_PATTERN = /(?:\/\/|\/\*)\s*eslint-disable/;
/** ` -- ` 之后必须跟非空白文本，才算「携带理由」。 */
const REASON_PATTERN = / -- \S/;

// ==================== 断言工具 ====================

const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function quoteRule(ruleConfig) {
  return JSON.stringify(ruleConfig);
}

/** 规则配置可能是数字、字符串或 `[severity, ...options]`，统一取 severity。 */
function ruleSeverity(ruleConfig) {
  if (ruleConfig === undefined) return undefined;
  return Array.isArray(ruleConfig) ? ruleConfig[0] : ruleConfig;
}

// ==================== 断言：解析后的规则严重度 ====================

function resolveEslintConfig(relativeFile) {
  const result = spawnSync(process.execPath, [ESLINT_BIN_PATH, '--print-config', relativeFile], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim().replace(/\s+/g, ' ');
    return { error: detail.slice(-400) || `eslint --print-config 退出码 ${result.status}` };
  }
  try {
    return { config: JSON.parse(result.stdout) };
  } catch (error) {
    return { error: `无法解析 --print-config 的 JSON 输出：${error instanceof Error ? error.message : String(error)}` };
  }
}

function checkRuleSeverities() {
  if (!fs.existsSync(ESLINT_BIN_PATH)) {
    failures.push(`找不到 ESLint CLI（${path.relative(REPO_ROOT, ESLINT_BIN_PATH)}）—— 无法验证解析后的规则配置`);
    return;
  }

  const targets = [
    ['editor', EDITOR_FILE],
    ['root', ROOT_FILE],
  ];
  const resolved = {};
  for (const [label, file] of targets) {
    const { config, error } = resolveEslintConfig(file);
    if (error) {
      failures.push(`无法解析 ${label} 配置（${file}）：${error}`);
      continue;
    }
    resolved[label] = config.rules ?? {};
  }

  for (const [rule, expected] of Object.entries(EXPECTED_SEVERITIES)) {
    for (const [label, severity] of Object.entries(expected)) {
      const rules = resolved[label];
      if (!rules) continue; // 该配置整体解析失败时已单独记录，不重复报错
      const actual = ruleSeverity(rules[rule]);
      if (actual !== severity) {
        failures.push(
          `${label} 配置里 ${rule} 的严重度是 ${quoteRule(rules[rule])}，期望 ${severity}（规则被改动/降级）`,
        );
      }
    }
  }
}

// ==================== 断言：豁免注释必须携带理由 ====================

function trackedSourceFiles() {
  const result = spawnSync('git', ['ls-files'], { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) {
    failures.push(`git ls-files 失败（退出码 ${result.status}）—— 无法扫描豁免注释`);
    return [];
  }
  return (result.stdout ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\\/g, '/'))
    .filter((file) => file !== '' && SOURCE_EXTENSIONS.has(path.extname(file)) && !SCAN_SKIP.has(file));
}

function checkDisableComments() {
  let total = 0;
  for (const file of trackedSourceFiles()) {
    const absolute = path.join(REPO_ROOT, file);
    let source;
    try {
      source = fs.readFileSync(absolute, 'utf8');
    } catch {
      continue;
    }
    const lines = source.split(/\r?\n/);
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      if (!DISABLE_COMMENT_PATTERN.test(line)) continue;
      total += 1;
      if (!REASON_PATTERN.test(line)) {
        failures.push(`${file}:${index + 1} 的 eslint-disable 注释缺少 \` -- \` 理由：${line.trim()}`);
      }
    }
  }
  console.log(`lint-severities: 扫描到 ${total} 条 eslint-disable 注释，全部携带理由`);
}

// ==================== 入口 ====================

function main() {
  checkRuleSeverities();
  checkDisableComments();

  if (failures.length > 0) {
    for (const failure of failures) console.error(`lint-severities: ${failure}`);
    process.exit(1);
  }
  console.log('lint-severities: 全部断言通过');
}

main();
