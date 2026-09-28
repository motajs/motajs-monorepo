#!/usr/bin/env node
/**
 * editor-core 引擎标识门禁的两极性证明（PORT-06 / D-12 / D-13）。
 *
 * 用法：node scripts/verify/coreEngineNeutral.js
 *
 * 断言的是「门禁真的会响」，而不是「此刻的术语表恰好是空的」：
 *   (a) 真实树 —— `packages/libs/editor-core/lib` 的生产源码（`*.ts`/`*.tsx`，排除任意带 `__tests__`
 *       段的路径）不得出现任何引擎标识术语。扫描的是**原始源码，注释也算**（Pitfall D）：core 的
 *       注释和代码一样必须与引擎无关，一处藏在 `//` 注释里的泄漏与代码里的泄漏同等禁止。若真实树为红，
 *       那是真实的 core 泄漏，必须去修泄漏源码，**绝不**放宽规则或缩小范围。
 *   (b) 可失败 —— 临时往 core 生产源码写一个 fixture，含每条被禁术语各一次（其中 `autopass` 落在
 *       行注释、`autotile` 落在块注释，证明注释也算原始源码），外加 clean 用例（`Math.floor(...)`
 *       成员访问、`location`/`locState` 假朋友、只有首字母大写的 `Tower`/`Floor` 散文）。门禁必须
 *       **逐行**命中全部被禁术语、且 clean 用例**误报 0 条**；fixture 在 `finally` 里删除，随后断言
 *       其确实不存在。
 *
 * 匹配规则（D-13）：
 *   - 术语表为小写，匹配**大小写敏感**——因此 JSDoc 里的 `Tower data` 这类大写散文天然干净，绝不
 *     做大小写折叠（否则会把合法文档判红）。
 *   - `floor` 的成员访问除外：命中位置的**前一个字符**是 `.`（覆盖 `Math.floor(...)` 与 `.floor(...)`）
 *     时不算违规；这是**逐个命中**的判定，不是换一条正则，两极性 fixture 才能证明该豁免。
 *     独立的 `floor(...)` 仍会被判红——core 不该有这样一个自由函数（Pitfall B）。
 *   - `\b` 词边界保证 `loc` 不会命中 `location`、`locState` 等假朋友（Pitfall C）。
 *
 * 非空转底线：真实树扫描的文件数必须不低于 `MIN_EXPECTED_SOURCES`（一个保守下界，比 `> 0` 更紧，
 * 又不会随 core 增长而误红）。文件数塌到下界以下即为「范围被静默削弱」的信号。
 *
 * 术语表、扫描范围与排除规则都**写死在本脚本内**、不来自任何外部文件，因此不可能被「静默清空」。
 * PORT-07 的词汇半边（迁移用语）同样由 `airwall`/`mota` 两条覆盖。
 *
 * 不访问网络、不导入任何 workspace 包；只读文件系统。
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

// ==================== 常量 ====================

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');

/** 扫描范围根（D-12）：只扫 core 生产源码，排除测试树。 */
const CORE_LIB = 'packages/libs/editor-core/lib';
const CORE_LIB_ABS = path.join(REPO_ROOT, CORE_LIB);

/** 完整术语表（PORT-06 + PORT-07 词汇半边），匹配大小写敏感。 */
const BANNED_TERMS = [
  'tower',
  'floor',
  'loc',
  'autopass',
  'autotile',
  'idnum',
  'airwall',
  'commonEvent',
  'prefab',
  'mota',
];

/** `floor` 的成员访问豁免字符：命中前缀为它时不算违规（Pitfall B / D-13）。 */
const FLOOR_EXEMPT_PRECEDING_CHAR = '.';

/**
 * 真实树非空转底线：core 生产源码文件数的保守下界。它比 `> 0` 更紧——若范围被静默削弱（glob 写错、
 * 排除规则被放大），扫描数会塌到下界以下；刻意不写死精确值，core 增长时不会误红。
 */
const MIN_EXPECTED_SOURCES = 30;

/** 两极性 fixture 的路径（脚本创建、脚本删除，绝不入库）。 */
const PROBE_FIXTURE_PATH = `${CORE_LIB}/__engineNeutralProbe__.ts`;
const PROBE_FIXTURE_ABS = path.join(REPO_ROOT, PROBE_FIXTURE_PATH);

/** (b) 的 fixture 源码：每条被禁术语各出现一次，外加 clean 用例。 */
const PROBE_FIXTURE_LINES = [
  '/**',
  ' * 合成违规 fixture：每条被禁术语各出现一次，外加 clean 用例（coreEngineNeutral.js 创建与删除，绝不入库）。',
  ' */',
  "export const probeTower = 'tower';",
  "export const probeFloor = 'floor';",
  "export const probeLoc = 'loc';",
  '// 行注释里的被禁术语 autopass 必须被命中（Pitfall D：注释也算原始源码）。',
  '/* 块注释里的被禁术语 autotile 必须被命中（Pitfall D：注释也算原始源码）。 */',
  "export const probeIdnum = 'idnum';",
  "export const probeAirwall = 'airwall';",
  "export const probeCommonEvent = 'commonEvent';",
  "export const probePrefab = 'prefab';",
  "export const probeMota = 'mota';",
  'export const probeMathFloor = Math.floor(1.5);',
  'export const probeLocState = locState;',
  'export const probeLocation = location;',
  "export const probeTowerProse = 'Tower data';",
  "export const probeFloorProse = 'Floor note';",
];

/** fixture 里每条术语与 clean 用例的定位标记（以唯一子串反查行号，不写死行号）。 */
const PROBE_FIXTURE_MARKERS = {
  tower: "'tower'",
  floor: "'floor'",
  loc: "'loc'",
  autopass: 'autopass',
  autotile: 'autotile',
  idnum: "'idnum'",
  airwall: "'airwall'",
  commonEvent: "'commonEvent'",
  prefab: "'prefab'",
  mota: "'mota'",
  mathFloor: 'Math.floor(',
  locState: 'locState',
  location: 'location',
  towerProse: 'Tower data',
  floorProse: 'Floor note',
};

/** fixture 里必须被逐行命中的被禁术语（含 `airwall`/`mota`：PORT-07 的词汇半边）。 */
const PROBE_FIXTURE_EXPECTATIONS = [
  ['tower', 'tower（PORT-06 引擎标识）'],
  ['floor', 'floor（PORT-06 引擎标识；仅成员访问豁免）'],
  ['loc', 'loc（PORT-06 引擎标识）'],
  ['autopass', 'autopass（行注释内，证明注释也被扫描）'],
  ['autotile', 'autotile（块注释内，证明注释也被扫描）'],
  ['idnum', 'idnum（PORT-06 引擎标识）'],
  ['airwall', 'airwall（PORT-07 词汇半边）'],
  ['commonEvent', 'commonEvent（PORT-06 引擎标识）'],
  ['prefab', 'prefab（PORT-06 引擎标识）'],
  ['mota', 'mota（PORT-07 词汇半边）'],
];

/** fixture 里必须保持干净的用例（大小写敏感 + 词边界 + floor 成员访问）。 */
const PROBE_FIXTURE_CLEAN_CASES = [
  ['mathFloor', 'Math.floor(...)（floor 成员访问豁免）'],
  ['locState', 'locState（loc 的假朋友，词边界干净）'],
  ['location', 'location（loc 的假朋友，词边界干净）'],
  ['towerProse', 'Tower data（大写散文，大小写敏感下干净）'],
  ['floorProse', 'Floor 大写 token（大小写敏感下干净）'],
];

// ==================== 断言工具 ====================

const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function relative(absolutePath) {
  return path.relative(REPO_ROOT, absolutePath).replace(/\\/g, '/');
}

/** 由绝对下标反查 1 基行号（不把行号写死，注释增删也不会静默错位）。 */
function lineIndexToNumber(source, index) {
  let line = 1;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (source[cursor] === '\n') line += 1;
  }
  return line;
}

/** 用行数组构造 fixture 源码，并以唯一子串反查行号。 */
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
  return violations.map((violation) => `${violation.relPath}:${violation.line}: ${violation.term}`).join(' | ');
}

// ==================== 扫描 ====================

/** 递归收集目录下全部 .ts/.tsx 源文件，跳过任意带 `__tests__` 段的路径（D-12 范围）。 */
function collectSources(dir) {
  const results = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/\.tsx?$/.test(entry.name)) {
        const relPath = relative(full);
        if (relPath.split('/').includes('__tests__')) continue;
        results.push({ relPath, source: fs.readFileSync(full, 'utf8') });
      }
    }
  };
  walk(dir);
  results.sort((left, right) => left.relPath.localeCompare(right.relPath));
  return results;
}

/**
 * 扫描**原始**源码（保留注释，Pitfall D）的每一条被禁术语，返回按 `relPath → line → term` 稳定排序的
 * `{ relPath, term, line }` 列表（确定性输出，失败信息可复读）。大小写敏感；`floor` 命中的前一个字符
 * 是 `.` 时逐个豁免（Pitfall B）。
 */
function findViolations(sources) {
  const violations = [];
  for (const file of sources) {
    for (const term of [...BANNED_TERMS].sort()) {
      const pattern = new RegExp(`\\b${term}\\b`, 'g');
      let match = pattern.exec(file.source);
      while (match !== null) {
        const exempt = term === 'floor' && file.source[match.index - 1] === FLOOR_EXEMPT_PRECEDING_CHAR;
        if (!exempt) {
          violations.push({ relPath: file.relPath, term, line: lineIndexToNumber(file.source, match.index) });
        }
        match = pattern.exec(file.source);
      }
    }
  }
  violations.sort(
    (left, right) =>
      left.relPath.localeCompare(right.relPath) || left.line - right.line || left.term.localeCompare(right.term),
  );
  return violations;
}

// ==================== (a) 真实树 ====================

let scannedFileCount = 0;

function checkRealTree() {
  const sources = collectSources(CORE_LIB_ABS);
  scannedFileCount = sources.length;
  check(sources.length > 0, `没有扫描到任何 ${CORE_LIB}/**/*.{ts,tsx}（排除 __tests__）—— 门禁无从生效`);
  check(
    sources.length >= MIN_EXPECTED_SOURCES,
    `真实树只扫描到 ${sources.length} 个生产文件，低于非空转下界 ${MIN_EXPECTED_SOURCES} —— 扫描范围可能被削弱`,
  );
  const violations = findViolations(sources);
  check(
    violations.length === 0,
    `真实树出现 ${violations.length} 条引擎标识违规（期望 0，必须去修泄漏源码而非放宽门禁）：${formatViolations(violations)}`,
  );
  console.log(
    `coreEngineNeutral: 真实树通过（已扫描 ${scannedFileCount} 个生产文件 ≥ 非空转下界 ${MIN_EXPECTED_SOURCES}，` +
      '引擎标识违规 0 条）',
  );
}

// ==================== (b) 两极性 ====================

function checkTwoPolarity() {
  // 术语表 ↔ fixture 期望必须一一对应：往 BANNED_TERMS 增词而忘了加 fixture 用例，会在这里红。
  const expectedTerms = PROBE_FIXTURE_EXPECTATIONS.map(([term]) => term).sort();
  check(
    expectedTerms.join(',') === [...BANNED_TERMS].sort().join(','),
    `术语表与 fixture 期望不一致：BANNED_TERMS=${[...BANNED_TERMS].sort().join(',')}，` +
      `fixture=${expectedTerms.join(',')}`,
  );

  const fixture = buildFixture(PROBE_FIXTURE_LINES, PROBE_FIXTURE_MARKERS);
  fs.writeFileSync(PROBE_FIXTURE_ABS, fixture.source, 'utf8');
  let violations = [];
  try {
    violations = findViolations(collectSources(CORE_LIB_ABS));
  } finally {
    fs.rmSync(PROBE_FIXTURE_ABS, { force: true });
  }

  const fixtureViolations = violations.filter((violation) => violation.relPath === PROBE_FIXTURE_PATH);
  for (const [term, label] of PROBE_FIXTURE_EXPECTATIONS) {
    const line = fixture.lineOf[term];
    if (line <= 0) {
      check(false, `${label} 的定位标记在 fixture 里找不到 —— 断言无法定位`);
      continue;
    }
    const onLine = fixtureViolations.filter((violation) => violation.line === line && violation.term === term);
    check(onLine.length >= 1, `两极性失败：${label}（第 ${line} 行）未被命中：${formatViolations(fixtureViolations)}`);
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
    check(
      onLine.length === 0,
      `${label}（第 ${line} 行）不应被误报，实际 ${onLine.length} 条：${formatViolations(onLine)}`,
    );
  }

  check(!fs.existsSync(PROBE_FIXTURE_ABS), `两极性 fixture 未被删除：${PROBE_FIXTURE_PATH}`);
  console.log(
    `coreEngineNeutral: 两极性成立（fixture 逐行命中全部 ${PROBE_FIXTURE_EXPECTATIONS.length} 条被禁术语——` +
      `含行/块注释各一，${PROBE_FIXTURE_CLEAN_CASES.length} 个 clean 用例 0 误报，且已删除）`,
  );
}

// ==================== 入口 ====================

function main() {
  if (!fs.existsSync(CORE_LIB_ABS)) {
    console.error(`coreEngineNeutral: 找不到 ${CORE_LIB} —— 无法验证门禁`);
    process.exit(1);
  }

  checkRealTree();
  checkTwoPolarity();

  if (failures.length > 0) {
    for (const failure of failures) console.error(`coreEngineNeutral: ${failure}`);
    process.exit(1);
  }
  console.log(
    `coreEngineNeutral: 全部断言通过（真实树扫描 ${scannedFileCount} 个生产文件、0 条引擎标识违规；` +
      `两极性 fixture 逐行命中全部 ${PROBE_FIXTURE_EXPECTATIONS.length} 条术语、` +
      `${PROBE_FIXTURE_CLEAN_CASES.length} 个 clean 用例 0 误报并已删除）`,
  );
}

main();
