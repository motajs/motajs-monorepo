#!/usr/bin/env node
/**
 * 「禁 `import type`」门禁的两极性证明（D-11）。
 *
 * 用法：node scripts/verify/coreImportType.js
 *
 * 断言的是「门禁真的会响」，而不是「此刻恰好没有 import type」：
 *   (a) 真实树 —— `packages/libs/editor-core/lib` 与 `packages/libs/editor-impl/lib` 下的
 *       **全部** `*.ts`/`*.tsx`（包含 `__tests__` 与 `*.test.*`，因为 D-11 覆盖全包含测试）
 *       都不得出现行首的 `import type`。类型仍经 `export type` 再导出（D-11 只禁 import type）。
 *       若真实树为红，那是真实的违规源码，必须去改源码，**绝不**放宽规则或缩小范围。
 *   (b) 可失败 —— 临时往 editor-core 的 `lib/__tests__/` 写一个含两处 `import type`（并夹一条普通
 *       import）的 fixture：门禁必须**逐行**命中两条 `import type`，且普通 import 那一行**不**被误报；
 *       fixture 在 `finally` 里删除，随后断言其确实不存在。
 *
 * 非空转底线：真实树扫描的文件数必须不低于 `MIN_EXPECTED_SOURCES`。该下界高于「只扫生产源码」
 * 的文件数，因此把 `__tests__` 排除出扫描范围会让门禁立刻变红——范围被静默削弱可被观测。
 *
 * 只读文件系统，不访问网络、不导入任何 workspace 包。
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

// ==================== 常量 ====================

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');

/** 扫描范围根（D-11）：两个包的 lib 全量，包含测试树。 */
const CORE_LIBS = ['packages/libs/editor-core/lib', 'packages/libs/editor-impl/lib'];
const CORE_LIB_ABS = CORE_LIBS.map((lib) => path.join(REPO_ROOT, lib));

/** 行首锚定的 `import type` 模式：D-11 的机器判定。 */
const IMPORT_TYPE_PATTERN = /^\s*import\s+type\b/;

/**
 * 真实树非空转底线：两个包全量源码文件数的保守下界。它**高于**「排除测试树」的文件数，
 * 因此一旦扫描范围被削弱（glob 写错、排除规则被放大），扫描数会塌到下界以下并立刻变红。
 */
const MIN_EXPECTED_SOURCES = 55;

/** 两极性 fixture 的路径与源码（脚本创建、脚本删除，绝不入库）；刻意落在 `__tests__` 内。 */
const PROBE_FIXTURE_PATH = `${CORE_LIBS[0]}/__tests__/__importTypeProbe__.ts`;
const PROBE_FIXTURE_ABS = path.join(REPO_ROOT, PROBE_FIXTURE_PATH);
const PROBE_FIXTURE_LINES = [
  '/**',
  ' * 合成违规 fixture：两处 import type 必须被逐行命中（coreImportType.js 创建与删除，绝不入库）。',
  ' */',
  "import type { ProbeAlpha } from './probe-alpha';",
  "import { keepAlpha } from './probe-keep';",
  "import type { ProbeBeta } from './probe-beta';",
  '',
  'export const probeAlpha: ProbeAlpha = { alpha: 1 };',
  'export const probeBeta: ProbeBeta = { beta: 2 };',
  'export const probeKeep = keepAlpha;',
];
const PROBE_FIXTURE_MARKERS = {
  alphaImport: "'./probe-alpha'",
  keepImport: "'./probe-keep'",
  betaImport: "'./probe-beta'",
};

/** fixture 里必须被命中的行（键 → 人读标签）。 */
const PROBE_FIXTURE_EXPECTATIONS = [
  ['alphaImport', '第一处 import type'],
  ['betaImport', '第二处 import type'],
];

/** fixture 里必须保持干净的行（键 → 人读标签）。 */
const PROBE_FIXTURE_CLEAN_CASES = [['keepImport', '普通 import（不得误报）']];

// ==================== 断言工具 ====================

const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function relative(absolutePath) {
  return path.relative(REPO_ROOT, absolutePath).replace(/\\/g, '/');
}

/** 用行数组构造 fixture 源码，并以唯一子串反查行号——不写死行号，注释增删也不会静默错位。 */
function buildFixture(lines, markers) {
  const lineOf = {};
  for (const [key, needle] of Object.entries(markers)) {
    const index = lines.findIndex((line) => line.includes(needle));
    lineOf[key] = index === -1 ? -1 : index + 1;
  }
  return { source: `${lines.join('\n')}\n`, lineOf };
}

function formatViolations(violations) {
  if (violations.length === 0) return '（无）';
  return violations.map((violation) => `${violation.relPath}:${violation.line}`).join(' | ');
}

// ==================== 扫描 ====================

/** 递归收集目录下全部 .ts/.tsx 源文件（含 `__tests__` 与 `*.test.*`，D-11 全包含测试）。 */
function collectSources(dir) {
  const results = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name))
        results.push({ relPath: relative(full), source: fs.readFileSync(full, 'utf8') });
    }
  };
  walk(dir);
  results.sort((left, right) => left.relPath.localeCompare(right.relPath));
  return results;
}

/** 合并两个包的 lib 全部源码（逐包 collectSources 后拼接，保持确定性排序）。 */
function collectAllSources() {
  return CORE_LIB_ABS.flatMap((dir) => collectSources(dir)).sort((left, right) =>
    left.relPath.localeCompare(right.relPath),
  );
}

/** 逐文件逐行匹配 `import type`，返回按 `relPath → line` 稳定排序的违规列表。 */
function findViolations(sources) {
  const violations = [];
  for (const file of sources) {
    const lines = file.source.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      if (IMPORT_TYPE_PATTERN.test(lines[index])) {
        violations.push({ relPath: file.relPath, line: index + 1 });
      }
    }
  }
  violations.sort((left, right) => left.relPath.localeCompare(right.relPath) || left.line - right.line);
  return violations;
}

// ==================== (a) 真实树 ====================

let scannedFileCount = 0;

function checkRealTree() {
  const sources = collectAllSources();
  scannedFileCount = sources.length;
  check(sources.length > 0, `没有扫描到任何 ${CORE_LIBS.join('、')}/**/*.{ts,tsx} —— 门禁无从生效`);
  check(
    sources.length >= MIN_EXPECTED_SOURCES,
    `真实树只扫描到 ${sources.length} 个源码文件，低于非空转下界 ${MIN_EXPECTED_SOURCES} —— ` +
      '扫描范围可能被削弱（D-11 覆盖包含 __tests__ 与 *.test.* 的全量源码）',
  );
  const violations = findViolations(sources);
  check(
    violations.length === 0,
    `真实树出现 ${violations.length} 条 import type（期望 0，必须去修源码而非放宽门禁）：` +
      formatViolations(violations),
  );
  console.log(
    `coreImportType: 真实树通过（已扫描 ${scannedFileCount} 个源码文件 ≥ 非空转下界 ${MIN_EXPECTED_SOURCES}，` +
      'import type 违规 0 条）',
  );
}

// ==================== (b) 两极性 ====================

function checkTwoPolarity() {
  check(PROBE_FIXTURE_PATH.includes('__tests__'), '两极性 fixture 必须落在 __tests__ 内，才能证明测试树也被扫描');

  const fixture = buildFixture(PROBE_FIXTURE_LINES, PROBE_FIXTURE_MARKERS);
  fs.writeFileSync(PROBE_FIXTURE_ABS, fixture.source, 'utf8');
  let violations = [];
  try {
    violations = findViolations(collectAllSources());
  } finally {
    fs.rmSync(PROBE_FIXTURE_ABS, { force: true });
  }

  const fixtureViolations = violations.filter((violation) => violation.relPath === PROBE_FIXTURE_PATH);
  for (const [key, label] of PROBE_FIXTURE_EXPECTATIONS) {
    const line = fixture.lineOf[key];
    if (line <= 0) {
      check(false, `${label} 的定位标记在 fixture 里找不到 —— 断言无法定位`);
      continue;
    }
    const onLine = fixtureViolations.filter((violation) => violation.line === line);
    check(
      onLine.length === 1,
      `两极性失败：${label}（第 ${line} 行）未被逐行命中：${formatViolations(fixtureViolations)}`,
    );
  }
  check(
    fixtureViolations.length === PROBE_FIXTURE_EXPECTATIONS.length,
    `两极性失败：fixture 应恰好产生 ${PROBE_FIXTURE_EXPECTATIONS.length} 条违规，实际 ${fixtureViolations.length} 条：` +
      formatViolations(fixtureViolations),
  );

  for (const [key, label] of PROBE_FIXTURE_CLEAN_CASES) {
    const line = fixture.lineOf[key];
    if (line <= 0) {
      check(false, `${label} 的定位标记在 fixture 里找不到 —— 断言无法定位`);
      continue;
    }
    const onLine = fixtureViolations.filter((violation) => violation.line === line);
    check(onLine.length === 0, `${label}（第 ${line} 行）不应被误报：${formatViolations(onLine)}`);
  }

  check(!fs.existsSync(PROBE_FIXTURE_ABS), `两极性 fixture 未被删除：${PROBE_FIXTURE_PATH}`);
  console.log(
    `coreImportType: 两极性成立（fixture 逐行命中全部 ${PROBE_FIXTURE_EXPECTATIONS.length} 条 import type、` +
      `${PROBE_FIXTURE_CLEAN_CASES.length} 个 clean 用例 0 误报，且已删除）`,
  );
}

// ==================== 入口 ====================

function main() {
  for (const [index, abs] of CORE_LIB_ABS.entries()) {
    if (!fs.existsSync(abs)) {
      console.error(`coreImportType: 找不到 ${CORE_LIBS[index]} —— 无法验证门禁`);
      process.exit(1);
    }
  }

  checkRealTree();
  checkTwoPolarity();

  if (failures.length > 0) {
    for (const failure of failures) console.error(`coreImportType: ${failure}`);
    process.exit(1);
  }
  console.log(
    `coreImportType: 全部断言通过（真实树扫描 ${scannedFileCount} 个源码文件、0 条 import type；` +
      `两极性 fixture 逐行命中 ${PROBE_FIXTURE_EXPECTATIONS.length} 条 import type、` +
      `${PROBE_FIXTURE_CLEAN_CASES.length} 个 clean 用例 0 误报并已删除）`,
  );
}

main();
