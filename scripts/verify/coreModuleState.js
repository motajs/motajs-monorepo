#!/usr/bin/env node
/**
 * editor-core 静态门禁的两极性证明（KERN-06 的结构半边 + PORT-02）。
 *
 * 用法：node scripts/verify/coreModuleState.js
 *
 * 断言的是「门禁真的会响」，而不是「配置文件写对了」：
 *   (a) 真实树 —— `packages/libs/editor-core/lib` 上，三条 `no-restricted-*` 规则在 error 级
 *       （`severity === 2`）必须 0 条。只数 error 级是关键：把 core 作用域的新规则降级成 `warn`
 *       仍会产生 message，却让 `pnpm lint` 以 0 退出——门禁会「看起来活着」。
 *   (b) 模块状态可失败 —— 临时写入一个含模块级 `let`、`export let`、模块级 `new Map()` 的 fixture，
 *       真实 ESLint 必须在这些行给出 error 级 `no-restricted-syntax`；同一 fixture 里的
 *       `Object.freeze({...})` 与 `{...} as const` 必须**不**产生任何受限规则消息（结构性豁免）。
 *   (c) PORT-02 可失败 —— 临时写入一个每条被禁构造各出现一次的 fixture：六条 `no-restricted-globals`
 *       （逐行定位）、`process.env` 的 `no-restricted-properties`、`import.meta.env` 的
 *       `no-restricted-syntax` 都必须以 error 级命中。
 *   (d) 豁免与覆盖面是真的 —— `lib/kernel/core.ts`（组合根）与 `lib/__tests__/**` 的**解析后**配置里
 *       没有 module-state 选择器，但 PORT-02 规则仍在；且 core.ts 在真实树上 0 条受限规则消息。
 *
 * 两个 fixture 都由本脚本创建与删除，**绝不入库**；删除发生在 `finally`，随后断言文件确实不存在。
 *
 * 为什么需要 (b)/(c)/(d)：`tsconfig.lib.base.json` 开着 DOM lib，所以 `window`/`document`/`fetch`
 * 在 core 里类型检查完全通过，`tsc` 守不住 PORT-02；`no-restricted-properties` 又结构上匹配不到
 * `import.meta.env`（它是 `MetaProperty`，由 03-RESEARCH.md 的实测探针证实）。因此这两条规则只能
 * 靠 ESLint，而「一个无法被证明会红的门禁」与「没有门禁」不可区分（Phase 2 的教训）。
 *
 * 不访问网络、不导入任何 workspace 包；只调用仓库自带的 ESLint CLI。
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

// ==================== 常量 ====================

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const ESLINT_BIN_PATH = path.join(REPO_ROOT, 'node_modules', 'eslint', 'bin', 'eslint.js');

/** 门禁所用的三条规则 id；真实树断言只数这三条。 */
const RESTRICTED_RULES = new Set(['no-restricted-syntax', 'no-restricted-globals', 'no-restricted-properties']);

/** error 级严重度。只有它会让 `pnpm lint` 非零退出。 */
const ERROR_SEVERITY = 2;

const CORE_LIB = 'packages/libs/editor-core/lib';
const CORE_COMPOSITION_ROOT = `${CORE_LIB}/kernel/core.ts`;

/** 被禁的六个全局：每个必须在合成 fixture 上逐行命中。 */
const BANNED_GLOBALS = ['fetch', 'window', 'document', 'navigator', 'localStorage', 'XMLHttpRequest'];

/** eslint.config.js 的 Block B 携带的 module-state 选择器（逐字对应）。 */
const MODULE_STATE_SELECTORS = [
  'Program > VariableDeclaration[kind=/^(let|var)$/]',
  'Program > ExportNamedDeclaration > VariableDeclaration[kind=/^(let|var)$/]',
  ':matches(Program > VariableDeclaration, Program > ExportNamedDeclaration > VariableDeclaration)[kind="const"] > VariableDeclarator > :matches(NewExpression[callee.name=/^(Map|Set|WeakMap|WeakSet)$/], ArrayExpression, ObjectExpression)',
];

/** 两个块都必须携带的 `import.meta.env` 选择器（flat config 不做数组型规则的跨块合并）。 */
const ENV_SELECTOR = 'MemberExpression[object.type="MetaProperty"][property.name="env"]';

/** (b) 模块状态 fixture 的路径（脚本创建、脚本删除，绝不入库）。 */
const MODULE_STATE_FIXTURE = `${CORE_LIB}/__moduleStateProbe__.ts`;
/** (c) PORT-02 fixture 的路径（脚本创建、脚本删除，绝不入库）。 */
const PORT02_FIXTURE = `${CORE_LIB}/__port02Probe__.ts`;

/** (b) 的 fixture 源码：模块级可变绑定 + 两个结构性豁免。 */
const MODULE_STATE_LINES = [
  '/**',
  ' * 合成违规 fixture：模块级可变绑定（coreModuleState.js 创建与删除，绝不入库）。',
  ' */',
  'let moduleScopeCounter = 0;',
  'export let exportedModuleScopeCounter = 0;',
  'export const moduleScopeContainer = new Map<string, number>();',
  'export const FROZEN_LOOKUP = Object.freeze({ alpha: 1 });',
  'export const AS_CONST_TABLE = { beta: 2 } as const;',
  '',
  'export function readModuleScopeCounters(): number {',
  '  moduleScopeCounter += 1;',
  '  return moduleScopeCounter + exportedModuleScopeCounter;',
  '}',
];

const MODULE_STATE_MARKERS = {
  mutableLet: 'let moduleScopeCounter',
  exportedLet: 'export let exportedModuleScopeCounter',
  constContainer: 'new Map<string, number>()',
  frozenExemption: 'FROZEN_LOOKUP',
  asConstExemption: 'AS_CONST_TABLE',
};

/** 必须被拦下的行（键 → 人读标签）。 */
const MODULE_STATE_EXPECTATIONS = [
  ['mutableLet', '模块级 let 绑定'],
  ['exportedLet', '模块级 export let 绑定'],
  ['constContainer', '模块级 const 容器'],
];

/** 必须保持绿色的行（键 → 人读标签）。 */
const MODULE_STATE_EXEMPTIONS = [
  ['frozenExemption', 'Object.freeze(...)'],
  ['asConstExemption', 'as const'],
];

/** (c) 的 fixture 源码：每条被禁构造各出现一次，且都在函数体内（不与 module-state 规则重叠）。 */
const PORT02_LINES = [
  '/**',
  ' * 合成违规 fixture：每条被禁构造各出现一次（coreModuleState.js 创建与删除，绝不入库）。',
  ' */',
  'export function port02Probe(): unknown[] {',
  "  const endpoint = fetch('/probe');",
  '  const viewportWidth = window.innerWidth;',
  '  const documentTitle = document.title;',
  '  const userAgent = navigator.userAgent;',
  "  const stored = localStorage.getItem('probe');",
  '  const request = new XMLHttpRequest();',
  '  const processMode = process.env.PROBE_MODE;',
  '  const envMode = import.meta.env.PROBE_MODE;',
  '  return [endpoint, viewportWidth, documentTitle, userAgent, stored, request, processMode, envMode];',
  '}',
];

const PORT02_MARKERS = {
  fetch: 'fetch(',
  window: 'window.',
  document: 'document.',
  navigator: 'navigator.',
  localStorage: 'localStorage.',
  XMLHttpRequest: 'new XMLHttpRequest()',
  processEnv: 'process.env',
  importMetaEnv: 'import.meta.env',
};

// ==================== 断言工具 ====================

const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function relative(absolutePath) {
  return path.relative(REPO_ROOT, absolutePath).replace(/\\/g, '/');
}

function describeMessages(messages) {
  if (messages.length === 0) return '（无）';
  return messages.map((message) => `${message.ruleId ?? 'fatal'}@${message.line}:sev${message.severity}`).join(' | ');
}

/** 用行数组构造 fixture 源码，并以唯一子串反查行号——不把行号写死，注释增删也不会静默错位。 */
function buildFixture(lines, markers) {
  const lineOf = {};
  for (const [key, needle] of Object.entries(markers)) {
    const index = lines.findIndex((line) => line.includes(needle));
    lineOf[key] = index === -1 ? -1 : index + 1;
  }
  return { source: `${lines.join('\n')}\n`, lineOf };
}

/** 断言某一行被指定规则以 error 级命中。 */
function checkLineViolation(messages, line, ruleId, label) {
  if (line <= 0) {
    check(false, `${label} 的定位标记在 fixture 里找不到 —— 断言无法定位`);
    return;
  }
  const hit = messages.some(
    (message) => message.line === line && message.ruleId === ruleId && message.severity === ERROR_SEVERITY,
  );
  check(hit, `${label}（第 ${line} 行）未被 ${ruleId} 以 error 级命中：${describeMessages(messages)}`);
}

/** 断言某一行没有产生任何受限规则消息（用于结构性豁免）。 */
function checkLineClean(messages, line, label) {
  if (line <= 0) {
    check(false, `${label} 的定位标记在 fixture 里找不到 —— 断言无法定位`);
    return;
  }
  const at = messages.filter((message) => message.line === line);
  check(
    at.length === 0,
    `${label}（第 ${line} 行）不应产生任何受限规则消息，实际 ${at.length} 条：${describeMessages(at)}`,
  );
}

// ==================== ESLint 调用 ====================

/** 用仓库自带的 ESLint 跑 `--format json`，解析出扁平的消息列表。非零退出码是正常的（有 error 就会非零）。 */
function runEslintJson(targets) {
  const result = spawnSync(process.execPath, [ESLINT_BIN_PATH, '--format', 'json', ...targets], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) return { error: `无法运行 ESLint：${result.error.message}` };
  let report;
  try {
    report = JSON.parse(result.stdout ?? '');
  } catch (error) {
    const detail = (result.stderr ?? '').trim().replace(/\s+/g, ' ').slice(-300);
    return { error: `无法解析 ESLint 的 JSON 输出：${error.message}（stderr：${detail || '空'}）` };
  }
  if (!Array.isArray(report)) return { error: 'ESLint 的 JSON 输出不是数组 —— 无法读取消息' };

  const messages = [];
  for (const file of report) {
    for (const message of file.messages ?? []) {
      messages.push({
        ruleId: message.ruleId ?? null,
        severity: message.severity,
        message: message.message ?? '',
        line: message.line ?? 0,
        filePath: file.filePath ?? '',
      });
    }
  }
  return { messages, fileCount: report.length, status: result.status };
}

/** 读某个文件的**解析后**配置（`--print-config`），用于断言作用域真的分开了。 */
function resolveConfig(relativeFile) {
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
    return { error: `无法解析 --print-config 的 JSON 输出：${error.message}` };
  }
}

/** 取 `no-restricted-syntax` 的解析结果：严重度 + 选择器列表。 */
function selectorsOf(rules) {
  const entry = rules['no-restricted-syntax'];
  if (!Array.isArray(entry)) return { severity: entry, selectors: [] };
  return { severity: entry[0], selectors: entry.slice(1).map((item) => item.selector) };
}

/** 找 `lib/__tests__/**` 下的第一个测试文件（D-22 的排除对象）。 */
function firstTestFile() {
  const testsDir = path.join(REPO_ROOT, CORE_LIB, '__tests__');
  if (!fs.existsSync(testsDir)) return null;
  const entries = fs
    .readdirSync(testsDir)
    .filter((name) => /\.test\.tsx?$/.test(name))
    .sort();
  return entries.length > 0 ? `${CORE_LIB}/__tests__/${entries[0]}` : null;
}

// ==================== (a) 真实树 ====================

function checkRealTree() {
  const run = runEslintJson([CORE_LIB]);
  if (run.error) {
    check(false, run.error);
    return;
  }
  check(run.fileCount > 0, `真实树 lint 没有覆盖任何文件（目标 ${CORE_LIB}）—— 门禁无从生效`);
  const restricted = run.messages.filter((message) => RESTRICTED_RULES.has(message.ruleId));
  const restrictedErrors = restricted.filter((message) => message.severity === ERROR_SEVERITY);
  check(
    restrictedErrors.length === 0,
    `真实树出现 ${restrictedErrors.length} 条 error 级受限规则消息（期望 0）：${describeMessages(restrictedErrors)}`,
  );
  console.log(
    `coreModuleState: 真实树 lint 通过（${run.fileCount} 个文件，受限规则 error 级 0 条，受限规则任意级别 ${restricted.length} 条）`,
  );
}

// ==================== (b) 模块状态门禁可失败 ====================

function checkModuleStateCanFail() {
  const fixture = buildFixture(MODULE_STATE_LINES, MODULE_STATE_MARKERS);
  const absolute = path.join(REPO_ROOT, MODULE_STATE_FIXTURE);
  fs.writeFileSync(absolute, fixture.source, 'utf8');
  let run = { error: '未运行' };
  try {
    run = runEslintJson([MODULE_STATE_FIXTURE]);
  } finally {
    fs.rmSync(absolute, { force: true });
  }

  if (run.error) {
    check(false, `模块状态 fixture 的 lint 失败：${run.error}`);
  } else {
    const restricted = run.messages.filter((message) => RESTRICTED_RULES.has(message.ruleId));
    check(restricted.length > 0, '模块状态 fixture 未产生任何受限规则消息 —— module-state 门禁没有生效');
    check(
      restricted.some((message) => message.ruleId === 'no-restricted-syntax' && message.severity === ERROR_SEVERITY),
      `模块状态 fixture 未产生 error 级 no-restricted-syntax 消息：${describeMessages(restricted)}`,
    );
    const downgraded = restricted.filter((message) => message.severity !== ERROR_SEVERITY);
    check(
      downgraded.length === 0,
      `模块状态 fixture 上有 ${downgraded.length} 条非 error 级受限规则消息（严重度被下调）：${describeMessages(downgraded)}`,
    );
    for (const [key, label] of MODULE_STATE_EXPECTATIONS) {
      checkLineViolation(restricted, fixture.lineOf[key], 'no-restricted-syntax', label);
    }
    for (const [key, label] of MODULE_STATE_EXEMPTIONS) {
      checkLineClean(restricted, fixture.lineOf[key], label);
    }
    console.log(
      `coreModuleState: 模块状态门禁可失败（模块级 let / export let / const 容器各被 error 级拦下；` +
        'Object.freeze 与 as const 结构性豁免）',
    );
  }

  check(!fs.existsSync(absolute), `模块状态 fixture 未被删除：${MODULE_STATE_FIXTURE}`);
}

// ==================== (c) PORT-02 门禁可失败 ====================

function checkPort02CanFail() {
  const fixture = buildFixture(PORT02_LINES, PORT02_MARKERS);
  const absolute = path.join(REPO_ROOT, PORT02_FIXTURE);
  fs.writeFileSync(absolute, fixture.source, 'utf8');
  let run = { error: '未运行' };
  try {
    run = runEslintJson([PORT02_FIXTURE]);
  } finally {
    fs.rmSync(absolute, { force: true });
  }

  if (run.error) {
    check(false, `PORT-02 fixture 的 lint 失败：${run.error}`);
  } else {
    const restricted = run.messages.filter((message) => RESTRICTED_RULES.has(message.ruleId));
    const downgraded = restricted.filter((message) => message.severity !== ERROR_SEVERITY);
    check(
      downgraded.length === 0,
      `PORT-02 fixture 上有 ${downgraded.length} 条非 error 级受限规则消息（严重度被下调）：${describeMessages(downgraded)}`,
    );
    for (const name of BANNED_GLOBALS) {
      checkLineViolation(restricted, fixture.lineOf[name], 'no-restricted-globals', `被禁全局 ${name}`);
    }
    checkLineViolation(restricted, fixture.lineOf.processEnv, 'no-restricted-properties', 'process.env');
    checkLineViolation(restricted, fixture.lineOf.importMetaEnv, 'no-restricted-syntax', 'import.meta.env');
    console.log(
      `coreModuleState: PORT-02 门禁可失败（六条被禁全局逐行命中，process.env 与 import.meta.env 各被 error 级拦下）`,
    );
  }

  check(!fs.existsSync(absolute), `PORT-02 fixture 未被删除：${PORT02_FIXTURE}`);
}

// ==================== (d) 豁免与覆盖面 ====================

function checkCompositionRootClean() {
  const run = runEslintJson([CORE_COMPOSITION_ROOT]);
  if (run.error) {
    check(false, `组合根 ${CORE_COMPOSITION_ROOT} 的 lint 失败：${run.error}`);
    return;
  }
  const restricted = run.messages.filter((message) => RESTRICTED_RULES.has(message.ruleId));
  check(
    restricted.length === 0,
    `组合根 ${CORE_COMPOSITION_ROOT} 出现 ${restricted.length} 条受限规则消息（期望 0）：${describeMessages(restricted)}`,
  );
  console.log(`coreModuleState: 组合根 ${CORE_COMPOSITION_ROOT} 在真实树上 0 条受限规则消息`);
}

function checkResolvedConfigScoping() {
  const testsFile = firstTestFile();
  if (testsFile === null) {
    check(false, `找不到 ${CORE_LIB}/__tests__/*.test.ts(x) —— 无法断言测试目录的 module-state 豁免`);
  }
  const samples = [[CORE_COMPOSITION_ROOT, '组合根'], ...(testsFile === null ? [] : [[testsFile, '测试目录']])];

  for (const [file, label] of samples) {
    const resolved = resolveConfig(file);
    if (resolved.error) {
      check(false, `无法解析${label} ${file} 的 ESLint 配置：${resolved.error}`);
      continue;
    }
    const rules = resolved.config.rules ?? {};
    const syntax = selectorsOf(rules);
    check(
      syntax.severity === ERROR_SEVERITY,
      `${label} ${file} 的 no-restricted-syntax 严重度应为 2，实际是 ${JSON.stringify(syntax.severity)}`,
    );
    check(
      syntax.selectors.includes(ENV_SELECTOR),
      `${label} ${file} 的 no-restricted-syntax 未解析出 import.meta.env 选择器 —— PORT-02 的 env 半边失效`,
    );
    for (const selector of MODULE_STATE_SELECTORS) {
      check(
        !syntax.selectors.includes(selector),
        `${label} ${file} 仍解析出 module-state 选择器（${selector}）—— 豁免失效`,
      );
    }
    const globals = rules['no-restricted-globals'];
    check(
      Array.isArray(globals) && globals[0] === ERROR_SEVERITY && globals.length - 1 === BANNED_GLOBALS.length,
      `${label} ${file} 的 no-restricted-globals 应为 error 级且恰好 ${BANNED_GLOBALS.length} 条，实际是 ${JSON.stringify(globals)}`,
    );
    const properties = rules['no-restricted-properties'];
    check(
      Array.isArray(properties) && properties[0] === ERROR_SEVERITY,
      `${label} ${file} 的 no-restricted-properties 应为 error 级，实际是 ${JSON.stringify(properties)}`,
    );
  }

  console.log(
    `coreModuleState: ${CORE_COMPOSITION_ROOT} 与 ${testsFile ?? '（未找到测试文件）'} 的解析后配置只保留 PORT-02 规则，` +
      'module-state 选择器被正确豁免',
  );
}

// ==================== 入口 ====================

function main() {
  if (!fs.existsSync(ESLINT_BIN_PATH)) {
    console.error(`coreModuleState: 找不到 ESLint CLI（${relative(ESLINT_BIN_PATH)}）—— 无法验证门禁`);
    process.exit(1);
  }

  checkRealTree();
  checkCompositionRootClean();
  checkModuleStateCanFail();
  checkPort02CanFail();
  checkResolvedConfigScoping();

  if (failures.length > 0) {
    for (const failure of failures) console.error(`coreModuleState: ${failure}`);
    process.exit(1);
  }
  console.log(
    'coreModuleState: 全部断言通过（真实树 0 条 error 级受限规则、模块级 let/export let/const 容器各被拦下、' +
      'Object.freeze 与 as const 结构性豁免、六条被禁全局逐行命中、process.env 与 import.meta.env 各被拦下、' +
      'core.ts 与 lib/__tests__/** 的 module-state 豁免与 PORT-02 覆盖面均成立）',
  );
}

main();
